# -*- coding: utf-8 -*-
"""
Géocodage des établissements du réseau (organisations source = 'casaminga')
qui n'ont ni latitude ni longitude, via api-adresse.data.gouv.fr (BAN).

Usage
-----
  python scripts/geocoder-etablissements.py            essai (défaut), n'écrit rien
  python scripts/geocoder-etablissements.py --ecrire   écrit latitude/longitude

Règles
------
- Seuls les résultats de score >= 0,5 sont retenus, sinon rien n'est écrit.
- 1 requête par seconde. Seuls les établissements sans coordonnées sont lus,
  et l'écriture ne touche que ces deux colonnes.
- Sans adresse (ville seule ou rien), rien n'est écrit : listés pour être complétés.
- L'organisation démo « test » est ignorée.

La clé de service est lue dans .env.local (ou l'environnement), jamais affichée.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

BAN = "https://api-adresse.data.gouv.fr/search/"
MIN_SCORE = 0.5


def load_env():
    path = Path(__file__).resolve().parent.parent / ".env.local"
    env = dict(re.findall(r"^([A-Z_]+)=(.*)$", path.read_text(encoding="utf-8"), re.M)) if path.exists() else {}
    url = (env.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")).strip().strip('"').rstrip("/")
    key = (env.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")).strip().strip('"')
    if not url or not key:
        raise SystemExit("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente.")
    return url, key


def rest(url, key, method, path, body=None):
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if method != "GET":
        headers["Prefer"] = "return=minimal"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(f"{url}/rest/v1/{path}", data=data, headers=headers, method=method)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read()
            return json.loads(raw) if raw else None
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(3)


def geocode(address, postcode, city, tentatives=3):
    # Skip postcode/city already present in the address text.
    q = " ".join(x for x in [address, postcode, city] if x and (x is address or x.lower() not in address.lower()))
    params = {"q": q, "limit": "1"}
    if postcode and re.fullmatch(r"\d{5}", postcode):
        params["postcode"] = postcode
    full = f"{BAN}?{urllib.parse.urlencode(params)}"
    for essai in range(tentatives):
        res = _appel(full)
        if res is not False:
            break
        time.sleep(3)
    else:
        return None
    feats = res
    if not feats:
        return None
    f = feats[0]
    lng, lat = f["geometry"]["coordinates"][:2]
    return {"lat": lat, "lng": lng, "score": f["properties"].get("score", 0), "label": f["properties"].get("label", "")}


def _appel(full):
    """Liste de résultats, ou False en cas d'erreur réseau (on réessaie).

    curl plutôt que urllib : le Python de Windows ne connaît pas toujours la
    racine de certificat actuelle de l'API (SSL verify failed). curl vérifie
    quand même le TLS.
    """
    try:
        out = subprocess.run(["curl", "-s", "-f", "-m", "15", full], capture_output=True, timeout=20, check=True).stdout
        return json.loads(out.decode("utf-8")).get("features") or []
    except (ValueError, OSError, subprocess.SubprocessError) as e:
        print(f"      erreur réseau : {e}")
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--essai", action="store_true", help="n'écrit rien (défaut)")
    ap.add_argument("--ecrire", action="store_true", help="écrit les coordonnées")
    args = ap.parse_args()
    ecrire = args.ecrire and not args.essai
    url, key = load_env()

    rows = rest(url, key, "GET",
                "establishments?select=id,name,address,postal_code,city,latitude,longitude,"
                "organizations!inner(slug,name,source)&organizations.source=eq.casaminga"
                "&organizations.slug=neq.test&latitude=is.null&order=created_at")
    rows = [r for r in rows if r["latitude"] is None or r["longitude"] is None]
    print(f"Mode : {'ECRITURE' if ecrire else 'essai'} | établissements du réseau sans coordonnées : {len(rows)}")

    vides, trouves, faibles = [], [], []
    first = True
    for r in rows:
        org = r["organizations"]
        addr = (r["address"] or "").strip()
        city = (r["city"] or "").strip()
        pc = (r["postal_code"] or "").strip()
        # A city alone would only give the commune centre: not a real address.
        if not addr:
            vides.append((org["name"] or org["slug"], r["name"] + (f" (ville seule : {city})" if city else " (ni adresse ni ville)")))
            continue
        if not first:
            time.sleep(1)
        first = False
        g = geocode(addr, pc, city)
        if g and g["score"] >= MIN_SCORE:
            trouves.append((r, g))
            print(f"  OK  {org['slug']} / {r['name']} -> {g['lat']:.5f},{g['lng']:.5f} score {g['score']:.2f} : {g['label']}")
            if ecrire:
                rest(url, key, "PATCH", f"establishments?id=eq.{r['id']}", {"latitude": g["lat"], "longitude": g["lng"]})
        else:
            faibles.append((org["slug"], r["name"], g))
            print(f"  --  {org['slug']} / {r['name']} : {'score ' + format(g['score'], '.2f') + ' (' + g['label'] + ')' if g else 'aucun résultat'}")

    print(f"\nRésumé : géocodés {len(trouves)} | score trop faible ou introuvable {len(faibles)} | sans adresse {len(vides)}")
    if not ecrire:
        print("Essai : rien n'a été écrit.")
    if vides:
        print("\nÀ compléter (adresse manquante) :")
        for o, e in vides:
            print(f"  - {o} / {e}")


main()
