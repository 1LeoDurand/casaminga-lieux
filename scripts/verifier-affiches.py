# -*- coding: utf-8 -*-
"""
Verifie que les affiches des evenements a venir s'affichent depuis casaminga.com.

Contexte (audit graphique du 2026-09-29) : certains hotes refusent l'affichage
hors de leur site (403 anti-hotlink, 429 limite de debit) ; la reponse d'erreur
est bloquee par le navigateur (ORB) : carte sans image et requete en echec.

Usage :
    python scripts/verifier-affiches.py            # essai (defaut), AUCUNE ecriture
    python scripts/verifier-affiches.py --essai    # idem
    python scripts/verifier-affiches.py --ecrire   # REFUSE tant que AUTORISE_ECRITURE est False

Le mode essai ne fait que des lectures : GET sur la base (cle de service lue
dans .env.local, jamais affichee) et GET sur les URL d'affiches.
"""

import argparse
import json
import ssl
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

# Same certificate fix as import-sites.py: the system store on this machine
# holds an expired authority, so certifi is the reference store when present.
try:
    import certifi
    _CTX_HTTPS = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _CTX_HTTPS = ssl.create_default_context()  # weaker: system store

from import_commun import Base, load_env  # noqa: E402

# ---------------------------------------------------------------------------
# Write guard. Whether refused posters are removed from `photos` is a product
# decision that belongs to Leo. Set to True on 2026-09-30 after his "fais tout"
# in the chat, once migration 0022 (photos_retirees) was applied.
# Do NOT flip it from a script, a CI job or an automated agent.
# ---------------------------------------------------------------------------
AUTORISE_ECRITURE = True

# Only definite refusals are removed. Network errors (timeouts, resets) are
# ambiguous, a slow host is not a refusing host: they stay in `photos` until a
# second pass confirms them.
CATEGORIES_RETIREES = {"403", "404", "type"}

USER_AGENT = "CasamingaBot/1.0 (+https://casaminga.com/contact)"
TIMEOUT = 12            # seconds per request
MAX_BYTES = 64 * 1024   # never read more than 64 KB of a poster
MAX_PARALLELE_DOMAINES = 8
DELAI_PAR_DOMAINE = 1.0  # seconds between two requests to the same domain
ESSAIS_RESEAU = 2
HOTES_IGNORES = {"img.openagenda.com"}

RAPPORT = Path(__file__).resolve().parent / "data" / "verifier-affiches-2026-09-30.json"

# Headers of a browser loading an <img> from casaminga.com.
EN_TETES = {
    "User-Agent": USER_AGENT,
    "Referer": "https://casaminga.com/",
    "Origin": "https://casaminga.com",
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "cross-site",
    "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
}

# What --ecrire would do, copied into the report (see also the module notes).
PLAN_ECRITURE = {
    "colonne_evenements": (
        "evenements.photos est un text[] (pas du JSON) : --ecrire reconstruirait "
        "le tableau SANS les URL refusees (PATCH evenements?id=eq.<id>, "
        "photos=[...restantes]). Ni NULL (la colonne est not null par defaut '{}' "
        "cote import) ni suppression de ligne : un tableau vide fait prendre "
        "l'image de categorie a la fiche, et un tableau partiel garde les "
        "affiches qui marchent."),
    "trace": (
        "evenements_import.source_url est l'URL de la PAGE de l'evenement, pas "
        "celle de l'affiche : elle ne permet pas de retrouver l'image. Aucune "
        "autre colonne (event_id, source, source_uid, source_url, conditions, "
        "registration, imported_at, checked_at) ne la porte. Proposition : "
        "colonne additive evenements_import.photos_retirees text[] not null "
        "default '{}' (migration non appliquee, voir migration_proposee)."),
    "retour_arriere": (
        "Retour arriere : PATCH evenements photos = photos || photos_retirees "
        "pour les evenements concernes, puis photos_retirees = '{}'."),
    "ordre": (
        "Ordre des ecritures : 1) ecrire photos_retirees dans evenements_import, "
        "2) seulement ensuite retirer l'entree de evenements.photos. Si l'etape 1 "
        "echoue, rien n'est retire."),
    "migration_proposee": (
        "-- 00NN_evenements_import_photos_retirees.sql (NON APPLIQUEE)\n"
        "alter table public.evenements_import\n"
        "  add column if not exists photos_retirees text[] not null default '{}';\n"
        "comment on column public.evenements_import.photos_retirees is\n"
        "  'Affiches retirees de evenements.photos car leur hote refuse l''affichage hors de son site (verifier-affiches.py).';\n"
        "-- GRANT explicite si necessaire (cf. 0018) : la table existe deja, les droits ne changent pas."),
}


def hote_de(url):
    return (urllib.parse.urlsplit(url).hostname or "").lower()


def est_stockage_supabase(url, hote_base):
    return hote_de(url) == hote_base or "/storage/v1/" in url


def lire_evenements(db):
    maintenant = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    chemin = ("evenements?select=id,title,start_at,photos"
              "&show_on_public_site=eq.true"
              f"&start_at=gte.{urllib.parse.quote(maintenant)}")
    return db.lire_tout(chemin)


# ---------------------------------------------------------------------------
# Network probe
# ---------------------------------------------------------------------------

def tester_url(url):
    """One URL -> {statut: 'OK'|'REFUS', categorie, detail}. Retries only on
    network errors (never on an HTTP answer)."""
    dernier = "reseau"
    for essai in range(ESSAIS_RESEAU):
        req = urllib.request.Request(url, headers=EN_TETES, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT, context=_CTX_HTTPS) as r:
                ctype = (r.headers.get("Content-Type") or "").split(";")[0].strip().lower()
                r.read(MAX_BYTES)
                code = r.status
            if code == 200 and ctype.startswith("image/"):
                return {"statut": "OK", "categorie": "OK", "detail": f"200 {ctype}"}
            if "html" in ctype:
                cat = "HTML"
            elif code != 200:
                cat = str(code)
            else:
                cat = "type"
            return {"statut": "REFUS", "categorie": cat, "detail": f"{code} {ctype or 'sans type'}"}
        except urllib.error.HTTPError as e:
            return {"statut": "REFUS", "categorie": str(e.code), "detail": f"HTTP {e.code}"}
        except (urllib.error.URLError, TimeoutError, ssl.SSLError, ConnectionError, OSError, ValueError) as e:
            dernier = f"{type(e).__name__}: {getattr(e, 'reason', e)}"[:120]
            if essai + 1 < ESSAIS_RESEAU:
                time.sleep(DELAI_PAR_DOMAINE)
    return {"statut": "REFUS", "categorie": "reseau", "detail": dernier}


def tester_domaine(urls):
    """Sequential probe of one domain's URLs, one request per second."""
    sortie, dernier = {}, 0.0
    for u in urls:
        attente = DELAI_PAR_DOMAINE - (time.monotonic() - dernier)
        if attente > 0 and dernier:
            time.sleep(attente)
        dernier = time.monotonic()
        sortie[u] = tester_url(u)
    return sortie


# ---------------------------------------------------------------------------
# Write mode (guarded)
# ---------------------------------------------------------------------------

def ecrire(db, refus_par_evenement):
    """Move refused URLs from evenements.photos to evenements_import.photos_retirees.
    Requires the additive migration proposed in PLAN_ECRITURE (not applied)."""
    if not AUTORISE_ECRITURE:
        raise SystemExit(
            "REFUSE : AUTORISE_ECRITURE est False. Le retrait des affiches de "
            "`photos` est une decision de Leo ; rien n'a ete ecrit.")
    n = 0
    for evid, (photos, retirees) in refus_par_evenement.items():
        if not retirees:
            continue
        restantes = [p for p in photos if p not in retirees]
        # Trace first, removal second: if the trace fails, nothing is removed.
        db._call("PATCH", f"evenements_import?event_id=eq.{evid}",
                 {"photos_retirees": retirees}, headers={"Prefer": "return=minimal"})
        db._call("PATCH", f"evenements?id=eq.{evid}",
                 {"photos": restantes}, headers={"Prefer": "return=minimal"})
        n += 1
    return n


# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--essai", action="store_true", help="lecture seule (defaut)")
    mode.add_argument("--ecrire", action="store_true", help="refuse tant que AUTORISE_ECRITURE est False")
    args = ap.parse_args()

    if args.ecrire and not AUTORISE_ECRITURE:
        raise SystemExit(
            "REFUSE : AUTORISE_ECRITURE est False. Le retrait des affiches de "
            "`photos` est une decision de Leo ; rien n'a ete ecrit.")

    debut = time.monotonic()
    url_base, cle = load_env()
    hote_base = hote_de(url_base)
    db = Base(url_base, cle)

    evenements = lire_evenements(db)
    urls_par_evt = defaultdict(list)
    ignorees = Counter()
    for ev in evenements:
        for u in ev.get("photos") or []:
            h = hote_de(u)
            if not u.startswith(("http://", "https://")):
                ignorees["non_http"] += 1
            elif est_stockage_supabase(u, hote_base):
                ignorees["stockage_supabase"] += 1
            elif h in HOTES_IGNORES:
                ignorees["openagenda"] += 1
            else:
                urls_par_evt[ev["id"]].append(u)

    # One probe per distinct URL, grouped by domain.
    uniques = sorted({u for us in urls_par_evt.values() for u in us})
    par_domaine = defaultdict(list)
    for u in uniques:
        par_domaine[hote_de(u)].append(u)

    print(f"Evenements a venir visibles : {len(evenements)}")
    print(f"URL a tester : {len(uniques)} sur {len(par_domaine)} domaines "
          f"(ignorees : {dict(ignorees) or 0})")

    resultats = {}
    fait = [0]
    verrou = threading.Lock()

    def travail(dom):
        res = tester_domaine(par_domaine[dom])
        with verrou:
            resultats.update(res)
            fait[0] += len(res)
            print(f"  {fait[0]}/{len(uniques)} ({dom})", flush=True)

    with ThreadPoolExecutor(max_workers=MAX_PARALLELE_DOMAINES) as pool:
        list(pool.map(travail, sorted(par_domaine, key=lambda d: -len(par_domaine[d]))))

    # Aggregation
    ok = sum(1 for r in resultats.values() if r["statut"] == "OK")
    refus = {u: r for u, r in resultats.items() if r["statut"] == "REFUS"}
    par_hote = defaultdict(Counter)
    tests_par_hote = Counter(hote_de(u) for u in resultats)
    for u, r in refus.items():
        par_hote[hote_de(u)][r["categorie"]] += 1
    par_code = Counter(r["categorie"] for r in refus.values())

    # Events touched: at least one refused poster / would end with no poster.
    refus_par_evenement = {}
    for ev in evenements:
        photos = ev.get("photos") or []
        retirees = [u for u in photos if u in refus]
        if retirees:
            refus_par_evenement[ev["id"]] = (photos, retirees)
    sans_affiche = sum(1 for p, r in refus_par_evenement.values() if len(r) == len(p))

    # 15 examples, spread across hosts (round robin, hosts by refusal count).
    files = {h: [u for u in refus if hote_de(u) == h] for h in par_hote}
    ordre = sorted(files, key=lambda h: -len(files[h]))
    exemples = []
    while len(exemples) < 15 and any(files.values()):
        for h in ordre:
            if files[h] and len(exemples) < 15:
                u = files[h].pop(0)
                exemples.append({"url": u, "hote": h, **refus[u]})

    duree = round(time.monotonic() - debut, 1)
    rapport = {
        "date": "2026-09-30",
        "mode": "essai (aucune ecriture)",
        "evenements_a_venir_visibles": len(evenements),
        "urls_ignorees": dict(ignorees),
        "urls_testees": len(resultats),
        "ok": ok,
        "refus": len(refus),
        "refus_par_code": dict(par_code),
        "refus_par_hote": {h: {"testees": tests_par_hote[h], "refus": sum(c.values()), "par_code": dict(c)}
                           for h, c in sorted(par_hote.items(), key=lambda kv: -sum(kv[1].values()))},
        "evenements_touches": len(refus_par_evenement),
        "evenements_sans_aucune_affiche_apres_retrait": sans_affiche,
        "exemples_refus": exemples,
        "duree_secondes": duree,
        "ce_que_ferait_ecrire": PLAN_ECRITURE,
    }
    RAPPORT.parent.mkdir(parents=True, exist_ok=True)
    RAPPORT.write_text(json.dumps(rapport, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\nURL testees : {len(resultats)} | OK : {ok} | REFUS : {len(refus)}")
    print(f"REFUS par code : {dict(par_code)}")
    print("REFUS par hote :")
    for h, c in sorted(par_hote.items(), key=lambda kv: -sum(kv[1].values())):
        print(f"  {h:40s} {sum(c.values()):4d}/{tests_par_hote[h]:<4d} {dict(c)}")
    print(f"Evenements touches : {len(refus_par_evenement)} (dont {sans_affiche} sans aucune affiche restante)")
    print("Exemples de REFUS :")
    for e in exemples:
        print(f"  [{e['categorie']}] {e['url']}")
    print(f"Duree : {duree} s")
    print(f"Rapport : {RAPPORT}")
    print("\nCe que ferait --ecrire :")
    for k in ("colonne_evenements", "trace", "retour_arriere", "ordre"):
        print(f"- {PLAN_ECRITURE[k]}")

    if not args.ecrire:
        print("ESSAI : aucune ecriture en base.")
        return

    # Write mode: definite refusals only (see CATEGORIES_RETIREES).
    a_retirer = {}
    for evid, (photos, retirees) in refus_par_evenement.items():
        sures = [u for u in retirees if refus[u]["categorie"] in CATEGORIES_RETIREES]
        if sures:
            a_retirer[evid] = (photos, sures)
    laissees = sum(len(r) for _, r in refus_par_evenement.values()) - sum(len(r) for _, r in a_retirer.values())
    n = ecrire(db, a_retirer)
    print(f"\nECRIT : {n} evenements, {sum(len(r) for _, r in a_retirer.values())} affiches deplacees "
          f"vers evenements_import.photos_retirees ; {laissees} refus reseau laisses en place.")
    rapport["mode"] = "ecrire"
    rapport["ecrit"] = {"evenements": n, "affiches_retirees": sum(len(r) for _, r in a_retirer.values()),
                        "refus_reseau_laisses": laissees}
    RAPPORT.write_text(json.dumps(rapport, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
