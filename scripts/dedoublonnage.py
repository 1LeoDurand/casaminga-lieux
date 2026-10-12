# -*- coding: utf-8 -*-
"""
Dedoublonnage croise des evenements entre sources (regle R7).

Un seul module, une seule regle, partagee par les scripts d'import et par la
mesure : c'est tout son interet (conception P3, section 4). Le typage peut
differer d'une source a l'autre, pas le dedoublonnage.

Les quatre niveaux, pour chaque fiche lue a la source :
  1. meme fiche : l'identifiant existe deja, ou le triplet
     (source, source_uid, debut) est deja dans evenements_doublons ;
  2. exact : meme titre normalise, meme jour (heure de Paris), lieu compatible,
     horaire compatible ;
  3. proche : titre a 0,85 ou plus (difflib), ou contenu dans l'autre (15
     caracteres au moins), meme jour, lieu et horaire compatibles ;
  4. seance ou serie, PAS un doublon : meme titre, meme lieu, horaires
     incompatibles le meme jour, ou jours differents. La fiche entre.

Regle de garde : la fiche deja en base est gardee et enrichie, la nouvelle est
liee (jamais supprimee). Rien n'est ecrit sans appel explicite a ecrire().

Usage en ligne de commande (lecture seule) :
  python scripts/dedoublonnage.py --mesurer
"""

import argparse
import difflib
import math
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_commun import Base, load_env, titre_normalise  # noqa: E402

REGLE = "v1-2026-10"

SEUIL_SIMILARITE = 0.85          # niveau 3, comme import-datatourisme.py
SEUIL_GARDE_MOTS = 0.95          # sous ce score, des mots propres a chaque titre = pas un doublon (C3)
LONGUEUR_CONTENU = 15            # titre contenu dans l'autre : 15 caracteres au moins
SEUIL_HORAIRE_MIN = 60           # minutes entre doublon et seance
DISTANCE_LIEU_KM = 1.0
DESCRIPTION_COURTE = 40          # en dessous : description a enrichir

NIVEAU_EXACT, NIVEAU_PROCHE, NIVEAU_SEANCE = 2, 3, 4
RAISONS = {NIVEAU_EXACT: "exact", NIVEAU_PROCHE: "proche"}

# Rang des sources quand la richesse est a egalite (reprise de l'existant).
# Une fiche sans ligne evenements_import (saisie admin) ou issue de la collecte
# Casaminga passe avant les sources moissonnees.
RANG_SOURCE = {"casaminga": 10, "collecte_casaminga": 10, "openagenda": 8,
               "site": 6, "datatourisme": 5}

HELLOASSO = re.compile(r"helloasso", re.I)
UID_ICS = re.compile(r"^(\d+)-\d{9,}-\d{9,}@[^@\s]+$")


# ---------------------------------------------------------------- temps

def vers_dt(valeur):
    """Chaine ISO (ou datetime) -> datetime conscient, en UTC. None si illisible.
    Un instant sans fuseau est lu en UTC : les scripts d'import ont deja
    converti l'heure de Paris, le module ne refait pas cette lecture."""
    if valeur is None:
        return None
    if isinstance(valeur, datetime):
        d = valeur
    else:
        s = str(valeur).strip().replace("Z", "+00:00").replace(" ", "T", 1)
        try:
            d = datetime.fromisoformat(s)
        except ValueError:
            return None
    return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)


def _dernier_dimanche(annee, mois):
    d = datetime(annee, mois, 31, tzinfo=timezone.utc)
    return d - timedelta(days=(d.weekday() + 1) % 7)


def decalage_paris(d_utc):
    """2 h en heure d'ete (du dernier dimanche de mars 01 h UTC au dernier
    dimanche d'octobre 01 h UTC), sinon 1 h. Sans zoneinfo : le paquet tzdata
    manque sous Windows."""
    debut = _dernier_dimanche(d_utc.year, 3).replace(hour=1)
    fin = _dernier_dimanche(d_utc.year, 10).replace(hour=1)
    return 2 if debut <= d_utc < fin else 1


def vers_paris(d_utc):
    return (d_utc + timedelta(hours=decalage_paris(d_utc))).replace(tzinfo=None)


def jour_paris(d_utc):
    """Jour (AAAA-MM-JJ) lu en heure de Paris, jamais en UTC."""
    return vers_paris(d_utc).strftime("%Y-%m-%d")


def heure_inconnue(d_utc):
    """Minuit heure de Paris : convention DATAtourisme et sites « toute la journee »."""
    p = vers_paris(d_utc)
    return (p.hour, p.minute) == (0, 0)


def horaire_compatible(d1, d2):
    """Debuts a 60 minutes ou moins, ou l'un des deux a heure inconnue."""
    if heure_inconnue(d1) or heure_inconnue(d2):
        return True
    return abs((d1 - d2).total_seconds()) <= SEUIL_HORAIRE_MIN * 60


# ---------------------------------------------------------------- lieu

_ARRONDISSEMENT = re.compile(r"\b\d+\s*(?:er|e|eme|ieme)?\b|\b(?:arrondissement|arr|cedex)\b")


def commune_norm(commune):
    """Commune sans accent, sans arrondissement ni code postal : « Paris 11e »,
    « 75011 Paris » et « Paris » valent « paris ». None si vide."""
    s = unicodedata.normalize("NFKD", commune or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = _ARRONDISSEMENT.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s or None


def distance_km(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 12742.0 * math.asin(math.sqrt(a))


def lieu_compatible(c1, lat1, lng1, c2, lat2, lng2):
    """Meme commune normalisee, ou les deux a 1 km au plus quand les deux ont
    des coordonnees, ou l'un des deux sans commune connue."""
    n1, n2 = commune_norm(c1), commune_norm(c2)
    if not n1 or not n2:
        return True
    if n1 == n2:
        return True
    if None not in (lat1, lng1, lat2, lng2):
        return distance_km(float(lat1), float(lng1), float(lat2), float(lng2)) <= DISTANCE_LIEU_KM
    return False


# ---------------------------------------------------------------- titres

def titre_cle(titre):
    """Titre normalise pour la comparaison : titre_normalise() de import_commun
    apres avoir ramene l'apostrophe typographique (U+2019) et les ligatures a
    leur forme simple. Sans cela, « d’Alex » devient « dalex » et « d'Alex »
    devient « d alex » : les deux canaux d'un meme site (API et ICS) ne se
    reconnaissent pas. import_commun.py n'est pas modifie."""
    t = (titre or "").replace("’", "'").replace("‘", "'").replace("ʼ", "'")
    t = t.replace("œ", "oe").replace("Œ", "OE").replace("æ", "ae").replace("Æ", "AE")
    return titre_normalise(t)


def similarite(tn1, tn2):
    return difflib.SequenceMatcher(None, tn1, tn2).ratio()


def titre_proche(tn1, tn2):
    """(vrai, score) : titres normalises proches (0,85) ou l'un contenu dans
    l'autre, le plus court faisant 15 caracteres au moins."""
    if not tn1 or not tn2:
        return False, 0.0
    court, long_ = sorted((tn1, tn2), key=len)
    ratio = similarite(tn1, tn2)
    if ratio >= SEUIL_SIMILARITE:
        # Garde contre les faux positifs (decision C3, 2026-10-12) : sous 0,95, si
        # chaque titre a au moins un mot absent de l'autre, ce sont deux
        # evenements voisins (« Preparation aux concours » a Paris, Nantes,
        # Montpellier ; « ateliers d'architecture » contre « stage d'architecture »).
        if ratio < SEUIL_GARDE_MOTS:
            m1, m2 = set(tn1.split()), set(tn2.split())
            if (m1 - m2) and (m2 - m1):
                return False, ratio
        return True, ratio
    if len(court) >= LONGUEUR_CONTENU and court in long_:
        return True, ratio
    return False, ratio


def uid_canonique(uid):
    """Ramene un UID ICS « <n>-<debut>-<fin>@<domaine> » a « <n> » pour le test
    du niveau 1, sans changer l'identifiant ecrit en base."""
    if not uid:
        return uid
    m = UID_ICS.match(uid)
    return m.group(1) if m else uid


# ---------------------------------------------------------------- fiches

@dataclass
class Entree:
    """Une fiche dans l'index : en base (id) ou deja acceptee dans le lot (en_lot)."""
    id: Optional[str]
    titre: str
    debut: datetime
    fin: Optional[datetime] = None
    commune: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    organization_id: Optional[str] = None
    source: Optional[str] = None          # None : saisie dans l'admin (aucune ligne evenements_import)
    source_uid: Optional[str] = None
    checked_at: Optional[str] = None
    photos: list = field(default_factory=list)
    description: Optional[str] = None
    registration: list = field(default_factory=list)
    price: Optional[float] = None
    created_at: Optional[str] = None
    en_lot: bool = False
    tn: str = ""

    def __post_init__(self):
        self.tn = titre_cle(self.titre)

    @property
    def jour(self):
        return jour_paris(self.debut)

    @property
    def groupe_source(self):
        if not self.source:
            return "casaminga"
        return "site" if self.source.startswith("site:") else self.source


def entree_de_fiche(fiche, en_lot=True, id_=None):
    """Construit une Entree depuis le dict d'une fiche lue a la source :
    titre, debut, fin, commune, lat, lng, organization_id (+ source,
    source_uid, photos, description, registration, price, facultatifs)."""
    debut = vers_dt(fiche.get("debut"))
    if debut is None:
        raise ValueError("fiche sans debut lisible")
    return Entree(
        id=id_, titre=fiche.get("titre") or "", debut=debut, fin=vers_dt(fiche.get("fin")),
        commune=fiche.get("commune"), lat=fiche.get("lat"), lng=fiche.get("lng"),
        organization_id=fiche.get("organization_id"), source=fiche.get("source"),
        source_uid=fiche.get("source_uid"), photos=list(fiche.get("photos") or []),
        description=fiche.get("description"), registration=list(fiche.get("registration") or []),
        price=fiche.get("price"), en_lot=en_lot)


def classer_paire(a, b):
    """(niveau, score) de la paire : 2 exact, 3 proche, 4 seance (pas un
    doublon), ou (None, 0.0) si les deux fiches n'ont rien a voir."""
    exact = bool(a.tn) and a.tn == b.tn
    proche, score = (True, 1.0) if exact else titre_proche(a.tn, b.tn)
    if not proche:
        return None, score
    if not lieu_compatible(a.commune, a.lat, a.lng, b.commune, b.lat, b.lng):
        return None, score
    if a.jour == b.jour and horaire_compatible(a.debut, b.debut):
        return (NIVEAU_EXACT if exact else NIVEAU_PROCHE), score
    if exact:
        return NIVEAU_SEANCE, score
    return None, score


@dataclass
class Resultat:
    niveau: int
    raison: str
    event_id: Optional[str]
    score: float
    gardee: Entree


# ---------------------------------------------------------------- richesse et garde

def rang_source(source):
    if not source:
        return RANG_SOURCE["casaminga"]
    g = "site" if source.startswith("site:") else source
    return RANG_SOURCE.get(g, 0)


def _registration_utile(e):
    return bool(e.registration)


def richesse(e):
    """Score de richesse d'une fiche (reprise de l'existant) : heure connue 3,
    photo 2, inscription 2, description de plus de 40 caracteres 1, organisateur
    reel (pas une fiche DATAtourisme) 1."""
    s = 0
    if not heure_inconnue(e.debut):
        s += 3
    if e.photos:
        s += 2
    if _registration_utile(e):
        s += 2
    if len((e.description or "").strip()) > DESCRIPTION_COURTE:
        s += 1
    if e.source != "datatourisme":
        s += 1
    return s


def elire_gardee(a, b):
    """(gardee, masquee) pour deux fiches deja en base, ou (None, None) si les
    deux portent checked_at (rien n'est masque, la paire est signalee).
    Ordre : checked_at, saisie admin (jamais masquee au profit d'un import),
    richesse, rang de la source, la plus ancienne, puis l'id."""
    ca, cb = bool(a.checked_at), bool(b.checked_at)
    if ca and cb:
        return None, None
    if ca != cb:
        return (a, b) if ca else (b, a)
    aa, ab = a.source is None, b.source is None
    if aa != ab:
        return (a, b) if aa else (b, a)
    cle = lambda e: (-richesse(e), -rang_source(e.source), e.created_at or "", e.id or "")
    return (a, b) if cle(a) <= cle(b) else (b, a)


# ---------------------------------------------------------------- enrichissement

def registration_reprenable(registration, source):
    """Entrees d'inscription reprenables d'un doublon : jamais de lien HelloAsso
    (R2), jamais l'email ou le telephone d'un contributeur tiers (R13, cas
    OpenAgenda : on ne garde que les liens)."""
    sortie = []
    for r in registration or []:
        if not isinstance(r, dict):
            continue
        valeur = str(r.get("value") or "")
        if not valeur or HELLOASSO.search(valeur):
            continue
        if source == "openagenda" and r.get("type") != "link":
            continue
        sortie.append(r)
    return sortie


def calculer_enrichissement(gardee, doublon, source, retraits=frozenset()):
    """{champ: {avant, apres}} : ce que la fiche gardee peut prendre au doublon,
    champ par champ, seulement si elle n'a pas la valeur. Rien du tout si la
    gardee est corrigee a la main (checked_at, R8), saisie dans l'admin, ou
    encore pas en base (fiche du lot)."""
    if gardee.en_lot or gardee.source is None or gardee.checked_at:
        return {}
    sous_retrait = (gardee.organization_id in retraits) or (doublon.organization_id in retraits)
    out = {}

    # Heure : la gardee est a heure inconnue, le doublon a une heure le meme jour.
    if heure_inconnue(gardee.debut) and not heure_inconnue(doublon.debut) \
            and gardee.jour == doublon.jour:
        out["start_at"] = {"avant": gardee.debut.isoformat(), "apres": doublon.debut.isoformat()}
        fin = doublon.fin if doublon.fin and doublon.fin > doublon.debut else None
        if fin and (gardee.fin is None or heure_inconnue(gardee.fin) or gardee.fin <= doublon.debut):
            out["end_at"] = {"avant": gardee.fin.isoformat() if gardee.fin else None,
                             "apres": fin.isoformat()}

    if not sous_retrait:
        if not gardee.photos and doublon.photos:
            out["photos"] = {"avant": list(gardee.photos), "apres": list(doublon.photos)}
        d_gardee, d_doublon = (gardee.description or "").strip(), (doublon.description or "").strip()
        if len(d_gardee) < DESCRIPTION_COURTE and len(d_doublon) >= DESCRIPTION_COURTE \
                and len(d_doublon) > len(d_gardee):
            out["description"] = {"avant": gardee.description, "apres": doublon.description}

    if not gardee.registration:
        reprise = registration_reprenable(doublon.registration, source)
        if reprise:
            out["registration"] = {"avant": list(gardee.registration), "apres": reprise}

    if gardee.price is None and doublon.price is not None:
        out["price"] = {"avant": None, "apres": doublon.price}
    return out


def appliquer_a_entree(entree, enrichi):
    """Reporte l'enrichissement sur l'Entree de l'index, pour que le doublon
    suivant ne reprenne pas deux fois le meme champ."""
    for champ, v in enrichi.items():
        if champ == "start_at":
            entree.debut = vers_dt(v["apres"])
        elif champ == "end_at":
            entree.fin = vers_dt(v["apres"])
        elif champ in ("photos", "description", "price", "registration"):
            setattr(entree, champ, v["apres"])


# ---------------------------------------------------------------- le dedoublonneur

class Dedoublonneur:
    """Index des fiches deja en base (par jour heure de Paris) + fiches
    acceptees dans le lot courant. Lit la base une fois a la creation."""

    SELECT_EVT = "id,organization_id,establishment_id,title,start_at,end_at,photos,description,price,created_at"

    def __init__(self, db, retraits=None, filtre=None):
        """retraits : ensemble d'organization_id sous retrait de medias actif
        (P2) ; None = lu dans import_retraits, vide si la table est absente.
        filtre : suffixe
        PostgREST ajoute a la lecture de evenements (la mesure ne lit que les
        fiches visibles a venir)."""
        self.db = db
        if retraits is None and db is not None:
            retraits = self._lire_retraits_medias(db)
        self.retraits = frozenset(retraits or ())
        self.compteurs = Counter()
        self.index = defaultdict(list)            # jour Paris -> [Entree]
        self.par_id = {}
        self._cles_vues = set()                   # (source, uid canonique, debut) deja en base ou lies
        self._cles_annulees = set()
        self._liens = []                          # (ligne evenements_doublons, cible, enrichi)
        self.table_doublons = True
        if db is not None:          # db=None : index vide, rempli par indexer() (tests)
            self._charger(filtre)

    # -- lecture ----------------------------------------------------------

    @staticmethod
    def _lire_retraits_medias(db):
        """Organisations dont l'enrichissement croise ne doit ni ecrire de
        description ni de photos (T4.5, 2026-10-13) : celles qui ont un retrait
        actif de portee « medias », « fiches », ou « import » sans source
        (vue import_retraits_actifs, migrations 0031). Un retrait pose sur un
        lieu d'annuaire sans organisation est resolu par annuaire_lieux.
        Les empreintes (nom, domaine) ne sont pas appliquees ici : une Entree ne
        porte que organization_id. Vide si la vue n'existe pas encore."""
        try:
            lignes = db.lire_tout(
                "import_retraits_actifs?select=organization_id,annuaire_lieu_id,portee,source&order=id")
        except SystemExit as exc:
            if "PGRST205" in str(exc) or "HTTP 404" in str(exc):
                return set()
            raise
        lignes = [l for l in lignes
                  if l.get("portee") in ("medias", "fiches")
                  or (l.get("portee") == "import" and not l.get("source"))]
        orgs = {l["organization_id"] for l in lignes if l.get("organization_id")}
        annuaires = sorted({l["annuaire_lieu_id"] for l in lignes
                            if not l.get("organization_id") and l.get("annuaire_lieu_id")})
        if annuaires:
            for i in range(0, len(annuaires), 100):
                lot = ",".join(annuaires[i:i + 100])
                for a in db.lire_tout(
                        f"annuaire_lieux?select=id,organization_id&id=in.({lot})&order=id"):
                    if a.get("organization_id"):
                        orgs.add(a["organization_id"])
        return orgs

    def _charger(self, filtre):
        db = self.db
        chemin = f"evenements?select={self.SELECT_EVT}&order=id" + (f"&{filtre}" if filtre else "")
        evts = db.lire_tout(chemin)
        imports = {i["event_id"]: i for i in db.lire_tout(
            "evenements_import?select=event_id,source,source_uid,checked_at,registration&order=event_id")}
        etabs = {e["id"]: e for e in db.lire_tout(
            "establishments?select=id,city,latitude,longitude&order=id")}
        for r in evts:
            debut = vers_dt(r.get("start_at"))
            if debut is None:
                continue
            imp = imports.get(r["id"]) or {}
            et = etabs.get(r.get("establishment_id")) or {}
            e = Entree(
                id=r["id"], titre=r.get("title") or "", debut=debut, fin=vers_dt(r.get("end_at")),
                commune=et.get("city"), lat=et.get("latitude"), lng=et.get("longitude"),
                organization_id=r.get("organization_id"), source=imp.get("source"),
                source_uid=imp.get("source_uid"), checked_at=imp.get("checked_at"),
                photos=list(r.get("photos") or []), description=r.get("description"),
                registration=list(imp.get("registration") or []), price=r.get("price"),
                created_at=r.get("created_at"))
            self.indexer(e)
        try:
            liens = db.lire_tout(
                "evenements_doublons?select=source,source_uid,titre,debut,annule_le&order=id")
        except SystemExit as exc:
            if "PGRST205" in str(exc) or "HTTP 404" in str(exc):
                self.table_doublons = False
                liens = []
            else:
                raise
        for l in liens:
            cle = self._cle(l["source"], l.get("source_uid") or l.get("titre"), l["debut"])
            (self._cles_annulees if l.get("annule_le") else self._cles_vues).add(cle)

    def indexer(self, e):
        """Met une fiche deja en base dans l'index."""
        self.index[e.jour].append(e)
        self.par_id[e.id] = e
        if e.source:
            self._cles_vues.add(self._cle(e.source, e.source_uid, e.debut))

    @staticmethod
    def _cle(source, uid, debut):
        d = vers_dt(debut)
        return (source, uid_canonique(uid), d.isoformat() if d else None)

    # -- les quatre niveaux ----------------------------------------------

    def existe(self, event_id):
        """Niveau 1, premier test : l'identifiant uuid5 est deja en base."""
        return event_id in self.par_id

    def deja_lie(self, source, source_uid, debut, titre=None):
        """Niveau 1, second test : le triplet (source, source_uid, debut) est
        deja une fiche en base ou un lien actif. Un UID ICS est ramene a son
        numero (uid_canonique). Un lien annule n'est PAS « deja lie »."""
        cle = self._cle(source, source_uid or titre, debut)
        return cle in self._cles_vues

    def lien_annule(self, source, source_uid, debut, titre=None):
        return self._cle(source, source_uid or titre, debut) in self._cles_annulees

    def chercher(self, fiche):
        """Niveaux 2 et 3 : Resultat de la fiche deja presente qui la double,
        ou None (fiche nouvelle ou simple seance). Compare a toute la base,
        toutes sources, puis aux fiches deja acceptees dans le lot."""
        e = entree_de_fiche(fiche, en_lot=True)
        if e.source and self.lien_annule(e.source, e.source_uid, e.debut, e.titre):
            return None
        meilleur, seance = None, False
        for c in self.index.get(e.jour, []):
            niveau, score = classer_paire(c, e)
            if niveau == NIVEAU_SEANCE:
                seance = True
            elif niveau in RAISONS:
                cle = (niveau, -score, c.id or "")
                if meilleur is None or cle < meilleur[0]:
                    meilleur = (cle, Resultat(niveau, RAISONS[niveau], c.id, round(score, 3), c))
        if meilleur is None:
            # Meme titre, meme lieu, un autre jour : une serie (niveau 4).
            if seance or self._serie_autre_jour(e):
                self.compteurs["seances"] += 1
            return None
        self.compteurs[meilleur[1].raison] += 1
        return meilleur[1]

    def _serie_autre_jour(self, e):
        for jour, liste in self.index.items():
            if jour == e.jour:
                continue
            for c in liste:
                if c.tn == e.tn and lieu_compatible(c.commune, c.lat, c.lng, e.commune, e.lat, e.lng):
                    return True
        return False

    def enregistrer(self, fiche, event_id):
        """La fiche acceptee (nouvelle) entre dans l'index du lot."""
        e = entree_de_fiche(fiche, en_lot=True, id_=event_id)
        self.index[e.jour].append(e)
        self.par_id[event_id] = e
        if e.source:
            self._cles_vues.add(self._cle(e.source, e.source_uid, e.debut))
        return e

    def lier(self, resultat, fiche, source, source_uid, source_url):
        """Prepare la ligne evenements_doublons et l'enrichissement de la fiche
        gardee. N'ecrit rien : voir ecrire()."""
        d = entree_de_fiche(dict(fiche, source=source, source_uid=source_uid))
        enrichi = calculer_enrichissement(resultat.gardee, d, source, self.retraits)
        ligne = {
            "event_id": resultat.event_id, "source": source, "source_uid": source_uid,
            "source_url": source_url, "doublon_event_id": None,
            "niveau": resultat.niveau, "raison": resultat.raison,
            "score": resultat.score, "titre": fiche.get("titre") or "",
            "debut": d.debut.isoformat(), "enrichi": enrichi, "regle": REGLE,
        }
        appliquer_a_entree(resultat.gardee, enrichi)
        self._cles_vues.add(self._cle(source, source_uid or ligne["titre"], d.debut))
        self._liens.append((ligne, resultat.gardee, enrichi))
        if enrichi:
            self.compteurs["enrichis"] += 1
        return ligne

    def ecrire(self, essai=True, ids_ecrits=None):
        """Ecrit les liens puis les enrichissements, par lots. essai=True (defaut)
        n'ecrit rien et ne fait que compter. Renvoie les compteurs.

        ids_ecrits : ensemble des identifiants des fiches nouvelles qui seront
        reellement inserees (le lot). Un lien vers une fiche du lot qui n'en
        fait pas partie (lot coupe par --max) est ecarte : la fiche gardee
        n'existe pas en base, la cle etrangere echouerait. Le doublon sera
        revu au passage suivant. None : aucun filtre."""
        if ids_ecrits is not None:
            gardes = [x for x in self._liens if not x[1].en_lot or x[1].id in ids_ecrits]
            self.compteurs["liens_reportes"] += len(self._liens) - len(gardes)
            self._liens = gardes
        champs = Counter()
        patchs = {}
        for _, cible, enrichi in self._liens:
            for champ in enrichi:
                champs[champ] += 1
            if enrichi and cible.id:
                patchs.setdefault(cible.id, {}).update(enrichi)
        bilan = {"liens": len(self._liens), "fiches_enrichies": len(patchs),
                 "champs": dict(champs), "ecrit": not essai}
        if essai or not self._liens:
            return bilan
        lignes = [l for l, _, _ in self._liens]
        for i in range(0, len(lignes), 200):
            self.db._call("POST", "evenements_doublons", lignes[i:i + 200],
                          headers={"Prefer": "return=minimal"})
        for eid, enrichi in patchs.items():
            evt = {c: v["apres"] for c, v in enrichi.items()
                   if c in ("start_at", "end_at", "photos", "description", "price")}
            if evt:
                self.db._call("PATCH", f"evenements?id=eq.{eid}", evt,
                              headers={"Prefer": "return=minimal"})
            if "registration" in enrichi:
                self.db._call("PATCH", f"evenements_import?event_id=eq.{eid}",
                              {"registration": enrichi["registration"]["apres"]},
                              headers={"Prefer": "return=minimal"})
        self._liens = []
        return bilan

    # -- mesure sur l'existant -------------------------------------------

    def paires_existantes(self):
        """Toutes les paires des niveaux 2, 3 et 4 de l'index, un jour apres
        l'autre (les niveaux 2 et 3 sont par definition du meme jour). La
        serie sur plusieurs jours (niveau 4) n'est pas enumeree ici."""
        paires = []
        for jour in sorted(self.index):
            liste = self.index[jour]
            for i in range(len(liste)):
                for j in range(i + 1, len(liste)):
                    niveau, score = classer_paire(liste[i], liste[j])
                    if niveau:
                        paires.append((liste[i], liste[j], niveau, score))
        return paires


def groupes_de_doublons(paires):
    """Composantes connexes des paires de niveau 2 ou 3 : [(entrees, niveau le
    plus faible)]. Le niveau d'un groupe est 3 si une seule arete est proche."""
    parent = {}

    def trouver(x):
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    entrees, niveau_arete = {}, defaultdict(list)
    for a, b, niveau, _ in paires:
        if niveau not in RAISONS:
            continue
        entrees[a.id], entrees[b.id] = a, b
        parent[trouver(a.id)] = trouver(b.id)
        niveau_arete[a.id].append(niveau)
        niveau_arete[b.id].append(niveau)
    comp = defaultdict(list)
    for eid in entrees:
        comp[trouver(eid)].append(eid)
    sortie = []
    for ids in comp.values():
        sortie.append(([entrees[i] for i in ids], max(max(niveau_arete[i]) for i in ids)))
    return sortie


# ---------------------------------------------------------------- mesure (CLI)

def _n(x):
    return f"{x:,}".replace(",", " ")


def mesurer():
    """Lit la base (GET seulement), applique la regle sur toutes les fiches
    visibles a venir, imprime les doublons par niveau et 10 exemples."""
    url, key = load_env()
    db = Base(url, key)
    maintenant = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    filtre = ("show_on_public_site=eq.true&status=in.(publie,confirme,planifie)"
              f"&start_at=gte.{maintenant}")
    dd = Dedoublonneur(db, filtre=filtre)
    total = sum(len(v) for v in dd.index.values())
    paires = dd.paires_existantes()
    par_niveau = Counter(p[2] for p in paires)
    groupes = groupes_de_doublons(paires)
    groupes_niveau = Counter(n for _, n in groupes)
    en_trop = sum(len(g) - 1 for g, _ in groupes)
    en_doublon = sum(len(g) for g, _ in groupes)

    print(f"Regle {REGLE}. Fiches visibles a venir lues : {_n(total)}")
    if not dd.table_doublons:
        print("(table evenements_doublons absente : migration 0032 pas encore appliquee, "
              "aucun lien connu)")
    print()
    print("Paires par niveau :")
    print(f"  niveau 2, exact     : {par_niveau[NIVEAU_EXACT]}")
    print(f"  niveau 3, proche    : {par_niveau[NIVEAU_PROCHE]}")
    print(f"  niveau 4, seances   : {par_niveau[NIVEAU_SEANCE]} (meme jour, meme titre, horaires "
          "incompatibles : pas des doublons)")
    print()
    print("Groupes de doublons (niveau du groupe = le plus faible de ses paires) :")
    print(f"  groupes exact       : {groupes_niveau[NIVEAU_EXACT]}")
    print(f"  groupes avec proche : {groupes_niveau[NIVEAU_PROCHE]}")
    print(f"  fiches impliquees   : {en_doublon}, dont a masquer/lier : {en_trop} "
          f"({100.0 * en_trop / total:.2f} % des fiches)" if total else "  aucune fiche")
    print()
    types = Counter()
    for a, b, niveau, _ in paires:
        if niveau in RAISONS:
            ss = " + ".join(sorted((a.groupe_source, b.groupe_source)))
            types[(ss, "meme organisation" if a.organization_id == b.organization_id
                   else "organisations differentes")] += 1
    print("Paires de doublons par couple de sources :")
    for (ss, org), k in types.most_common():
        print(f"  {k:3d}  {ss} ({org})")
    print()
    print("10 exemples (doublons) :")
    ex = [p for p in sorted(paires, key=lambda p: (p[2], p[0].jour, p[0].tn)) if p[2] in RAISONS][:10]
    for a, b, niveau, score in ex:
        print(f"  niveau {niveau} score {score:.2f} | {a.jour} | {a.commune or '?'}")
        for e in (a, b):
            h = vers_paris(e.debut).strftime("%H:%M")
            print(f"      {e.groupe_source:13s} {h} {e.titre[:70]} [{(e.id or '')[:8]}]")
    print()
    courts = [g for g, _ in groupes if min(len(e.tn) for e in g) < LONGUEUR_CONTENU]
    print(f"Groupes dont un titre fait moins de {LONGUEUR_CONTENU} caracteres (a relire) : {len(courts)}")
    memes = [p for p in paires if p[2] in RAISONS and p[0].groupe_source == p[1].groupe_source
             and not heure_inconnue(p[0].debut) and not heure_inconnue(p[1].debut)]
    print(f"Paires de meme source avec une heure des deux cotes (a relire, risque de seance) : {len(memes)}")
    print("Rien n'a ete ecrit en base.")


def main():
    for flux in (sys.stdout, sys.stderr):
        try:
            flux.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    p = argparse.ArgumentParser(description="Dedoublonnage croise des evenements (lecture seule)")
    p.add_argument("--mesurer", action="store_true",
                   help="lit la base, applique la regle, imprime les doublons par niveau")
    args = p.parse_args()
    if not args.mesurer:
        p.print_help()
        return
    mesurer()


if __name__ == "__main__":
    main()
