import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationBySlug } from "@/lib/data";
import { isSuperAdminEmail } from "@/lib/admin/guard";
import { createConnectedAccount, createOnboardingLink, isStripeConfigured } from "@/lib/stripe";

/**
 * Démarre (ou reprend) l'onboarding Stripe Connect d'une organisation.
 * GET /api/orgs/[slug]/stripe/connect
 * Réservé aux membres admin de l'org (ou super-admin).
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const paramsUrl = (s: string) => `${base}/dashboard/${slug}/parametres?stripe=${s}`;

  if (!isStripeConfigured()) return NextResponse.redirect(paramsUrl("unconfigured"));

  const org = await getOrganizationBySlug(slug);
  if (!org) return NextResponse.redirect(paramsUrl("error"));

  // ── Auth : membre admin de l'org, ou super-admin ──
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${base}/login?redirect=/dashboard/${slug}/parametres`);

  if (!isSuperAdminEmail(user.email)) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .eq("status", "actif")
      .maybeSingle();
    if (!membership || membership.role !== "admin") {
      return NextResponse.redirect(paramsUrl("forbidden"));
    }
  }

  // ── Compte connecté : créer si absent ──
  let accountId = org.stripe_account_id ?? null;
  if (!accountId) {
    accountId = await createConnectedAccount(org.email);
    if (!accountId) return NextResponse.redirect(paramsUrl("error"));
    await supabase.from("organizations").update({ stripe_account_id: accountId }).eq("id", org.id);
  }

  // ── Lien d'onboarding hébergé Stripe ──
  const url = await createOnboardingLink(
    accountId,
    `${base}/api/orgs/${slug}/stripe/connect`,
    `${base}/api/orgs/${slug}/stripe/return`
  );
  if (!url) return NextResponse.redirect(paramsUrl("error"));
  return NextResponse.redirect(url);
}
