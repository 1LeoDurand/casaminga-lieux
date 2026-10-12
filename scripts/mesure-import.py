# -*- coding: utf-8 -*-
"""
Mesure de l'etat de la collecte d'evenements (casaminga.com).

Lecture seule en base : uniquement des GET PostgREST, avec la cle de service de
.env.local (jamais affichee). Ecrit dans le dossier de rapports :

  Mesures/AAAA-MM-JJ.json   toutes les mesures du jour
  Mesures/AAAA-MM-JJ.md     la meme chose, lisible
  06-RESULTATS.md           bloc entre RESULTATS:debut et RESULTATS:fin
  00-DASHBOARD.md           bloc entre MESURES:debut et MESURES:fin

Rien d'autre n'est modifie dans ces deux fichiers.

Usage :
  python scripts/mesure-import.py            mesure et ecrit
  python scripts/mesure-import.py --essai    mesure et affiche, n'ecrit rien
  python scripts/mesure-import.py --dossier CHEMIN
"""

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_commun import Base, load_env, titre_normalise  # noqa: E402

DOSSIER_RAPPORTS = Path(r"D:\0 - Sync cloud Kdrive\01 Casaminga\08 Import evenements")
STATUTS_VISIBLES = "publie,confirme,planifie"
HERAULT = "34"
NOMS_SOURCES = {
    "site": "Sites des tiers-lieux",
    "datatourisme": "DATAtourisme",
    "openagenda": "OpenAgenda",
    "aucune": "Collecte Casaminga",
    "collecte_casaminga": "Collecte Casaminga",
}
MARQUEURS = {
    "resultats": ("<!-- RESULTATS:debut -->", "<!-- RESULTATS:fin -->"),
    "mesures": ("<!-- MESURES:debut -->", "<!-- MESURES:fin -->"),
}


# ---------------------------------------------------------------- utilitaires

def parse_dt(s):
    if not s:
        return None
    s = s.strip().replace("Z", "+00:00").replace(" ", "T", 1)
    try:
        d = datetime.fromisoformat(s)
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _dernier_dimanche(annee, mois):
    d = datetime(annee, mois, 31, tzinfo=timezone.utc)
    return d - timedelta(days=(d.weekday() + 1) % 7)


def vers_paris(d):
    """UTC -> heure de Paris. zoneinfo si disponible, sinon regle europeenne
    (heure d'ete du dernier dimanche de mars 01h UTC au dernier dimanche
    d'octobre 01h UTC)."""
    d = d.astimezone(timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        return d.astimezone(ZoneInfo("Europe/Paris"))
    except Exception:
        debut = _dernier_dimanche(d.year, 3).replace(hour=1)
        fin = _dernier_dimanche(d.year, 10).replace(hour=1)
        dec = 2 if debut <= d < fin else 1
        return (d + timedelta(hours=dec)).replace(tzinfo=timezone(timedelta(hours=dec)))


def groupe_source(src):
    if not src:
        return "aucune"
    return "site" if src.startswith("site:") else src


def est_liste_non_vide(v):
    if v is None:
        return False
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except json.JSONDecodeError:
            return bool(v.strip())
    return bool(v)


def n(x):
    return f"{x:,}".replace(",", " ")


def pct(a, b):
    return round(100.0 * a / b, 1) if b else 0.0


def fpct(x):
    s = f"{x:.1f}".replace(".", ",")
    return (s[:-2] if s.endswith(",0") else s) + " %"


def nom_source(s):
    return NOMS_SOURCES.get(s, s)


# -------------------------------------------------------------------- mesures

def mesurer(db, maintenant):
    iso = maintenant.strftime("%Y-%m-%dT%H:%M:%SZ")
    evts = db.lire_tout(
        "evenements?select=id,title,type,start_at,description,photos,price,establishment_id"
        f"&show_on_public_site=eq.true&status=in.({STATUTS_VISIBLES})&start_at=gte.{iso}&order=id")
    imports = db.lire_tout("evenements_import?select=event_id,source,registration,imported_at&order=event_id")
    etabs = {e["id"]: e for e in db.lire_tout(
        "establishments?select=id,postal_code,city,latitude,longitude&order=id")}
    orgs = db.lire_tout("organizations?select=id,source,claimed_at&order=id")
    annuaire = db.lire_tout("annuaire_lieux?select=id,site_web,organization_id&order=id")
    sondes = db.lire_tout("annuaire_sites_sondes?select=annuaire_id,signal&order=annuaire_id")

    imp_par_evt = {}
    for i in imports:
        imp_par_evt.setdefault(i["event_id"], i)

    total = len(evts)
    par_source, par_type, par_dept = Counter(), Counter(), Counter()
    rempl = defaultdict(Counter)
    autre = Counter()
    fiches = []

    for e in evts:
        imp = imp_par_evt.get(e["id"])
        src = groupe_source(imp["source"] if imp else None)
        et = etabs.get(e.get("establishment_id")) or {}
        cp = (et.get("postal_code") or "").strip()
        dept = cp[:2] if re.match(r"^\d{2}", cp) else "inconnu"
        typ = e.get("type") or "inconnu"
        par_source[src] += 1
        par_type[typ] += 1
        par_dept[dept] += 1
        r = rempl[src]
        r["n"] += 1
        if len((e.get("description") or "").strip()) > 40:
            r["description"] += 1
        if est_liste_non_vide(e.get("photos")):
            r["photos"] += 1
        if e.get("price") is not None:
            r["prix"] += 1
        if imp and imp.get("registration"):
            r["inscription"] += 1
        d = parse_dt(e.get("start_at"))
        if d:
            p = vers_paris(d)
            if (p.hour, p.minute) != (0, 0):
                r["heure"] += 1
        if et.get("latitude") is not None and et.get("longitude") is not None:
            r["coordonnees"] += 1
        if typ == "autre":
            autre[src] += 1
        fiches.append((e, src, et, d))

    # doublons visibles
    groupes = defaultdict(list)
    for e, src, et, d in fiches:
        jour = vers_paris(d).strftime("%Y-%m-%d") if d else ""
        cle = (titre_normalise(e.get("title")), jour, titre_normalise(et.get("city")))
        groupes[cle].append((e, src, et, jour))
    multi = [g for g in groupes.values() if len(g) > 1]
    multi.sort(key=lambda g: (-len(g), g[0][0].get("title") or ""))
    en_doublon = sum(len(g) for g in multi)
    exemples = [{
        "titre": g[0][0].get("title"), "jour": g[0][3],
        "ville": g[0][2].get("city") or "", "nb": len(g),
        "sources": sorted({nom_source(x[1]) for x in g}),
    } for g in multi[:10]]

    # organisations
    orgs_src = Counter((o.get("source") or "inconnue") for o in orgs)
    revendiquees = sum(1 for o in orgs if o.get("claimed_at"))

    # imports de la semaine
    seuil = maintenant - timedelta(days=7)
    semaine = Counter()
    for i in imports:
        d = parse_dt(i.get("imported_at"))
        if d and d >= seuil:
            semaine[groupe_source(i["source"])] += 1

    top = par_dept.most_common(15)
    return {
        "date": maintenant.strftime("%Y-%m-%d"),
        "mesure_le": iso,
        "total": total,
        "par_source": dict(par_source.most_common()),
        "par_type": dict(par_type.most_common()),
        "par_departement": [{"dept": k, "n": v} for k, v in top],
        "part_herault": pct(par_dept.get(HERAULT, 0), total),
        "remplissage": {s: dict(c) for s, c in rempl.items()},
        "autre": {
            "par_source": {s: {"n": par_source[s], "autre": autre.get(s, 0),
                               "part": pct(autre.get(s, 0), par_source[s])} for s in par_source},
            "total": {"n": total, "autre": sum(autre.values()), "part": pct(sum(autre.values()), total)},
        },
        "organisations": {"total": len(orgs), "par_source": dict(orgs_src.most_common()),
                          "revendiquees": revendiquees},
        "annuaire": {
            "lieux": len(annuaire),
            "avec_site": sum(1 for a in annuaire if (a.get("site_web") or "").strip()),
            "rattaches": sum(1 for a in annuaire if a.get("organization_id")),
            "sondes_par_signal": dict(Counter((s.get("signal") or "aucun") for s in sondes).most_common()),
        },
        "imports_semaine": {"total": sum(semaine.values()), "par_source": dict(semaine.most_common())},
        "doublons": {"groupes": len(multi), "fiches": en_doublon,
                     "taux": pct(en_doublon, total), "exemples": exemples},
    }


# ------------------------------------------------------------------- rendu md

def part_de(m, cle):
    """Part en % d'un champ de remplissage sur l'ensemble des fiches."""
    tot = sum(r.get("n", 0) for r in m["remplissage"].values())
    return pct(sum(r.get(cle, 0) for r in m["remplissage"].values()), tot)


def lignes_synthese(m):
    """(libelle, valeur numerique, format) pour les tableaux a colonnes de dates."""
    L = [("Total à venir visibles", m["total"], "n")]
    for s in m["par_source"]:
        L.append((f"dont {nom_source(s)}", m["par_source"][s], "n"))
    L += [
        ("Part sans type précis (autre)", m["autre"]["total"]["part"], "p"),
        ("Fiches avec heure réelle", part_de(m, "heure"), "p"),
        ("Fiches avec photo", part_de(m, "photos"), "p"),
        ("Part en Hérault", m["part_herault"], "p"),
        ("Doublons visibles (taux)", m["doublons"]["taux"], "p"),
        ("Organisations revendiquées", m["organisations"]["revendiquees"], "n"),
        ("Imports de la semaine", m["imports_semaine"]["total"], "n"),
    ]
    return L


def fmt(v, f):
    return fpct(v) if f == "p" else n(v)


def table(entetes, lignes):
    out = ["| " + " | ".join(entetes) + " |", "|" + "---|" * len(entetes)]
    out += ["| " + " | ".join(str(c) for c in l) + " |" for l in lignes]
    return "\n".join(out)


def detail_md(m, titre_niveau="###"):
    h = titre_niveau
    P = []
    P.append(f"{h} Par type\n\n" + table(["Type", "Fiches", "Part"],
             [[t, n(v), fpct(pct(v, m["total"]))] for t, v in m["par_type"].items()]))
    P.append(f"{h} Par département (15 premiers)\n\n" + table(["Département", "Fiches", "Part"],
             [[d["dept"], n(d["n"]), fpct(pct(d["n"], m["total"]))] for d in m["par_departement"]]))
    ent = ["Source", "Fiches", "Description > 40 car.", "Photos", "Prix", "Inscription",
           "Heure réelle", "Établissement avec coordonnées", "Part autre"]
    rows = []
    for s, r in m["remplissage"].items():
        t = r["n"]
        rows.append([nom_source(s), n(t)] + [fpct(pct(r.get(k, 0), t)) for k in
                    ("description", "photos", "prix", "inscription", "heure", "coordonnees")]
                    + [fpct(m["autre"]["par_source"][s]["part"])])
    P.append(f"{h} Remplissage par source\n\n" + table(ent, rows))
    o, a = m["organisations"], m["annuaire"]
    P.append(f"{h} Organisations\n\n" + table(["Indicateur", "Valeur"],
             [["Total", n(o["total"])], ["Revendiquées (claimed_at)", n(o["revendiquees"])]]
             + [[f"Source : {s}", n(v)] for s, v in o["par_source"].items()]))
    P.append(f"{h} Annuaire\n\n" + table(["Indicateur", "Valeur"],
             [["Lieux", n(a["lieux"])], ["Avec site", n(a["avec_site"])],
              ["Rattachés à une organisation", n(a["rattaches"])]]
             + [[f"Site sondé, signal : {s}", n(v)] for s, v in a["sondes_par_signal"].items()]))
    P.append(f"{h} Imports des 7 derniers jours\n\n" + table(["Source", "Lignes"],
             [[nom_source(s), n(v)] for s, v in m["imports_semaine"]["par_source"].items()]
             or [["aucun", "0"]]))
    d = m["doublons"]
    ex = [[(x["titre"] or "").replace("|", "/"), x["jour"], x["ville"], x["nb"], ", ".join(x["sources"])] for x in d["exemples"]]
    P.append(f"{h} Doublons visibles\n\n{n(d['groupes'])} groupes, {n(d['fiches'])} fiches en doublon, "
             f"taux {fpct(d['taux'])}. Clé : titre normalisé, jour, ville de l'etablissement.\n\n"
             + (table(["Titre", "Jour", "Ville", "Fiches", "Sources"], ex) if ex else "Aucun doublon."))
    return "\n\n".join(P)


def rapport_md(m):
    synth = table(["Indicateur", "Valeur"], [[l, fmt(v, f)] for l, v, f in lignes_synthese(m)])
    return (f"# Mesure de la collecte du {m['date']}\n\nGénéré par `mesure-import.py` ({m['mesure_le']}). "
            f"Événements à venir visibles : show_on_public_site, statut publié, confirmé ou planifié, "
            f"start_at dans le futur.\n\n## Synthèse\n\n{synth}\n\n## Détail\n\n{detail_md(m)}\n")


def bloc_resultats(mesures):
    """mesures : liste triee par date croissante."""
    cols = mesures[-8:]
    derniere = cols[-1]
    libelles = []
    for m in cols:
        for l, _, f in lignes_synthese(m):
            if l not in libelles:
                libelles.append(l)
    rows = []
    for l in libelles:
        ligne = [l]
        for m in cols:
            d = {x[0]: (x[1], x[2]) for x in lignes_synthese(m)}
            ligne.append(fmt(*d[l]) if l in d else "")
        rows.append(ligne)
    return (table(["Indicateur"] + [m["date"] for m in cols], rows)
            + f"\n\n### Dernière mesure ({derniere['date']})\n\n" + detail_md(derniere, "####"))


INDICATEURS_CLES = [
    ("Rendez-vous à venir visibles", lambda m: (m["total"], "n")),
    ("dont sites des tiers-lieux", lambda m: (m["par_source"].get("site", 0), "n")),
    ("dont DATAtourisme", lambda m: (m["par_source"].get("datatourisme", 0), "n")),
    ("dont OpenAgenda", lambda m: (m["par_source"].get("openagenda", 0), "n")),
    ("dont collecte Casaminga (sans import)", lambda m: (m["par_source"].get("aucune", 0) + m["par_source"].get("collecte_casaminga", 0), "n")),
    ("Part sans type précis (autre)", lambda m: (m["autre"]["total"]["part"], "p")),
    ("Part en Hérault", lambda m: (m["part_herault"], "p")),
    ("Fiches avec heure réelle", lambda m: (part_de(m, "heure"), "p")),
    ("Fiches avec photo", lambda m: (part_de(m, "photos"), "p")),
    ("Doublons visibles (taux)", lambda m: (m["doublons"]["taux"], "p")),
    ("Organisations revendiquées", lambda m: (m["organisations"]["revendiquees"], "n")),
]


def bloc_dashboard(m, prec):
    rows = []
    for lib, fn in INDICATEURS_CLES:
        v, f = fn(m)
        txt = fmt(v, f)
        if prec:
            pv, _ = fn(prec)
            diff = v - pv
            if f == "p":
                s = f"{diff:+.1f}".replace(".", ",")
                s = s.replace(",0", "") if s.endswith(",0") else s
                txt += f" ({s} pt)"
            else:
                txt += f" ({diff:+d})"
        rows.append([lib, txt])
    ref = f", variations depuis la mesure du {prec['date']}" if prec else ", première mesure"
    return (f"Mesure du {m['date']}{ref}. Détail : `06-RESULTATS.md`.\n\n"
            + table(["Indicateur", "Valeur"], rows))


# ---------------------------------------------------------------- ecriture

def remplacer_bloc(texte, cle, contenu):
    deb, fin = MARQUEURS[cle]
    i, j = texte.find(deb), texte.find(fin)
    if i < 0 or j < 0 or j < i:
        raise SystemExit(f"Marqueurs {deb} / {fin} introuvables ou inverses.")
    return texte[:i + len(deb)] + "\n" + contenu.strip("\n") + "\n" + texte[j:]


def lire_mesures(dossier):
    out = []
    for p in sorted((dossier / "Mesures").glob("*.json")):
        try:
            out.append(json.loads(p.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError):
            print(f"Mesure illisible ignorée : {p.name}", file=sys.stderr)
    return sorted(out, key=lambda m: m["date"])


def main():
    ap = argparse.ArgumentParser(
        description="Mesure l'etat de la collecte d'evenements (lecture seule en base) et "
                    "met a jour les rapports du dossier 08 Import evenements.")
    ap.add_argument("--dossier", default=str(DOSSIER_RAPPORTS),
                    help=f"dossier de rapports (defaut : {DOSSIER_RAPPORTS})")
    ap.add_argument("--essai", action="store_true", help="affiche les resultats sans rien ecrire")
    args = ap.parse_args()
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    dossier = Path(args.dossier)

    url, key = load_env()
    db = Base(url, key)
    maintenant = datetime.now(timezone.utc)
    m = mesurer(db, maintenant)

    existantes = [x for x in lire_mesures(dossier) if x["date"] != m["date"]]
    prec = existantes[-1] if existantes else None
    toutes = existantes + [m]

    md = rapport_md(m)
    res = bloc_resultats(toutes)
    dash = bloc_dashboard(m, prec)

    if args.essai:
        print(md)
        print("\n----- bloc 06-RESULTATS -----\n" + res)
        print("\n----- bloc 00-DASHBOARD -----\n" + dash)
        return

    (dossier / "Mesures").mkdir(parents=True, exist_ok=True)
    (dossier / "Mesures" / f"{m['date']}.json").write_text(
        json.dumps(m, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (dossier / "Mesures" / f"{m['date']}.md").write_bytes(md.encode("utf-8"))
    for nom, cle, contenu in (("06-RESULTATS.md", "resultats", res), ("00-DASHBOARD.md", "mesures", dash)):
        p = dossier / nom
        ancien = p.read_bytes().decode("utf-8")  # octets bruts : les fins de ligne restent intactes
        p.write_bytes(remplacer_bloc(ancien, cle, contenu).encode("utf-8"))
    print(f"Mesure du {m['date']} écrite dans {dossier} ({n(m['total'])} événements à venir visibles).")


if __name__ == "__main__":
    main()
