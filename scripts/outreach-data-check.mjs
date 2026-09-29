// outreach-data-check.mjs
//
// Read-only check of the queries behind /admin/contacts (src/lib/outreach/data.ts):
// the monitoring views, the embedded-resource filters used by the contact list
// and the audience counters. It reads NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY from the shell environment and skips (exit 0) when
// they are missing. No secret is written here nor printed.
//
//   node --env-file=.env.local scripts/outreach-data-check.mjs
//
// (the --env-file flag loads the variables into the process; the file itself is
// not read by this script.)

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("SKIP: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in the environment.");
  process.exit(0);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
let failures = 0;

async function check(name, run) {
  try {
    const { data, count, error } = await run();
    if (error) throw new Error(`${error.code ?? ""} ${error.message}`.trim());
    const size = Array.isArray(data) ? `${data.length} row(s)` : count !== null && count !== undefined ? `count ${count}` : "ok";
    console.log(`OK    ${name}: ${size}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name}: ${e.message}`);
  }
}

const { data: programs } = await admin.from("outreach_programs").select("id, slug");
const first = programs?.[0];

for (const view of ["outreach_v_program_stats", "outreach_v_article_stats", "outreach_v_weekly", "outreach_v_subject_quality", "outreach_v_mailbox_health"]) {
  await check(`view ${view}`, () => admin.from(view).select("*").limit(50));
}

// Contact list: inner embed on threads, one filter per column used by the screen.
await check("contacts + threads!inner (program)", () =>
  admin.from("outreach_contacts").select("id, outreach_threads!inner(id)", { count: "exact" })
    .eq("outreach_threads.program_id", first?.id ?? "00000000-0000-0000-0000-000000000000").range(0, 24));
await check("contacts + threads!inner (à toi)", () =>
  admin.from("outreach_contacts").select("id, outreach_threads!inner(id)", { count: "exact" })
    .eq("outreach_threads.needs_leo", true).range(0, 24));
await check("contacts + threads!inner (photos)", () =>
  admin.from("outreach_contacts").select("id, outreach_threads!inner(id)", { count: "exact" })
    .not("outreach_threads.photos_granted_at", "is", null).range(0, 24));
await check("contacts search", () =>
  admin.from("outreach_contacts").select("id", { count: "exact" }).or("name.ilike.%habitat%,city.ilike.%habitat%").range(0, 24));
await check("audience: contacts with a valid address", () =>
  admin.from("outreach_contacts").select("id, outreach_addresses!inner(id)", { count: "exact", head: true })
    .eq("do_not_contact", false).eq("outreach_addresses.status", "valide"));

if (first) await check("rpc outreach_program_ready", () => admin.rpc("outreach_program_ready", { p_program: first.id }));

console.log(failures === 0 ? "All checks passed." : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
