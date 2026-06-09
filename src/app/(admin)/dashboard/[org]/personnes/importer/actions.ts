"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";
import { humanError } from "@/lib/errors";

export interface CsvRow {
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  tags: string;
  notes: string | null;
}

export interface ImportResult {
  ok: boolean;
  inserted: number;
  skipped: number;
  errors: string[];
}

/**
 * Importe un lot de personnes depuis le CSV parsé côté client.
 * Déduplique par email (si email fourni et doublon dans l'org, on skip).
 */
export async function importPersonsAction(
  orgId: string,
  orgSlug: string,
  rows: CsvRow[]
): Promise<ImportResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, inserted: 0, skipped: 0, errors: ["Mode démo : import désactivé."] };
  }
  if (!rows.length) {
    return { ok: false, inserted: 0, skipped: 0, errors: ["Aucune ligne à importer."] };
  }

  const supabase = await createClient();
  const errors: string[] = [];
  let inserted = 0;
  let skipped = 0;

  // Récupérer les emails existants de l'org pour déduplication
  const { data: existing } = await supabase
    .from("persons")
    .select("email")
    .eq("organization_id", orgId)
    .not("email", "is", null);
  const existingEmails = new Set((existing ?? []).map((p: { email: string }) => p.email?.toLowerCase()));

  // Préparer les inserts par lot (chunk 50)
  const toInsert = [];
  for (const row of rows) {
    const emailLc = row.email?.toLowerCase() ?? null;
    if (emailLc && existingEmails.has(emailLc)) {
      skipped++;
      continue;
    }
    if (!row.name?.trim()) {
      errors.push(`Ligne ignorée : nom manquant (email: ${row.email ?? "—"})`);
      skipped++;
      continue;
    }
    toInsert.push({
      organization_id: orgId,
      name: row.name.trim(),
      email: emailLc,
      phone: row.phone?.trim() || null,
      role: row.role?.trim() || "adherent",
      tags: row.tags ? row.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      notes: row.notes?.trim() || null,
      status: "actif",
    });
    if (emailLc) existingEmails.add(emailLc); // éviter doublons dans le même CSV
  }

  // Insert par chunks de 50
  for (let i = 0; i < toInsert.length; i += 50) {
    const chunk = toInsert.slice(i, i + 50);
    const { error } = await supabase.from("persons").insert(chunk);
    if (error) {
      errors.push(`Erreur insertion lot ${Math.floor(i / 50) + 1} : ${humanError(error)}`);
    } else {
      inserted += chunk.length;
    }
  }

  revalidatePath(`/dashboard/${orgSlug}/personnes`);
  return { ok: errors.length === 0, inserted, skipped, errors };
}
