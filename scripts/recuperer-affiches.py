# -*- coding: utf-8 -*-
"""
Recupere les affiches des evenements importes qui n'en ont pas (tache T42).

Pour chaque fiche a venir, visible, sans photo, avec une page source
(evenements_import.source_url) : lit la page, extrait og:image / twitter:image,
telecharge l'image, la convertit en JPEG (qualite 85, 1600 px de large au plus),
la stocke dans le bucket public `affiches-importees` (importees/<event_id>.jpg)
et ecrit evenements.photos = [URL publique]. Aucun modele de langage : script.

Regles : robots.txt lu et respecte, une requete par seconde et par domaine,
User-Agent CasamingaImport/1.0 (+https://casaminga.com), 90 jours avant de
retenter un refus. Republication sans licence autorisee par Leo (2026-10-12,
R3 : retrait sur demande, qui supprime aussi l'objet du bucket).

Usage :
    python scripts/recuperer-affiches.py --essai --max 200      # lit, n'ecrit RIEN
    python scripts/recuperer-affiches.py --max 30 --id <uuid>   # ecrit pour de vrai
    python scripts/recuperer-affiches.py --source toutes        # toutes les sources
    python scripts/recuperer-affiches.py --departement 34,30

La cle de service est lue dans .env.local (jamais affichee).
Memoire des refus et provenance : scripts/data/affiches-importees.json
(evenements_import n'a aucune colonne libre : `attribution` est reservee au
credit de la source, `photos_retirees` aux affiches retirees).
"""

import argparse
import json
import re
import shutil
import ssl
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

try:
    import certifi
    _CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _CTX = ssl.create_default_context()

from PIL import Image, ImageOps  # noqa: E402

from import_commun import Base, load_env  # noqa: E402

UA = "CasamingaImport/1.0 (+https://casaminga.com)"
UA_ROBOTS = "CasamingaImport"
DELAI = 1.0                  # seconds between two requests to one domain
TIMEOUT = 15
PAGE_MAX = 2 * 1024 * 1024
IMAGE_MAX = 12 * 1024 * 1024
LARGEUR_MIN = 400
LARGEUR_MAX = 1600
QUALITE = 85
JOURS_REFUS = 90
SEUIL_GENERIQUE = 5          # same image on MORE than 5 pages of one domain
BUCKET = "affiches-importees"
PREFIXE = "importees"
MEMOIRE = Path(__file__).resolve().parent / "data" / "affiches-importees.json"
NOMS_GENERIQUES = re.compile(r"logo|favicon|icon|default|placeholder", re.I)
# Statuses memorised for JOURS_REFUS days (not retried before).
STATUTS_MEMORISES = {"refus", "page_absente", "sans_image", "generique",
                     "image_refusee", "robots", "image_invalide"}


# ---------------------------------------------------------------------------
# Throttle: one request per second per domain, all threads together.
# ---------------------------------------------------------------------------
_verrous, _prochain, _delais = {}, {}, {}
_verrou_global = threading.Lock()


def attendre(hote):
    with _verrou_global:
        v = _verrous.setdefault(hote, threading.Lock())
    with v:
        reste = _prochain.get(hote, 0) - time.monotonic()
        if reste > 0:
            time.sleep(reste)
        _prochain[hote] = time.monotonic() + _delais.get(hote, DELAI)


def hote_de(url):
    return (urllib.parse.urlsplit(url).hostname or "").lower()


# ---------------------------------------------------------------------------
# HTTP: urllib with certificate verification; if the local store rejects the
# certificate, fall back on curl (which also verifies it, never -k / --insecure).
# ---------------------------------------------------------------------------
class Rep:
    def __init__(self, code=0, ctype="", url="", corps=b"", erreur="", via="urllib", trop_gros=False):
        self.code, self.ctype, self.url, self.corps = code, ctype, url, corps
        self.erreur, self.via, self.trop_gros = erreur, via, trop_gros


def _erreur_certificat(e):
    r = getattr(e, "reason", e)
    return isinstance(r, ssl.SSLError) or isinstance(e, ssl.SSLError) or "CERTIFICATE" in str(r).upper()


def _curl(url, methode, max_octets, accept):
    exe = shutil.which("curl")
    if not exe:
        return Rep(erreur="certificat refuse et curl absent")
    tmp = tempfile.mkdtemp(prefix="affiches-")
    try:
        sortie = Path(tmp) / "corps"
        cmd = [exe, "-sS", "-L", "--max-redirs", "5", "--max-time", str(TIMEOUT),
               "--max-filesize", str(max_octets + 1), "-A", UA, "-H", f"Accept: {accept}",
               "-o", str(sortie), "-w", "%{http_code}\t%{content_type}\t%{url_effective}"]
        if methode == "HEAD":
            cmd.append("-I")
        cmd.append(url)
        p = subprocess.run(cmd, capture_output=True, timeout=TIMEOUT + 5)
        if p.returncode != 0:
            return Rep(erreur=f"curl {p.returncode}: {p.stderr.decode('utf-8', 'replace').strip()[:100]}", via="curl")
        code, ctype, eff = (p.stdout.decode("utf-8", "replace").split("\t") + ["", ""])[:3]
        corps = sortie.read_bytes() if sortie.exists() and methode != "HEAD" else b""
        gros = len(corps) > max_octets
        return Rep(int(code or 0), ctype.split(";")[0].strip().lower(), eff, corps[:max_octets], via="curl", trop_gros=gros)
    except (subprocess.TimeoutExpired, OSError) as e:
        return Rep(erreur=f"curl: {type(e).__name__}", via="curl")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def http(url, methode="GET", max_octets=PAGE_MAX, accept="text/html,application/xhtml+xml,*/*;q=0.5"):
    attendre(hote_de(url))
    req = urllib.request.Request(url, method=methode, headers={"User-Agent": UA, "Accept": accept})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=_CTX) as r:
            corps = b"" if methode == "HEAD" else r.read(max_octets + 1)
            return Rep(r.status, (r.headers.get("Content-Type") or "").split(";")[0].strip().lower(),
                       r.geturl(), corps[:max_octets], trop_gros=len(corps) > max_octets)
    except urllib.error.HTTPError as e:
        return Rep(e.code, (e.headers.get("Content-Type") or "").split(";")[0].strip().lower(), url)
    except (urllib.error.URLError, ssl.SSLError) as e:
        if _erreur_certificat(e):
            return _curl(url, methode, max_octets, accept)
        return Rep(erreur=f"{type(e).__name__}: {getattr(e, 'reason', e)}"[:120])
    except (TimeoutError, ConnectionError, OSError, ValueError) as e:
        return Rep(erreur=f"{type(e).__name__}: {e}"[:120])


# ---------------------------------------------------------------------------
# robots.txt (cached per scheme + host)
# ---------------------------------------------------------------------------
_robots, _verrou_robots = {}, threading.Lock()


def robots_autorise(url):
    """-> ('ok'|'interdit'|'indisponible')."""
    p = urllib.parse.urlsplit(url)
    cle = f"{p.scheme}://{p.netloc}"
    with _verrou_robots:
        entree = _robots.get(cle)
        if entree is None:
            entree = _robots[cle] = {"verrou": threading.Lock(), "etat": None}
    with entree["verrou"]:
        if entree["etat"] is None:
            r = http(f"{cle}/robots.txt", max_octets=512 * 1024, accept="text/plain,*/*;q=0.5")
            if r.erreur or r.code >= 500 or r.code == 429:
                entree["etat"] = ("indisponible", None)
            elif r.code in (401, 403):
                entree["etat"] = ("interdit", None)       # conservative, like urllib.robotparser
            elif r.code == 200:
                rp = urllib.robotparser.RobotFileParser()
                rp.parse(r.corps.decode("utf-8", "replace").splitlines())
                delai = rp.crawl_delay(UA_ROBOTS)
                if delai:
                    _delais[hote_de(url)] = min(max(float(delai), DELAI), 10.0)
                entree["etat"] = ("ok", rp)
            else:                                          # 404 etc.: no rules
                entree["etat"] = ("ok", None)
    etat, rp = entree["etat"]
    if etat != "ok":
        return etat
    if rp is None:
        return "ok"
    return "ok" if rp.can_fetch(UA_ROBOTS, url) else "interdit"


# ---------------------------------------------------------------------------
# Page parsing
# ---------------------------------------------------------------------------
class Balises(HTMLParser):
    CLES = ("og:image", "og:image:secure_url", "twitter:image", "twitter:image:src")

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.metas, self.image_src, self.fini = [], None, False

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "meta":
            nom = (a.get("property") or a.get("name") or "").strip().lower()
            if nom in self.CLES and a.get("content", "").strip():
                self.metas.append((nom, a["content"].strip()))
        elif tag == "link" and "image_src" in a.get("rel", "").lower().split() and a.get("href"):
            self.image_src = a["href"].strip()

    def handle_endtag(self, tag):
        if tag == "head":
            self.fini = True


def candidats_image(html_octets, base_url):
    """Image URLs in priority order: og:image, og:image:secure_url, twitter:image,
    then <link rel="image_src">."""
    p = Balises()
    try:
        p.feed(html_octets.decode("utf-8", "replace"))
    except Exception:
        pass
    ordre = {c: i for i, c in enumerate(Balises.CLES)}
    metas = sorted(p.metas, key=lambda m: ordre[m[0]])
    urls = [m[1] for m in metas] + ([p.image_src] if p.image_src else [])
    sortie = []
    for u in urls:
        absolue = urllib.parse.urljoin(base_url, u)
        if absolue.startswith(("http://", "https://")) and absolue not in sortie:
            sortie.append(absolue)
    return sortie


def nom_generique(url):
    fichier = urllib.parse.unquote(urllib.parse.urlsplit(url).path).rsplit("/", 1)[-1]
    return bool(NOMS_GENERIQUES.search(fichier))


# ---------------------------------------------------------------------------
# Phase 1: one page -> candidate images
# ---------------------------------------------------------------------------
def lire_page(url):
    """-> dict(statut, candidats, detail). statut in ok / refus / page_absente /
    sans_image / robots / indisponible."""
    ra = robots_autorise(url)
    if ra == "interdit":
        return {"statut": "robots", "detail": "robots.txt"}
    if ra == "indisponible":
        return {"statut": "indisponible", "detail": "robots.txt illisible"}
    h = http(url, "HEAD")
    if h.code in (404, 410):
        return {"statut": "page_absente", "detail": f"HEAD {h.code}"}
    if h.code in (401, 403, 429):
        return {"statut": "refus", "detail": f"HEAD {h.code}"}
    # Other HEAD answers (405, 5xx, network error): many servers dislike HEAD, go on to GET.
    g = http(url, "GET")
    if g.erreur:
        return {"statut": "indisponible", "detail": g.erreur}
    if g.code in (404, 410):
        return {"statut": "page_absente", "detail": f"GET {g.code}"}
    if g.code in (401, 403, 429):
        return {"statut": "refus", "detail": f"GET {g.code}"}
    if g.code != 200:
        return {"statut": "indisponible", "detail": f"GET {g.code}"}
    if g.ctype and "html" not in g.ctype:
        return {"statut": "sans_image", "detail": f"page non HTML ({g.ctype})"}
    cands = candidats_image(g.corps, g.url or url)
    if not cands:
        return {"statut": "sans_image", "detail": "ni og:image ni twitter:image"}
    return {"statut": "ok", "candidats": cands, "detail": ""}


# ---------------------------------------------------------------------------
# Phase 2: image -> JPEG bytes
# ---------------------------------------------------------------------------
def preparer_image(url):
    """-> dict(statut, jpeg, largeur, hauteur, detail). statut in ok / petite /
    image_refusee / image_invalide / robots / indisponible."""
    ra = robots_autorise(url)
    if ra == "interdit":
        return {"statut": "robots", "detail": "robots.txt (hote de l'image)"}
    if ra == "indisponible":
        return {"statut": "indisponible", "detail": "robots.txt illisible (image)"}
    r = http(url, "GET", IMAGE_MAX, "image/avif,image/webp,image/*,*/*;q=0.8")
    if r.erreur:
        return {"statut": "indisponible", "detail": r.erreur}
    if r.code in (401, 403, 429):
        return {"statut": "image_refusee", "detail": f"HTTP {r.code}"}
    if r.code != 200:
        return {"statut": "image_invalide", "detail": f"HTTP {r.code}"}
    if r.trop_gros:
        return {"statut": "image_invalide", "detail": f"plus de {IMAGE_MAX // 1048576} Mo"}
    try:
        im = Image.open(BytesIO(r.corps))
        im.verify()
        im = Image.open(BytesIO(r.corps))
        im = ImageOps.exif_transpose(im)
        im.load()
    except Exception as e:
        return {"statut": "image_invalide", "detail": f"pas une image ({type(e).__name__}, {r.ctype or 'sans type'})"}
    l, h = im.size
    if l < LARGEUR_MIN:
        return {"statut": "petite", "detail": f"{l} x {h}", "largeur": l, "hauteur": h}
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        fond = Image.new("RGB", im.size, (255, 255, 255))
        fond.paste(im, mask=im.getchannel("A"))
        im = fond
    elif im.mode != "RGB":
        im = im.convert("RGB")
    if l > LARGEUR_MAX:                       # no crop: only a proportional shrink
        im = im.resize((LARGEUR_MAX, round(h * LARGEUR_MAX / l)), Image.LANCZOS)
    sortie = BytesIO()
    im.save(sortie, "JPEG", quality=QUALITE, optimize=True, progressive=True)
    return {"statut": "ok", "jpeg": sortie.getvalue(), "largeur": l, "hauteur": h, "detail": f"{l} x {h}"}


# ---------------------------------------------------------------------------
# Supabase storage + writes
# ---------------------------------------------------------------------------
def bucket_existe(url_base, cle):
    req = urllib.request.Request(f"{url_base}/storage/v1/bucket/{BUCKET}",
                                 headers={"apikey": cle, "Authorization": f"Bearer {cle}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status == 200
    except urllib.error.HTTPError:
        return False


def envoyer(url_base, cle, event_id, jpeg):
    chemin = f"{PREFIXE}/{event_id}.jpg"
    req = urllib.request.Request(
        f"{url_base}/storage/v1/object/{BUCKET}/{chemin}", data=jpeg, method="POST",
        headers={"apikey": cle, "Authorization": f"Bearer {cle}", "Content-Type": "image/jpeg",
                 "x-upsert": "true", "cache-control": "max-age=31536000"})
    with urllib.request.urlopen(req, timeout=60) as r:
        r.read()
    return f"{url_base}/storage/v1/object/public/{BUCKET}/{chemin}"


def supprimer(url_base, cle, event_id):
    req = urllib.request.Request(
        f"{url_base}/storage/v1/object/{BUCKET}/{PREFIXE}/{event_id}.jpg", method="DELETE",
        headers={"apikey": cle, "Authorization": f"Bearer {cle}"})
    try:
        urllib.request.urlopen(req, timeout=30).read()
    except urllib.error.HTTPError:
        pass


def ecrire_fiche(db, event_id, url_publique):
    """evenements.photos only if still empty, and only if checked_at is null (R8).
    -> True if the row was updated."""
    i = db._call("GET", f"evenements_import?select=checked_at&event_id=eq.{event_id}")
    if not i or i[0]["checked_at"] is not None:
        return False
    lignes = db._call("PATCH", f"evenements?id=eq.{event_id}&photos=eq.%7B%7D",
                      {"photos": [url_publique]}, headers={"Prefer": "return=representation"})
    return bool(lignes)


# ---------------------------------------------------------------------------
# Memory file
# ---------------------------------------------------------------------------
def charger_memoire():
    if MEMOIRE.exists():
        return json.loads(MEMOIRE.read_text(encoding="utf-8"))
    return {"ecrites": {}, "ecartees": {}, "generiques": {}, "journal": []}


def sauver_memoire(m):
    MEMOIRE.parent.mkdir(parents=True, exist_ok=True)
    MEMOIRE.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")


def encore_en_pause(entree, maintenant):
    try:
        return maintenant - datetime.fromisoformat(entree["date"]) < timedelta(days=JOURS_REFUS)
    except (KeyError, ValueError):
        return False


# ---------------------------------------------------------------------------
def lire_candidats(db, args, memoire, maintenant):
    now = maintenant.strftime("%Y-%m-%dT%H:%M:%SZ")
    evs = db.lire_tout("evenements?select=id,title,start_at,establishment_id,photos"
                       "&show_on_public_site=eq.true&photos=eq.%7B%7D"
                       f"&start_at=gte.{urllib.parse.quote(now)}&order=start_at.asc,id.asc")
    imps = {i["event_id"]: i for i in db.lire_tout(
        "evenements_import?select=event_id,source,source_url&source_url=not.is.null&checked_at=is.null")}
    depts = {d.strip().upper() for d in (args.departement or "").split(",") if d.strip()}
    cp_par_etab = {}
    if depts:
        cp_par_etab = {e["id"]: (e.get("postal_code") or "") for e in
                       db.lire_tout("establishments?select=id,postal_code")}
    sortie, comptes = [], Counter()
    for ev in evs:
        imp = imps.get(ev["id"])
        if not imp or not imp["source_url"].startswith(("http://", "https://")):
            continue
        if args.source != "toutes" and not imp["source"].startswith(args.source):
            continue
        if depts:
            cp = cp_par_etab.get(ev["establishment_id"], "")
            d = cp[:3] if cp[:2] in ("97", "98") else cp[:2]
            if d.upper() not in depts:
                continue
        if args.id and ev["id"] not in args.id:
            continue
        mem = memoire["ecartees"].get(ev["id"])
        if mem and mem.get("source_url") == imp["source_url"] and encore_en_pause(mem, maintenant):
            comptes["en_pause_90j"] += 1
            continue
        sortie.append({"id": ev["id"], "title": ev["title"], "source_url": imp["source_url"], "source": imp["source"]})
    return sortie, comptes


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--essai", action="store_true", help="lit les pages et les images, n'ecrit RIEN (ni bucket, ni base, ni memoire)")
    ap.add_argument("--max", type=int, help="nombre maximal de fiches traitees")
    ap.add_argument("--departement", help="code(s) de departement, ex. 34 ou 34,30")
    ap.add_argument("--source", default="datatourisme", help="prefixe de evenements_import.source, ou 'toutes' (defaut : datatourisme)")
    ap.add_argument("--id", action="append", help="traiter cette fiche en priorite (repetable)")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()
    ids_forces = list(args.id or [])

    debut = time.monotonic()
    maintenant = datetime.now(timezone.utc)
    url_base, cle = load_env()
    db = Base(url_base, cle)
    memoire = charger_memoire()

    # --id selects among the candidates; without --max it is the only filter.
    args_lecture = argparse.Namespace(**{**vars(args), "id": None})
    candidats, comptes = lire_candidats(db, args_lecture, memoire, maintenant)
    if ids_forces:
        forces = [c for c in candidats if c["id"] in ids_forces]
        reste = [c for c in candidats if c["id"] not in ids_forces]
        manquants = set(ids_forces) - {c["id"] for c in forces}
        if manquants:
            print(f"ATTENTION : fiche(s) non eligible(s) (photo presente, hors filtre, en pause 90 j) : {sorted(manquants)}")
        candidats = forces + reste
    total_eligibles = len(candidats)
    if args.max:
        candidats = candidats[:args.max]

    ecriture = not args.essai
    if ecriture and not bucket_existe(url_base, cle):
        raise SystemExit(f"Le bucket `{BUCKET}` n'existe pas : migration 0033 non appliquee. Rien n'a ete ecrit.")

    journal = Counter(fiches_traitees=len(candidats))
    print(f"Fiches eligibles : {total_eligibles} (source {args.source}) ; traitees : {len(candidats)} ; "
          f"deja en pause 90 j : {comptes['en_pause_90j']} ; mode : {'ESSAI' if args.essai else 'ECRITURE'}")

    # ---- Phase 1: unique pages
    pages = defaultdict(list)
    for c in candidats:
        pages[c["source_url"]].append(c)
    resultats, fait, verrou = {}, [0], threading.Lock()

    def tache_page(url):
        r = lire_page(url)
        with verrou:
            resultats[url] = r
            fait[0] += 1
            if fait[0] % 25 == 0:
                print(f"  pages {fait[0]}/{len(pages)}", flush=True)

    # Group by domain so one domain's pages go through its throttle without
    # blocking the others: the throttle itself is per host, the pool just overlaps hosts.
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(tache_page, sorted(pages, key=lambda u: hote_de(u))))

    par_statut = Counter(r["statut"] for r in resultats.values())
    journal["pages_lues"] = len(resultats)
    journal["pages_avec_balise"] = par_statut["ok"]
    for s in ("sans_image", "refus", "page_absente", "robots", "indisponible"):
        journal[f"pages_{s}"] = par_statut[s]

    # ---- Generic images: same image on more than 5 distinct pages of a domain
    # (pages counted in this run + generics already remembered).
    par_image = defaultdict(set)
    for url, r in resultats.items():
        for iu in r.get("candidats", []):
            par_image[(hote_de(url), iu)].add(url)
    for iu_key, ps in memoire.get("generiques", {}).items():
        dom, _, iu = iu_key.partition("|")
        par_image[(dom, iu)] |= set(ps)
    generiques = {k for k, v in par_image.items() if len(v) > SEUIL_GENERIQUE}

    # ---- Choose one image per page
    choix = {}                 # page -> image url
    raisons_ecart = {}         # page -> (statut, detail, image)
    ecartees_generiques = Counter()
    for url, r in resultats.items():
        if r["statut"] != "ok":
            continue
        retenues = []
        for iu in r["candidats"]:
            if (hote_de(url), iu) in generiques:
                ecartees_generiques["image_repetee"] += 1
            elif nom_generique(iu):
                ecartees_generiques["nom_generique"] += 1
            else:
                retenues.append(iu)
        if retenues:
            choix[url] = retenues
        else:
            raisons_ecart[url] = ("generique", "image generique (logo ou repetee)", r["candidats"][0])
    journal["pages_generiques_ecartees"] = len(raisons_ecart)

    # ---- Phase 2: images (unique URL), then writes
    images = defaultdict(list)           # image url -> pages that rank it first
    for url, lst in choix.items():
        images[lst[0]].append(url)
    traitees_img, octets_jpeg, ecrites, exemples = {}, [], [], []
    erreurs_ecriture = Counter()

    def tache_image(iu):
        pages_de = images[iu]
        p = preparer_image(iu)
        # Fallback on the next candidate of the first page when the first is unusable.
        if p["statut"] in ("petite", "image_invalide") and len(choix[pages_de[0]]) > 1:
            for suivante in choix[pages_de[0]][1:]:
                p2 = preparer_image(suivante)
                if p2["statut"] == "ok":
                    p, iu_ok = p2, suivante
                    break
            else:
                iu_ok = iu
        else:
            iu_ok = iu
        with verrou:
            traitees_img[iu] = (p, iu_ok)
        if p["statut"] != "ok":
            return
        for page in pages_de:
            for c in pages[page]:
                rec = {"event_id": c["id"], "title": c["title"], "source_url": page, "image_url": iu_ok,
                       "octets": len(p["jpeg"]), "dimensions": p["detail"]}
                if ecriture:
                    try:
                        pub = envoyer(url_base, cle, c["id"], p["jpeg"])
                        if ecrire_fiche(db, c["id"], pub):
                            rec["stockee_url"] = pub
                            rec["date"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
                            with verrou:
                                ecrites.append(rec)
                        else:
                            supprimer(url_base, cle, c["id"])
                            with verrou:
                                erreurs_ecriture["photos_non_vides_ou_checked_at"] += 1
                    except (urllib.error.URLError, SystemExit) as e:
                        with verrou:
                            erreurs_ecriture[type(e).__name__] += 1
                else:
                    with verrou:
                        ecrites.append(rec)
                octets_jpeg.append(len(p["jpeg"]))

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(tache_image, sorted(images, key=lambda u: hote_de(u))))

    par_img_statut = Counter(p["statut"] for p, _ in traitees_img.values())
    journal["images_ok"] = par_img_statut["ok"]
    for s in ("petite", "image_refusee", "image_invalide", "robots", "indisponible"):
        journal[f"images_{s}"] = par_img_statut[s]
    journal["fiches_utilisables" if args.essai else "fiches_ecrites"] = len(ecrites)
    journal["octets_jpeg"] = sum(octets_jpeg)
    journal["erreurs_ecriture"] = sum(erreurs_ecriture.values())

    # Fiches whose page is usable (a clean image was found), over pages read.
    fiches_utilisables_pct = (round(100 * par_img_statut["ok"] / max(1, len(resultats)), 1))

    # ---- Memory (real runs only)
    if ecriture:
        for rec in ecrites:
            memoire["ecrites"][rec["event_id"]] = {k: rec[k] for k in ("source_url", "image_url", "stockee_url", "date", "octets")}
            memoire["ecartees"].pop(rec["event_id"], None)
        date = maintenant.isoformat(timespec="seconds")
        for url, r in resultats.items():
            if r["statut"] in STATUTS_MEMORISES:
                for c in pages[url]:
                    memoire["ecartees"][c["id"]] = {"statut": r["statut"], "detail": r["detail"], "source_url": url, "date": date}
        for url, (st, det, iu) in raisons_ecart.items():
            for c in pages[url]:
                memoire["ecartees"][c["id"]] = {"statut": st, "detail": det, "source_url": url, "image_url": iu, "date": date}
        for iu, (p, iu_ok) in traitees_img.items():
            if p["statut"] in STATUTS_MEMORISES or p["statut"] == "petite":
                st = "generique" if p["statut"] == "petite" else p["statut"]
                for page in images[iu]:
                    for c in pages[page]:
                        memoire["ecartees"][c["id"]] = {"statut": st, "detail": p["detail"], "source_url": page,
                                                        "image_url": iu, "date": date}
        for (dom, iu), ps in par_image.items():
            if len(ps) > SEUIL_GENERIQUE:
                memoire["generiques"][f"{dom}|{iu}"] = sorted(ps)
        memoire["journal"].append({"date": date, "source": args.source, **dict(journal)})
        sauver_memoire(memoire)

    duree = round(time.monotonic() - debut, 1)
    print("\n=== Journal (R18) ===")
    print(f"Pages lues                     : {journal['pages_lues']}  (pour {len(candidats)} fiches)")
    print(f"  avec balise image            : {journal['pages_avec_balise']}")
    print(f"  sans image (ni og ni twitter): {journal['pages_sans_image']}")
    print(f"  refus 401/403/429            : {journal['pages_refus']}")
    print(f"  page absente 404/410         : {journal['pages_page_absente']}")
    print(f"  interdites par robots.txt    : {journal['pages_robots']}")
    print(f"  indisponibles (reseau, 5xx)  : {journal['pages_indisponible']}")
    print(f"Pages dont toutes les images sont generiques : {journal['pages_generiques_ecartees']} "
          f"(candidates ecartees : {dict(ecartees_generiques)})")
    print(f"Images telechargees utilisables: {journal['images_ok']} ; trop petites (<{LARGEUR_MIN}px): {journal['images_petite']} ; "
          f"refusees: {journal['images_image_refusee']} ; invalides: {journal['images_image_invalide']} ; "
          f"robots: {journal['images_robots']} ; indisponibles: {journal['images_indisponible']}")
    print(f"Pages avec image utilisable    : {par_img_statut['ok']}/{len(resultats)} = {fiches_utilisables_pct} %")
    n = len(ecrites)
    print(f"Fiches {'utilisables (rien ecrit)' if args.essai else 'ECRITES'} : {n} ; octets JPEG : {sum(octets_jpeg)}"
          f" (moyenne {round(sum(octets_jpeg) / max(1, len(octets_jpeg)))} o)")
    if erreurs_ecriture:
        print(f"Erreurs d'ecriture : {dict(erreurs_ecriture)}")
    print(f"Duree : {duree} s")
    print("Exemples :")
    for rec in ecrites[:20]:
        print(f"  {rec['event_id']} | {rec['title'][:50]} | {rec['image_url']} | {rec['dimensions']} | {rec['octets']} o")
    if args.essai:
        print("ESSAI : rien n'a ete ecrit (ni bucket, ni base, ni memoire).")


if __name__ == "__main__":
    main()
