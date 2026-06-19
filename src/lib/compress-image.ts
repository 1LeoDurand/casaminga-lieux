/**
 * Niveau 1 de la stratégie images — compression à l'upload (navigateur, zéro
 * dépendance). Redimensionne à ~2000px max sur le grand côté et ré-encode en
 * WebP : une photo de smartphone de 4–8 Mo tombe typiquement à 150–400 Ko, sans
 * perte visible. C'est le gain principal — il est indépendant du plan Supabase.
 *
 * Le niveau 2 (livraison responsive) est côté affichage :
 * casa-minga-public/src/lib/img.ts.
 */

export interface CompressOptions {
  /** Plus grand côté en pixels (défaut 2000). */
  maxDim?: number;
  /** Qualité WebP 0–1 (défaut 0.82). */
  quality?: number;
}

/**
 * Compresse une image en WebP. Renvoie le fichier d'origine inchangé si ce
 * n'est pas une image, si c'est un GIF (animation à préserver), ou si la
 * conversion échoue / n'apporte rien.
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxDim = 2000, quality = 0.82 } = opts;
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file; // anim → on ne touche pas

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality)
  );
  if (!blob) return file;

  // Si l'image était déjà petite et que la conversion ne gagne rien, on garde l'original.
  if (blob.size >= file.size && scale === 1) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp", lastModified: Date.now() });
}
