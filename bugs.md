# Bugs & retours UX — Casa Minga Lieux
> Audit complet — branche `audit/debug-session-01` — 2026-06-01
> Personas : adhérent · trésorier · admin

---

## [À VALIDER] — AUTH-001 — Middleware Next.js au mauvais chemin
**Module:** Authentification
**Type:** Bug architectural
**Fichier:** `src/proxy.ts`
**Problème:** Le fichier `src/proxy.ts` contient la logique middleware Next.js (export `proxy` + `config.matcher`) mais Next.js ne l'exécute que si le fichier s'appelle `src/middleware.ts` ou `middleware.ts` à la racine. Le routing multi-host et le rafraîchissement de session Supabase (`updateSession`) ne s'exécutent donc jamais en production.
**Impact:** En mode Supabase réel, les sessions JWT ne sont pas rafraîchies automatiquement → déconnexions silencieuses. En demo (pas de Supabase), aucun impact.
**Suggestion:** Renommer `src/proxy.ts` en `src/middleware.ts` et exporter `proxy` comme `middleware` (ou directement renommer la fonction). Vérifier l'import dans `next.config.ts`.

---

## [À VALIDER] — AUTH-002 — Redirect post-login hardcodé sur `bernard-kohn`
**Module:** Authentification
**Type:** Bug multi-tenant
**Fichier:** `src/app/(admin)/login/page.tsx` ligne 32
**Problème:** Après un login Supabase réussi, l'utilisateur est redirigé vers `/dashboard/bernard-kohn` (DEMO_SLUG hardcodé). Dans un contexte multi-tenant réel, chaque admin devrait atterrir sur son propre slug d'organisation.
**Suggestion:** Après auth, appeler `getOrganizationsForUser(userId)` pour obtenir l'org de l'utilisateur, puis rediriger vers `/dashboard/${org.slug}`. Si plusieurs orgs, afficher un sélecteur.

---

## [À VALIDER] — AUTH-003 — Routes dashboard non protégées
**Module:** Authentification
**Type:** Absence de protection
**Problème:** Aucune vérification d'authentification n'est effectuée sur `/dashboard/*`. En mode Supabase réel, n'importe quel visiteur anonyme peut accéder au dashboard de n'importe quelle organisation en connaissant le slug. Le middleware (`proxy.ts`) n'est pas chargé (AUTH-001).
**Suggestion:** Une fois AUTH-001 résolu, ajouter dans le middleware : si la route commence par `/dashboard/` et que `session` est null → rediriger vers `/login?next=<url>`.

---

## [À VALIDER] — DOC-001 — XSS potentiel sur `file_url` dans Documents
**Module:** Documents
**Type:** Sécurité
**Fichier:** `src/components/mc/documents-view.tsx` ligne 179
**Problème:** Le champ `file_url` est rendu directement dans un `<a href={...}>`. Si un admin malveillant (ou une erreur de saisie) stocke `javascript:alert(1)`, le lien l'exécutera au clic. Risque faible (admin uniquement) mais à corriger.
**Suggestion:** Valider que `file_url` commence par `https://` ou `http://` avant de le rendre comme lien. Sinon, masquer le lien et afficher un avertissement.

---

_Tous les autres bugs identifiés lors de cet audit ont été corrigés directement._
_Voir CHANGELOG.md pour le détail des correctifs appliqués._
