# -*- coding: utf-8 -*-
"""
Reprise de l'existant : lie les doublons deja presents en base (regle R7, P3).

Meme module que les imports (scripts/dedoublonnage.py) : une seule regle. Pour
chaque groupe de fiches visibles a venir qui se doublonnent (niveaux 2 et 3),
la fiche la plus riche est gardee, les autres sont MASQUEES (show_on_public_site
= false, jamais supprimees) et liees dans evenements_doublons ; la gardee prend
ce que le doublon avait de plus (heure, photo, description, inscription, prix),
sauf si elle est corrigee a la main (checked_at, R8).

Jamais touchees : une fiche saisie dans l'admin (aucune ligne evenements_import),
une fiche a checked_at quand la gardee en porte aussi (paire signalee), une
fiche d'une organisation sous retrait (import_retraits actif).

Usage :
  python scripts/dedoublonner-existant.py --essai               rapport, n'ecrit rien (defaut)
  python scripts/dedoublonner-existant.py --ecrire              lie, masque, enrichit
  python scripts/dedoublonner-existant.py --annuler 12          defait le lien numero 12
  python scripts/dedoublonner-existant.py --annuler v1-2026-10  defait tous les liens de cette regle
  ... --rapport CHEMIN.md   ecrit aussi le rapport (defaut avec --ecrire :
                            Mesures/dedoublonnage-AAAA-MM-JJ.md du dossier 08)

La cle de service est lue dans .env.local et n'est jamais affichee.
"""

import argparse
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dedoublonnage import (  # noqa: E402
    LONGUEUR_CONTENU, NIVEAU_EXACT, NIVEAU_PROCHE, RAISONS, REGLE, Dedoublonneur,
    appliquer_a_entree, calculer_enrichissement, classer_paire, elire_gardee,
    groupes_de_doublons, heure_inconnue, vers_dt, vers_paris,
)
from import_commun import Base, load_env  # noqa: E402

DOSSIER_RAPPORTS = Path(r"D:\0 - Sync cloud Kdrive\01 Casaminga\08 Import evenements")
STATUTS_VISIBLES = "publie,confirme,planifie"
ANNULE_PAR = "dedoublonner-existant.py --annuler"
CHAMPS_EVT = ("start_at", "end_at", "photos", "description", "price")


# ---------------------------------------------------------------- election

def _trie(entrees):
    return sorted(entrees, key=lambda e: (e.created_at or "", e.id or ""))


def resoudre_groupe(entrees, retraits_actifs, decisions, signales):
    """Elit la gardee, puis range chaque autre fiche : masquee (doublon direct de
    la gardee, niveau 2 ou 3), ou signalee (rien n'est masque). Le reste, qui
    n'est pas un doublon direct de la gardee (chaine A~B, B~C), est resolu a son
    tour. decisions : liste de (gardee, masquee, niveau, score)."""
    ents = _trie(entrees)
    if len(ents) < 2:
        return
    gardee = ents[0]
    for e in ents[1:]:
        g, _ = elire_gardee(gardee, e)
        if g is not None:
            gardee = g
    reste = []
    for e in ents:
        if e is gardee:
            continue
        niveau, score = classer_paire(gardee, e)
        if niveau not in RAISONS:
            reste.append(e)
            continue
        if e.source is None:
            signales.append((gardee, e, "saisie dans l'admin ou collecte Casaminga : jamais masquee"))
        elif e.checked_at:
            signales.append((gardee, e, "checked_at des deux cotes : rien n'est masque"))
        elif e.organization_id in retraits_actifs or gardee.organization_id in retraits_actifs:
            signales.append((gardee, e, "organisation sous retrait (P2) : non touchee"))
        else:
            decisions.append((gardee, e, niveau, score))
    resoudre_groupe(reste, retraits_actifs, decisions, signales)


# ---------------------------------------------------------------- lecture

def lire_retraits_actifs(db):
    """Organisations sous retrait actif, quelle que soit la portee (P2)."""
    try:
        lignes = db.lire_tout(
            "import_retraits?select=organization_id&leve_le=is.null&organization_id=not.is.null&order=id")
    except SystemExit as exc:
        if "PGRST205" in str(exc) or "HTTP 404" in str(exc):
            return set()
        raise
    return {l["organization_id"] for l in lignes}


def construire(db):
    """Lit la base et renvoie (dd, decisions, signales, paires)."""
    maintenant = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    retraits = lire_retraits_actifs(db)
    filtre = (f"show_on_public_site=eq.true&status=in.({STATUTS_VISIBLES})"
              f"&or=(start_at.gte.{maintenant},end_at.gte.{maintenant})")
    dd = Dedoublonneur(db, retraits=None, filtre=filtre)
    if not dd.table_doublons:
        raise SystemExit("Table evenements_doublons absente : appliquer la migration 0032 d'abord.")
    paires = dd.paires_existantes()
    groupes = groupes_de_doublons(paires)
    decisions, signales = [], []
    for entrees, _ in groupes:
        resoudre_groupe(entrees, retraits, decisions, signales)
    return dd, decisions, signales, paires, groupes, retraits


def calculer_enrichissements(dd, decisions):
    """[(gardee, masquee, niveau, score, enrichi)], dans l'ordre des decisions.
    Chaque champ n'est pris qu'une fois : l'Entree de la gardee est mise a jour."""
    sortie = []
    for gardee, masquee, niveau, score in decisions:
        enrichi = calculer_enrichissement(gardee, masquee, masquee.source, dd.retraits)
        appliquer_a_entree(gardee, enrichi)
        sortie.append((gardee, masquee, niveau, score, enrichi))
    return sortie


# ---------------------------------------------------------------- rapport

def hh(e):
    return "heure inconnue" if heure_inconnue(e.debut) else vers_paris(e.debut).strftime("%H:%M")


def court(e, n=70):
    return f"{e.groupe_source} {hh(e)} {e.titre[:n]} [{(e.id or '')[:8]}]"


def rapport(plans, signales, paires, groupes, total, ecrit, resultat_ecriture):
    par_niveau = Counter(p[2] for p in plans)
    champs = Counter(c for p in plans for c in p[4])
    seances = sum(1 for p in paires if p[2] == 4)
    courts = [p for p in plans if min(len(p[0].tn), len(p[1].tn)) < LONGUEUR_CONTENU]
    memes = [p for p in plans if p[0].groupe_source == p[1].groupe_source
             and not heure_inconnue(p[0].debut) and not heure_inconnue(p[1].debut)]
    L = []
    mode = "ECRIT" if ecrit else "ESSAI (rien n'est ecrit)"
    L.append(f"# Reprise du dedoublonnage, {datetime.now().strftime('%Y-%m-%d')} ({mode})\n")
    L.append(f"Regle `{REGLE}` (module `scripts/dedoublonnage.py`, garde C3 au niveau 3). "
             f"Fiches visibles a venir lues : {total}.\n")
    L.append("## Bilan\n")
    L.append("| Indicateur | Valeur |\n|---|---|")
    L.append(f"| Groupes de doublons | {len(groupes)} |")
    L.append(f"| Fiches masquees (liees) | {len(plans)} |")
    L.append(f"| dont niveau 2, exact | {par_niveau[NIVEAU_EXACT]} |")
    L.append(f"| dont niveau 3, proche | {par_niveau[NIVEAU_PROCHE]} |")
    L.append(f"| Fiches gardees enrichies | {len({p[0].id for p in plans if p[4]})} |")
    for c, k in sorted(champs.items()):
        L.append(f"| champ enrichi : {c} | {k} |")
    L.append(f"| Paires signalees, non masquees | {len(signales)} |")
    L.append(f"| Paires de seances laissees telles quelles (niveau 4) | {seances} |")
    if resultat_ecriture:
        for k, v in resultat_ecriture.items():
            L.append(f"| ecriture : {k} | {v} |")
    L.append("")
    L.append("## Fiches masquees, par couple de sources\n")
    couples = Counter(" + ".join(sorted((p[0].groupe_source, p[1].groupe_source))) for p in plans)
    L.append("| Sources | Paires |\n|---|---|")
    for c, k in couples.most_common():
        L.append(f"| {c} | {k} |")
    L.append("")
    L.append("## Detail des liens\n")
    L.append("| Niveau | Jour | Commune | Gardee | Masquee | Score | Enrichi |\n|---|---|---|---|---|---|---|")
    for g, m, niveau, score, enrichi in sorted(plans, key=lambda p: (p[2], p[0].jour, p[0].tn)):
        L.append(f"| {niveau} | {g.jour} | {g.commune or '?'} | {court(g, 50).replace('|', '/')} | "
                 f"{court(m, 50).replace('|', '/')} | {score:.2f} | {', '.join(enrichi) or '-'} |")
    L.append("")
    if signales:
        L.append("## Paires signalees (aucun masquage)\n")
        for g, m, raison in signales:
            L.append(f"- {raison} : {court(g, 50)} / {court(m, 50)}")
        L.append("")
    L.append("## A relire\n")
    L.append(f"- Paires dont un titre fait moins de {LONGUEUR_CONTENU} caracteres : {len(courts)}")
    for g, m, *_ in courts[:10]:
        L.append(f"  - {court(g, 40)} / {court(m, 40)}")
    L.append(f"- Paires de meme source avec une heure des deux cotes (risque de seance) : {len(memes)}")
    for g, m, *_ in memes[:10]:
        L.append(f"  - {court(g, 40)} / {court(m, 40)}")
    L.append("")
    L.append("Retour arriere : `python scripts/dedoublonner-existant.py --annuler <id>` "
             "(un lien) ou `--annuler " + REGLE + "` (tous).\n")
    return "\n".join(L)


# ---------------------------------------------------------------- ecriture

def patch(db, chemin, corps):
    db._call("PATCH", chemin, corps, headers={"Prefer": "return=minimal"})


def ecrire(db, dd, plans):
    """Pour chaque couple : ligne evenements_doublons, enrichissement de la
    gardee, masquage du doublon. Dans cet ordre : un incident laisse une trace
    (lien) plutot qu'une fiche masquee sans explication ; la relance saute les
    liens deja ecrits."""
    deja = {l["doublon_event_id"] for l in db.lire_tout(
        "evenements_doublons?select=doublon_event_id&annule_le=is.null&doublon_event_id=not.is.null&order=id")}
    urls = {}
    ids = [p[1].id for p in plans]
    for i in range(0, len(ids), 100):
        clause = "event_id=in.(" + ",".join(ids[i:i + 100]) + ")"
        for r in db.lire_tout(f"evenements_import?select=event_id,source_url&{clause}&order=event_id"):
            urls[r["event_id"]] = r.get("source_url")
    bilan = Counter()
    for g, m, niveau, score, enrichi in plans:
        if m.id not in deja:
            ligne = {
                "event_id": g.id, "source": m.source, "source_uid": m.source_uid,
                "source_url": urls.get(m.id), "doublon_event_id": m.id, "niveau": niveau,
                "raison": RAISONS[niveau], "score": round(score, 3), "titre": m.titre,
                "debut": m.debut.isoformat(), "enrichi": enrichi, "regle": REGLE,
            }
            db._call("POST", "evenements_doublons", [ligne], headers={"Prefer": "return=minimal"})
            bilan["liens ecrits"] += 1
            evt = {c: v["apres"] for c, v in enrichi.items() if c in CHAMPS_EVT}
            if evt:
                patch(db, f"evenements?id=eq.{g.id}", evt)
            if "registration" in enrichi:
                patch(db, f"evenements_import?event_id=eq.{g.id}",
                      {"registration": enrichi["registration"]["apres"]})
            if enrichi:
                bilan["fiches gardees enrichies"] += 1
        else:
            bilan["liens deja ecrits (relance)"] += 1
        patch(db, f"evenements?id=eq.{m.id}", {"show_on_public_site": False})
        bilan["fiches masquees"] += 1
    return dict(bilan)


def _egal(champ, actuel, pose):
    if champ in ("start_at", "end_at"):
        return vers_dt(actuel) == vers_dt(pose)
    return actuel == pose


def annuler(db, cible, essai):
    """Defait un lien (entier) ou tous les liens actifs d'une regle (texte) :
    la fiche doublon est remise visible, les valeurs d'avant sont restaurees si
    la valeur actuelle est encore celle posee, annule_le est pose."""
    base = "evenements_doublons?select=*&annule_le=is.null&order=id"
    lignes = db.lire_tout(base + (f"&id=eq.{int(cible)}" if cible.isdigit() else f"&regle=eq.{cible}"))
    if not lignes:
        raise SystemExit(f"Aucun lien actif pour « {cible} ».")
    now = datetime.now(timezone.utc).isoformat()
    for l in lignes:
        restaure, conserve = [], []
        enrichi = l.get("enrichi") or {}
        if enrichi:
            evt = db._call("GET", f"evenements?select={','.join(CHAMPS_EVT)}&id=eq.{l['event_id']}")
            imp = db._call("GET", f"evenements_import?select=registration&event_id=eq.{l['event_id']}")
            actuel = {**(evt[0] if evt else {}), **(imp[0] if imp else {})}
            retour_evt, retour_imp = {}, {}
            for champ, v in enrichi.items():
                if not _egal(champ, actuel.get(champ), v["apres"]):
                    conserve.append(champ)   # modifie depuis : on n'y touche pas
                    continue
                restaure.append(champ)
                (retour_imp if champ == "registration" else retour_evt)[champ] = v["avant"]
            if not essai:
                if retour_evt:
                    patch(db, f"evenements?id=eq.{l['event_id']}", retour_evt)
                if retour_imp:
                    patch(db, f"evenements_import?event_id=eq.{l['event_id']}", retour_imp)
        if not essai:
            if l.get("doublon_event_id"):
                patch(db, f"evenements?id=eq.{l['doublon_event_id']}", {"show_on_public_site": True})
            patch(db, f"evenements_doublons?id=eq.{l['id']}", {"annule_le": now, "annule_par": ANNULE_PAR})
        print(f"lien {l['id']} : « {l['titre'][:60]} » "
              f"{'remise visible' if l.get('doublon_event_id') else 'ecarte a l import (sera reimportee au prochain passage)'}"
              f", restaure {restaure or '-'}, conserve {conserve or '-'}"
              f"{' (essai, rien ecrit)' if essai else ''}")


# ---------------------------------------------------------------- principal

def main():
    for flux in (sys.stdout, sys.stderr):
        try:
            flux.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    ap = argparse.ArgumentParser(description="Reprise de l'existant : lie les doublons deja en base")
    ap.add_argument("--essai", action="store_true", help="rapport sans rien ecrire (defaut)")
    ap.add_argument("--ecrire", action="store_true", help="lie, masque et enrichit")
    ap.add_argument("--annuler", metavar="ID_OU_REGLE", help="defait un lien (id) ou tous ceux d'une regle")
    ap.add_argument("--rapport", help="ecrit le rapport markdown a ce chemin")
    args = ap.parse_args()
    if args.ecrire and args.essai:
        ap.error("--ecrire et --essai s'excluent")

    url, key = load_env()
    db = Base(url, key)

    if args.annuler:
        annuler(db, args.annuler, essai=args.essai)
        return

    dd, decisions, signales, paires, groupes, retraits = construire(db)
    plans = calculer_enrichissements(dd, decisions)
    total = sum(len(v) for v in dd.index.values())
    resultat = ecrire(db, dd, plans) if args.ecrire else None
    md = rapport(plans, signales, paires, groupes, total, bool(args.ecrire), resultat)

    chemin = args.rapport
    if args.ecrire and not chemin:
        chemin = str(DOSSIER_RAPPORTS / "Mesures" / f"dedoublonnage-{datetime.now().strftime('%Y-%m-%d')}.md")
    if chemin:
        Path(chemin).parent.mkdir(parents=True, exist_ok=True)
        Path(chemin).write_bytes(md.encode("utf-8"))
        print(f"Rapport ecrit : {chemin}")

    par_niveau = Counter(p[2] for p in plans)
    print(md)
    print(f"A masquer : {len(plans)} (niveau 2 : {par_niveau[NIVEAU_EXACT]}, niveau 3 : {par_niveau[NIVEAU_PROCHE]}), "
          f"{len(signales)} signalees. " + ("Ecrit en base." if args.ecrire else "Rien n'a ete ecrit en base."))


if __name__ == "__main__":
    main()
