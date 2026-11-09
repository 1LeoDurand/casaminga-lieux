# -*- coding: utf-8 -*-
"""
Tests de typer_v2 pour la regle « festival » (T7.2, 2026-11-10), sans base.

Un titre en « festival » ne devient « concert » que s'il porte un indice
musical. Les cas viennent de l'essai a blanc du 2026-11-10 : quatre festivals
de cinema ou d'alimentation passaient en « concert » (le cinema reste spectacle).

  python scripts/test_typage.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_commun import typer_v2  # noqa: E402

CAS = [
    ("Festival International du Film d'Environnement", "spectacle"),
    ("Festival Alimenterre", None),
    ("La Baleine : Festival \" On court à la Baleine\"", None),
    ("Festival international du film d'environnement (FReDD)", "spectacle"),
    ("Festival du court métrage de Lisle", "spectacle"),
    ("Festival Jazz à Marciac", "concert"),
    ("Festival de musique de Saint-Guilhem", "concert"),
    ("Festival Rock en Seine", "concert"),
    ("Festival de théâtre de rue", "spectacle"),
    ("Concert de Noël", "concert"),
]


def main():
    echecs = 0
    for titre, attendu in CAS:
        code, _ = typer_v2(titre)
        ok = code == attendu
        echecs += not ok
        print(("ok  " if ok else "ECHEC"), titre, "->", code, "(attendu", attendu, ")")
    print(f"{len(CAS) - echecs}/{len(CAS)} ok")
    sys.exit(1 if echecs else 0)


if __name__ == "__main__":
    main()
