# -*- coding: utf-8 -*-
"""
Rapproche l'annuaire national des tiers-lieux (`annuaire_lieux`, 3 950 lieux,
recensement France Tiers-Lieux 2026) et le miroir Opendatasoft d'OpenAgenda,
pour produire la liste blanche attendue par `import-openagenda.py --lieux`.

Pourquoi ce script
------------------
OpenAgenda ne sait pas ce qu'est un tiers-lieu : une recherche par departement
ramene mediatheques, mairies et agences France Travail au meme titre que les
lieux qui nous interessent (voir ANALYSE-SOURCES-EVENEMENTS.md, section 4.A).
L'annuaire, lui, le sait : chaque ligne y est un tiers-lieu recense, avec ses
coordonnees. Ce script rapproche chaque lieu OpenAgenda ayant des evenements a
venir avec le tiers-lieu de l'annuaire le plus proche, sous conditions
strictes, et ne retient que ceux-la.

Comment on lit OpenAgenda sans telecharger 44 000 evenements
--------------------------------------------------------------
L'API explore v2.1 sait grouper (`group_by`) et compter sans renvoyer les
evenements eux-memes. Une contrainte technique s'y ajoute : un champ
`geo_point_2d` ne peut pas etre groupe directement (erreur ODSQLError,
« Aggregation on geo point field is not possible »), mais la fonction
`geo_cluster(champ, precision)` le peut. A la precision maximale (24), un
cluster ne contient jamais qu'un seul lieu reel : la centroide du cluster est
donc la coordonnee du lieu, sans perte utile. Mesure le 2026-09-28 : 11 008
lieux distincts publient un evenement a venir en France, obtenus en une
douzaine de requetes (pagination `limit`/`offset`, jusqu'a 1000 par page,
14 secondes), contre 44 024 evenements si on les avait tous telecharges.

Rapprochement
-------------
Un couple (lieu OpenAgenda, tiers-lieu de l'annuaire) est un CANDIDAT si :
  - la distance a vol d'oiseau entre les deux coordonnees est <= 150 m ;
  - ET le code postal est identique, OU la commune normalisee est identique
    (accents et casse retires : « Causse-de-la-Selle » = « Causse de la
    Selle »).
Parmi les candidats d'un meme lieu OpenAgenda, on retient le plus proche s'il
y en a un a moins de 30 m (la proximite suffit a elle seule) ; sinon celui
dont le score de nom est le plus eleve. Le nom compte les mots communs,
normalises et prives des mots vides (STOPWORDS ci-dessous, a ajuster) : deux
noms qui partagent la moitie de leurs mots significatifs valent 0,5.
  - RETENU  : distance <= 30 m, OU (distance <= 150 m ET score >= 0,5).
  - DOUTEUX : distance <= 150 m ET score < 0,5 (relecture humaine, jamais
    importe automatiquement).
Un lieu sans aucun candidat (rien a moins de 150 m avec un code postal ou une
commune qui concorde) n'apparait nulle part : ce n'est pas un tiers-lieu de
l'annuaire, ou l'annuaire ne le connait pas.

Recherche accelerees par grille
--------------------------------
3 950 lieux de l'annuaire x 11 008 lieux OpenAgenda feraient 43 millions de
paires en comparaison brute : trop lent en Python pur. On range l'annuaire
dans une grille de cellules de 0,01 degre (environ 1,1 km) et on ne compare un
lieu OpenAgenda qu'aux tiers-lieux de sa cellule et des huit voisines, une
marge trois fois superieure au rayon de 150 m recherche.

Sortie
------
`scripts/data/lieux-annuaire-openagenda.json` : format EXACT attendu par
`lire_lieux()` de `import-openagenda.py` (cle "lieux", chaque entree porte
"uid" et "canonique"), enrichi de champs d'explication qui ne genent pas cette
lecture (elle ignore les cles qu'elle ne connait pas). Quand plusieurs
identifiants OpenAgenda designent le meme tiers-lieu, un seul est « canonique »
(celui qui a le plus d'evenements a venir) : les autres y renvoient, pour ne
pas creer deux organisations pour un seul lieu.

`scripts/data/lieux-annuaire-openagenda-douteux.json` : les couples ecartes
faute de score de nom suffisant, pour relecture humaine. Jamais lus par
l'import.

La cle de service est lue dans .env.local et n'est jamais affichee.
"""

import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

RACINE = Path(__file__).resolve().parent.parent
DOSSIER_SORTIE = RACINE / "scripts" / "data"

API_OA = ("https://public.opendatasoft.com/api/explore/v2.1/catalog/"
          "datasets/evenements-publics-openagenda/records")

# Mots vides du score de nom : articles, generiques du secteur. A ajuster si
# la relecture des douteux montre qu'un mot manque ou qu'il en faut retirer un
# (par exemple si beaucoup de vrais tiers-lieux s'appellent juste « Espace »
# suivi d'un nom propre qui, lui, doit compter).
STOPWORDS = {"la", "le", "les", "de", "du", "des", "tiers", "lieu",
             "association", "asso", "espace", "maison"}

DISTANCE_MAX_M = 150
DISTANCE_SURE_M = 30
SCORE_MIN = 0.5
CELLULE_DEG = 0.01  # ~1,1 km : grande marge devant le rayon de 150 m recherche


# ── Environnement ───────────────────────────────────────────────────────────

def load_env():
    path = RACINE / ".env.local"
    if not path.exists():
        raise SystemExit(f"Fichier introuvable : {path}")
    env = dict(re.findall(r"^([A-Z_]+)=(.*)$", path.read_text(encoding="utf-8"), re.M))
    url = env.get("NEXT_PUBLIC_SUPABASE_URL", "").strip().rstrip("/")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise SystemExit("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente de .env.local.")
    return url, key


def lire_annuaire(url, key):
    """Lit les tiers-lieux non masques et geolocalises de `annuaire_lieux`."""
    auth = {"apikey": key, "Authorization": f"Bearer {key}"}
    champs = "id,nom,commune,code_postal,latitude,longitude,departement"
    chemin = (f"annuaire_lieux?select={champs}&masque=eq.false"
              "&latitude=not.is.null&longitude=not.is.null")
    rows, start = [], 0
    while True:
        req = urllib.request.Request(
            f"{url}/rest/v1/{chemin}", headers={**auth, "Range": f"{start}-{start + 999}"})
        with urllib.request.urlopen(req, timeout=120) as r:
            page = json.load(r)
        rows += page
        if len(page) < 1000:
            return rows
        start += 1000


# ── Lecture agregee d'OpenAgenda ────────────────────────────────────────────

def lire_lieux_openagenda():
    """
    Renvoie, pour chaque lieu OpenAgenda ayant au moins un evenement a venir,
    son nom, sa ville, son code postal, ses coordonnees et le nombre
    d'evenements a venir : une ligne par lieu, jamais une par evenement.
    """
    # geo_cluster() ne peut pas etre alias dans `select` (erreur ODSQLSyntaxError) :
    # sa cle en sortie est le texte de l'appel tel quel, GEO_CLE ci-dessous.
    GEO_CLE = "geo_cluster(location_coordinates,24)"
    select = ("location_uid,location_name,location_city,location_postalcode,count(*) as nb")
    group_by = ("location_uid,location_name,location_city,location_postalcode," + GEO_CLE)
    lieux, offset, limite = [], 0, 1000
    while True:
        q = {"where": "firstdate_begin >= now()", "select": select,
             "group_by": group_by, "limit": limite, "offset": offset}
        with urllib.request.urlopen(f"{API_OA}?{urllib.parse.urlencode(q)}", timeout=120) as r:
            page = json.load(r)["results"]
        for ligne in page:
            geo = (ligne.get(GEO_CLE) or {}).get("cluster_centroid") or {}
            lieux.append({
                "uid": ligne["location_uid"], "nom": ligne.get("location_name") or "",
                "ville": ligne.get("location_city") or "", "cp": ligne.get("location_postalcode") or "",
                "lat": geo.get("lat"), "lon": geo.get("lon"), "nb": ligne["nb"],
            })
        if len(page) < limite:
            return lieux
        offset += limite


# ── Normalisation et score ──────────────────────────────────────────────────

def sans_accents(t):
    return unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode()


def normalise_commune(c):
    return re.sub(r"[^a-z0-9]", "", sans_accents(c).lower())


def tokens_nom(nom):
    mots = re.findall(r"[a-z0-9]+", sans_accents(nom).lower())
    return {m for m in mots if len(m) > 1 and m not in STOPWORDS}


def score_nom(a, b):
    """Coefficient de Dice sur les mots significatifs communs : 1 si les deux
    ensembles de mots sont identiques, 0 s'ils n'ont rien en commun. Un nom
    vide des deux cotes (rare, lieu sans intitule exploitable) ne peut pas
    justifier un rapprochement par le nom : score 0, pas une exception."""
    ta, tb = tokens_nom(a), tokens_nom(b)
    if not ta or not tb:
        return 0.0
    return 2 * len(ta & tb) / (len(ta) + len(tb))


def haversine_m(lat1, lon1, lat2, lon2):
    r = 6371000.0
    p1, p2, dp, dl = radians(lat1), radians(lat2), radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * r * asin(sqrt(a))


def cellule(lat, lon):
    return (int(lat // CELLULE_DEG), int(lon // CELLULE_DEG))


# ── Rapprochement ───────────────────────────────────────────────────────────

def apparier(annuaire, oa_lieux):
    grille = {}
    for i, a in enumerate(annuaire):
        grille.setdefault(cellule(a["latitude"], a["longitude"]), []).append(i)

    retenus, douteux = {}, []
    for oa in oa_lieux:
        if oa["lat"] is None or oa["lon"] is None:
            continue
        cx, cy = cellule(oa["lat"], oa["lon"])
        idx = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                idx += grille.get((cx + dx, cy + dy), [])
        if not idx:
            continue

        candidats = []
        for i in idx:
            a = annuaire[i]
            d = haversine_m(oa["lat"], oa["lon"], a["latitude"], a["longitude"])
            if d > DISTANCE_MAX_M:
                continue
            meme_cp = oa["cp"].strip() and oa["cp"].strip() == (a["code_postal"] or "").strip()
            meme_commune = normalise_commune(oa["ville"]) and (
                normalise_commune(oa["ville"]) == normalise_commune(a["commune"]))
            if not (meme_cp or meme_commune):
                continue
            candidats.append({
                "annuaire_id": a["id"], "nom_annuaire": a["nom"], "commune_annuaire": a["commune"],
                "distance_m": round(d, 1), "score": round(score_nom(a["nom"], oa["nom"]), 3),
            })
        if not candidats:
            continue

        # La proximite tranche d'abord (un lieu a moins de 30 m se suffit a
        # lui-meme) ; a defaut, le nom le plus proche.
        surs = [c for c in candidats if c["distance_m"] <= DISTANCE_SURE_M]
        meilleur = min(surs, key=lambda c: c["distance_m"]) if surs else \
            max(candidats, key=lambda c: (c["score"], -c["distance_m"]))

        entree = {**meilleur, "uid": oa["uid"], "nom_openagenda": oa["nom"],
                  "ville_openagenda": oa["ville"], "cp_openagenda": oa["cp"], "evenements": oa["nb"]}
        if meilleur["distance_m"] <= DISTANCE_SURE_M or meilleur["score"] >= SCORE_MIN:
            retenus[oa["uid"]] = entree
        else:
            douteux.append(entree)
    return retenus, douteux


def grouper_canonique(retenus):
    """Un meme tiers-lieu de l'annuaire peut avoir plusieurs identifiants
    OpenAgenda (plusieurs profils pour le meme lieu physique). On ne garde
    qu'une organisation par tiers-lieu : le canonique est celui qui publie le
    plus d'evenements a venir, les autres y renvoient."""
    par_annuaire = {}
    for entree in retenus.values():
        par_annuaire.setdefault(entree["annuaire_id"], []).append(entree)

    lieux = []
    for groupe in par_annuaire.values():
        canonique = max(groupe, key=lambda e: e["evenements"])["uid"]
        for e in groupe:
            lieux.append({**e, "canonique": canonique})
    lieux.sort(key=lambda e: (e["annuaire_id"], e["uid"]))
    return lieux


def main():
    t0 = time.time()
    url, key = load_env()

    print("Lecture de l'annuaire (annuaire_lieux, non masques, geolocalises)...")
    annuaire = lire_annuaire(url, key)
    print(f"  {len(annuaire)} tiers-lieux")

    print("Lecture agregee d'OpenAgenda (lieux avec evenements a venir)...")
    oa_lieux = lire_lieux_openagenda()
    print(f"  {len(oa_lieux)} lieux distincts, {sum(l['nb'] for l in oa_lieux)} evenements a venir au total")

    print("Rapprochement (grille, distance haversine, code postal ou commune, score de nom)...")
    retenus, douteux = apparier(annuaire, oa_lieux)
    lieux = grouper_canonique(retenus)
    tiers_lieux_touches = len({l["annuaire_id"] for l in lieux})

    DOSSIER_SORTIE.mkdir(parents=True, exist_ok=True)

    sortie = {
        "_lecture": (
            "Liste blanche pour --lieux, etablie le 2026-09-28 par rapprochement "
            "automatique entre l'annuaire national des tiers-lieux (annuaire_lieux, "
            "recensement France Tiers-Lieux 2026, non masques et geolocalises) et les "
            "lieux OpenAgenda ayant un evenement a venir (miroir Opendatasoft, lu par "
            "agregation group_by + geo_cluster(precision 24), sans telecharger les "
            "evenements). Un couple est retenu si la distance haversine est <= 150 m "
            "ET (meme code postal OU meme commune normalisee sans accent), puis : "
            "distance <= 30 m (retenu d'office), ou score de nom >= 0,5 (mots "
            "significatifs communs, coefficient de Dice, mots vides dans STOPWORDS du "
            "script). Les couples <= 150 m avec un score de nom < 0,5 sont ecartes ici "
            "et lises dans lieux-annuaire-openagenda-douteux.json pour relecture. "
            "'canonique' regroupe les identifiants OpenAgenda d'un meme tiers-lieu "
            "(garde celui qui a le plus d'evenements a venir)."
        ),
        "criteres": {
            "distance_max_m": DISTANCE_MAX_M, "distance_sure_m": DISTANCE_SURE_M,
            "score_nom_min": SCORE_MIN, "stopwords": sorted(STOPWORDS),
        },
        "compte": {
            "annuaire_non_masques_geolocalises": len(annuaire),
            "lieux_openagenda_a_venir": len(oa_lieux),
            "uid_openagenda_retenus": len(lieux),
            "tiers_lieux_annuaire_touches": tiers_lieux_touches,
            "douteux": len(douteux),
        },
        "lieux": lieux,
    }
    (DOSSIER_SORTIE / "lieux-annuaire-openagenda.json").write_text(
        json.dumps(sortie, ensure_ascii=False, indent=1), encoding="utf-8")

    douteux_tries = sorted(douteux, key=lambda e: -e["score"])
    sortie_douteux = {
        "_lecture": (
            "Couples annuaire x OpenAgenda ecartes de la liste blanche : distance <= "
            "150 m et meme code postal ou meme commune, mais score de nom < 0,5. A "
            "relire a la main ; jamais lu par import-openagenda.py. Genere le "
            "2026-09-28 par rapprocher-annuaire-openagenda.py."
        ),
        "douteux": douteux_tries,
    }
    (DOSSIER_SORTIE / "lieux-annuaire-openagenda-douteux.json").write_text(
        json.dumps(sortie_douteux, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"\nRetenus  : {len(lieux)} identifiants OpenAgenda, {tiers_lieux_touches} tiers-lieux de l'annuaire touches")
    print(f"Douteux  : {len(douteux)} (dans lieux-annuaire-openagenda-douteux.json, non retenus)")
    print(f"Fichiers : {DOSSIER_SORTIE / 'lieux-annuaire-openagenda.json'}")
    print(f"           {DOSSIER_SORTIE / 'lieux-annuaire-openagenda-douteux.json'}")
    print(f"Temps    : {time.time() - t0:.1f} s")


if __name__ == "__main__":
    main()
