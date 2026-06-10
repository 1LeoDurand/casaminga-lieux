# Bugs & retours UX — Casa Minga Lieux
> Purgé le 10/06/2026 (sprint finition) — voir AUDIT.md pour l'état complet.

## Résolus / invalidés (audit du 10/06/2026)

- **AUTH-001** (middleware au mauvais chemin) — **Faux positif** : Next.js 16
  utilise officiellement `proxy.ts` ; le build affiche `ƒ Proxy (Middleware)`.
- **AUTH-002** (redirect post-login hardcodé) — Corrigé : résolution dynamique
  de l'org de l'utilisateur dans `login/page.tsx`.
- **AUTH-003** (dashboard non protégé) — Corrigé : guard d'auth + membership
  dans `dashboard/[org]/layout.tsx`.
- **DOC-001** (XSS `file_url`) — Corrigé le 10/06/2026 : `safeFileUrl()`
  n'autorise que `http(s)://` (`documents-view.tsx`).

_Aucun bug ouvert. Les nouveaux retours passent par le widget feedback in-app._
