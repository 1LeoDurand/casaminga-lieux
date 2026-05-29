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

### Règle de versioning
À chaque nouvelle version, archiver l'état courant (commit Git dédié + copie de dossier si besoin)
avant de poursuivre.
