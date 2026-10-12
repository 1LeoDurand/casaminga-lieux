-- 0034_bucket_affiches_importees
--
-- NOT APPLIED. Written on 2026-10-12 (task T42), to be applied by Leo's go.
--
-- Public bucket for the posters of imported events (DATAtourisme, OpenAgenda,
-- sites). scripts/recuperer-affiches.py reads the og:image of each event page,
-- converts it to JPEG (quality 85, 1600 px wide at most) and stores it here as
-- importees/<event_id>.jpg, so that casaminga.com no longer depends on the
-- origin sites (403 hotlink protection, 429 rate limits: see
-- scripts/verifier-affiches.py and evenements_import.photos_retirees).
-- Republication without licence authorised by Leo on 2026-10-12 (rule R3:
-- withdrawal on request, which includes deleting the object).
--
-- Why a new bucket and not public-assets: public-assets is the org upload
-- bucket (path <org_id>/..., written by authenticated members through the
-- dashboard). Imported posters have another owner, another lifecycle (bulk
-- purge on withdrawal) and must be writable by service_role only.
--
-- Access model:
--   - public = true: objects are served by /storage/v1/object/public/... with
--     no policy. No SELECT policy is created on purpose: a SELECT policy on
--     storage.objects would also let anon LIST the bucket.
--   - no INSERT / UPDATE / DELETE policy: with RLS on storage.objects, anon and
--     authenticated cannot write; service_role bypasses RLS.
--   - size limit 2 MB, JPEG only (the script converts everything to JPEG).
--
-- Grants (rule 0018): this file creates no function and no table, so there is
-- nothing to grant or revoke; the privileges of storage.objects are unchanged.
-- The explicit part is the absence of any write policy, checked below.
--
-- No begin/commit: the migration runner wraps the file in a transaction.
--
-- Rollback (objects first, a bucket with objects cannot be dropped):
--   delete from storage.objects where bucket_id = 'affiches-importees';
--   delete from storage.buckets where id = 'affiches-importees';
--   -- then restore evenements.photos to '{}' for the events concerned
--   -- (the script keeps their list in scripts/data/affiches-importees.json).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('affiches-importees', 'affiches-importees', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

-- Check: no policy of any kind may target this bucket for anon / authenticated.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') like '%affiches-importees%'
           or coalesce(with_check, '') like '%affiches-importees%')
  ) then
    raise exception 'a policy already targets affiches-importees: review it before applying';
  end if;
end $$;
