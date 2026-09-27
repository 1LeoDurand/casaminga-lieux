/**
 * Pure validation for the public feedback intake (POST /api/feedback).
 * No Supabase, no Next.js: kept side-effect free so it can be unit tested
 * without a database, and reused identically by the route handler.
 */

export type FeedbackPlatform = "public" | "sejour";
export type FeedbackType = "bug" | "amélioration";
export type FeedbackPriority = "low" | "medium" | "high" | "critical";
export type FeedbackDeviceType = "mobile" | "tablet" | "desktop";

// Matches the feedback_platform_check / feedback_type_check / feedback_priority_check
// constraints in supabase/migrations/0015_platform.sql. The admin ('admin') value is
// deliberately excluded: this endpoint only serves the public sites, the admin widget
// keeps inserting 'admin' rows directly.
export const ALLOWED_PLATFORMS: readonly FeedbackPlatform[] = ["public", "sejour"];
// Exact DB constraint values (feedback_type_check): 'bug' and 'amélioration' (with the
// accent), not 'improvement' — verified against production on 2026-09-27.
export const ALLOWED_TYPES: readonly FeedbackType[] = ["bug", "amélioration"];
export const ALLOWED_PRIORITIES: readonly FeedbackPriority[] = ["low", "medium", "high", "critical"];
export const ALLOWED_DEVICE_TYPES: readonly FeedbackDeviceType[] = ["mobile", "tablet", "desktop"];
export const ALLOWED_OS_HINTS = ["Windows", "macOS", "iOS", "Android", "Linux"] as const;

export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 4000;
export const URL_MAX = 500;
export const PAGE_TITLE_MAX = 200;
export const EMAIL_MAX = 254;
export const USER_AGENT_MAX = 500;
export const OS_HINT_MAX = 50;
export const SCREEN_DIMENSION_MAX = 10_000;

export const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024; // 3 Mo
export const ALLOWED_SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const RATE_LIMIT_PER_IP_PER_HOUR = 5;
export const RATE_LIMIT_PER_EMAIL_PER_HOUR = 3;
export const RATE_WINDOW_MS = 3_600_000;

/** Simple, deliberately permissive email shape check (no DNS/MX lookup). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface FeedbackInput {
  platform: FeedbackPlatform;
  type: FeedbackType;
  priority: FeedbackPriority;
  description: string;
  url: string | null;
  page_title: string | null;
  reporter_email: string | null;
  user_agent: string | null;
  device_type: FeedbackDeviceType | null;
  screen_width: number | null;
  screen_height: number | null;
  os_hint: string | null;
}

export type ValidationResult =
  | { ok: true; honeypot: false; data: FeedbackInput }
  | { ok: true; honeypot: true }
  | { ok: false; error: string };

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function trimmedOrNull(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null || v === "") return null;
  const s = asString(v);
  if (s === undefined) return undefined; // wrong type
  const trimmed = s.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > max) return trimmed.slice(0, max);
  return trimmed;
}

/**
 * Bounds an integer-like field, dropping it (null) rather than rejecting the
 * whole request: screen dimensions are informative, not load-bearing.
 */
function boundedInt(v: unknown, max: number): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n);
}

/**
 * Restricts a url to one of the given allowed origins. A url whose origin is
 * not allowed is truncated down to just its own origin (scheme + host),
 * dropping path/query/hash, rather than rejecting the whole submission — the
 * report itself may still be legitimate. A url that isn't valid http(s) at
 * all is dropped entirely (null).
 */
export function sanitizeUrl(raw: string | null, allowedOrigins: readonly string[]): string | null {
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (allowedOrigins.includes(parsed.origin)) {
    const full = parsed.toString();
    return full.length > URL_MAX ? full.slice(0, URL_MAX) : full;
  }
  return parsed.origin.slice(0, URL_MAX);
}

/**
 * Validates a raw, already-parsed form body (multipart fields arrive as
 * strings; JSON fields keep their native type). Returns honeypot:true when
 * the hidden `website` field was filled, without exposing why to the caller.
 */
export function validateFeedbackFields(
  raw: Record<string, unknown>,
  allowedUrlOrigins: readonly string[]
): ValidationResult {
  // Honeypot first: never explain a rejection differently for a bot.
  const website = asString(raw.website);
  if (website && website.trim().length > 0) {
    return { ok: true, honeypot: true };
  }

  const platform = asString(raw.platform);
  if (!platform || !ALLOWED_PLATFORMS.includes(platform as FeedbackPlatform)) {
    return { ok: false, error: "invalid_platform" };
  }

  const type = asString(raw.type);
  if (!type || !ALLOWED_TYPES.includes(type as FeedbackType)) {
    return { ok: false, error: "invalid_type" };
  }

  const priority = asString(raw.priority) ?? "medium";
  if (!ALLOWED_PRIORITIES.includes(priority as FeedbackPriority)) {
    return { ok: false, error: "invalid_priority" };
  }

  const descriptionRaw = asString(raw.description);
  if (descriptionRaw === undefined) return { ok: false, error: "invalid_description" };
  const description = descriptionRaw.trim();
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
    return { ok: false, error: "invalid_description" };
  }

  const url = sanitizeUrl(asString(raw.url) ?? null, allowedUrlOrigins);

  const pageTitle = trimmedOrNull(raw.page_title, PAGE_TITLE_MAX);
  if (pageTitle === undefined) return { ok: false, error: "invalid_page_title" };

  const reporterEmailField = trimmedOrNull(raw.reporter_email, EMAIL_MAX);
  if (reporterEmailField === undefined) return { ok: false, error: "invalid_email" };
  if (reporterEmailField !== null && !EMAIL_RE.test(reporterEmailField)) {
    return { ok: false, error: "invalid_email" };
  }

  const userAgent = trimmedOrNull(raw.user_agent, USER_AGENT_MAX);
  if (userAgent === undefined) return { ok: false, error: "invalid_user_agent" };

  const deviceTypeRaw = asString(raw.device_type);
  const deviceType: FeedbackDeviceType | null =
    deviceTypeRaw && ALLOWED_DEVICE_TYPES.includes(deviceTypeRaw as FeedbackDeviceType)
      ? (deviceTypeRaw as FeedbackDeviceType)
      : null;

  const screenWidth = boundedInt(raw.screen_width, SCREEN_DIMENSION_MAX);
  const screenHeight = boundedInt(raw.screen_height, SCREEN_DIMENSION_MAX);

  const osHintRaw = trimmedOrNull(raw.os_hint, OS_HINT_MAX);
  if (osHintRaw === undefined) return { ok: false, error: "invalid_os_hint" };
  const osHint = osHintRaw && ALLOWED_OS_HINTS.includes(osHintRaw as (typeof ALLOWED_OS_HINTS)[number]) ? osHintRaw : null;

  return {
    ok: true,
    honeypot: false,
    data: {
      platform: platform as FeedbackPlatform,
      type: type as FeedbackType,
      priority: priority as FeedbackPriority,
      description,
      url,
      page_title: pageTitle,
      reporter_email: reporterEmailField,
      user_agent: userAgent,
      device_type: deviceType,
      screen_width: screenWidth,
      screen_height: screenHeight,
      os_hint: osHint,
    },
  };
}

/** Magic-byte signatures for the three accepted image types. */
function matchesMagicBytes(bytes: Uint8Array, type: (typeof ALLOWED_SCREENSHOT_TYPES)[number]): boolean {
  if (bytes.length < 12) return false;
  switch (type) {
    case "image/png":
      // 89 50 4E 47 0D 0A 1A 0A
      return (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );
    case "image/jpeg":
      // FF D8 FF
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/webp":
      // "RIFF" .... "WEBP"
      return (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
  }
}

export interface ScreenshotCheckOk {
  ok: true;
  extension: "png" | "jpg" | "webp";
}
export interface ScreenshotCheckErr {
  ok: false;
  error: string;
}

/**
 * Validates an uploaded screenshot: declared size, declared MIME type, and
 * the file's actual magic bytes (a renamed .exe declaring image/png must not
 * pass). Caller is expected to have already rejected on Content-Length when
 * possible, before reading the body into memory.
 */
export function checkScreenshot(
  bytes: Uint8Array,
  declaredType: string
): ScreenshotCheckOk | ScreenshotCheckErr {
  if (bytes.byteLength === 0) return { ok: false, error: "empty_file" };
  if (bytes.byteLength > MAX_SCREENSHOT_BYTES) return { ok: false, error: "file_too_large" };
  if (!ALLOWED_SCREENSHOT_TYPES.includes(declaredType as (typeof ALLOWED_SCREENSHOT_TYPES)[number])) {
    return { ok: false, error: "invalid_file_type" };
  }
  const type = declaredType as (typeof ALLOWED_SCREENSHOT_TYPES)[number];
  if (!matchesMagicBytes(bytes, type)) return { ok: false, error: "invalid_file_type" };
  const extension = type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp";
  return { ok: true, extension };
}
