import type { DonationType, DonationCampaignStatus } from "@/lib/types";

export const DONATION_TYPES: { value: DonationType; label: string; emoji: string }[] = [
  { value: "ponctuel",  label: "Don ponctuel",      emoji: "💝" },
  { value: "recurrent", label: "Don récurrent",     emoji: "🔁" },
  { value: "nature",    label: "Don en nature",     emoji: "🎁" },
  { value: "mecenat",   label: "Mécénat entreprise", emoji: "🏢" },
];

export const CAMPAIGN_STATUSES: { value: DonationCampaignStatus; label: string }[] = [
  { value: "brouillon", label: "Brouillon" },
  { value: "active",    label: "Active" },
  { value: "terminee",  label: "Terminée" },
];

export function donationTypeLabel(t: string | null): string {
  if (!t) return "—";
  return DONATION_TYPES.find((d) => d.value === t)?.label ?? t;
}
export function donationTypeEmoji(t: string | null): string {
  if (!t) return "💝";
  return DONATION_TYPES.find((d) => d.value === t)?.emoji ?? "💝";
}
export function campaignStatusLabel(s: string | null): string {
  if (!s) return "—";
  return CAMPAIGN_STATUSES.find((c) => c.value === s)?.label ?? s;
}

export function fmtEuros(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Slugify pour les campagnes de dons (URL publique /soutenir/[slug]). */
export function slugifyCampaign(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "collecte";
}
