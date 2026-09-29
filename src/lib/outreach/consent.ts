/**
 * Accord photos du lien signé (action `photos`, spec 8.2).
 *
 * Trois choses ici :
 *  - le TEXTE de l'accord, versionné et empreinté (SHA-256) : ce que le lieu
 *    lit à l'écran est ce qui est stocké, avec ses choix (licence, crédit,
 *    portée, nom) insérés au serveur, jamais fournis par le navigateur ;
 *  - la VALIDATION des fichiers : extensions image seules, type réel lu dans
 *    les octets de tête (pas le Content-Type déclaré), 10 Mo et 10 fichiers au
 *    plus, noms nettoyés ;
 *  - l'ENREGISTREMENT (`recordPhotoGrant`) : dépôt en bucket privé, ligne
 *    `outreach_photo_grants`, fil vers l'étape de rôle `succes`, relance
 *    annulée, drapeau `photos_recues`, événement.
 *
 * Le client de service est injecté : le fichier ne lit aucun secret.
 * Jamais de vérité juridique sans humain : Léo relit l'accord depuis le fil.
 */
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LinkStage, LinkThread } from "./link-types";

export const PHOTOS_BUCKET = "outreach-files";
export const MAX_PHOTO_FILES = 10;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
/** Marge pour les champs texte et les séparateurs d'un envoi multipart. */
export const MAX_PHOTO_REQUEST_BYTES = MAX_PHOTO_FILES * MAX_PHOTO_BYTES + 256 * 1024;
export const CONSENT_VERSION = "photos-2026-09-29.1";

export type PhotoLicence = "CC-BY-4.0" | "CC-BY-SA-4.0";
export type PhotoScope = "photos_article" | "photos_deposees" | "les_deux";

export const LICENCES: Record<PhotoLicence, { label: string; url: string; note: string }> = {
  "CC-BY-4.0": {
    label: "CC BY 4.0",
    url: "https://creativecommons.org/licenses/by/4.0/deed.fr",
    note: "Réutilisation libre, y compris commerciale, à condition de citer l'auteur.",
  },
  "CC-BY-SA-4.0": {
    label: "CC BY-SA 4.0",
    url: "https://creativecommons.org/licenses/by-sa/4.0/deed.fr",
    note: "Comme CC BY, avec en plus l'obligation de partager les adaptations sous la même licence.",
  },
};

export const SCOPES: Record<PhotoScope, string> = {
  photos_article: "les photos du lieu qui figurent déjà dans l'article de Casa Minga",
  photos_deposees: "les fichiers que je dépose avec cet accord",
  les_deux: "les photos qui figurent déjà dans l'article et les fichiers que je dépose avec cet accord",
};

export interface ConsentChoices {
  licence: PhotoLicence;
  credit: string;
  name: string;
  role: string | null;
  placeName: string;
  scope: PhotoScope;
}

interface ConsentParts {
  who: string;
  placeName: string;
  licenceClause: string;
  credit: string;
  scopeText: string;
}

function renderConsent(p: ConsentParts): string {
  return [
    `Accord d'utilisation de photos (version ${CONSENT_VERSION})`,
    "",
    `Je soussigné(e) ${p.who}, agissant au nom de « ${p.placeName} », déclare :`,
    "",
    "1. Être l'auteur des photos concernées, ou détenir le droit de les diffuser, et avoir l'accord des personnes reconnaissables qui y figurent.",
    `2. Accorder à toute personne, y compris Casa Minga, le droit de partager et d'adapter ces photos (recadrage, compression), y compris à des fins commerciales, ${p.licenceClause}`,
    `3. Demander que les photos soient créditées ainsi : « ${p.credit} ».`,
    `4. Que cet accord porte sur ${p.scopeText}.`,
    "5. Comprendre que cette licence ne peut plus être retirée pour les copies déjà diffusées, que Casa Minga n'est pas obligée de publier les photos, et qu'aucune contrepartie financière n'est due.",
    "6. Avoir lu ce texte en entier avant de l'accepter.",
  ].join("\n");
}

/** Texte enregistré : le gabarit de l'aperçu, avec les choix réels insérés par le serveur. */
export function buildConsentText(c: ConsentChoices): string {
  const licence = LICENCES[c.licence];
  return renderConsent({
    who: c.role ? `${c.name}, ${c.role}` : c.name,
    placeName: c.placeName,
    licenceClause: `aux conditions de la licence ${licence.label} : ${licence.url}`,
    credit: c.credit,
    scopeText: SCOPES[c.scope],
  });
}

/** Aperçu affiché en entier avant l'envoi : mêmes phrases, choix encore entre crochets. */
export function consentPreview(placeName: string): string {
  return renderConsent({
    who: "[votre nom et votre fonction]",
    placeName,
    licenceClause: "aux conditions de la licence que vous choisissez ci-dessus (CC BY 4.0 ou CC BY-SA 4.0).",
    credit: "le crédit que vous indiquez",
    scopeText: "[la portée que vous choisissez]",
  });
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/* ------------------------------------------------------------------ */
/* Champs du formulaire                                                */
/* ------------------------------------------------------------------ */

/** Retire les caractères de contrôle et écrase les retours à la ligne (une seule ligne). */
export function cleanLine(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export type PhotoFieldsResult =
  | { ok: true; choices: Omit<ConsentChoices, "placeName"> }
  | { ok: false; error: "licence" | "scope" | "name" | "credit" | "accept" };

export function parsePhotoFields(get: (key: string) => unknown): PhotoFieldsResult {
  const licence = get("licence");
  if (licence !== "CC-BY-4.0" && licence !== "CC-BY-SA-4.0") return { ok: false, error: "licence" };
  const scope = get("scope");
  if (scope !== "photos_article" && scope !== "photos_deposees" && scope !== "les_deux") {
    return { ok: false, error: "scope" };
  }
  const name = cleanLine(get("name"), 200);
  if (name.length < 2) return { ok: false, error: "name" };
  const credit = cleanLine(get("credit"), 200);
  if (credit.length < 2) return { ok: false, error: "credit" };
  if (get("accept") !== "on" && get("accept") !== "1") return { ok: false, error: "accept" };
  const role = cleanLine(get("role"), 100) || null;
  return { ok: true, choices: { licence, scope, name, credit, role } };
}

/* ------------------------------------------------------------------ */
/* Fichiers                                                            */
/* ------------------------------------------------------------------ */

export type ImageKind = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

/** Type réel d'une image d'après ses premiers octets ; null si ce n'est ni JPEG, ni PNG, ni WebP. */
export function sniffImage(b: Uint8Array): ImageKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // "RIFF"
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

/** Nom d'affichage nettoyé : sans chemin, sans accent, [a-z0-9._-] seulement, 60 caractères au plus (extension exclue). */
export function cleanFileName(original: string): string {
  const base = original.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const cleaned = stem
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/[._-]{2,}/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 60)
    .replace(/[-._]+$/g, "");
  return cleaned || "photo";
}

export function extensionOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export interface IncomingFile {
  name: string;
  bytes: Uint8Array;
}

export interface AcceptedFile {
  cleanName: string;
  mime: ImageKind["mime"];
  ext: ImageKind["ext"];
  size: number;
  sha256: string;
  bytes: Uint8Array;
}

export type FilesResult =
  | { ok: true; files: AcceptedFile[] }
  | { ok: false; error: "too_many" | "too_big" | "bad_type" };

export function validatePhotoFiles(incoming: IncomingFile[]): FilesResult {
  const files = incoming.filter((f) => f.bytes.length > 0);
  if (files.length > MAX_PHOTO_FILES) return { ok: false, error: "too_many" };
  const accepted: AcceptedFile[] = [];
  for (const f of files) {
    if (f.bytes.length > MAX_PHOTO_BYTES) return { ok: false, error: "too_big" };
    // Extension annoncée ET type réel : un faux .jpg (autre contenu) est refusé.
    if (!ALLOWED_EXT.has(extensionOf(f.name))) return { ok: false, error: "bad_type" };
    const kind = sniffImage(f.bytes);
    if (!kind) return { ok: false, error: "bad_type" };
    accepted.push({
      cleanName: cleanFileName(f.name),
      mime: kind.mime,
      ext: kind.ext,
      size: f.bytes.length,
      sha256: sha256Hex(f.bytes),
      bytes: f.bytes,
    });
  }
  return { ok: true, files: accepted };
}

/* ------------------------------------------------------------------ */
/* Enregistrement                                                      */
/* ------------------------------------------------------------------ */

export interface RecordPhotoGrantInput {
  thread: Pick<LinkThread, "id" | "program_id" | "contact_id" | "status">;
  stages: LinkStage[];
  choices: Omit<ConsentChoices, "placeName">;
  placeName: string;
  files: AcceptedFile[];
  ipHash: string | null;
  userAgent: string | null;
  now?: Date;
}

export type RecordPhotoGrantResult =
  | { ok: true; grantId: string; fileCount: number }
  | { ok: false; error: "no_files" | "storage" | "database" };

export async function recordPhotoGrant(
  admin: SupabaseClient,
  input: RecordPhotoGrantInput
): Promise<RecordPhotoGrantResult> {
  const { thread, choices, files } = input;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();

  const withFiles = choices.scope !== "photos_article";
  if (withFiles && files.length === 0) return { ok: false, error: "no_files" };
  const kept = withFiles ? files : [];

  const grantId = crypto.randomUUID();
  const text = buildConsentText({ ...choices, placeName: input.placeName });

  // 1. Fichiers en bucket privé, sous un chemin que le serveur compose seul.
  const stored: { path: string; name: string; mime: string; size: number; sha256: string }[] = [];
  for (let i = 0; i < kept.length; i++) {
    const f = kept[i];
    const path = `threads/${thread.id}/photos/${grantId}/${String(i + 1).padStart(2, "0")}-${f.cleanName}.${f.ext}`;
    const { error } = await admin.storage.from(PHOTOS_BUCKET).upload(path, f.bytes, {
      contentType: f.mime,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      await removeFiles(admin, stored.map((s) => s.path));
      return { ok: false, error: "storage" };
    }
    stored.push({ path, name: `${f.cleanName}.${f.ext}`, mime: f.mime, size: f.size, sha256: f.sha256 });
  }

  // 2. L'accord lui-même.
  const { error: grantError } = await admin.from("outreach_photo_grants").insert({
    id: grantId,
    thread_id: thread.id,
    contact_id: thread.contact_id,
    licence: choices.licence,
    credit: choices.credit,
    granted_by_name: choices.name,
    granted_by_role: choices.role,
    scope: choices.scope,
    photo_refs: [],
    files: stored,
    consent_text: text,
    consent_version: CONSENT_VERSION,
    consent_sha256: sha256Hex(text),
    accepted_at: nowIso,
    ip_hash: input.ipHash,
    user_agent: input.userAgent ? input.userAgent.slice(0, 200) : null,
  });
  if (grantError) {
    await removeFiles(admin, stored.map((s) => s.path));
    return { ok: false, error: "database" };
  }

  // 3. Le fil : étape « succès » si la transition existe, relance annulée, drapeau pour Léo.
  //    Aucune de ces écritures ne défait l'accord déjà enregistré.
  const role = input.stages.find((s) => s.slug === thread.status)?.role;
  const succes = input.stages.find((s) => s.role === "succes")?.slug;
  const canAdvance = succes && (role === "attente" || role === "relance" || role === "conversation");

  const patch: Record<string, unknown> = { photos_granted_at: nowIso };
  if (canAdvance) patch.status = succes;
  let { error: threadError } = await admin.from("outreach_threads").update(patch).eq("id", thread.id);
  if (threadError && canAdvance) {
    // Transition refusée par la base : on garde au moins la date de l'accord.
    ({ error: threadError } = await admin
      .from("outreach_threads")
      .update({ photos_granted_at: nowIso })
      .eq("id", thread.id));
  }
  await admin
    .from("outreach_threads")
    .update({ needs_leo: true, needs_leo_reason: "photos_recues", needs_leo_since: nowIso })
    .eq("id", thread.id);
  await admin
    .from("outreach_messages")
    .update({ send_status: "annule" })
    .eq("thread_id", thread.id)
    .eq("direction", "out")
    .eq("kind", "relance")
    .in("send_status", ["a_valider", "planifie"]);

  // 4. Événement : ni nom, ni crédit, ni adresse.
  try {
    await admin.from("outreach_events").insert({
      program_id: thread.program_id,
      thread_id: thread.id,
      contact_id: thread.contact_id,
      actor: "lien",
      type: "link.photos_granted",
      data: {
        grant_id: grantId,
        licence: choices.licence,
        scope: choices.scope,
        files: stored.length,
        advanced: Boolean(canAdvance) && !threadError,
      },
    });
  } catch {
    // journal facultatif
  }

  return { ok: true, grantId, fileCount: stored.length };
}

async function removeFiles(admin: SupabaseClient, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await admin.storage.from(PHOTOS_BUCKET).remove(paths);
  } catch {
    // nettoyage au mieux
  }
}
