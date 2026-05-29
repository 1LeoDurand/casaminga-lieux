# Roadmap — Casa Minga Lieux

## Point de vigilance — route publique

⚠️ **La route publique locale n'est pas la cible produit.**

- **Local (dev)** : le site public est servi sur `/site/[slug]`, ex. `/site/bernard-kohn`.
  C'est un **alias pratique** pour développer sans configuration de hosts.
- **Cible produit** : `casaminga.com/[organizationSlug]`, ex. `casaminga.com/bernard-kohn`
  (slug à la racine du host public, **sans** préfixe `/site`).

Le pont entre les deux est déjà en place dans [`src/proxy.ts`](src/proxy.ts) : sur l'apex
`casaminga.com`, `/<slug>` est réécrit vers `/site/<slug>`. L'architecture doit donc **toujours**
garder `/site/[slug]` comme implémentation interne, et `/[slug]` comme URL publique finale via la
réécriture. Ne pas coder de lien public en dur vers `/site/...` côté produit : viser `/[slug]`.

À valider plus tard : déploiement multi-domaines (`admin.casaminga.com` + `casaminga.com`),
configuration des hosts/Vercel, et tests de la réécriture en conditions réelles.

---

## Versions

### v1 — socle technique ✅
Design system, routes de base, clients Supabase, migration + seed, dashboard + site public minimaux.

### v1.1 — premier flux end-to-end ✅
Site public → formulaire → création d'une demande → affichage dans le dashboard.
- Formulaire public (`/site/bernard-kohn`) : nom, email, téléphone, structure, type, message.
- Route serveur `POST /api/orgs/[slug]/requests` : résout l'org, insère dans `requests`
  (Supabase si configuré, fallback démo sinon), jamais de clé `service_role` côté client.
- Page Demandes (`/dashboard/bernard-kohn/demandes`) : liste, détail, changement de statut,
  marquer traitée, archiver, toasts.

### Prochaines versions (ordre MVP)
Personnes → Espaces → Réservations → Résidences → Événements → modules Gestion / Rayonnement / Collectif.
Chaque table métier reste liée à `organization_id` avec RLS.

### Règle de versioning (STRICTE)

> **Avant chaque nouvelle version, créer un commit, un tag et une copie complète du dossier précédent.**

Procédure obligatoire, dans l'ordre, **avant** de commencer la version suivante :

1. **Vérifier le build** : `npm run build` doit passer.
2. **Commit Git propre** : arbre de travail clean, message clair (`vX.Y - description`).
3. **Tag Git de version** : ex. `v1.0-socle`, `v1.1-demandes`.
4. **Copie complète du dossier** vers `D:\01 Casaminga\01 Dev\archives\casa-minga-lieux-vX.Y`
   (script [`scripts/archive-version.ps1`](scripts/archive-version.ps1)).
5. **Seulement ensuite**, démarrer le développement de la version suivante.

Convention de nommage :

| Élément              | Exemple                                          |
| -------------------- | ------------------------------------------------ |
| Développement actif  | `casa-minga-lieux`                               |
| Archive v1           | `archives\casa-minga-lieux-v1` (tag `v1.0-socle`) |
| Archive v1.1         | `archives\casa-minga-lieux-v1.1` (tag `v1.1-demandes`) |

Historique des versions :

| Version | Tag             | Commit    | Archive                          |
| ------- | --------------- | --------- | -------------------------------- |
| v1.0    | `v1.0-socle`    | `77fc3d4` | `archives\casa-minga-lieux-v1.1` (snapshot) |
| v1.1    | `v1.1-demandes` | `7162543` | `archives\casa-minga-lieux-v1.1` |
