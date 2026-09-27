# -*- coding: utf-8 -*-
"""Verse un recensement ouvert de tiers-lieux dans `public.annuaire_lieux`.

Pourquoi un script plutot qu'un import a la main : le recensement national
compte pres de quatre mille lieux et connaitra d'autres millesimes. Le faire
passer par un modele de langage couterait des centaines de milliers de jetons
pour recopier des donnees que personne n'a besoin d'interpreter.

Ce que le script garantit :

  * IDENTIFIANT STABLE. `id` est un uuid5 derive de (source, id_source). Deux
    passages sur le meme fichier produisent les memes identifiants, donc jamais
    de doublon, et les liens deja publies survivent.

  * IL N'ECRASE PAS LE TRAVAIL EDITORIAL. Les colonnes `masque`,
    `motif_masquage` et `organization_id` ne sont jamais envoyees. Un lieu
    masque a la main reste masque apres reimport, un rattachement au reseau
    survit.

  * AUCUNE COORDONNEE DE CONTACT. Le fichier source publie des courriels et des
    telephones ; ils ne montent pas en base. Voir le commentaire de la migration
    0013.

Usage :
    python scripts/import-annuaire.py --fichier <chemin.csv>          # a blanc
    python scripts/import-annuaire.py --fichier <chemin.csv> --ecrire # envoi
"""
import argparse
import csv
import json
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
ESPACE = uuid.UUID("6ba7b811-9dad-11d1-80b4-00c04fd430c8")  # NAMESPACE_URL
LOT = 200

# Colonnes du CSV de collecte -> colonnes de la table. Tout ce qui n'est pas
# ici est volontairement laisse de cote.
CHAMPS = {
    "id_source": "id_source",
    "nom": "nom",
    "type": "type",
    "familles": "familles",
    "etat_recensement": "etat",
    "statut_juridique": "statut_juridique",
    "adresse": "adresse",
    "commune": "commune",
    "code_postal": "code_postal",
    "code_insee": "code_insee",
    "departement": "departement",
    "region": "region",
    "site_web": "site_web",
    "source": "source",
    "source_url": "source_url",
}


def config():
    """Lit l'URL et la cle de service dans .env.local. La cle n'est jamais affichee."""
    env = (RACINE / ".env.local").read_text(encoding="utf-8")
    valeurs = {}
    for ligne in env.splitlines():
        if "=" in ligne and not ligne.lstrip().startswith("#"):
            cle, _, val = ligne.partition("=")
            valeurs[cle.strip()] = val.strip().strip('"').strip("'")
    url = valeurs["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    cle = valeurs.get("SUPABASE_SERVICE_ROLE_KEY")
    if not cle:
        sys.exit("SUPABASE_SERVICE_ROLE_KEY absente de .env.local")
    return url, cle


TIRETS = {"—": ",", "–": ","}


def sans_tiret_cadratin(texte):
    """Remplace les tirets longs par une virgule.

    La regle d'ecriture du site les interdit, et le libelle de source du
    recensement en contient un : il serait affiche tel quel sous l'annuaire.
    """
    for tiret, remplacement in TIRETS.items():
        texte = texte.replace(" " + tiret + " ", remplacement + " ").replace(tiret, remplacement)
    return texte


def nombre(valeur):
    """Convertit une coordonnee, en tolerant la virgule decimale et le vide."""
    valeur = (valeur or "").strip().replace(",", ".")
    if not valeur:
        return None
    try:
        return float(valeur)
    except ValueError:
        return None


def lire(chemin):
    """Transforme le CSV de collecte en lignes pretes pour la table."""
    lignes, ignorees = [], 0
    with open(chemin, encoding="utf-8-sig", newline="") as f:
        for brut in csv.DictReader(f, delimiter=";"):
            nom = (brut.get("nom") or "").strip()
            source = (brut.get("source") or "").strip()
            id_source = (brut.get("id_source") or "").strip()
            # Sans nom, la fiche n'est affichable nulle part. Sans source ni
            # identifiant de source, elle n'a pas de cle de reimport stable :
            # elle se dupliquerait au millesime suivant.
            if not nom or not source or not id_source:
                ignorees += 1
                continue
            ligne = {
                "id": str(uuid.uuid5(ESPACE, "casaminga:annuaire:%s:%s" % (source, id_source))),
                "latitude": nombre(brut.get("latitude")),
                "longitude": nombre(brut.get("longitude")),
            }
            for depuis, vers in CHAMPS.items():
                valeur = (brut.get(depuis) or "").strip()
                ligne[vers] = valeur or None
            ligne["nom"] = nom
            ligne["source"] = sans_tiret_cadratin(source)
            lignes.append(ligne)
    return lignes, ignorees


def envoyer(url, cle, lot):
    requete = urllib.request.Request(
        url + "/rest/v1/annuaire_lieux?on_conflict=source,id_source",
        data=json.dumps(lot, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "apikey": cle,
            "Authorization": "Bearer " + cle,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    with urllib.request.urlopen(requete, timeout=120) as r:
        return r.status


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fichier", required=True, help="CSV de collecte, separateur point-virgule")
    ap.add_argument("--ecrire", action="store_true", help="sans ce drapeau, rien n'est envoye")
    args = ap.parse_args()

    lignes, ignorees = lire(args.fichier)
    print("lignes retenues : %d (ignorees : %d)" % (len(lignes), ignorees))
    if not lignes:
        sys.exit("rien a importer")

    geo = sum(1 for l in lignes if l["latitude"] is not None and l["longitude"] is not None)
    print("geolocalisees    : %d" % geo)
    print("sources          : %s" % ", ".join(sorted({l["source"][:60] for l in lignes})))
    exemple = dict(lignes[0])
    print("exemple          : %s" % json.dumps(exemple, ensure_ascii=False)[:300])

    if not args.ecrire:
        print("\nessai a blanc : rien n'a ete envoye. Ajouter --ecrire pour verser.")
        return

    url, cle = config()
    envoyees = 0
    for debut in range(0, len(lignes), LOT):
        lot = lignes[debut:debut + LOT]
        try:
            envoyer(url, cle, lot)
        except urllib.error.HTTPError as e:
            # Afficher le corps de la reponse : sans lui, un echec de contrainte
            # ressemble a une panne reseau et se cherche pendant une heure.
            sys.exit("echec lot %d : %s %s" % (debut // LOT + 1, e.code, e.read().decode("utf-8", "replace")[:500]))
        envoyees += len(lot)
        print("  %d / %d" % (envoyees, len(lignes)))
    print("termine : %d fiches versees" % envoyees)


if __name__ == "__main__":
    main()
