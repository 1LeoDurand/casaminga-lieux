# -*- coding: utf-8 -*-
"""
Essai de la migration 0030_agenda_lecture_serveur.sql, SANS jamais la valider.

Tout se passe dans UNE transaction qui finit par un ROLLBACK (bloc finally) :
la migration, les fiches de test de la mesure de charge et les appels. Rien
n'est persiste. Le script refuse de tourner si le fichier SQL ouvre ou ferme
lui-meme une transaction (begin;, commit, rollback).

Il faut un acces SQL brut a la base (le service_role de PostgREST ne suffit
pas) : une chaine de connexion Postgres, dans DATABASE_URL ou SUPABASE_DB_URL
(environnement ou .env.local), ou --url. Elle n'est jamais affichee.
  Supabase : Project Settings > Database > Connection string (pooler, mode
  session, port 5432). Prerequis : pip install psycopg2-binary

Ce que le script fait :
  1. applique la migration (dans la transaction) ;
  2. verifie les droits : anon/authenticated n'executent que les 3 fonctions
     exposees, ne lisent pas evenements_recherche ;
  3. appelle agenda_series, agenda_epingles, agenda_compteurs avec 10
     combinaisons realistes (Herault, 50 km autour de Lodeve, atelier, mot
     libre...) et imprime lignes et durees (mur Python, meilleur de 3, et
     temps d'execution serveur de EXPLAIN ANALYZE) ;
  4. verifie la borne p_limite (10 000 demande, 60 lignes au plus) ;
  5. mesure de charge (section 7 de la conception) : copie des fiches
     publiques existantes jusqu'a --cible fiches publiques au total, dates
     decalees, puis rejoue les appels ;
  6. ROLLBACK, puis contre-verification sur une connexion neuve (la fonction
     n'existe pas : rien n'a ete garde).

Usage :
  python scripts/essai-migration-0030.py
  python scripts/essai-migration-0030.py --cible 20000
  python scripts/essai-migration-0030.py --sans-charge
  python scripts/essai-migration-0030.py --url postgresql://... --fuseau-posix

--fuseau-posix : UNIQUEMENT pour une base locale sans donnees de fuseaux
horaires (Postgres embarque sous Windows) : remplace 'Europe/Paris' par son
equivalent POSIX. Jamais sur Supabase.

Attention (base distante) : les fiches de test sont inserees dans la table
evenements, donc les declencheurs de l'admin s'y executent. Ils sont annules
avec la transaction ; un effet de bord HORS base (extension http, notify) ne
serait pas annule : verifier d'abord qu'aucun declencheur de ce genre n'existe.
"""

import argparse
import json
import os
import re
import statistics
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import psycopg2
    import psycopg2.extras
except ImportError:  # pragma: no cover
    sys.exit("psycopg2 manquant : pip install psycopg2-binary")

RACINE = Path(__file__).resolve().parent.parent
MIGRATION = RACINE / "supabase" / "migrations" / "0030_agenda_lecture_serveur.sql"
SEUIL_MS = 300  # seuil de la conception, par fonction, cote base

PARIS_POSIX = "CET-1CEST,M3.5.0,M10.5.0/3"

# PORTAL_FORMATS (casa-minga-public/src/lib/portal-search.ts), copie de travail
FORMATS = [
    {"id": "rencontres", "types": ["rencontre", "conference"], "termes": ["rencontre", "debat", "conference", "cafe", "permanence"]},
    {"id": "ateliers", "types": ["atelier", "formation", "repair-cafe", "chantier", "jardin"], "termes": ["atelier", "initiation", "formation", "stage", "chantier"]},
    {"id": "expositions", "types": ["exposition"], "termes": ["exposition", "expo", "vernissage", "galerie"]},
    {"id": "spectacles", "types": ["spectacle"], "termes": ["spectacle", "theatre", "cirque", "danse"]},
    {"id": "concerts", "types": ["concert"], "termes": ["concert", "musique", "chorale", "bal"]},
    {"id": "marches", "types": ["marche"], "termes": ["marche", "troc", "brocante", "vide grenier", "zone de gratuite"]},
    {"id": "apprendre", "types": ["formation", "stage", "atelier"], "termes": ["formation", "stage", "atelier", "initiation", "cursus"]},
    {"id": "partir", "types": ["retraite", "sejour"], "duree_min_jours": 2, "termes": ["retraite", "sejour", "ressourcement", "immersion"]},
]
ATELIER = {"p_types": FORMATS[1]["types"], "p_termes_titre": FORMATS[1]["termes"]}
LODEVE = {"p_lat": 43.7314, "p_lng": 3.3178, "p_rayon_km": 50, "p_commune": "Lodève"}


def lire_url(args):
    if args.url:
        return args.url
    for cle in ("DATABASE_URL", "SUPABASE_DB_URL"):
        if os.environ.get(cle):
            return os.environ[cle]
    env = RACINE / ".env.local"
    if env.exists():
        for ligne in env.read_text(encoding="utf-8").splitlines():
            m = re.match(r"\s*(DATABASE_URL|SUPABASE_DB_URL)\s*=\s*(.+)", ligne)
            if m:
                return m.group(2).strip().strip("\"'")
    return None


def jour_paris(delta=0):
    """Minuit du jour (heure de Paris approchee par UTC+2/+1 : suffisant ici)."""
    n = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return n + timedelta(days=delta)


def combinaisons():
    d0, d1 = jour_paris(0), jour_paris(1)
    return [
        ("defaut (12 mois)", {}),
        ("Herault (texte)", {"p_commune": "Hérault"}),
        ("Lodeve 50 km", LODEVE),
        ("atelier", ATELIER),
        ("atelier + Lodeve 50 km", {**ATELIER, **LODEVE}),
        ("mot libre: jardin", {"p_mots": ["jardin"]}),
        ("deux mots: repair cafe", {"p_mots": ["repair", "cafe"]}),
        ("soir + gratuit", {"p_creneau": "soir", "p_gratuit": True}),
        ("aujourd'hui", {"p_debut": d0, "p_fin": d1}),
        ("tout cumule", {**ATELIER, **LODEVE, "p_mots": ["jardin"], "p_creneau": "matin"}),
    ]


MOMENTS = lambda: {  # noqa: E731
    "aujourdhui": {"debut": jour_paris(0).isoformat(), "fin": jour_paris(1).isoformat()},
    "weekend": {"debut": jour_paris(0).isoformat(), "fin": jour_paris(3).isoformat()},
    "semaine": {"debut": jour_paris(0).isoformat(), "fin": jour_paris(6).isoformat()},
}


def appel_sql(fonction, kw):
    noms = list(kw)
    liste = ", ".join(f"{n} => %s" for n in noms)
    return f"select * from public.{fonction}({liste})", [kw[n] for n in noms]


def mesurer(cur, fonction, kw):
    sql, args = appel_sql(fonction, kw)
    # jsonb parameters: wrap explicitly (a list of dicts would be sent as an array)
    args = [psycopg2.extras.Json(a) if n in ("p_moments", "p_formats") else a for n, a in zip(kw, args)]
    meilleur, lignes = 1e9, None
    for _ in range(3):
        t = time.perf_counter()
        cur.execute(sql, args)
        lignes = cur.fetchall()
        meilleur = min(meilleur, time.perf_counter() - t)
    cur.execute("explain (analyze, costs off) " + sql, args)
    serveur = None
    for (l,) in cur.fetchall():
        m = re.search(r"Execution Time: ([\d.]+) ms", l)
        if m:
            serveur = float(m.group(1))
    return lignes, meilleur * 1000, serveur


def passer_les_appels(cur, etiquette):
    print(f"\n== {etiquette} ==")
    print(f"{'combinaison':26}{'series':>8}{'total':>7}{'ms':>7}{'srv':>7} | {'epingles':>8}{'ms':>7}{'srv':>7} | {'compteurs':>9}{'ms':>7}{'srv':>7}")
    pire = 0.0
    resume = []
    for nom, kw in combinaisons():
        l1, m1, s1 = mesurer(cur, "agenda_series", kw)
        total = l1[0][-1] if l1 else 0
        l2, m2, s2 = mesurer(cur, "agenda_epingles", kw)
        kw3 = {**kw, "p_moments": MOMENTS(), "p_formats": FORMATS}
        l3, m3, s3 = mesurer(cur, "agenda_compteurs", kw3)
        compte = l3[0][0]["total"] if l3 else None
        pire = max(pire, s1 or 0, s2 or 0, s3 or 0)
        print(f"{nom:26}{len(l1):8}{total:7}{m1:7.0f}{(s1 or 0):7.0f} | {len(l2):8}{m2:7.0f}{(s2 or 0):7.0f} | {str(compte):>9}{m3:7.0f}{(s3 or 0):7.0f}")
        resume.append((nom, total, compte))
        if compte is not None and compte != total:
            print(f"   !! ECART : agenda_series.total={total} mais agenda_compteurs.total={compte}")
    print(f"pire temps serveur : {pire:.0f} ms (seuil {SEUIL_MS} ms) -> {'OK' if pire <= SEUIL_MS else 'AU-DESSUS'}")
    return resume


def verifier_droits(cur):
    print("\n== droits ==")
    cur.execute(
        """select p.proname, pg_get_function_identity_arguments(p.oid) args,
                  has_function_privilege('anon', p.oid, 'execute'),
                  has_function_privilege('authenticated', p.oid, 'execute'),
                  has_function_privilege('service_role', p.oid, 'execute')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and (p.proname like 'agenda\\_%' or p.proname in ('texte_normalise', 'evenements_recherche_maj'))
            order by 1"""
    )
    exposees = {"agenda_series", "agenda_compteurs", "agenda_epingles"}
    ok = True
    for nom, _args, anon, auth, svc in cur.fetchall():
        attendu = nom in exposees
        bon = (anon == attendu) and (auth == attendu)
        ok &= bon
        print(f"  {'OK ' if bon else 'KO '} {nom:28} anon={anon!s:5} authenticated={auth!s:5} service_role={svc!s:5}")
    cur.execute(
        "select has_table_privilege('anon','public.evenements_recherche','select'),"
        " has_table_privilege('authenticated','public.evenements_recherche','select'),"
        " has_table_privilege('anon','public.evenements_recherche','insert')"
    )
    a, b, c = cur.fetchone()
    bon = not (a or b or c)
    ok &= bon
    print(f"  {'OK ' if bon else 'KO '} evenements_recherche : anon select={a} authenticated select={b} anon insert={c} (attendu : tout faux)")

    # Vrai appel sous le role anon (comme le site) : les 3 fonctions passent,
    # la table et les fonctions internes sont refusees.
    essais = [
        ("agenda_series() en anon", "select count(*) from public.agenda_series()", True),
        ("agenda_epingles() en anon", "select count(*) from public.agenda_epingles()", True),
        ("agenda_compteurs() en anon", "select public.agenda_compteurs()", True),
        ("select evenements_recherche en anon", "select count(*) from public.evenements_recherche", False),
        ("agenda_lignes() en anon", "select count(*) from public.agenda_lignes(null,null,true,null,null,null,null,null,null,null,null,null,null,null,null)", False),
    ]
    for nom, sql, doit_passer in essais:
        cur.execute("savepoint r")
        try:
            cur.execute("set local role anon")
            cur.execute(sql)
            cur.fetchall()
            passe = True
        except psycopg2.Error:
            passe = False
        finally:
            cur.execute("rollback to savepoint r")
        bon = passe == doit_passer
        ok &= bon
        print(f"  {'OK ' if bon else 'KO '} {nom:38} {'accepte' if passe else 'refuse'} (attendu : {'accepte' if doit_passer else 'refuse'})")
    return ok


def verifier_bornes(cur):
    print("\n== bornes ==")
    cur.execute("select count(*) from public.agenda_series(p_limite => 10000)")
    n = cur.fetchone()[0]
    print(f"  p_limite=10000 -> {n} lignes (60 au plus) : {'OK' if n <= 60 else 'KO'}")
    cur.execute("select count(*) from public.agenda_series(p_decalage => -50, p_limite => 0)")
    print(f"  p_decalage=-50, p_limite=0 -> {cur.fetchone()[0]} ligne(s) : pas d'erreur")
    cur.execute("select count(*) from public.agenda_series(p_mots => array['a', repeat('z', 500), 'x y z w v u t s r q'])")
    print(f"  mots hors bornes -> {cur.fetchone()[0]} lignes, pas d'erreur")
    cur.execute("select count(*) from public.agenda_series(p_mots => array['%', '_', '\\'])")
    print(f"  mots % _ \\ -> {cur.fetchone()[0]} lignes (jokers neutralises)")
    cur.execute("select count(*) from public.agenda_series(p_rayon_km => 7, p_lat => 43.7, p_lng => 3.3)")
    print(f"  rayon 7 km (ramene a 10) -> {cur.fetchone()[0]} lignes, pas d'erreur")
    cur.execute(
        "select count(*) from public.agenda_series(p_debut => now(), p_fin => now() + interval '10 years')"
    )
    print(f"  fenetre de 10 ans (ramenee a 400 jours) -> {cur.fetchone()[0]} lignes, pas d'erreur")


def charge(cur, cible):
    cur.execute(
        "select count(*) from public.evenements where show_on_public_site and status in ('publie','confirme','planifie')"
    )
    existantes = cur.fetchone()[0]
    a_creer = max(0, cible - existantes)
    print(f"\n== charge : {existantes} fiches publiques, {a_creer} a ajouter pour {cible} ==")
    if not a_creer:
        return
    t = time.perf_counter()
    cur.execute(
        """
        insert into public.evenements
          (id, title, description, organization_id, type, status, start_at, end_at,
           capacity, price, photos, show_on_public_site, establishment_id, portal_status,
           created_at, updated_at)
        select gen_random_uuid(),
               case when mod(g, 2) = 0 then e.title else e.title || ' ' || g end,
               e.description, e.organization_id, e.type, 'publie',
               e.start_at + make_interval(days => mod(g * 13, 120)),
               e.end_at + make_interval(days => mod(g * 13, 120)),
               e.capacity, e.price, e.photos, true, e.establishment_id, e.portal_status,
               now(), now()
          from (select * from public.evenements
                 where show_on_public_site and status in ('publie','confirme','planifie')
                   and end_at >= now()) e
         cross join generate_series(1, ceil(%s::numeric / greatest((select count(*) from public.evenements
                 where show_on_public_site and status in ('publie','confirme','planifie') and end_at >= now()), 1))::int) g
         limit %s
        """,
        (a_creer, a_creer),
    )
    print(f"  {cur.rowcount} fiches de test inserees en {time.perf_counter() - t:.1f} s (declencheur de recherche compris)")
    cur.execute("analyze public.evenements")
    cur.execute("analyze public.evenements_recherche")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", help="chaine de connexion Postgres (sinon DATABASE_URL / SUPABASE_DB_URL)")
    ap.add_argument("--cible", type=int, default=20000, help="nombre de fiches publiques apres ajout (defaut 20000)")
    ap.add_argument("--sans-charge", action="store_true")
    ap.add_argument("--fuseau-posix", action="store_true", help="base locale sans tzdata uniquement")
    args = ap.parse_args()

    sql = MIGRATION.read_text(encoding="utf-8")
    # plpgsql bodies have a bare "begin": only a transaction statement counts
    if re.search(r"^\s*(begin\s*;|begin\s+transaction|start\s+transaction|commit\b|rollback\b)", sql, re.I | re.M):
        sys.exit("La migration contient begin/commit/rollback : l'essai refuse de la lancer.")
    if args.fuseau_posix:
        sql = sql.replace("'Europe/Paris'", f"'{PARIS_POSIX}'")

    url = lire_url(args)
    if not url:
        sys.exit(
            "Aucune chaine de connexion Postgres (DATABASE_URL, SUPABASE_DB_URL ou --url).\n"
            "Le service_role de PostgREST ne permet pas d'executer du SQL brut : rien n'a ete lance."
        )

    conn = psycopg2.connect(url, connect_timeout=15)
    conn.autocommit = False  # une seule transaction, jamais validee
    cur = conn.cursor()
    code = 0
    try:
        cur.execute("set local statement_timeout = '120s'")
        t = time.perf_counter()
        cur.execute(sql)
        print(f"migration appliquee DANS la transaction en {time.perf_counter() - t:.1f} s")
        cur.execute("select count(*) from public.evenements_recherche")
        print(f"evenements_recherche : {cur.fetchone()[0]} lignes apres remplissage")

        if not verifier_droits(cur):
            code = 1
        passer_les_appels(cur, "base actuelle")
        verifier_bornes(cur)
        if not args.sans_charge:
            charge(cur, args.cible)
            passer_les_appels(cur, f"charge : {args.cible} fiches publiques")
    finally:
        conn.rollback()
        conn.close()
        print("\nROLLBACK effectue.")

    verif = psycopg2.connect(url, connect_timeout=15)
    c2 = verif.cursor()
    c2.execute("select to_regproc('public.agenda_series') is null, to_regclass('public.evenements_recherche') is null")
    f_absente, t_absente = c2.fetchone()
    verif.close()
    print(f"contre-verification (connexion neuve) : fonction absente={f_absente}, table absente={t_absente}")
    if not (f_absente and t_absente):
        print("(si la migration a deja ete appliquee ailleurs, c'est normal)")
    sys.exit(code)


if __name__ == "__main__":
    main()
