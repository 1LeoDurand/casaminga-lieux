# -*- coding: utf-8 -*-
"""Ajoute les ecolieux a `public.annuaire_lieux` (type `ecolieu`), pour que le
moissonneur `import-sites.py` sonde leurs sites.

Decision de Leo (D7, 2026-10-12, tache T34). Gabarit : import-annuaire.py.

Sources
  * `oasis`       : base Oasis et Habitat Participatif (YesWiki de la Cooperative
                    Oasis), licence CC BY-SA, API ouverte `?api/entries/1`.
  * `transiscope` : API GoGoCarto de Transiscope (`/api/elements`). La licence
                    est PAR FICHE (categories). On garde CC BY-SA, ODbL et
                    Licence Ouverte ; on ecarte CC BY-SA NC et l'absence de
                    licence. Les fiches dont la source d'origine est la base Oasis
                    sont ecartees ici : on les prend a la source (`oasis`).

Garanties
  * AUCUN COURRIEL, AUCUN TELEPHONE. Les lignes sont construites champ par champ
    depuis une liste blanche ; `bf_mail`, `bf_tel` et autres contacts de l'API
    Oasis ne sont jamais copies, ni dans une ligne, ni dans un affichage.
  * IDENTIFIANTS STABLES : uuid5 de (source, id_source), meme espace que
    import-annuaire.py. `masque`, `motif_masquage`, `organization_id` ne sont
    jamais envoyes : le travail editorial survit.
  * DEDOUBLONNAGE contre l'annuaire existant : meme domaine de site, ou nom
    proche a moins de 150 m. Un Oasis deja present n'est pas recree : sa
    licence et son attribution sont completees (PATCH), rien d'autre.
  * POLITESSE : une requete par seconde, User-Agent CasamingaImport/1.0.

Usage
    python scripts/import-ecolieux.py --essai --region Occitanie    (rien n'est ecrit)
    python scripts/import-ecolieux.py --ecrire --region Occitanie    (ecriture ; exige la migration 0027)
"""
import argparse
import difflib
import json
import math
import re
import ssl
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_commun import Base, load_env  # noqa: E402

ESPACE = uuid.UUID("6ba7b811-9dad-11d1-80b4-00c04fd430c8")  # NAMESPACE_URL, comme import-annuaire.py
UA = "CasamingaImport/1.0 (+https://casaminga.com)"
OASIS_API = "https://basededonnees-habitatparticipatif-oasis.fr/?api/entries/1"
TRANSISCOPE_API = "https://transiscope.gogocarto.fr/api/elements"
RAYON_M = 150
SEUIL_NOM = 0.85
TYPE = "ecolieu"

DEPARTEMENTS = {
    "09": "Ariège", "11": "Aude", "12": "Aveyron", "30": "Gard", "31": "Haute-Garonne",
    "32": "Gers", "34": "Hérault", "46": "Lot", "48": "Lozère", "65": "Hautes-Pyrénées",
    "66": "Pyrénées-Orientales", "81": "Tarn", "82": "Tarn-et-Garonne",
}
REGIONS = {"Occitanie": list(DEPARTEMENTS)}
# Rectangle large autour de l'Occitanie, pour la requete Transiscope ; le
# filtrage fin se fait ensuite par code postal.
BOUNDS = {"Occitanie": "-0.4,42.3,4.9,45.1"}

ATTRIB_OASIS = ("Base de donnees Oasis et Habitat Participatif, Cooperative Oasis et "
                "Habitat Participatif France (CC BY-SA)")
LICENCE_OASIS = "CC BY-SA"

# Licences Transiscope acceptees, dans l'ordre de preference. Le libelle sert
# de colonne `licence`. Les motifs lisent les categories de la fiche.
LICENCES_OK = [
    ("CC BY-SA", re.compile(r"^cc-?by-?sa$", re.I)),
    ("ODbL", re.compile(r"^odbl", re.I)),
    ("Licence Ouverte", re.compile(r"^licence ouverte", re.I)),
]
LICENCE_NC = re.compile(r"\bnc\b|non[- ]?commercial", re.I)

# Mots forts (sondage du 2026-10-08, 1 371 fiches France). Comparaison sans
# accent ni casse, sur nom + resume + description + categories.
MOTS_FORTS = re.compile(
    r"eco-?lieux?|ecovillages?|ressourcements?|chantiers? participatifs?"
    r"|accueil de groupes?|\bstages?\b|\bsejours?\b|\bretraites?\b")
FAUSSE_RETRAITE = re.compile(r"maison de retraite|retraites? complementaire|pension|carsat|agirc")

# Pages de reseaux sociaux et hebergeurs de pages : aucune valeur pour le
# moissonneur, on ne les garde pas comme site_web.
SITES_SANS_VALEUR = re.compile(
    r"(^|\.)(facebook|instagram|linkedin|twitter|x|youtube|youtu|tiktok|pinterest|linktr|helloasso"
    r"|wixsite|jimdofree|jimdosite|weebly|blogspot|google|goo)\.(com|be|ee|gl|fr|co|be)$|^sites\.google\.com$|^fb\.me$")


# ---------- utilitaires ----------

def aplati(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def nettoyer_site(url):
    """URL de site publiable, ou None. Retire les espaces (« cantercel. com »)."""
    s = re.sub(r"\s+", "", url or "")
    if not s or "." not in s:
        return None
    s = re.sub(r"^(https?://)+(?=https?://)", "", s, flags=re.I)
    if not re.match(r"^https?://", s, re.I):
        s = "https://" + s
    try:
        hote = urllib.parse.urlsplit(s).hostname or ""
    except ValueError:
        return None
    if not hote or "." not in hote:
        return None
    return s.rstrip("/")


def domaine(url):
    try:
        h = (urllib.parse.urlsplit(url).hostname or "").lower()
    except ValueError:
        return None
    return re.sub(r"^www\.", "", h) or None


def distance_m(a, b):
    (la1, lo1), (la2, lo2) = a, b
    p = math.pi / 180
    x = (lo2 - lo1) * p * math.cos((la1 + la2) / 2 * p)
    y = (la2 - la1) * p
    return 6371000 * math.hypot(x, y)


def nombre(v):
    try:
        return float(str(v).strip().replace(",", ".")) if str(v).strip() else None
    except ValueError:
        return None


def sans_tiret_long(t):
    if not t:
        return t
    t = re.sub(r"\s+[\u2014\u2013]\s+", ", ", t)
    return t.replace("\u2014", ",").replace("\u2013", ",")


def dept_de_cp(cp):
    cp = (cp or "").strip()
    return cp[:2] if re.match(r"^\d{5}$", cp) else None


_dernier_appel = [0.0]


def get_json(url):
    """GET poli : une requete par seconde, User-Agent declare. La verification
    du certificat n'est jamais desactivee."""
    attente = 1.0 - (time.time() - _dernier_appel[0])
    if attente > 0:
        time.sleep(attente)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json",
                                               "Accept-Encoding": "gzip"})
    try:
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    import gzip
                    raw = gzip.decompress(raw)
        except urllib.error.URLError as e:
            # Le magasin de certificats de Python peut ignorer la chaine recente
            # de Let's Encrypt alors que celui de Windows la connait (constate le
            # 2026-10-12 sur la base Oasis). On relit alors avec curl, qui
            # verifie le certificat avec le magasin du systeme.
            if not isinstance(getattr(e, "reason", None), ssl.SSLCertVerificationError):
                raise
            res = subprocess.run(["curl", "-sS", "--fail", "--compressed", "-A", UA, "-H",
                                  "Accept: application/json", url], capture_output=True, timeout=300)
            if res.returncode != 0:
                sys.exit("echec de lecture %s : %s" % (url.split("?")[0], res.stderr.decode("utf-8", "replace")[:200]))
            raw = res.stdout
    except urllib.error.URLError as e:
        sys.exit("echec de lecture %s : %s" % (url.split("?")[0], e))
    finally:
        _dernier_appel[0] = time.time()
    return json.loads(raw.decode("utf-8", errors="replace"))


# ---------- sources ----------

def lignes_oasis(depts, stats):
    """Projets de la base Oasis, en lignes d'annuaire. Liste blanche de champs."""
    data = get_json(OASIS_API)
    out = []
    for e in data:
        if str(e.get("id_typeannonce")) != "1":      # 1 = projet (les autres types sont des fiches annexes)
            continue
        nom = (e.get("bf_titre") or "").strip()
        ident = (e.get("id_fiche") or "").strip()
        if not nom or not ident:
            continue
        dept = (e.get("listeListeDepartement") or "").strip().upper()
        if dept not in depts:
            continue
        stats["oasis_zone"] += 1
        etat = (e.get("listeListeEtatProjet") or "").strip()
        if etat in ("arrete", "suspens", "plus_hp"):
            stats["oasis_arrete"] += 1
            continue
        # La base ne publie que les fiches dont le projet a donne son accord.
        if (e.get("listeListeAccordDiffusionInformations") or "").strip() != "oui":
            stats["oasis_sans_accord"] += 1
            continue
        geo = e.get("bf_geolocation") or {}
        lat, lon = (nombre(geo.get("latitude")), nombre(geo.get("longitude"))) if isinstance(geo, dict) else (None, None)
        site = nettoyer_site(e.get("bf_site_internet"))
        if site and SITES_SANS_VALEUR.search(domaine(site) or ""):
            stats["site_reseau_social"] += 1
            site = None
        cp = (e.get("bf_code_postal") or "").strip() or None
        commune = (e.get("bf_ville") or "").strip() or None
        rue = (e.get("bf_adresse1") or "").strip()
        adresse = " ".join(x for x in [rue, cp or "", commune or ""] if x) or None
        types = (e.get("checkboxListeTypeDeProjet") or "")
        familles = ", ".join(x for x in [
            "habitat participatif" if "hp" in types.split(",") else "",
            "oasis ressource" if "oasisressource" in types else ""] if x) or None
        out.append({
            "id_source": ident, "source": "oasis", "source_url": (e.get("url") or "").strip() or None,
            "licence": LICENCE_OASIS, "attribution": ATTRIB_OASIS,
            "nom": sans_tiret_long(nom), "type": TYPE, "familles": familles,
            "etat": "Lieu ouvert" if etat == "actif" else None, "statut_juridique": None,
            "adresse": sans_tiret_long(adresse), "commune": commune, "code_postal": cp,
            "code_insee": None, "departement": DEPARTEMENTS.get(dept), "region": "Occitanie",
            "latitude": lat, "longitude": lon, "site_web": site,
        })
    return out


def licence_fiche(categories):
    """(libelle, motif_exclusion). Un des deux est None."""
    cats = [c.strip() for c in categories or [] if isinstance(c, str)]
    if any(LICENCE_NC.search(c) and re.search(r"cc|licence|odbl", c, re.I) for c in cats):
        return None, "licence NC"
    for libelle, motif in LICENCES_OK:
        if any(motif.match(c) for c in cats):
            return libelle, None
    return None, "sans licence reconnue"


def lignes_transiscope(depts, bounds, stats, filtre_mots=True):
    data = get_json("%s?bounds=%s&limit=100000" % (TRANSISCOPE_API, bounds))
    out = []
    for e in data.get("data") or []:
        nom = (e.get("name") or "").strip()
        ident = str(e.get("id") or "").strip()
        if not nom or not ident:
            continue
        adr = e.get("address") or {}
        cp = (adr.get("postalCode") or "").strip()
        dept = dept_de_cp(cp)
        if dept not in depts:
            stats["transiscope_hors_zone"] += 1
            continue
        stats["transiscope_zone"] += 1
        if "oasis" in (e.get("sourceKey") or "").lower() or any(
                "oasis" in c.lower() for c in e.get("categories") or [] if isinstance(c, str)):
            stats["transiscope_oasis_pris_a_la_source"] += 1
            continue
        libelle, motif = licence_fiche(e.get("categories"))
        if motif:
            stats["exclus_" + motif.replace(" ", "_")] += 1
            continue
        foin = aplati(" ".join([nom, e.get("abstract") or "", e.get("description") or "",
                                " ".join(c for c in e.get("categories") or [] if isinstance(c, str))]))
        if filtre_mots:
            if not MOTS_FORTS.search(foin) or (re.search(r"\bretraites?\b", foin)
                                              and FAUSSE_RETRAITE.search(foin)
                                              and not re.search(r"eco-?lieu|ecovillage|ressourcement|stage|sejour", foin)):
                stats["exclus_sans_mot_fort"] += 1
                continue
        geo = e.get("geo") or {}
        site = nettoyer_site(e.get("website"))
        if site and SITES_SANS_VALEUR.search(domaine(site) or ""):
            stats["site_reseau_social"] += 1
            site = None
        rue = (adr.get("streetAddress") or "").strip()
        commune = (adr.get("addressLocality") or "").strip() or None
        adresse = " ".join(x for x in [rue, cp, commune or ""] if x) or None
        origine = (e.get("sourceKey") or "").strip() or "source inconnue"
        out.append({
            "id_source": ident, "source": "transiscope",
            "source_url": (e.get("showUrl") or "").strip() or None,
            "licence": libelle,
            "attribution": sans_tiret_long("Transiscope (GoGoCarto), carte d'origine : %s, licence %s" % (origine, libelle)),
            "nom": sans_tiret_long(nom), "type": TYPE, "familles": None, "etat": None,
            "statut_juridique": None, "adresse": sans_tiret_long(adresse), "commune": commune,
            "code_postal": cp or None, "code_insee": None, "departement": DEPARTEMENTS.get(dept),
            "region": "Occitanie", "latitude": nombre(geo.get("latitude")),
            "longitude": nombre(geo.get("longitude")), "site_web": site,
        })
    return out


# ---------- dedoublonnage ----------

class Index:
    """Domaines et grille spatiale (cellules de 0,01 degre, environ 1,1 km)."""

    def __init__(self):
        self.par_domaine = {}
        self.grille = {}

    def ajouter(self, ref):
        d = domaine(ref.get("site_web") or "")
        if d:
            self.par_domaine.setdefault(d, ref)
        if ref.get("latitude") is not None and ref.get("longitude") is not None:
            cle = (round(ref["latitude"], 2), round(ref["longitude"], 2))
            self.grille.setdefault(cle, []).append(ref)

    def trouver(self, l):
        d = domaine(l.get("site_web") or "")
        if d and d in self.par_domaine:
            return self.par_domaine[d], "domaine"
        if l.get("latitude") is None or l.get("longitude") is None:
            return None, None
        la, lo = l["latitude"], l["longitude"]
        n = aplati(l["nom"])
        for dla in (-0.01, 0, 0.01):
            for dlo in (-0.01, 0, 0.01):
                for r in self.grille.get((round(la + dla, 2), round(lo + dlo, 2)), []):
                    if distance_m((la, lo), (r["latitude"], r["longitude"])) > RAYON_M:
                        continue
                    m = aplati(r["nom"])
                    if m == n or difflib.SequenceMatcher(None, n, m).ratio() >= SEUIL_NOM:
                        return r, "nom+distance"
        return None, None


def uid(source, id_source):
    return str(uuid.uuid5(ESPACE, "casaminga:annuaire:%s:%s" % (source, id_source)))


# ---------- main ----------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--region", default="Occitanie", choices=sorted(REGIONS))
    ap.add_argument("--departement", help="code(s) departement, separes par des virgules (ex. 34,30)")
    ap.add_argument("--source", choices=["oasis", "transiscope", "tout"], default="tout")
    ap.add_argument("--essai", action="store_true", help="compte et montre 10 exemples, n'ecrit rien (defaut)")
    ap.add_argument("--ecrire", action="store_true", help="ecrit en base (exige la migration 0027)")
    ap.add_argument("--max", type=int, default=0, help="nombre maximal de lieux a creer (0 = tous)")
    ap.add_argument("--tout-transiscope", action="store_true",
                    help="ne pas filtrer Transiscope sur les mots forts (beaucoup de bruit)")
    args = ap.parse_args()
    if args.ecrire and args.essai:
        sys.exit("--essai et --ecrire s'excluent.")

    depts = REGIONS[args.region]
    if args.departement:
        depts = [d.strip().zfill(2).upper() for d in args.departement.split(",")]
        inconnus = [d for d in depts if d not in DEPARTEMENTS]
        if inconnus:
            sys.exit("departement hors %s : %s" % (args.region, ", ".join(inconnus)))

    stats = {k: 0 for k in ["oasis_zone", "oasis_arrete", "oasis_sans_accord", "transiscope_zone",
                            "transiscope_hors_zone", "transiscope_oasis_pris_a_la_source",
                            "exclus_licence_NC", "exclus_sans_licence_reconnue", "exclus_sans_mot_fort",
                            "site_reseau_social"]}
    candidats = []
    if args.source in ("oasis", "tout"):
        candidats += lignes_oasis(depts, stats)
    if args.source in ("transiscope", "tout"):
        candidats += lignes_transiscope(depts, BOUNDS[args.region], stats, not args.tout_transiscope)
    par_source = {s: sum(1 for c in candidats if c["source"] == s) for s in ("oasis", "transiscope")}

    # Annuaire existant (lecture seule).
    url, cle = load_env()
    db = Base(url, cle)
    existants = db.lire_tout("annuaire_lieux?select=id,nom,source,site_web,latitude,longitude,licence&order=id")
    ix = Index()
    for r in existants:
        ix.ajouter(r)
    ids_existants = {r["id"] for r in existants}

    a_creer, doublons, maj_oasis, entre_sources = [], [], [], 0
    vus = Index()
    for c in sorted(candidats, key=lambda x: (x["source"] != "oasis", x["nom"])):   # Oasis d'abord
        c["id"] = uid(c["source"], c["id_source"])
        if c["id"] in ids_existants:
            continue                      # deja importe par un passage precedent : l'upsert le mettra a jour
        ref, comment = ix.trouver(c)
        if ref:
            doublons.append((c, ref, comment))
            if c["source"] == "oasis" and ref["source"] != "oasis" and ref["source"] != "transiscope":
                maj_oasis.append((c, ref))
            continue
        ref2, _ = vus.trouver(c)
        if ref2:
            entre_sources += 1
            continue
        vus.ajouter(c)
        a_creer.append(c)
    deja_importes = sum(1 for c in candidats if uid(c["source"], c["id_source"]) in ids_existants)
    total_a_creer = len(a_creer)
    if args.max:
        a_creer = a_creer[:args.max]

    print("=== ESSAI A BLANC ===" if not args.ecrire else "=== ECRITURE ===")
    print("region %s, departements : %s" % (args.region, ", ".join(depts)))
    print("\nLieux trouves par source (apres licence, etat et mots forts)")
    print("  oasis       : %d  (projets de la zone : %d ; arretes ou suspendus : %d ; sans accord de diffusion : %d)"
          % (par_source["oasis"], stats["oasis_zone"], stats["oasis_arrete"], stats["oasis_sans_accord"]))
    print("  transiscope : %d  (fiches de la zone : %d ; Oasis relues a la source : %d)"
          % (par_source["transiscope"], stats["transiscope_zone"], stats["transiscope_oasis_pris_a_la_source"]))
    print("\nExclus (Transiscope)")
    print("  licence NC                : %d" % stats["exclus_licence_NC"])
    print("  sans licence reconnue     : %d" % stats["exclus_sans_licence_reconnue"])
    print("  sans mot fort (ecolieu...): %d%s" % (stats["exclus_sans_mot_fort"], "  (filtre coupe)" if args.tout_transiscope else ""))
    print("  sites reseaux sociaux non gardes comme site_web : %d" % stats["site_reseau_social"])
    print("\nLicences retenues")
    for lic in sorted({c["licence"] for c in candidats}):
        print("  %-16s %d" % (lic, sum(1 for c in candidats if c["licence"] == lic)))
    print("\nDoublons avec l'annuaire existant (%d lieux en base) : %d" % (len(existants), len(doublons)))
    print("  par domaine : %d ; par nom a moins de %d m : %d"
          % (sum(1 for d in doublons if d[2] == "domaine"), RAYON_M, sum(1 for d in doublons if d[2] != "domaine")))
    print("  dont Oasis a mettre a jour (licence/attribution seulement) : %d" % len(maj_oasis))
    print("  doublons entre sources (Oasis / Transiscope) ecartes : %d" % entre_sources)
    print("  deja importes par un passage precedent : %d" % deja_importes)
    print("\nA creer : %d%s" % (len(a_creer), " (sur %d, limite par --max)" % total_a_creer if args.max else ""))
    print("  oasis %d, transiscope %d ; avec site web : %d ; geolocalises : %d"
          % (sum(1 for c in a_creer if c["source"] == "oasis"), sum(1 for c in a_creer if c["source"] == "transiscope"),
             sum(1 for c in a_creer if c["site_web"]), sum(1 for c in a_creer if c["latitude"] is not None)))

    print("\n10 exemples (nom | commune | site)")
    pas = max(1, len(a_creer) // 10)
    for c in a_creer[::pas][:10]:
        print("  [%s] %s | %s | %s" % (c["source"], c["nom"], c["commune"] or "-", c["site_web"] or "-"))

    if not args.ecrire:
        print("\nessai a blanc : rien n'a ete envoye. Pour ecrire : --ecrire (apres application de la migration 0027).")
        return

    # La colonne `attribution` vient de la migration 0027 : sans elle, mieux vaut s'arreter avant tout envoi.
    try:
        db._call("GET", "annuaire_lieux?select=attribution&limit=1")
    except SystemExit:
        sys.exit("colonne annuaire_lieux.attribution absente : appliquer d'abord supabase/migrations/0027_annuaire_ecolieu.sql")
    for c, ref in maj_oasis:
        db._call("PATCH", "annuaire_lieux?id=eq.%s" % ref["id"], {
            "licence": "%s ; %s" % (ref.get("licence") or "Licence Ouverte 2.0", LICENCE_OASIS),
            "attribution": ATTRIB_OASIS}, headers={"Prefer": "return=minimal"})
    db.upsert("annuaire_lieux", [{k: v for k, v in c.items()} for c in a_creer], "source,id_source")
    print("\nermine : %d lieux crees, %d Oasis existants completes." % (len(a_creer), len(maj_oasis)))


if __name__ == "__main__":
    main()
