# -*- coding: utf-8 -*-
"""
Lecture par modèle, temps (a) : préparer les paquets (S9 / S20 étage 2, D10).

Pour une liste de sites d'associations (CSV de l'annuaire communal), ce script
trouve la ou les pages d'agenda (liens de l'accueil contenant agenda,
programme, événements, actualités, ateliers, dates...), les télécharge
poliment (robots.txt, une requête par seconde et par domaine, agent
identifié : R11), en extrait le texte utile (sans menus ni pieds de page,
12 000 caractères au plus par page, dates, heures et liens absolus gardés,
courriels et téléphones masqués : R13) et écrit des paquets JSON de 10 sites
dans `08 Import evenements/Mesures/lecture/paquet-NN.json`.

Il n'écrit RIEN en base. Il lit seulement, si `.env.local` est présent, la
mémoire du moissonneur (`annuaire_sites_sondes`, jointe à `annuaire_lieux`
par domaine) pour ne pas retester un site déjà connu comme mort ou déjà
lisible par le moissonneur structuré (étage 1).

Aucun modèle n'est appelé ici : les paquets sont lus ensuite par des
sous-agents Haiku du forfait (D3), selon la consigne
`08 Import evenements/Mesures/lecture/CONSIGNE-HAIKU.md`. Conception :
`08 Import evenements/Conception/S9-lecture-par-modele.md`.

Usage
-----
  python scripts/preparer-lecture.py                      (100 sites de Montpellier)
  python scripts/preparer-lecture.py --nombre 20 --sortie <dossier>
  python scripts/preparer-lecture.py --csv scripts/data/annuaire-autre.csv --commune Sète
  python scripts/preparer-lecture.py --sans-memoire       (ne lit pas la base)
"""

import argparse
import csv
import hashlib
import importlib.util
import json
import random
import re
import socket
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))

# Le moissonneur porte la politesse réseau (robots.txt, 1 requête/s/domaine),
# le décodage robuste et le magasin de certificats certifi : on le réutilise
# tel quel plutôt que de dupliquer. Son nom contient un tiret, d'où importlib.
_spec = importlib.util.spec_from_file_location("import_sites", ICI / "import-sites.py")
SITES = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(SITES)

from import_commun import domaine_partage, domaine_web_de  # noqa: E402

# ── Réglages ─────────────────────────────────────────────────────

CSV_DEFAUT = ICI / "data" / "annuaire-montpellier.csv"
SORTIE_DEFAUT = ICI.parents[2] / "08 Import evenements" / "Mesures" / "lecture"
CONSIGNE = SORTIE_DEFAUT / "CONSIGNE-HAIKU.md"
MAX_PAGES_PAR_SITE = 3
MAX_CARACTERES_PAGE = 12_000
TAILLE_PAQUET = 10
PARALLELE = 8               # sites traités en même temps (domaines distincts)
CARACTERES_PAR_TOKEN = 3.5  # estimation pour du français ; à remplacer par la mesure réelle
RESONDE_APRES_JOURS = 90    # R11
ANNEES_UTILES = ("2026", "2027")

# Sites nationaux ou de fédération : l'agenda n'est pas celui de l'antenne locale.
DOMAINES_NATIONAUX = {
    "unicef.fr", "francebenevolat.org", "petitsfreresdespauvres.fr", "croix-rouge.fr",
    "secours-catholique.org", "secourspopulaire.fr", "restosducoeur.org", "emmaus-france.org",
    "amnesty.fr", "ldh-france.org", "apf-francehandicap.org", "unafam.org", "lpo.fr",
    "scouts-unitaires.org", "sgdf.fr", "eedf.fr", "ligue-cancer.net", "alcooliques-anonymes.fr",
    "francealzheimer.org", "unaf.fr", "mouvement-associatif.org", "fondation-abbe-pierre.fr",
    "cimade.org", "medecinsdumonde.org", "msf.fr", "handicap-international.fr", "wwf.fr",
    "greenpeace.fr", "attac.org", "planning-familial.org", "laligue.org", "ufcquechoisir.org",
    "clcv.org", "habitat-humanisme.org", "france-parkinson.fr", "afm-telethon.fr",
}

# Poids des catégories de l'annuaire (texte sans accent, sous-chaîne).
POIDS_CATEGORIE = [
    ("danse", 4), ("theatre", 4), ("musique", 4), ("arts plastiques", 4), ("cinema", 3),
    ("litterature", 3), ("art contemporain", 3), ("cultures regionales", 3),
    ("culture scientifique", 3), ("divers culture", 3), ("culture etrangere", 3),
    ("education populaire", 4), ("ecologie", 4), ("environnement", 3),
    ("vie des quartiers", 3), ("loisirs", 2), ("culture", 2),
    ("egalite", 2), ("solidarite", 1), ("social", 1), ("education", 1),
]
# Mots du nom qui annoncent une activité ouverte au public.
NOM_PROMETTEUR = re.compile(
    r"atelier|compagnie|\bcie\b|festival|collectif|maison|jardin|cafe|theatre|danse|chorale|choeur"
    r"|musique|cinema|fablab|ressourcerie|repair|conte|cirque|bal\b|folk|trad|yoga|poesie|lecture"
    r"|librairie|tiers|ferme|potager|velo|recup|zero dechet|transition|culture|arts?\b")

# Liens d'agenda : priorité 0 (agenda), 1 (activités datées), 2 (actualités).
MOTS_LIEN = [
    (0, re.compile(r"agenda|programm|[eé]v[eè]nement|evenement|\bevents?\b|calendrier|a-venir|[àa] venir|prochainement")),
    (1, re.compile(r"atelier|\bdates?\b|stages?\b|saison|spectacles?|concerts?|rendez-vous|sorties")),
    (2, re.compile(r"actualit|\bactus?\b|\bnews\b|nouvelles|\bblog\b")),
]
LIEN_EXCLU = re.compile(
    r"wp-login|wp-admin|/feed/?$|/login|/connexion|/panier|/cart|/compte|mailto:|tel:|javascript:"
    r"|/tag/|/author/|\.ics(\?|$)|replytocom|share=|/wp-json/", re.I)
FICHIER = re.compile(r"\.(?:jpe?g|png|gif|webp|svg|pdf|docx?|xlsx?|odt|zip|mp[34]|avi|mov)(?:\?|$)", re.I)
ANCRE = re.compile(r"<a\s([^>]*)>(.*?)</a>", re.I | re.S)
HREF_ATTR = re.compile(r'href\s*=\s*["\']([^"\']+)["\']', re.I)
BALISE = re.compile(r"<[^>]+>")

# Repérage des dates dans le texte extrait (mesure et tri, pas d'interprétation).
MOIS = r"(?:janv|f[eé]vr|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[eé]c)[a-zéû]*\.?"
DATE_TEXTE = re.compile(
    r"\b\d{1,2}(?:er)?\s+" + MOIS + r"|\b\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?\b|\b20\d{2}-\d{2}-\d{2}\b",
    re.I)
ANNEE_UTILE = re.compile(r"\b(?:" + "|".join(ANNEES_UTILES) + r")\b|\b\d{1,2}[/.]\d{1,2}[/.](?:26|27)\b")

# Données personnelles masquées avant tout envoi à un modèle (R13).
COURRIEL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
TELEPHONE = re.compile(r"(?<!\d)(?:\+33\s?\(?0?\)?\s?|0)[1-9](?:[\s.\-]?\d{2}){4}(?!\d)")


# ── Outils ───────────────────────────────────────────────────────

def sans_accent(t):
    return unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower()


def cle_site(url):
    """Clé d'un site : l'hôte sans « www. », plus le premier segment du
    chemin chez les hébergeurs par chemin (sites.google.com/view/x)."""
    try:
        p = urllib.parse.urlsplit(url)
    except ValueError:
        return (url or "").lower()
    hote = p.netloc.lower().removeprefix("www.")
    if hote in ("sites.google.com",) or hote.endswith(("wixsite.com", "jimdo.com")):
        seg = [s for s in p.path.split("/") if s]
        if hote == "sites.google.com" and len(seg) >= 2:
            return f"{hote}/{seg[0]}/{seg[1]}"
        if seg:
            return f"{hote}/{seg[0]}"
    return hote


def telecharger(url):
    """GET poli (robots.txt, 1 requête/s/domaine via le moissonneur). Renvoie
    (html, url_finale, code_ou_erreur). L'URL finale sert à résoudre les liens
    relatifs après une redirection (http vers https, ajout de www.)."""
    try:
        p = urllib.parse.urlsplit(url)
        schema, domaine = p.scheme or "https", p.netloc.lower()
    except ValueError:
        return None, url, "URL illisible"
    if not SITES.POLITESSE.autorise(url, domaine, schema):
        return None, url, "robots.txt"
    SITES.POLITESSE.attendre(domaine)
    req = urllib.request.Request(url, headers={
        "User-Agent": SITES.USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    try:
        with urllib.request.urlopen(req, timeout=SITES.TIMEOUT) as r:
            ctype = r.headers.get_content_type() or ""
            if "html" not in ctype and "xml" not in ctype and ctype != "text/plain":
                return None, r.geturl(), f"type {ctype}"
            raw = r.read(SITES.MAX_BYTES)
            return SITES.decoder_octets(raw, r.headers.get_content_charset()), r.geturl(), r.status
    except urllib.error.HTTPError as e:
        return None, url, f"HTTP {e.code}"
    except (urllib.error.URLError, socket.timeout, TimeoutError) as e:
        return None, url, f"réseau : {getattr(e, 'reason', e)}"
    except Exception as e:  # un site mal formé ne doit pas arrêter le lot
        return None, url, f"erreur : {e}"


# ── Extraction du texte utile ────────────────────────────────────

VIDES = {"br", "img", "hr", "input", "meta", "link", "source", "wbr", "area", "col",
         "embed", "param", "track", "base"}
# <form> n'est pas sauté : des agendas entiers y sont rendus (filtres par catégorie).
IGNOREES = {"script", "style", "noscript", "svg", "nav", "header", "footer", "aside",
            "iframe", "template", "button", "select", "head", "textarea", "dialog", "canvas"}
BLOCS = {"p", "div", "li", "ul", "ol", "tr", "table", "section", "article", "dd", "dt", "dl",
         "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "figure", "figcaption", "main",
         "address", "pre", "details", "summary"}
TITRES = {"h1", "h2", "h3", "h4"}
ROLES_IGNORES = {"navigation", "banner", "contentinfo", "search", "dialog", "complementary"}
CLASSE_IGNOREE = re.compile(
    r"^(?:site-header|site-footer|footer|main-footer|page-footer|menu|main-menu|nav|navbar|navigation"
    r"|main-navigation|primary-menu|mobile-menu|offcanvas.*|.*cookie.*|cmplz.*|gdpr.*|rgpd.*|tarteaucitron.*"
    r"|sidebar|widget-area|breadcrumbs?|ariane|fil-ariane|skip-link|screen-reader-text|sr-only"
    r"|social.*|share.*|sharing.*|partage.*|newsletter.*|elementor-nav-menu.*|wp-block-navigation.*"
    r"|.*-menu|menu-.*|.*-navigation|top-?bar|pre-?footer|copyright)$", re.I)


class Extracteur(HTMLParser):
    """Texte utile d'une page : saute scripts, menus, en-têtes, pieds de page,
    bandeaux de cookies ; garde titres, paragraphes, listes, tableaux ; ajoute
    après chaque lien son adresse absolue ; ajoute la valeur machine des
    balises <time datetime> (elle est écrite dans la page). Le contenu de
    <main> (ou role=main) est gardé à part : il sert s'il est assez long."""

    def __init__(self, url_page):
        super().__init__(convert_charrefs=True)
        self.url_page = url_page
        self.pile = []           # [(balise, ignorée, principale)]
        self.ignore = 0
        self.dans_main = 0
        self.morceaux = []       # (texte, dans_main)
        self.lien = None         # [href, morceaux du texte]

    def _ecrire(self, t):
        self.morceaux.append((t, self.dans_main > 0))
        if self.lien is not None:
            self.lien[1].append(t)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in VIDES:
            if tag == "br" and not self.ignore:
                self._ecrire("\n")
            return
        classes = (a.get("class") or "").split() + ([a["id"]] if a.get("id") else [])
        # Les classes de <body> ou <main> décrivent la page entière
        # (« has-sticky-menu », « cookies-not-set ») : jamais de saut sur elles.
        conteneur = tag in ("html", "body", "main", "article")
        ignoree = (tag in IGNOREES) or (not conteneur and (
                   (a.get("role") or "").lower() in ROLES_IGNORES
                   or any(CLASSE_IGNOREE.match(c) for c in classes)
                   or a.get("aria-hidden") == "true" or "display:none" in (a.get("style") or "").replace(" ", "")))
        principale = tag == "main" or (a.get("role") or "").lower() == "main"
        self.pile.append((tag, ignoree, principale))
        self.ignore += ignoree
        self.dans_main += principale
        if self.ignore:
            return
        if tag in BLOCS:
            self._ecrire("\n### " if tag in TITRES else "\n")
        elif tag in ("td", "th"):
            self._ecrire(" | ")
        elif tag == "a":
            href = (a.get("href") or "").strip()
            self.lien = [href, []]
        elif tag == "time" and a.get("datetime"):
            self._time = a["datetime"].strip()

    def handle_endtag(self, tag):
        if tag in VIDES:
            return
        for i in range(len(self.pile) - 1, -1, -1):
            if self.pile[i][0] == tag:
                for t, ign, princ in self.pile[i:]:
                    self.ignore -= ign
                    self.dans_main -= princ
                    if t == "a":
                        self._fermer_lien()
                del self.pile[i:]
                break
        else:
            return
        if self.ignore:
            return
        if tag in BLOCS:
            self._ecrire("\n")
        elif tag == "time" and getattr(self, "_time", None):
            self._ecrire(f" ({self._time})")
            self._time = None

    def _fermer_lien(self):
        if self.lien is None:
            return
        href, morceaux = self.lien
        self.lien = None
        texte_lien = " ".join("".join(morceaux).split())
        if self.ignore or len(texte_lien) < 3 or not href:
            return
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            return
        u = urllib.parse.urljoin(self.url_page, href)
        if not u.startswith(("http://", "https://")) or u.rstrip("/") == self.url_page.rstrip("/"):
            return
        self.morceaux.append((f" <{u}>", self.dans_main > 0))

    def handle_data(self, data):
        if not self.ignore and data:
            self._ecrire(data)

    def texte(self):
        self._fermer_lien()
        principal = "".join(t for t, m in self.morceaux if m)
        tout = "".join(t for t, _ in self.morceaux)
        return principal if len(principal.strip()) >= 400 else tout


def nettoyer(texte_brut):
    """Espaces réduits, lignes vides et lignes répétées retirées, données
    personnelles masquées, coupe à MAX_CARACTERES_PAGE sur une fin de ligne."""
    texte_brut = COURRIEL.sub("[courriel masqué]", texte_brut)
    texte_brut = TELEPHONE.sub("[téléphone masqué]", texte_brut)
    lignes, vues = [], set()
    for ligne in texte_brut.split("\n"):
        ligne = " ".join(ligne.split())
        if ligne in ("###", "|", "") or len(ligne) < 2:
            continue
        ligne = ligne.strip(" |") if ligne.startswith("|") else ligne
        cle = ligne.lower()
        if cle in vues and len(ligne) < 120:
            continue  # menus et boutons répétés (« Lire la suite », « Réserver »)
        vues.add(cle)
        lignes.append(ligne)
    texte_final = "\n".join(lignes)
    if len(texte_final) > MAX_CARACTERES_PAGE:
        coupe = texte_final.rfind("\n", 0, MAX_CARACTERES_PAGE)
        texte_final = texte_final[:coupe if coupe > MAX_CARACTERES_PAGE // 2 else MAX_CARACTERES_PAGE]
    return texte_final


def extraire(html_txt, url_page):
    ex = Extracteur(url_page)
    try:
        ex.feed(html_txt)
        ex.close()
    except Exception:  # HTML très cassé : on garde ce qui a été lu
        pass
    return nettoyer(ex.texte())


# ── Pages d'agenda ───────────────────────────────────────────────

def liens_agenda(html_txt, url_page, origine):
    """Liens de l'accueil (menu compris) vers une page d'agenda du même site,
    par le texte du lien ou par son chemin. Trois au plus, les plus explicites
    d'abord (agenda, programme, événements), puis les chemins les plus courts."""
    trouves = {}
    for attrs, contenu in ANCRE.findall(html_txt or ""):
        m = HREF_ATTR.search(attrs)
        if not m:
            continue
        href = m.group(1).strip()
        u = urllib.parse.urljoin(url_page, href.replace("&amp;", "&")).split("#")[0]
        if not u.startswith(("http://", "https://")) or not SITES.meme_site(u, origine):
            continue
        if LIEN_EXCLU.search(u) or FICHIER.search(u):
            continue
        u = u.rstrip("/")
        if u in (origine.rstrip("/"), url_page.rstrip("/")):
            continue
        texte_lien = sans_accent(BALISE.sub(" ", contenu))[:80]
        chemin = sans_accent(urllib.parse.unquote(urllib.parse.urlsplit(u).path))
        for prio, motif in MOTS_LIEN:
            if motif.search(texte_lien) or motif.search(chemin.replace("-", " ").replace("_", " ")) \
                    or motif.search(chemin):
                profondeur = len([s for s in chemin.split("/") if s])
                cle = (prio, profondeur, len(u))
                if u not in trouves or cle < trouves[u]:
                    trouves[u] = cle
                break
    return [u for u, _ in sorted(trouves.items(), key=lambda x: x[1])][:MAX_PAGES_PAR_SITE]


def mesure_dates(texte_page):
    return len(DATE_TEXTE.findall(texte_page)), bool(ANNEE_UTILE.search(texte_page))


def lire_site(site):
    """Accueil puis pages d'agenda. Renvoie le site complété de `pages`
    (gardées), `pages_ecartees` (motif) et `etat`."""
    url = site["url"]
    html_acc, url_finale, code = telecharger(url)
    site["lu_le"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if html_acc is None:
        site.update(etat="mort", erreur=str(code), pages=[], pages_ecartees=[])
        return site
    site["etat"] = "vivant"
    site["url_finale"] = url_finale
    origine = SITES.origine_de(url_finale)
    exts = SITES.extensions_detectees([(html_acc, url_finale)])
    if SITES.trouver_events_jsonld(html_acc, url_finale):
        exts.add("jsonld")
    candidates = liens_agenda(html_acc, url_finale, origine)
    site["liens_agenda"] = candidates
    pages, ecartees = [], []
    for u in candidates:
        h, uf, c = telecharger(u)
        if h is None:
            ecartees.append({"url": u, "motif": f"illisible ({c})"})
            continue
        if SITES.trouver_events_jsonld(h, uf):
            exts.add("jsonld")
        exts |= SITES.extensions_detectees([(h, uf)])
        pages.append(("agenda", uf, extraire(h, uf)))
    if not pages:
        # Pas de lien d'agenda : l'accueil sert s'il porte lui-même des dates.
        pages.append(("accueil", url_finale, extraire(html_acc, url_finale)))
    gardees = []
    vus = set()
    for genre, u, t in pages:
        n_dates, annee = mesure_dates(t)
        if u in vus:
            continue
        vus.add(u)
        if len(t) < 200:
            ecartees.append({"url": u, "motif": "texte trop court", "caracteres": len(t)})
        elif n_dates == 0:
            ecartees.append({"url": u, "motif": "aucune date", "caracteres": len(t)})
        elif not annee:
            ecartees.append({"url": u, "motif": f"aucune année {'/'.join(ANNEES_UTILES)}",
                             "caracteres": len(t), "dates": n_dates})
        else:
            gardees.append({"genre": genre, "url": u, "lu_le": site["lu_le"],
                            "caracteres": len(t), "dates_reperees": n_dates, "texte": t})
    site["pages"] = gardees
    site["pages_ecartees"] = ecartees
    site["structure_detectee"] = sorted(exts)
    return site


# ── Sélection des sites ──────────────────────────────────────────

def lire_csv(chemin, commune):
    with open(chemin, encoding="utf-8-sig", newline="") as f:
        lignes = list(csv.DictReader(f, delimiter=";"))
    if commune:
        lignes = [l for l in lignes if sans_accent(l.get("commune")) == sans_accent(commune)]
    return lignes


def score(ligne):
    cat = sans_accent(ligne.get("categorie"))
    s = 0
    for mot, poids in POIDS_CATEGORIE:
        if mot in cat:
            s = max(s, poids)
    if NOM_PROMETTEUR.search(sans_accent(ligne.get("nom"))):
        s += 2
    if "fiche lue" in (ligne.get("source") or ""):
        s += 1  # annuaire Antigone : plus récent que l'open data
    return s


def memoire_sondage(sans_memoire):
    """{clé de site: (signal, sonde_le)} depuis annuaire_sites_sondes, en
    lecture seule. Vide sans .env.local ou si la lecture échoue."""
    if sans_memoire:
        return {}, "désactivée (--sans-memoire)"
    try:
        from import_commun import Base, load_env
        url, key = load_env()
        db = Base(url, key)
        sondes = db.lire_tout("annuaire_sites_sondes?select=site_web,signal,sonde_le&order=annuaire_id")
    except BaseException as e:  # SystemExit compris : la base est facultative ici
        return {}, f"indisponible ({type(e).__name__})"
    mem = {}
    for s in sondes:
        if s.get("site_web"):
            mem[cle_site(SITES.normaliser_url(s["site_web"]))] = (s["signal"], s.get("sonde_le"))
    return mem, f"{len(mem)} sites mémorisés"


def selectionner(lignes, memoire, graine):
    """Candidats triés du plus au moins prometteur, un par site, sans les
    sites nationaux ni les domaines partagés par plusieurs associations."""
    par_domaine = {}
    for l in lignes:
        if l.get("thematique") != "1" or l.get("type_site") != "site" or not l.get("site_web"):
            continue
        url = SITES.normaliser_url(l["site_web"])
        par_domaine.setdefault(cle_site(url), []).append((l, url))
    rng = random.Random(graine)
    candidats, ecartes = [], {}
    seuil = datetime.now(timezone.utc) - timedelta(days=RESONDE_APRES_JOURS)
    for cle, groupe in par_domaine.items():
        dom = domaine_web_de(groupe[0][1]) or cle
        racine = ".".join(dom.split(".")[-2:])
        if len({g[0]["nom"] for g in groupe}) > 1:
            ecartes["domaine partagé par plusieurs associations"] = ecartes.get(
                "domaine partagé par plusieurs associations", 0) + 1
            continue
        if racine in DOMAINES_NATIONAUX or dom in DOMAINES_NATIONAUX:
            ecartes["site national ou de fédération"] = ecartes.get("site national ou de fédération", 0) + 1
            continue
        if domaine_partage(dom) and "/" not in cle:
            ecartes["plateforme partagée"] = ecartes.get("plateforme partagée", 0) + 1
            continue
        mem = memoire.get(cle)
        if mem:
            signal, sonde_le = mem
            try:
                recent = datetime.fromisoformat(sonde_le.replace("Z", "+00:00")) > seuil
            except (AttributeError, ValueError):
                recent = False
            if signal == "erreur" and recent:
                ecartes["mort selon la mémoire du sondage"] = ecartes.get("mort selon la mémoire du sondage", 0) + 1
                continue
            if signal not in ("aucun", "erreur"):
                ecartes["lisible par le moissonneur (étage 1)"] = ecartes.get(
                    "lisible par le moissonneur (étage 1)", 0) + 1
                continue
        l, url = groupe[0]
        candidats.append({
            "site_id": cle, "url": url, "association": l["nom"].strip(), "commune": l.get("commune"),
            "categorie": l.get("categorie"), "source_annuaire": l.get("source"),
            "score": score(l), "memoire": mem[0] if mem else None, "_alea": rng.random(),
        })
    candidats.sort(key=lambda c: (-c["score"], c["_alea"]))
    for c in candidats:
        del c["_alea"]
    return candidats, ecartes


# ── Programme ────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Lecture par modèle : préparer les paquets (aucune écriture en base)")
    ap.add_argument("--csv", default=str(CSV_DEFAUT), help="annuaire communal (séparateur ;)")
    ap.add_argument("--commune", default="Montpellier", help="filtre sur la colonne commune ('' = toutes)")
    ap.add_argument("--nombre", type=int, default=100, help="sites vivants à retenir")
    ap.add_argument("--sortie", default=str(SORTIE_DEFAUT), help="dossier des paquets")
    ap.add_argument("--taille-paquet", type=int, default=TAILLE_PAQUET, dest="taille_paquet")
    ap.add_argument("--graine", type=int, default=2026, help="départage des sites à score égal")
    ap.add_argument("--sans-memoire", action="store_true", dest="sans_memoire",
                    help="ne lit pas annuaire_sites_sondes")
    args = ap.parse_args()

    t0 = time.time()
    sortie = Path(args.sortie)
    sortie.mkdir(parents=True, exist_ok=True)
    lignes = lire_csv(args.csv, args.commune)
    memoire, etat_memoire = memoire_sondage(args.sans_memoire)
    candidats, ecartes = selectionner(lignes, memoire, args.graine)
    print(f"Annuaire : {len(lignes)} lignes ({args.commune or 'toutes communes'}), "
          f"{len(candidats)} sites candidats ; mémoire du sondage : {etat_memoire}")
    for motif, n in sorted(ecartes.items(), key=lambda x: -x[1]):
        print(f"  écartés avant tout essai : {n} {motif}")

    # Vagues de sites, dans l'ordre du score, jusqu'à N sites vivants.
    vivants, morts, essayes = [], [], 0
    with ThreadPoolExecutor(max_workers=PARALLELE) as pool:
        while len(vivants) < args.nombre and essayes < len(candidats):
            manque = args.nombre - len(vivants)
            vague = candidats[essayes:essayes + max(manque + manque // 3, PARALLELE)]
            essayes += len(vague)
            for s in pool.map(lire_site, vague):
                (vivants if s["etat"] == "vivant" else morts).append(s)
            print(f"  ... {essayes} sites essayés, {len(vivants)} vivants")
    vivants = vivants[:args.nombre]

    # Paquets : seuls les sites avec au moins une page gardée. Les paquets
    # d'un passage précédent sont retirés (un résultat ne doit jamais être
    # rapproché d'un paquet qui n'est plus celui qu'il a lu).
    for ancien in sortie.glob("paquet-*.json"):
        ancien.unlink()
    a_lire = [s for s in vivants if s["pages"]]
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    taille_consigne = len(CONSIGNE.read_text(encoding="utf-8")) if CONSIGNE.exists() else 0
    paquets = []
    for i in range(0, len(a_lire), args.taille_paquet):
        num = len(paquets) + 1
        lot = a_lire[i:i + args.taille_paquet]
        contenu = {
            "paquet": f"paquet-{num:02d}",
            "prepare_le": stamp,
            "date_reference": datetime.now().date().isoformat(),  # heure locale du poste (Paris)
            "consigne": "08 Import evenements/Mesures/lecture/CONSIGNE-HAIKU.md",
            "sites": [{
                "site_id": s["site_id"], "site": s["url"], "association": s["association"],
                "commune": s["commune"], "categorie": s["categorie"],
                "structure_detectee": s.get("structure_detectee") or [],
                "pages": [{"page": p["url"], "genre": p["genre"], "lu_le": p["lu_le"],
                           "caracteres": p["caracteres"], "texte": p["texte"]} for p in s["pages"]],
            } for s in lot],
        }
        chemin = sortie / f"paquet-{num:02d}.json"
        chemin.write_text(json.dumps(contenu, ensure_ascii=False, indent=1), encoding="utf-8")
        car = sum(p["caracteres"] for s in lot for p in s["pages"])
        paquets.append({"paquet": chemin.name, "sites": len(lot),
                        "pages": sum(len(s["pages"]) for s in lot), "caracteres": car,
                        "tokens_entree_estimes": round((car + taille_consigne) / CARACTERES_PAR_TOKEN),
                        "octets": chemin.stat().st_size,
                        "sha1": hashlib.sha1(chemin.read_bytes()).hexdigest()[:12]})

    # Sélection détaillée (sans texte) et mesure.
    with open(sortie / "selection.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["site_id", "association", "categorie", "score", "memoire", "etat", "erreur",
                    "liens_agenda", "pages_gardees", "caracteres", "pages_ecartees", "structure_detectee"])
        for s in vivants + morts:
            w.writerow([s["site_id"], s["association"], s["categorie"], s["score"], s["memoire"] or "",
                        s["etat"], s.get("erreur", ""), len(s.get("liens_agenda") or []),
                        len(s["pages"]), sum(p["caracteres"] for p in s["pages"]),
                        " | ".join(f"{p['motif']} {p['url']}" for p in s["pages_ecartees"]),
                        ",".join(s.get("structure_detectee") or [])])

    motifs_pages = {}
    for s in vivants:
        for p in s["pages_ecartees"]:
            m = p["motif"].split(" (")[0]
            motifs_pages[m] = motifs_pages.get(m, 0) + 1
    car_sites = [sum(p["caracteres"] for p in s["pages"]) for s in a_lire]
    mesure = {
        "date": stamp, "csv": Path(args.csv).name, "commune": args.commune,
        "memoire_sondage": etat_memoire, "ecartes_avant_essai": ecartes,
        "sites_essayes": len(vivants) + len(morts), "sites_joignables": len(vivants),
        "sites_morts": len(morts),
        "morts_par_erreur": _compter(str(s.get("erreur"))[:40] for s in morts),
        "sites_avec_lien_agenda": sum(1 for s in vivants if s.get("liens_agenda")),
        "pages_agenda_trouvees": sum(len(s.get("liens_agenda") or []) for s in vivants),
        "sites_avec_page_gardee": len(a_lire),
        "dont_accueil_seul": sum(1 for s in a_lire if all(p["genre"] == "accueil" for p in s["pages"])),
        "pages_gardees": sum(len(s["pages"]) for s in a_lire),
        "pages_ecartees_par_motif": motifs_pages,
        "sites_avec_structure_detectee": sum(1 for s in vivants if s.get("structure_detectee")),
        "caracteres_par_site_lu": {
            "moyenne": round(sum(car_sites) / len(car_sites)) if car_sites else 0,
            "mediane": sorted(car_sites)[len(car_sites) // 2] if car_sites else 0,
            "max": max(car_sites) if car_sites else 0},
        "caracteres_par_token_suppose": CARACTERES_PAR_TOKEN,
        "tokens_consigne_estimes": round(taille_consigne / CARACTERES_PAR_TOKEN),
        "paquets": paquets, "duree_s": round(time.time() - t0, 1),
    }
    (sortie / "mesure-preparation.json").write_text(json.dumps(mesure, ensure_ascii=False, indent=1),
                                                     encoding="utf-8")

    print(f"\nSites    : {mesure['sites_essayes']} essayés, {len(vivants)} joignables, {len(morts)} morts")
    print(f"Agenda   : {mesure['sites_avec_lien_agenda']} sites avec un lien d'agenda "
          f"({mesure['pages_agenda_trouvees']} pages), {len(a_lire)} sites avec une page gardée "
          f"(dont {mesure['dont_accueil_seul']} par l'accueil seul)")
    print(f"Écartées : " + ", ".join(f"{m} {n}" for m, n in sorted(motifs_pages.items(), key=lambda x: -x[1])))
    print(f"Texte    : {mesure['caracteres_par_site_lu']} caractères par site lu")
    for p in paquets:
        print(f"  {p['paquet']} : {p['sites']} sites, {p['pages']} pages, {p['caracteres']} car., "
              f"~{p['tokens_entree_estimes']} tokens en entrée")
    print(f"Durée    : {mesure['duree_s']} s, 0 token, rien écrit en base")


def _compter(valeurs):
    c = {}
    for v in valeurs:
        c[v] = c.get(v, 0) + 1
    return dict(sorted(c.items(), key=lambda x: -x[1]))


if __name__ == "__main__":
    main()
