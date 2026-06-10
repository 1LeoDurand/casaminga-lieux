/**
 * Conversion d'un montant en euros en toutes lettres (norme française CERFA).
 * Ex : 1 234,50 → "mille deux cent trente-quatre euros et cinquante centimes"
 */

const UNITS = [
  "", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];

const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

function belowHundred(n: number): string {
  if (n === 0) return "";
  if (n <= 19) return UNITS[n];

  const ten = Math.floor(n / 10);
  const unit = n % 10;

  // 70-79 : soixante + dix-neuf
  if (ten === 7) {
    if (unit === 1) return "soixante et onze";
    return unit === 0 ? "soixante-dix" : `soixante-${UNITS[10 + unit]}`;
  }
  // 80-89 : quatre-vingts / quatre-vingt-x
  if (ten === 8) {
    if (unit === 0) return "quatre-vingts"; // s car multiple exact
    return `quatre-vingt-${UNITS[unit]}`;
  }
  // 90-99 : quatre-vingt-dix à quatre-vingt-dix-neuf
  if (ten === 9) {
    return unit === 0 ? "quatre-vingt-dix" : `quatre-vingt-${UNITS[10 + unit]}`;
  }

  // 20-69
  const t = TENS[ten];
  if (unit === 0) return t;
  if (unit === 1) return `${t} et un`;
  return `${t}-${UNITS[unit]}`;
}

/**
 * @param trailingS  true = "cents" si multiple exact de 100 (fin de nombre),
 *                   false = "cent"  si suivi de "mille" ou "millions".
 */
function belowThousand(n: number, trailingS = true): string {
  if (n === 0) return "";
  if (n < 100) return belowHundred(n);

  const h = Math.floor(n / 100);
  const rest = n % 100;

  if (h === 1) {
    return rest === 0 ? "cent" : `cent ${belowHundred(rest)}`;
  }
  const hWord = `${UNITS[h]} cent`;
  if (rest === 0) return trailingS ? `${hWord}s` : hWord;
  return `${hWord} ${belowHundred(rest)}`;
}

function intToFrench(n: number): string {
  if (n === 0) return "zéro";

  const parts: string[] = [];

  if (n >= 1_000_000) {
    const m = Math.floor(n / 1_000_000);
    const mWord = belowThousand(m, false); // pas de "cents" avant "millions"
    parts.push(m === 1 ? "un million" : `${mWord} millions`);
    n %= 1_000_000;
  }

  if (n >= 1_000) {
    const t = Math.floor(n / 1_000);
    const tWord = belowThousand(t, false); // pas de "cents" avant "mille"
    parts.push(t === 1 ? "mille" : `${tWord} mille`);
    n %= 1_000;
  }

  if (n > 0) {
    parts.push(belowThousand(n));
  }

  return parts.join(" ");
}

/** Retourne le montant en toutes lettres pour un Cerfa 11580*04. */
export function amountToFrenchWords(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const euros = Math.floor(rounded);
  const centimes = Math.round((rounded - euros) * 100);

  const euroPart = euros === 1 ? "un euro" : `${intToFrench(euros)} euros`;

  if (centimes === 0) return euroPart;

  const centimePart = centimes === 1 ? "un centime" : `${intToFrench(centimes)} centimes`;
  return `${euroPart} et ${centimePart}`;
}
