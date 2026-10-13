# -*- coding: utf-8 -*-
"""
Import des agendas participatifs de la Région Occitanie (Licence Ouverte 2.0)
dans la base Casa Minga.

Source : jeu « Agendas participatifs des sorties en Occitanie », data.laregion.fr
(Opendatasoft), export JSON. Licence Ouverte v2.0 (Etalab), lue dans le catalogue
de la Région. Attribution : « Région Occitanie, agendas participatifs ».

Gabarit : import-datatourisme.py (mêmes exclusions éditoriales, même dédoublonnage
croisé R7 par scripts/dedoublonnage.py, mêmes lots, mêmes retraits R12).
Particularités de la source : pas d'image, description tronquée par la Région
(« (...) » en fin de texte), une date de début et une de fin par fiche, un
point GPS, pas d'organisateur, pas d'heure (minuit = heure inconnue).

Respect de robots.txt (R11) : le robots.txt de data.laregion.fr interdit /api/
aux agents génériques (constaté le 2026-10-13). Le script refuse donc de
télécharger l'export tant que l'option --robots-ok n'est pas donnée, c'est-à-dire
tant que le directeur n'a pas tranché (accord de la Région ou décision écrite).
Il accepte aussi --fichier pour lire un export déjà obtenu légitimement.

Usage
-----
  python scripts/import-region-occitanie.py --fichier export.json --essai
  python scripts/import-region-occitanie.py --robots-ok --departement 34 --essai
  python scripts/import-region-occitanie.py --robots-ok --max 500

La clé de service est lue dans .env.local et n'est jamais affichée.
"""

import argparse
import csv
import difflib
import re
import shutil
import ssl
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import uuid
import json
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parent))

from import_commun import (  # noqa: E402
    Base, NS, adresse, compter_retrait, couper, lire_retraits, load_env, retrait_a_relire,
    retrait_concerne, slugify, texte, titre_normalise, typer_v2,
)
# Dedoublonnage croise (R7), partage avec import-openagenda.py, import-sites.py
# et mesure-import.py : voir scripts/dedoublonnage.py.
from dedoublonnage import REGLE as REGLE_DEDOUBLONNAGE, Dedoublonneur, jour_paris  # noqa: E402

SOURCE = "region-occitanie"
URL_EXPORT = ("https://data.laregion.fr/api/explore/v2.1/catalog/datasets/"
              "agendas-participatif-des-sorties-en-occitanie/exports/json")
ATTRIBUTION = "Région Occitanie, agendas participatifs, Licence Ouverte 2.0"
CACHE = Path(__file__).resolve().parent / "data" / "cache"
AGENT = "CasaMingaBot/1.0 (ecommunication@etik.com)"

# ════════════════════════════════════════════════════════════════════════════
# RÈGLES ÉDITORIALES : listes lisibles et modifiables
# ════════════════════════════════════════════════════════════════════════════
# Toutes les expressions s'appliquent à un texte sans accent, en minuscules
# (voir `sans_accent`) : on écrit « createur », pas « créateur ».

HORIZON_MOIS = 12          # rien au-delà
DATES_MAX = 6              # une fiche par date jusqu'à ce nombre, sinon la prochaine seule
DUREE_MAX_JOURS = 330      # une période plus longue est une offre permanente (marché de l'année, visite à l'année), pas un événement
DESCRIPTION_MIN = 40       # en dessous, la fiche est trop maigre pour être publiée
MARCHE_HEBDO_DATES = 6     # un marché avec autant de dates ou plus est un marché de semaine

# 1. Brocantes et vide-greniers
BROCANTE_CATEGORIES = {"GarageSale", "BricABrac"}
BROCANTE_TITRE = re.compile(
    r"\bbrocantes?\b|vide[- ]?greniers?|vide[- ]?dressing|vide[- ]?maison"
    r"|\bbourses? aux\b|\bpuces\b|\btroc\b")

# 2. Professionnel, salons, foires
PRO_CATEGORIES = {"Congress", "FairOrShow"}
PRO_TITRE = re.compile(
    r"\bsalons?\b|\bforums?\b|\bcongres\b|\bseminaires?\b|assemblee generale"
    r"|\brecrutement|job dating|france travail")
# Gardés malgré « salon » ou une catégorie de foire : salons et marchés
# d'artisans ou de créateurs, salons du livre, de la BD, de la poésie, et les
# « salons » qui sont des concerts ou des rencontres (cas vu à Sète).
PRO_EXCEPTIONS = re.compile(
    r"artisan|createurs?\b|creatrices?\b|metiers? d'art|\blivres?\b|\bbd\b"
    r"|bande dessinee|poesie|salon de musique|salon de the|salon litteraire"
    r"|salon de lecture")

# 3. Sport de compétition
SPORT_CATEGORIES = {"SportsCompetition", "Competition", "Rally"}
SPORT_DUR = re.compile(r"\brugby\b|\bfoot(ball)?\b|\bvolley(-?ball)?\b|\bbasket(-?ball)?\b"
                       r"|\bhand-?ball\b|\bwater-?polo\b|\btennis\b|\bbadminton\b"
                       r"|\btrails?\b|\b(semi-?)?marathons?\b|\btriathlon\b")
SPORT_TITRE = re.compile(
    r"\bmatchs?\b|\bchampionnats?\b|\btournois?\b|\bcompetitions?\b|\bcyclosportive\b"
    r"|\bgrand prix\b|\bregates?\b|\bcoupe de france\b|" + SPORT_DUR.pattern)
# Un tournoi de jeux (vidéo, société, échecs, cartes) ou un match d'improvisation
# n'est pas du sport. Ne joue pas si un sport dur est nommé.
SPORT_EXCEPTIONS = re.compile(
    r"\bjeux?\b|video|echecs|\bsocietes?\b|\bcartes?\b|belote|tarot|scrabble"
    r"|e-?sport|\bimpro|\bquiz\b|\bgaming\b|babyfoot|pokemon|mario|manga")

# 4. Marchés hebdomadaires : catégorie Market (ou titre « marché ») avec
# MARCHE_HEBDO_DATES dates ou plus dans l'horizon. Les marchés de Noël restent.
MARCHE_TITRE = re.compile(r"\bmarches?\b")
MARCHE_EXCEPTIONS = re.compile(r"\bnoel\b|\bartisan|createurs?\b|creatrices?\b|metiers? d'art")

# 5. Commerce et œnotourisme
COMMERCE_TITRE = re.compile(
    r"\bdegustations?\b|\bventes?\b|\bbraderies?\b|\bbourses?\b"
    r"|visite (?:de |du |d'une? )?(?:la |le |l')?(?:cave|domaine|chai)s?\b")
# Braderies et ventes solidaires : gardées (Emmaüs, Secours, Saint-Vincent de Paul).
COMMERCE_EXCEPTIONS = re.compile(
    r"solidaire|emmaus|secours|saint[- ]vincent|vincent de paul|caritative|charite")

# ── Types Casaminga ─────────────────────────────────────────────────────────
# Règles de titre, copie corrigée de TYPE_RULES (import_commun.py, qu'on ne
# modifie pas) : « formation » ne capte plus « information », « marche » (la
# randonnée) ne devient plus un marché, « week-end », « immersion » et
# « résidence » ne forcent un séjour que si la fiche dure deux jours ou plus,
# « conte » ne capte plus « contemporain », « fabrique » reste un atelier
# seulement comme verbe.
# La signification des autres types est celle du § 3 du sondage.
REGLES_TITRE = [
    ("retraite", re.compile(r"\bretraites?\b(?! aux flambeaux)|ressourcement")),
    ("sejour", re.compile(r"\bsejours?\b")),                         # fort : durée libre
    ("sejour_faible", re.compile(r"immersion|residence|week-?end")),  # exige deux jours ou plus
    ("formation", re.compile(r"\bformations?\b|cursus|certifiant|diplomant|mooc")),
    ("stage", re.compile(r"\bstages?\b")),
    ("atelier", re.compile(r"\bateliers?\b|\binitiation|\bfabriqu(?:e|ez|er|ons)\b")),
    ("exposition", re.compile(r"exposition|\bexpos?\b|vernissage")),
    ("concert", re.compile(r"concert|musique|\blive\b|dj set|festival")),
    ("spectacle", re.compile(
        r"spectacle|theatre|danse|cinema|projection|\bfilms?\b|\bcontes?\b|conteu"
        r"|cirque|marionnette|humour|clown|comedy|stand-?up|one[- ]?(?:wo)?man")),
    ("rencontre", re.compile(
        r"rencontre|conference|debat|table ronde|\bcafes?\b|lecture|visite|dedicace|causerie")),
]
# « marché » (avec accent) est toujours un marché ; « marche » sans accent n'en
# est un que suivi d'un de ces compléments (« Marche sinistre » est une marche).
REGLES_SPECTACLE = dict(REGLES_TITRE)["spectacle"]
MARCHE_ACCENT = re.compile(r"\bmarchés?\b")
MARCHE_SANS_ACCENT = re.compile(
    r"\bmarches? (?:de noel|paysan|nocturne|artisanal|de producteurs|de createurs"
    r"|de potiers|gourmand|bio|fermier|de plein vent)")
MARCHE_AUTRE = re.compile(r"\bbraderies?\b|vente solidaire")
FESTIVAL_NON_MUSICAL = {"TheaterEvent", "ShowEvent", "ScreeningEvent", "DanceEvent", "CircusEvent"}
PRATIQUE = re.compile(r"\bcours\b|yoga|pilates|qi ?gong|sophrologie|initiation|atelier")

CATEGORIE_TYPE = [  # (catégories, type), dans l'ordre de priorité, après les règles de titre
    ({"Exhibition", "ExhibitionEvent", "VisualArtsEvent"}, "exposition"),
    ({"Concert", "MusicEvent"}, "concert"),
    ({"TheaterEvent", "ShowEvent", "ScreeningEvent", "DanceEvent", "CircusEvent"}, "spectacle"),
    ({"Conference", "Reading", "Visit", "OpenDay"}, "rencontre"),
    ({"Market"}, "marche"),
]

# ── Casse de phrase des titres ──────────────────────────────────────────────
# Sigles gardés en majuscules (en plus de la règle « 2 à 5 lettres sans voyelle »
# et des sigles repérés dans la description de la fiche).
SIGLES = {
    "ADT", "ADN", "PETR", "LGBT", "LGBTQ", "LGBTQIA", "SNCF", "TER", "TGV", "BD", "CD", "DVD",
    "DJ", "VJ", "MJC", "FRAC", "CCAS", "CPIE", "CAUE", "CNRS", "INRAE", "UNESCO", "ONU", "UE",
    "TV", "FM", "IA", "VR", "PMA", "AMAP", "ESS", "ESAT", "ULM", "VTT", "GR", "GRP", "ONG",
    "CAF", "MSA", "PMI", "CCI", "CMA", "IUT", "BTS", "CAP", "SOS", "COP", "NRJ", "TMS", "ONMO",
    "MOCO", "USA", "UK", "OT", "AG", "RN", "ZAC", "ZAE", "EHPAD", "MAM", "ALSH", "CLSH",
    "FOL", "FJT", "CRIJ", "LPO", "MIAM", "FC", "AS", "US", "ASPTT", "OM", "PSG",
}
# Mots 2 à 5 lettres sans voyelle qui ne sont PAS des sigles.
PAS_SIGLES = {"st": "St", "ste": "Ste", "mme": "Mme", "mm": "mm", "dr": "Dr", "pr": "Pr",
              "mr": "Mr", "chut": "chut", "psst": "psst", "brr": "brr", "pst": "pst"}
ROMAINS = {"II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII", "XIII", "XIV", "XV",
           "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"}
# Noms propres et expressions à garder avec leur casse (villes et lieux de
# l'Hérault et d'Occitanie, fêtes, pays). Les communes et le lieu de la fiche
# s'ajoutent automatiquement.
NOMS_PROPRES = [
    "Montpellier", "Béziers", "Sète", "Lodève", "Agde", "Pézenas", "Lunel", "Clermont-l'Hérault",
    "Hérault", "Occitanie", "Languedoc", "Cévennes", "Larzac", "Pic Saint-Loup", "Saint-Guilhem",
    "Saint-Guilhem-le-Désert", "Minervois", "Caroux", "Thau", "Bédarieux", "Gignac", "Ganges",
    "Frontignan", "Mèze", "Marseillan", "Cap d'Agde", "La Grande-Motte", "Palavas-les-Flots",
    "Carnon", "Grau-du-Roi", "Aniane", "Aumelas", "Hautes Terres d'Oc", "Haut-Languedoc",
    "Grand Orb", "Grand Pic Saint-Loup", "Pays d'Oc", "Méditerranée", "Camargue", "France",
    "Europe", "Paris", "Toulouse", "Nîmes", "Perpignan", "Narbonne", "Carcassonne", "Noël",
    "Halloween", "Pâques", "Toussaint", "Octobre rose", "Mars bleu", "Dieu", "Jésus",
    "Journées européennes du patrimoine", "Fête de la musique",
]

# ── Liens ───────────────────────────────────────────────────────────────────
HELLOASSO = re.compile(r"helloasso\.", re.I)
# Billetteries tierces : gardées comme lien d'inscription (décision 7).
BILLETTERIE = re.compile(
    r"billetterie|billetweb|weezevent|shotgun|yurplan|eventbrite|digitick|francebillet"
    r"|ticketmaster|seetickets|infoconcert|festik|mapado|vivaticket|ticketac|reservation"
    r"|/boutique|boutique\.|legilog|fnac\.com|billet\.|tickets?\.|resa\.|reserver", re.I)
PARAM_SUIVI = re.compile(r"^(utm_|fbclid|igshid|gclid|mc_|lt_utm|_hs)", re.I)
URL_RE = re.compile(r"https?://[^\s|<>]+")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")

# Lieu : début d'une adresse de voie (le nom du lieu est ce qui la précède).
VOIE = re.compile(
    r"(?:^|\s|,)(?:\d+\s*(?:bis|ter|b)?(?=[\s,])|(?:rue|avenue|av\.?|boulevard|bd|chemin|route"
    r"|place|impasse|allee|quai|cours|rond-point|esplanade|lieu-?dit|hameau|zae|zac|parking"
    r"|promenade|passage|square|rd|chemin)\b)", re.I)

# Rattachement au tiers-lieu de l'annuaire.
ANNUAIRE_SUR_M = 60
ANNUAIRE_NOM_M = 150
MOTS_VIDES = {"le", "la", "les", "de", "du", "des", "et", "en", "au", "aux", "un", "une", "l",
              "d", "tiers", "lieu", "lieux", "espace", "association", "centre", "cafe",
              "collectif", "maison", "rue", "avenue", "place", "chemin", "route"}
SIMILARITE_TITRE = 0.85


# ════════════════════════════════════════════════════════════════════════════
# Outils
# ════════════════════════════════════════════════════════════════════════════

def sans_accent(t):
    s = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode()
    return s.lower().replace("’", "'")


def haversine_m(lat1, lon1, lat2, lon2):
    p1, p2 = radians(lat1), radians(lat2)
    a = sin((p2 - p1) / 2) ** 2 + cos(p1) * cos(p2) * sin(radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371000.0 * asin(sqrt(a))


def _dernier_dimanche(an, mois):
    d = date(an, mois, 31)
    return d - timedelta(days=(d.weekday() + 1) % 7)


def _heure_ete_utc(dt_utc):
    """Heure d'été française : du dernier dimanche de mars 01 h UTC au dernier
    dimanche d'octobre 01 h UTC."""
    an = dt_utc.year
    debut = datetime(an, 3, _dernier_dimanche(an, 3).day, 1, tzinfo=timezone.utc)
    fin = datetime(an, 10, _dernier_dimanche(an, 10).day, 1, tzinfo=timezone.utc)
    return debut <= dt_utc < fin


def paris_vers_utc(local_naif):
    """Heure locale de Paris (naïve) -> datetime UTC. Sans dépendance (zoneinfo
    exige le paquet tzdata sous Windows)."""
    for decalage in (2, 1):
        cand = (local_naif - timedelta(hours=decalage)).replace(tzinfo=timezone.utc)
        if _heure_ete_utc(cand) == (decalage == 2):
            return cand
    return (local_naif - timedelta(hours=1)).replace(tzinfo=timezone.utc)


def utc_vers_jour_paris(iso):
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc)
    return (dt + timedelta(hours=2 if _heure_ete_utc(dt) else 1)).date()


def ajouter_mois(d, n):
    m = d.month - 1 + n
    an, mois = d.year + m // 12, m % 12 + 1
    jour = d.day
    while True:
        try:
            return date(an, mois, jour)
        except ValueError:
            jour -= 1


def dept_de_cp(cp):
    cp = (cp or "").strip()
    if len(cp) != 5 or not cp.isdigit():
        return None
    if cp.startswith("20"):
        return "2A" if int(cp) < 20200 else "2B"
    if cp[:2] in ("97", "98"):
        return cp[:3]
    return cp[:2]


# ── Lecture de l'export JSON ────────────────────────────────────────────────

def charger_export(fichier, robots_ok):
    """Liste de dicts. Sans --fichier, le téléchargement exige --robots-ok (R11)."""
    if fichier:
        return json.loads(Path(fichier).read_text(encoding="utf-8"))
    if not robots_ok:
        raise SystemExit("robots.txt de data.laregion.fr interdit /api/ aux agents génériques : "
                         "téléchargement refusé. Donner --robots-ok après décision du directeur, "
                         "ou --fichier pour un export déjà obtenu.")
    CACHE.mkdir(parents=True, exist_ok=True)
    dest = CACHE / f"region-occitanie-{date.today().isoformat()}.json"
    if not dest.exists():
        req = urllib.request.Request(URL_EXPORT, headers={"User-Agent": AGENT})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                dest.write_bytes(r.read())
        except (ssl.SSLError, urllib.error.URLError):
            res = subprocess.run(["curl", "-sSfL", "-A", AGENT, "--max-time", "300",
                                  "-o", str(dest), URL_EXPORT], capture_output=True)
            if res.returncode != 0:
                raise SystemExit(f"Échec du téléchargement : curl code {res.returncode}")
        time.sleep(1)  # R11 : une requête par seconde
    print(f"Source   : {dest.name} ({dest.stat().st_size / 1e6:.1f} Mo)")
    return json.loads(dest.read_text(encoding="utf-8"))


def lire_periode(row, aujourdhui, fin_horizon, stats):
    """(début, fin) de la fiche si elle est à venir dans l'horizon, sinon None."""
    try:
        d = date.fromisoformat((row.get("date_debut") or "")[:10])
        f = date.fromisoformat((row.get("date_fin") or row.get("date_debut") or "")[:10])
    except ValueError:
        stats["sans_date"] += 1
        return None
    if f < d:
        d, f = f, d
    if f < aujourdhui or d > fin_horizon:
        return None
    if (f - d).days > DUREE_MAX_JOURS:
        stats["periodes_trop_longues"] += 1
        return None
    return d, f


TRONQUE = re.compile(r"\s*\(\.\.\.\)\s*$|\s*\(…\)\s*$")


def dept_insee(code):
    code = (code or "").strip()
    if code.startswith("2A") or code.startswith("2B"):
        return code[:2]
    return code[:2] if len(code) == 5 else None


def decouper_adresse(row):
    """-> (adresse de voie, code postal, commune). L'adresse source est du type
    « 1 place Dupuy, La Halle aux Grains, 31000 Toulouse - Haute-Garonne »."""
    brut = (row.get("adresse") or "").strip()
    brut = re.sub(r"\s+-\s+[^-,]+$", "", brut)  # suffixe « - Département »
    m = re.search(r"\b(\d{5})\s+([^,]+)$", brut)
    cp = m.group(1) if m else ""
    commune = (row.get("commune") or (m.group(2).strip() if m else "") or "").strip()
    voie = brut[:m.start()].strip(" ,") if m else brut
    return voie, cp, commune


# ── Titre : casse de phrase ─────────────────────────────────────────────────

def _mots_description(desc):
    """Mots écrits avec une majuscule au milieu d'une phrase dans la description
    (noms propres, sigles) : clé en minuscules, valeur telle qu'écrite. Une
    description en majuscules ne dit rien, on l'ignore."""
    lettres = [c for c in desc if c.isalpha()]
    if not lettres or sum(c.isupper() for c in lettres) / len(lettres) > 0.5:
        return {}
    out = {}
    for m in re.finditer(r"[^\W\d_][\w]*", desc):
        mot = m.group(0)
        if len(mot) < 3 or not mot[0].isupper():
            continue
        avant = desc[:m.start()].rstrip(" \t ")
        if not avant or avant[-1] in ".!?:;\n«\"'•’(-":
            continue
        out.setdefault(mot.lower(), mot)
    return out


def casse_phrase(titre, communes, lieu, desc):
    """Titre en MAJUSCULES -> casse de phrase, en gardant sigles et noms propres.
    Un titre déjà en casse mixte n'est pas touché."""
    lettres = [c for c in titre if c.isalpha()]
    if not lettres or sum(c.isupper() for c in lettres) / len(lettres) < 0.7:
        return titre
    dyn = _mots_description(desc or "")
    morceaux = re.split(r"([\w]+)", titre.lower())
    orig = re.split(r"([\w]+)", titre)
    for i in range(1, len(morceaux), 2):
        mot, o = morceaux[i], orig[i]
        maj = o.upper()
        if re.fullmatch(r"\d+(er|e|eme|ème|ère)", mot):
            continue
        if any(c.isdigit() for c in mot):
            morceaux[i] = o
        elif maj in SIGLES or maj in ROMAINS:
            morceaux[i] = maj
        elif re.fullmatch(r"(ii|iii|iv|vi|vii|viii|ix|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx|xxi)"
                          r"(e|ème|eme|er)", mot):
            suf = re.search(r"(e|ème|eme|er)$", mot)
            morceaux[i] = mot[:suf.start()].upper() + suf.group(0)
        elif mot in PAS_SIGLES:
            morceaux[i] = PAS_SIGLES[mot]
        elif 2 <= len(mot) <= 5 and mot.isalpha() and not re.search(r"[aeiouyàâéèêëîïôùûü]", mot):
            morceaux[i] = maj
        elif mot in dyn:
            morceaux[i] = dyn[mot]
    t = "".join(morceaux)
    expressions = list(communes) + ([lieu] if lieu else []) + NOMS_PROPRES
    for nom in sorted(set(expressions), key=len, reverse=True):
        if len(nom) < 3 or nom != nom.strip():
            continue
        t = re.sub(r"(?<![\w])" + re.escape(nom) + r"(?![\w])", nom.replace("\\", "\\\\"), t,
                   flags=re.I)

    def cap(m):
        return m.group(1) + m.group(2).upper()
    t = re.sub(r"^(\W*)(\w)", cap, t)
    # Majuscule après une fin de phrase, après un guillemet OUVRANT (pas
    # fermant) et après un tiret entouré d'espaces, qui sépare ici deux
    # segments de titre.
    t = re.sub(r"([.!?…]\s+|\s-\s|(?:^|[\s(])[«“\"]\s*)([^\W\d_])", cap, t)
    return t


def nettoyer_titre(titre):
    """Pipes de séparation -> deux-points puis virgules (« A | B | C » devient
    « A : B, C »), espaces réduits. Les tirets longs partent dans texte()."""
    t = re.sub(r"\s*\|\s*", "\u0001", titre.strip(), count=0)
    parts = [p for p in t.split("\u0001") if p.strip()]
    if len(parts) > 1:
        t = parts[0].strip() + " : " + ", ".join(p.strip() for p in parts[1:])
    return re.sub(r"\s+", " ", t.replace("\u0001", " ")).strip()


# ── Lieu ────────────────────────────────────────────────────────────────────

def nom_du_lieu(adr):
    """Nom de lieu en tête d'adresse (« Salle polyvalente 37 avenue du Nouveau
    Monde » -> « Salle polyvalente »). Vide si l'adresse commence par une voie."""
    adr = (adr or "").strip()
    if not adr:
        return ""
    m = VOIE.search(adr)
    tete = adr[:m.start()] if m else adr
    tete = re.sub(r"[\s,;:\-]+$", "", tete)
    tete = re.sub(r"\s+(de|du|la|le|l'|des|au|aux|en|face)$", "", tete, flags=re.I)
    return tete if len(tete) >= 3 and re.search(r"[^\W\d_]{3}", tete) else ""


def sans_postal(adr, cp, commune):
    """Retire un code postal et une commune recopiés en fin d'adresse."""
    a = re.sub(r"[,\s]*\b\d{5}\b.*$", "", adr or "").strip(" ,")
    return a


# ── Liens ───────────────────────────────────────────────────────────────────

def nettoyer_url(u):
    u = u.rstrip(".,;)")
    p = urllib.parse.urlsplit(u)
    query = [(k, v) for k, v in urllib.parse.parse_qsl(p.query, keep_blank_values=True)
             if not PARAM_SUIVI.match(k)]
    frag = p.fragment
    if not frag or frag.isdigit() or frag.startswith("/"):
        frag = ""
    return urllib.parse.urlunsplit((p.scheme, p.netloc, p.path, urllib.parse.urlencode(query), frag))


def analyser_liens(contacts):
    """-> (billetteries, infos, courriels, helloasso_retire). HelloAsso n'est
    repris nulle part (règle : jamais de renvoi vers HelloAsso)."""
    ha_retire, billets, infos = False, [], []
    for brut in URL_RE.findall(contacts or ""):
        url = nettoyer_url(brut)
        if not url or len(url) > 500:
            continue
        if HELLOASSO.search(url):
            ha_retire = True
            continue
        cible = billets if BILLETTERIE.search(url) else infos
        if url not in billets and url not in infos:
            cible.append(url)
    courriels = []
    for m in EMAIL_RE.findall(URL_RE.sub(" ", contacts or "")):
        if m.lower() not in courriels:
            courriels.append(m.lower())
    return billets, infos, courriels, ha_retire


# ════════════════════════════════════════════════════════════════════════════
# Étape A : lecture et périmètre
# ════════════════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════════════════
# Étape B : exclusions et typage
# ════════════════════════════════════════════════════════════════════════════

def motif_exclusion(titre_n, cats, nb_dates, duree_max):
    """Premier motif d'exclusion de la section 8, ou None. Les exceptions de Léo
    (2026-10-08) sont dans les listes en tête de script."""
    if cats & BROCANTE_CATEGORIES or BROCANTE_TITRE.search(titre_n):
        return "brocante, vide-grenier"
    if (cats & PRO_CATEGORIES or PRO_TITRE.search(titre_n)) and not PRO_EXCEPTIONS.search(titre_n):
        return "professionnel, salon, foire"
    if (cats & SPORT_CATEGORIES or SPORT_TITRE.search(titre_n)) \
            and (SPORT_DUR.search(titre_n) or not SPORT_EXCEPTIONS.search(titre_n)):
        return "sport de compétition"
    if ("Market" in cats or MARCHE_TITRE.search(titre_n)) and nb_dates >= MARCHE_HEBDO_DATES \
            and not MARCHE_EXCEPTIONS.search(titre_n):
        return "marché hebdomadaire"
    if COMMERCE_TITRE.search(titre_n) and not COMMERCE_EXCEPTIONS.search(titre_n):
        return "commerce, œnotourisme"
    return None


def typer(titre, desc, debut, fin):
    """Type Casaminga d'une date : typer_v2 (import_commun), sinon « autre »."""
    code, _ = typer_v2(titre, desc, debut.isoformat(), fin.isoformat())
    return code or "autre"


# ════════════════════════════════════════════════════════════════════════════
# Étape D : dédoublonnage et annuaire
# ════════════════════════════════════════════════════════════════════════════

RE_COMMUNE = re.compile(r"\b\d{5}\s+([^,]+)")


def commune_de(etab_city, adresse_org):
    if etab_city:
        return slugify(etab_city, 80)
    m = RE_COMMUNE.search(adresse_org or "")
    return slugify(m.group(1), 80) if m else None


def tokens_nom(t):
    return {m for m in re.findall(r"[a-z0-9]+", sans_accent(t)) if len(m) > 2 and m not in MOTS_VIDES}


class Annuaire:
    """Tiers-lieux de `annuaire_lieux` (non masqués, géolocalisés), en grille."""
    CELLULE = 0.005  # environ 550 m

    def __init__(self, lignes):
        self.grille = {}
        for l in lignes:
            if l.get("latitude") is None or l.get("longitude") is None:
                continue
            self.grille.setdefault(self._c(l["latitude"], l["longitude"]), []).append(l)

    def _c(self, lat, lon):
        return (int(lat // self.CELLULE), int(lon // self.CELLULE))

    def proche(self, lat, lon, texte_fiche):
        """(ligne, distance, motif) du tiers-lieu retenu, ou None : 60 m, ou
        150 m avec un nom proche (le nom du tiers-lieu retrouvé dans l'adresse ou le titre)."""
        if lat is None:
            return None
        cx, cy = self._c(lat, lon)
        cands = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for l in self.grille.get((cx + dx, cy + dy), []):
                    d = haversine_m(lat, lon, l["latitude"], l["longitude"])
                    if d <= ANNUAIRE_NOM_M:
                        cands.append((d, l))
        cands.sort(key=lambda x: (x[0], x[1]["id"]))
        tok_fiche = tokens_nom(texte_fiche)
        for d, l in cands:
            tok = tokens_nom(l["nom"])
            nom_proche = bool(tok) and len(tok & tok_fiche) / len(tok) >= 0.5
            if d <= ANNUAIRE_SUR_M:
                return l, d, "60 m" + (" + nom" if nom_proche else "")
            if nom_proche:
                return l, d, "150 m + nom"
        return None


# ════════════════════════════════════════════════════════════════════════════
# Programme principal
# ════════════════════════════════════════════════════════════════════════════

def verifier_colonnes(db, table, rows):
    """Les clés des lignes construites existent-elles dans la table ? Lecture
    seule : une ligne d'exemple de la table donne la liste des colonnes."""
    if not rows:
        return []
    echantillon = db._call("GET", f"{table}?limit=1")
    if not echantillon:
        return []
    inconnues = set().union(*(r.keys() for r in rows)) - set(echantillon[0].keys())
    return sorted(inconnues)


def main():
    ap = argparse.ArgumentParser(description="Import Région Occitanie (agendas participatifs) -> Casa Minga")
    ap.add_argument("--departement", help="code(s) de département, ex. 34 ou 34,30")
    ap.add_argument("--rayon", type=float, help="rayon en km autour de --centre")
    ap.add_argument("--centre", help="latitude,longitude du centre du rayon")
    ap.add_argument("--horizon-mois", type=int, default=HORIZON_MOIS, dest="horizon")
    ap.add_argument("--dates-max", type=int, default=DATES_MAX, dest="dates_max",
                    help="au-delà de ce nombre de dates, seule la prochaine est gardée")
    ap.add_argument("--max", type=int, default=50, help="dates nouvelles à importer (0 = toutes)")
    ap.add_argument("--essai", action="store_true", help="n'écrit rien")
    ap.add_argument("--exemples", type=int, default=10, help="nombre d'exemples à afficher")
    ap.add_argument("--fichier", help="export JSON déjà obtenu (sinon téléchargement, voir --robots-ok)")
    ap.add_argument("--robots-ok", action="store_true", dest="robots_ok",
                    help="autorise le téléchargement malgré le robots.txt de la Région (décision du directeur)")
    ap.add_argument("--montrer-lignes", action="store_true", dest="montrer",
                    help="affiche une ligne construite par table (relecture du chemin d'écriture)")
    args = ap.parse_args()
    depts = {d.strip().upper() for d in (args.departement or "").split(",") if d.strip()}
    rayon = None
    if args.rayon or args.centre:
        if not (args.rayon and args.centre):
            ap.error("--rayon et --centre vont ensemble")
        lat, lon = (float(x) for x in args.centre.split(","))
        rayon = (lat, lon, args.rayon)
    # Sans filtre : toute l'Occitanie.

    t0 = time.time()
    aujourdhui = datetime.now().date()
    fin_horizon = ajouter_mois(aujourdhui, args.horizon)
    stats, motifs = Counter(), Counter()

    # ── A. Lecture ──
    export = charger_export(args.fichier, args.robots_ok)
    fiches = []
    for row in export:
        stats["lues"] += 1
        voie, cp, commune = decouper_adresse(row)
        dep = dept_insee(row.get("code_insee")) or dept_de_cp(cp)
        if depts and dep not in depts:
            continue
        geo = row.get("geo_point_2d") or {}
        lat, lon = geo.get("lat"), geo.get("lon")
        if rayon and (lat is None or haversine_m(lat, lon, rayon[0], rayon[1]) > rayon[2] * 1000):
            continue
        stats["perimetre"] += 1
        titre_brut = (row.get("titre") or "").strip()
        periode = lire_periode(row, aujourdhui, fin_horizon, stats)
        if not periode:
            motifs["aucune date dans l'horizon (passée, au-delà)"] += 1
            continue
        periodes = [periode]
        stats["avenir"] += 1
        if "entreprises" in sans_accent(row.get("thematique")):
            motifs["économie, vie des entreprises (professionnel)"] += 1
            continue
        titre_n = sans_accent(titre_brut)
        motif = motif_exclusion(titre_n, set(), 1, (periode[1] - periode[0]).days)
        if motif:
            motifs[motif] += 1
            continue
        stats["apres_5_filtres"] += 1
        desc = texte(TRONQUE.sub("", (row.get("description") or "").replace("&nbsp;", " ")))
        if desc:
            desc = re.sub(r"https?://\S*helloasso\S*", "", desc, flags=re.I).strip()
            desc = couper(desc)
        if not desc or len(desc) < DESCRIPTION_MIN:
            motifs[f"description absente ou de moins de {DESCRIPTION_MIN} caractères"] += 1
            continue
        if re.search(r"helloasso", desc, re.I):
            stats["description_cite_helloasso"] += 1
        url_fiche = (row.get("url") or "").strip()
        if HELLOASSO.search(url_fiche):
            url_fiche = ""
        if not url_fiche:
            motifs["sans adresse de fiche (identifiant stable impossible)"] += 1
            continue
        communes = [commune] if commune else []
        if not communes:
            motifs["sans commune"] += 1
            continue
        adr = voie
        lieu = nom_du_lieu(adr)
        titre = nettoyer_titre(titre_brut)
        titre = casse_phrase(titre, communes, lieu if lieu and lieu != lieu.upper() else "", desc)
        titre = (texte(titre) or "Événement")[:200]
        fiches.append({
            "uri": url_fiche, "titre": titre, "cats": desc, "desc": desc,
            "communes": communes, "commune": communes[0], "cp": cp, "adr": adr,
            "lat": lat, "lon": lon, "periodes": periodes,
            "billets": [], "infos": [url_fiche], "courriels": [], "ha_retire": False,
            "attribution": ATTRIBUTION, "maj": None,
        })
    stats["retenues_avant_base"] = len(fiches)

    # ── Base (lecture seule) ──
    url, key = load_env()
    db = Base(url, key)
    retraits = lire_retraits(db)
    bilan_retrait = {}
    org_rows = db.lire_tout("organizations?select=id,slug,address")
    orgs_existantes = {o["id"] for o in org_rows}
    adresse_org = {o["id"]: o["address"] for o in org_rows}
    slugs_pris = {o["slug"] for o in org_rows}
    sites_existants = {s["organization_id"] for s in db.lire_tout("public_sites?select=organization_id")}
    etab_rows = db.lire_tout("establishments?select=id,organization_id,city,is_primary,latitude,longitude")
    etab_ids = {e["id"] for e in etab_rows}
    etab_de_org, ville_etab = {}, {}
    for e in etab_rows:
        ville_etab[e["id"]] = e["city"]
        if e["organization_id"] not in etab_de_org or e["is_primary"]:
            etab_de_org[e["organization_id"]] = e["id"]
    orgs_avec_etab = set(etab_de_org)
    source_de = {i["event_id"]: i["source"] for i in db.lire_tout("evenements_import?select=event_id,source")}
    deja = set(source_de)
    annuaire = Annuaire(db.lire_tout(
        "annuaire_lieux?select=id,nom,adresse,commune,code_postal,latitude,longitude,site_web,organization_id"
        "&masque=eq.false&latitude=not.is.null&order=id"))

    # ── D. Dédoublonnage, par date ──
    # Module partage (R7, P3) : compare a toute la base, toutes sources, jour
    # heure de Paris, puis aux dates deja acceptees dans ce passage. Une date en
    # doublon n'est pas importee : elle est liee a la fiche gardee et lui sert
    # a l'enrichir (heure, photo, description, inscription, prix).
    dedoublonneur = Dedoublonneur(db)
    fiches.sort(key=lambda f: (f["periodes"][0][0], f["uri"]))
    occurrences = []  # une par date retenue
    doublons, memes_titres_autre_commune = Counter(), 0
    deja_en_base, deja_liees = 0, 0
    for f in fiches:
        titre_n = titre_normalise(f["titre"])
        garde = 0
        for debut, fin in f["periodes"]:
            eid = str(uuid.uuid5(NS, f"evt:{SOURCE}:{f['uri']}:{debut.isoformat()}"))
            if eid in deja:
                deja_en_base += 1
                continue
            debut_utc = paris_vers_utc(datetime.combine(max(debut, aujourdhui), datetime.min.time()))
            fin_utc = paris_vers_utc(datetime.combine(fin, datetime.min.time()) + timedelta(hours=23, minutes=59))
            fiche_dd = {
                "titre": f["titre"], "debut": debut_utc.isoformat(), "fin": fin_utc.isoformat(),
                "commune": f["commune"], "lat": f["lat"], "lng": f["lon"],
                "organization_id": None, "source": SOURCE, "source_uid": f["uri"],
                "photos": [], "description": f["desc"], "price": None,
                "registration": [{"type": "link", "value": u} for u in f["billets"]],
            }
            if dedoublonneur.deja_lie(SOURCE, f["uri"], fiche_dd["debut"]):
                deja_liees += 1
                continue
            res = dedoublonneur.chercher(fiche_dd)
            if res:
                source_url = (f["infos"] or f["billets"] or [None])[0]
                dedoublonneur.lier(res, fiche_dd, SOURCE, f["uri"], source_url)
                doublons[f"{res.raison} / {res.gardee.groupe_source}"] += 1
                continue
            if any(e.tn == titre_normalise(f["titre"]) for e in dedoublonneur.index.get(jour_paris(debut_utc), [])):
                memes_titres_autre_commune += 1
            dedoublonneur.enregistrer(fiche_dd, eid)
            occurrences.append((f, debut, fin, eid))
            garde += 1
        stats["fiches_retenues"] += 1 if garde else 0
    occurrences.sort(key=lambda o: (o[1], o[0]["uri"]))

    # ── Lieux : annuaire, sinon adresse ──
    nouveaux_orgs = {}      # oid -> dict de création (organisation, établissement, vitrine)
    lieu_de_fiche = {}      # uri -> (oid, eid)
    rattachements = {}      # annuaire_id -> oid
    modes = Counter()
    tiers_lieux_touches = set()
    # Retraits : verdict par fiche (uri), selon son lieu. « refuser » : aucune
    # organisation, vitrine, établissement ni rattachement annuaire, et les
    # dates sortent de `occurrences` avant --max.
    verdict_fiche, a_relire = {}, set()

    def verdict_lieu(oid, nom, commune, site, annuaire_id):
        if retrait_a_relire(retraits, nom, commune):
            a_relire.add(nom)
        return retrait_concerne(
            retraits, organization_id=oid if oid in orgs_existantes else None,
            source=SOURCE, nom=nom, commune=commune, domaine=site, annuaire_id=annuaire_id)

    for f, *_ in occurrences:
        if f["uri"] in lieu_de_fiche:
            continue
        nom_adr = nom_du_lieu(f["adr"])
        hit = annuaire.proche(f["lat"], f["lon"], f"{f['adr']} {f['titre']}")
        if hit:
            l, dist, mode = hit
            modes[mode] += 1
            tiers_lieux_touches.add(l["id"])
            if l["organization_id"] and l["organization_id"] in orgs_existantes:
                oid = l["organization_id"]
                verdict_fiche[f["uri"]] = verdict_lieu(
                    oid, l["nom"], l.get("commune"), l.get("site_web"), l["id"])
                lieu_de_fiche[f["uri"]] = (oid, etab_de_org.get(oid))
                continue
            cle, nom, adr_l = f"annuaire:{l['id']}", l["nom"], l.get("adresse")
            cp_l, com_l, lat_l, lon_l = l.get("code_postal"), l.get("commune"), l["latitude"], l["longitude"]
            site, annuaire_id = l.get("site_web"), l["id"]
        else:
            annuaire_id, site = None, None
            commune_n = slugify(f["commune"], 80)
            cle = f"adresse:{slugify(sans_postal(f['adr'], f['cp'], f['commune']), 120)}:{f['cp']}:{commune_n}"
            if nom_adr:
                nom = nom_adr if nom_adr != nom_adr.upper() else casse_phrase(nom_adr, f["communes"], "", "")
                nom = f"{nom}, {f['commune']}" if slugify(f["commune"]) not in slugify(nom) else nom
            elif f["adr"]:
                rue = sans_postal(f["adr"], f["cp"], f["commune"])
                rue = rue if rue != rue.upper() else casse_phrase(rue, f["communes"], "", "")
                nom = f"{rue}, {f['commune']}"
            else:
                nom = f"{f['commune']} (lieu non précisé)"
            adr_l, cp_l, com_l, lat_l, lon_l = f["adr"] or None, f["cp"], f["commune"], f["lat"], f["lon"]
        oid = str(uuid.uuid5(NS, f"org:{SOURCE}:{cle}"))
        eid = str(uuid.uuid5(NS, f"est:{SOURCE}:{cle}"))
        lieu_de_fiche[f["uri"]] = (oid, eid)
        verdict_fiche[f["uri"]] = verdict_lieu(oid, nom, com_l, site, annuaire_id)
        if verdict_fiche[f["uri"]] == "refuser":
            continue  # rien à créer pour ce lieu
        if oid not in nouveaux_orgs:
            nouveaux_orgs[oid] = {
                "oid": oid, "eid": eid, "nom": (texte(nom) or nom or "Lieu")[:120], "adr": adr_l,
                "cp": cp_l, "commune": com_l, "lat": lat_l, "lon": lon_l, "site": site,
                "annuaire_id": annuaire_id, "existe": oid in orgs_existantes,
            }
        if annuaire_id:
            modes["rattachées (fiches, tous modes)"] += 1

    # Dates des lieux refusés : écartées ici, avant --max, et comptées.
    for o in occurrences:
        if verdict_fiche.get(o[0]["uri"]) == "refuser":
            compter_retrait(bilan_retrait, "refuser")
    occurrences = [o for o in occurrences if verdict_fiche.get(o[0]["uri"]) != "refuser"]

    nb_attachees = sum(1 for f, *_ in occurrences if lieu_de_fiche[f["uri"]][0] in nouveaux_orgs
                       and nouveaux_orgs[lieu_de_fiche[f["uri"]][0]]["annuaire_id"]) \
        + sum(1 for f, *_ in occurrences if lieu_de_fiche[f["uri"]][0] not in nouveaux_orgs)

    # ── C. Lot et construction des lignes ──
    lot = occurrences if args.max == 0 else occurrences[:args.max]
    oids_lot = list(dict.fromkeys(lieu_de_fiche[f["uri"]][0] for f, *_ in lot))
    orgs, sites, etabs = [], [], []
    etab_final = {}
    for oid in oids_lot:
        v = nouveaux_orgs.get(oid)
        if not v:
            continue  # organisation d'annuaire déjà en base : rien à créer
        eid = v["eid"]
        if oid in orgs_existantes:
            slug = next((o["slug"] for o in org_rows if o["id"] == oid), None)
        else:
            base = "import-" + slugify(v["nom"])
            slug, n = base, 1
            while slug in slugs_pris:
                n += 1
                slug = f"{base}-{n}"
            slugs_pris.add(slug)
            orgs.append({
                "id": oid, "slug": slug, "name": v["nom"],
                "address": adresse(v["adr"], v["cp"], v["commune"]) if v["adr"] or v["cp"] else None,
                "website": v["site"], "structure": "autre", "org_type": "autre",
                # Pas de claimed_at : une fiche importée ne ressemble jamais à une fiche revendiquée.
                "source": SOURCE,
            })
        if oid not in sites_existants:
            sites.append({"organization_id": oid, "slug": slug, "title": v["nom"], "status": "publie"})
            sites_existants.add(oid)
        if eid in etab_ids:
            etab_final[oid] = eid
        elif oid not in orgs_avec_etab:
            etabs.append({
                "id": eid, "organization_id": oid, "name": v["nom"], "slug": slug,
                "city": v["commune"], "address": v["adr"], "postal_code": v["cp"],
                "latitude": v["lat"], "longitude": v["lon"], "is_primary": True, "active": True,
            })
            etab_final[oid] = eid
            orgs_avec_etab.add(oid)
        else:
            etab_final[oid] = etab_de_org.get(oid)
        if v["annuaire_id"]:
            rattachements[v["annuaire_id"]] = oid

    evenements, provenance = [], []
    for f, debut, fin, eid in lot:
        oid, eid_lieu = lieu_de_fiche[f["uri"]]
        verdict = compter_retrait(bilan_retrait, verdict_fiche.get(f["uri"]))
        etid = etab_final.get(oid, eid_lieu if eid_lieu in etab_ids else etab_de_org.get(oid))
        debut_utc = paris_vers_utc(datetime.combine(max(debut, aujourdhui), datetime.min.time()))
        fin_utc = paris_vers_utc(datetime.combine(fin, datetime.min.time()) + timedelta(hours=23, minutes=59))
        evenements.append({
            "id": eid, "organization_id": oid, "establishment_id": etid,
            "title": f["titre"], "type": typer(f["titre"], f["cats"], debut, fin),
            "status": "publie", "start_at": debut_utc.isoformat(), "end_at": fin_utc.isoformat(),
            "description": None if verdict == "medias" else f["desc"],
            "price": None, "photos": [],
            "show_on_public_site": verdict != "masquer",
            # Aucun humain n'a validé ces fiches : le portail doit pouvoir le savoir.
            "portal_status": "pending",
        })
        registration = [{"type": "link", "value": u} for u in f["billets"]] + \
                       [{"type": "email", "value": c} for c in f["courriels"]]
        provenance.append({
            "event_id": eid, "source": SOURCE, "source_uid": f["uri"],
            "source_url": (f["infos"] or f["billets"] or [None])[0],
            "conditions": None, "registration": registration or None,
            "attribution": f["attribution"], "source_maj": f["maj"],
        })

    # Contrôle de schéma (lecture seule), y compris en essai.
    for table, rows in (("organizations", orgs), ("public_sites", sites), ("establishments", etabs),
                        ("evenements", evenements), ("evenements_import", provenance)):
        inconnues = verifier_colonnes(db, table, rows)
        if inconnues:
            raise SystemExit(f"Colonnes inconnues dans {table} : {inconnues}")

    if not args.essai:
        db.inserer("organizations", orgs, "id")
        db.inserer("public_sites", sites, "organization_id")
        db.inserer("establishments", etabs, "id")
        db.inserer("evenements", evenements, "id")
        db.inserer("evenements_import", provenance, "event_id")
        # Rattachement annuaire_lieux.organization_id, APRÈS l'insertion des
        # organisations (clé étrangère), et seulement sur une ligne encore libre.
        for aid, oid in rattachements.items():
            db._call("PATCH", f"annuaire_lieux?id=eq.{aid}&organization_id=is.null",
                     {"organization_id": oid}, headers={"Prefer": "return=minimal"})
    # Liens de doublons et enrichissements : apres les fiches (cle etrangere).
    bilan_doublons = dedoublonneur.ecrire(essai=args.essai, ids_ecrits={e["id"] for e in evenements})
    c = dedoublonneur.compteurs

    # ── Rapport ──
    mode = "ESSAI, rien n'est écrit" if args.essai else "écrit en base"
    portee = (",".join(sorted(depts)) if depts else "") + (f" rayon {args.rayon:g} km" if rayon else "")
    print(f"\nPérimètre : {portee.strip()}, horizon {args.horizon} mois (jusqu'au {fin_horizon}), aujourd'hui {aujourdhui}")
    print(f"Lues      : {stats['lues']} fiches au JSON, {stats['perimetre']} dans le périmètre")
    print(f"À venir   : {stats['avenir']} fiches avec au moins une date dans l'horizon "
          f"({stats['periodes_trop_longues']} périodes de plus de {DUREE_MAX_JOURS} jours écartées)")
    print("Exclues, par motif :")
    for m, n in sorted(motifs.items(), key=lambda x: -x[1]):
        print(f"  {n:5d}  {m}")
    print(f"Après les 5 filtres de la section 8 : {stats['apres_5_filtres']} fiches ")
    print(f"Retenues  : {stats['retenues_avant_base']} fiches, dont {stats['fiches_a_prochaine_date_seule']} "
          f"à la prochaine date seule (plus de {args.dates_max} dates)")
    print(f"Base      : {deja_en_base} dates déjà importées, {sum(doublons.values())} dates en doublon, "
          f"{memes_titres_autre_commune} dates au même titre et même jour dans une autre commune (gardées)")
    for k, n in sorted(doublons.items()):
        print(f"            doublon {k} : {n}")
    verbe_dd = "à lier (essai)" if args.essai else "liés"
    print(f"Doublons  : {bilan_doublons['liens']} {verbe_dd} (exact {c['exact']}, proche {c['proche']}), "
          f"{deja_liees} déjà liés, {c['seances']} séances gardées, {c['liens_reportes']} reportés (hors lot), "
          f"{bilan_doublons['fiches_enrichies']} fiches enrichies {bilan_doublons['champs'] or ''}"
          f" [règle {REGLE_DEDOUBLONNAGE}]")
    print(f"À importer: {stats['fiches_retenues']} fiches, {len(occurrences)} dates")
    par_type = Counter(typer(f["titre"], f["cats"], d, e) for f, d, e, _ in occurrences)
    par_type_fiche = {}
    for f, d, e, _ in occurrences:
        par_type_fiche.setdefault(f["uri"], typer(f["titre"], f["cats"], d, e))
    print("Types (dates)  : " + ", ".join(f"{k} {v}" for k, v in par_type.most_common()))
    print("Types (fiches) : " + ", ".join(f"{k} {v}" for k, v in Counter(par_type_fiche.values()).most_common()))
    uris_annuaire = {f["uri"] for f, *_ in occurrences
                     if (lieu_de_fiche[f["uri"]][0] in nouveaux_orgs and nouveaux_orgs[lieu_de_fiche[f["uri"]][0]]["annuaire_id"])
                     or lieu_de_fiche[f["uri"]][0] not in nouveaux_orgs}
    print(f"Tiers-lieux : {len(uris_annuaire)} fiches rattachées à {len(tiers_lieux_touches)} tiers-lieux de l'annuaire "
          f"({', '.join(f'{k} : {v}' for k, v in modes.items() if 'm' in k and 'fiches' not in k)})")
    print(f"Lieux     : {len([o for o in nouveaux_orgs.values() if not o['existe'] and not o['annuaire_id']])} lieux d'adresse à créer, "
          f"{len([o for o in nouveaux_orgs.values() if not o['existe'] and o['annuaire_id']])} organisations d'annuaire à créer "
          f"(ensemble des dates retenues)")
    print(f"HelloAsso : {sum(1 for f, *_ in occurrences if f['ha_retire']) and len({f['uri'] for f, *_ in occurrences if f['ha_retire']})} "
          f"fiches retenues dont un lien HelloAsso a été retiré, {stats['description_cite_helloasso']} descriptions qui citent encore le nom")
    print(f"Liens     : {sum(1 for f in {o[0]['uri']: o[0] for o in occurrences}.values() if f['billets'])} fiches avec billetterie gardée en inscription")
    print(f"Lot       : {len(lot)} dates, {len(orgs)} organisations, {len(sites)} vitrines techniques, "
          f"{len(etabs)} établissements, {len(rattachements)} rattachements annuaire ({mode})")
    print(f"Reste     : {len(occurrences) - len(lot)} dates après ce lot")
    print(f"Retraits  : {len(retraits)} actifs, ecartees_retrait {bilan_retrait.get('ecartees_retrait', 0)}, "
          f"masquees_retrait {bilan_retrait.get('masquees_retrait', 0)}, "
          f"sans_medias_retrait {bilan_retrait.get('sans_medias_retrait', 0)}")
    for nom_r in sorted(a_relire):
        print(f"  À relire (nom d'un retrait, commune différente) : {nom_r}")

    if args.exemples:
        print(f"\n{args.exemples} exemples (titre, commune, type) :")
        pas = max(1, len(occurrences) // args.exemples)
        for f, d, e, _ in occurrences[::pas][:args.exemples]:
            print(f"  {f['titre']} | {f['commune']} | {typer(f['titre'], f['cats'], d, e)} | {d}")
    if args.montrer:
        print("\nLignes construites (première de chaque table) :")
        for nom, rows in (("organizations", orgs), ("public_sites", sites), ("establishments", etabs),
                          ("evenements", evenements), ("evenements_import", provenance)):
            if rows:
                print(f"  {nom} : {json.dumps(rows[0], ensure_ascii=False)[:900]}")
        avec_billet = next((p for p in provenance if p["registration"]), None)
        if avec_billet:
            print(f"  evenements_import (avec inscription) : {json.dumps(avec_billet, ensure_ascii=False)[:600]}")
    print(f"Coût      : {db.octets / 1000:.1f} ko envoyés, {time.time() - t0:.1f} s, 0 token")


if __name__ == "__main__":
    main()
