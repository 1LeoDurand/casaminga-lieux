-- ════════════════════════════════════════════════════════════
-- REVENDICATION — LES TROIS GARDE-FOUS
-- ════════════════════════════════════════════════════════════
-- /revendiquer/<lieu> est public : ni compte, ni session, ni captcha. Dans sa
-- première forme, une soumission déclenchait immédiatement un courriel vers
-- l'adresse publiée par le lieu. Rien n'empêchait un script de la rejouer pour
-- les 118 fiches moissonnées : 118 courriels non sollicités partis de
-- casaminga.com, la réputation du domaine abîmée, et des lieux sollicités au
-- nom d'une association qui n'avait rien demandé.
--
-- Trois garde-fous, dont deux ont besoin de cette migration :
--   1. une limite par adresse IP        → mémoire (lib/rate-limit) + colonne
--                                         `request_ip` pour la part persistante
--   2. une limite par lieu              → comptage sur cette table
--   3. la vérification du demandeur     → `confirm_token` / `confirmed_at`
--
-- Le troisième est le plus important : plus aucun courriel ne part vers un
-- lieu tant que le demandeur n'a pas prouvé qu'il relève l'adresse qu'il a
-- saisie. Un script qui ne contrôle pas 400 boîtes ne peut plus rien déclencher.

-- ── 1. Un état de plus, en amont de tous les autres ──────────
-- non_confirme : la demande est enregistrée, le demandeur n'a pas encore
-- cliqué sur son lien. Le lieu n'a rien reçu et n'en saura peut-être jamais
-- rien. L'écran d'arbitrage ne lit que 'en_attente' : ces demandes-là n'y
-- apparaissent pas, ce qui est voulu — une demande non confirmée n'est pas
-- une demande à trancher.
alter table public.claims drop constraint if exists claims_status_check;
alter table public.claims
  add constraint claims_status_check
  check (status in ('non_confirme', 'en_attente', 'invite', 'accepte', 'refuse'));

-- ── 2. La preuve que le demandeur relève bien son adresse ────
alter table public.claims add column if not exists confirm_token   text;
alter table public.claims add column if not exists confirm_sent_at timestamptz;
alter table public.claims add column if not exists confirmed_at    timestamptz;

comment on column public.claims.confirm_token is
  'Jeton du lien de confirmation envoyé AU DEMANDEUR. Tant qu''il n''a pas été suivi, le lieu ne reçoit rien.';
comment on column public.claims.confirmed_at is
  'Date du clic de confirmation. C''est elle qui autorise l''envoi vers le lieu.';

-- Unique, pour qu'un jeton ne puisse jamais désigner deux demandes. Partiel :
-- les demandes d'avant cette migration n'en portent aucun.
create unique index if not exists claims_confirm_token_unique
  on public.claims (confirm_token)
  where confirm_token is not null;

-- ── 3. De quoi compter par IP sans dépendre de la mémoire ────
-- Le compteur en mémoire (lib/rate-limit.ts) attrape la rafale ; il repart à
-- zéro au redémarrage du process. La colonne, elle, permet une limite qui
-- tient sur 24 h et survit à un déploiement.
alter table public.claims add column if not exists request_ip text;

comment on column public.claims.request_ip is
  'IP de dépôt, pour la limite par IP sur 24 h. Donnée de sécurité, jamais affichée.';

create index if not exists claims_ip_idx
  on public.claims (request_ip, created_at)
  where request_ip is not null;

-- ── 4. L'unicité d'une demande vivante inclut le nouvel état ─
-- Sans cela, dix rafraîchissements de page créeraient dix demandes non
-- confirmées, donc dix courriels de confirmation. L'action de dépôt rattrape
-- la violation d'index et renvoie le lien au lieu d'échouer.
drop index if exists public.claims_vivante_unique;
create unique index claims_vivante_unique
  on public.claims (organization_id, lower(email))
  where status in ('non_confirme', 'en_attente', 'invite');
