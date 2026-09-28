# -*- coding: utf-8 -*-
"""
Import d'événements OpenAgenda (Licence Ouverte) dans la base Casa Minga.

Pourquoi un script, et pas un modèle
------------------------------------
La source est structurée : lieu, dates, conditions, canaux d'inscription y sont
déjà typés. Transformer une ligne en fiche est un mapping, pas un travail
d'interprétation. Faire passer ces données par un modèle de langage coûterait
environ 156 000 tokens pour 667 événements (mesuré le 2026-09-10) sans rien
apporter, et exposerait chaque champ à une altération silencieuse. Ce script
lit l'API et écrit en base directement : rien ne transite par une conversation.

Ce qu'il garantit
-----------------
- Rejouable sans doublon. Les identifiants sont dérivés de ceux d'OpenAgenda
  (uuid5), les mêmes que pour l'import montpelliérain du 2026-09-09 : un lieu
  ou un événement déjà présent est reconnu et laissé tel quel, y compris s'il
  a été corrigé à la main ou revendiqué depuis.
- Par lots. `--max 50` importe les 50 prochains événements non encore
  présents. Relancer la même commande importe les 50 suivants.
- Réparable. Si un lot s'interrompt entre deux tables, la relance complète ce
  qui manque (vitrine technique, établissement, provenance) sans rien dupliquer.
- Rien n'est deviné. Un champ absent à la source reste absent en base.

Règles de contenu, héritées du site
-----------------------------------
Aucun émoji, aucun tiret cadratin, aucun HTML : les descriptions OpenAgenda
sont en HTML, et l'import de Montpellier l'avait recopié tel quel avant d'être
corrigé en base. Le nettoyage est fait ici, avant l'écriture.

Usage
-----
  python scripts/import-openagenda.py --departement "Hérault" \\
      --exclure "Mes événements France Travail" --max 50
  ... --essai     compte ce qui serait importé, n'écrit rien

  python scripts/import-openagenda.py --lieux scripts/lieux-tiers-lieux.json \
      --depuis 2026-10-01 --jusqu-a 2027-01-01 --max 50

  ... --retyper --essai   recalcule le type des fiches autre/atelier déjà
                           importées (formation, stage, retraite, séjour),
                           compte par nouveau type, n'écrit rien
  ... --retyper            même chose, écrit en base

Deux façons de choisir la source, exclusives l'une de l'autre. Par département,
on prend tout ce qui s'y publie, bibliothèques et cinémas compris. Par liste de
lieux, on ne prend que les lieux nommés dans le fichier : c'est le seul moyen
de viser les tiers-lieux, qu'OpenAgenda ne distingue pas des autres.

La clé de service est lue dans .env.local et n'est jamais affichée.
"""

import argparse
import html
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import date
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

SOURCE = "openagenda"
API = ("https://public.opendatasoft.com/api/explore/v2.1/catalog/"
       "datasets/evenements-publics-openagenda/records")
FIELDS = ",".join([
    "uid", "canonicalurl", "title_fr", "longdescription_fr", "description_fr",
    "conditions_fr", "keywords_fr", "image", "firstdate_begin", "firstdate_end",
    "registration", "location_uid", "location_name", "location_address",
    "location_city", "location_postalcode", "location_coordinates",
    "location_phone", "location_website", "originagenda_title",
])

# Agences France Travail : filtre defensif applique quel que soit le mode
# (--departement ou --lieux), en plus de --exclure. Resserrement du 2.3 : le
# rapprochement annuaire x OpenAgenda exclut deja les lieux nommes « agence »
# ou « France Travail », mais un tiers-lieu retenu peut malgre tout publier un
# evenement sur un agenda France Travail (agenda partage). Sous-chaine, sans
# casse ni accents, plus large qu'un --exclure exact.
FRANCE_TRAVAIL = re.compile(r"france\s*travail", re.I)

# Espace de noms des identifiants d'import. NE PAS CHANGER : c'est lui qui
# permet de reconnaître un lieu ou un événement déjà importé.
NS = uuid.UUID("6f1b7d9e-0000-4000-8000-000000000000")

# Types Casaminga, repris de l'import de Montpellier, complétés le 2026-09-28
# (décision de Léo) par formation, stage, retraite, séjour. On ne mappe que ce
# qu'on peut justifier ; le reste tombe dans « autre », qui est honnête.
# Formation, stage, retraite et séjour passent AVANT atelier : un « stage »
# n'est plus reconnu comme atelier (retiré de sa règle), et « initiation »
# reste en atelier (une initiation courte n'est pas un stage long).
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

# « résidence » seule est ambiguë : une résidence d'artiste se montre parfois
# en une exposition ou une rencontre d'un soir (vernissage), parfois en un vrai
# séjour sur place. On ne la fait basculer en séjour que si la fiche dure au
# moins deux jours ; sinon les règles suivantes (exposition, rencontre) jugent
# comme avant, sans le mot « résidence ». Limite connue : sans dates lisibles,
# la fiche retombe dans les règles suivantes plutôt que dans une fausse
# certitude de séjour.
SEJOUR_FORT = re.compile(r"s[eé]jour|immersion|week-?end", re.I)
RESIDENCE = re.compile(r"r[eé]sidence", re.I)

# Gratuité : affirmée seulement sur une formule sans ambiguïté. « Gratuit pour
# les moins de 16 ans » n'est pas un événement gratuit.
FREE = re.compile(
    r"^(entr[eé]e\s*(libre|gratuite)|gratuit|acc[eè]s\s*libre|libre)"
    r"(\s*et\s*gratuit(e)?)?\s*[.!]?$", re.I)

# Émoji et pictogrammes. Plages explicites plutôt que \p{Extended_Pictographic},
# que le module `re` ne connaît pas ; ©, ® et ™ restent, comme sur le site.
EMOJI = re.compile(
    "[⌀-⏿☀-➿⬀-⯿\U0001F000-\U0001FAFF"
    "️⃣‍]")

DESCRIPTION_MAX = 1400


# ── Environnement ───────────────────────────────────────────────────────────

def load_env():
    path = Path(__file__).resolve().parent.parent / ".env.local"
    if not path.exists():
        raise SystemExit(f"Fichier introuvable : {path}")
    env = dict(re.findall(r"^([A-Z_]+)=(.*)$", path.read_text(encoding="utf-8"), re.M))
    url = env.get("NEXT_PUBLIC_SUPABASE_URL", "").strip().rstrip("/")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise SystemExit("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente de .env.local.")
    return url, key


# ── Nettoyage ───────────────────────────────────────────────────────────────

def texte(raw):
    """HTML OpenAgenda -> texte conforme aux règles du site."""
    if not raw:
        return None
    t = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</li>|</h[1-6]>", "\n", raw)
    t = re.sub(r"(?i)<li[^>]*>", "• ", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t)
    t = EMOJI.sub("", t)
    # Cadratin et demi-cadratin sont interdits par les règles du site. Entre deux
    # nombres, le tiret marque un intervalle (« 10–12 ans ») : un trait d'union
    # le dit aussi bien. Ailleurs, entouré d'espaces, il sépare deux membres de
    # phrase, et la virgule le remplace sans rien perdre.
    t = re.sub(r"(?<=\d)[—–](?=\d)", "-", t)
    t = re.sub(r"\s+[—–]\s+", ", ", t)
    t = t.replace("—", ",").replace("–", ",")
    t = re.sub(r"[ \t ]+", " ", t)
    t = "\n".join(line.strip() for line in t.split("\n"))
    t = re.sub(r"\n{3,}", "\n\n", t).strip()
    return t or None


def couper(t, n=DESCRIPTION_MAX):
    """Coupe au dernier espace avant la limite, plutôt qu'au milieu d'un mot."""
    if not t or len(t) <= n:
        return t
    cut = t.rfind(" ", 0, n)
    return t[:cut if cut > n * 0.6 else n].rstrip(" ,;:") + "…"


# Ligne ajoutée par un agenda agrégateur au bas de ses fiches (« source:
# Balèti occitan enfants-familles - AgendaTrad ») : de la plomberie, pas du
# contenu. Motif volontairement étroit : un texte patrimonial peut citer une
# vraie source (« Source : Archives départementales »), qu'il faut garder.
AGREGATEUR = re.compile(r"(?im)^source\s*:.*\s-\s*AgendaTrad\s*$\n?")


def corps_evenement(r):
    """Description d'un événement, nettoyée et coupée."""
    t = texte(r.get("longdescription_fr")) or texte(r.get("description_fr"))
    if t:
        t = AGREGATEUR.sub("", t).strip() or None
    return couper(t)


def slugify(text, maxlen=48):
    s = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s[:maxlen].rstrip("-") or "lieu"


def duree_jours(debut, fin):
    """Durée en jours pleins entre deux horodatages ISO (date seule comparée :
    l'heure ne change rien à « deux jours ou plus »). 0 si une date manque ou
    est illisible : mieux vaut sous-estimer la durée que la deviner."""
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
            continue  # « résidence » seule et fiche courte : on laisse juger la suite
        if re.search(pattern, hay):
            return code
    return "autre"


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
    """L'adresse source contient souvent déjà code postal et ville : on ne les
    rajoute que s'ils manquent, sans quoi on obtient « 34080 Montpellier,
    34080, Montpellier », comme lors de l'import précédent.

    La comparaison se fait sur des formes normalisées : la source écrit la
    même commune « Causse de la Selle » dans l'adresse et « Causse-de-la-Selle »
    dans le champ ville, et une comparaison littérale les croyait différentes.

    Le code postal, lui, ne doit pas disparaître en chemin : il se place devant
    la commune, au format postal français (« rue Roger Salasc, 34800
    Clermont-l'Hérault »), plutôt qu'en segment isolé en fin de ligne."""
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


# ── Réseau ──────────────────────────────────────────────────────────────────

class Base:
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
        """Insère en ignorant les doublons : jamais d'écrasement d'une ligne
        existante, qui peut avoir été corrigée à la main ou revendiquée."""
        for i in range(0, len(rows), 200):
            self._call(
                "POST", f"{table}?on_conflict={conflit}", rows[i:i + 200],
                headers={"Prefer": "resolution=ignore-duplicates,return=minimal"})
        return len(rows)


def fenetre_temporelle(depuis, jusqua):
    """
    Clause de dates de la requete.

    Par defaut, tout le futur, comme pour l'import montpellierain. Un import
    cible une periode precise (une saison, un trimestre) : « depuis » et
    « jusqu-a » la bornent, en dates ISO.
    """
    clause = f"firstdate_begin >= date'{depuis}'" if depuis else "firstdate_begin >= now()"
    if jusqua:
        clause += f" and firstdate_begin < date'{jusqua}'"
    return clause


def pages(where):
    """Parcourt une requete Opendatasoft page par page, 100 lignes a la fois."""
    offset = 0
    while True:
        q = {"where": where, "select": FIELDS, "limit": 100, "offset": offset,
             "order_by": "firstdate_begin"}
        with urllib.request.urlopen(f"{API}?{urllib.parse.urlencode(q)}", timeout=120) as r:
            page = json.load(r)["results"]
        for ligne in page:
            yield ligne
        if len(page) < 100:
            return
        offset += 100


LOT_UID = 80  # identifiants par requete : au-dela, l'URL devient trop longue


def lire_lieux(fichier, depuis, jusqua):
    """
    Lit les evenements d'une liste blanche de lieux, et d'eux seuls.

    OpenAgenda ne dit pas ce qu'est un lieu : ni tiers-lieu, ni bibliotheque,
    ni cinema. Selectionner par departement ramene donc tout le monde. Le
    fichier passe en argument porte les identifiants de lieux retenus et dit
    comment il a ete etabli.

    Un meme lieu reel y apparait parfois sous plusieurs identifiants
    OpenAgenda. Le champ « canonique » les ramene a un seul, sans quoi l'import
    creerait autant d'organisations que d'identifiants pour le meme endroit.

    Les identifiants sont regroupes par lots de LOT_UID dans une seule clause
    `location_uid in (...)` : une liste de plusieurs centaines de lieux (issue
    du rapprochement avec l'annuaire, par exemple) ferait sinon une requete par
    lieu, beaucoup trop lente.
    """
    liste = json.loads(Path(fichier).read_text(encoding="utf-8"))["lieux"]
    canonique = {l["uid"]: (l.get("canonique") or l["uid"]) for l in liste}
    fenetre = fenetre_temporelle(depuis, jusqua)
    uids = list(canonique)
    rows = []
    for i in range(0, len(uids), LOT_UID):
        groupe = uids[i:i + LOT_UID]
        clause = "location_uid in (" + ",".join(f'"{u}"' for u in groupe) + ")"
        for r in pages(f"{clause} and {fenetre}"):
            r["location_uid"] = canonique[r["location_uid"]]
            rows.append(r)
    return rows


def lire_mapping_annuaire(fichier):
    """
    Association identifiant-lieu-canonique -> tiers-lieu de l'annuaire, quand
    le fichier de liste blanche en porte (produit par
    rapprocher-annuaire-openagenda.py). Une liste blanche etablie a la main
    n'a pas ce champ : le mapping est alors vide, sans erreur.
    """
    liste = json.loads(Path(fichier).read_text(encoding="utf-8"))["lieux"]
    mapping = {}
    for l in liste:
        if l.get("annuaire_id"):
            mapping[l.get("canonique") or l["uid"]] = l["annuaire_id"]
    return mapping


def lire_source(departement, exclus, depuis=None, jusqua=None):
    where = f'location_department="{departement}" and ' + fenetre_temporelle(depuis, jusqua)
    for agenda in exclus:
        where += ' and originagenda_title != "{}"'.format(agenda.replace('"', '\\"'))
    return list(pages(where))


# ── Import ──────────────────────────────────────────────────────────────────

def reparer(db, source, essai):
    """
    Réécrit ce qu'un import a lui-même mal écrit, et rien d'autre.

    Un import n'écrase jamais une ligne existante, si bien qu'une règle de
    nettoyage corrigée ne s'applique pas aux fiches déjà en base. Ce mode les
    rattrape, sous une condition stricte : la valeur actuelle doit être
    EXACTEMENT celle qu'une version précédente de l'import a produite. Une
    adresse ou une description retouchée à la main n'y correspond plus, et
    reste donc intacte. Les lieux revendiqués ne sont jamais touchés.

    Deux corrections, datées du 2026-09-11 :
    - adresses : « 34080 Montpellier, 34185, Montpellier », où code postal et
      commune étaient recollés à une adresse qui les contenait déjà ;
    - descriptions : la ligne « source: … - AgendaTrad » d'un agrégateur.

    Portée : les lieux et événements présents dans la source lue. Un lieu
    importé qui n'a plus d'événement à venir n'y figure pas et n'est pas revu.
    """
    def adresse_v0(a, cp, c):  # import de Montpellier, 2026-09-09
        return (", ".join(x for x in [a, cp, c] if x)[:200]) or None

    def adresse_v1(a, cp, c):  # premier lot de l'Hérault, 2026-09-11
        a = (a or "").strip()
        if a and (not c or c.lower() in a.lower()):
            return a[:200]
        return adresse_v0(a, cp, c)

    def corps_v1(r):  # avant le retrait de la ligne d'agrégateur
        return couper(texte(r.get("longdescription_fr")) or texte(r.get("description_fr")))

    orgs = db.lire_tout("organizations?select=id,address&source=neq.casaminga&claimed_at=is.null")
    non_revendiquees = {o["id"] for o in orgs}

    lieux = {}
    for r in source:
        if r.get("location_uid"):
            lieux.setdefault(str(uuid.uuid5(NS, "org:" + r["location_uid"])),
                             (r.get("location_address"), r.get("location_postalcode"), r.get("location_city")))

    adresses = []
    for o in orgs:
        src = lieux.get(o["id"])
        if not src:
            continue
        neuve = adresse(*src)
        if o["address"] != neuve and o["address"] in {adresse_v0(*src), adresse_v1(*src)}:
            adresses.append((o["id"], neuve))

    par_evt = {str(uuid.uuid5(NS, "evt:" + r["uid"])): r for r in source}
    actuels = db.lire_tout("evenements_import?select=event_id,evenements(description,organization_id)")
    descriptions = []
    for row in actuels:
        e, r = row.get("evenements") or {}, par_evt.get(row["event_id"])
        if not r or e.get("organization_id") not in non_revendiquees:
            continue
        neuve = corps_evenement(r)
        if e.get("description") != neuve and e.get("description") == corps_v1(r):
            descriptions.append((row["event_id"], neuve))

    if not essai:
        for oid, valeur in adresses:
            db._call("PATCH", f"organizations?id=eq.{oid}", {"address": valeur},
                     headers={"Prefer": "return=minimal"})
        for eid, valeur in descriptions:
            db._call("PATCH", f"evenements?id=eq.{eid}", {"description": valeur},
                     headers={"Prefer": "return=minimal"})

    mode = "ESSAI, rien n'est écrit" if essai else "corrigé en base"
    print(f"Réparation ({mode}) : {len(adresses)} adresses, {len(descriptions)} descriptions")
    for oid, valeur in adresses[:3]:
        print(f"  adresse -> {valeur}")


def retyper(db, source, essai):
    """
    Recalcule le type des événements déjà importés dont le type vaut « autre »
    ou « atelier », avec les règles de typage actuelles (formation, stage,
    retraite, séjour ajoutés le 2026-09-28). Ne touche jamais une fiche
    retouchée à la main : `evenements_import.checked_at` non nul dit qu'un
    humain est déjà passé, y compris peut-être sur le type.

    Le nouveau type se calcule sur la fiche source (titre, mots-clés, dates),
    pas sur ce qui est en base : `source` doit donc couvrir le même périmètre
    (département ou liste de lieux) que l'import initial pour retrouver les
    fiches. Un événement importé hors de ce périmètre n'est pas recalculé et
    compte à part, plutôt que d'être silencieusement ignoré.
    """
    par_evt = {str(uuid.uuid5(NS, "evt:" + r["uid"])): r for r in source}
    actuels = db.lire_tout("evenements_import?select=event_id,checked_at,evenements(type)")

    changements, hors_source, compte = [], 0, {}
    for row in actuels:
        e = row.get("evenements") or {}
        if row.get("checked_at") is not None or e.get("type") not in ("autre", "atelier"):
            continue
        r = par_evt.get(row["event_id"])
        if not r:
            hors_source += 1
            continue
        nouveau = guess_type(r.get("title_fr"), r.get("keywords_fr"),
                             r.get("firstdate_begin"), r.get("firstdate_end"))
        compte[nouveau] = compte.get(nouveau, 0) + 1
        if nouveau != e.get("type"):
            changements.append((row["event_id"], nouveau))

    if not essai:
        for eid, nouveau in changements:
            db._call("PATCH", f"evenements?id=eq.{eid}", {"type": nouveau},
                     headers={"Prefer": "return=minimal"})

    mode = "ESSAI, rien n'est écrit" if essai else "retypé en base"
    candidats = sum(compte.values())
    print(f"Retypage ({mode}) : {candidats} candidats (autre/atelier, non retouchés à la main), "
          f"{len(changements)} changent de type, {hors_source} hors de la source lue (non traités)")
    for code, n in sorted(compte.items(), key=lambda x: -x[1]):
        print(f"  {code} : {n}")


def rattacher_annuaire(db, mapping, existants, essai):
    """
    Rattache `annuaire_lieux.organization_id` a l'organisation issue de ce
    lieu OpenAgenda, pour les tiers-lieux de l'annuaire representes dans ce
    lot (import-openagenda.py --lieux <fichier issu du rapprochement>).

    Ne touche jamais une ligne deja rattachee : un rattachement existant peut
    venir d'une revendication ou d'un import precedent, on ne l'ecrase pas.
    `essai` compte sans rien ecrire, comme le reste du script.
    """
    if not mapping:
        return 0, 0
    candidats = [(str(uuid.uuid5(NS, "org:" + luid)), aid) for luid, aid in mapping.items()]
    candidats = [(oid, aid) for oid, aid in candidats if oid in existants]
    if not candidats:
        return 0, 0

    ids = sorted({aid for _, aid in candidats})
    libres = set()
    for i in range(0, len(ids), 200):
        clause = "id=in.(" + ",".join(ids[i:i + 200]) + ")"
        for row in db._call("GET", f"annuaire_lieux?select=id,organization_id&{clause}"):
            if row["organization_id"] is None:
                libres.add(row["id"])
    a_ecrire = [(oid, aid) for oid, aid in candidats if aid in libres]

    if not essai:
        for oid, aid in a_ecrire:
            db._call("PATCH", f"annuaire_lieux?id=eq.{aid}", {"organization_id": oid},
                     headers={"Prefer": "return=minimal"})
    return len(a_ecrire), len(candidats)


def main():
    ap = argparse.ArgumentParser(description="Import OpenAgenda -> Casa Minga")
    ap.add_argument("--departement", help="import par departement (exclusif de --lieux)")
    ap.add_argument("--lieux", help="fichier JSON de liste blanche de lieux (exclusif de --departement)")
    ap.add_argument("--depuis", help="date ISO de debut de fenetre, ex. 2026-10-01")
    ap.add_argument("--jusqu-a", dest="jusqua", help="date ISO de fin exclue, ex. 2027-01-01")
    ap.add_argument("--exclure", action="append", default=[],
                    help="titre d'agenda d'origine à écarter (répétable)")
    ap.add_argument("--max", type=int, default=50, help="événements nouveaux à importer")
    ap.add_argument("--essai", action="store_true", help="n'écrit rien")
    ap.add_argument("--reparer", action="store_true",
                    help="corrige les fiches déjà importées selon les règles actuelles, sans rien importer")
    ap.add_argument("--retyper", action="store_true",
                    help="recalcule le type des fiches autre/atelier déjà importées, sans rien importer")
    args = ap.parse_args()
    if bool(args.departement) == bool(args.lieux):
        ap.error("choisir soit --departement, soit --lieux")

    t0 = time.time()
    url, key = load_env()
    db = Base(url, key)

    source = (lire_lieux(args.lieux, args.depuis, args.jusqua) if args.lieux
              else lire_source(args.departement, args.exclure, args.depuis, args.jusqua))

    # Filtre defensif France Travail (voir FRANCE_TRAVAIL ci-dessus), applique
    # dans les deux modes : --exclure ne fonctionne qu'en --departement (clause
    # serveur), --lieux ne le lit pas encore cote requete.
    avant_ft = len(source)
    source = [r for r in source if not FRANCE_TRAVAIL.search(r.get("originagenda_title") or "")]
    ecarte_ft = avant_ft - len(source)

    if args.reparer:
        reparer(db, source, args.essai)
        print(f"Coût     : {db.octets / 1000:.1f} ko envoyés, {time.time() - t0:.1f} s, 0 token")
        return

    if args.retyper:
        retyper(db, source, args.essai)
        print(f"Coût     : {db.octets / 1000:.1f} ko envoyés, {time.time() - t0:.1f} s, 0 token")
        return

    # Lieux : attributs réunis sur TOUTES les fiches de la source, car un lieu
    # ne déclare son téléphone ou son adresse que sur certaines d'entre elles.
    lieux, ecartes = {}, 0
    for r in source:
        luid, nom = r.get("location_uid"), (r.get("location_name") or "").strip()
        if not luid or not nom or not r.get("firstdate_begin") or not r.get("firstdate_end"):
            ecartes += 1
            continue
        v = lieux.setdefault(luid, {
            "uid": luid, "name": texte(nom) or nom, "address": r.get("location_address"),
            "postal": r.get("location_postalcode"), "city": r.get("location_city"),
            "phone": None, "website": None, "email": None, "lat": None, "lng": None,
        })
        v["phone"] = v["phone"] or r.get("location_phone")
        v["website"] = v["website"] or r.get("location_website")
        coords = r.get("location_coordinates")
        if isinstance(coords, dict) and v["lat"] is None:
            v["lat"], v["lng"] = coords.get("lat"), coords.get("lon")
        for entry in as_list(r.get("registration")) or []:
            if entry.get("type") == "email" and not v["email"]:
                v["email"] = entry.get("value")

    # État de la base.
    org_rows = db.lire_tout("organizations?select=id,slug")
    org_slug = {o["id"]: o["slug"] for o in org_rows}
    slugs_pris = set(org_slug.values())
    orgs_avec_site = {s["organization_id"] for s in db.lire_tout("public_sites?select=organization_id")}
    etab_rows = db.lire_tout("establishments?select=id,organization_id")
    etab_ids = {e["id"] for e in etab_rows}
    orgs_avec_etab = {e["organization_id"] for e in etab_rows}
    deja = {i["event_id"] for i in db.lire_tout("evenements_import?select=event_id")}

    # Un lieu qui existe sous plusieurs identifiants OpenAgenda publie parfois
    # deux fois la meme seance, une fois par identifiant. Ramenes au meme lieu
    # canonique, ces enregistrements deviennent des doublons visibles. On garde
    # celui dont l'identifiant Casaminga vient en premier, regle stable d'une
    # execution a l'autre.
    candidats, vus = [], {}
    for r in source:
        if r.get("location_uid") not in lieux:
            continue
        cle = (r["location_uid"], (r.get("title_fr") or "").strip().lower(), r["firstdate_begin"])
        eid = str(uuid.uuid5(NS, "evt:" + r["uid"]))
        garde = vus.get(cle)
        if garde is None or eid < garde[0]:
            vus[cle] = (eid, r)
    candidats = [r for _, r in vus.values()]
    nouveaux = sorted(
        (r for r in candidats if str(uuid.uuid5(NS, "evt:" + r["uid"])) not in deja),
        key=lambda r: (r["firstdate_begin"], r["uid"]))
    lot = nouveaux[:args.max]

    # Lieux du lot : création, vitrine technique, établissement.
    orgs, sites, etabs = [], [], []
    etab_de = {}
    for luid in dict.fromkeys(r["location_uid"] for r in lot):
        v = lieux[luid]
        oid = str(uuid.uuid5(NS, "org:" + luid))
        eid = str(uuid.uuid5(NS, "est:" + luid))
        if oid in org_slug:
            slug = org_slug[oid]
        else:
            base = "import-" + slugify(v["name"])
            slug, n = base, 1
            while slug in slugs_pris:
                n += 1
                slug = f"{base}-{n}"
            slugs_pris.add(slug)
            orgs.append({
                "id": oid, "slug": slug, "name": v["name"][:120],
                "address": adresse(v["address"], v["postal"], v["city"]),
                "email": v["email"], "phone": v["phone"], "website": v["website"],
                "structure": "autre", "org_type": "autre",
                # Sans cette ligne, la valeur par défaut 'casaminga' ferait
                # passer le lieu pour un membre du réseau, dans l'annuaire.
                "source": SOURCE,
            })
        # La vitrine technique est indispensable : sans ligne `public_sites`
        # publiée, la RLS rend l'organisation invisible et les fiches perdent
        # le nom de leur lieu. Le site public, lui, ne l'affiche pas tant que
        # le lieu n'a pas revendiqué sa page.
        if oid not in orgs_avec_site:
            sites.append({"organization_id": oid, "slug": slug,
                          "title": v["name"][:120], "status": "publie"})
            orgs_avec_site.add(oid)
        if eid in etab_ids:
            etab_de[luid] = eid
        elif oid not in orgs_avec_etab:
            etabs.append({
                "id": eid, "organization_id": oid, "name": v["name"][:120], "slug": slug,
                "city": v["city"], "address": v["address"], "postal_code": v["postal"],
                "latitude": v["lat"], "longitude": v["lng"], "is_primary": True, "active": True,
            })
            etab_de[luid] = eid
            orgs_avec_etab.add(oid)
        else:
            etab_de[luid] = None

    # Rattachement annuaire_lieux.organization_id (uniquement si --lieux vient
    # du rapprochement avec l'annuaire, càd si le fichier porte "annuaire_id").
    # Calcul ici (ne lit que l'existant), écriture reportée après l'insertion
    # des organisations : sinon la contrainte de clé étrangère
    # annuaire_lieux_organization_id_fkey échoue en écriture réelle (corrigé
    # le 2026-09-28, prompt 2.3 : une organisation créée dans ce même lot
    # n'existe pas encore en base tant que db.inserer("organizations", ...)
    # n'a pas tourné).
    mapping_annuaire = lire_mapping_annuaire(args.lieux) if args.lieux else {}
    existants = set(org_slug) | {o["id"] for o in orgs}

    evenements, provenance = [], []
    for r in lot:
        eid = str(uuid.uuid5(NS, "evt:" + r["uid"]))
        conditions = texte(r.get("conditions_fr"))
        evenements.append({
            "id": eid,
            "organization_id": str(uuid.uuid5(NS, "org:" + r["location_uid"])),
            "establishment_id": etab_de.get(r["location_uid"]),
            "title": (texte(r.get("title_fr")) or "Événement")[:200],
            "type": guess_type(r.get("title_fr"), r.get("keywords_fr"),
                              r.get("firstdate_begin"), r.get("firstdate_end")),
            "status": "publie",
            "start_at": r["firstdate_begin"], "end_at": r["firstdate_end"],
            "description": corps_evenement(r),
            "price": 0 if conditions and FREE.match(conditions) else None,
            "photos": [r["image"]] if r.get("image") else [],
            "show_on_public_site": True,
            # Aucun humain n'a validé ces fiches : le portail doit pouvoir le savoir.
            "portal_status": "pending",
        })
        provenance.append({
            "event_id": eid, "source": SOURCE, "source_uid": r["uid"],
            "source_url": r.get("canonicalurl"), "conditions": conditions,
            "registration": as_list(r.get("registration")),
        })

    if not args.essai:
        db.inserer("organizations", orgs, "id")
        db.inserer("public_sites", sites, "organization_id")
        db.inserer("establishments", etabs, "id")
        db.inserer("evenements", evenements, "id")
        db.inserer("evenements_import", provenance, "event_id")

    # Rattachement annuaire, après que les organisations existent réellement.
    ecrits_annuaire, candidats_annuaire = rattacher_annuaire(db, mapping_annuaire, existants, args.essai)

    mode = "ESSAI, rien n'est écrit" if args.essai else "écrit en base"
    portee = args.departement or Path(args.lieux).name
    print(f"Source   : {len(source)} événements ({portee}), {ecartes} écartés faute de lieu ou de dates, "
          f"{ecarte_ft} écartés (agenda France Travail)")
    print(f"Base     : {len(candidats) - len(nouveaux)} déjà importés, {len(nouveaux)} nouveaux disponibles")
    print(f"Lot      : {len(lot)} événements, {len(orgs)} lieux créés, {len(sites)} vitrines techniques, {len(etabs)} établissements ({mode})")
    print(f"Reste    : {len(nouveaux) - len(lot)} événements après ce lot")
    if mapping_annuaire:
        verbe = "à rattacher (essai)" if args.essai else "rattachés"
        print(f"Annuaire : {ecrits_annuaire} organization_id {verbe} sur {candidats_annuaire} tiers-lieux représentés dans ce lot")
    print(f"Coût     : {db.octets / 1000:.1f} ko envoyés, {time.time() - t0:.1f} s, 0 token")


if __name__ == "__main__":
    main()
