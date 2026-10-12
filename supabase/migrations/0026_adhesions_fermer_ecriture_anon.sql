-- 0026_adhesions_fermer_ecriture_anon
--
-- Closes the direct write path on membership applications. Two insert
-- policies let the anon key (embedded in the public site by construction)
-- insert any row on a published campaign: status, amount, organization_id
-- and notes were free. Since bf41225 (2026-10-12) the public route
-- /api/orgs/[slug]/adhesions/[campaignSlug] writes with the service role,
-- so anon no longer needs any write on these tables. Decided by Leo on
-- 2026-10-12 ("go migration adhesions").
--
-- Also removes the duplicated policies (campaigns_* vs mc_*, tiers_* vs
-- mt_*, applications_* vs ma_*): one policy per intent, so a future change
-- cannot be bypassed by its twin. The kept public read policies apply to
-- role public, which covers anon and authenticated.
--
-- Reads for anon are unchanged: published campaigns and their tiers stay
-- readable (needed by /adherer on casaminga.com).

-- membership_applications: no public insert at all.
drop policy if exists ma_public_insert on public.membership_applications;
drop policy if exists applications_public_insert on public.membership_applications;
drop policy if exists ma_member_all on public.membership_applications;
revoke insert, update, delete, truncate on public.membership_applications from anon;

-- membership_campaigns: keep mc_public_read (public) and campaigns_member_all.
drop policy if exists campaigns_public_read on public.membership_campaigns;
drop policy if exists mc_member_all on public.membership_campaigns;
revoke insert, update, delete, truncate on public.membership_campaigns from anon;

-- membership_tiers: keep mt_public_read (public) and mt_member_all.
drop policy if exists tiers_public_read on public.membership_tiers;
drop policy if exists tiers_member_all on public.membership_tiers;
revoke insert, update, delete, truncate on public.membership_tiers from anon;
