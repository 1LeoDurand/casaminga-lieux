/**
 * RGPD — Export des données personnelles d'une fiche CRM.
 * GET /dashboard/[org]/personnes/[id]/export
 *
 * Retourne un fichier JSON téléchargeable contenant toutes les données
 * personnelles stockées pour ce profil (conformément à l'art. 15 RGPD —
 * droit d'accès et de portabilité).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationBySlug } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ org: string; id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return new NextResponse("Service non disponible en mode démo", { status: 503 });
  }

  const { org, id } = await params;
  const organization = await getOrganizationBySlug(org);
  if (!organization) return new NextResponse("Organisation introuvable", { status: 404 });

  const supabase = await createClient();

  // Récupération de la fiche CRM
  const { data: person, error: personErr } = await supabase
    .from("persons")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (personErr || !person) {
    return new NextResponse("Personne introuvable", { status: 404 });
  }

  // Données financières liées (conservation légale — lecture seule)
  const [
    { data: transactions },
    { data: cashEntries },
    { data: membershipApps },
    { data: reservations },
    { data: invoices },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, type, category, amount, date, label, status, notes, created_at")
      .eq("organization_id", organization.id)
      .eq("person_id", id),
    supabase
      .from("cash_entries")
      .select("id, ticket_ref, label, amount_ttc, vat_rate, payment_method, source, occurred_at, seq")
      .eq("organization_id", organization.id)
      .eq("person_id", id),
    person.email
      ? supabase
          .from("membership_applications")
          .select("id, campaign_id, first_name, last_name, email, amount_paid, membership_start, membership_end, status, created_at")
          .eq("organization_id", organization.id)
          .eq("email", person.email)
      : Promise.resolve({ data: [] }),
    supabase
      .from("reservations")
      .select("id, space_id, title, start_at, end_at, status, created_at")
      .eq("organization_id", organization.id)
      .eq("person_id", id),
    supabase
      .from("invoices")
      .select("id, number, issue_date, due_date, status, total_ttc, payment_method, paid_at, object")
      .eq("organization_id", organization.id)
      .eq("client_id", id),
  ]);

  const exportPayload = {
    _meta: {
      export_type: "RGPD — Portabilité des données (art. 15 & 20)",
      exported_at: new Date().toISOString(),
      organization: organization.name,
      person_id: id,
    },
    donnees_personnelles: {
      id: person.id,
      nom: person.name,
      email: person.email,
      telephone: person.phone,
      role: person.role,
      statut: person.status,
      tags: person.tags,
      notes: person.notes,
      newsletter_opt_out: person.newsletter_opt_out ?? false,
      cree_le: person.created_at,
      mis_a_jour_le: person.updated_at,
      anonymise_le: person.anonymized_at ?? null,
    },
    adhesions: (membershipApps ?? []).map((a) => ({
      id: a.id,
      prenom: a.first_name,
      nom: a.last_name,
      email: a.email,
      montant_paye: a.amount_paid,
      debut: a.membership_start,
      fin: a.membership_end,
      statut: a.status,
      cree_le: a.created_at,
    })),
    factures: (invoices ?? []).map((i) => ({
      id: i.id,
      numero: i.number,
      objet: i.object,
      date_emission: i.issue_date,
      date_echeance: i.due_date,
      statut: i.status,
      total_ttc: i.total_ttc,
      paiement: i.payment_method,
      paye_le: i.paid_at,
    })),
    encaissements_caisse: (cashEntries ?? []).map((e) => ({
      id: e.id,
      reference: e.ticket_ref,
      libelle: e.label,
      montant_ttc: e.amount_ttc,
      tva: e.vat_rate,
      paiement: e.payment_method,
      nature: e.source,
      date: e.occurred_at,
    })),
    transactions_financieres: (transactions ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      categorie: t.category,
      montant: t.amount,
      date: t.date,
      libelle: t.label,
      statut: t.status,
      notes: t.notes,
    })),
    reservations: (reservations ?? []).map((r) => ({
      id: r.id,
      espace_id: r.space_id,
      titre: r.title,
      debut: r.start_at,
      fin: r.end_at,
      statut: r.status,
      cree_le: r.created_at,
    })),
  };

  const json = JSON.stringify(exportPayload, null, 2);
  const filename = `rgpd-export-${person.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
