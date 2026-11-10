# -*- coding: utf-8 -*-
"""
Tests de scripts/ecrire-lecture.py, sans base ni réseau : T36.6 (lieu implicite
repris du siège) et T36.7 (année déduite du jour de la semaine).

Les phrases viennent des rejets `sans_annee` du premier lot de lecture par modèle
(2026-10-13, `Mesures/lecture/resultat-*.json`) ; la date de référence de ce lot
est le 2026-10-13, fixée ici pour que les tests ne dépendent pas du jour où ils
tournent.

  python scripts/test_lecture.py
"""

import importlib.util
import sys
import tempfile
from datetime import date, datetime
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
_spec = importlib.util.spec_from_file_location("ecrire_lecture", ICI / "ecrire-lecture.py")
EL = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(EL)

REF = date(2026, 10, 13)


def deduit(jour, mois, extrait, extrait_annee="", ref=REF):
    return EL.annee_deduite(datetime(2026, mois, jour), extrait, extrait_annee, ref)


# ── T36.7 : année déduite ────────────────────────────────────────

def test_annee_deduite_retenue():
    # Cas réels du premier lot : le jour de la semaine ne convient qu'à 2026.
    assert deduit(22, 10, "Jeudi 22 octobre : entomologie. Conférence sur « Insectes et Santé ».") == 2026
    assert deduit(17, 10, "### STAGE de Rentrée à Sète – samedi 17 Octobre") == 2026
    assert deduit(3, 11, "Mardi 6 octobre - Mardi 13 octobre - Mardi 20 octobre - Mardi 3 novembre") == 2026
    # Abréviation et date numérique.
    assert deduit(14, 11, "sam. 14/11 : bal") == 2026


def test_annee_deduite_refusee():
    # Le jour de la semaine ne convient pas à l'année de la fenêtre : on ne devine pas.
    assert deduit(18, 4, "Samedi 18 avril 20H") is None            # 18 avril 2027 est un dimanche
    assert deduit(31, 8, "le LUNDI 31 AOUT") is None                # 31 août 2026 est passé
    assert deduit(6, 9, "le dimanche 6 septembre.") is None
    assert deduit(9, 10, "Démarrage jeudi 9 OCT à 20H15") is None   # 9 octobre 2026 est un vendredi
    assert deduit(7, 6, "Samedi 7 juin de 10h à 12h") is None
    # Sans jour de la semaine : toujours rejeté (règle de Léo, 2026-11-10).
    assert deduit(21, 10, "21 Octobre à 20H00") is None
    assert deduit(6, 11, "Création le 6 novembre à 14h00 et le 7 novembre à 16h00") is None
    # Une année écrite (dans l'extrait ou le titre de section) relève de la voie normale.
    assert deduit(17, 10, "Samedi 17 octobre 2026") is None
    assert deduit(17, 10, "Samedi 17 octobre", "Octobre 2026") is None
    assert deduit(17, 10, "Samedi 17 octobre", "Saison 2026-2027") is None
    # « mar » ne doit pas lire le mois de mars.
    assert deduit(12, 3, "mars 12 : atelier") is None


def test_annee_deduite_annee_suivante():
    # Le 3 mars 2027 est un mercredi : accepté s'il est dans la fenêtre.
    assert EL.annee_deduite(datetime(2026, 3, 3), "Mercredi 3 mars : conférence", "", REF) == 2027


# ── T36.6 : siège ────────────────────────────────────────────────

def faux_rna(lignes):
    d = tempfile.mkdtemp()
    chemin = Path(d) / "rna.csv"
    chemin.write_text("id;titre;objet;code_postal;commune;site;thematique\n" + "\n".join(lignes) + "\n",
                      encoding="utf-8")
    return chemin


def site(sid="exemple.fr", commune="Montpellier", association="Compagnie du Test", cp=None):
    return {"site_id": sid, "site": f"https://{sid}", "association": association,
            "commune": commune, "code_postal": cp, "date_reference": "2026-10-13"}


def test_siege_commune_annuaire():
    s = EL.Sieges(None, None).de(site())
    assert s["commune"] == "Montpellier" and s["adresse"] is None and s["precision"] == "commune"


def test_siege_rna_par_nom():
    rna = faux_rna(["W1;COMPAGNIE DU TEST;x;34170;Castelnau-le-Lez;;oui"])
    s = EL.Sieges(None, rna).de(site(commune="code postal 34170"))
    assert s["commune"] == "Castelnau-le-Lez" and s["code_postal"] == "34170"


def test_siege_commune_sans_cedex():
    assert EL.Sieges(None, None).de(site(commune="Montpellier Cedex 5"))["commune"] == "Montpellier"


def test_siege_rna_ambigu_ou_absent():
    rna = faux_rna(["W1;COMPAGNIE DU TEST;x;34170;Castelnau-le-Lez;;oui",
                    "W2;COMPAGNIE DU TEST;x;34000;Montpellier;;oui"])
    assert EL.Sieges(None, rna).de(site(commune="code postal 34170")) is None   # deux homonymes : on ne choisit pas
    assert EL.Sieges(None, None).de(site(commune="code postal 34170")) is None  # commune inconnue


def test_domicile_jamais_repris():
    for adr in ["chez M. Martin 12 rue des Lilas", "c/o Dupont, 3 rue X", "BP 45", "Boîte postale 12",
                "Mme Durand 4 impasse Y", "CS 30001"]:
        assert EL.DOMICILE.search(adr), adr
    for adr in ["12 rue des Lilas", "Place de la Comédie", "Maison pour tous Léo Lagrange"]:
        assert not EL.DOMICILE.search(adr), adr
    sg = EL.Sieges(None, None)
    sg.par_domaine["exemple.fr"] = [{"adresse": "chez M. Martin 12 rue des Lilas", "commune": "Lattes",
                                     "code_postal": "34970", "source": "annuaire"}]
    assert sg.de(site()) is None and sg.motifs["exemple.fr"] == "siege_inutilisable"


def test_siege_adresse_de_rue_prioritaire():
    sg = EL.Sieges(None, None)
    sg.par_domaine["exemple.fr"] = [{"adresse": "8 Avenue du Lac 34800 Clermont-l'Hérault",
                                     "commune": "Clermont-l'Hérault", "code_postal": "34800",
                                     "source": "Recensement des tiers-lieux"}]
    s = sg.de(site())
    assert s["precision"] == "adresse" and s["adresse"].startswith("8 Avenue")


# ── Garde-fous bout en bout (examiner) ───────────────────────────

PAGE = "https://exemple.fr/agenda"
TEXTE = "### Agenda\nJeudi 22 octobre : Conférence sur les insectes, entrée libre.\nSamedi 18 avril 20H Soirée."


def fiche(**kw):
    f = {"site_id": "exemple.fr", "page": PAGE, "titre": "Conférence sur les insectes",
         "debut": "2026-10-22T20:00", "fin": None, "heure_ecrite": True, "lieu_nom": None, "lieu_adresse": None,
         "lieu_commune": None, "confiance": "haute", "lien": PAGE, "type": "rencontre",
         "extrait": "Jeudi 22 octobre : Conférence sur les insectes, entrée libre.", "extrait_annee": None}
    f.update(kw)
    return f


def examiner(f, sieges):
    return EL.examiner(f, site(), {("exemple.fr", PAGE): TEXTE}, REF, sieges)


def test_examiner_annee_et_lieu_deduits():
    r, motif = examiner(fiche(), EL.Sieges(None, None))
    assert motif is None, motif
    assert r["annee_deduite"] and r["lieu_deduit"] and r["lieu_commune"] == "Montpellier"
    assert r["debut_local"].year == 2026


def test_examiner_corrige_l_annee_du_modele():
    # Le modèle s'est trompé d'année : la déduction l'emporte (une seule année convient).
    r, motif = examiner(fiche(debut="2025-10-22T20:00"), EL.Sieges(None, None))
    assert motif is None and r["debut_local"] == datetime(2026, 10, 22, 20, 0)


def test_examiner_sans_siege_reste_ecarte():
    sg = EL.Sieges(None, None)
    sg.cache["exemple.fr"] = None
    r, motif = examiner(fiche(), sg)
    assert r is None and motif == "sans_lieu"
    sg.motifs["exemple.fr"] = "siege_inutilisable"
    r, motif = examiner(fiche(), sg)
    assert motif == "siege_inutilisable"


def test_examiner_date_sans_jour_de_semaine_rejetee():
    f = fiche(extrait="Jeudi 22 octobre : Conférence sur les insectes, entrée libre.")
    texte = TEXTE.replace("Jeudi 22", "22")
    f["extrait"] = f["extrait"].replace("Jeudi 22", "22")
    r, motif = EL.examiner(f, site(), {("exemple.fr", PAGE): texte}, REF, EL.Sieges(None, None))
    assert r is None and motif == "date_non_litterale"


def test_examiner_lieu_ecrit_prime_sur_le_siege():
    r, motif = examiner(fiche(lieu_nom="Salle Pagézy", lieu_commune="Lattes"), EL.Sieges(None, None))
    assert motif is None and not r["lieu_deduit"] and r["lieu_commune"] == "Lattes"


def test_examiner_annee_ecrite_voie_normale():
    f = fiche(extrait="Jeudi 22 octobre 2026 : Conférence")
    t = TEXTE.replace("Jeudi 22 octobre :", "Jeudi 22 octobre 2026 :")
    r, motif = EL.examiner(f, site(), {("exemple.fr", PAGE): t}, REF, EL.Sieges(None, None))
    assert motif is None and not r["annee_deduite"]


if __name__ == "__main__":
    n = 0
    for nom, fn in sorted(globals().items()):
        if nom.startswith("test_") and callable(fn):
            fn()
            n += 1
            print(f"ok  {nom}")
    print(f"{n} tests passés")
