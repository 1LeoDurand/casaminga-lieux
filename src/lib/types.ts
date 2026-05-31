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
}

export interface PublicSite {
  organization_id: string;
  slug: string;
  title: string;
  status: "brouillon" | "publie";
  seo_description: string | null;
}
