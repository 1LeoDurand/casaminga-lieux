import "server-only";
import { createAdminClient } from "@/lib/admin/guard";
import { getProgramConfigs } from "./programs";
import { stageByRole, stageBySlug } from "./status";
import type {
  Address, Article, ArticleStatsRow, Contact, Mailbox, MailboxHealthRow, Message, OutreachEvent,
  OverviewAlert, PhotoGrant, ProgramConfig, ProgramContext, ProgramStatsRow, RedZone, Subject,
  SubjectQualityRow, Thread, ThreadListItem, WeeklyRow,
} from "./types";

/**
 * Every read of the outreach_* tables goes through here, with the service role
 * client, server side, after requireSuperAdmin() in the page. anon and
 * authenticated have no right on these tables (0021): nothing is read from the
 * browser. With no service role (demo mode) every function returns an empty
 * result instead of throwing.
 */

export const PAGE_SIZE = 25;
const BOARD_LIMIT = 200;

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Monday (YYYY-MM-DD, Europe/Paris) of the week containing `d`. */
export function mondayOf(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(d).split("-").map(Number);
  const local = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const dow = (local.getUTCDay() + 6) % 7; // Monday = 0
  local.setUTCDate(local.getUTCDate() - dow);
  return local.toISOString().slice(0, 10);
}

/** Last `n` Mondays, most recent first. */
export function recentWeeks(n: number): string[] {
  const out: string[] = [];
  const base = new Date(mondayOf(new Date()) + "T12:00:00Z");
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - 7 * i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Keeps a free-text search usable inside a PostgREST or() filter. */
function cleanSearch(q: string): string {
  return q.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Counts for the sidebar
// ---------------------------------------------------------------------------

/** Number of threads flagged "à toi", all programs. Never throws. */
export async function getOutreachPendingCount(): Promise<number> {
  try {
    const admin = createAdminClient();
    if (!admin) return 0;
    const { count } = await admin.from("outreach_threads").select("id", { count: "exact", head: true }).eq("needs_leo", true);
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Hydration of thread rows (names, labels, AI summary)
// ---------------------------------------------------------------------------

export async function hydrateThreads(threads: Thread[]): Promise<ThreadListItem[]> {
  const admin = createAdminClient();
  if (!admin || threads.length === 0) return [];
  const configs = await getProgramConfigs();
  const cfg = new Map(configs.map((p) => [p.id, p]));

  const contactIds = [...new Set(threads.map((t) => t.contact_id))];
  const articleIds = [...new Set(threads.map((t) => t.article_id).filter((x): x is string => !!x))];
  const subjectIds = [...new Set(threads.map((t) => t.current_subject_id).filter((x): x is string => !!x))];
  const threadIds = threads.map((t) => t.id);

  const contacts = new Map<string, { name: string; city: string | null }>();
  for (const ids of chunk(contactIds, 150)) {
    const { data } = await admin.from("outreach_contacts").select("id, name, city").in("id", ids);
    for (const c of (data ?? []) as Row[]) contacts.set(c.id as string, { name: c.name as string, city: (c.city as string) ?? null });
  }
  const articles = new Map<string, string>();
  if (articleIds.length) {
    const { data } = await admin.from("outreach_articles").select("id, title").in("id", articleIds);
    for (const a of (data ?? []) as Row[]) articles.set(a.id as string, a.title as string);
  }
  const subjects = new Map<string, string>();
  if (subjectIds.length) {
    const { data } = await admin.from("outreach_subjects").select("id, label").in("id", subjectIds);
    for (const s of (data ?? []) as Row[]) subjects.set(s.id as string, s.label as string);
  }
  // Latest AI summary per thread (inbound messages only).
  const summaries = new Map<string, string>();
  for (const ids of chunk(threadIds, 150)) {
    const { data } = await admin
      .from("outreach_messages")
      .select("thread_id, ai_summary, created_at")
      .in("thread_id", ids)
      .eq("direction", "in")
      .not("ai_summary", "is", null)
      .order("created_at", { ascending: false });
    for (const m of (data ?? []) as Row[]) {
      const tid = m.thread_id as string;
      if (!summaries.has(tid)) summaries.set(tid, m.ai_summary as string);
    }
  }

  return threads.map((t) => {
    const p = cfg.get(t.program_id);
    const st = p ? stageBySlug(p, t.status) : null;
    return {
      ...t,
      contact_name: contacts.get(t.contact_id)?.name ?? "Contact inconnu",
      contact_city: contacts.get(t.contact_id)?.city ?? null,
      program_slug: p?.slug ?? "?",
      program_label: p?.label ?? "Programme inconnu",
      stage_label: st?.label ?? t.status,
      stage_role: st?.role ?? null,
      subject_label: t.current_subject_id ? subjects.get(t.current_subject_id) ?? null : null,
      article_title: t.article_id ? articles.get(t.article_id) ?? null : null,
      ai_summary: summaries.get(t.id) ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Overview (/admin/contacts)
// ---------------------------------------------------------------------------

export interface Overview {
  programs: ProgramConfig[];
  stats: ProgramStatsRow[];
  mailboxes: (MailboxHealthRow & { missingVars: string[]; programSlugs: string[] })[];
  quality: SubjectQualityRow[];
  articles: ArticleStatsRow[];
  weekly: WeeklyRow[];
  queue: ThreadListItem[];
  alerts: OverviewAlert[];
  audience: Audience;
}

export interface Audience { contacts: number; joignables: number; ne_plus_ecrire: number; adresses_invalides: number }

/** Names (never values) of the mailbox variables missing from the environment. */
export function missingMailboxVars(mailbox: Pick<Mailbox, "env_prefix">): string[] {
  const suffixes = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "IMAP_HOST", "IMAP_PORT"];
  return suffixes.map((s) => mailbox.env_prefix + s).filter((name) => !process.env[name]);
}

export async function getOverview(programSlug: string | null): Promise<Overview> {
  const empty: Overview = {
    programs: [], stats: [], mailboxes: [], quality: [], articles: [], weekly: [], queue: [], alerts: [],
    audience: { contacts: 0, joignables: 0, ne_plus_ecrire: 0, adresses_invalides: 0 },
  };
  const admin = createAdminClient();
  if (!admin) return empty;

  const programs = await getProgramConfigs();
  const selected = programSlug ? programs.find((p) => p.slug === programSlug) ?? null : null;
  const scope = selected ? [selected] : programs;
  const scopeIds = scope.map((p) => p.id);
  const since = new Date(Date.now() - 84 * 86_400_000).toISOString().slice(0, 10);

  const [statsR, healthR, qualityR, articlesR, weeklyR, mailboxesR, contextsR, cronR, queueR] = await Promise.all([
    admin.from("outreach_v_program_stats").select("*"),
    admin.from("outreach_v_mailbox_health").select("*"),
    admin.from("outreach_v_subject_quality").select("*"),
    admin.from("outreach_v_article_stats").select("*"),
    admin.from("outreach_v_weekly").select("*").gte("semaine", since).order("semaine", { ascending: false }),
    admin.from("outreach_mailboxes").select("*"),
    admin.from("outreach_program_contexts").select("program_id").eq("active", true),
    admin.from("cron_log").select("job_key, ran_at, status").like("job_key", "outreach%").order("ran_at", { ascending: false }).limit(1),
    admin.from("outreach_threads").select("*").eq("needs_leo", true).order("needs_leo_since", { ascending: true }).limit(150),
  ]);

  const inScope = (id: string | null) => id !== null && scopeIds.includes(id);
  const stats = ((statsR.data ?? []) as ProgramStatsRow[]).filter((s) => inScope(s.program_id));
  const mailboxRows = (mailboxesR.data ?? []) as Mailbox[];
  const scopeMailboxKeys = new Set(scope.map((p) => p.mailbox_key));
  const mailboxes = ((healthR.data ?? []) as MailboxHealthRow[])
    .filter((m) => scopeMailboxKeys.has(m.mailbox_key))
    .map((m) => {
      const mb = mailboxRows.find((x) => x.key === m.mailbox_key);
      return {
        ...m,
        missingVars: mb ? missingMailboxVars(mb) : [],
        programSlugs: programs.filter((p) => p.mailbox_key === m.mailbox_key).map((p) => p.slug),
      };
    });
  const quality = ((qualityR.data ?? []) as SubjectQualityRow[]).filter((r) => inScope(r.program_id));
  const articles = ((articlesR.data ?? []) as ArticleStatsRow[]).filter((r) => inScope(r.program_id));

  // Weekly rows: one per (program, week). "Tous" sums the programs.
  const weeklyMap = new Map<string, WeeklyRow>();
  for (const w of (weeklyR.data ?? []) as WeeklyRow[]) {
    if (!inScope(w.program_id)) continue;
    const cur = weeklyMap.get(w.semaine);
    if (!cur) weeklyMap.set(w.semaine, { ...w, program_id: selected ? w.program_id : null });
    else {
      for (const k of ["premiers_contacts", "relances", "reponses_leo", "reponses_auto", "fils_ouverts",
        "messages_recus", "rebonds", "plaintes", "desinscriptions", "actions_lien"] as const) cur[k] += w[k];
    }
  }
  const weekly = [...weeklyMap.values()].sort((a, b) => (a.semaine < b.semaine ? 1 : -1));

  const queueThreads = ((queueR.data ?? []) as Thread[]).filter((t) => inScope(t.program_id));
  const queue = await hydrateThreads(queueThreads);

  // ---- Alerts ----
  const alerts: OverviewAlert[] = [];
  for (const mb of mailboxes) {
    const row = mailboxRows.find((x) => x.key === mb.mailbox_key);
    if (mb.paused) alerts.push({ level: "danger", text: `Boîte ${mb.address} en pause : ${mb.pause_reason ?? "raison non renseignée"}.` });
    if (row && mb.rebonds >= row.bounce_min_count && (mb.taux_rebond ?? 0) >= row.bounce_threshold) {
      alerts.push({ level: "danger", text: `Taux de rebond de ${mb.address} au-dessus du seuil : ${((mb.taux_rebond ?? 0) * 100).toFixed(1)} % (seuil ${(row.bounce_threshold * 100).toFixed(1)} %).` });
    }
    if (row && mb.plaintes >= 1 && (mb.taux_plainte ?? 0) >= row.complaint_threshold) {
      alerts.push({ level: "danger", text: `${mb.plaintes} plainte(s) sur ${mb.address} : taux au-dessus du seuil.` });
    }
    const usesActiveProgram = programs.some((p) => p.mailbox_key === mb.mailbox_key && p.active);
    if (usesActiveProgram && mb.missingVars.length > 0) {
      alerts.push({ level: "warn", text: `Variables manquantes pour ${mb.address} : ${mb.missingVars.join(", ")}.` });
    }
    if (mb.envois_bloques > 0) alerts.push({ level: "danger", text: `${mb.envois_bloques} message(s) bloqué(s) en cours d'envoi depuis plus de 15 minutes sur ${mb.address}.` });
  }
  for (const p of scope) {
    if (p.settings?.paused) alerts.push({ level: "warn", text: `Programme « ${p.label} » en pause : ${p.settings.pause_reason ?? "raison non renseignée"}.` });
  }
  const withContext = new Set(((contextsR.data ?? []) as Row[]).map((r) => r.program_id as string));
  for (const p of scope) {
    if (p.active && !withContext.has(p.id)) alerts.push({ level: "danger", text: `Le programme « ${p.label} » est actif sans contexte actif.`, href: `/admin/contacts/reglages?programme=${p.slug}&onglet=contexte` });
  }
  const late = stats.reduce((n, s) => n + (s.hors_delai ?? 0), 0);
  if (late > 0) alerts.push({ level: "warn", text: `${late} fil(s) hors délai de première réponse.`, href: "/admin/contacts#a-toi" });

  // Drafts waiting for more than 7 days.
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  let oldDrafts = 0;
  for (const p of scope) {
    const draftStage = stageByRole(p, "a_valider");
    if (!draftStage) continue;
    const { count } = await admin.from("outreach_threads").select("id", { count: "exact", head: true })
      .eq("program_id", p.id).eq("status", draftStage.slug).lt("created_at", weekAgo);
    oldDrafts += count ?? 0;
  }
  if (oldDrafts > 0) alerts.push({ level: "info", text: `${oldDrafts} brouillon(s) en attente depuis plus de 7 jours.`, href: "/admin/contacts/lots" });

  const anyActive = scope.some((p) => p.active);
  const lastCron = (cronR.data ?? [])[0] as Row | undefined;
  if (anyActive) {
    if (!lastCron) alerts.push({ level: "warn", text: "Aucune exécution du cron d'envoi n'est enregistrée." });
    else if (Date.now() - new Date(lastCron.ran_at as string).getTime() > 2 * 3_600_000) {
      alerts.push({ level: "warn", text: "Le cron d'envoi ne s'est pas exécuté depuis plus de 2 heures." });
    }
  }

  const audience = await getAudience();
  return { programs, stats, mailboxes, quality, articles, weekly, queue, alerts, audience };
}

/** Audience counters: how many contacts, how many can still be written to. */
async function getAudience(): Promise<Audience> {
  const admin = createAdminClient();
  const zero = { contacts: 0, joignables: 0, ne_plus_ecrire: 0, adresses_invalides: 0 };
  if (!admin) return zero;
  const head = { count: "exact" as const, head: true };
  const [all, dnc, invalid, ok] = await Promise.all([
    admin.from("outreach_contacts").select("id", head),
    admin.from("outreach_contacts").select("id", head).eq("do_not_contact", true),
    admin.from("outreach_addresses").select("id", head).eq("status", "invalide"),
    admin.from("outreach_contacts").select("id, outreach_addresses!inner(id)", head).eq("do_not_contact", false).eq("outreach_addresses.status", "valide"),
  ]);
  return {
    contacts: all.count ?? 0,
    joignables: ok.count ?? 0,
    ne_plus_ecrire: dnc.count ?? 0,
    adresses_invalides: invalid.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Board (/admin/contacts/tableau)
// ---------------------------------------------------------------------------

export interface BoardFilters { article?: string; semaine?: string; sujet?: string }

export interface BoardData {
  threads: ThreadListItem[];
  truncated: boolean;
  articles: { id: string; title: string }[];
  subjects: { id: string; label: string }[];
}

export async function getBoard(program: ProgramConfig, filters: BoardFilters): Promise<BoardData> {
  const admin = createAdminClient();
  if (!admin) return { threads: [], truncated: false, articles: [], subjects: [] };

  const boardSlugs = program.stages.filter((s) => s.on_board).map((s) => s.slug);
  let q = admin.from("outreach_threads").select("*").eq("program_id", program.id).in("status", boardSlugs)
    .order("status_changed_at", { ascending: false }).limit(BOARD_LIMIT + 1);
  if (filters.article) q = q.eq("article_id", filters.article);
  if (filters.sujet) q = q.eq("current_subject_id", filters.sujet);
  if (filters.semaine && /^\d{4}-\d{2}-\d{2}$/.test(filters.semaine)) {
    const start = new Date(filters.semaine + "T00:00:00Z");
    const end = new Date(start.getTime() + 7 * 86_400_000);
    // Wide window (+/- 2 h) so the Paris week is fully covered whatever the DST offset.
    q = q.gte("created_at", new Date(start.getTime() - 2 * 3_600_000).toISOString())
      .lt("created_at", new Date(end.getTime() - 2 * 3_600_000).toISOString());
  }
  const { data } = await q;
  const rows = (data ?? []) as Thread[];
  const truncated = rows.length > BOARD_LIMIT;
  const threads = await hydrateThreads(rows.slice(0, BOARD_LIMIT));

  const [articlesR, subjectsR] = await Promise.all([
    program.uses_articles
      ? admin.from("outreach_articles").select("id, title").order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [] as Row[] }),
    admin.from("outreach_subjects").select("id, label").eq("program_id", program.id).order("position"),
  ]);
  return {
    threads,
    truncated,
    articles: ((articlesR.data ?? []) as Row[]).map((a) => ({ id: a.id as string, title: a.title as string })),
    subjects: ((subjectsR.data ?? []) as Row[]).map((s) => ({ id: s.id as string, label: s.label as string })),
  };
}

// ---------------------------------------------------------------------------
// Contact list (/admin/contacts/lieux)
// ---------------------------------------------------------------------------

export interface ContactFilters {
  q?: string;
  programme?: string;
  etape?: string;
  article?: string;
  region?: string;
  photos?: boolean;
  aToi?: boolean;
  page?: number;
}

export interface ContactListRow {
  id: string;
  name: string;
  kind: string | null;
  city: string | null;
  region: string | null;
  do_not_contact: boolean;
  links: { organization: boolean; establishment: boolean; annuaire: boolean; sejour: boolean };
  primaryAddress: { email: string; source: string; status: string } | null;
  threads: { id: string; program_slug: string; program_label: string; status: string; stage_label: string; needs_leo: boolean; last_exchange: string | null }[];
  lastExchange: string | null;
}

export interface ContactListResult {
  rows: ContactListRow[];
  total: number;
  page: number;
  pages: number;
  regions: string[];
  articles: { id: string; title: string }[];
}

export async function listContacts(filters: ContactFilters): Promise<ContactListResult> {
  const empty: ContactListResult = { rows: [], total: 0, page: 1, pages: 1, regions: [], articles: [] };
  const admin = createAdminClient();
  if (!admin) return empty;

  const configs = await getProgramConfigs();
  const program = filters.programme ? configs.find((p) => p.slug === filters.programme) ?? null : null;
  const page = Math.max(1, Math.floor(filters.page ?? 1));

  // Thread-based filters are applied through an inner embed: only contacts
  // with at least one matching thread come back. The threads shown in the row
  // are re-read afterwards, unfiltered.
  const threadFilter = !!(program || filters.etape || filters.article || filters.photos || filters.aToi);
  let q = admin
    .from("outreach_contacts")
    .select(threadFilter ? "id, outreach_threads!inner(id)" : "id", { count: "exact" });
  if (program) q = q.eq("outreach_threads.program_id", program.id);
  if (filters.etape) q = q.eq("outreach_threads.status", filters.etape);
  if (filters.article) q = q.eq("outreach_threads.article_id", filters.article);
  if (filters.photos) q = q.not("outreach_threads.photos_granted_at", "is", null);
  if (filters.aToi) q = q.eq("outreach_threads.needs_leo", true);
  if (filters.region) q = q.eq("region", filters.region);
  const search = filters.q ? cleanSearch(filters.q) : "";
  if (search) q = q.or(`name.ilike.%${search}%,city.ilike.%${search}%`);
  q = q.order("name", { ascending: true }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const [{ data: idRows, count }, regionsR, articlesR] = await Promise.all([
    q,
    admin.from("outreach_contacts").select("region").not("region", "is", null).limit(2000),
    admin.from("outreach_articles").select("id, title").order("created_at", { ascending: false }).limit(100),
  ]);
  const regions = [...new Set(((regionsR.data ?? []) as Row[]).map((r) => r.region as string))].sort((a, b) => a.localeCompare(b, "fr"));
  const articles = ((articlesR.data ?? []) as Row[]).map((a) => ({ id: a.id as string, title: a.title as string }));

  const total = count ?? 0;
  const ids = ((idRows ?? []) as unknown as Row[]).map((r) => r.id as string);
  if (ids.length === 0) return { rows: [], total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), regions, articles };

  const [contactsR, addrR, threadsR] = await Promise.all([
    admin.from("outreach_contacts").select("*").in("id", ids),
    admin.from("outreach_addresses").select("contact_id, email, source, status, is_primary").in("contact_id", ids),
    admin.from("outreach_threads")
      .select("id, contact_id, program_id, status, needs_leo, last_outbound_at, last_inbound_at, status_changed_at").in("contact_id", ids),
  ]);
  const contacts = new Map(((contactsR.data ?? []) as Contact[]).map((c) => [c.id, c]));
  const addrByContact = new Map<string, Row[]>();
  for (const a of (addrR.data ?? []) as Row[]) {
    const l = addrByContact.get(a.contact_id as string) ?? [];
    l.push(a);
    addrByContact.set(a.contact_id as string, l);
  }
  const threadsByContact = new Map<string, Row[]>();
  for (const t of (threadsR.data ?? []) as Row[]) {
    const l = threadsByContact.get(t.contact_id as string) ?? [];
    l.push(t);
    threadsByContact.set(t.contact_id as string, l);
  }

  const rows: ContactListRow[] = [];
  for (const id of ids) {
    const c = contacts.get(id);
    if (!c) continue;
    const addrs = addrByContact.get(id) ?? [];
    const primary = addrs.find((a) => a.is_primary) ?? addrs[0];
    const threads = (threadsByContact.get(id) ?? [])
      .map((t) => {
        const p = configs.find((x) => x.id === t.program_id);
        const st = p ? stageBySlug(p, t.status as string) : null;
        const last = [t.last_outbound_at, t.last_inbound_at].filter(Boolean).sort().pop() as string | undefined;
        return {
          id: t.id as string,
          program_slug: p?.slug ?? "?",
          program_label: p?.label ?? "?",
          status: t.status as string,
          stage_label: st?.label ?? (t.status as string),
          needs_leo: !!t.needs_leo,
          last_exchange: last ?? null,
        };
      })
      .sort((a, b) => ((b.last_exchange ?? "") > (a.last_exchange ?? "") ? 1 : -1));
    const lastExchange = threads.map((t) => t.last_exchange).filter(Boolean).sort().pop() ?? null;
    rows.push({
      id,
      name: c.name,
      kind: c.kind,
      city: c.city,
      region: c.region,
      do_not_contact: c.do_not_contact,
      links: {
        organization: !!c.organization_id,
        establishment: !!c.establishment_id,
        annuaire: !!c.annuaire_lieu_id,
        sejour: !!c.sejour_place_slug,
      },
      primaryAddress: primary ? { email: primary.email as string, source: primary.source as string, status: primary.status as string } : null,
      threads,
      lastExchange,
    });
  }
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), regions, articles };
}

// ---------------------------------------------------------------------------
// Contact card (/admin/contacts/lieux/[id])
// ---------------------------------------------------------------------------

export interface ContactDetail {
  contact: Contact;
  addresses: Address[];
  threads: ThreadListItem[];
  drafts: (Message & { thread_id: string })[];
  grants: (PhotoGrant & { signedFiles: { name: string; url: string | null }[] })[];
  events: OutreachEvent[];
  suppressed: string[];
}

export async function getContactDetail(id: string): Promise<ContactDetail | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: contactRow } = await admin.from("outreach_contacts").select("*").eq("id", id).maybeSingle();
  if (!contactRow) return null;
  const contact = contactRow as Contact;

  const [addrR, threadsR, grantsR, eventsR] = await Promise.all([
    admin.from("outreach_addresses").select("*").eq("contact_id", id).order("is_primary", { ascending: false }),
    admin.from("outreach_threads").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
    admin.from("outreach_photo_grants").select("*").eq("contact_id", id).order("accepted_at", { ascending: false }),
    admin.from("outreach_events").select("*").eq("contact_id", id).order("occurred_at", { ascending: false }).limit(60),
  ]);
  const addresses = (addrR.data ?? []) as Address[];
  const threadRows = (threadsR.data ?? []) as Thread[];
  const threads = await hydrateThreads(threadRows);

  const draftStatuses = ["a_valider", "planifie"];
  let drafts: ContactDetail["drafts"] = [];
  if (threadRows.length) {
    const { data } = await admin.from("outreach_messages").select("*")
      .in("thread_id", threadRows.map((t) => t.id)).eq("direction", "out").in("send_status", draftStatuses)
      .order("created_at", { ascending: true });
    drafts = (data ?? []) as ContactDetail["drafts"];
  }

  const grants: ContactDetail["grants"] = [];
  for (const g of (grantsR.data ?? []) as PhotoGrant[]) {
    const signedFiles: { name: string; url: string | null }[] = [];
    for (const f of g.files ?? []) {
      let url: string | null = null;
      if (f.path) {
        try {
          const { data } = await admin.storage.from("outreach-files").createSignedUrl(f.path, 600);
          url = data?.signedUrl ?? null;
        } catch {
          url = null;
        }
      }
      signedFiles.push({ name: f.name ?? f.path ?? "fichier", url });
    }
    grants.push({ ...g, signedFiles });
  }

  const emails = addresses.map((a) => a.email);
  let suppressed: string[] = [];
  if (emails.length) {
    const { data } = await admin.from("outreach_suppressions").select("email").in("email", emails);
    suppressed = ((data ?? []) as Row[]).map((r) => r.email as string);
  }

  return { contact, addresses, threads, drafts, grants, events: (eventsR.data ?? []) as OutreachEvent[], suppressed };
}

// ---------------------------------------------------------------------------
// Thread page (/admin/contacts/fils/[id])
// ---------------------------------------------------------------------------

export interface ThreadDetail {
  thread: Thread;
  program: ProgramConfig;
  contact: Contact;
  address: Address | null;
  article: Article | null;
  messages: Message[];
  events: OutreachEvent[];
  subjects: Subject[];
  redZones: RedZone[];
  contextVersion: number | null;
}

export async function getThreadDetail(id: string): Promise<ThreadDetail | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: threadRow } = await admin.from("outreach_threads").select("*").eq("id", id).maybeSingle();
  if (!threadRow) return null;
  const thread = threadRow as Thread;

  const configs = await getProgramConfigs();
  const program = configs.find((p) => p.id === thread.program_id);
  if (!program) return null;

  const [contactR, addressR, articleR, messagesR, eventsR, subjectsR, zonesR, ctxR] = await Promise.all([
    admin.from("outreach_contacts").select("*").eq("id", thread.contact_id).maybeSingle(),
    thread.address_id ? admin.from("outreach_addresses").select("*").eq("id", thread.address_id).maybeSingle() : Promise.resolve({ data: null }),
    thread.article_id ? admin.from("outreach_articles").select("*").eq("id", thread.article_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("outreach_messages").select("*").eq("thread_id", id).order("created_at", { ascending: true }),
    admin.from("outreach_events").select("*").eq("thread_id", id).order("occurred_at", { ascending: false }).limit(60),
    admin.from("outreach_subjects").select("*").eq("program_id", program.id).order("position"),
    admin.from("outreach_red_zones").select("*").or(`program_id.is.null,program_id.eq.${program.id}`).order("position"),
    admin.from("outreach_program_contexts").select("version").eq("program_id", program.id).eq("active", true).maybeSingle(),
  ]);
  if (!contactR.data) return null;

  return {
    thread,
    program,
    contact: contactR.data as Contact,
    address: (addressR.data as Address | null) ?? null,
    article: (articleR.data as Article | null) ?? null,
    messages: (messagesR.data ?? []) as Message[],
    events: (eventsR.data ?? []) as OutreachEvent[],
    subjects: (subjectsR.data ?? []) as Subject[],
    redZones: (zonesR.data ?? []) as RedZone[],
    contextVersion: (ctxR.data as Row | null)?.version as number | null ?? null,
  };
}

// ---------------------------------------------------------------------------
// Batch validation (/admin/contacts/lots)
// ---------------------------------------------------------------------------

export interface LotGroup {
  key: string;
  program_id: string;
  program_slug: string;
  program_label: string;
  article_id: string | null;
  article_title: string | null;
  template_id: string | null;
  count: number;
}

export interface LotItem {
  thread_id: string;
  contact_id: string;
  contact_name: string;
  email: string | null;
  personal_line: string | null;
  message_id: string | null;
  body: string | null;
  subject: string | null;
}

export interface LotData {
  groups: LotGroup[];
  customCount: number;
  selected: LotGroup | null;
  items: LotItem[];
  templateText: string | null;
}

export const LOT_SIZE = 20;

export function groupKey(g: { program_id: string; article_id: string | null; template_id: string | null }): string {
  return [g.program_id, g.article_id ?? "-", g.template_id ?? "-"].join("|");
}

export async function getLotData(programSlug: string | null, key: string | null): Promise<LotData> {
  const empty: LotData = { groups: [], customCount: 0, selected: null, items: [], templateText: null };
  const admin = createAdminClient();
  if (!admin) return empty;

  const configs = await getProgramConfigs();
  const outbound = configs.filter((p) => p.direction === "sortant" && (!programSlug || p.slug === programSlug));
  const groupsMap = new Map<string, LotGroup>();
  let customCount = 0;
  const articleTitles = new Map<string, string>();

  for (const p of outbound) {
    const draft = stageByRole(p, "a_valider");
    if (!draft) continue;
    const { data } = await admin.from("outreach_threads")
      .select("id, article_id, template_id, is_custom").eq("program_id", p.id).eq("status", draft.slug).limit(2000);
    for (const t of (data ?? []) as Row[]) {
      if (t.is_custom) { customCount++; continue; }
      const g = { program_id: p.id, article_id: (t.article_id as string) ?? null, template_id: (t.template_id as string) ?? null };
      const k = groupKey(g);
      const cur = groupsMap.get(k);
      if (cur) cur.count++;
      else groupsMap.set(k, { key: k, ...g, program_slug: p.slug, program_label: p.label, article_title: null, count: 1 });
    }
  }
  const artIds = [...new Set([...groupsMap.values()].map((g) => g.article_id).filter((x): x is string => !!x))];
  if (artIds.length) {
    const { data } = await admin.from("outreach_articles").select("id, title").in("id", artIds);
    for (const a of (data ?? []) as Row[]) articleTitles.set(a.id as string, a.title as string);
  }
  const groups = [...groupsMap.values()]
    .map((g) => ({ ...g, article_title: g.article_id ? articleTitles.get(g.article_id) ?? null : null }))
    .sort((a, b) => b.count - a.count);

  const selected = groups.find((g) => g.key === key) ?? groups[0] ?? null;
  if (!selected) return { ...empty, groups, customCount };

  const program = configs.find((p) => p.id === selected.program_id)!;
  const draft = stageByRole(program, "a_valider")!;
  let tq = admin.from("outreach_threads").select("*").eq("program_id", program.id).eq("status", draft.slug)
    .eq("is_custom", false).order("created_at", { ascending: true }).limit(LOT_SIZE);
  tq = selected.article_id ? tq.eq("article_id", selected.article_id) : tq.is("article_id", null);
  tq = selected.template_id ? tq.eq("template_id", selected.template_id) : tq.is("template_id", null);
  const { data: threadRows } = await tq;
  const threads = (threadRows ?? []) as Thread[];
  if (threads.length === 0) return { groups, customCount, selected, items: [], templateText: null };

  const ids = threads.map((t) => t.id);
  const [contactsR, addrR, msgR] = await Promise.all([
    admin.from("outreach_contacts").select("id, name").in("id", threads.map((t) => t.contact_id)),
    admin.from("outreach_addresses").select("id, email").in("id", threads.map((t) => t.address_id).filter((x): x is string => !!x)),
    admin.from("outreach_messages").select("id, thread_id, body_text, draft_text, subject")
      .in("thread_id", ids).eq("kind", "initial").eq("send_status", "a_valider"),
  ]);
  const names = new Map(((contactsR.data ?? []) as Row[]).map((c) => [c.id as string, c.name as string]));
  const emails = new Map(((addrR.data ?? []) as Row[]).map((a) => [a.id as string, a.email as string]));
  const msgs = new Map(((msgR.data ?? []) as Row[]).map((m) => [m.thread_id as string, m]));

  const items: LotItem[] = threads.map((t) => {
    const m = msgs.get(t.id);
    return {
      thread_id: t.id,
      contact_id: t.contact_id,
      contact_name: names.get(t.contact_id) ?? "Contact inconnu",
      email: t.address_id ? emails.get(t.address_id) ?? null : null,
      personal_line: t.personal_line,
      message_id: (m?.id as string) ?? null,
      body: ((m?.body_text as string) ?? (m?.draft_text as string)) ?? null,
      subject: (m?.subject as string) ?? t.email_subject,
    };
  });

  // Template reconstructed from the first draft: the personal line and the
  // place name are replaced by markers. The templates themselves are not stored.
  let templateText: string | null = null;
  const first = items[0];
  if (first?.body) {
    templateText = first.body;
    if (first.personal_line) templateText = templateText.split(first.personal_line).join("[phrase personnalisée]");
    if (first.contact_name) templateText = templateText.split(first.contact_name).join("[lieu]");
  }
  return { groups, customCount, selected, items, templateText };
}

// ---------------------------------------------------------------------------
// Program settings (/admin/contacts/reglages)
// ---------------------------------------------------------------------------

export interface ProgramAdminData {
  program: ProgramConfig;
  mailbox: Mailbox | null;
  contexts: ProgramContext[];
  subjects: Subject[];
  quality: SubjectQualityRow[];
  redZones: RedZone[];
  missing: string[];
  threadCount: number;
}

export async function getProgramAdminData(slug: string): Promise<ProgramAdminData | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const configs = await getProgramConfigs();
  const program = configs.find((p) => p.slug === slug);
  if (!program) return null;

  const [mailboxR, contextsR, subjectsR, qualityR, zonesR, readyR, countR] = await Promise.all([
    admin.from("outreach_mailboxes").select("*").eq("key", program.mailbox_key).maybeSingle(),
    admin.from("outreach_program_contexts").select("*").eq("program_id", program.id).order("version", { ascending: false }),
    admin.from("outreach_subjects").select("*").eq("program_id", program.id).order("position"),
    admin.from("outreach_v_subject_quality").select("*").eq("program_id", program.id),
    admin.from("outreach_red_zones").select("*").or(`program_id.is.null,program_id.eq.${program.id}`).order("position"),
    admin.rpc("outreach_program_ready", { p_program: program.id }),
    admin.from("outreach_threads").select("id", { count: "exact", head: true }).eq("program_id", program.id),
  ]);

  return {
    program,
    mailbox: (mailboxR.data as Mailbox | null) ?? null,
    contexts: (contextsR.data ?? []) as ProgramContext[],
    subjects: (subjectsR.data ?? []) as Subject[],
    quality: (qualityR.data ?? []) as SubjectQualityRow[],
    redZones: (zonesR.data ?? []) as RedZone[],
    missing: Array.isArray(readyR.data) ? (readyR.data as string[]) : [],
    threadCount: countR.count ?? 0,
  };
}
