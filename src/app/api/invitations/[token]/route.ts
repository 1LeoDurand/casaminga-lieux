import { createClient as createServiceClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !serviceRoleKey) {
    return NextResponse.json({ valid: false, reason: "Configuration manquante." });
  }

  const admin = createServiceClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: inv } = await admin
    .from("invitations")
    .select("email, organization_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!inv) return NextResponse.json({ valid: false, reason: "Lien d'invitation introuvable." });
  if (inv.used_at) return NextResponse.json({ valid: false, reason: "Ce lien a déjà été utilisé." });
  if (new Date(inv.expires_at) < new Date()) return NextResponse.json({ valid: false, reason: "Ce lien a expiré." });

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", inv.organization_id)
    .single();

  return NextResponse.json({
    valid: true,
    email: inv.email,
    orgName: org?.name ?? "votre espace",
  });
}
