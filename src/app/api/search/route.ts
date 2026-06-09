import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface SearchHit {
  type: "personne" | "event" | "facture" | "document" | "reservation";
  id: string;
  label: string;
  sublabel?: string;
  href: string;
}

/**
 * GET /api/search?q=...&org=<slug>
 * Recherche cross-modules pour la barre de recherche topbar.
 * Limite à 5 résultats par catégorie, 20 au total.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const org = searchParams.get("org") ?? "";

  if (!q || q.length < 2 || !org) {
    return NextResponse.json({ hits: [] });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ hits: [] });
  }

  const supabase = await createClient();

  // Récupérer l'orgId depuis le slug
  const { data: orgData } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", org)
    .maybeSingle();
  if (!orgData) return NextResponse.json({ hits: [] });
  const orgId = orgData.id;

  const like = `%${q}%`;
  const hits: SearchHit[] = [];

  const [persons, events, invoices, docs, reservations] = await Promise.all([
    supabase.from("persons").select("id,name,email,role").eq("organization_id", orgId).ilike("name", like).limit(5),
    supabase.from("evenements").select("id,title,start_date").eq("organization_id", orgId).ilike("title", like).limit(5),
    supabase.from("invoices").select("id,number,client_name,status").eq("organization_id", orgId)
      .or(`client_name.ilike.${like},number.ilike.${like},reference.ilike.${like}`).limit(5),
    supabase.from("documents").select("id,file_name,created_at").eq("organization_id", orgId).ilike("file_name", like).limit(5),
    supabase.from("reservations").select("id,title,status").eq("organization_id", orgId).ilike("title", like).limit(5),
  ]);

  for (const p of persons.data ?? []) {
    hits.push({ type: "personne", id: p.id, label: p.name, sublabel: p.email ?? p.role, href: `/dashboard/${org}/personnes?focus=${p.id}` });
  }
  for (const e of events.data ?? []) {
    const d = e.start_date ? new Date(e.start_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "";
    hits.push({ type: "event", id: e.id, label: e.title, sublabel: d, href: `/dashboard/${org}/evenements` });
  }
  for (const inv of invoices.data ?? []) {
    hits.push({ type: "facture", id: inv.id, label: inv.number ?? inv.client_name, sublabel: inv.client_name, href: `/dashboard/${org}/factures/${inv.id}` });
  }
  for (const doc of docs.data ?? []) {
    hits.push({ type: "document", id: doc.id, label: doc.file_name ?? "Document", sublabel: "", href: `/dashboard/${org}/documents` });
  }
  for (const res of reservations.data ?? []) {
    hits.push({ type: "reservation", id: res.id, label: res.title ?? "Réservation", sublabel: res.status, href: `/dashboard/${org}/reservations` });
  }

  return NextResponse.json({ hits: hits.slice(0, 20) });
}
