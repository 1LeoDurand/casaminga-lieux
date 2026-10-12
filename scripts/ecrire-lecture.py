# -*- coding: utf-8 -*-
"""
Lecture par modèle, temps (c) : écrire les fiches lues (S9 / S20 étage 2, D10).

Entrées, dans `08 Import evenements/Mesures/lecture/` :
- `paquet-NN.json`    (preparer-lecture.py) : le texte des pages lues ;
- `resultat-NN.json`  (sous-agents Haiku, CONSIGNE-HAIKU.md) : les fiches ;
- `relecture-NN.json` (sous-agents Sonnet, CONSIGNE-RELECTURE-SONNET.md) :
  un verdict par fiche.

Chaîne, pour chaque fiche :
1. garde-fous : JSON conforme, titre non vide, date lisible dans les 12 mois
   à venir (R9), lieu ou commune, confiance haute ou moyenne, `extrait`
   présent mot pour mot dans la page, jour, mois et année de la date écrits
   dans l'extrait (S9 : « date présente littéralement »), jamais de lien
   HelloAsso (R2), courriels et téléphones retirés (R13) ;
2. exclusions éditoriales (R10, liste ci-dessous, compteur par motif) ;
3. retraits sur demande (P2, import_commun.retrait_concerne) ;
4. typage : typer_v2 d'abord (règles), le type du modèle sur le reliquat
   (R15) ;
5. dédoublonnage interne puis par le module partagé (R7, dedoublonnage.py) ;
6. relecture : seules les fiches au verdict `ok` (ou `a_corriger` avec des
   corrections hors date) sont écrites. Sans relecture complète, ou au-delà
   de 5 % de `date_fausse`, le script REFUSE d'écrire (R14, D10).

Écriture (hors --essai) : organisation `source = 'lecture:<site>'`, non
revendiquée (claimed_at nul), vitrine, établissements par lieu lu (géocodés
par la BAN, R16), fiches `portal_status = 'pending'` (R1) et
`evenements_import` (source, source_url = page lue, attribution « Lu sur le
site de l'association »). Un registre par site est ajouté à
`registre.csv`, et un journal du passage à `journal-<date>.json` (R18).

En --essai, rien n'est écrit en base ; le script produit `a-relire-NN.json`
(fiches qui ont passé les garde-fous) pour la relecture Sonnet.

Usage
-----
  python scripts/ecrire-lecture.py --essai                       (lit la base, n'écrit rien)
  python scripts/ecrire-lecture.py --essai --sans-base           (aucun accès à la base)
  python scripts/ecrire-lecture.py --essai --relecture "<dossier>/relecture-*.json"
  python scripts/ecrire-lecture.py --relecture "<dossier>/relecture-*.json"   (écrit)

La clé de service est lue dans .env.local et n'est jamais affichée.
"""

import argparse
import csv
import glob
import json
import re
import ssl
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))

from import_commun import (  # noqa: E402
    NS, Base, EXCLUSION_RECRUTEMENT, compter_retrait, domaine_partage, domaine_web_de,
    lire_retraits, load_env, retrait_a_relire, retrait_concerne, slugify, texte, typer_v2,
)
from dedoublonnage import REGLE as REGLE_DEDOUBLONNAGE, Dedoublonneur, decalage_paris, titre_cle  # noqa: E402

try:
    import certifi
    _CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _CTX = ssl.create_default_context()

DOSSIER_DEFAUT = ICI.parents[2] / "08 Import evenements" / "Mesures" / "lecture"
ATTRIBUTION = "Lu sur le site de l'association"
SEUIL_DATES_FAUSSES = 0.05          # R14 : arrêt au-delà de 5 %
FENETRE_JOURS = 365                 # R9
DUREE_MAX_JOURS = 60                # au-delà : période suspecte (saison entière, erreur d'année)
MAX_PAR_TITRE = 6                   # R9 : 6 dates au plus par série
CONFIANCES = {"haute", "moyenne"}
BAN = "https://api-adresse.data.gouv.fr/search/"
USER_AGENT = "CasamingaBot/1.0 (+https://casaminga.com/contact)"

TYPES = {"atelier": "atelier", "stage": "stage", "formation": "formation", "retraite": "retraite",
         "séjour": "sejour", "sejour": "sejour", "rencontre": "rencontre", "spectacle": "spectacle",
         "concert": "concert", "exposition": "exposition", "marché": "marche", "marche": "marche",
         "fête": "fete", "fete": "fete", "autre": "autre"}

# R10 : exclusions éditoriales, sous-chaîne sur titre sans accent.
EXCLUSIONS = [
    ("exclusion_recrutement", EXCLUSION_RECRUTEMENT),
    ("exclusion_vie_interne", re.compile(
        r"assemblee generale|\bag\b|conseil d.administration|reunion (?:de |du )?bureau|reunion des adherents", re.I)),
    ("exclusion_brocante", re.compile(r"brocante|vide-?greniers?|bourse aux", re.I)),
    ("exclusion_competition", re.compile(r"competition|championnat|tournoi", re.I)),
    ("exclusion_commercial", re.compile(r"\bsoldes\b|vente privee|salon professionnel|portes? ouvertes? commerciales?", re.I)),
]

MOTIFS = [
    "json_invalide", "site_inconnu", "page_inconnue", "sans_titre", "date_illisible", "passe",
    "hors_fenetre", "duree_suspecte", "serie_au_dela_de_6", "sans_lieu", "confiance_basse",
    "extrait_introuvable", "date_non_litterale",
] + [m for m, _ in EXCLUSIONS] + [
    "retrait", "organisation_revendiquee", "doublon_interne", "deja_importe", "doublon_base",
    "relecture_date_fausse", "relecture_a_ecarter", "relecture_a_corriger_sans_correction", "non_relue",
]

MOIS_NOMS = ["janv", "f[eé]vr", "mars", "avr", "mai", "juin", "juil", "ao[uû]t", "sept", "oct", "nov", "d[eé]c"]
COURRIEL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
TELEPHONE = re.compile(r"(?<!\d)(?:\+33\s?\(?0?\)?\s?|0)[1-9](?:[\s.\-]?\d{2}){4}(?!\d)")
HELLOASSO = re.compile(r"helloasso", re.I)
DATE_ISO = re.compile(r"^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?)?$")


# ── Outils ───────────────────────────────────────────────────────

def norm(t):
    """Forme de comparaison d'un extrait avec la page : apostrophes et
    espaces unifiés, minuscule."""
    t = (t or "").replace("’", "'").replace("‘", "'").replace(" ", " ").replace(" ", " ")
    return " ".join(t.split()).lower()


def sa(t):
    return unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower()


def propre(v, n=None):
    """Texte nettoyé (import_commun.texte), sans courriel ni téléphone (R13)."""
    if v is None:
        return None
    t = texte(str(v)) or ""
    t = TELEPHONE.sub("", COURRIEL.sub("", t)).strip(" -–,;:")
    if n:
        t = t[:n]
    return t or None


def paris_vers_utc(local_naif):
    """Heure de Paris (naïve) vers UTC, sans zoneinfo (tzdata absent sous Windows)."""
    for decalage in (2, 1):
        cand = (local_naif - timedelta(hours=decalage)).replace(tzinfo=timezone.utc)
        if decalage_paris(cand) == decalage:
            return cand
    return (local_naif - timedelta(hours=1)).replace(tzinfo=timezone.utc)


def lire_date(valeur):
    """(datetime local naïf, heure_presente) ou (None, None)."""
    if not isinstance(valeur, str):
        return None, None
    m = DATE_ISO.match(valeur.strip())
    if not m:
        return None, None
    an, mo, jo, h, mi = m.groups()
    try:
        return datetime(int(an), int(mo), int(jo), int(h or 0), int(mi or 0)), h is not None
    except ValueError:
        return None, None


def date_litterale(d, extrait, extrait_annee):
    """Jour, mois et année de `d` écrits dans l'extrait (l'année peut venir du
    titre de section recopié dans extrait_annee)."""
    e = sa(extrait)
    ea = sa(extrait_annee)
    jour = rf"(?<!\d)0?{d.day}(?:er)?(?!\d)"
    if not re.search(jour, e):
        return False
    mois_nom = re.compile(sa(MOIS_NOMS[d.month - 1]).replace("[ee]", "e").replace("[uu]", "u"))
    mois_num = re.compile(rf"(?<!\d)0?{d.day}\s*[/.\-]\s*0?{d.month}(?!\d)")
    if not (mois_nom.search(e) or mois_nom.search(ea) or mois_num.search(e)):
        return False
    annee = rf"(?<!\d){d.year}(?!\d)|(?<!\d)0?{d.month}\s*[/.]\s*{d.year % 100:02d}(?!\d)"
    return bool(re.search(annee, e) or re.search(rf"(?<!\d){d.year}(?!\d)", ea))


def geocoder(cache, adresse, commune, nom):
    """(lat, lng) par la BAN (api-adresse.data.gouv.fr), ou (None, None).
    Une commune seule est acceptée (coordonnées du centre) : mieux qu'une
    fiche invisible, et la modération voit le lieu en texte."""
    q = " ".join(x for x in [adresse or nom, commune] if x)
    if not commune and not adresse:
        return None, None
    if q in cache:
        return cache[q]
    params = {"q": q[:200], "limit": "1"}
    req = urllib.request.Request(f"{BAN}?{urllib.parse.urlencode(params)}",
                                 headers={"User-Agent": USER_AGENT})
    res = (None, None)
    try:
        with urllib.request.urlopen(req, timeout=15, context=_CTX) as r:
            feats = json.loads(r.read().decode("utf-8")).get("features") or []
        if feats and feats[0]["properties"].get("score", 0) >= 0.5:
            f = feats[0]
            ville = sa(f["properties"].get("city"))
            if not commune or sa(commune) in ville or ville in sa(commune):
                lng, lat = f["geometry"]["coordinates"][:2]
                res = (lat, lng)
    except Exception:
        pass
    time.sleep(0.05)
    cache[q] = res
    return res


def verifier_colonnes(db, table, rows):
    """Clés des lignes absentes de la table (lecture d'une ligne d'exemple)."""
    if not rows:
        return []
    ex = db._call("GET", f"{table}?limit=1")
    if not ex:
        return []
    return sorted(set().union(*(r.keys() for r in rows)) - set(ex[0].keys()))


# ── Lecture des fichiers ─────────────────────────────────────────

def charger_paquets(dossier):
    paquets, sites, pages = {}, {}, {}
    for chemin in sorted(Path(dossier).glob("paquet-*.json")):
        d = json.loads(chemin.read_text(encoding="utf-8"))
        num = chemin.stem.split("-")[1]
        paquets[num] = d
        for s in d["sites"]:
            sites[s["site_id"]] = dict(s, paquet=num, date_reference=d["date_reference"])
            for p in s["pages"]:
                pages[(s["site_id"], p["page"])] = p["texte"]
    return paquets, sites, pages


def charger_resultats(dossier):
    """{numéro: contenu} ; un fichier illisible est compté, pas fatal."""
    resultats, illisibles = {}, []
    for chemin in sorted(Path(dossier).glob("resultat-*.json")):
        num = chemin.stem.split("-")[1]
        try:
            d = json.loads(chemin.read_text(encoding="utf-8"))
            if not isinstance(d.get("sites"), list):
                raise ValueError("clé sites absente")
            resultats[num] = d
        except (ValueError, AttributeError) as e:
            illisibles.append(f"{chemin.name} : {e}")
    return resultats, illisibles


def charger_relectures(motifs):
    verdicts = {}
    fichiers = sorted({f for m in motifs or [] for f in glob.glob(m)})
    for f in fichiers:
        d = json.loads(Path(f).read_text(encoding="utf-8"))
        for v in d.get("verdicts", d) if isinstance(d, dict) else d:
            if isinstance(v, dict) and v.get("id"):
                verdicts[v["id"]] = v
    return verdicts, fichiers


# ── Garde-fous ───────────────────────────────────────────────────

def examiner(f, site, pages, aujourdhui):
    """Fiche normalisée, ou (None, motif)."""
    if not isinstance(f, dict):
        return None, "json_invalide"
    sid = f.get("site_id") or site["site_id"]
    page = f.get("page")
    texte_page = pages.get((sid, page))
    if texte_page is None:
        return None, "page_inconnue"
    titre = propre(f.get("titre"), 200)
    if not titre:
        return None, "sans_titre"
    debut, heure = lire_date(f.get("debut"))
    if debut is None:
        return None, "date_illisible"
    fin, heure_fin = lire_date(f.get("fin")) if f.get("fin") else (None, None)
    if f.get("fin") and fin is None:
        return None, "date_illisible"
    ref = date.fromisoformat(site["date_reference"])
    jour_min = max(ref, aujourdhui)
    if debut.date() < jour_min:
        return None, "passe"
    if debut.date() > jour_min + timedelta(days=FENETRE_JOURS):
        return None, "hors_fenetre"
    if fin and (fin < debut or (fin - debut).days > DUREE_MAX_JOURS):
        return None, "duree_suspecte"
    lieu_nom = propre(f.get("lieu_nom"), 150)
    lieu_adresse = propre(f.get("lieu_adresse"), 200)
    lieu_commune = propre(f.get("lieu_commune"), 100)
    if not (lieu_nom or lieu_adresse or lieu_commune):
        return None, "sans_lieu"
    if (f.get("confiance") or "").lower() not in CONFIANCES:
        return None, "confiance_basse"
    extrait, extrait_annee = f.get("extrait") or "", f.get("extrait_annee") or ""
    page_n = norm(texte_page)
    if not extrait or norm(extrait) not in page_n or (extrait_annee and norm(extrait_annee) not in page_n):
        return None, "extrait_introuvable"
    if not date_litterale(debut, extrait, extrait_annee):
        return None, "date_non_litterale"

    lien = (f.get("lien") or "").strip()
    if not lien.startswith(("http://", "https://")) or HELLOASSO.search(lien) or lien not in texte_page + page:
        lien = page  # R2, et un lien absent de la page n'est pas repris
    prix = f.get("prix_euros")
    prix = float(prix) if isinstance(prix, (int, float)) and 0 <= prix < 10000 else None
    if f.get("gratuit") is True:
        prix = 0.0
    return {
        "site_id": sid, "page": page, "titre": titre, "debut_local": debut, "heure": heure,
        "fin_local": fin, "heure_fin": heure_fin, "lieu_nom": lieu_nom, "lieu_adresse": lieu_adresse,
        "lieu_commune": lieu_commune, "prix_texte": propre(f.get("prix_texte"), 120),
        "gratuit": f.get("gratuit") if isinstance(f.get("gratuit"), bool) else None,
        "prix": prix, "lien": lien, "type_modele": TYPES.get((f.get("type") or "").strip().lower()),
        "confiance": f.get("confiance"), "extrait": extrait[:300], "extrait_annee": extrait_annee or None,
    }, None


def bornes_utc(f):
    """start_at et end_at en UTC (ISO). Heure inconnue : minuit de Paris
    (convention commune, dedoublonnage.heure_inconnue) et fin à 23 h 59 du
    dernier jour ; heure connue sans fin : une heure (normaliser_fin du
    moissonneur)."""
    d = f["debut_local"]
    debut = paris_vers_utc(d if f["heure"] else d.replace(hour=0, minute=0))
    if f["fin_local"]:
        fl = f["fin_local"] if f["heure_fin"] else f["fin_local"].replace(hour=23, minute=59)
        fin = paris_vers_utc(fl)
    elif f["heure"]:
        fin = debut + timedelta(hours=1)
    else:
        fin = paris_vers_utc(d.replace(hour=23, minute=59))
    if fin <= debut:
        fin = debut + timedelta(hours=1)
    return debut.isoformat(), fin.isoformat()


# ── Programme ────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Lecture par modèle : écrire les fiches relues")
    ap.add_argument("--dossier", default=str(DOSSIER_DEFAUT), help="paquets, résultats, relectures")
    ap.add_argument("--essai", action="store_true", help="n'écrit rien en base ; produit a-relire-NN.json")
    ap.add_argument("--sans-base", action="store_true", dest="sans_base",
                    help="(avec --essai) ni lecture ni écriture en base : pas de dédoublonnage ni de retraits")
    ap.add_argument("--sans-geocodage", action="store_true", dest="sans_geocodage")
    ap.add_argument("--relecture", nargs="+", metavar="chemin.json",
                    help="verdicts Sonnet (fichiers ou motifs, ex. relecture-*.json)")
    args = ap.parse_args()
    if args.sans_base and not args.essai:
        raise SystemExit("--sans-base n'a de sens qu'avec --essai.")

    t0 = time.time()
    dossier = Path(args.dossier)
    maintenant = datetime.now(timezone.utc)
    aujourdhui = (maintenant + timedelta(hours=decalage_paris(maintenant))).date()  # jour de Paris
    paquets, sites, pages = charger_paquets(dossier)
    resultats, illisibles = charger_resultats(dossier)
    verdicts, fichiers_relecture = charger_relectures(args.relecture)
    print(f"Entrées  : {len(paquets)} paquets, {len(sites)} sites, {len(resultats)} résultats lus, "
          f"{len(illisibles)} illisibles, {len(verdicts)} verdicts ({len(fichiers_relecture)} fichiers)")
    for x in illisibles:
        print(f"  illisible : {x}")

    registre = {sid: {"motifs": {}, "fiches_modele": 0, "rejets_modele": 0, "candidates": 0, "ecrites": 0}
                for sid in sites}

    def ecarter(sid, motif):
        r = registre.setdefault(sid, {"motifs": {}, "fiches_modele": 0, "rejets_modele": 0,
                                      "candidates": 0, "ecrites": 0})
        r["motifs"][motif] = r["motifs"].get(motif, 0) + 1

    # 1. Garde-fous
    candidates, rejets_modele = [], {}
    for num, res in sorted(resultats.items()):
        for bloc in res["sites"]:
            sid = (bloc or {}).get("site_id")
            if sid not in sites:
                ecarter(sid or "?", "site_inconnu")
                continue
            for rj in bloc.get("rejets") or []:
                m = (rj or {}).get("motif") or "autre"
                rejets_modele[m] = rejets_modele.get(m, 0) + 1
                registre[sid]["rejets_modele"] += 1
            for f in bloc.get("fiches") or []:
                registre[sid]["fiches_modele"] += 1
                fiche, motif = examiner(f, sites[sid], pages, aujourdhui)
                if motif:
                    ecarter(sid, motif)
                    continue
                fiche["paquet"] = sites[sid]["paquet"]
                candidates.append(fiche)

    # 2. Exclusions éditoriales, série au-delà de 6, doublon interne
    retenues, vus, par_titre = [], set(), {}
    for f in sorted(candidates, key=lambda x: (x["site_id"], x["debut_local"])):
        titre_sa = sa(f["titre"])
        motif = next((m for m, rx in EXCLUSIONS if rx.search(titre_sa) or rx.search(f["titre"])), None)
        if motif:
            ecarter(f["site_id"], motif)
            continue
        tc = titre_cle(f["titre"])
        cle = (f["site_id"], tc, f["debut_local"].date())
        if cle in vus:
            ecarter(f["site_id"], "doublon_interne")
            continue
        vus.add(cle)
        n = par_titre.get((f["site_id"], tc), 0) + 1
        par_titre[(f["site_id"], tc)] = n
        if n > MAX_PAR_TITRE:
            ecarter(f["site_id"], "serie_au_dela_de_6")
            continue
        f["start_at"], f["end_at"] = bornes_utc(f)
        f["source"] = f"lecture:{f['site_id']}"
        f["source_uid"] = f"{f['page']}|{tc}|{f['debut_local'].date().isoformat()}"
        f["id"] = str(uuid.uuid5(NS, f"evt:lecture:{f['site_id']}:{f['source_uid']}"))
        f["type"] = typer_v2(f["titre"], None, f["start_at"], f["end_at"])[0] or f["type_modele"] or "autre"
        retenues.append(f)

    # 3. Base : retraits, organisations, dédoublonnage (lecture seule en essai)
    db = None
    if not args.sans_base:
        url, key = load_env()
        db = Base(url, key)
    retraits = lire_retraits(db) if db else []
    org_rows = db.lire_tout("organizations?select=id,slug,source,website,claimed_at") if db else []
    orgs_par_id = {o["id"]: o for o in org_rows}
    orgs_par_domaine = {}
    for o in org_rows:
        dom = domaine_web_de(o.get("website"))
        if dom and not domaine_partage(dom):
            orgs_par_domaine.setdefault(dom, o)
    slugs_pris = {o["slug"] for o in org_rows}
    sites_existants = ({s["organization_id"] for s in db.lire_tout("public_sites?select=organization_id")}
                       if db else set())
    etabs_existants = {e["id"] for e in db.lire_tout("establishments?select=id")} if db else set()
    deja_importes = ({i["event_id"] for i in db.lire_tout("evenements_import?select=event_id")}
                     if db else set())
    dedoublonneur = Dedoublonneur(db) if db else None

    bilan_retrait, a_relire_nom = {}, set()
    orgs_a_creer, sites_a_creer, etabs_a_creer = [], [], []
    org_de_site, cache_geo = {}, {}
    lot, liees = [], 0

    def organisation_pour(sid):
        if sid in org_de_site:
            return org_de_site[sid]
        s = sites[sid]
        dom = domaine_web_de(s["site"])
        existante = orgs_par_domaine.get(dom) if dom and not domaine_partage(dom) else None
        oid = existante["id"] if existante else str(uuid.uuid5(NS, "org:lecture:" + sid))
        org = existante or orgs_par_id.get(oid)
        verdict = retrait_concerne(retraits, organization_id=oid if org else None, source=f"lecture:{sid}",
                                   nom=s["association"], commune=s.get("commune"), domaine=s["site"])
        if retrait_a_relire(retraits, s["association"], s.get("commune")):
            a_relire_nom.add(s["association"])
        revendiquee = bool(org and org.get("claimed_at"))
        nouvelle = org is None
        if nouvelle and verdict != "refuser":
            base = "import-" + slugify(s["association"])
            slug, n = base, 1
            while slug in slugs_pris:
                n += 1
                slug = f"{base}-{n}"
            slugs_pris.add(slug)
            orgs_a_creer.append({
                "id": oid, "slug": slug, "name": s["association"][:120], "address": s.get("commune"),
                "website": s["site"], "structure": "autre", "org_type": "autre", "source": f"lecture:{sid}",
            })
            if oid not in sites_existants:
                sites_a_creer.append({"organization_id": oid, "slug": slug,
                                      "title": s["association"][:120], "status": "publie"})
        org_de_site[sid] = (oid, verdict, revendiquee, nouvelle)
        return org_de_site[sid]

    def etablissement_pour(oid, sid, f, nouvelle):
        cle = sa(" ".join(x for x in [f["lieu_nom"], f["lieu_adresse"], f["lieu_commune"]] if x))
        eid = str(uuid.uuid5(NS, f"est:lecture:{sid}:{cle}"))
        lat, lng = (None, None) if args.sans_geocodage else geocoder(
            cache_geo, f["lieu_adresse"], f["lieu_commune"], f["lieu_nom"])
        if eid not in etabs_existants and not any(e["id"] == eid for e in etabs_a_creer):
            premier = nouvelle and not any(e["organization_id"] == oid for e in etabs_a_creer)
            etabs_a_creer.append({
                "id": eid, "organization_id": oid,
                "name": (f["lieu_nom"] or f["lieu_commune"] or sites[sid]["association"])[:120],
                "slug": slugify(f["lieu_nom"] or f["lieu_commune"] or sid),
                "city": f["lieu_commune"], "address": f["lieu_adresse"], "postal_code": None,
                "latitude": lat, "longitude": lng, "is_primary": premier, "active": True,
            })
        return eid, lat, lng

    for f in retenues:
        sid = f["site_id"]
        oid, verdict, revendiquee, nouvelle = organisation_pour(sid)
        if verdict == "refuser":
            compter_retrait(bilan_retrait, verdict)
            ecarter(sid, "retrait")
            continue
        if revendiquee:
            ecarter(sid, "organisation_revendiquee")
            continue
        if f["id"] in deja_importes:
            ecarter(sid, "deja_importe")
            continue
        eid, lat, lng = etablissement_pour(oid, sid, f, nouvelle)
        f.update(organization_id=oid, establishment_id=eid, lat=lat, lng=lng, verdict_retrait=verdict)
        fiche_dd = {"titre": f["titre"], "debut": f["start_at"], "fin": f["end_at"],
                    "commune": f["lieu_commune"], "lat": lat, "lng": lng, "organization_id": oid,
                    "source": f["source"], "source_uid": f["source_uid"], "photos": [],
                    "description": None, "registration": None, "price": f["prix"]}
        if dedoublonneur:
            if dedoublonneur.deja_lie(f["source"], f["source_uid"], f["start_at"]):
                ecarter(sid, "deja_importe")
                continue
            res = dedoublonneur.chercher(fiche_dd)
            if res:
                dedoublonneur.lier(res, fiche_dd, f["source"], f["source_uid"], f["page"])
                ecarter(sid, "doublon_base")
                liees += 1
                continue
            dedoublonneur.enregistrer(fiche_dd, f["id"])
        registre[sid]["candidates"] += 1
        lot.append(f)

    # 4. Relecture
    relues = [f for f in lot if f["id"] in verdicts]
    non_relues = [f for f in lot if f["id"] not in verdicts]
    compte_v = {}
    for f in relues:
        v = verdicts[f["id"]].get("verdict")
        compte_v[v] = compte_v.get(v, 0) + 1
    taux_faux = compte_v.get("date_fausse", 0) / len(relues) if relues else 0.0
    a_ecrire = []
    for f in lot:
        v = verdicts.get(f["id"])
        if v is None:
            if verdicts:
                ecarter(f["site_id"], "non_relue")
            continue
        verdict = v.get("verdict")
        if verdict == "ok":
            a_ecrire.append(f)
        elif verdict == "a_corriger":
            corr = {k: val for k, val in (v.get("corrections") or {}).items()
                    if k in ("titre", "lieu_nom", "lieu_adresse", "lieu_commune", "type",
                             "prix_texte", "gratuit", "prix_euros")}
            if not corr:
                ecarter(f["site_id"], "relecture_a_corriger_sans_correction")
                continue
            if "titre" in corr and propre(corr["titre"], 200):
                f["titre"] = propre(corr["titre"], 200)
            if corr.get("type") and TYPES.get(str(corr["type"]).lower()):
                f["type"] = TYPES[str(corr["type"]).lower()]
            if "gratuit" in corr and corr["gratuit"] is True:
                f["prix"] = 0.0
            elif isinstance(corr.get("prix_euros"), (int, float)):
                f["prix"] = float(corr["prix_euros"])
            # Un lieu corrigé change l'établissement : on le recalcule.
            if any(k in corr for k in ("lieu_nom", "lieu_adresse", "lieu_commune")):
                for k in ("lieu_nom", "lieu_adresse", "lieu_commune"):
                    if k in corr:
                        f[k] = propre(corr[k], 200)
                eid, lat, lng = etablissement_pour(f["organization_id"], f["site_id"], f,
                                                   org_de_site[f["site_id"]][3])
                f.update(establishment_id=eid, lat=lat, lng=lng)
            a_ecrire.append(f)
        elif verdict == "date_fausse":
            ecarter(f["site_id"], "relecture_date_fausse")
        else:
            ecarter(f["site_id"], "relecture_a_ecarter")

    # Garde-fou R14 / D10
    refus = None
    if True:  # calculé aussi en essai, pour l'annoncer
        if not verdicts:
            refus = "aucune relecture fournie (--relecture) : D10 exige la relecture de toutes les fiches"
        elif non_relues:
            refus = f"{len(non_relues)} fiches sans verdict : D10 exige la relecture de toutes les fiches"
        elif taux_faux > SEUIL_DATES_FAUSSES:
            refus = (f"{compte_v.get('date_fausse', 0)} dates fausses sur {len(relues)} fiches relues "
                     f"({taux_faux:.1%}), au-delà de {SEUIL_DATES_FAUSSES:.0%} : arrêt (R14)")

    # 5. Lignes à écrire
    ecrites = a_ecrire if verdicts else []
    ids_ecrits = {f["id"] for f in ecrites}
    orgs_ecrites = {f["organization_id"] for f in ecrites}
    etabs_ecrits = {f["establishment_id"] for f in ecrites}
    evenements, provenance = [], []
    sans_coord = 0
    for f in ecrites:
        if f["lat"] is None:
            sans_coord += 1
        compter_retrait(bilan_retrait, f["verdict_retrait"])
        evenements.append({
            "id": f["id"], "organization_id": f["organization_id"], "establishment_id": f["establishment_id"],
            "title": f["titre"], "type": f["type"], "status": "publie",
            "start_at": f["start_at"], "end_at": f["end_at"], "description": None, "price": f["prix"],
            "photos": [],
            # R16 : sans coordonnées, la fiche reste invisible.
            "show_on_public_site": f["verdict_retrait"] != "masquer" and f["lat"] is not None,
            "portal_status": "pending",
        })
        provenance.append({
            "event_id": f["id"], "source": f["source"], "source_uid": f["source_uid"],
            "source_url": f["page"], "conditions": None,
            "registration": [{"type": "link", "value": f["lien"]}] if f["lien"] != f["page"] else None,
            "attribution": ATTRIBUTION, "source_maj": None,
        })
        registre[f["site_id"]]["ecrites"] += 1
    lignes = {
        "organizations": [o for o in orgs_a_creer if o["id"] in orgs_ecrites],
        "public_sites": [s for s in sites_a_creer if s["organization_id"] in orgs_ecrites],
        "establishments": [e for e in etabs_a_creer if e["id"] in etabs_ecrits],
        "evenements": evenements, "evenements_import": provenance,
    }

    # 6. Fichiers : a-relire (essai), registre, journal
    if args.essai:
        par_paquet = {}
        for f in lot:
            par_paquet.setdefault(f["paquet"], []).append(f)
        for num, fs in sorted(par_paquet.items()):
            contenu = {
                "fichier": f"a-relire-{num}.json", "paquet": f"paquet-{num}.json",
                "date_reference": paquets[num]["date_reference"],
                "consigne": "08 Import evenements/Mesures/lecture/CONSIGNE-RELECTURE-SONNET.md",
                "fiches": [{
                    "id": f["id"], "site_id": f["site_id"], "association": sites[f["site_id"]]["association"],
                    "page": f["page"], "titre": f["titre"],
                    "debut": f["debut_local"].isoformat(timespec="minutes") if f["heure"] else f["debut_local"].date().isoformat(),
                    "fin": (f["fin_local"].isoformat(timespec="minutes") if f["heure_fin"] else f["fin_local"].date().isoformat()) if f["fin_local"] else None,
                    "heure_ecrite": f["heure"], "lieu_nom": f["lieu_nom"], "lieu_adresse": f["lieu_adresse"],
                    "lieu_commune": f["lieu_commune"], "prix_texte": f["prix_texte"], "lien": f["lien"],
                    "type": f["type"], "confiance": f["confiance"], "extrait": f["extrait"],
                    "extrait_annee": f["extrait_annee"],
                } for f in fs],
            }
            (dossier / f"a-relire-{num}.json").write_text(json.dumps(contenu, ensure_ascii=False, indent=1),
                                                          encoding="utf-8")

    horodatage = datetime.now(timezone.utc).isoformat(timespec="seconds")
    mode = "essai" if args.essai else ("refus" if refus else "ecriture")
    if args.essai and refus:
        refus = "(essai) l'écriture serait refusée : " + refus
    chemin_reg = dossier / "registre.csv"
    nouveau = not chemin_reg.exists()
    with open(chemin_reg, "a", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, delimiter=";")
        if nouveau:
            w.writerow(["date", "mode", "paquet", "site_id", "association", "pages", "caracteres",
                        "fiches_modele", "rejets_modele", "candidates", "ecrites"] + MOTIFS)
        for sid, r in sorted(registre.items()):
            s = sites.get(sid, {})
            w.writerow([horodatage, mode, s.get("paquet", ""), sid, s.get("association", ""),
                        len(s.get("pages", [])), sum(p.get("caracteres", 0) for p in s.get("pages", [])),
                        r["fiches_modele"], r["rejets_modele"], r["candidates"],
                        r["ecrites"] if mode == "ecriture" else 0]
                       + [r["motifs"].get(m, 0) for m in MOTIFS])

    total_motifs = {}
    for r in registre.values():
        for m, n in r["motifs"].items():
            total_motifs[m] = total_motifs.get(m, 0) + n
    fiches_modele = sum(r["fiches_modele"] for r in registre.values())

    # 7. Écriture en base
    bilan_dd = {"liens": 0, "fiches_enrichies": 0, "champs": {}}
    if db:  # contrôle de schéma en lecture seule, essai compris
        for table, rows in lignes.items():
            inconnues = verifier_colonnes(db, table, rows)
            if inconnues:
                raise SystemExit(f"Colonnes inconnues dans {table} : {inconnues}")
    if db and not args.essai and not refus:
        db.inserer("organizations", lignes["organizations"], "id")
        db.inserer("public_sites", lignes["public_sites"], "organization_id")
        db.inserer("establishments", lignes["establishments"], "id")
        db.inserer("evenements", lignes["evenements"], "id")
        db.inserer("evenements_import", lignes["evenements_import"], "event_id")
    if dedoublonneur:
        bilan_dd = dedoublonneur.ecrire(essai=bool(args.essai or refus), ids_ecrits=ids_ecrits)

    journal = {
        "date": horodatage, "mode": mode, "refus": refus, "dossier": str(dossier),
        "paquets": len(paquets), "resultats": len(resultats), "resultats_illisibles": illisibles,
        "fiches_modele": fiches_modele, "rejets_modele_par_motif": rejets_modele,
        "candidates_apres_garde_fous_et_doublons": len(lot), "relues": len(relues),
        "verdicts": compte_v, "taux_dates_fausses": round(taux_faux, 4),
        "ecrites": len(evenements) if mode == "ecriture" else 0, "a_ecrire": len(evenements),
        "sans_coordonnees": sans_coord, "ecartees_par_motif": total_motifs,
        "doublons_lies": liees, "dedoublonnage": bilan_dd, "regle_dedoublonnage": REGLE_DEDOUBLONNAGE,
        "retraits": bilan_retrait, "a_relire_retrait": sorted(a_relire_nom),
        "organisations_creees": len(lignes["organizations"]),
        "etablissements_crees": len(lignes["establishments"]),
        "types": {t: sum(1 for e in evenements if e["type"] == t) for t in sorted({e["type"] for e in evenements})},
        "cout": "tokens du forfait (D3), relevés par l'orchestrateur des sous-agents ; 0 € d'API",
        "duree_s": round(time.time() - t0, 1),
    }
    (dossier / f"journal-{horodatage[:16].replace(':', '')}.json").write_text(
        json.dumps(journal, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"Modèle   : {fiches_modele} fiches, {sum(rejets_modele.values())} rejets "
          + ", ".join(f"{m} {n}" for m, n in sorted(rejets_modele.items(), key=lambda x: -x[1])))
    print(f"Garde-fous et doublons : {len(lot)} candidates ; écartées : "
          + ", ".join(f"{m} {n}" for m, n in sorted(total_motifs.items(), key=lambda x: -x[1])))
    if verdicts:
        print(f"Relecture: {len(relues)} relues, {len(non_relues)} sans verdict, "
              + ", ".join(f"{v} {n}" for v, n in sorted(compte_v.items()))
              + f" ; dates fausses {taux_faux:.1%} (seuil {SEUIL_DATES_FAUSSES:.0%})")
    else:
        print("Relecture: aucune ; a-relire-NN.json écrits pour les sous-agents Sonnet" if args.essai
              else "Relecture: aucune")
    print(f"Lot      : {len(evenements)} fiches à écrire, {len(lignes['organizations'])} organisations, "
          f"{len(lignes['establishments'])} établissements, {sans_coord} sans coordonnées")
    if refus:
        print(f"REFUS    : {refus}. Rien n'est écrit.")
    print(f"Mode     : {mode} ; registre {chemin_reg.name}, journal écrit ; {journal['duree_s']} s")
    if refus and not args.essai:
        sys.exit(2)


if __name__ == "__main__":
    main()
