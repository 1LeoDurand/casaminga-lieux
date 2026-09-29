import "server-only";

// Server-side geocoding through the French national address API (BAN).
// Never throws: a failure must not break saving an establishment.

export interface GeocodeResult {
  lat: number;
  lng: number;
  score: number;
  label: string;
}

const MIN_SCORE = 0.5;
const TIMEOUT_MS = 8000;

export async function geocodeAddress(input: {
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
}): Promise<GeocodeResult | null> {
  const address = input.address?.trim() ?? "";
  const postalCode = input.postalCode?.trim() ?? "";
  const city = input.city?.trim() ?? "";
  // Skip postcode/city already present in the address text.
  const q = [address, postalCode, city]
    .filter((x, i) => x && (i === 0 || !address.toLowerCase().includes(x.toLowerCase())))
    .join(" ");
  if (!q) return null;
  try {
    const params = new URLSearchParams({ q, limit: "1" });
    if (/^\d{5}$/.test(postalCode)) params.set("postcode", postalCode);
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: { geometry?: { coordinates?: number[] }; properties?: { score?: number; label?: string } }[];
    };
    const f = json.features?.[0];
    const coords = f?.geometry?.coordinates;
    const score = f?.properties?.score ?? 0;
    if (!coords || coords.length < 2 || score < MIN_SCORE) return null;
    return { lat: coords[1], lng: coords[0], score, label: f?.properties?.label ?? "" };
  } catch {
    return null;
  }
}
