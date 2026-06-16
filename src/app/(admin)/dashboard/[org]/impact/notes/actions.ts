"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";
import { buildSnapshot } from "@/lib/coordination/data";
import type { NoteSections, PeriodType, SectionKey, NoteStatus } from "@/lib/coordination/types";

type ActionResult = { ok: boolean; error?: string; id?: string };

const NOT_CONFIGURED: ActionResult = {
  ok: false,
  error: "Notes de coordination disponibles une fois Supabase configuré.",
};

const ALL_KEYS: SectionKey[] = ["finances", "events", "residences", "impact"];

function emptySections(enabled: SectionKey[]): NoteSections {
  const set = new Set(enabled);
  return ALL_KEYS.reduce((acc, k) => {
    acc[k] = { enabled: set.has(k), commentary: "" };
    return acc;
  }, {} as NoteSections);
}

export interface CreateNoteInput {
  organization_id: string;
  title: string;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  sections: SectionKey[]; // blocs activés
}

/** Crée une note + fige le snapshot des données pour les blocs choisis. */
export async function createCoordinationNote(orgSlug: string, input: CreateNoteInput): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  if (!input.title.trim()) return { ok: false, error: "Le titre est obligatoire." };
  if (input.period_start > input.period_end) return { ok: false, error: "La période est invalide (début après fin)." };

  const supabase = await createClient();
  const snapshot = await buildSnapshot(input.organization_id, input.period_start, input.period_end, input.sections);

  const { data, error } = await supabase
    .from("coordination_notes")
    .insert({
      organization_id: input.organization_id,
      title: input.title.trim(),
      period_type: input.period_type,
      period_start: input.period_start,
      period_end: input.period_end,
      intro: null,
      conclusion: null,
      sections: emptySections(input.sections),
      snapshot,
      status: "brouillon",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/impact`);
  return { ok: true, id: data.id };
}

export interface UpdateNoteInput {
  title?: string;
  intro?: string | null;
  conclusion?: string | null;
  sections?: NoteSections;
  status?: NoteStatus;
}

/** Met à jour le texte / les commentaires / le statut d'une note. */
export async function updateCoordinationNote(orgSlug: string, id: string, input: UpdateNoteInput): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) payload.title = input.title.trim();
  if (input.intro !== undefined) payload.intro = input.intro;
  if (input.conclusion !== undefined) payload.conclusion = input.conclusion;
  if (input.sections !== undefined) payload.sections = input.sections;
  if (input.status !== undefined) payload.status = input.status;

  const { error } = await supabase.from("coordination_notes").update(payload).eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/impact`);
  revalidatePath(`/dashboard/${orgSlug}/impact/notes/${id}`);
  return { ok: true, id };
}

/** Recalcule le snapshot (données fraîches) en gardant le texte du coordinateur. */
export async function refreshCoordinationSnapshot(orgSlug: string, id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { data: note } = await supabase
    .from("coordination_notes")
    .select("organization_id, period_start, period_end, sections")
    .eq("id", id)
    .maybeSingle();
  if (!note) return { ok: false, error: "Note introuvable." };

  const sections = (note.sections ?? {}) as NoteSections;
  const enabled = ALL_KEYS.filter((k) => sections[k]?.enabled);
  const snapshot = await buildSnapshot(note.organization_id, note.period_start, note.period_end, enabled);

  const { error } = await supabase
    .from("coordination_notes")
    .update({ snapshot, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/impact/notes/${id}`);
  return { ok: true, id };
}

export async function deleteCoordinationNote(orgSlug: string, id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { error } = await supabase.from("coordination_notes").delete().eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  revalidatePath(`/dashboard/${orgSlug}/impact`);
  return { ok: true };
}
