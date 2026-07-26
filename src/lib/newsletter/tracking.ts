/**
 * Suivi des ouvertures et des clics.
 *
 * L'instrumentation se fait en post-traitement du HTML rendu, pas dans le
 * moteur de rendu : les blocs n'ont pas à savoir qu'on mesure quoi que ce soit,
 * et l'aperçu comme l'email de test restent des HTML propres, sans pixel.
 *
 * Le jeton est l'id de la ligne `newsletter_deliveries` — un uuid aléatoire,
 * propre au couple (campagne, destinataire). Aucune adresse email ne circule
 * dans les URL, ce qui évite qu'un lien transféré ou un journal de serveur
 * n'expose qui est abonné.
 */

import { createHmac, timingSafeEqual } from "crypto";

/** Une URL de clic non signée serait une redirection ouverte : n'importe qui
 *  pourrait faire pointer notre domaine vers le sien. La signature lie l'URL
 *  cible au destinataire. */
function secret(): string {
  return process.env.PORTAL_LINK_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function signClick(deliveryId: string, url: string): string {
  return createHmac("sha256", secret())
    .update(`${deliveryId}\n${url}`)
    .digest("base64url")
    .slice(0, 27);
}

export function verifyClick(deliveryId: string, url: string, sig: string): boolean {
  const expected = signClick(deliveryId, url);
  if (!sig || sig.length !== expected.length) return false;
  // Comparaison à temps constant : une comparaison naïve laisse deviner la
  // signature octet par octet.
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export function pixelUrl(baseUrl: string, deliveryId: string): string {
  return `${baseUrl}/api/n/o/${deliveryId}`;
}

export function clickUrl(baseUrl: string, deliveryId: string, target: string): string {
  const sig = signClick(deliveryId, target);
  return `${baseUrl}/api/n/c/${deliveryId}?u=${encodeURIComponent(target)}&s=${sig}`;
}

/** Seuls http(s) sont suivis : `mailto:`, `tel:` et les ancres n'ont rien à
 *  mesurer et casseraient s'ils passaient par une redirection. */
function isTrackable(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/**
 * Réécrit les liens et ajoute le pixel.
 *
 * `skipUrls` : les liens qu'on ne suit jamais. La désinscription en fait
 * partie — compter un « clic » sur le lien qui sert à nous quitter serait au
 * mieux inutile, au pire un moyen de retarder le retrait si la redirection
 * échoue.
 */
export function instrumentHtml(
  html: string,
  opts: { deliveryId: string; baseUrl: string; skipUrls?: string[] }
): string {
  const { deliveryId, baseUrl, skipUrls = [] } = opts;
  const skip = new Set(skipUrls);

  const withLinks = html.replace(
    /(<a\b[^>]*\bhref=)(["'])(.*?)\2/gi,
    (match, prefix: string, quote: string, href: string) => {
      const clean = href.replace(/&amp;/g, "&");
      if (!isTrackable(clean) || skip.has(clean)) return match;
      // On ré-échappe : la valeur revient dans un attribut HTML.
      const tracked = clickUrl(baseUrl, deliveryId, clean).replace(/&/g, "&amp;");
      return `${prefix}${quote}${tracked}${quote}`;
    }
  );

  // Le pixel en dernier : s'il ne charge pas, rien d'autre n'est affecté.
  const pixel = `<img src="${pixelUrl(baseUrl, deliveryId)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;"/>`;
  return withLinks.includes("</body>")
    ? withLinks.replace("</body>", `${pixel}</body>`)
    : withLinks + pixel;
}
