# Plan — Logs de connexion par utilisateur (super-admin) · handoff → Sonnet

> **Demande Léo (22/06)** : un espace `/admin` pour voir les logs de connexion de chaque
> utilisateur. Questions posées : « est-ce possible ? » et « est-ce que ça va alourdir ? »
> **Repo** : `casa-minga-lieux` (branche `main`). Commiter librement, **ne pas pusher** sans
> ordre. `npx tsc --noEmit` avant commit.

---

## Réponses aux 2 questions

### 1. Possible ? — OUI.
Aujourd'hui il n'y a **aucun historique** de connexion : seulement `last_seen_at` (un timestamp
écrasé). MAIS **Supabase écrit déjà** la date de dernière connexion dans `auth.users.last_sign_in_at`
à CHAQUE login. On capte cet évènement (trigger DB) pour construire un vrai historique.

### 2. Ça alourdit ? — NON, négligeable. (le point important)
- **Écriture** : une connexion est un évènement **rare** (1 par session, pas par clic/page).
  La capture se greffe sur la mise à jour `last_sign_in_at` que Supabase fait **déjà** → on
  n'ajoute aucun appel réseau dans le parcours utilisateur, juste 1 petite ligne par login.
  Même à 10 000 assos, ça reste quelques milliers de lignes/jour = trivial.
- **Lecture** : page **super-admin only** (Léo seul) → aucune charge sur l'app des utilisateurs.
- **Stockage** : lignes minuscules (uuid + timestamp + email), indexées, purgeables > 12 mois.
- Le dashboard fait déjà des requêtes bien plus lourdes par page. → **aucun impact perceptible.**

---

## Architecture retenue (durable + zéro coût applicatif)

**Source = trigger sur `auth.users`** (pattern officiel Supabase, comme les triggers `profiles`).
On NE touche PAS le code de login (qui est côté client) : la capture est 100 % en base.

### Migration `vX_login_events`
```sql
-- 1) Table d'historique (schéma public, lue seulement par le service_role admin)
create table if not exists public.login_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  email       text,
  created_at  timestamptz not null default now()
);
create index if not exists login_events_user_idx    on public.login_events (user_id, created_at desc);
create index if not exists login_events_created_idx on public.login_events (created_at desc);

alter table public.login_events enable row level security;
-- Aucune policy anon/authenticated → seul le service_role (admin client) lit/écrit.

-- 2) Trigger : à chaque login, Supabase met à jour auth.users.last_sign_in_at → on logge.
create or replace function public.handle_login()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    insert into public.login_events (user_id, email, created_at)
    values (new.id, new.email, new.last_sign_in_at);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_login on auth.users;
create trigger on_auth_login
  after update of last_sign_in_at on auth.users
  for each row execute function public.handle_login();

-- 3) Amorçage : 1 ligne = dernière connexion connue, pour que la page ne soit pas vide.
insert into public.login_events (user_id, email, created_at)
select id, email, last_sign_in_at from auth.users where last_sign_in_at is not null;
```
> ⚠️ Appliquer via l'outil de migration Supabase (MCP `apply_migration`), pas en SQL ad hoc.

### Couche données — `src/lib/admin/data.ts`
Ajouter (lecture via `createAdminClient`, service_role) :
- `getUserLoginSummary()` → 1 ligne / utilisateur : `email`, `name` (join `profiles.full_name`),
  org(s) (join `organization_members` → `organizations.name/slug`), **dernière connexion**
  (`max(created_at)`), **nb connexions 30 j** (`count` filtré).
- `getUserLoginHistory(userId, limit=100)` → toutes les connexions d'un utilisateur (drill-down).
> Mapping user→nom/org : `profiles(id, full_name)` + `organization_members(user_id, organization_id)`
> + `organizations(name, slug)` (déjà utilisés dans `dashboard/[org]/layout.tsx` et `data.ts`).

### Page `/admin/connexions/page.tsx` (server component)
- **Vue liste** : tableau triable — Utilisateur (nom+email) · Organisation(s) · Dernière connexion
  (relative « il y a 3 h ») · Connexions 30 j. Filtre/recherche par email/nom.
- **Drill-down** : clic sur une ligne → historique complet de l'utilisateur (dates).
- **Responsive** : réutiliser le pattern DÉJÀ en place dans les autres pages `/admin`
  (`organisations/page.tsx`, `engagement/page.tsx`) : en-tête `hidden md:grid` + lignes
  `grid grid-cols-1 … md:grid-cols-[…]` (s'empile en cartes sur mobile). **Ne pas réinventer.**

### Entrée sidebar — `src/components/admin/admin-sidebar.tsx`
Ajouter dans `NAV` (après « Engagement » ou « Santé technique ») :
```ts
{ href: "/admin/connexions", label: "Connexions", icon: LogIn, exact: false },
```
(`LogIn` ou `History` depuis lucide-react.)

---

## Enrichissement optionnel — IP & appareil (phase 2, si Léo veut)
`auth.users` ne donne que l'heure + l'utilisateur. Pour l'**IP** et l'**appareil** par connexion,
la source est `auth.audit_log_entries` (Supabase y met `payload->>'action'='login'` + `ip_address`).
- Exposer via une fonction `security definer` `public.admin_login_audit(p_limit int)` qui lit
  `auth.audit_log_entries` (le schéma `auth` n'est pas exposé à PostgREST → passer par une fonction).
- ⚠️ Supabase **purge** `audit_log_entries` (fenêtre glissante) → ce n'est PAS un historique durable :
  la table `login_events` reste la source pérenne ; l'audit n'est qu'un enrichissement temps réel.

---

## Confidentialité (à garder en tête)
Métadonnées de connexion = données personnelles « légères ». Légitime pour l'exploitant
(sécurité/support). Recommandations : **rétention bornée** (purge > 12 mois via cron ou
`delete` planifié), et mention dans la politique de confidentialité (`/confidentialite`).

---

## Critères d'acceptation
- [ ] Après login d'un utilisateur, une ligne apparaît dans `login_events` (vérifiable en SQL).
- [ ] `/admin/connexions` liste chaque utilisateur avec sa dernière connexion + nb 30 j, triable.
- [ ] Drill-down = historique complet d'un utilisateur.
- [ ] Page responsive (375 px : cartes empilées) — réutilise le pattern admin existant.
- [ ] Super-admin only (garde `requireSuperAdmin` via le layout `/admin`).
- [ ] `npx tsc --noEmit` passe. **Ne pas pusher** sans « push » de Léo.

## Ordre d'exécution (Sonnet)
1. Migration `login_events` + trigger + amorçage.  2. `data.ts` (2 fonctions).
3. Page `/admin/connexions` + entrée sidebar.  4. (option) enrichissement IP/appareil.
