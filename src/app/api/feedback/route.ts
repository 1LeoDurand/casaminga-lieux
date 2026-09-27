import { NextResponse } from "next/server";
import { corsPreflight, isForeignOrigin, withCors, type CorsOptions } from "@/lib/http/cors";
import { createAdminClient } from "@/lib/admin/guard";
import { rateLimit } from "@/lib/rate-limit";
import {
  checkScreenshot,
  validateFeedbackFields,
  MAX_SCREENSHOT_BYTES,
  MAX_REQUEST_BYTES,
  RATE_LIMIT_PER_IP_PER_HOUR,
  RATE_LIMIT_PER_EMAIL_PER_HOUR,
  RATE_WINDOW_MS,
  type FeedbackInput,
} from "@/lib/feedback/validate";

/**
 * POST /api/feedback : signalement (bug / amélioration) depuis un site public
 * (casaminga.com, sejour.casaminga.com à venir), sur le modèle de
 * /api/espace/lien. L'admin garde son insertion directe depuis le navigateur
 * (feedback-widget.tsx) : cette route ne sert que platform in ('public','sejour').
 *
 * Réponse : 201 { id } (8 premiers caractères de l'UUID) en cas de succès, ou
 * neutre si le pot de miel est rempli. 400 en message générique sinon, sans
 * jamais renvoyer les données reçues.
 */

export const dynamic = "force-dynamic";

const CORS: CorsOptions = { methods: ["POST"], headers: ["Content-Type"] };
const NO_STORE = { "Cache-Control": "no-store" };
const SCREENSHOT_BUCKET = "feedback-screenshots";

/** Origines dont l'URL de la page signalée est acceptée telle quelle. */
const ALLOWED_REPORT_URL_ORIGINS = [
  "https://casaminga.com",
  "https://www.casaminga.com",
  "https://sejour.casaminga.com",
  ...(process.env.NODE_ENV !== "production" || process.env.CORS_ALLOW_LOCALHOST === "1"
    ? ["http://localhost:5174"]
    : []),
];

function json(req: Request, body: unknown, status = 200): Response {
  return withCors(req, NextResponse.json(body, { status, headers: NO_STORE }), CORS);
}

function badRequest(req: Request): Response {
  // Message générique : jamais d'écho des données ni de la raison précise.
  return json(req, { error: "invalid_request" }, 400);
}

function clientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export function OPTIONS(req: Request) {
  return corsPreflight(req, CORS);
}

async function uploadScreenshot(
  admin: ReturnType<typeof createAdminClient>,
  file: File
): Promise<string | null> {
  if (!admin) return null;
  // The File comes from an already-parsed body, so `size` is the real byte
  // count (not client-declared); the memory bound itself is the Content-Length
  // check in POST. `checkScreenshot` re-checks the bytes anyway.
  if (file.size > MAX_SCREENSHOT_BYTES) return null;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = checkScreenshot(bytes, file.type);
  if (!result.ok) return null;

  // Nom généré côté serveur : jamais celui du client, pour ne rien laisser
  // fuiter (chemin, extension mensongère) ni collisionner.
  const path = `${crypto.randomUUID()}.${result.extension}`;

  const { error } = await admin.storage.from(SCREENSHOT_BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) return null;

  const { data } = admin.storage.from(SCREENSHOT_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function POST(req: Request) {
  if (isForeignOrigin(req)) return json(req, { error: "forbidden_origin" }, 403);

  // Reject oversized bodies before req.formData() buffers the whole multipart
  // in memory. Browsers always send Content-Length for a FormData fetch, so a
  // missing or non-numeric value is refused too (no chunked uploads here).
  const contentLength = Number(req.headers.get("content-length"));
  if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_REQUEST_BYTES) {
    return badRequest(req);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest(req);
  }

  const raw: Record<string, unknown> = {};
  for (const key of [
    "platform",
    "type",
    "priority",
    "description",
    "url",
    "page_title",
    "reporter_email",
    "user_agent",
    "device_type",
    "screen_width",
    "screen_height",
    "os_hint",
    "website",
  ]) {
    const value = form.get(key);
    if (typeof value === "string") raw[key] = value;
  }

  const result = validateFeedbackFields(raw, ALLOWED_REPORT_URL_ORIGINS);
  if (!result.ok) return badRequest(req);

  // Pot de miel rempli : réponse neutre, aucune écriture, aucun indice donné
  // au bot sur ce qui a été détecté.
  if (result.honeypot) return json(req, { id: "00000000" }, 201);

  const data: FeedbackInput = result.data;

  const ip = clientIp(req);
  const ipAllowed = !ip || rateLimit(`feedback-ip:${ip}`, RATE_LIMIT_PER_IP_PER_HOUR, RATE_WINDOW_MS);
  if (!ipAllowed) return badRequest(req);

  if (data.reporter_email) {
    const emailAllowed = rateLimit(
      `feedback-email:${data.reporter_email.toLowerCase()}`,
      RATE_LIMIT_PER_EMAIL_PER_HOUR,
      RATE_WINDOW_MS
    );
    if (!emailAllowed) return badRequest(req);
  }

  const admin = createAdminClient();
  if (!admin) return badRequest(req);

  // La clé anon du site public n'écrit jamais ici : seule l'API, avec
  // service_role, écrit dans `feedback` pour une entrée publique.
  let screenshotUrl: string | null = null;
  const screenshotField = form.get("screenshot");
  if (screenshotField instanceof File && screenshotField.size > 0) {
    screenshotUrl = await uploadScreenshot(admin, screenshotField);
  }

  const { data: inserted, error } = await admin
    .from("feedback")
    .insert({
      platform: data.platform,
      type: data.type,
      priority: data.priority,
      description: data.description,
      url: data.url,
      page_title: data.page_title,
      reporter_email: data.reporter_email,
      user_agent: data.user_agent,
      device_type: data.device_type,
      screen_width: data.screen_width,
      screen_height: data.screen_height,
      os_hint: data.os_hint,
      screenshot_url: screenshotUrl,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !inserted) return badRequest(req);

  return json(req, { id: String(inserted.id).slice(0, 8) }, 201);
}
