# -*- coding: utf-8 -*-
"""
Fonctions partagées entre les scripts d'import d'événements.

Factorisé depuis import-openagenda.py (prompt 2.4) pour que import-sites.py
applique exactement les mêmes règles de nettoyage et de typage, sans dupliquer
un texte qui a déjà été relu et vérifié. import-openagenda.py n'a pas été
modifié : il reste autonome, ce module ne fait qu'y correspondre.

Rien d'ici ne transite par une conversation ni par un modèle de langage : ce
sont des fonctions pures, appelées par les scripts qui écrivent en base avec
la clé de service.
"""

import html
import json
import os
import re
import unicodedata
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

# Espace de noms des identifiants d'import. Partagé avec import-openagenda.py :
# NE PAS CHANGER, ni ici ni là-bas, sous peine de dupliquer tout ce qui a déjà
# été importé sous l'ancienne valeur.
NS = __import__("uuid").UUID("6f1b7d9e-0000-4000-8000-000000000000")

# Mêmes règles de typage que import-openagenda.py (2026-09-28). Copie
# volontaire plutôt qu'import croisé : les deux scripts sont indépendants,
# une évolution des règles pour l'un ne doit pas silencieusement changer
# l'autre sans qu'on l'ait décidé pour les deux.
TYPE_RULES = [
    ("retraite", r"retraite|ressourcement"),
    ("sejour", r"s[eé]jour|immersion|r[eé]sidence|week-?end"),
    ("formation", r"formation|cursus|certifiant|dipl[oô]mant|mooc"),
    ("stage", r"\bstages?\b"),
    ("atelier", r"\batelier|initiation|fabriqu"),
    ("exposition", r"exposition|expo\b|vernissage"),
    ("concert", r"concert|musique|live\b|dj set|festival"),
    ("spectacle", r"spectacle|th[eé][aâ]tre|danse|cin[eé]ma|projection|film|conte"),
    ("rencontre", r"rencontre|conf[eé]rence|d[eé]bat|table ronde|caf[eé]|lecture|visite"),
    ("marche", r"march[eé]|troc|brocante|vide-grenier|bourse"),
]

SEJOUR_FORT = re.compile(r"s[eé]jour|immersion|week-?end", re.I)
RESIDENCE = re.compile(r"r[eé]sidence", re.I)

FREE = re.compile(
    r"^(entr[eé]e\s*(libre|gratuite)|gratuit|acc[eè]s\s*libre|libre)"
    r"(\s*et\s*gratuit(e)?)?\s*[.!]?$", re.I)

EMOJI = re.compile(
    "[⌀-⏿☀-➿⬀-⯿\U0001F000-\U0001FAFF"
    "️⃣‍]")

DESCRIPTION_MAX = 1400

# Motifs d'exclusion éditoriale (§ « Exclusions de contenu », prompt 2.4).
# Sous-chaîne, sans casse ni accents : plus large qu'une correspondance exacte,
# volontairement, pour ne pas laisser passer une variante.
EXCLUSION_RECRUTEMENT = re.compile(
    r"france\s*travail|recrutement|job\s*dating|salon\s*de\s*l.?emploi"
    r"|portes?\s*ouvertes?\s*commerciales?", re.I)


def load_env():
    # .env.local en local (comportement inchangé) ; à défaut (CI GitHub
    # Actions par exemple), repli sur les variables d'environnement déjà
    # présentes dans le processus, sans jamais les afficher.
    path = Path(__file__).resolve().parent.parent / ".env.local"
    env = dict(re.findall(r"^([A-Z_]+)=(.*)$", path.read_text(encoding="utf-8"), re.M)) if path.exists() else {}
    url = (env.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")).strip().rstrip("/")
    key = (env.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")).strip()
    if not url or not key:
        raise SystemExit("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente (.env.local ou variables d'environnement).")
    return url, key


URL_HTTP = re.compile(r"https?://\S+")


def _espacer_hashtags_hors_url(t):
    """Sépare les mots-dièse accolés (« #Entrepreneuriat#Cannes »), qui
    forment un seul mot très long et débordent une carte à 320 px (constaté
    le 2026-09-28 sur bastiderouge.com, prompt 2.4), SANS toucher aux '#' qui
    font partie d'une URL (une ancre comme « .../programme/#29-09-26 » n'est
    pas un mot-dièse : la couper casserait le lien)."""
    morceaux = URL_HTTP.split(t)
    urls = URL_HTTP.findall(t)
    morceaux = [re.sub(r"(?<=\S)#", " #", m) for m in morceaux]
    out = [morceaux[0]]
    for url, m in zip(urls, morceaux[1:]):
        out.append(url)
        out.append(m)
    return "".join(out)


# Shortcodes de constructeur de page WordPress (Divi, etc.), qui fuient
# parfois dans le champ "excerpt" lu par l'API The Events Calendar au lieu du
# rendu HTML : « [et_pb_section ...]...[/et_pb_section] ». Ce n'est ni du
# HTML ni du texte. Motif générique (crochets non imbriqués), comme le HTML
# est déjà retiré sans connaître chaque balise : un vrai « [15] » de note de
# bas de page serait perdu aussi, mais ce cas ne s'est pas vu dans les sources
# visées ici (sites de tiers-lieux, pas de revues universitaires).
SHORTCODE_WP = re.compile(r"\[[^\[\]]{1,300}\]")


def texte(raw):
    """HTML -> texte conforme aux règles du site (pas d'émoji, pas de tiret
    cadratin/demi-cadratin, pas de HTML). Identique à import-openagenda.py,
    sauf les deux ajouts commentés ci-dessus (mots-dièse, shortcodes),
    nécessaires aux sources WordPress moissonnées par import-sites.py."""
    if not raw:
        return None
    # <script>/<style> : le générique <[^>]+> ci-dessous ne retire que les
    # balises, pas le code ou le CSS qu'elles entourent. Constaté en écriture
    # réelle le 2026-09-28 (100 fiches "site:" avec du JavaScript Gravity
    # Forms ou des propriétés CSS "--wpforms-..." dans la description) : une
    # page dont le champ "description" JSON-LD ou l'excerpt Tribe recopie le
    # contenu brut d'une section du site sans l'avoir nettoyée en amont.
    t = re.sub(r"(?is)<(script|style)\b[^>]*>.*?</\1>", "", raw)
    t = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</li>|</h[1-6]>", "\n", t)
    t = re.sub(r"(?i)<li[^>]*>", "• ", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = SHORTCODE_WP.sub("", t)
    t = html.unescape(t)
    t = EMOJI.sub("", t)
    t = re.sub(r"(?<=\d)[—–](?=\d)", "-", t)
    t = re.sub(r"\s+[—–]\s+", ", ", t)
    t = t.replace("—", ",").replace("–", ",")
    t = _espacer_hashtags_hors_url(t)
    # Une icône mal décodée ou retirée juste avant un lien laisse parfois
    # l'URL collée au mot précédent (« ????https://... », constaté le
    # 2026-09-28) : un seul « mot » de plus de 100 caractères déborde une
    # carte à 320 px. Un espace avant "http" ne casse jamais un vrai lien.
    t = re.sub(r"(?<=\S)(https?://)", r" \1", t)
    t = re.sub(r"[ \t ]+", " ", t)
    t = "\n".join(line.strip() for line in t.split("\n"))
    t = re.sub(r"\n{3,}", "\n\n", t).strip()
    return t or None


def couper(t, n=DESCRIPTION_MAX):
    if not t or len(t) <= n:
        return t
    cut = t.rfind(" ", 0, n)
    return t[:cut if cut > n * 0.6 else n].rstrip(" ,;:") + "…"


def slugify(text, maxlen=48):
    s = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s[:maxlen].rstrip("-") or "lieu"


def duree_jours(debut, fin):
    if not debut or not fin:
        return 0
    try:
        d, f = date.fromisoformat(debut[:10]), date.fromisoformat(fin[:10])
    except ValueError:
        return 0
    return (f - d).days


def guess_type(title, keywords, start_at=None, end_at=None):
    hay = f"{title} {keywords or ''}".lower()
    for code, pattern in TYPE_RULES:
        if code == "sejour" and not SEJOUR_FORT.search(hay) and RESIDENCE.search(hay):
            if duree_jours(start_at, end_at) >= 2:
                return "sejour"
            continue
        if re.search(pattern, hay):
            return code
    return "autre"


# ── Typage v2 (T7, 2026-10-12) ──────────────────────────────────────────────
# Liste unique corrigée, sur titre ET description. Additive : TYPE_RULES et
# guess_type ci-dessus restent inchangés (import-openagenda.py, import-sites.py
# les utilisent encore) ; les scripts qui veulent la v2 appellent typer_v2.
# Corrections : « information » n'est pas « formation », « marche » (randonnée)
# n'est pas un marché, week-end / immersion / résidence ne forcent un séjour
# qu'à partir de deux jours, « contemporain » n'est pas un conte.
# Codes en base : sans accent (marche, sejour, fete). Pas de CHECK sur
# evenements.type (vérifié 2026-10-12), « fete » s'écrit sans migration.
# Priorité (le premier qui matche gagne) : retraite, séjour, formation, stage,
# atelier, fête, exposition, concert, spectacle, rencontre, marché.
def _sa(t):
    return unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower()


# (code, motif sur texte sans accent) : motifs complets, pour le TITRE.
REGLES_V2_TITRE = [
    ("retraite", re.compile(r"\bretraites?\b(?! aux flambeaux)|ressourcement")),
    ("sejour", re.compile(r"\bsejours?\b")),
    ("sejour_faible", re.compile(r"immersion|residence|week-?end")),  # deux jours ou plus
    ("formation", re.compile(r"\bformations?\b|cursus|certifiant|diplomant|mooc")),
    ("stage", re.compile(r"\bstages?\b")),
    ("atelier", re.compile(r"\bateliers?\b|\binitiation|\bfabriqu(?:e|ez|er|ons)\b")),
    ("fete", re.compile(r"\bfetes?\b|kermesse|carnaval|\bferia|fest-?noz|\bbal\b|\bbals\b")),
    ("exposition", re.compile(r"exposition|\bexpos?\b|vernissage")),
    ("concert", re.compile(r"concert|musique|\blive\b|dj set|festival")),
    ("spectacle", re.compile(
        r"spectacle|theatre|danse|cinema|projection|\bfilms?\b|\bcontes?\b|conteu"
        r"|cirque|marionnette|humour|clown|comedy|stand-?up|one[- ]?(?:wo)?man")),
    ("rencontre", re.compile(
        r"rencontre|conference|debat|table ronde|\bcafes?\b|lecture|visite|dedicace|causerie")),
]
V2_MARCHE_ACCENT = re.compile(r"\bmarchés?\b")
V2_MARCHE_SANS_ACCENT = re.compile(
    r"\bmarches? (?:de noel|paysan|nocturne|artisanal|de producteurs|de createurs"
    r"|de potiers|gourmand|bio|fermier|de plein vent)|\bbraderies?\b|vente solidaire|\bbrocante|vide-?grenier")
V2_FESTIVAL_NON_MUSICAL = re.compile(r"theatre|cinema|danse|cirque|spectacle")
# DESCRIPTION : seulement les termes forts et les premiers caractères (le
# texte long cite beaucoup de mots hors sujet). Pas de musique, live, cafe,
# lecture, visite, film, conte, danse, festival, initiation, sejour, week-end.
V2_DESC_LEN = 350
REGLES_V2_DESC = [
    ("retraite", re.compile(r"\bretraites? (?:de |en |spirituelle|yoga|silence|meditation|bien-etre)|ressourcement")),
    ("formation", re.compile(r"\bformations?\b(?! de|s? des)|certifiant|diplomant")),
    ("stage", re.compile(r"\bstages?\b")),
    ("atelier", re.compile(r"\bateliers?\b")),
    ("fete", re.compile(r"\bfetes? (?:du|de|des|d')|kermesse|carnaval|fest-?noz|\bbal (?:folk|trad|populaire)")),
    ("exposition", re.compile(r"exposition|vernissage")),
    ("concert", re.compile(r"\bconcerts?\b|dj set")),
    ("spectacle", re.compile(r"\bspectacles?\b|piece de theatre|projection")),
    ("rencontre", re.compile(r"conference|table ronde|\bdebats?\b|rencontre-debat|dedicace")),
]


def typer_v2(titre, description=None, start_at=None, end_at=None):
    """Renvoie (code, regle) ou (None, None) quand rien ne matche.
    Sources : « titre:<type> » puis « desc:<type> »."""
    t_l = (titre or "").lower()
    t_n = _sa(titre)
    duree = duree_jours(start_at, end_at)
    for code, motif in REGLES_V2_TITRE:
        if code == "sejour_faible":
            if motif.search(t_n) and duree >= 2:
                return "sejour", "titre:sejour"
            continue
        if not motif.search(t_n):
            continue
        if code == "concert" and not re.search(r"concert|musique|\blive\b|dj set", t_n):
            if V2_FESTIVAL_NON_MUSICAL.search(t_n):
                continue
        return code, f"titre:{code}"
    if V2_MARCHE_ACCENT.search(t_l) or V2_MARCHE_SANS_ACCENT.search(t_n):
        return "marche", "titre:marche"
    d_n = _sa((description or "")[:V2_DESC_LEN])
    for code, motif in REGLES_V2_DESC:
        if motif.search(d_n):
            return code, f"desc:{code}"
    if re.search(r"\bmarchés? (?:de|du|des|d'|artisanal|paysan|nocturne)", (description or "")[:V2_DESC_LEN].lower()):
        return "marche", "desc:marche"
    return None, None


def titre_normalise(titre):
    """Forme comparable d'un titre, pour l'anti-doublon avec OpenAgenda :
    sans accent, sans ponctuation, espaces réduits, en minuscule."""
    s = unicodedata.normalize("NFKD", titre or "").encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9 ]+", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def est_exclusion_recrutement(titre):
    return bool(EXCLUSION_RECRUTEMENT.search(titre or ""))


def as_list(value):
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return json.loads(value) or None
        except json.JSONDecodeError:
            return None
    return value or None


def adresse(addr, cp, city):
    addr, cp, city = (addr or "").strip(), (cp or "").strip(), (city or "").strip()
    if not addr:
        return f"{cp} {city}".strip() or None
    if not cp or cp in addr:
        return addr[:200]
    segments = [s.strip() for s in addr.split(",")]
    if city and slugify(segments[-1], 200) == slugify(city, 200):
        segments[-1] = f"{cp} {segments[-1]}"
        return ", ".join(segments)[:200]
    if city and slugify(city, 200) in slugify(addr, 400):
        return addr[:200]
    return ", ".join(x for x in [addr, f"{cp} {city}".strip()] if x)[:200]


class Base:
    """Client REST minimal vers PostgREST, identique à celui d'import-openagenda.py."""

    def __init__(self, url, key):
        self.url = url
        self.auth = {"apikey": key, "Authorization": f"Bearer {key}"}
        self.octets = 0

    def _call(self, method, path, body=None, headers=None):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
        req = urllib.request.Request(
            f"{self.url}/rest/v1/{path}", data=data, method=method,
            headers={**self.auth, "Content-Type": "application/json", **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                raw = r.read()
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:500]
            raise SystemExit(f"Échec {method} {path.split('?')[0]} : HTTP {e.code} {detail}")
        self.octets += len(data or b"")
        return json.loads(raw) if raw else None

    def lire_tout(self, path):
        rows, start = [], 0
        while True:
            page = self._call("GET", path, headers={"Range": f"{start}-{start + 999}"})
            rows += page
            if len(page) < 1000:
                return rows
            start += 1000

    def inserer(self, table, rows, conflit):
        for i in range(0, len(rows), 200):
            self._call(
                "POST", f"{table}?on_conflict={conflit}", rows[i:i + 200],
                headers={"Prefer": "resolution=ignore-duplicates,return=minimal"})
        return len(rows)

    def upsert(self, table, rows, conflit):
        """Insère ou remplace (merge-duplicates) : utilisé pour
        annuaire_sites_sondes, où chaque sondage doit écraser le précédent."""
        for i in range(0, len(rows), 200):
            self._call(
                "POST", f"{table}?on_conflict={conflit}", rows[i:i + 200],
                headers={"Prefer": "resolution=merge-duplicates,return=minimal"})
        return len(rows)


# ---------------------------------------------------------------------------
# Retraits sur demande (P2, migration 0031). Ajout seulement.
#
# Un retrait est une ligne de import_retraits. Les scripts d'import lisent la
# vue import_retraits_actifs une fois au démarrage (lire_retraits), puis
# demandent pour chaque organisation ou fiche candidate s'ils doivent
# s'abstenir (retrait_concerne). Rien n'est écrit ici : ce module ne fait que
# décider, l'écriture reste dans les scripts.
#
# Réponses de retrait_concerne, de la plus forte à la plus faible :
#   "refuser" : portée import. Ne créer ni organisation, ni fiche, ni
#               rattachement ; compter « écartées, retrait ».
#   "masquer" : portée fiches. La fiche entre avec show_on_public_site=false.
#   "medias"  : portée medias. La fiche entre sans description ni photos.
#   None      : aucun retrait ne s'applique.
# ---------------------------------------------------------------------------

# Domaines partagés par plusieurs structures : un même domaine n'y prouve rien.
# Comparaison sur le domaine exact ou sur un sous-domaine de la liste.
DOMAINES_PARTAGES = (
    "wixsite.com", "wix.com", "openagenda.com", "facebook.com", "instagram.com",
    "linktr.ee", "helloasso.com", "weebly.com", "jimdofree.com", "jimdosite.com",
    "blogspot.com", "wordpress.com", "over-blog.com", "google.com", "youtube.com",
    "eventbrite.fr", "eventbrite.com", "meetup.com", "weezevent.com",
    "yurplan.com", "billetweb.fr", "framasoft.org", "carrd.co", "notion.site",
)


def texte_normalise_py(t):
    """Équivalent Python de texte_normalise (0030) : minuscule, sans accent,
    tout ce qui n'est pas a-z0-9 devient un espace, espaces réduits. Les
    ligatures (œ, æ) ne sont pas dépliées, comme côté SQL."""
    s = unicodedata.normalize("NFKD", t or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def domaine_web_de(site):
    """Domaine d'une adresse web, sans schéma ni « www. », même règle que
    retrait_poser. Renvoie None si rien d'exploitable."""
    s = (site or "").strip().lower()
    if not s:
        return None
    m = re.match(r"^(?:[a-z][a-z0-9+.-]*://)?(?:www\.)?([^/:?#\s]+)", s)
    return m.group(1) if m else None


def domaine_partage(domaine):
    if not domaine:
        return False
    if domaine.startswith("mairie-") or ".mairie-" in domaine:
        return True
    return any(domaine == d or domaine.endswith("." + d) for d in DOMAINES_PARTAGES)


def lire_retraits(db):
    """Retraits actifs (vue import_retraits_actifs), à lire une fois par passage.
    db est une Base (client service). Si la vue manque, l'échec est net
    (SystemExit de Base._call) : mieux vaut ne rien importer que d'importer
    sans respecter les retraits."""
    return db.lire_tout(
        "import_retraits_actifs?select=id,organization_id,annuaire_lieu_id,portee,"
        "source,nom_normalise,commune_normalisee,domaine_web")


_FORCE = {"refuser": 3, "masquer": 2, "medias": 1}


def retrait_concerne(retraits, organization_id=None, source=None, nom=None,
                     commune=None, domaine=None, annuaire_id=None):
    """Dit si un import doit s'abstenir, masquer ou vider les médias.

    organization_id : organisation déjà en base, ou None si elle n'existe pas encore.
    source          : orthographe de evenements_import.source de ce script
                      ('openagenda', 'datatourisme', 'site:<domaine>').
    nom, commune    : de la structure candidate (bruts, normalisés ici).
    domaine         : domaine de son site web (ou une adresse web : normalisée ici).
    annuaire_id     : lieu de l'annuaire rattaché, s'il y en a un.

    Les empreintes (nom + commune, ou domaine hors domaines partagés) ne valent
    que pour un retrait « import » sans source : c'est le seul qui promet de
    ne plus jamais importer la structure, quelle que soit la source. Un nom
    seul, sans commune, ne bloque pas : voir retrait_a_relire."""
    nom_n = texte_normalise_py(nom) if nom else ""
    com_n = texte_normalise_py(commune) if commune else ""
    dom = domaine_web_de(domaine) if domaine else None
    if dom and domaine_partage(dom):
        dom = None
    meilleur = None
    for r in retraits or []:
        portee = r.get("portee")
        verdict = None
        meme_cible = bool(
            (organization_id and r.get("organization_id") == organization_id)
            or (annuaire_id and r.get("annuaire_lieu_id") == annuaire_id))
        if portee == "import":
            if r.get("source"):
                # Retrait par source : seule cette source est refusée, et
                # seulement pour la cible nommée (pas d'empreinte).
                if meme_cible and source == r["source"]:
                    verdict = "refuser"
            elif meme_cible:
                verdict = "refuser"
            else:
                empreinte_nom = bool(nom_n and com_n
                                     and r.get("nom_normalise") == nom_n
                                     and r.get("commune_normalisee") == com_n)
                empreinte_dom = bool(dom and r.get("domaine_web") == dom
                                     and not domaine_partage(r.get("domaine_web")))
                if empreinte_nom or empreinte_dom:
                    verdict = "refuser"
        elif portee == "fiches" and meme_cible:
            verdict = "masquer"
        elif portee == "medias" and meme_cible:
            verdict = "medias"
        if verdict and _FORCE[verdict] > _FORCE.get(meilleur, 0):
            meilleur = verdict
    return meilleur


def retrait_a_relire(retraits, nom, commune=None):
    """Vrai si seul le nom (sans commune concordante) ressemble à une
    empreinte d'un retrait « import » sans source. Ne bloque rien : à
    signaler dans le bilan du passage, pour relecture humaine."""
    nom_n = texte_normalise_py(nom) if nom else ""
    com_n = texte_normalise_py(commune) if commune else ""
    if not nom_n:
        return False
    for r in retraits or []:
        if r.get("portee") == "import" and not r.get("source") and r.get("nom_normalise") == nom_n:
            if not (com_n and r.get("commune_normalisee") == com_n):
                return True
    return False


def compter_retrait(compteur, verdict):
    """Incrémente le dictionnaire de bilan d'un passage (« écartées, retrait »,
    « masquées, retrait », « sans médias, retrait »). Renvoie le verdict."""
    if verdict:
        cle = {"refuser": "ecartees_retrait", "masquer": "masquees_retrait",
               "medias": "sans_medias_retrait"}[verdict]
        compteur[cle] = compteur.get(cle, 0) + 1
    return verdict
