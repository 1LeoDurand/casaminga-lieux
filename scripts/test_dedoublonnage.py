# -*- coding: utf-8 -*-
"""
Tests de scripts/dedoublonnage.py, sans base : fiches figees.

Les 16 paires viennent de la relecture en base du 2026-10-12 (conception P3,
section 3) : 3 paires de seances (a NE PAS lier) et 13 vrais doublons (a lier).
Les heures sont ecrites en UTC, avec l'heure de Paris en commentaire : le test
ne s'appuie pas sur les fonctions de fuseau du module.

  python scripts/test_dedoublonnage.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dedoublonnage as dd  # noqa: E402


def fiche(titre, debut, commune, source="openagenda", org="org-a", uid=None, **extra):
    """Une fiche lue a la source, comme la recevra Dedoublonneur.chercher()."""
    f = {"titre": titre, "debut": debut, "commune": commune, "organization_id": org,
         "source": source, "source_uid": uid or titre[:8]}
    f.update(extra)
    return f


def index_avec(*fiches, ids=None):
    """Dedoublonneur sans base, dont l'index contient ces fiches (en base)."""
    d = dd.Dedoublonneur(None)
    for i, f in enumerate(fiches):
        e = dd.entree_de_fiche(f, en_lot=False, id_=(ids[i] if ids else f"id-{i}"))
        d.indexer(e)
    return d


# ---------------------------------------------------------------- les 16 paires du jour

# 3 paires de seances : meme titre, meme lieu, meme jour, horaires 75 a 105 min d'ecart.
SEANCES = [
    ("Issy, Papier recyclé (14 h 30 et 16 h 15)",
     fiche("Papier recyclé", "2026-11-07T13:30:00+00:00", "Issy-les-Moulineaux", uid="93470935"),
     fiche("Papier recyclé", "2026-11-07T15:15:00+00:00", "Issy-les-Moulineaux", uid="96179577")),
    ("Issy, Sons, images et médias (14 h 30 et 15 h 45)",
     fiche("Sons, images et médias", "2026-12-12T13:30:00+00:00", "Issy-les-Moulineaux", uid="90790292"),
     fiche("Sons, images et médias", "2026-12-12T14:45:00+00:00", "Issy-les-Moulineaux", uid="11832921")),
    ("Issy, Au-delà des étoiles (14 h 30 et 15 h 45)",
     fiche("Au-delà des étoiles", "2027-01-30T13:30:00+00:00", "Issy-les-Moulineaux", uid="53489175"),
     fiche("Au-delà des étoiles", "2027-01-30T14:45:00+00:00", "Issy-les-Moulineaux", uid="38643628")),
]

# 13 vrais doublons. Premiere fiche = celle deja en base, seconde = la nouvelle.
DOUBLONS = [
    ("Lille, Haute Fréquence (19 h 30 et 20 h)",
     fiche("Festival Haute Fréquence - Emel & Hajar Benhsaïn", "2026-11-28T18:30:00+00:00", "Lille", uid="4948055"),
     fiche("Festival Haute Fréquence | Emel + Hajar Benhsaïn", "2026-11-28T19:00:00+00:00", "Lille", uid="29422046")),
    ("Lille, Family Circus (le point d'exclamation)",
     fiche("Family Circus", "2026-11-15T09:00:00+00:00", "Lille", uid="45232725"),
     fiche("Family Circus !", "2026-11-15T09:00:00+00:00", "Lille", uid="73025663")),
    ("Pau, Bicentenaire (deux lieux, l'un toute la journée)",
     fiche("Bicentenaire de la photographie : images d’archives", "2027-02-16T12:30:00+00:00", "Pau",
           org="org-pau-1", uid="38451633"),
     fiche("Bicentenaire de la photographie : images d’archives", "2027-02-15T23:00:00+00:00", "Pau",
           org="org-pau-2", uid="19585717")),
    ("Le Luc, exposition d'Alex Z (API et ICS)",
     fiche("Du 4 au 21 novembre, Exposition d’Alex Z", "2026-11-04T09:00:00+00:00", "Le Luc",
           source="site:www.mairie-leluc.com", uid="65687"),
     fiche("Du 4 au 21 novembre - Exposition d'Alex Z", "2026-11-04T09:00:00+00:00", "Le Luc",
           source="site:www.mairie-leluc.com", uid="65687-1793786400-1795284000@www.mairie-leluc.com")),
    ("Le Luc, spectacle du 15 novembre (API et ICS)",
     fiche("Dimanche 15 novembre, Spectacle « Et si les œuvres d’art pouvaient parler »",
           "2026-11-15T16:00:00+00:00", "Le Luc", source="site:www.mairie-leluc.com", uid="65664"),
     fiche("Dimanche 15 novembre - Spectacle \"Et si les œuvres d'art pouvaient parler\"",
           "2026-11-15T16:00:00+00:00", "Le Luc", source="site:www.mairie-leluc.com",
           uid="65664-1794762000-1794769200@www.mairie-leluc.com")),
    ("Le Luc, concours photo (API et ICS)",
     fiche("Du 5 janvier au 25 février, Lancement du concours photo « Les couleurs d’automne »",
           "2027-01-05T09:00:00+00:00", "Le Luc", source="site:www.mairie-leluc.com", uid="60769"),
     fiche("Du 5 janvier au 25 février - Lancement du concours photo « Les couleurs d'automne »",
           "2027-01-05T09:00:00+00:00", "Le Luc", source="site:www.mairie-leluc.com",
           uid="60769-1799143200-1803578400@www.mairie-leluc.com")),
    ("Trilport, Lecture de contes (API et ICS)",
     fiche("Parlons d’enfance 2026. Lecture de contes", "2026-12-02T15:00:00+00:00", "Trilport",
           source="site:www.trilport.fr", uid="63594"),
     fiche("Parlons d'enfance 2026. Lecture de contes", "2026-12-02T15:00:00+00:00", "Trilport",
           source="site:www.trilport.fr", uid="63594-1796227200-1796232600@www.trilport.fr")),
    ("Trilport, Éveil musical (API et ICS)",
     fiche("Parlons d’enfance. Eveil Musical", "2026-12-05T09:00:00+00:00", "Trilport",
           source="site:www.trilport.fr", uid="63624"),
     fiche("Parlons d'enfance. Eveil Musical", "2026-12-05T09:00:00+00:00", "Trilport",
           source="site:www.trilport.fr", uid="63624-1796464800-1796472000@www.trilport.fr")),
    ("Rennes, jeux de société (deux organisations pour une structure)",
     fiche("Après-midi jeux de société au Cadran", "2026-11-04T14:00:00+00:00", "Rennes",
           source="site:www.3regards.com", org="org-3regards", uid="https://www.3regards.com/agenda/1"),
     fiche("Après-midi jeux de société au Cadran", "2026-11-04T14:00:00+00:00", "Rennes",
           org="org-cadran", uid="41539589")),
    ("Rennes, Fête de l'Hiver (deux organisations)",
     fiche("Fête de l'Hiver 2026", "2026-12-04T15:00:00+00:00", "Rennes",
           source="site:www.3regards.com", org="org-3regards", uid="https://www.3regards.com/agenda/2"),
     fiche("Fête de l'Hiver 2026", "2026-12-04T15:00:00+00:00", "Rennes", org="org-cadran", uid="15231712")),
    ("Cenon, LA CHICA (deux organisations)",
     fiche("LA CHICA", "2026-10-15T18:30:00+00:00", "Cenon",
           source="site:lerocherdepalmer.fr", org="org-palmer", uid="https://lerocherdepalmer.fr/agenda/1"),
     fiche("LA CHICA", "2026-10-15T18:30:00+00:00", "Cenon", org="org-friquet", uid="21945830")),
    ("Roques, À table (site à minuit heure de Paris, 22 h UTC la veille)",
     fiche("À table, tout le monde!", "2026-10-20T22:00:00+00:00", "Roques",
           source="site:www.lemoulin-roques.com", uid="4850"),
     fiche("À table, tout le monde!", "2026-10-21T08:00:00+00:00", "Roques", uid="90091509")),
    ("Roques, Fraternité (site à minuit heure de Paris, 23 h UTC la veille)",
     fiche("أخوّة /ukhuwwa/ Fraternité", "2027-01-12T14:00:00+00:00", "Roques", uid="27648477"),
     fiche("أخوّة /ukhuwwa/ Fraternité", "2027-01-11T23:00:00+00:00", "Roques",
           source="site:www.lemoulin-roques.com", uid="4688")),
]

# 5 cas negatifs : aucune liaison, aucune seance.
NEGATIFS = [
    ("meme titre, autre commune (sans coordonnees)",
     fiche("Fête de la science", "2026-10-17T09:00:00+00:00", "Lille"),
     fiche("Fête de la science", "2026-10-17T09:00:00+00:00", "Roubaix")),
    ("meme titre, autre commune a 5 km (coordonnees)",
     fiche("Repair café", "2026-10-17T13:00:00+00:00", "Lille", lat=50.6292, lng=3.0573),
     fiche("Repair café", "2026-10-17T13:00:00+00:00", "Villeneuve-d'Ascq", lat=50.6270, lng=3.1300)),
    ("meme titre, lendemain (serie)",
     fiche("Marché des créateurs de la halle", "2026-10-17T09:00:00+00:00", "Nantes"),
     fiche("Marché des créateurs de la halle", "2026-10-18T09:00:00+00:00", "Nantes")),
    ("meme titre, une semaine plus tard (serie)",
     fiche("Atelier tricot du jeudi soir", "2026-10-15T17:00:00+00:00", "Albi"),
     fiche("Atelier tricot du jeudi soir", "2026-10-22T17:00:00+00:00", "Albi")),
    ("titre proche sous 0,85 (0,84)",
     fiche("Concert de jazz au jardin", "2026-10-17T18:00:00+00:00", "Tours"),
     fiche("Concert de rock au jardin", "2026-10-17T18:00:00+00:00", "Tours")),
]


def test_seances_ne_sont_pas_des_doublons():
    for nom, a, b in SEANCES:
        niveau, _ = dd.classer_paire(dd.entree_de_fiche(a), dd.entree_de_fiche(b))
        assert niveau == dd.NIVEAU_SEANCE, f"{nom} : niveau {niveau}, attendu 4 (seance)"
        for existante, nouvelle in ((a, b), (b, a)):  # dans les deux sens
            d = index_avec(existante)
            assert d.chercher(nouvelle) is None, f"{nom} : liee a tort"
            assert d.compteurs["seances"] == 1, f"{nom} : seance non comptee"


def test_vrais_doublons_sont_lies_dans_les_deux_sens():
    assert len(DOUBLONS) == 13
    for nom, a, b in DOUBLONS:
        for sens, (existante, nouvelle) in (("ordre 1", (a, b)), ("ordre 2", (b, a))):
            d = index_avec(existante, ids=["garde"])
            r = d.chercher(nouvelle)
            assert r is not None, f"{nom} ({sens}) : doublon non detecte"
            assert r.event_id == "garde", f"{nom} ({sens}) : mauvaise fiche gardee"
            assert r.niveau == dd.NIVEAU_EXACT and r.raison == "exact", \
                f"{nom} ({sens}) : niveau {r.niveau}, attendu 2 (exact)"


def test_cas_negatifs():
    assert len(NEGATIFS) == 5
    for nom, a, b in NEGATIFS:
        for existante, nouvelle in ((a, b), (b, a)):
            d = index_avec(existante)
            assert d.chercher(nouvelle) is None, f"{nom} : lie a tort"


def test_ecart_exact_proche():
    """Niveau 3 : titre a 0,85 ou plus, ou contenu (15 caracteres au moins)."""
    d = index_avec(fiche("Marché de Noël des créateurs", "2026-12-12T09:00:00+00:00", "Dijon"))
    r = d.chercher(fiche("Marché de Pâques des créateurs", "2026-12-12T09:00:00+00:00", "Dijon"))
    assert r and r.niveau == dd.NIVEAU_PROCHE and r.score >= 0.85
    d = index_avec(fiche("Vernissage de l'exposition Méridionalité", "2026-10-15T16:00:00+00:00", "Montpellier"))
    r = d.chercher(fiche("Vernissage de l'exposition Méridionalité et autres voies", "2026-10-15T16:00:00+00:00", "Montpellier"))
    assert r and r.niveau == dd.NIVEAU_PROCHE
    # titre court contenu : sous 15 caracteres, pas de liaison
    d = index_avec(fiche("Atelier jeux", "2026-10-15T16:00:00+00:00", "Montpellier"))
    assert d.chercher(fiche("Atelier jeux de société pour tous", "2026-10-15T16:00:00+00:00", "Montpellier")) is None


def test_horaire_et_lieu():
    u = dd.vers_dt
    assert dd.horaire_compatible(u("2026-11-28T18:30:00+00:00"), u("2026-11-28T19:30:00+00:00"))      # 60 min
    assert not dd.horaire_compatible(u("2026-11-28T18:30:00+00:00"), u("2026-11-28T19:31:00+00:00"))  # 61 min
    assert dd.heure_inconnue(u("2026-10-20T22:00:00+00:00"))     # minuit Paris, ete
    assert dd.heure_inconnue(u("2027-01-11T23:00:00+00:00"))     # minuit Paris, hiver
    assert not dd.heure_inconnue(u("2026-10-20T23:00:00+00:00"))
    assert dd.jour_paris(u("2026-10-20T22:00:00+00:00")) == "2026-10-21"
    assert dd.commune_norm("Paris 11e") == dd.commune_norm("PARIS") == dd.commune_norm("75011 Paris") == "paris"
    assert dd.commune_norm("Saint-Étienne") == "saint etienne"
    assert dd.lieu_compatible("Lille", None, None, None, None, None)          # commune inconnue
    assert dd.lieu_compatible("Lille", 50.63, 3.06, "Lomme", 50.632, 3.062)   # a moins d'1 km
    assert not dd.lieu_compatible("Lille", 50.63, 3.06, "Roubaix", 50.69, 3.17)


def test_uid_canonique_et_deja_lie():
    assert dd.uid_canonique("65664-1794762000-1794769200@www.mairie-leluc.com") == "65664"
    assert dd.uid_canonique("65664") == "65664"
    assert dd.uid_canonique("https://exemple.fr/agenda/1") == "https://exemple.fr/agenda/1"
    d = index_avec(fiche("Spectacle", "2026-11-15T16:00:00+00:00", "Le Luc",
                         source="site:www.mairie-leluc.com", uid="65664"))
    assert d.deja_lie("site:www.mairie-leluc.com", "65664-1794762000-1794769200@www.mairie-leluc.com",
                      "2026-11-15T16:00:00+00:00")
    assert not d.deja_lie("site:www.mairie-leluc.com", "65664", "2026-11-16T16:00:00+00:00")


def test_lien_annule_pas_relie():
    d = index_avec(fiche("Family Circus", "2026-11-15T09:00:00+00:00", "Lille"))
    d._cles_annulees.add(d._cle("openagenda", "73025663", "2026-11-15T09:00:00+00:00"))
    assert d.chercher(fiche("Family Circus !", "2026-11-15T09:00:00+00:00", "Lille", uid="73025663")) is None
    assert d.chercher(fiche("Family Circus !", "2026-11-15T09:00:00+00:00", "Lille", uid="autre")) is not None


def test_lot_compare_au_lot():
    """Une fiche acceptee dans le lot est comparee aux suivantes."""
    d = dd.Dedoublonneur(None)
    f1 = fiche("Family Circus", "2026-11-15T09:00:00+00:00", "Lille", uid="1")
    assert d.chercher(f1) is None
    d.enregistrer(f1, "nouvelle-1")
    r = d.chercher(fiche("Family Circus !", "2026-11-15T09:00:00+00:00", "Lille", uid="2"))
    assert r and r.event_id == "nouvelle-1"


def _entree_import(id_, source, debut, **kw):
    f = fiche(kw.pop("titre", "Concert au jardin"), debut, "Tours", source=source, uid=id_, **kw)
    return dd.entree_de_fiche(f, en_lot=False, id_=id_)


def test_enrichissement_et_gardes():
    # La gardee est a heure inconnue, sans photo ni inscription : elle prend l'heure, la photo,
    # la description et le lien d'inscription du doublon (R2 : pas HelloAsso ; R13 : pas de contact tiers).
    gardee = _entree_import("g", "datatourisme", "2026-11-14T23:00:00+00:00")
    doublon = _entree_import("d", "openagenda", "2026-11-15T17:00:00+00:00",
                             photos=["https://x/p.jpg"], description="x" * 80, price=12.0,
                             fin="2026-11-15T19:00:00+00:00",
                             registration=[{"type": "link", "value": "https://billet.exemple.fr/1"},
                                           {"type": "link", "value": "https://www.helloasso.com/e/1"},
                                           {"type": "email", "value": "contributeur@exemple.fr"},
                                           {"type": "phone", "value": "0102030405"}])
    # le doublon est a heure connue ; la gardee est a minuit Paris (23 h UTC la veille), meme jour Paris
    e = dd.calculer_enrichissement(gardee, doublon, "openagenda")
    assert set(e) == {"start_at", "end_at", "photos", "description", "registration", "price"}, set(e)
    assert e["registration"]["apres"] == [{"type": "link", "value": "https://billet.exemple.fr/1"}]
    assert e["start_at"]["avant"].startswith("2026-11-14T23:00")
    # R8 : checked_at bloque tout
    gardee.checked_at = "2026-10-01T00:00:00+00:00"
    assert dd.calculer_enrichissement(gardee, doublon, "openagenda") == {}
    gardee.checked_at = None
    # saisie admin (aucune source) : jamais enrichie
    admin = _entree_import("a", None, "2026-11-14T23:00:00+00:00")
    assert dd.calculer_enrichissement(admin, doublon, "openagenda") == {}
    # retrait de medias actif (P2) : ni photo ni description
    e = dd.calculer_enrichissement(gardee, doublon, "openagenda", retraits={"org-a"})
    assert "photos" not in e and "description" not in e and "price" in e
    # une valeur deja presente n'est jamais ecrasee
    gardee.photos, gardee.price = ["https://x/deja.jpg"], 5.0
    e = dd.calculer_enrichissement(gardee, doublon, "openagenda")
    assert "photos" not in e and "price" not in e


def test_lier_enrichit_et_ecrire_essai_n_ecrit_rien():
    d = dd.Dedoublonneur(None)
    d.indexer(_entree_import("garde", "datatourisme", "2026-11-14T23:00:00+00:00"))
    nouvelle = fiche("Concert au jardin", "2026-11-15T17:00:00+00:00", "Tours", photos=["https://x/p.jpg"])
    r = d.chercher(nouvelle)
    assert r and r.niveau == dd.NIVEAU_EXACT
    ligne = d.lier(r, nouvelle, "openagenda", "u1", "https://oa/u1")
    assert ligne["regle"] == dd.REGLE == "v1-2026-10" and ligne["event_id"] == "garde"
    assert "start_at" in ligne["enrichi"] and "photos" in ligne["enrichi"]
    assert d.par_id["garde"].photos == ["https://x/p.jpg"]      # reporte sur l'index
    bilan = d.ecrire(essai=True)
    assert bilan["ecrit"] is False and bilan["liens"] == 1 and bilan["fiches_enrichies"] == 1
    assert d.deja_lie("openagenda", "u1", "2026-11-15T17:00:00+00:00")


def test_election_de_la_gardee():
    riche = _entree_import("riche", "openagenda", "2026-11-15T17:00:00+00:00",
                           photos=["p"], description="x" * 60)
    pauvre = _entree_import("pauvre", "datatourisme", "2026-11-14T23:00:00+00:00")
    assert dd.elire_gardee(pauvre, riche)[0] is riche
    pauvre.checked_at = "2026-10-01T00:00:00+00:00"                # checked_at gagne toujours
    assert dd.elire_gardee(riche, pauvre)[0] is pauvre
    riche.checked_at = "2026-10-02T00:00:00+00:00"                 # les deux : rien n'est masque
    assert dd.elire_gardee(riche, pauvre) == (None, None)
    riche.checked_at = pauvre.checked_at = None
    admin = _entree_import("admin", None, "2026-11-14T23:00:00+00:00")
    assert dd.elire_gardee(riche, admin)[0] is admin               # saisie admin : toujours gardee


def main():
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    echecs = 0
    for nom, f in tests:
        try:
            f()
            print(f"ok   {nom}")
        except AssertionError as exc:
            echecs += 1
            print(f"ECHEC {nom} : {exc}")
    print(f"\n{len(tests) - echecs}/{len(tests)} tests passent "
          f"({len(DOUBLONS)} doublons + {len(SEANCES)} seances + {len(NEGATIFS)} cas negatifs)")
    return 1 if echecs else 0


if __name__ == "__main__":
    for flux in (sys.stdout, sys.stderr):
        try:
            flux.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    sys.exit(main())
