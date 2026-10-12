import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/guard";
import { allowedOrigin, corsPreflight, withCors, type CorsOptions } from "@/lib/http/cors";
import { rateLimit } from "@/lib/rate-limit";
import { computeMembershipEnd } from "@/lib/adhesions-meta";
import { sendMail } from "@/lib/mail";
import { esc, tplAdhesionCandidat } from "@/lib/mail-templates";
import { notifyOrgAdmins } from "@/lib/portal/notify";
import { createCheckoutSession, isStripeConfigured } from "@/lib/stripe";
import {
  DUPLICATE_WINDOW_DAYS,
  MAX_REQUEST_BYTES,
  RATE_LIMIT_PER_EMAIL_PER_HOUR,
  RATE_LIMIT_PER_IP_PER_HOUR,
  RATE_WINDOW_MS,
  validateAdhesion,
} from "@/lib/adhesions/validate";

export const dynamic = "force-dynamic";

/**
 * Two legitimate callers, same pattern as /api/events/[id]/register: the admin
 * tunnel itself (same origin, no CORS header added, Stripe flow unchanged) and
 * casaminga.com (CORS). Any other origin gets a 403 before the body is read.
 */
const CORS: CorsOptions = { methods: ["POST"], headers: ["Content-Type"] };
const NO_STORE = { "Cache-Control": "no-store" };

export function OPTIONS(req: NextRequest) {
  return corsPreflight(req, CORS);
}

function clientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; campaignSlug: string }> }
) {
  const { slug, campaignSlug } = await params;

  const requestOrigin = req.headers.get("origin");
  const selfOrigin = new URL(req.url).origin;
  const isSameOrigin = requestOrigin === null || requestOrigin === selfOrigin;
  const publicOrigin = isSameOrigin ? null : allowedOrigin(req);

  if (!isSameOrigin && !publicOrigin) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403, headers: NO_STORE });
  }

  const respond = (body: Record<string, unknown>, status = 200) => {
    const res = NextResponse.json(body, { status, headers: NO_STORE });
    return publicOrigin ? withCors(req, res, CORS) : res;
  };
  // Generic refusal: never echo what was received, nor why it was refused.
  const badRequest = () => respond({ error: "Demande invalide." }, 400);

  // Refuse oversized bodies before request.json() buffers them. A missing or
  // non numeric Content-Length is refused too (no chunked uploads here).
  const contentLength = Number(req.headers.get("content-length"));
  if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_REQUEST_BYTES) {
    return badRequest();
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return badRequest();
    body = parsed as Record<string, unknown>;
  } catch {
    return badRequest();
  }

  const v = validateAdhesion(body);
  if (!v.ok) return badRequest();
  // Honeypot: neutral success, nothing written, no email.
  if (v.honeypot) return respond({ ok: true, mail_sent: true }, 201);
  const input = v.data;

  // casaminga.com does not handle the Stripe return yet: online payment is
  // refused there (same idea as rejectIfPaid for events).
  if (publicOrigin && input.online) return badRequest();

  const ip = clientIp(req);
  if (ip && !rateLimit(`adh-ip:${ip}`, RATE_LIMIT_PER_IP_PER_HOUR, RATE_WINDOW_MS)) {
    return respond({ error: "Trop de demandes. Réessayez plus tard." }, 429);
  }
  if (!rateLimit(`adh-mail:${input.email}`, RATE_LIMIT_PER_EMAIL_PER_HOUR, RATE_WINDOW_MS)) {
    return respond({ error: "Trop de demandes. Réessayez plus tard." }, 429);
  }

  const admin = createAdminClient();
  if (!admin) return respond({ error: "Service non configuré." }, 503);

  const { data: org } = await admin
    .from("organizations")
    .select("id, slug, name, email, stripe_account_id, stripe_charges_enabled")
    .eq("slug", slug)
    .maybeSingle();
  if (!org) return respond({ error: "Lieu introuvable." }, 404);

  // organization_id always comes from the campaign read server side, never from the body.
  const { data: campaign } = await admin
    .from("membership_campaigns")
    .select("id, organization_id, slug, period_type, period_end, allow_donation, max_members")
    .eq("organization_id", org.id)
    .eq("slug", campaignSlug)
    .eq("status", "publie")
    .maybeSingle();
  if (!campaign) return respond({ error: "Campagne d'adhésion indisponible." }, 404);

  const { data: tier } = await admin
    .from("membership_tiers")
    .select("id, name, amount")
    .eq("id", input.tier_id)
    .eq("campaign_id", campaign.id)
    .eq("organization_id", campaign.organization_id)
    .maybeSingle();
  if (!tier) return badRequest();

  if (input.donation_amount !== null && !campaign.allow_donation) return badRequest();

  // Duplicate: same campaign and email, pending or confirmed, recent. Same 201
  // as a success so the answer never reveals that someone is already a member.
  const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 86_400_000).toISOString();
  const { count: dupCount } = await admin
    .from("membership_applications")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .eq("email", input.email)
    .in("status", ["en_attente", "confirmee"])
    .gte("created_at", since);
  if ((dupCount ?? 0) > 0) return respond({ ok: true, mail_sent: true }, 201);

  if (campaign.max_members) {
    const { count: taken } = await admin
      .from("membership_applications")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .neq("status", "annulee");
    if ((taken ?? 0) >= campaign.max_members) {
      return respond({ error: "Les adhésions sont complètes." }, 409);
    }
  }

  const tierAmount = Number(tier.amount) || 0;
  const totalAmount = tierAmount + (input.donation_amount ?? 0);
  const membership_start = new Date().toISOString().slice(0, 10);
  const membership_end = computeMembershipEnd(campaign.period_type, membership_start, campaign.period_end);

  const { data: inserted, error: insertError } = await admin
    .from("membership_applications")
    .insert({
      campaign_id: campaign.id,
      tier_id: tier.id,
      organization_id: campaign.organization_id,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email,
      phone: input.phone,
      payer_name: input.payer_name ?? `${input.first_name} ${input.last_name}`,
      payer_email: input.payer_email ?? input.email,
      amount_paid: tierAmount,
      donation_amount: input.donation_amount,
      status: "en_attente",
      membership_start,
      membership_end,
      notes: null,
      payment_method: input.online ? "en_ligne" : null,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    console.error("adhesion insert failed:", insertError?.code);
    return respond({ error: "L'enregistrement a échoué. Réessayez." }, 500);
  }
  const adhesionId = inserted.id as string;

  // Online payment via Stripe Connect (venue account), admin tunnel only.
  if (input.online && totalAmount > 0 && isStripeConfigured() && org.stripe_account_id && org.stripe_charges_enabled) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";
    const session = await createCheckoutSession({
      accountId: org.stripe_account_id,
      amountEuros: totalAmount,
      label: `Adhésion ${tier.name}, ${org.name}`,
      metadata: { adhesion_id: adhesionId },
      customerEmail: input.email,
      successUrl: `${base}/site/${org.slug}/adhesion/${campaign.slug}?paiement=ok`,
      cancelUrl: `${base}/site/${org.slug}/adhesion/${campaign.slug}?paiement=annule`,
    });
    if (session) {
      return respond({ ok: true, redirectUrl: session.url }, 201);
    }
    // Stripe failed: carry on without online payment (best effort).
  }

  // From here the payment is settled offline (no Stripe session was created).
  const mail_sent = await sendMail({
    to: input.email,
    subject: `Votre demande d'adhésion, ${org.name}`,
    html: tplAdhesionCandidat({
      orgName: org.name,
      firstName: input.first_name,
      lastName: input.last_name,
      tierLabel: tier.name ?? "Adhésion",
      amount: tierAmount,
      donation: input.donation_amount,
      membershipEnd: membership_end,
      paidOnline: false,
    }),
    replyTo: org.email ?? undefined,
    category: "adhesion",
    organizationId: org.id,
  });

  // Team alert. notifyOrgAdmins never throws; awaited so the send is not cut short.
  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";
  await notifyOrgAdmins(admin, org.id, ({ name, slug: orgSlug }) => ({
    category: "adhesion",
    subject: `Nouvelle demande d'adhésion, ${name}`,
    html: `<p>Nouvelle demande d'adhésion pour <strong>${esc(name)}</strong>.</p>
      <ul>
        <li>Nom : ${esc(`${input.first_name} ${input.last_name}`)}</li>
        <li>Courriel : ${esc(input.email)}</li>
        <li>Formule : ${esc(tier.name ?? "Adhésion")}</li>
        <li>Montant : ${totalAmount.toFixed(2)} €${input.donation_amount ? ` (dont don ${input.donation_amount.toFixed(2)} €)` : ""}</li>
      </ul>
      <p>Aucun paiement n'a été pris. À valider dans le tableau de bord : ${esc(`${appBase}/dashboard/${orgSlug}/adhesions`)}</p>`,
  }));

  return respond({ ok: true, mail_sent }, 201);
}
