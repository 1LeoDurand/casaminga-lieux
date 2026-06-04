"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";

type Result = { ok: boolean; error?: string; id?: string };
const NC: Result = { ok: false, error: "Disponible une fois Supabase configuré." };

function refresh(orgSlug: string) {
  revalidatePath(`/dashboard/${orgSlug}/personnes`);
}

export async function saveGroup(
  orgId: string,
  orgSlug: string,
  input: { name: string; color: string; description: string | null },
  id?: string
): Promise<Result> {
  if (!isSupabaseConfigured()) return NC;
  if (!input.name.trim()) return { ok: false, error: "Nom du groupe requis." };
  const supabase = await createClient();
  const payload = { organization_id: orgId, name: input.name.trim(), color: input.color, description: input.description };
  const { data, error } = id
    ? await supabase.from("member_groups").update(payload).eq("id", id).select("id").single()
    : await supabase.from("member_groups").insert(payload).select("id").single();
  if (error) return { ok: false, error: humanError(error) };
  refresh(orgSlug);
  return { ok: true, id: data?.id };
}

export async function deleteGroup(orgSlug: string, id: string): Promise<Result> {
  if (!isSupabaseConfigured()) return NC;
  const supabase = await createClient();
  const { error } = await supabase.from("member_groups").delete().eq("id", id);
  if (error) return { ok: false, error: humanError(error) };
  refresh(orgSlug);
  return { ok: true };
}

/** Remplace l'ensemble des membres d'un groupe. */
export async function setGroupMembers(orgSlug: string, groupId: string, personIds: string[]): Promise<Result> {
  if (!isSupabaseConfigured()) return NC;
  const supabase = await createClient();
  // Purge puis ré-insère (simple et fiable pour des effectifs modestes)
  const { error: delErr } = await supabase.from("member_group_links").delete().eq("group_id", groupId);
  if (delErr) return { ok: false, error: humanError(delErr) };
  if (personIds.length > 0) {
    const rows = personIds.map((pid) => ({ group_id: groupId, person_id: pid }));
    const { error } = await supabase.from("member_group_links").insert(rows);
    if (error) return { ok: false, error: humanError(error) };
  }
  refresh(orgSlug);
  return { ok: true };
}
