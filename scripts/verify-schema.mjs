/**
 * Surcouche de test — vérification d'intégration code ↔ base en ligne.
 *
 * Pour chaque (table, colonnes) attendue par le code, on interroge PostgREST
 * (la MÊME couche HTTP que l'application) en `fetch` brut. Une colonne absente
 * renvoie une erreur PostgREST (42703) AVANT toute évaluation de RLS, donc la
 * clé anon suffit. Détecte les décalages code ↔ base qu'un `next build` ne voit
 * pas (les appels Supabase ne sont pas typés).
 *
 * Usage : npm run verify:schema   (charge .env.local)
 * Exit 1 si au moins une colonne/table manque.
 */
const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !KEY) {
  console.error("⏭️  URL / clé Supabase absentes — vérification ignorée.");
  process.exit(0);
}

const EXPECTED = {
  evenements: ["show_on_public_site", "establishment_id"],
  invoices: ["pole_id", "reference", "object", "validation_status", "validated_by", "validated_at"],
  invoice_settings: ["number_start", "require_validation_above"],
  expenses: ["label", "amount_ttc", "category", "pole_id", "payment_method", "paid_at", "receipt_url", "spent_at"],
  poles: ["name", "color", "type", "active", "position"],
  pole_budgets: ["pole_id", "fiscal_year", "allocated_amount"],
  pole_members: ["pole_id", "user_id", "pole_role"],
  cash_entries: ["pole_id"],
  cash_pointings: ["entry_id", "pointed_at"],
  establishments: ["name", "slug", "city", "siret", "is_primary", "active"],
  spaces: ["establishment_id"],
  reservations: ["establishment_id"],
  community_posts: ["establishment_id"],
  membership_campaigns: ["establishment_id"],
  persons: ["establishment_id"],
  organization_members: ["status", "last_seen_at"],
  event_registrations: ["full_name", "seats", "source", "status", "amount_ttc"],
  event_tickets: ["event_id", "registration_id", "holder_name", "ticket_token", "checked_in_at"],
  event_scan_links: ["event_id", "token", "revoked", "expires_at"],
  tax_receipts: ["donor_name", "amount", "fiscal_year"],
  subscriptions: ["tier", "status", "comped", "founding_member", "trial_ends_at"],
  feedback: ["screenshot_url"],
  grant_opportunities: ["title", "funder", "funder_type", "themes", "regions", "structure_types", "amount_min", "amount_max", "deadline", "recurring", "published"],
  grant_applications: ["organization_id", "opportunity_id", "status", "notes", "amount_requested", "applied_at", "result_at"],
};

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function probe(table, select) {
  const u = `${URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1`;
  const res = await fetch(u, { headers });
  if (res.ok) return { ok: true };
  let msg = `HTTP ${res.status}`;
  try { const b = await res.json(); msg = b.message || b.hint || msg; } catch { /* noop */ }
  return { ok: false, msg };
}

let missing = 0, okCount = 0;

for (const [table, cols] of Object.entries(EXPECTED)) {
  const all = await probe(table, cols.join(","));
  if (all.ok) { okCount += cols.length; console.log(`✅ ${table} (${cols.length} col.)`); continue; }
  if (/does not exist|find the table|42P01|PGRST205/i.test(all.msg) && !/column/i.test(all.msg)) {
    console.error(`❌ ${table} : TABLE MANQUANTE — ${all.msg}`); missing += cols.length; continue;
  }
  // Isoler la/les colonne(s) fautive(s)
  for (const col of cols) {
    const r = await probe(table, col);
    if (r.ok) okCount++;
    else { console.error(`❌ ${table}.${col} — ${r.msg}`); missing++; }
  }
}

console.log(`\n${missing === 0 ? "✅ OK" : "❌ ÉCHEC"} — ${okCount} colonnes vérifiées, ${missing} manquante(s).`);
process.exit(missing === 0 ? 0 : 1);
