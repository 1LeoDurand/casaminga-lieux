/**
 * Dépôt de l'accord photos (formulaire de /contact/<jeton>/photos).
 *
 * Route et non action serveur : une action serveur est plafonnée à 1 Mo par
 * défaut, et relever ce plafond le relèverait pour toutes les actions du site.
 * Ici, la taille est contrôlée sur Content-Length AVANT de lire le corps, et
 * le jeton est vérifié avant tout. Toute issue est une redirection 303 vers la
 * page (`?r=<code>`), qui fonctionne sans JavaScript.
 *
 * Mémoire (hébergement mutualisé, tas Node plafonné à 1,5 Go) :
 *  - Content-Length obligatoire et borné (10 fichiers × 10 Mo + marge) ;
 *  - corps lu EN FLUX avec coupure dès que la borne est franchie, quoi que
 *    dise l'en-tête (jamais `req.formData()` sur un flux non borné) ;
 *  - UN SEUL dépôt à la fois dans le process : un second reçoit « réessayez »,
 *    au lieu de cumuler plusieurs centaines de Mo en mémoire ;
 *  - nombre et poids des fichiers contrôlés avant toute copie de leurs octets.
 * Cette route est exclue du proxy (src/proxy.ts, `matcher`) : le proxy
 * mettrait le corps en mémoire et le tronquerait à 10 Mo, en journalisant l'URL
 * (donc le jeton). Elle pose donc elle-même ses en-têtes (voir `back`).
 */
import { NextRequest, after } from "next/server";
import { createAdminClient } from "@/lib/admin/guard";
import { allowUploadAttempt, clientIp, hashIp, resolveContactToken } from "@/lib/outreach/link-token";
import {
  MAX_PHOTO_BYTES, MAX_PHOTO_FILES, MAX_PHOTO_REQUEST_BYTES, parsePhotoFields, recordPhotoGrant,
  validatePhotoFiles, type IncomingFile,
} from "@/lib/outreach/consent";
import { notifyLinkAction } from "@/lib/outreach/link-notify";

export const dynamic = "force-dynamic";

/** Dépôts en cours dans ce process (un seul à la fois, voir l'en-tête). */
let uploadsInFlight = 0;
const MAX_CONCURRENT_UPLOADS = 1;

/**
 * Lit le corps en flux et coupe au-delà de `max` octets. `null` si le corps
 * manque ou dépasse la borne (la lecture est alors abandonnée, rien n'est gardé).
 */
async function readBodyCapped(req: NextRequest, max: number): Promise<Uint8Array | null> {
  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** Corps borné puis décodé en multipart ; `null` si trop gros ou illisible. */
async function readFormCapped(req: NextRequest, max: number): Promise<FormData | "too_big" | null> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) return null;
  const raw = await readBodyCapped(req, max);
  if (!raw) return "too_big";
  try {
    return await new Response(raw as BodyInit, { headers: { "content-type": contentType } }).formData();
  } catch {
    return null;
  }
}

function back(token: string, code: string): Response {
  // Location relative : valide (RFC 7231) et indépendante du nom d'hôte vu derrière le reverse proxy.
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/contact/${encodeURIComponent(token)}/photos?r=${code}`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = clientIp(req.headers);

  // Jeton, action, expiration, débit : rien n'est lu du corps avant.
  const link = await resolveContactToken(token, "photos", { ip });
  if (!link) return back(token, "server"); // la page affichera « lien invalide »

  const length = Number(req.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0) return back(token, "server");
  if (length > MAX_PHOTO_REQUEST_BYTES) return back(token, "too_big");

  if (uploadsInFlight >= MAX_CONCURRENT_UPLOADS) return back(token, "busy");
  if (!allowUploadAttempt(link.thread.id)) return back(token, "rate");

  uploadsInFlight++;
  try {
    return await handleUpload(req, token, link, ip);
  } finally {
    uploadsInFlight--;
  }
}

async function handleUpload(
  req: NextRequest,
  token: string,
  link: NonNullable<Awaited<ReturnType<typeof resolveContactToken>>>,
  ip: string | null
): Promise<Response> {
  const form = await readFormCapped(req, MAX_PHOTO_REQUEST_BYTES);
  if (form === "too_big") return back(token, "too_big");
  if (!form) return back(token, "server");

  const fields = parsePhotoFields((k) => form.get(k));
  if (!fields.ok) return back(token, fields.error);

  // Nombre et poids d'abord : aucun octet de fichier n'est copié pour un envoi refusé.
  const entries = form.getAll("files").filter((e): e is File => typeof e !== "string" && e.size > 0);
  if (entries.length > MAX_PHOTO_FILES) return back(token, "too_many");
  if (entries.some((e) => e.size > MAX_PHOTO_BYTES)) return back(token, "too_big");

  const incoming: IncomingFile[] = [];
  for (const entry of entries) {
    incoming.push({ name: entry.name, bytes: new Uint8Array(await entry.arrayBuffer()) });
  }
  const checked = validatePhotoFiles(incoming);
  if (!checked.ok) return back(token, checked.error);
  if (fields.choices.scope !== "photos_article" && checked.files.length === 0) return back(token, "no_files");

  const admin = createAdminClient();
  if (!admin) return back(token, "server");

  const result = await recordPhotoGrant(admin, {
    thread: link.thread,
    stages: link.stages,
    choices: fields.choices,
    placeName: link.contact.name,
    files: checked.files,
    ipHash: hashIp(ip),
    userAgent: req.headers.get("user-agent"),
  });
  if (!result.ok) return back(token, result.error === "no_files" ? "no_files" : "server");

  // L'équipe est prévenue, sans jamais bloquer la réponse.
  after(() =>
    notifyLinkAction({
      threadId: link.thread.id,
      placeName: link.contact.name,
      headline: "Photos accordées",
      detail:
        `Licence ${fields.choices.licence}, ${result.fileCount} fichier(s) déposé(s). ` +
        "L'accord daté et son texte sont enregistrés dans le fil.",
    })
  );

  return back(token, "ok");
}
