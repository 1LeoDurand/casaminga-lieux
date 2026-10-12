# -*- coding: utf-8 -*-
"""
Typage des evenements a venir (T7, decision D2 du 2026-10-12).

Applique les regles typer_v2 (import_commun.py, titre ET description) aux
fiches visibles et a venir. Aucune API de modele (decision D3).

  --essai                    lecture seule : avant/apres, exemples, reliquat
  --ecrire                   met a jour evenements.type par lots (fiches sans
                             checked_at uniquement), journal par regle
  --export-reliquat F.json   ecrit le reliquat « autre » (paquets de 100)

Regles : R8 (checked_at jamais retype), R15 (liste fixee, « autre » sous 25 %).
Une fiche sans regle qui matche garde son type actuel ; « conference » devient
« rencontre » (liste validee). Pas de colonne de categorie DATAtourisme dans
evenements_import : titre et description seulement. Aucune CHECK sur
evenements.type : le code « fete » s'ecrit sans migration.
"""
import argparse
import json
import random
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_commun import Base, load_env, typer_v2  # noqa: E402

STATUTS = "publie,confirme,planifie"
TYPES = ["atelier", "stage", "formation", "retraite", "sejour", "rencontre",
         "spectacle", "concert", "exposition", "marche", "fete", "autre"]


def groupe_source(s):
    s = s or "aucune"
    for p in ("datatourisme", "openagenda", "site"):
        if s.startswith(p):
            return p
    return s


def charger(db):
    iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    evts = db.lire_tout(
        "evenements?select=id,title,description,type,start_at,end_at"
        f"&show_on_public_site=eq.true&status=in.({STATUTS})&start_at=gte.{iso}&order=id")
    imps = {i["event_id"]: i for i in db.lire_tout(
        "evenements_import?select=event_id,source,checked_at&order=event_id")}
    fiches = []
    for e in evts:
        i = imps.get(e["id"]) or {}
        fiches.append({**e, "src": groupe_source(i.get("source")), "checked": bool(i.get("checked_at"))})
    return fiches


def calculer(fiches, sans_description=False, sous_agents=None):
    """sous_agents : {id: type} classe hors script (sous-agents du forfait,
    decision D3) ; applique seulement aux fiches restees « autre » apres les
    regles, jamais a une fiche verrouillee (R8)."""
    sous_agents = sous_agents or {}
    for f in fiches:
        actuel = f.get("type") or "autre"
        if f["checked"]:
            f["nouveau"], f["regle"] = actuel, "verrou:checked_at"
            continue
        code, regle = typer_v2(f["title"], f.get("description"), f.get("start_at"), f.get("end_at"))
        if actuel == "conference" and not code:
            code, regle = "rencontre", "reclasse:conference"
        if code and regle.startswith("desc:") and (actuel != "autre" or sans_description):
            code = None  # la description ne corrige jamais un type deja pose
        f["nouveau"], f["regle"] = (code, regle) if code else (actuel, None)
        if f["nouveau"] == "autre" and f["id"] in sous_agents and sous_agents[f["id"]] in TYPES:
            f["nouveau"], f["regle"] = sous_agents[f["id"]], "sous-agent"


def tableau(titre, avant, apres):
    print(f"\n{titre}  (total {sum(avant.values())})")
    print(f"  {'type':<12}{'avant':>7}{'apres':>7}")
    for t in sorted(set(avant) | set(apres), key=lambda x: -max(avant[x], apres[x])):
        print(f"  {t:<12}{avant[t]:>7}{apres[t]:>7}")
    n = sum(apres.values()) or 1
    print(f"  part autre : {100*avant['autre']/n:.1f} % -> {100*apres['autre']/n:.1f} %")


def essai(fiches):
    rnd = random.Random(7)
    par_src = defaultdict(list)
    for f in fiches:
        par_src[f["src"]].append(f)
    tableau("TOTAL", Counter(f["type"] or "autre" for f in fiches), Counter(f["nouveau"] for f in fiches))
    for src, lst in sorted(par_src.items()):
        ch = sum(1 for f in lst if f["nouveau"] != (f["type"] or "autre"))
        tableau(f"SOURCE {src} ({ch} changements, {sum(f['checked'] for f in lst)} verrouillees)",
                Counter(f["type"] or "autre" for f in lst), Counter(f["nouveau"] for f in lst))
    chg = [f for f in fiches if f["nouveau"] != (f["type"] or "autre")]
    print(f"\nFiches qui changeraient : {len(chg)} / {len(fiches)}")
    print("Par regle :", dict(Counter(f["regle"] for f in chg).most_common()))
    print("Transitions :", dict(Counter(f"{f['type']}->{f['nouveau']}" for f in chg).most_common(25)))
    print("\n30 exemples de changements (titre | ancien -> nouveau | regle)")
    for f in rnd.sample(chg, min(30, len(chg))):
        print(f"  {f['title'][:80]} | {f['type']} -> {f['nouveau']} | {f['regle']}")
    rel = [f for f in fiches if f["nouveau"] == "autre"]
    print(f"\n20 exemples de reliquat « autre » (sur {len(rel)})")
    for f in rnd.sample(rel, min(20, len(rel))):
        d = " ".join((f.get("description") or "").split())[:100]
        print(f"  [{f['src']}] {f['title'][:80]} || {d}")


def export(fiches, chemin):
    rel = [{"id": f["id"], "titre": f["title"],
            "description": " ".join((f.get("description") or "").split())[:400], "source": f["src"]}
           for f in fiches if f["nouveau"] == "autre" and not f["checked"]]
    paquets = [rel[i:i + 100] for i in range(0, len(rel), 100)]
    Path(chemin).write_text(json.dumps({"total": len(rel), "paquets": paquets}, ensure_ascii=False, indent=1),
                            encoding="utf-8")
    print(f"Reliquat : {len(rel)} fiches, {len(paquets)} paquets de 100 -> {chemin}")


def ecrire(db, fiches):
    par_type = defaultdict(list)
    compteur = Counter()
    for f in fiches:
        if f["checked"] or f["nouveau"] == (f["type"] or "autre"):
            continue
        par_type[f["nouveau"]].append(f["id"])
        compteur[f["regle"]] += 1
    for code, ids in par_type.items():
        for i in range(0, len(ids), 100):
            lot = ",".join(ids[i:i + 100])
            db._call("PATCH", f"evenements?id=in.({lot})", {"type": code}, headers={"Prefer": "return=minimal"})
    print("Journal par regle :", dict(compteur.most_common()), "| total", sum(compteur.values()))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--essai", action="store_true")
    ap.add_argument("--ecrire", action="store_true")
    ap.add_argument("--export-reliquat", metavar="CHEMIN")
    ap.add_argument("--sans-description", action="store_true",
                    help="n'applique pas les regles desc:* (les moins sures)")
    ap.add_argument("--appliquer-fichier", metavar="F.json",
                    help="types classes par les sous-agents : liste de {id, type}")
    a = ap.parse_args()
    if not (a.essai or a.ecrire or a.export_reliquat):
        ap.error("choisir --essai, --ecrire ou --export-reliquat")
    url, key = load_env()
    db = Base(url, key)
    fiches = charger(db)
    sa = None
    if a.appliquer_fichier:
        sa = {e["id"]: e["type"] for e in json.loads(Path(a.appliquer_fichier).read_text(encoding="utf-8"))}
        print(f"Sous-agents : {len(sa)} fiches classees dans {a.appliquer_fichier}")
    calculer(fiches, sans_description=a.sans_description, sous_agents=sa)
    if a.essai:
        essai(fiches)
    if a.export_reliquat:
        export(fiches, a.export_reliquat)
    if a.ecrire:
        ecrire(db, fiches)


if __name__ == "__main__":
    main()
