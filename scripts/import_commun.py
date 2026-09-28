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
