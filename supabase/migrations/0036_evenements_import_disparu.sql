-- 0036_evenements_import_disparu
--
-- NOT APPLIED. Prepared on 2026-10-13 (T8.1) for Leo's go.
--
-- Goal: hide imported events that vanished from their source (cancelled or
-- removed upstream) without deleting anything. Two nullable columns on
-- public.evenements_import:
--   vu_le       last time an import pass saw this record at the source
--   disparu_le  moment the sweep hid the event because it was no longer seen
--
-- Additive and nullable: no existing row changes, no default, no backfill
-- (a null vu_le means "not seen since this migration", never "vanished").
--
-- Grants: nothing to add. evenements_import keeps its table-level grants
-- (0020 only switched public.organizations to column-level grants, it never
-- touched this table; 0022 and 0025 added columns here with no GRANT line, on
-- the same reasoning). service_role, which the import scripts use, already
-- holds the table privileges, so the new columns are writable and readable at
-- once. Side effect to accept: the existing policy evenements_import_public_read
-- also exposes both timestamps to anon, like source_maj. They are not
-- sensitive; if Leo prefers them private, the public read would have to move
-- to a column list, which is a separate decision.
--
-- Plan (scripts, to code after this migration is applied):
--  1. Each import (openagenda, datatourisme, sites) collects the event ids it
--     saw this pass, including those matched as already in base or as doublons.
--  2. At the end of a pass that was NOT partial (no --max cut, no --limite-sites,
--     no --echantillon, no --depart, full perimeter), PATCH evenements_import
--     set vu_le = now() for those ids, in batches of 100. Never in --essai.
--  3. A partial pass sets vu_le but never sweeps: absence is not proof.
--  4. Sweep (separate script or option): for one source and one perimeter, take
--     imported events with start_at in the future, checked_at null, disparu_le
--     null and vu_le older than the last two complete passes of that source
--     and perimeter (so two passes in a row without seeing the record).
--  5. For those, set disparu_le = now() and evenements.show_on_public_site =
--     false. Never delete; never touch a fiche with checked_at (R8).
--  6. Reappearance: when an import sees a record whose disparu_le is not null,
--     set disparu_le = null and show_on_public_site = true, unless a withdrawal
--     (import_retraits_actifs) or the content exclusion still applies.
--  7. Record each complete pass (source, perimeter, date) so "two passes" is
--     counted on passes, not calendar days; vu_le alone cannot tell a missed
--     pass from a skipped one.
--  8. A source that fails or returns far fewer records than usual (below 50 %
--     of the previous pass) aborts the sweep: an outage must not hide a catalogue.
--  9. Report per sweep: seen, newly hidden, restored; print the hidden titles
--     in --essai before the first real run.
-- 10. Dedoublonnage links (evenements_doublons) are not touched; a hidden fiche
--     keeps its links so a doublon cannot re-create it.

begin;

alter table public.evenements_import
  add column if not exists vu_le timestamptz,
  add column if not exists disparu_le timestamptz;

comment on column public.evenements_import.vu_le is
  'Derniere fois que un passage d''import a revu cette fiche a la source. Null : pas revue depuis 0036.';
comment on column public.evenements_import.disparu_le is
  'Moment ou le balayage a masque la fiche (plus vue a la source apres deux passages complets). Null : fiche presente ou jamais balayee.';

-- Sweep query: imported events still visible, never seen again recently.
create index if not exists evenements_import_vu_le_idx
  on public.evenements_import (source, vu_le)
  where disparu_le is null;

commit;
