/**
 * Dépôt de l'accord photos (formulaire de /contact/<jeton>/photos).
 *
 * Route et non action serveur : une action serveur est plafonnée à 1 Mo par
 * défaut, et relever ce plafond le relèverait pour toutes les actions du site.
 * Ici, la taille est contrôlée sur Content-Length AVANT de lire le corps, et
 * le jeton est vérifié avant tout. Toute issue est une redirection 303 vers la
 * page (`?r=<code>`), qui fonctionne sans JavaScript.
 *
 * Mémoire : le corps multipart est lu en entier (jusqu'à ~100 Mo pour dix
 * photos de 10 Mo). Acceptable pour un usage ponctuel par un lieu, à
 * surveiller sur un hébergement mutualisé (limite de trois dépôts par fil et par jour).
 */
import { NextRequest, after } from "next/server";
import { createAdminClient } from "@/lib/admin/guard";
import { allowUploadAttempt, clientIp, hashIp, resolveContactToken } from "@/lib/outreach/link-token";
import {
  MAX_PHOTO_REQUEST_BYTES, parsePhotoFields, recordPhotoGrant, validatePhotoFiles, type IncomingFile,
} from "@/lib/outreach/consent";
import { notifyLinkAction } from "@/lib/outreach/link-notify";

export const dynamic = "force-dynamic";

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

  if (!allowUploadAttempt(link.thread.id)) return back(token, "rate");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(token, "server");
  }

  const fields = parsePhotoFields((k) => form.get(k));
  if (!fields.ok) return back(token, fields.error);

  const incoming: IncomingFile[] = [];
  for (const entry of form.getAll("files")) {
    if (typeof entry === "string") continue;
    if (entry.size === 0) continue;
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
