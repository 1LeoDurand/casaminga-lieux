import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationBySlug } from "@/lib/data";
import { accountChargesEnabled } from "@/lib/stripe";

/**
 * Retour d'onboarding Stripe Connect : on vérifie si le compte peut encaisser
 * et on met à jour l'organisation, puis on revient aux Paramètres.
 * GET /api/orgs/[slug]/stripe/return
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  const org = await getOrganizationBySlug(slug);
  if (org?.stripe_account_id) {
    const enabled = await accountChargesEnabled(org.stripe_account_id);
    const supabase = await createClient();
    await supabase
      .from("organizations")
      .update({
        stripe_charges_enabled: enabled,
        stripe_connected_at: enabled ? new Date().toISOString() : org.stripe_connected_at ?? null,
      })
      .eq("id", org.id);
    return NextResponse.redirect(`${base}/dashboard/${slug}/parametres?stripe=${enabled ? "done" : "pending"}`);
  }
  return NextResponse.redirect(`${base}/dashboard/${slug}/parametres?stripe=error`);
}
