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

export interface IncomingRequest {
  id: string;
  organization_id: string;
  name: string | null;
  email: string | null;
  type: string | null;
  status: RequestStatus;
  priority: string;
  summary: string | null;
  message: string | null;
  received_at: string;
}

export interface PublicSite {
  organization_id: string;
  slug: string;
  title: string;
  status: "brouillon" | "publie";
  seo_description: string | null;
}
