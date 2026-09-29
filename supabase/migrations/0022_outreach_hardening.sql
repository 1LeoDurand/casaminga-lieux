-- 0022_outreach_hardening.sql
-- Security review of the contacts module (step 5), 2026-09-29. NOT APPLIED:
-- Leo applies it after reading.
--
-- 1. The send guard (outreach_guard_outbound) only ran when send_status,
--    to_email or author changed. An UPDATE of kind, thread_id, approved_at or
--    reply_to_message_id on a message already 'planifie' skipped every rule
--    (e.g. kind 'reponse' -> 'initial' after queueing, or moving a queued
--    message onto another thread). The trigger now fires on those columns too.
--
-- 2. A 'reponse' written by Leo escapes the opt-out rules (only cold mail and
--    automatic mail are checked, spec 3.3: one may still answer someone who
--    wrote). A 'reponse' that answers NOTHING (reply_to_message_id null) is a
--    new conversation in disguise: it now follows the opt-out rules. The admin
--    action sendReply already refuses a reply without an inbound message; this
--    is the database line of defence behind it.

begin;

create or replace function public.outreach_guard_reply()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_email      text := lower(btrim(coalesce(new.to_email, '')));
  v_contact_id uuid;
  v_dnc        boolean;
begin
  if new.direction <> 'out' or new.kind <> 'reponse' or new.reply_to_message_id is not null
     or coalesce(new.send_status, '') not in ('planifie', 'en_cours') then
    return new;
  end if;
  select t.contact_id into v_contact_id from public.outreach_threads t where t.id = new.thread_id;
  select c.do_not_contact into v_dnc from public.outreach_contacts c where c.id = v_contact_id;
  if coalesce(v_dnc, true)
     or exists (select 1 from public.outreach_suppressions s where s.email = v_email)
     or exists (select 1 from public.outreach_addresses a where a.email = v_email and a.status = 'opt_out') then
    raise exception 'outreach guard: recipient asked not to be contacted' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.outreach_guard_reply() from public, anon, authenticated;

drop trigger if exists outreach_messages_guard_reply on public.outreach_messages;
create trigger outreach_messages_guard_reply
  before insert or update of send_status, to_email, author, kind, thread_id, reply_to_message_id
  on public.outreach_messages
  for each row execute function public.outreach_guard_reply();

drop trigger if exists outreach_messages_guard on public.outreach_messages;
create trigger outreach_messages_guard
  before insert or update of send_status, to_email, author, kind, thread_id, approved_at
  on public.outreach_messages
  for each row execute function public.outreach_guard_outbound();

commit;
