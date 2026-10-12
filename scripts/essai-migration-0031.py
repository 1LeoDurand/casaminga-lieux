#!/usr/bin/env python3
"""Dry run of supabase/migrations/0031_import_retraits.sql, always rolled back.

Everything happens in ONE transaction that is rolled back at the end (and on
any error): the migration is never applied, no test row survives.

What it does
  1. reads (read only) an imported test organization: unclaimed, no member,
     3 to 12 events, at least one description and one photo, a published
     technical showcase, preferably linked to a directory row;
  2. inside the transaction, makes the case harder: one event already hidden
     for another reason, one event with photos_retirees;
  3. photographs the state, runs the migration, then:
       - rights (anon / authenticated / service_role) and the new RLS policy;
       - retrait_poser 'medias', duplicate refused, 'fiches', human correction,
         retrait_lever in the right order, back to the photographed state;
       - same in the wrong order (lift 'medias' before 'fiches');
       - 'import' (directory row hidden then shown again);
  4. rolls back and prints a verdict. Exit code 0 only if every check passed.

Needs a raw SQL connection: psycopg2 (pip install psycopg2-binary) and
DATABASE_URL or SUPABASE_DB_URL (.env.local or environment). The value is
never printed. Without them the script stops with exit code 2 and does nothing.

Usage:  python scripts/essai-migration-0031.py
"""
import os
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

RACINE = Path(__file__).resolve().parent.parent
MIGRATION = RACINE / "supabase" / "migrations" / "0031_import_retraits.sql"
PUBLIC_STATUSES = "('publie','confirme','planifie')"

echecs = []


def verifier(libelle, condition, detail=""):
    ok = bool(condition)
    print(f"  [{'ok' if ok else 'ECHEC'}] {libelle}" + (f" ({detail})" if detail and not ok else ""))
    if not ok:
        echecs.append(libelle)
    return ok


def url_base():
    env = {}
    p = RACINE / ".env.local"
    if p.exists():
        env = dict(re.findall(r"^([A-Z_]+)=(.*)$", p.read_text(encoding="utf-8"), re.M))
    for nom in ("DATABASE_URL", "SUPABASE_DB_URL"):
        v = (env.get(nom) or os.environ.get(nom) or "").strip().strip('"').strip("'")
        if v:
            return v
    return None


try:
    import psycopg2
except ImportError:
    print("psycopg2 absent (pip install psycopg2-binary). Rien n'a ete execute.")
    sys.exit(2)

URL = url_base()
if not URL:
    print("Ni DATABASE_URL ni SUPABASE_DB_URL dans .env.local ou l'environnement. Rien n'a ete execute.")
    sys.exit(2)

conn = psycopg2.connect(URL)
conn.autocommit = False
cur = conn.cursor()


def q(sql, params=None):
    cur.execute(sql, params)
    return cur.fetchall() if cur.description else None


def q1(sql, params=None):
    r = q(sql, params)
    return r[0][0] if r else None


def attendu_erreur(sql, params, fragment, libelle):
    """Run a statement that must fail with a message containing `fragment`."""
    cur.execute("savepoint essai")
    try:
        cur.execute(sql, params)
        cur.execute("release savepoint essai")
        verifier(libelle, False, "aucune erreur")
        return
    except psycopg2.Error as e:
        cur.execute("rollback to savepoint essai")
        cur.execute("release savepoint essai")
        verifier(libelle, fragment in str(e), str(e).splitlines()[0][:120])


def etat(org):
    ev = q("""select e.id::text, e.show_on_public_site, e.description, coalesce(e.photos, '{}'),
                     i.checked_at, i.photos_retirees
                from public.evenements e
                left join public.evenements_import i on i.event_id = e.id
               where e.organization_id = %s order by e.id""", (org,))
    vit = q("select id::text, status from public.public_sites where organization_id = %s order by id", (org,))
    ann = q("""select id::text, masque, motif_masquage from public.annuaire_lieux
                where organization_id = %s order by id""", (org,))
    return {"ev": ev, "vit": vit, "ann": ann}


def difference(a, b, ignorer=()):
    """Event ids whose state differs, plus 'vit' / 'ann' when those differ."""
    da = {r[0]: r for r in a["ev"]}
    db = {r[0]: r for r in b["ev"]}
    diff = [k for k in da if k in db and da[k] != db[k] and k not in ignorer]
    diff += [k for k in set(da) ^ set(db)]
    if a["vit"] != b["vit"]:
        diff.append("vit")
    if a["ann"] != b["ann"]:
        diff.append("ann")
    return diff


def poser(org, portee, source=None, ann=None, motif="essai de retrait", canal="equipe"):
    return q1("select public.retrait_poser(%s::uuid, %s::uuid, %s, %s, %s, %s, null, current_date, 'essai@test.invalid')",
              (org, ann, portee, source, motif, canal))


def lever(rid, motif="essai de levee"):
    return q1("select public.retrait_lever(%s::uuid, %s, 'essai@test.invalid')", (rid, motif))


try:
    cur.execute("set local lock_timeout = '5s'")
    cur.execute("set local statement_timeout = '60s'")

    print("== Organisation de test (lecture seule)")
    rows = q("""
        select o.id::text, o.name, count(e.id) as n,
               exists (select 1 from public.annuaire_lieux a where a.organization_id = o.id) as a_annuaire
          from public.organizations o
          join public.evenements e on e.organization_id = o.id
         where o.claimed_at is null
           and o.source in ('openagenda', 'datatourisme', 'site', 'collecte_casaminga')
           and not exists (select 1 from public.organization_members m where m.organization_id = o.id)
           and exists (select 1 from public.public_sites s where s.organization_id = o.id and s.status = 'publie')
         group by o.id, o.name
        having count(e.id) between 3 and 12
           and bool_or(coalesce(btrim(e.description), '') <> '')
           and bool_or(coalesce(array_length(e.photos, 1), 0) > 0)
         order by 4 desc, 3, 1
         limit 1""")
    if not rows:
        print("Aucune organisation importee de test ne convient. Rien n'a ete modifie.")
        conn.rollback()
        sys.exit(2)
    ORG, nom, n_ev, a_annuaire = rows[0]
    print(f"  {nom} ({ORG}), {n_ev} fiches, annuaire lie : {'oui' if a_annuaire else 'non'}")

    ids = [r[0] for r in q("select id::text from public.evenements where organization_id = %s order by id", (ORG,))]
    ev_masque, ev_retiree = ids[0], ids[1]
    ev_corrige = q1("""select id::text from public.evenements
                        where organization_id = %s and id::text <> %s
                          and coalesce(btrim(description), '') <> '' order by id limit 1""", (ORG, ev_masque))

    # Harder case, inside the transaction only.
    q("update public.evenements set show_on_public_site = false where id = %s::uuid", (ev_masque,))
    q("""update public.evenements_import set photos_retirees = array['https://exemple.invalid/affiche.jpg']
          where event_id = %s::uuid""", (ev_retiree,))
    S0 = etat(ORG)
    cur.execute("savepoint avant_anon")
    cur.execute("set local role anon")
    nb_masquees_avant = q1(f"""select count(*) from public.evenements
                                where not show_on_public_site and status in {PUBLIC_STATUSES}""")
    cur.execute("reset role")
    cur.execute("release savepoint avant_anon")

    print("== Application de la migration (dans la transaction)")
    cur.execute(MIGRATION.read_text(encoding="utf-8"))
    verifier("la migration s'execute sans erreur", True)

    print("== Droits")
    for role in ("anon", "authenticated"):
        for t in ("import_retraits", "import_retraits_fiches", "import_retraits_vitrines", "import_retraits_actifs"):
            for priv in ("select", "insert", "update", "delete"):
                ok = q1("select has_table_privilege(%s, %s, %s)", (role, f"public.{t}", priv))
                if ok:
                    verifier(f"{role} sans {priv} sur {t}", False)
        verifier(f"{role} : aucun droit de table sur les 4 objets", True)
        for fn in ("public.retrait_poser(uuid, uuid, text, text, text, text, uuid, date, text)",
                   "public.retrait_lever(uuid, text, text)", "public.texte_normalise(text)"):
            verifier(f"{role} sans EXECUTE sur {fn.split('(')[0]}",
                     not q1("select has_function_privilege(%s, %s, 'execute')", (role, fn)))
    for fn in ("public.retrait_poser(uuid, uuid, text, text, text, text, uuid, date, text)",
               "public.retrait_lever(uuid, text, text)"):
        verifier(f"service_role a EXECUTE sur {fn.split('(')[0]}",
                 q1("select has_function_privilege('service_role', %s, 'execute')", (fn,)))
    for t in ("import_retraits", "import_retraits_fiches", "import_retraits_vitrines"):
        verifier(f"service_role sans DELETE ni TRUNCATE sur {t}",
                 not q1("select has_table_privilege('service_role', %s, 'delete')", (f"public.{t}",))
                 and not q1("select has_table_privilege('service_role', %s, 'truncate')", (f"public.{t}",)))
        verifier(f"service_role lit et ecrit {t}",
                 all(q1("select has_table_privilege('service_role', %s, %s)", (f"public.{t}", p))
                     for p in ("select", "insert", "update")))
    verifier("RLS activee sur les trois tables",
             q1("""select bool_and(relrowsecurity) from pg_class
                    where oid in ('public.import_retraits'::regclass, 'public.import_retraits_fiches'::regclass,
                                  'public.import_retraits_vitrines'::regclass)"""))

    # Real attempts with the anon role (RLS and grants, not only the catalog).
    cur.execute("savepoint anon_essai")
    cur.execute("set local role anon")
    attendu_erreur("select count(*) from public.import_retraits", None, "permission denied",
                   "anon : select sur import_retraits refuse")
    attendu_erreur("select count(*) from public.import_retraits_actifs", None, "permission denied",
                   "anon : select sur la vue refuse")
    attendu_erreur("select public.retrait_poser(null, null, 'medias', null, 'abc', 'equipe', null, null, 'x')",
                   None, "permission denied", "anon : rpc retrait_poser refuse")
    n_anon_masquees = q1(f"""select count(*) from public.evenements
                              where not show_on_public_site and status in {PUBLIC_STATUSES}""")
    verifier(f"anon : zero fiche masquee lisible (avant la migration : {nb_masquees_avant} lisibles par anon)",
             n_anon_masquees == 0, f"{n_anon_masquees} lisibles")
    cur.execute("reset role")
    cur.execute("rollback to savepoint anon_essai")
    cur.execute("release savepoint anon_essai")

    print("== Normalisation et empreintes")
    verifier("texte_normalise('  Le Café-Théâtre d''Œuf  ') = 'le cafe theatre d oeuf'",
             q1("select public.texte_normalise('  Le Café-Théâtre d''Œuf  ')") == "le cafe theatre d oeuf")

    print("== Cas 1 : retrait 'medias' puis 'fiches', levee dans l'ordre inverse")
    r = poser(ORG, "medias")
    id_med = r["retrait_id"]
    verifier("medias : toutes les fiches photographiees", r["fiches"] == n_ev, r)
    verifier("medias : pas de vitrine touchee", r["vitrines"] == 0 and r["annuaire"] == 0, r)
    S = etat(ORG)
    verifier("medias : description nulle et photos vides partout",
             all(x[2] is None and x[3] == [] for x in S["ev"]))
    verifier("medias : visibilite inchangee",
             [x[1] for x in S["ev"]] == [x[1] for x in S0["ev"]])
    verifier("medias : checked_at pose sur toutes les fiches qui ont une provenance",
             all(x[4] is not None for x, z in zip(S["ev"], S0["ev"]) if z[5] is not None))
    verifier("medias : photos_retirees intactes", [x[5] for x in S["ev"]] == [x[5] for x in S0["ev"]])
    verifier("medias : le retrait est dans la vue des retraits actifs",
             q1("select count(*) from public.import_retraits_actifs where id = %s::uuid", (id_med,)) == 1)
    attendu_erreur("select public.retrait_poser(%s::uuid, null, 'medias', null, 'essai de doublon', 'equipe', null, null, 'x')",
                   (ORG,), "retrait_deja_actif", "medias : un doublon actif est refuse")

    r = poser(ORG, "fiches")
    id_fic = r["retrait_id"]
    S = etat(ORG)
    verifier("fiches : toutes les fiches masquees", all(x[1] is False for x in S["ev"]))
    verifier("fiches : vitrines retirees", all(v[1] == "retire" for v in S["vit"]) and r["vitrines"] >= 1, r)
    verifier("fiches : la fiche deja masquee garde show_avant = false",
             q1("select show_avant from public.import_retraits_fiches where retrait_id = %s::uuid and event_id = %s::uuid",
                (id_fic, ev_masque)) is False)

    if ev_corrige:
        q("update public.evenements set description = 'Texte corrige a la main' where id = %s::uuid", (ev_corrige,))
        S_corr = etat(ORG)

    r = lever(id_fic)
    S = etat(ORG)
    show0 = {x[0]: x[1] for x in S0["ev"]}
    verifier("lever fiches : visibilite remise comme avant (dont la fiche deja masquee)",
             all(x[1] == show0[x[0]] for x in S["ev"]))
    verifier("lever fiches : vitrines remises", S["vit"] == S0["vit"])
    verifier("lever fiches : medias toujours retires (le retrait medias reste actif)",
             all(x[3] == [] for x in S["ev"]) and all(x[2] is None for x in S["ev"] if x[0] != ev_corrige))
    verifier("lever fiches : plus dans la vue, medias toujours dedans",
             q1("select count(*) from public.import_retraits_actifs where id = %s::uuid", (id_fic,)) == 0
             and q1("select count(*) from public.import_retraits_actifs where id = %s::uuid", (id_med,)) == 1)
    attendu_erreur("select public.retrait_lever(%s::uuid, 'encore', 'x')", (id_fic,),
                   "retrait_deja_leve", "lever fiches : une seconde levee est refusee")

    r = lever(id_med)
    S1 = etat(ORG)
    ign = (ev_corrige,) if ev_corrige else ()
    d = difference(S0, S1, ignorer=ign)
    verifier("lever medias : retour exact a l'etat photographie (hors fiche corrigee)", not d, d)
    if ev_corrige:
        corrige = next(x for x in S1["ev"] if x[0] == ev_corrige)
        verifier("lever medias : la fiche corrigee a la main est laissee telle quelle",
                 corrige[2] == "Texte corrige a la main" and r["fiches_laissees"] == 1, r)
        # restore the original description for the next cases (inside the transaction)
        orig = next(x for x in S0["ev"] if x[0] == ev_corrige)
        q("update public.evenements set description = %s where id = %s::uuid", (orig[2], ev_corrige))
    else:
        print("  (aucune fiche a description : cas de la correction humaine non teste)")
    S1 = etat(ORG)
    verifier("etat apres cas 1 identique a S0", not difference(S0, S1), difference(S0, S1))

    print("== Cas 2 : levee dans le desordre (medias avant fiches)")
    id_med = poser(ORG, "medias")["retrait_id"]
    id_fic = poser(ORG, "fiches")["retrait_id"]
    lever(id_med)
    S = etat(ORG)
    verifier("desordre : fiches toujours masquees et sans medias apres la levee de medias",
             all(x[1] is False for x in S["ev"]) and all(x[2] is None and x[3] == [] for x in S["ev"]))
    lever(id_fic)
    d = difference(S0, etat(ORG))
    verifier("desordre : apres la levee de fiches, retour exact a l'etat photographie", not d, d)

    print("== Cas 3 : retrait 'import' (annuaire masque puis demasque)")
    r = poser(ORG, "import")
    id_imp = r["retrait_id"]
    S = etat(ORG)
    verifier("import : fiches masquees et sans medias",
             all(x[1] is False and x[2] is None and x[3] == [] for x in S["ev"]))
    if a_annuaire:
        verifier("import : ligne d'annuaire masquee avec le motif 'retrait <id>'",
                 r["annuaire"] >= 1 and any(a[1] and a[2] == f"retrait {id_imp}" for a in S["ann"]), r)
    row = q("""select nom_normalise, commune_normalisee, domaine_web from public.import_retraits where id = %s::uuid""",
            (id_imp,))[0]
    verifier("import : empreinte de nom renseignee", bool(row[0]), row)
    print(f"  empreintes : nom={row[0]!r} commune={row[1]!r} domaine={row[2]!r}")
    lever(id_imp)
    d = difference(S0, etat(ORG))
    verifier("import : levee, retour exact (fiches, vitrine, annuaire)", not d, d)

    print("== Cas 4 : retrait 'import' limite a une source")
    src = q1("""select i.source from public.evenements_import i join public.evenements e on e.id = i.event_id
                 where e.organization_id = %s limit 1""", (ORG,))
    if src:
        r = poser(ORG, "import", source=src)
        S = etat(ORG)
        verifier(f"source {src} : vitrine laissee publiee, annuaire intact", r["vitrines"] == 0 and r["annuaire"] == 0
                 and S["vit"] == S0["vit"] and S["ann"] == S0["ann"], r)
        lever(r["retrait_id"])
        d = difference(S0, etat(ORG))
        verifier("source : levee, retour exact", not d, d)
    attendu_erreur("select public.retrait_poser(%s::uuid, null, 'medias', 'openagenda', 'abc def', 'equipe', null, null, 'x')",
                   (ORG,), "retrait_source_invalide", "une source avec la portee medias est refusee")

    print("== Refus")
    revendiquee = q1("select id::text from public.organizations where claimed_at is not null limit 1")
    cree = q1("select id::text from public.organizations where source = 'casaminga' limit 1")
    avec_membre = q1("select organization_id::text from public.organization_members limit 1")
    for lib, oid in (("organisation revendiquee", revendiquee), ("organisation 'casaminga'", cree),
                     ("organisation avec membres", avec_membre)):
        if oid:
            attendu_erreur("select public.retrait_poser(%s::uuid, null, 'medias', null, 'essai refus', 'equipe', null, null, 'x')",
                           (oid,), "retrait_organisation_revendiquee", f"{lib} refusee")
        else:
            print(f"  ({lib} : aucune ligne pour tester)")
    attendu_erreur("select public.retrait_poser(null, null, 'medias', null, 'essai', 'equipe', null, null, 'x')",
                   None, "retrait_cible_manquante", "sans cible refuse")
    attendu_erreur("select public.retrait_poser(%s::uuid, null, 'medias', null, 'x', 'equipe', null, null, 'x')",
                   (ORG,), "import_retraits_motif_check", "motif trop court refuse")

    print("== Fin : etat comparable a l'origine")
    verifier("l'etat final de l'organisation est celui qui a ete photographie", not difference(S0, etat(ORG)))
finally:
    conn.rollback()
    conn.close()
    print("== Transaction annulee : rien n'est reste en base.")

print()
if echecs:
    print(f"{len(echecs)} verification(s) en echec :")
    for e in echecs:
        print("  -", e)
    sys.exit(1)
print("Toutes les verifications sont passees.")
