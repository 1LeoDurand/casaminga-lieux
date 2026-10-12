# -*- coding: utf-8 -*-
"""Ajoute les associations thematiques du RNA (avec site) a `public.annuaire_lieux`
(source `rna`, type `association`), pour que le moissonneur `import-sites.py`
sonde leurs sites.

Tache T36.2, 2026-10-12. Gabarit : import-ecolieux.py.

Source : Repertoire national des associations (RNA, waldec), ministere de
l'Interieur, Licence Ouverte 2.0. Fichier prepare par l'analyse du 2026-10-12
(RNA-WALDEC-HERAULT-2026-10-12.md) : `scripts/data/rna-34-waldec.csv`, ignore par
git (colonnes id;titre;objet;code_postal;commune;site;thematique).

Garanties
  * Seules les lignes thematique = oui AVEC un site utilisable sont gardees :
    domaine propre, ni reseau social, ni plateforme (liste de import_commun
    `domaine_partage` + liste d'import-ecolieux), ni valeur sans domaine.
  * AUCUN contact : ni courriel, ni telephone, ni adresse de rue (le fichier n'en
    contient pas). L'objet social n'est pas copie.
  * SANS COORDONNEES tant que `--geocoder` n'est pas passe. Le RNA ne donne que
    code postal et commune : le geocodage place donc la fiche au centre de la
    commune, pas a l'adresse. `--geocoder N` ne traite que les N premieres lignes
    a creer (mesure du taux) ; par defaut, aucun appel reseau.
  * IDENTIFIANTS STABLES : uuid5 de (rna, id RNA), meme espace que
    import-annuaire.py. `masque`, `motif_masquage`, `organization_id` ne sont
    jamais envoyes.
  * DEDOUBLONNAGE contre l'annuaire par domaine (www retire), et entre lignes RNA.

Usage
    python scripts/import-rna.py --essai                      (rien n'est ecrit ; defaut)
    python scripts/import-rna.py --essai --geocoder 20        (mesure le taux sur 20)
    python scripts/import-rna.py --ecrire                     (ecriture en base)
"""
import argparse
import csv
import json
import re
import sys
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
try:  # le magasin systeme de cette machine refuse des certificats valides (cf. import-sites.py)
    import certifi
    urllib.request.install_opener(urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=ssl.create_default_context(cafile=certifi.where()))))
except ImportError:
    pass
from import_commun import Base, domaine_partage, domaine_web_de, load_env  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

ESPACE = uuid.UUID("6ba7b811-9dad-11d1-80b4-00c04fd430c8")  # NAMESPACE_URL, comme import-annuaire.py
UA = "CasamingaImport/1.0 (+https://casaminga.com)"
SOURCE = "rna"
TYPE = "association"
LICENCE = "Licence Ouverte 2.0"
ATTRIBUTION = "Répertoire national des associations (RNA), ministère de l'Intérieur"
SOURCE_URL = "https://www.data.gouv.fr/datasets/repertoire-national-des-associations"
FICHIER = Path(__file__).resolve().parent / "data" / "rna-34-waldec.csv"
GEOCODEUR = "https://api-adresse.data.gouv.fr/search/"
DEPARTEMENTS = {"34": "Hérault"}

# Reseaux sociaux, billetteries et hebergeurs de pages : meme liste que
# import-ecolieux.py, en plus de import_commun.domaine_partage.
SITES_SANS_VALEUR = re.compile(
    r"(^|\.)(facebook|instagram|linkedin|twitter|x|youtube|youtu|tiktok|pinterest|linktr|helloasso"
    r"|wixsite|jimdofree|jimdosite|weebly|blogspot|google|goo)\.(com|be|ee|gl|fr|co|be)$|^sites\.google\.com$|^fb\.me$")


def nettoyer_site(valeur):
    """URL de site publiable, ou None. Rejette les valeurs sans domaine et les plateformes."""
    s = re.sub(r"\s+", "", valeur or "")
    if not s or "." not in s:
        return None
    # Saisies RNA malformees : "http:/x", "www.http:/x", "http : //x", "http//:x".
    s = re.sub(r"^(?:www\.)?(?:https?[:/]+)+", "", s, flags=re.I)
    s = "https://" + s if s else s
    try:
        hote = (urllib.parse.urlsplit(s).hostname or "").lower()
    except ValueError:
        return None
    # Hote plausible : lettres/chiffres/tirets, un point au moins, extension de 2+ lettres.
    if not re.match(r"^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$", hote):
        return None
    d = re.sub(r"^www\.", "", hote)
    if SITES_SANS_VALEUR.search(d) or domaine_partage(d):
        return None
    return s.rstrip("/")


def nom_lisible(titre):
    """Le RNA saisit les titres en majuscules : on ne garde que la 1re lettre capitale."""
    t = re.sub(r"\s+", " ", (titre or "").strip())
    if t.isupper():
        t = t.lower()
        t = t[:1].upper() + t[1:]
    t = re.sub(r"\s+[—–]\s+", ", ", t).replace("—", ",").replace("–", ",")
    return t


def uid(id_rna):
    return str(uuid.uuid5(ESPACE, "casaminga:annuaire:%s:%s" % (SOURCE, id_rna)))


def lire_csv(departements, stats):
    out = []
    with open(FICHIER, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f, delimiter=";"):
            stats["lues"] += 1
            cp = (r.get("code_postal") or "").strip()
            if cp[:2] not in departements:
                stats["hors_departement"] += 1
                continue
            if (r.get("thematique") or "").strip().lower() != "oui":
                continue
            stats["thematiques"] += 1
            if not (r.get("site") or "").strip():
                continue
            stats["thematiques_avec_site"] += 1
            site = nettoyer_site(r["site"])
            if not site:
                stats["site_inutilisable"] += 1
                continue
            nom, ident = nom_lisible(r.get("titre")), (r.get("id") or "").strip()
            if not nom or not ident:
                stats["sans_nom_ou_id"] += 1
                continue
            commune = (r.get("commune") or "").strip() or None
            out.append({
                "id": uid(ident), "id_source": ident, "source": SOURCE, "source_url": SOURCE_URL,
                "licence": LICENCE, "attribution": ATTRIBUTION, "nom": nom, "type": TYPE,
                "familles": None, "etat": None, "statut_juridique": "Association loi 1901",
                "adresse": None, "commune": commune, "code_postal": cp or None, "code_insee": None,
                "departement": DEPARTEMENTS.get(cp[:2]), "region": "Occitanie",
                "latitude": None, "longitude": None, "site_web": site,
            })
    return out


def geocoder(l):
    """((lat, lon), None) du centre de la commune, ou (None, motif). Le RNA n'a pas de rue."""
    q = urllib.parse.urlencode({"q": l["commune"] or "", "postcode": l["code_postal"] or "",
                                "type": "municipality", "limit": 1})
    req = urllib.request.Request(GEOCODEUR + "?" + q, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            feats = json.loads(r.read().decode("utf-8")).get("features") or []
    except (urllib.error.URLError, ValueError, TimeoutError) as e:
        return None, "erreur : %s" % e
    if not feats or feats[0]["properties"].get("score", 0) < 0.5:
        return None, "sans resultat"
    lon, lat = feats[0]["geometry"]["coordinates"]
    return (lat, lon), None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--departement", default="34", help="code(s) departement, separes par des virgules")
    ap.add_argument("--essai", action="store_true", help="compte et montre 10 exemples, n'ecrit rien (defaut)")
    ap.add_argument("--ecrire", action="store_true", help="ecrit en base")
    ap.add_argument("--max", type=int, default=0, help="nombre maximal de lieux a creer (0 = tous)")
    ap.add_argument("--geocoder", type=int, default=0, metavar="N",
                    help="geocode (centre de commune, api-adresse.data.gouv.fr) les N premieres lignes a creer ; 0 = non")
    args = ap.parse_args()
    if args.ecrire and args.essai:
        sys.exit("--essai et --ecrire s'excluent.")
    depts = [d.strip().zfill(2) for d in args.departement.split(",")]

    stats = {k: 0 for k in ["lues", "hors_departement", "thematiques", "thematiques_avec_site",
                            "site_inutilisable", "sans_nom_ou_id"]}
    candidats = lire_csv(depts, stats)

    url, cle = load_env()
    db = Base(url, cle)
    existants = db.lire_tout("annuaire_lieux?select=id,nom,source,site_web&order=id")
    par_domaine = {}
    for r in existants:
        d = domaine_web_de(r.get("site_web"))
        if d:
            par_domaine.setdefault(d, r)
    ids_existants = {r["id"] for r in existants}

    a_creer, doublons, entre_rna, deja = [], [], 0, 0
    vus = set()
    for c in sorted(candidats, key=lambda x: x["id_source"]):
        if c["id"] in ids_existants:
            deja += 1
            continue
        d = domaine_web_de(c["site_web"])
        if d in par_domaine:
            doublons.append((c, par_domaine[d]))
            continue
        if d in vus:
            entre_rna += 1
            continue
        vus.add(d)
        a_creer.append(c)
    total = len(a_creer)
    if args.max:
        a_creer = a_creer[:args.max]

    geo_ok = geo_ko = 0
    erreurs_geo = {}
    for l in a_creer[:args.geocoder]:
        res, err = geocoder(l)
        time.sleep(0.2)
        if res:
            l["latitude"], l["longitude"] = res
            geo_ok += 1
        else:
            geo_ko += 1
            erreurs_geo[err] = erreurs_geo.get(err, 0) + 1

    print("=== ECRITURE ===" if args.ecrire else "=== ESSAI A BLANC ===")
    print("departements : %s ; fichier : %s" % (", ".join(depts), FICHIER.name))
    print("\nLignes lues %d (hors departement %d)" % (stats["lues"], stats["hors_departement"]))
    print("  thematiques                 : %d" % stats["thematiques"])
    print("  dont avec un site renseigne : %d" % stats["thematiques_avec_site"])
    print("  site inutilisable (reseau, plateforme, sans domaine) : %d" % stats["site_inutilisable"])
    print("  sans nom ou sans id         : %d" % stats["sans_nom_ou_id"])
    print("\nDoublons avec l'annuaire (%d lieux en base) : %d (par domaine)" % (len(existants), len(doublons)))
    print("  doublons entre lignes RNA (meme domaine) ecartes : %d" % entre_rna)
    print("  deja importes par un passage precedent : %d" % deja)
    for c, ref in doublons[:10]:
        print("    %s | %s  =  %s (%s)" % (c["nom"][:40], domaine_web_de(c["site_web"]), ref["nom"][:30], ref["source"][:20]))
    print("\nA creer : %d%s ; geolocalises : %d"
          % (len(a_creer), " (sur %d, limite par --max)" % total if args.max else "",
             sum(1 for c in a_creer if c["latitude"] is not None)))
    if args.geocoder:
        n = geo_ok + geo_ko
        print("Geocodage (centre de commune) sur %d lignes : %d trouvees (%.0f %%), %d echecs %s"
              % (n, geo_ok, 100.0 * geo_ok / max(n, 1), geo_ko, erreurs_geo or ""))
    print("\n10 exemples (nom | commune | site)")
    pas = max(1, len(a_creer) // 10)
    for c in a_creer[::pas][:10]:
        print("  %s | %s | %s" % (c["nom"], c["commune"] or "-", c["site_web"]))

    if not args.ecrire:
        print("\nessai a blanc : rien n'a ete envoye.")
        return
    try:
        db._call("GET", "annuaire_lieux?select=attribution&limit=1")
    except SystemExit:
        sys.exit("colonne annuaire_lieux.attribution absente : appliquer d'abord la migration 0027")
    db.upsert("annuaire_lieux", a_creer, "source,id_source")
    print("\ntermine : %d lieux crees." % len(a_creer))


if __name__ == "__main__":
    main()
