/**
 * Seeder d'organisations de démonstration.
 * Crée de vraies lignes en base Supabase (avec is_demo=true).
 * Ces orgs sont exclues du portail public et n'envoient pas d'emails réels.
 */

import "server-only";
import { createAdminClient } from "./guard";

export type DemoArchetype = "tiers-lieu" | "association" | "coworking";

// ─── Configs par archétype ─────────────────────────────────────────────────────

const DEMO_CONFIGS: Record<DemoArchetype, {
  slug: string;
  name: string;
  structure: string;
  address: string;
  description: string;
  primary_color: string;
  hours: string;
}> = {
  "tiers-lieu": {
    slug: "demo-tiers-lieu",
    name: "La Friche Commune (démo)",
    structure: "Association loi 1901",
    address: "Paris 11e (75)",
    description: "Espace de vie collective polyvalent : ateliers, résidences, espaces partagés et programmation culturelle. Organisation de démonstration Casa Minga.",
    primary_color: "#C75A38",
    hours: "Mar–Sam, 9h–19h",
  },
  "association": {
    slug: "demo-association",
    name: "Les Amis du Quartier (démo)",
    structure: "Association loi 1901",
    address: "Lyon 3e (69)",
    description: "Association de quartier : animations locales, adhésions, gestion de membres et événements communautaires. Organisation de démonstration Casa Minga.",
    primary_color: "#2f8a4c",
    hours: "Lun–Ven, 10h–18h",
  },
  "coworking": {
    slug: "demo-coworking",
    name: "L'Atelier Partagé (démo)",
    structure: "SAS",
    address: "Bordeaux (33)",
    description: "Espace de coworking : bureaux flexibles, salles de réunion, abonnements mensuels. Organisation de démonstration Casa Minga.",
    primary_color: "#0e6e7a",
    hours: "Lun–Ven, 8h–20h · Sam, 9h–17h",
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function dateStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

// ─── Seeder principal ─────────────────────────────────────────────────────────

export async function seedDemoOrg(archetype: DemoArchetype): Promise<{ ok: boolean; orgId?: string; error?: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Client admin non disponible." };

  const cfg = DEMO_CONFIGS[archetype];

  // Supprimer toute démo existante du même type
  const { data: existing } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", cfg.slug)
    .maybeSingle();

  if (existing) {
    await deleteDemoOrgData(admin, existing.id);
    await admin.from("organizations").delete().eq("id", existing.id);
  }

  // 1. Créer l'org
  const orgId = uuid();
  const { error: orgErr } = await admin.from("organizations").insert({
    id: orgId,
    slug: cfg.slug,
    name: cfg.name,
    structure: cfg.structure,
    address: cfg.address,
    description: cfg.description,
    primary_color: cfg.primary_color,
    hours: cfg.hours,
    email: `demo@${cfg.slug}.exemple`,
    plan: "essentiel",
    is_demo: true,
    demo_archetype: archetype,
  });
  if (orgErr) return { ok: false, error: orgErr.message };

  // 2. Site public
  await admin.from("public_sites").upsert({
    organization_id: orgId,
    slug: cfg.slug,
    title: cfg.name.replace(" (démo)", ""),
    status: "brouillon", // jamais visible sur le portail public
    seo_description: `Organisation de démonstration Casa Minga (${archetype}).`,
  }, { onConflict: "organization_id" });

  // 3. Seeder spécifique à l'archétype
  if (archetype === "tiers-lieu") await seedTiersLieu(admin, orgId);
  if (archetype === "association") await seedAssociation(admin, orgId);
  if (archetype === "coworking") await seedCoworking(admin, orgId);

  return { ok: true, orgId };
}

// ─── Suppression des données d'une org démo ────────────────────────────────────

async function deleteDemoOrgData(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  if (!admin) return;
  // Supprimer dans l'ordre pour respecter les FK
  const tables = [
    "membership_applications", "membership_tiers", "membership_campaigns",
    "event_registrations", "evenements",
    "reservations", "spaces",
    "transactions", "cash_entries",
    "invoices", "invoice_settings",
    "persons", "tasks", "announcements",
    "community_posts", "documents",
    "governance_meetings", "governance_mandates",
    "partners", "impact_indicators",
    "residences", "artists",
    "grants", "grant_applications",
    "public_sites", "newsletter_campaigns", "newsletter_settings",
    "organization_modules", "organization_members",
  ];
  for (const t of tables) {
    await admin.from(t).delete().eq("organization_id", orgId);
  }
}

export async function resetDemoOrg(archetype: DemoArchetype): Promise<{ ok: boolean; error?: string }> {
  const res = await seedDemoOrg(archetype);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function deleteDemoOrg(orgId: string): Promise<{ ok: boolean }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false };
  await deleteDemoOrgData(admin, orgId);
  await admin.from("organizations").delete().eq("id", orgId).eq("is_demo", true);
  return { ok: true };
}

// ─── Seed Tiers-lieu ──────────────────────────────────────────────────────────

async function seedTiersLieu(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  if (!admin) return;

  // Espaces
  const space1 = uuid(), space2 = uuid(), space3 = uuid();
  await admin.from("spaces").insert([
    { id: space1, organization_id: orgId, name: "Grande salle", type: "salle", capacity: 60, price_hour: 25, description: "Salle polyvalente avec scène, sono et vidéoprojecteur.", status: "disponible", photos: [], area: 120 },
    { id: space2, organization_id: orgId, name: "Atelier créatif", type: "atelier", capacity: 15, price_hour: 12, description: "Atelier équipé pour arts plastiques et créatifs.", status: "disponible", photos: [], area: 40 },
    { id: space3, organization_id: orgId, name: "Salle de réunion", type: "bureau", capacity: 10, price_hour: 8, description: "Espace de travail collectif et réunions.", status: "disponible", photos: [], area: 25 },
  ]);

  // Personnes
  const p1 = uuid(), p2 = uuid(), p3 = uuid(), p4 = uuid();
  await admin.from("persons").insert([
    { id: p1, organization_id: orgId, name: "Camille Aubry", email: "camille@demo.exemple", phone: "+33 6 11 22 33 44", role: "admin", status: "actif", tags: ["bénévole"], notes: null },
    { id: p2, organization_id: orgId, name: "Sofiane Merabet", email: "sofiane@demo.exemple", phone: null, role: "benevole", status: "actif", tags: [], notes: null },
    { id: p3, organization_id: orgId, name: "Marie Leconte", email: "marie@demo.exemple", phone: "+33 6 55 66 77 88", role: "coord", status: "actif", tags: ["artiste"], notes: null },
    { id: p4, organization_id: orgId, name: "Jean-Pierre Dumas", email: null, phone: null, role: "benevole", status: "inactif", tags: [], notes: "Ancien bénévole" },
  ]);

  // Événements
  await admin.from("evenements").insert([
    { id: uuid(), organization_id: orgId, space_id: space1, title: "Atelier sérigraphie ouverte", type: "atelier", status: "publie", start_at: daysFromNow(7), end_at: daysFromNow(7), capacity: 12, price: 5, description: "Initiez-vous à la sérigraphie avec nos artistes résidents.", photos: [] },
    { id: uuid(), organization_id: orgId, space_id: space1, title: "Concert acoustique — Les Traversées", type: "concert", status: "publie", start_at: daysFromNow(14), end_at: daysFromNow(14), capacity: 50, price: 8, description: "Soirée musicale intimiste, entrée libre aux adhérents.", photos: [] },
    { id: uuid(), organization_id: orgId, space_id: space2, title: "Marché des créateurs", type: "marche", status: "publie", start_at: daysFromNow(21), end_at: daysFromNow(21), capacity: null, price: 0, description: "30 créateurs locaux exposent et vendent leurs productions.", photos: [] },
    { id: uuid(), organization_id: orgId, space_id: space3, title: "AG annuelle 2026", type: "autre", status: "publie", start_at: daysFromNow(30), end_at: daysFromNow(30), capacity: 40, price: 0, description: "Assemblée générale — bilan, projets et élections du bureau.", photos: [] },
  ]);

  // Réservations
  await admin.from("reservations").insert([
    { id: uuid(), organization_id: orgId, space_id: space1, person_id: p1, title: "Répétition Cie L'Envol", start_at: daysFromNow(3), end_at: daysFromNow(3), status: "confirmee", price: 50, notes: null },
    { id: uuid(), organization_id: orgId, space_id: space3, person_id: p2, title: "Réunion association voisins", start_at: daysFromNow(5), end_at: daysFromNow(5), status: "demandee", price: 16, notes: null },
  ]);

  // Campagne d'adhésion
  const campId = uuid(), tier1 = uuid(), tier2 = uuid(), tier3 = uuid();
  await admin.from("membership_campaigns").insert({
    id: campId, organization_id: orgId, title: "Adhésion 2026", slug: `adhesion-2026-${orgId.slice(0, 8)}`,
    description: "Devenez membre de La Friche Commune et soutenez notre projet.", status: "publie",
    period_type: "personnalisee", period_start: dateStr(0), period_end: dateStr(365),
    max_members: null, allow_donation: true, donation_amounts: ["10", "20", "50"],
    show_member_count: true, show_collected: false, generate_cards: false, photos: [],
  });
  await admin.from("membership_tiers").insert([
    { id: tier1, campaign_id: campId, organization_id: orgId, name: "Tarif solidaire", description: "Pour celles et ceux qui ont peu de moyens.", amount: 5, sort_order: 0 },
    { id: tier2, campaign_id: campId, organization_id: orgId, name: "Membre actif", description: "Tarif standard avec droit de vote.", amount: 20, sort_order: 1 },
    { id: tier3, campaign_id: campId, organization_id: orgId, name: "Membre soutien", description: "Soutien renforcé au projet.", amount: 50, sort_order: 2 },
  ]);

  // Transactions
  await admin.from("transactions").insert([
    { id: uuid(), organization_id: orgId, type: "recette", category: "adhesion", amount: 20, label: "Adhésion Camille Aubry", date: dateStr(-10), notes: null },
    { id: uuid(), organization_id: orgId, type: "recette", category: "location", amount: 50, label: "Location salle — Cie L'Envol", date: dateStr(-5), notes: null },
    { id: uuid(), organization_id: orgId, type: "depense", category: "fonctionnement", amount: 35, label: "Fournitures atelier", date: dateStr(-3), notes: null },
  ]);

  // Tâches
  await admin.from("tasks").insert([
    { id: uuid(), organization_id: orgId, title: "Préparer programme juillet", description: "Finaliser la grille événementielle du mois de juillet.", status: "a_faire", priority: "haute", due_date: dateStr(10), assignee_id: null },
    { id: uuid(), organization_id: orgId, title: "Renouveler assurance", description: "Contacter le courtier avant fin du mois.", status: "en_cours", priority: "normale", due_date: dateStr(7), assignee_id: null },
  ]);

  // Annonce
  await admin.from("announcements").insert({
    id: uuid(), organization_id: orgId,
    title: "Bienvenue sur le tableau de bord de démonstration",
    content: "Vous explorez La Friche Commune, une organisation de démonstration Casa Minga. Toutes les données sont fictives.",
    status: "publie", audience: "membres",
  });
}

// ─── Seed Association ─────────────────────────────────────────────────────────

async function seedAssociation(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  if (!admin) return;

  // Personnes
  const p1 = uuid(), p2 = uuid(), p3 = uuid();
  await admin.from("persons").insert([
    { id: p1, organization_id: orgId, name: "Fatima Benali", email: "fatima@demo.exemple", phone: "+33 6 00 11 22 33", role: "admin", status: "actif", tags: ["bureau"], notes: null },
    { id: p2, organization_id: orgId, name: "Théo Garnier", email: "theo@demo.exemple", phone: null, role: "finance", status: "actif", tags: ["tresorier"], notes: null },
    { id: p3, organization_id: orgId, name: "Rosa Martins", email: "rosa@demo.exemple", phone: null, role: "benevole", status: "actif", tags: [], notes: null },
  ]);

  // Événements
  await admin.from("evenements").insert([
    { id: uuid(), organization_id: orgId, space_id: null, title: "Repas de quartier — édition été", type: "autre", status: "publie", start_at: daysFromNow(10), end_at: daysFromNow(10), capacity: 80, price: 0, description: "Grande tablée conviviale, apportez un plat à partager !", photos: [] },
    { id: uuid(), organization_id: orgId, space_id: null, title: "Atelier numérique seniors", type: "atelier", status: "publie", start_at: daysFromNow(5), end_at: daysFromNow(5), capacity: 10, price: 0, description: "Initiation smartphone et réseaux sociaux.", photos: [] },
  ]);

  // Campagne
  const campId = uuid(), tier1 = uuid(), tier2 = uuid();
  await admin.from("membership_campaigns").insert({
    id: campId, organization_id: orgId, title: "Adhésion annuelle 2026", slug: `adhesion-asso-${orgId.slice(0, 8)}`,
    description: "Rejoignez Les Amis du Quartier et participez aux décisions.", status: "publie",
    period_type: "annee_glissante", period_start: null, period_end: null,
    max_members: null, allow_donation: false, donation_amounts: [],
    show_member_count: true, show_collected: false, generate_cards: true, photos: [],
  });
  await admin.from("membership_tiers").insert([
    { id: tier1, campaign_id: campId, organization_id: orgId, name: "Adhésion individuelle", amount: 10, sort_order: 0 },
    { id: tier2, campaign_id: campId, organization_id: orgId, name: "Adhésion famille", amount: 20, sort_order: 1 },
  ]);

  // Finances
  await admin.from("transactions").insert([
    { id: uuid(), organization_id: orgId, type: "recette", category: "adhesion", amount: 10, label: "Adhésion Fatima Benali", date: dateStr(-20), notes: null },
    { id: uuid(), organization_id: orgId, type: "recette", category: "subvention", amount: 500, label: "Subvention mairie — animations", date: dateStr(-15), notes: null },
    { id: uuid(), organization_id: orgId, type: "depense", category: "fonctionnement", amount: 80, label: "Matériel animation jeunesse", date: dateStr(-5), notes: null },
  ]);

  // Tâches
  await admin.from("tasks").insert([
    { id: uuid(), organization_id: orgId, title: "Envoyer CR AG aux membres", status: "a_faire", priority: "haute", due_date: dateStr(3), assignee_id: null },
    { id: uuid(), organization_id: orgId, title: "Renouveler déclaration en préfecture", status: "en_cours", priority: "normale", due_date: dateStr(20), assignee_id: null },
  ]);

  await admin.from("announcements").insert({
    id: uuid(), organization_id: orgId,
    title: "Bienvenue sur la démo Association",
    content: "Vous explorez Les Amis du Quartier, une organisation de démonstration Casa Minga. Données fictives.",
    status: "publie", audience: "membres",
  });
}

// ─── Seed Coworking ───────────────────────────────────────────────────────────

async function seedCoworking(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  if (!admin) return;

  // Espaces
  const sp1 = uuid(), sp2 = uuid(), sp3 = uuid();
  await admin.from("spaces").insert([
    { id: sp1, organization_id: orgId, name: "Open space", type: "bureau", capacity: 20, price_hour: 5, price_day: 25, description: "Postes nomades en open space, wifi haut débit.", status: "disponible", photos: [], area: 80 },
    { id: sp2, organization_id: orgId, name: "Bureau privé", type: "bureau", capacity: 4, price_hour: 15, price_day: 60, description: "Bureau fermé pour travail concentré ou appels.", status: "disponible", photos: [], area: 18 },
    { id: sp3, organization_id: orgId, name: "Salle de réunion", type: "salle", capacity: 8, price_hour: 20, description: "Écran interactif, visioconférence intégrée.", status: "disponible", photos: [], area: 22 },
  ]);

  // Personnes (coworkers)
  const p1 = uuid(), p2 = uuid(), p3 = uuid();
  await admin.from("persons").insert([
    { id: p1, organization_id: orgId, name: "Alex Dumont", email: "alex@demo.exemple", phone: "+33 7 00 11 22 33", role: "admin", status: "actif", tags: ["coworker"], notes: null },
    { id: p2, organization_id: orgId, name: "Clara Ventura", email: "clara@demo.exemple", phone: null, role: "benevole", status: "actif", tags: ["coworker", "abonnement-mensuel"], notes: null },
    { id: p3, organization_id: orgId, name: "Mehdi Saïd", email: null, phone: null, role: "benevole", status: "actif", tags: ["coworker"], notes: "Abonnement journalier" },
  ]);

  // Réservations
  await admin.from("reservations").insert([
    { id: uuid(), organization_id: orgId, space_id: sp3, person_id: p1, title: "Réunion client", start_at: daysFromNow(2), end_at: daysFromNow(2), status: "confirmee", price: 40, notes: null },
    { id: uuid(), organization_id: orgId, space_id: sp2, person_id: p2, title: "Clara — Bureau privé journée", start_at: daysFromNow(1), end_at: daysFromNow(1), status: "confirmee", price: 60, notes: null },
    { id: uuid(), organization_id: orgId, space_id: sp1, person_id: p3, title: "Open space — Mehdi", start_at: daysFromNow(3), end_at: daysFromNow(3), status: "demandee", price: 25, notes: null },
  ]);

  // Finances
  await admin.from("transactions").insert([
    { id: uuid(), organization_id: orgId, type: "recette", category: "location", amount: 400, label: "Abonnement mensuel — Clara Ventura", date: dateStr(-5), notes: null },
    { id: uuid(), organization_id: orgId, type: "recette", category: "location", amount: 25, label: "Journée open space — Mehdi Saïd", date: dateStr(-3), notes: null },
    { id: uuid(), organization_id: orgId, type: "depense", category: "fonctionnement", amount: 120, label: "Fournitures bureau", date: dateStr(-10), notes: null },
    { id: uuid(), organization_id: orgId, type: "depense", category: "fonctionnement", amount: 89, label: "Cafétéria — réapprovisionnement", date: dateStr(-2), notes: null },
  ]);

  // Tâches
  await admin.from("tasks").insert([
    { id: uuid(), organization_id: orgId, title: "Renouveler contrat internet fibre", status: "a_faire", priority: "haute", due_date: dateStr(15), assignee_id: null },
    { id: uuid(), organization_id: orgId, title: "Facturer abonnements du mois", status: "en_cours", priority: "normale", due_date: dateStr(5), assignee_id: null },
  ]);

  await admin.from("announcements").insert({
    id: uuid(), organization_id: orgId,
    title: "Bienvenue sur la démo Coworking",
    content: "Vous explorez L'Atelier Partagé, une organisation de démonstration Casa Minga. Données fictives.",
    status: "publie", audience: "membres",
  });
}
