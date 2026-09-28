# -*- coding: utf-8 -*-
"""
Moissonneur de sites de tiers-lieux (prompt 2.4, ANALYSE-SOURCES-EVENEMENTS.md
§ 4.B) : pour chaque tiers-lieu de l'annuaire ayant un site, essaie dans
l'ordre l'API The Events Calendar, un flux ICS, puis du JSON-LD schema.org, et
écrit les événements trouvés dans la base Casa Minga.

Pourquoi un script, et pas un modèle
------------------------------------
Les trois sources visées sont structurées (API JSON, ICS, JSON-LD) : un
mapping, pas une interprétation. « Importer avec le script, jamais par un
modèle » (CLAUDE.md, casaminga.com, § Données importées) s'applique ici comme
à import-openagenda.py.

Ce qu'il garantit
-----------------
- Rejouable sans doublon (uuid5, mêmes garanties que import-openagenda.py).
- Respect de robots.txt, un agent identifié, une requête par seconde et par
  domaine, un sondage qui se mémorise (annuaire_sites_sondes) pour ne pas
  redemander tous les 90 jours un site resté muet.
- Rien n'est deviné : un champ absent à la source reste absent en base.
- `portal_status = 'pending'` sur tout événement importé, jamais de mise en
  avant automatique.

Usage
-----
  python scripts/import-sites.py --essai --limite-sites 100
  python scripts/import-sites.py --limite-sites 100 --max 500
  python scripts/import-sites.py --departement "Hérault" --max 500
  python scripts/import-sites.py --max 2000   (sonde tout ce qui reste à faire)

La clé de service est lue dans .env.local et n'est jamais affichée.
"""

import argparse
import json
import re
import socket
import ssl
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone

sys.stdout.reconfigure(encoding="utf-8")

# Le magasin de certificats système de cette machine contient au moins une
# autorité expirée : `ssl.create_default_context()` sans argument rejette des
# sites dont le certificat est en réalité valide (vérifié le 2026-09-28 avec
# curl sur piscinedenface.fr : expire le 2026-11-25, accepté par curl, rejeté
# par Python). Le paquet `certifi`, à jour, sert de magasin de référence pour
# TOUTES les requêtes HTTPS du script : sans ce correctif, l'essai à 100 sites
# comptait 51 erreurs, dont la majorité de faux « certificat expiré ».
try:
    import certifi
    _CTX_HTTPS = ssl.create_default_context(cafile=certifi.where())
    urllib.request.install_opener(urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=_CTX_HTTPS)))
except ImportError:
    pass  # certifi absent : on retombe sur le magasin système, moins fiable

from import_commun import (  # noqa: E402  (après le reconfigure ci-dessus)
    NS, Base, FREE, adresse, couper, duree_jours, est_exclusion_recrutement,
    guess_type, load_env, slugify, texte, titre_normalise,
)

USER_AGENT = "CasamingaBot/1.0 (+https://casaminga.com/contact)"
TIMEOUT = 12  # secondes ; sert aussi de "délai de politesse" de la consigne
MAX_BYTES = 1_000_000
PAGES_AGENDA = ["", "/agenda", "/evenements", "/events", "/programme"]
MAX_PARALLELE_DOMAINES = 8
RESONDE_APRES_JOURS = 90
FENETRE_MOIS = 12

DTSTAMP = re.compile(r"^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$")


# ── Politesse réseau ─────────────────────────────────────────────

class Politesse:
    """Un verrou et une horloge de dernière requête par domaine : au plus une
    requête par seconde vers un même domaine, même si plusieurs sites de ce
    domaine sont traités par des fils différents (rare, mais un même CMS
    mutualisé peut héberger deux tiers-lieux sous des sous-domaines distincts,
    qui ne comptent donc pas comme le même domaine ici : `domaine` est déjà
    l'hôte complet, pas le domaine racine)."""

    def __init__(self):
        self._verrous = {}
        self._dernier = {}
        self._garde = threading.Lock()
        self._robots = {}

    def _verrou(self, domaine):
        with self._garde:
            return self._verrous.setdefault(domaine, threading.Lock())

    def attendre(self, domaine):
        verrou = self._verrou(domaine)
        with verrou:
            dernier = self._dernier.get(domaine, 0)
            attente = 1.0 - (time.monotonic() - dernier)
            if attente > 0:
                time.sleep(attente)
            self._dernier[domaine] = time.monotonic()

    def robots_pour(self, domaine, schema):
        with self._garde:
            if domaine in self._robots:
                return self._robots[domaine]
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(f"{schema}://{domaine}/robots.txt")
        try:
            req = urllib.request.Request(
                f"{schema}://{domaine}/robots.txt", headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                rp.parse(r.read().decode("utf-8", "replace").splitlines())
        except Exception:
            rp = None  # pas de robots.txt lisible : ni autorisation ni interdiction ; on continue
        with self._garde:
            self._robots[domaine] = rp
        return rp

    def autorise(self, url, domaine, schema):
        rp = self.robots_pour(domaine, schema)
        if rp is None:
            return True
        try:
            return rp.can_fetch(USER_AGENT, url)
        except Exception:
            return True


POLITESSE = Politesse()


def domaine_de(url):
    """Hôte d'une URL. Une adresse mal formée dans l'annuaire (crochet isolé,
    IPv6 tronqué) faisait échouer `urlsplit` en pleine écriture de lot
    (constaté le 2026-09-28, lot 6, après que les événements du lot avaient
    déjà été écrits) : on retombe alors sur l'URL telle quelle plutôt que de
    perdre le rattachement de tout le lot pour une seule adresse illisible."""
    try:
        return urllib.parse.urlsplit(url).netloc.lower()
    except ValueError:
        return (url or "").lower()


META_CHARSET = re.compile(
    rb'<meta[^>]+charset=["\']?\s*([a-zA-Z0-9_-]+)', re.I)


def decoder_octets(raw, charset_entete):
    """Décodage robuste : beaucoup de sites de tiers-lieux ne déclarent pas
    d'encodage dans l'en-tête HTTP (charset_entete est alors None), ou publient
    encore en Windows-1252/Latin-1. Décoder en UTF-8 par défaut y a produit,
    en écriture réelle le 2026-09-28, des « � » à la place de chaque caractère
    accentué (le titre et la description restaient lisibles pour un mot sur
    deux). Ordre d'essai : l'en-tête HTTP, puis un <meta charset> dans les
    premiers octets, puis UTF-8 strict, puis Windows-1252 (n'échoue jamais,
    quitte à mal lire de vrais caractères multioctets, ce qui reste préférable
    à un « � » par lettre accentuée)."""
    for enc in (charset_entete, _meta_charset(raw)):
        if not enc:
            continue
        try:
            return raw.decode(enc)
        except (LookupError, UnicodeDecodeError):
            pass
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp1252", "replace")


def _meta_charset(raw):
    m = META_CHARSET.search(raw[:4096])
    return m.group(1).decode("ascii", "ignore") if m else None


def get(url, accept=None):
    """GET poli : robots.txt, une requête/seconde/domaine, 1 Mo max, User-Agent
    explicite. Retourne (texte_ou_none, code_ou_exception)."""
    domaine = domaine_de(url)
    schema = urllib.parse.urlsplit(url).scheme or "https"
    if not POLITESSE.autorise(url, domaine, schema):
        return None, "robots.txt"
    POLITESSE.attendre(domaine)
    headers = {"User-Agent": USER_AGENT}
    if accept:
        headers["Accept"] = accept
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            raw = r.read(MAX_BYTES)
            return decoder_octets(raw, r.headers.get_content_charset()), r.status
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}"
    except (urllib.error.URLError, socket.timeout, TimeoutError) as e:
        return None, f"réseau : {e}"
    except Exception as e:  # défensif : un site mal formé ne doit pas arrêter le lot
        return None, f"erreur : {e}"


def normaliser_url(site):
    """« https://HTTPS://exemple.fr » -> « https://exemple.fr » ; un site sans
    protocole ('exemple.fr', 'www.exemple.fr') reçoit https://."""
    s = (site or "").strip()
    if not s:
        return None
    s = re.sub(r"^(https?://)+(?=https?://)", "", s, flags=re.I)  # protocole doublé
    s = re.sub(r"^(https?)://https?://", r"\1://", s, flags=re.I)
    if not re.match(r"^https?://", s, re.I):
        s = "https://" + s
    return s.rstrip("/")


# ── Fenêtre temporelle ───────────────────────────────────────────

MAINTENANT = datetime.now(timezone.utc)
BORNE_HAUTE = MAINTENANT + timedelta(days=365)


def a_venir_dans_la_fenetre(iso):
    if not iso:
        return False
    try:
        d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
    except ValueError:
        return False
    return MAINTENANT <= d <= BORNE_HAUTE


# ── The Events Calendar (API REST JSON) ─────────────────────────

def essai_tribe(base):
    url = f"{base}/wp-json/tribe/events/v1/events?start_date=now&per_page=50"
    body, code = get(url, accept="application/json")
    if not body:
        return None, code
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return None, "JSON illisible"
    events = data.get("events")
    if not isinstance(events, list):
        return None, "pas un agenda The Events Calendar"

    rows = []
    for e in events:
        rows.append({
            "uid": str(e.get("id") or e.get("url") or e.get("title")),
            "title": e.get("title"),
            "description": e.get("description") or e.get("excerpt"),
            "start": e.get("start_date"),  # "2026-10-15 19:00:00", heure locale du site
            "end": e.get("end_date"),
            "url": e.get("url"),
            "image": (e.get("image") or {}).get("url") if isinstance(e.get("image"), dict) else None,
            "cost": e.get("cost"),
            "lieu": ((e.get("venue") or {}).get("venue")),
        })
    # "start_date" de Tribe n'a pas de fuseau explicite : on l'interprète comme
    # heure locale de Paris, convertie en UTC par une règle DST simplifiée
    # (dernier dimanche de mars à fin octobre = +02:00, sinon +01:00).
    for r in rows:
        r["start_iso"] = heure_locale_paris_vers_iso(r["start"])
        r["end_iso"] = heure_locale_paris_vers_iso(r["end"])
    return rows, None


def heure_locale_paris_vers_iso(valeur):
    """'2026-10-15 19:00:00' (heure de Paris, sans fuseau) -> ISO UTC.
    Règle DST simplifiée (dernier dimanche de mars/octobre) : suffisante ici,
    l'écart d'une heure ne change jamais le jour d'un événement du soir."""
    if not valeur:
        return None
    try:
        naive = datetime.strptime(valeur[:19], "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None
    ete = _heure_ete(naive.year)
    offset = timedelta(hours=2) if ete[0] <= naive.replace(tzinfo=None) < ete[1] else timedelta(hours=1)
    return (naive - offset).replace(tzinfo=timezone.utc).isoformat()


def _dernier_dimanche(annee, mois):
    d = date(annee, mois, 1)
    d = date(annee, mois + 1, 1) - timedelta(days=1) if mois < 12 else date(annee, 12, 31)
    while d.weekday() != 6:
        d -= timedelta(days=1)
    return d


def _heure_ete(annee):
    debut = datetime.combine(_dernier_dimanche(annee, 3), datetime.min.time()) + timedelta(hours=2)
    fin = datetime.combine(_dernier_dimanche(annee, 10), datetime.min.time()) + timedelta(hours=1)
    return debut, fin


# ── ICS ──────────────────────────────────────────────────────────

LIEN_ICS = re.compile(
    r'href=["\']([^"\']+?(?:\.ics(?:[?#][^"\']*)?|[?&]ical=1[^"\']*))["\']', re.I)
LIEN_WEBCAL = re.compile(r'["\'](webcal://[^"\']+)["\']', re.I)


def trouver_flux_ics(pages_html, base_url):
    for html_txt, url_page in pages_html:
        if not html_txt:
            continue
        for motif in (LIEN_ICS, LIEN_WEBCAL):
            m = motif.search(html_txt)
            if m:
                lien = m.group(1)
                if lien.startswith("webcal://"):
                    lien = "https://" + lien[len("webcal://"):]
                return urllib.parse.urljoin(url_page, lien)
    return None


def parse_ics(texte_ics):
    """Parse les VEVENT d'un flux ICS. Ne développe pas les RRULE : ne prend
    que les occurrences explicites (DTSTART/DTEND d'un VEVENT donné), comme
    demandé. Un VEVENT porteur d'une RRULE est donc gardé pour sa première
    occurrence déclarée, pas pour ses répétitions."""
    # Dépliage des lignes continuées (RFC 5545 : une ligne qui commence par un
    # espace ou une tabulation est la suite de la précédente).
    lignes = []
    for ligne in texte_ics.splitlines():
        if ligne.startswith((" ", "\t")) and lignes:
            lignes[-1] += ligne[1:]
        else:
            lignes.append(ligne)

    evenements, courant = [], None
    for ligne in lignes:
        if ligne.strip() == "BEGIN:VEVENT":
            courant = {}
        elif ligne.strip() == "END:VEVENT":
            if courant is not None:
                evenements.append(courant)
            courant = None
        elif courant is not None and ":" in ligne:
            cle, _, valeur = ligne.partition(":")
            nom = cle.split(";")[0].upper()
            params = dict(p.split("=", 1) for p in cle.split(";")[1:] if "=" in p)
            if nom in ("DTSTART", "DTEND"):
                courant[nom] = ics_date_vers_iso(valeur.strip(), params)
            elif nom == "SUMMARY":
                courant["SUMMARY"] = decode_ics_texte(valeur)
            elif nom == "DESCRIPTION":
                courant["DESCRIPTION"] = decode_ics_texte(valeur)
            elif nom == "LOCATION":
                courant["LOCATION"] = decode_ics_texte(valeur)
            elif nom == "URL":
                courant["URL"] = valeur.strip()
            elif nom == "UID":
                courant["UID"] = valeur.strip()
    return evenements


def decode_ics_texte(v):
    return (v.replace("\\n", "\n").replace("\\N", "\n")
             .replace("\\,", ",").replace("\\;", ";").replace("\\\\", "\\").strip())


def ics_date_vers_iso(valeur, params):
    """DTSTART/DTEND ICS -> ISO UTC. Gère VALUE=DATE (jour seul, événement
    « toute la journée ») et TZID (converti comme Tribe, règle DST simplifiée ;
    seul Europe/Paris est visé, les tiers-lieux hors métropole sont une
    minorité et une conversion fausse d'une heure ne change pas le jour)."""
    m = DTSTAMP.match(valeur)
    if not m:
        return None
    an, mo, jo, h, mi, s = m.groups()
    if h is None:  # VALUE=DATE : jour seul
        return f"{an}-{mo}-{jo}T00:00:00+00:00"
    if valeur.endswith("Z"):
        return f"{an}-{mo}-{jo}T{h}:{mi}:{s}+00:00"
    if "TZID" in params:
        return heure_locale_paris_vers_iso(f"{an}-{mo}-{jo} {h}:{mi}:{s}")
    return f"{an}-{mo}-{jo}T{h}:{mi}:{s}+00:00"


# ── JSON-LD schema.org ───────────────────────────────────────────

SCRIPT_LD = re.compile(
    r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.I | re.S)


def _aplatir_ld(objet):
    """Un JSON-LD peut être un objet, une liste, ou un @graph : on ramène tout
    à une liste plate d'objets à inspecter."""
    if isinstance(objet, list):
        for o in objet:
            yield from _aplatir_ld(o)
    elif isinstance(objet, dict):
        if "@graph" in objet:
            yield from _aplatir_ld(objet["@graph"])
        else:
            yield objet


def trouver_events_jsonld(html_txt, url_page):
    events = []
    for bloc in SCRIPT_LD.findall(html_txt or ""):
        try:
            data = json.loads(bloc.strip())
        except json.JSONDecodeError:
            continue
        for obj in _aplatir_ld(data):
            type_ = obj.get("@type")
            types = type_ if isinstance(type_, list) else [type_]
            if "Event" not in (types or []):
                continue
            loc = obj.get("location") or {}
            if isinstance(loc, list):
                loc = loc[0] if loc else {}
            adresse_loc = loc.get("address") if isinstance(loc, dict) else None
            if isinstance(adresse_loc, dict):
                adresse_loc = ", ".join(
                    x for x in [adresse_loc.get("streetAddress"),
                                adresse_loc.get("postalCode"),
                                adresse_loc.get("addressLocality")] if x)
            offres = obj.get("offers")
            if isinstance(offres, list):
                offres = offres[0] if offres else {}
            gratuit = None
            if isinstance(offres, dict):
                prix = offres.get("price")
                if prix in (0, "0", "0.0", "0.00"):
                    gratuit = True
            events.append({
                "uid": obj.get("url") or obj.get("@id") or obj.get("name"),
                "title": obj.get("name"),
                "description": obj.get("description"),
                "start_iso": _iso_ou_none(obj.get("startDate")),
                "end_iso": _iso_ou_none(obj.get("endDate")),
                "url": obj.get("url") or url_page,
                "image": obj.get("image") if isinstance(obj.get("image"), str) else
                         (obj.get("image") or [None])[0] if isinstance(obj.get("image"), list) else None,
                "lieu": loc.get("name") if isinstance(loc, dict) else None,
                "adresse": adresse_loc,
                "gratuit": gratuit,
            })
    return events


DATE_LD = re.compile(
    r"^(\d{4})-(\d{1,2})-(\d{1,2})"
    r"(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?"
    r"(Z|([+-])(\d{1,2}):?(\d{2})?)?$")


def _iso_ou_none(v):
    """`startDate`/`endDate` JSON-LD ne sont pas toujours une ISO 8601 stricte.
    Constaté le 2026-09-28 sur maisondelaconversation.org (6 des 44 événements
    du premier essai à 100 sites, 13,6 %, au-delà du seuil de 10 % fixé pour ce
    prompt) : mois et jour non complétés à deux chiffres, fuseau à un chiffre
    (« 2026-9-2T16:45+2:00 » au lieu de « 2026-09-02T16:45:00+02:00 »).
    `datetime.fromisoformat` rejette cette forme même en Python 3.14. On
    complète les composants à la main avant de reconstruire une date propre,
    plutôt que de perdre l'événement."""
    if not v:
        return None
    m = DATE_LD.match(v.strip())
    if not m:
        return None
    an, mo, jo, h, mi, s, tz, signe, tz_h, tz_mi = m.groups()
    h, mi, s = h or "00", mi or "00", s or "00"
    if not tz or tz == "Z":
        offset = "+00:00"
    else:
        offset = f"{signe}{int(tz_h):02d}:{tz_mi or '00'}"
    iso = f"{an}-{int(mo):02d}-{int(jo):02d}T{int(h):02d}:{int(mi):02d}:{int(s):02d}{offset}"
    try:
        d = datetime.fromisoformat(iso)
        return d.astimezone(timezone.utc).isoformat()
    except ValueError:
        return None


# ── Sondage d'un site ────────────────────────────────────────────

def sonder_site(lieu):
    """Essaie tribe, puis ICS, puis JSON-LD sur un site. Retourne
    (signal, url_flux, evenements_normalises, erreur)."""
    base = lieu["site_web"]

    # (a) The Events Calendar
    rows, err = essai_tribe(base)
    if rows is not None:
        evs = [{
            "uid": r["uid"], "title": r["title"], "description": r["description"],
            "start_iso": r["start_iso"], "end_iso": r["end_iso"], "url": r["url"],
            "image": r["image"], "gratuit": _cost_gratuit(r["cost"]), "adresse": None,
        } for r in rows]
        return "tribe", f"{base}/wp-json/tribe/events/v1/events", evs, None

    # Pages où chercher un flux ICS ou du JSON-LD.
    pages_html = []
    derniere_erreur = err
    for chemin in PAGES_AGENDA:
        html_txt, code = get(base + chemin)
        pages_html.append((html_txt, base + chemin))
        if html_txt:
            derniere_erreur = None
        elif code and derniere_erreur is None:
            derniere_erreur = code

    # (b) ICS
    flux = trouver_flux_ics(pages_html, base)
    if flux:
        contenu, code = get(flux, accept="text/calendar")
        if contenu and "BEGIN:VCALENDAR" in contenu:
            bruts = parse_ics(contenu)
            evs = [{
                "uid": b.get("UID") or b.get("SUMMARY"), "title": b.get("SUMMARY"),
                "description": b.get("DESCRIPTION"), "start_iso": b.get("DTSTART"),
                "end_iso": b.get("DTEND"), "url": b.get("URL"), "image": None,
                "gratuit": None, "adresse": b.get("LOCATION"),
            } for b in bruts]
            return "ics", flux, evs, None

    # (c) JSON-LD
    for html_txt, url_page in pages_html:
        if not html_txt:
            continue
        evs = trouver_events_jsonld(html_txt, url_page)
        if evs:
            return "jsonld", url_page, evs, None

    if all(h is None for h, _ in pages_html) and rows is None:
        return "erreur", None, [], derniere_erreur or "aucune page jointe"
    return "aucun", None, [], None


def normaliser_fin(debut_iso, fin_iso):
    """`evenements` porte une contrainte stricte `end_at > start_at` (constatée
    en écriture réelle le 2026-09-28, absente d'import-openagenda.py parce
    qu'OpenAgenda fournit toujours les deux dates distinctes). Beaucoup de
    sites ici ne donnent qu'une heure de début (Tribe sans end_date, ICS sans
    DTEND, JSON-LD sans endDate) : on marque alors une durée d'une heure par
    défaut plutôt que d'échouer l'insertion ou d'inventer une vraie durée."""
    d = datetime.fromisoformat(debut_iso)
    try:
        f = datetime.fromisoformat(fin_iso) if fin_iso else None
    except ValueError:
        f = None
    if f is None or f <= d:
        f = d + timedelta(hours=1)
    return f.isoformat()


def _cost_gratuit(cost):
    if not cost:
        return None
    return bool(FREE.match(str(cost).strip()))


# ── Base : lecture de l'état, écriture ───────────────────────────

def charger_candidats(db, departement, limite_sites, depart=0):
    clause = "masque=eq.false&site_web=not.is.null"
    if departement:
        clause += f"&departement=eq.{urllib.parse.quote(departement)}"
    lieux = db.lire_tout(
        "annuaire_lieux?select=id,nom,site_web,organization_id,adresse,commune,"
        f"code_postal,departement,latitude,longitude&{clause}&order=id")
    lieux = [l for l in lieux if (l.get("site_web") or "").strip()]
    for l in lieux:
        l["site_web"] = normaliser_url(l["site_web"])
    if depart:
        lieux = lieux[depart:]
    if limite_sites:
        lieux = lieux[:limite_sites]
    return lieux


def filtrer_deja_sondes(db, lieux):
    sondes = db.lire_tout("annuaire_sites_sondes?select=annuaire_id,sonde_le,signal")
    par_id = {s["annuaire_id"]: s for s in sondes}
    seuil = datetime.now(timezone.utc) - timedelta(days=RESONDE_APRES_JOURS)
    retenus, ignores = [], 0
    for l in lieux:
        s = par_id.get(l["id"])
        if s and s["signal"] == "aucun":
            try:
                sonde_le = datetime.fromisoformat(s["sonde_le"].replace("Z", "+00:00"))
            except ValueError:
                sonde_le = None
            if sonde_le and sonde_le > seuil:
                ignores += 1
                continue
        retenus.append(l)
    return retenus, ignores


# ── Écriture des événements ──────────────────────────────────────

def org_id_pour(luid_site):
    return str(uuid.uuid5(NS, "org:site:" + luid_site))


def evt_id_pour(domaine, uid_source):
    return str(uuid.uuid5(NS, f"evt:site:{domaine}:{uid_source}"))


def preparer_organisation(lieu, domaine, orgs_existantes, sites_existants, slugs_pris,
                          etab_de_org, orgs_a_creer, sites_a_creer, etabs_a_creer):
    """Renvoie (organization_id, establishment_id) à utiliser pour les
    événements de ce lieu, en préparant les lignes à insérer si besoin. Ne
    touche jamais un tiers-lieu déjà rattaché à une organisation existante :
    on réutilise cette organisation et son établissement principal.

    `slugs_pris` est mutable et partagé entre tous les appels d'un même
    passage : deux tiers-lieux distincts portant le même nom (« La Base »
    existe plusieurs fois dans l'annuaire nationale) donneraient sinon le même
    slug « import-la-base » et l'insertion échouerait sur la contrainte
    d'unicité (constaté en écriture réelle le 2026-09-28, lot 5, comme
    import-openagenda.py le prévoyait déjà pour son propre périmètre)."""
    if lieu.get("organization_id") and lieu["organization_id"] in orgs_existantes:
        oid = lieu["organization_id"]
        eid = etab_de_org.get(oid)
        return oid, eid

    oid = org_id_pour(domaine)
    if oid in orgs_existantes or any(o["id"] == oid for o in orgs_a_creer):
        eid = etab_de_org.get(oid) or next(
            (e["id"] for e in etabs_a_creer if e["organization_id"] == oid), None)
        return oid, eid

    base = "import-" + slugify(lieu["nom"])
    slug, n = base, 1
    while slug in slugs_pris:
        n += 1
        slug = f"{base}-{n}"
    slugs_pris.add(slug)
    orgs_a_creer.append({
        "id": oid, "slug": slug, "name": (lieu["nom"] or domaine)[:120],
        "address": adresse(lieu.get("adresse"), lieu.get("code_postal"), lieu.get("commune")),
        "website": lieu["site_web"], "structure": "autre", "org_type": "autre",
        "source": "site",
    })
    if oid not in sites_existants:
        sites_a_creer.append({"organization_id": oid, "slug": slug,
                              "title": (lieu["nom"] or domaine)[:120], "status": "publie"})
    eid = str(uuid.uuid5(NS, "est:site:" + domaine))
    etabs_a_creer.append({
        "id": eid, "organization_id": oid, "name": (lieu["nom"] or domaine)[:120], "slug": slug,
        "city": lieu.get("commune"), "address": lieu.get("adresse"),
        "postal_code": lieu.get("code_postal"),
        "latitude": lieu.get("latitude"), "longitude": lieu.get("longitude"),
        "is_primary": True, "active": True,
    })
    etab_de_org[oid] = eid
    return oid, eid


def main():
    ap = argparse.ArgumentParser(description="Moissonneur de sites -> Casa Minga")
    ap.add_argument("--essai", action="store_true", help="n'écrit rien (ni sondage, ni événement)")
    ap.add_argument("--max", type=int, default=500, help="événements nouveaux à importer")
    ap.add_argument("--limite-sites", type=int, default=0, dest="limite_sites",
                    help="nombre de tiers-lieux à sonder au maximum (0 = tous)")
    ap.add_argument("--depart", type=int, default=0,
                    help="index de départ dans l'annuaire (ordre stable par id), pour traiter par lots")
    ap.add_argument("--departement", help="ne sonder que ce département de l'annuaire")
    args = ap.parse_args()

    t0 = time.time()
    url, key = load_env()
    db = Base(url, key)

    candidats = charger_candidats(db, args.departement, 0, args.depart)
    a_sonder, ignores_recents = filtrer_deja_sondes(db, candidats)
    if args.limite_sites:
        a_sonder = a_sonder[:args.limite_sites]

    print(f"Annuaire : {len(candidats)} tiers-lieux avec site (non masqués), "
          f"{ignores_recents} ignorés (sondés il y a moins de {RESONDE_APRES_JOURS} j, sans signal)")
    print(f"Sondage  : {len(a_sonder)} sites à essayer")

    resultats = {}
    with ThreadPoolExecutor(max_workers=MAX_PARALLELE_DOMAINES) as pool:
        futures = {pool.submit(sonder_site, l): l for l in a_sonder}
        fait = 0
        for fut in as_completed(futures):
            lieu = futures[fut]
            fait += 1
            try:
                signal, url_flux, evs, erreur = fut.result()
            except Exception as e:  # un site imprévisible ne doit pas arrêter le lot
                signal, url_flux, evs, erreur = "erreur", None, [], f"exception : {e}"
            resultats[lieu["id"]] = (signal, url_flux, evs, erreur)
            if fait % 100 == 0 or fait == len(a_sonder):
                print(f"  ... {fait}/{len(a_sonder)} sites sondés")

    par_signal = {}
    for (signal, *_r) in resultats.values():
        par_signal[signal] = par_signal.get(signal, 0) + 1

    # ── Écriture du sondage ──────────────────────────────────────
    sondes_rows = []
    for lieu in a_sonder:
        signal, url_flux, evs, erreur = resultats[lieu["id"]]
        sondes_rows.append({
            "annuaire_id": lieu["id"], "site_web": lieu["site_web"], "signal": signal,
            "url_flux": url_flux, "nb_evenements": len(evs), "erreur": erreur,
        })
    if not args.essai and sondes_rows:
        db.upsert("annuaire_sites_sondes", sondes_rows, "annuaire_id")

    # ── État de la base pour l'écriture des événements ───────────
    org_rows = db.lire_tout("organizations?select=id,slug,source")
    orgs_existantes = {o["id"] for o in org_rows}
    slugs_pris = {o["slug"] for o in org_rows}
    sites_existants = {s["organization_id"] for s in db.lire_tout("public_sites?select=organization_id")}
    etab_rows = db.lire_tout("establishments?select=id,organization_id,is_primary")
    etab_de_org = {}
    for e in etab_rows:
        if e["organization_id"] not in etab_de_org or e["is_primary"]:
            etab_de_org[e["organization_id"]] = e["id"]
    deja_importes = {i["event_id"] for i in db.lire_tout("evenements_import?select=event_id")}

    # Anti-doublon avec OpenAgenda (et avec un import-sites précédent) : par
    # organisation, jour et titre normalisé, en incluant "l'un contient l'autre".
    existants_par_org = {}
    for row in db.lire_tout("evenements?select=id,organization_id,title,start_at"):
        try:
            jour = row["start_at"][:10]
        except (TypeError, KeyError):
            continue
        existants_par_org.setdefault(row["organization_id"], []).append(
            (jour, titre_normalise(row["title"])))

    def est_doublon(oid, jour, titre_norm):
        for j, t in existants_par_org.get(oid, []):
            if j == jour and t and titre_norm and (t in titre_norm or titre_norm in t):
                return True
        return False

    orgs_a_creer, sites_a_creer, etabs_a_creer = [], [], []
    evenements, provenance = [], []
    masques_exclusion = []
    doublons_ecartes = 0
    hors_fenetre = 0
    sans_titre_ou_date = 0

    for lieu in a_sonder:
        signal, url_flux, evs, erreur = resultats[lieu["id"]]
        if signal in ("aucun", "erreur") or not evs:
            continue
        domaine = domaine_de(lieu["site_web"])
        oid, eid = preparer_organisation(
            lieu, domaine, orgs_existantes, sites_existants, slugs_pris,
            etab_de_org, orgs_a_creer, sites_a_creer, etabs_a_creer)

        for r in evs:
            titre = texte(r.get("title"))
            if not titre or not r.get("start_iso") or not a_venir_dans_la_fenetre(r["start_iso"]):
                if titre and r.get("start_iso"):
                    hors_fenetre += 1
                else:
                    sans_titre_ou_date += 1
                continue

            source_uid = str(r.get("uid") or r.get("url") or titre)
            evid = evt_id_pour(domaine, source_uid)
            if evid in deja_importes:
                continue

            jour = r["start_iso"][:10]
            titre_norm = titre_normalise(titre)
            if est_doublon(oid, jour, titre_norm):
                doublons_ecartes += 1
                continue

            exclu = est_exclusion_recrutement(titre)
            if exclu:
                masques_exclusion.append((titre, lieu["nom"]))

            image = r.get("image")
            photos = [image] if image and re.match(r"^https?://", image) else []
            description = couper(texte(r.get("description")))
            end_iso = normaliser_fin(r["start_iso"], r.get("end_iso"))

            evenements.append({
                "id": evid, "organization_id": oid, "establishment_id": eid,
                "title": titre[:200],
                "type": guess_type(titre, None, r["start_iso"], end_iso),
                "status": "publie",
                "start_at": r["start_iso"], "end_at": end_iso,
                "description": description,
                "price": 0 if r.get("gratuit") else None,
                "photos": photos,
                "show_on_public_site": not exclu,
                "portal_status": "pending",
            })
            provenance.append({
                "event_id": evid, "source": f"site:{domaine}", "source_uid": source_uid,
                "source_url": r.get("url") or lieu["site_web"], "conditions": None,
                "registration": None,
            })
            # Un événement compte une seule fois pour l'anti-doublon suivant.
            existants_par_org.setdefault(oid, []).append((jour, titre_norm))

    lot_evenements = evenements[:args.max]
    ids_lot = {e["id"] for e in lot_evenements}
    lot_provenance = [p for p in provenance if p["event_id"] in ids_lot]
    orgs_du_lot = {e["organization_id"] for e in lot_evenements}
    orgs_a_creer_lot = [o for o in orgs_a_creer if o["id"] in orgs_du_lot]
    sites_a_creer_lot = [s for s in sites_a_creer if s["organization_id"] in orgs_du_lot]
    etabs_a_creer_lot = [e for e in etabs_a_creer if e["organization_id"] in orgs_du_lot]

    if not args.essai:
        db.inserer("organizations", orgs_a_creer_lot, "id")
        db.inserer("public_sites", sites_a_creer_lot, "organization_id")
        db.inserer("establishments", etabs_a_creer_lot, "id")
        db.inserer("evenements", lot_evenements, "id")
        db.inserer("evenements_import", lot_provenance, "event_id")

        # Rattachement annuaire_lieux.organization_id, après l'insertion des
        # organisations (même bug de clé étrangère corrigé au 2.3 : une
        # organisation créée dans ce lot n'existe pas encore avant l'insertion
        # ci-dessus).
        # `orgs_du_lot` seul manque les organisations créées lors d'un lot
        # précédent interrompu avant sa propre étape de rattachement (constaté
        # le 2026-09-28, lot 6 : une organisation déjà en base, dont aucun
        # événement ne repasse dans CE lot à cause de la déduplication, ne
        # devait pas pour autant rester sans rattachement) : `orgs_existantes`
        # couvre aussi ce cas, chargé avant les insertions de ce lot.
        cibles = orgs_du_lot | orgs_existantes
        rattachements = [(l["id"], org_id_pour(domaine_de(l["site_web"])))
                         for l in a_sonder
                         if not l.get("organization_id")
                         and org_id_pour(domaine_de(l["site_web"])) in cibles]
        for aid, oid in rattachements:
            db._call("PATCH", f"annuaire_lieux?id=eq.{aid}", {"organization_id": oid},
                     headers={"Prefer": "return=minimal"})

    mode = "ESSAI, rien n'est écrit" if args.essai else "écrit en base"
    print(f"\nSignal   : " + ", ".join(f"{k}={v}" for k, v in sorted(par_signal.items())))
    print(f"Candidats: {len(evenements)} événements retenus (à venir, {FENETRE_MOIS} mois, titre et date valides)")
    print(f"Écartés  : {sans_titre_ou_date} sans titre/date valide, {hors_fenetre} hors fenêtre, "
          f"{doublons_ecartes} doublons (même organisation, même jour, titre proche)")
    print(f"Masqués  : {len(masques_exclusion)} par exclusion de contenu (recrutement/commercial), non supprimés")
    for titre, nom in masques_exclusion[:10]:
        print(f"  - « {titre} » ({nom})")
    par_type = {}
    for e in lot_evenements:
        par_type[e["type"]] = par_type.get(e["type"], 0) + 1
    print(f"Lot      : {len(lot_evenements)} événements ({mode}), {len(orgs_a_creer_lot)} lieux créés")
    for k, v in sorted(par_type.items(), key=lambda x: -x[1]):
        print(f"  {k} : {v}")
    print(f"Reste    : {len(evenements) - len(lot_evenements)} événements après ce lot")
    print(f"Coût     : {db.octets / 1000:.1f} ko envoyés, {time.time() - t0:.1f} s, 0 token")


if __name__ == "__main__":
    main()
