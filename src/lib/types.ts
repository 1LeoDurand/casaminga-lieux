/** Types métier du socle (alignés sur la migration 0001_init_socle.sql). */

export type OrgRole =
  | "admin"
  | "coord"
  | "comm"
  | "finance"
  | "benevole"
  | "intervenant"
  | "readonly";

export interface Organization {
  id: string;
  slug: string;
  name: string;
  structure: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  hours: string | null;
  plan: string;
  primary_color: string;
  /** true = organisation de démonstration, exclue du portail public et des emails réels. */
  is_demo?: boolean;
  /** tiers-lieu | coworking | association | culturel | residence | autre */
  demo_archetype?: string | null;
  /** Archétype choisi à l'inscription — pilote la composition du dashboard. */
  org_type?: string | null;
  helloasso_client_id?: string | null;
  helloasso_client_secret?: string | null;
  helloasso_org_slug?: string | null;
  helloasso_connected_at?: string | null;
  /** Stripe Connect — encaissement des réservations par le lieu. */
  stripe_account_id?: string | null;
  stripe_connected_at?: string | null;
  stripe_charges_enabled?: boolean;
  /** Suivi séquence onboarding email — null = pas encore envoyé. */
  onboarding_j3_sent_at?: string | null;
  onboarding_j7_sent_at?: string | null;
}

export type RequestStatus =
  | "nouvelle"
  | "etudier"
  | "attente"
  | "validee"
  | "refusee"
  | "archivee";

export type RequestType =
  | "contact"
  | "residence"
  | "coworking"
  | "reservation"
  | "evenement"
  | "partenariat"
  | "benevolat"
  | "presse"
  | "autre";

export type RequestPriority = "haute" | "normale" | "basse";

export interface IncomingRequest {
  id: string;
  organization_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  organization_ext: string | null;
  type: string | null;
  status: RequestStatus;
  priority: string;
  summary: string | null;
  message: string | null;
  received_at: string;
}

export type PersonRole =
  | "membre"
  | "coworker"
  | "benevole"
  | "intervenant"
  | "resident"
  | "partenaire"
  | "equipe"
  | "prospect";

export type PersonStatus = "actif" | "inactif";

export interface Person {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: PersonStatus;
  tags: string[];
  notes: string | null;
  newsletter_opt_out?: boolean;
  unsubscribe_token?: string;
  anonymized_at?: string | null;
  anonymized_by?: string | null;
  created_at: string;
  updated_at: string;
}

export type SpaceType =
  | "salle"
  | "atelier"
  | "bureau"
  | "exterieur"
  | "commun";

export type SpaceStatus = "disponible" | "maintenance" | "masque";

export interface Space {
  id: string;
  organization_id: string;
  name: string;
  type: string;
  capacity: number | null;
  area: number | null;
  price_hour: number | null;
  price_day: number | null;
  description: string | null;
  photos: string[];
  status: SpaceStatus;
  establishment_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ReservationStatus =
  | "demandee"
  | "confirmee"
  | "terminee"
  | "annulee";

export interface Reservation {
  id: string;
  organization_id: string;
  space_id: string;
  person_id: string | null;
  title: string | null;
  start_at: string; // ISO (timestamptz)
  end_at: string; // ISO (timestamptz)
  status: ReservationStatus;
  price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Paiement en ligne (Stripe Connect — Lot A)
  payment_status?: ReservationPaymentStatus;
  stripe_session_id?: string | null;
  amount_paid?: number | null;
  paid_at?: string | null;
}

export type ReservationPaymentStatus = "none" | "pending" | "paid" | "refunded";

export type MembershipCampaignStatus = "brouillon" | "publie" | "prive" | "archive";
export type MembershipPeriodType = "annee_glissante" | "illimitee" | "personnalisee";
export type MembershipApplicationStatus = "en_attente" | "confirmee" | "annulee";

export interface MembershipCampaign {
  id: string;
  organization_id: string;
  title: string;
  slug: string;
  description: string | null;
  status: MembershipCampaignStatus;
  period_type: MembershipPeriodType;
  period_start: string | null;
  period_end: string | null;
  max_members: number | null;
  allow_donation: boolean;
  donation_amounts: string[];
  show_member_count: boolean;
  show_collected: boolean;
  generate_cards: boolean;
  photos: string[];
  created_at: string;
  updated_at: string;
}

export interface MembershipTier {
  id: string;
  campaign_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  amount: number;
  sort_order: number;
  created_at: string;
}

export interface MembershipApplication {
  id: string;
  campaign_id: string;
  tier_id: string | null;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  payer_name: string | null;
  payer_email: string | null;
  amount_paid: number;
  donation_amount: number | null;
  status: MembershipApplicationStatus;
  membership_start: string | null;
  membership_end: string | null;
  notes: string | null;
  payment_method?: string | null; // cheque | virement | especes | en_ligne | exonere
  payment_ref?: string | null;
  created_at: string;
  updated_at: string;
}

export type AutomationTrigger = "demande_recue" | "resa_creee" | "facture_impayee" | "evenement_proche" | "manuel";
export type AutomationAction = "notification" | "email" | "tache" | "statut";

export interface Automation {
  id: string;
  organization_id: string;
  name: string;
  trigger_type: AutomationTrigger;
  condition: string | null;
  action_type: AutomationAction;
  action_detail: string | null;
  active: boolean;
  last_run_at: string | null;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export type ImpactCategory = "frequentation" | "diversite" | "environnement" | "economie" | "autre";

export interface ImpactIndicator {
  id: string;
  organization_id: string;
  label: string;
  value: number;
  unit: string | null;
  period: string | null;
  category: ImpactCategory;
  created_at: string;
  updated_at: string;
}

export type PartnerType = "public" | "prive" | "associatif" | "fondation" | "autre";
export type PartnerStatus = "actif" | "prospect" | "inactif";

export interface Partner {
  id: string;
  organization_id: string;
  contact_id: string | null;
  name: string;
  type: PartnerType;
  status: PartnerStatus;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type MeetingType = "ca" | "ag" | "bureau" | "autre";
export type MeetingStatus = "planifiee" | "tenue" | "annulee";

export interface Meeting {
  id: string;
  organization_id: string;
  type: MeetingType;
  title: string;
  date: string;
  agenda: string | null;
  minutes: string | null;
  status: MeetingStatus;
  is_general_assembly: boolean;
  quorum: number | null;
  created_at: string;
  updated_at: string;
}

export interface AssemblyProxy {
  id: string;
  organization_id: string;
  meeting_id: string;
  giver_person_id: string;
  holder_person_id: string | null;
  created_at: string;
}

export interface AssemblyAttendance {
  id: string;
  organization_id: string;
  meeting_id: string;
  person_id: string;
  present: boolean;
  checked_in_at: string;
}

export type MandateStatus = "actif" | "termine";

export interface Mandate {
  id: string;
  organization_id: string;
  person_id: string | null;
  role: string;
  start_date: string | null;
  end_date: string | null;
  status: MandateStatus;
  created_at: string;
  updated_at: string;
}

export type CommunityType = "offre" | "demande" | "info" | "entraide";
export type CommunityStatus = "actif" | "resolu" | "archive";

export interface CommunityPost {
  id: string;
  organization_id: string;
  author_id: string | null;
  type: CommunityType;
  title: string;
  content: string;
  status: CommunityStatus;
  establishment_id: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskPriority = "haute" | "normale" | "basse";
export type TaskStatus = "a_faire" | "en_cours" | "fait";

export interface Task {
  id: string;
  organization_id: string;
  assignee_id: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  related_label: string | null;
  created_at: string;
  updated_at: string;
  // Notification / validation de l'assigné (ticket 608af0d2)
  assignee_notified_at: string | null;
  last_reminder_at: string | null;
  validation_token: string | null;
  validated_at: string | null;
}

// ── Subventions ───────────────────────────────────────────────
export type GrantFunderType = "public" | "prive" | "fondation" | "europe";
export type GrantStatus =
  | "candidature"
  | "accordee"
  | "en_cours"
  | "solde"
  | "refuse"
  | "annule";

export interface Grant {
  id: string;
  organization_id: string;
  title: string;
  funder: string;
  funder_type: GrantFunderType;
  amount: number;
  amount_received: number;
  start_date: string | null;
  end_date: string | null;
  status: GrantStatus;
  convention_ref: string | null;
  description: string | null;
  reporting_due_date: string | null;
  kpi_beneficiaires: number | null;
  kpi_heures: number | null;
  kpi_artistes: number | null;
  kpi_evenements: number | null;
  kpi_note: string | null;
  created_at: string;
  updated_at: string;
}

// ── Équipe / membres de l'organisation ────────────────────────
export type TeamMemberStatus = "actif" | "invite" | "suspendu";

export interface TeamMember {
  user_id: string;
  organization_id: string;
  role: OrgRole;
  zones: string[];
  status: string;
  created_at: string;
  full_name: string | null;
  email: string | null;
  // Permissions granulaires
  perm_pilotage: boolean;
  perm_gestion_lieu: boolean;
  perm_structure: boolean;
  perm_publication: boolean;
  perm_systeme: boolean;
}

export type GrantTrancheStatus = "en_attente" | "recu" | "en_retard";

export interface GrantTranche {
  id: string;
  grant_id: string;
  label: string;
  amount: number;
  due_date: string | null;
  received_date: string | null;
  status: GrantTrancheStatus;
  created_at: string;
}

// ── Caisse certifiée (loi anti-fraude TVA / NF525) ────────────
export type CashPaymentMethod =
  | "especes" | "cb" | "cheque" | "virement" | "helloasso" | "autre";
export type CashSource =
  | "adhesion" | "billetterie" | "buvette" | "don" | "boutique" | "autre";
export type CashClosureType = "jour" | "mois" | "annee";

export interface CashEntry {
  id: string;
  organization_id: string;
  seq: number;
  ticket_ref: string;
  occurred_at: string;
  label: string;
  amount_ttc: number;
  vat_rate: number;
  amount_ht: number;
  amount_vat: number;
  payment_method: CashPaymentMethod;
  source: CashSource;
  source_ref: string | null;
  operator: string;
  is_void: boolean;
  voids_seq: number | null;
  prev_hash: string;
  entry_hash: string;
  pole_id: string | null;
  person_id: string | null;
  created_at: string;
}

export interface CashShortcut {
  label: string;        // Nom du bouton (ex. "Adhésion 20€")
  emoji: string;        // Emoji affiché sur le bouton
  designation: string;  // Pré-remplit le champ "Libellé"
  amount_ttc: string;   // Montant TTC pré-rempli ("" = saisie libre)
  vat_rate: string;     // "0" | "5.5" | "10" | "20"
  payment_method: CashPaymentMethod;
  source: CashSource;
}

export interface CashVatLine {
  rate: number;
  ht: number;
  vat: number;
  ttc: number;
}

export interface CashClosure {
  id: string;
  organization_id: string;
  seq: number;
  closure_type: CashClosureType;
  period_label: string;
  period_start: string;
  period_end: string;
  first_entry_seq: number | null;
  last_entry_seq: number | null;
  entry_count: number;
  total_ttc: number;
  total_ht: number;
  total_vat: number;
  vat_breakdown: CashVatLine[];
  perpetual_total_ttc: number;
  operator: string;
  closed_at: string;
  prev_hash: string;
  closure_hash: string;
  // Fond de caisse (Lot B)
  opening_float: number | null;
  counted_cash: number | null;
  expected_cash: number | null;
  variance: number | null;
}

export interface CashVerifyResult {
  ok: boolean;
  entries_checked: number;
  first_broken_seq: number | null;
  verified_at: string;
}

export type MediaType = "photo" | "video" | "audio" | "document";

export interface Media {
  id: string;
  organization_id: string;
  title: string;
  type: MediaType;
  url: string;
  thumbnail_url: string | null;
  alt_text: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export type AnnouncementStatus = "brouillon" | "publie" | "archive";
export type AnnouncementAudience = "membres" | "public" | "tous";

export interface Announcement {
  id: string;
  organization_id: string;
  title: string;
  content: string;
  status: AnnouncementStatus;
  audience: AnnouncementAudience;
  created_at: string;
  updated_at: string;
}

export type TransactionType = "recette" | "depense";
export type TransactionStatus = "en_attente" | "validee" | "annulee";

export interface Transaction {
  id: string;
  organization_id: string;
  person_id: string | null;
  type: TransactionType;
  category: string;
  amount: number;
  date: string;
  label: string;
  status: TransactionStatus;
  notes: string | null;
  cash_closure_id: string | null;
  created_at: string;
  updated_at: string;
}

export type DocumentType = "contrat" | "devis" | "facture" | "convention" | "rapport" | "autre";
export type DocumentStatus = "brouillon" | "envoye" | "signe" | "archive";

export interface Document {
  id: string;
  organization_id: string;
  person_id: string | null;
  title: string;
  type: string;
  status: DocumentStatus;
  file_url: string | null;
  file_name: string | null;
  notes: string | null;
  signing_token: string | null;
  signed_at: string | null;
  signer_ip: string | null;
  created_at: string;
  updated_at: string;
}

// ── Gouvernance — résolutions ─────────────────────────────────
export type ResolutionResult = "adopte" | "rejete" | "ajourne";

export interface MeetingResolution {
  id: string;
  meeting_id: string;
  organization_id: string;
  title: string;
  description: string | null;
  result: ResolutionResult;
  votes_pour: number;
  votes_contre: number;
  votes_abstention: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ResidenceDiscipline =
  | "ceramique" | "peinture" | "musique" | "danse"
  | "theatre" | "litterature" | "numerique" | "autre";

export type ResidenceStatus =
  | "candidature" | "acceptee" | "en_cours" | "terminee" | "refusee";

export interface Residence {
  id: string;
  organization_id: string;
  space_id: string | null;
  person_id: string | null;
  artist_id: string | null;
  title: string;
  discipline: string;
  status: ResidenceStatus;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  notes: string | null;
  budget: number | null;
  logement_fourni: boolean;
  logement_notes: string | null;
  convention_signee: boolean;
  convention_date: string | null;
  restitution_date: string | null;
  restitution_status: "non_prevu" | "planifiee" | "realisee" | "annulee";
  projet_description: string | null;
  created_at: string;
  updated_at: string;
}

// ── Artistes ──────────────────────────────────────────────────
export type ArtistStatus = "actif" | "inactif" | "prospect";

export interface Artist {
  id: string;
  organization_id: string;
  name: string;
  discipline: string;
  bio: string | null;
  portfolio_url: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  origin_city: string | null;
  nationality: string | null;
  instagram: string | null;
  tags: string[];
  photo_url: string | null;
  status: ArtistStatus;
  created_at: string;
  updated_at: string;
}

export type MilestoneStatus = "a_faire" | "en_cours" | "fait";

export interface ArtistMilestone {
  id: string;
  residence_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  done_at: string | null;
  status: MilestoneStatus;
  created_at: string;
}

export type EvenementType =
  | "atelier"
  | "concert"
  | "exposition"
  | "conference"
  | "marche"
  | "autre";

export type EvenementStatus = "brouillon" | "publie" | "annule";

export interface Evenement {
  id: string;
  organization_id: string;
  space_id: string | null;
  title: string;
  type: string;
  status: EvenementStatus;
  start_at: string;
  end_at: string;
  capacity: number | null;
  price: number | null;
  description: string | null;
  photos: string[];
  show_on_public_site: boolean;
  establishment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Establishment {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  siret: string | null;
  description: string | null;
  is_primary: boolean;
  active: boolean;
  position: number;
  created_at: string;
  // Modération admin (ticket c30a1369)
  public_site_status?: ModerationStatus;
  portal_status?: ModerationStatus;
}

export type ModerationStatus = "pending" | "approved" | "rejected";

export type PoleType = "operationnel" | "support";

export interface Pole {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  description: string | null;
  active: boolean;
  position: number;
  type: PoleType;
  created_at: string;
  // Rattachement à un lieu (null = commun à la structure) — ticket 0d7a9a45
  establishment_id?: string | null;
}

export type ExpenseCategory =
  | "loyer"
  | "fournitures"
  | "salaires"
  | "services"
  | "deplacement"
  | "communication"
  | "materiel"
  | "autre";

export interface Expense {
  id: string;
  organization_id: string;
  label: string;
  amount_ttc: number;
  vat_applicable: boolean;
  vat_amount: number | null;
  category: ExpenseCategory | null;
  supplier_name: string | null;
  supplier_person_id: string | null;
  pole_id: string | null;
  payment_method: string | null;
  paid_at: string | null;
  receipt_url: string | null;
  notes: string | null;
  spent_at: string;
  created_at: string;
}

export interface PublicSite {
  organization_id: string;
  slug: string;
  title: string;
  status: "brouillon" | "publie";
  seo_description: string | null;
}

// ── Dons & mécénat (Lot 16) ───────────────────────────────────────────────
export type DonationType = "ponctuel" | "recurrent" | "nature" | "mecenat";
export type DonationPaymentStatus = "confirme" | "en_attente";
export type DonationCampaignStatus = "brouillon" | "active" | "terminee";

export interface DonationCampaign {
  id: string;
  organization_id: string;
  title: string;
  slug: string;
  description: string | null;
  goal_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  status: DonationCampaignStatus;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Donation {
  id: string;
  organization_id: string;
  donor_name: string;
  donor_person_id: string | null;
  donor_email: string | null;
  donor_address: string | null;
  amount: number;
  donation_type: DonationType;
  received_at: string;
  payment_method: string | null;
  payment_status: DonationPaymentStatus;
  campaign_id: string | null;
  pole_id: string | null;
  tax_receipt_issued: boolean;
  tax_receipt_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Contrats & échéances (Lot 17) ─────────────────────────────────────────
export type ContractType =
  | "assurance" | "bail" | "convention" | "prestation"
  | "mission" | "partenariat" | "abonnement" | "autre";
export type ContractPeriod = "mensuel" | "annuel" | "ponctuel";
export type ContractStatus =
  | "brouillon" | "en_negociation" | "actif" | "expire" | "resilie";

export interface Contract {
  id: string;
  organization_id: string;
  title: string;
  contract_type: ContractType;
  counterparty_name: string | null;
  counterparty_person_id: string | null;
  pole_id: string | null;
  amount: number | null;
  amount_period: ContractPeriod;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  auto_renew: boolean;
  notice_period_days: number | null;
  status: ContractStatus;
  document_id: string | null;
  signed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Inventaire & Matériel (Lot 15) ────────────────────────────────────────
export type AssetCategory =
  | "mobilier" | "informatique" | "son" | "lumiere" | "cuisine" | "outillage" | "autre";
export type AssetStatus = "disponible" | "en_pret" | "en_panne" | "maintenance" | "reforme";
export type AssetCondition = "neuf" | "bon" | "use" | "hs";
export type MaintenanceStatus = "a_faire" | "en_cours" | "fait";

export interface Asset {
  id: string;
  organization_id: string;
  name: string;
  category: AssetCategory;
  reference: string | null;
  location: string | null;
  pole_id: string | null;
  holder_person_id: string | null;
  status: AssetStatus;
  condition: AssetCondition;
  quantity: number;
  purchase_date: string | null;
  purchase_value: number | null;
  warranty_until: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetMaintenance {
  id: string;
  organization_id: string;
  asset_id: string | null;
  title: string;
  description: string | null;
  status: MaintenanceStatus;
  reported_at: string;
  due_date: string | null;
  done_at: string | null;
  cost: number | null;
  expense_id: string | null;
  assignee_person_id: string | null;
  created_at: string;
  updated_at: string;
}
