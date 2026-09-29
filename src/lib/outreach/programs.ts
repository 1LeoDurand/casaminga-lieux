import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/admin/guard";
import type { Program, ProgramConfig, ProgramSettings, Stage, Transition } from "./types";

/**
 * Loads every program with its stages, transitions and settings. Memoised for
 * the duration of one request (React cache): a page, a server action or a cron
 * run reads the configuration once. Service role only, after requireSuperAdmin().
 */
export const getProgramConfigs = cache(async (): Promise<ProgramConfig[]> => {
  const admin = createAdminClient();
  if (!admin) return [];

  const [programs, stages, transitions, settings] = await Promise.all([
    admin.from("outreach_programs").select("*").order("created_at"),
    admin.from("outreach_program_stages").select("*").order("position"),
    admin.from("outreach_program_transitions").select("*"),
    admin.from("outreach_settings").select("*"),
  ]);
  if (programs.error || !programs.data) return [];

  const stagesBy = new Map<string, Stage[]>();
  for (const s of (stages.data ?? []) as Stage[]) {
    const list = stagesBy.get(s.program_id) ?? [];
    list.push(s);
    stagesBy.set(s.program_id, list);
  }
  const transBy = new Map<string, Transition[]>();
  for (const t of (transitions.data ?? []) as Transition[]) {
    const list = transBy.get(t.program_id) ?? [];
    list.push(t);
    transBy.set(t.program_id, list);
  }
  const settingsBy = new Map<string, ProgramSettings>();
  for (const s of (settings.data ?? []) as ProgramSettings[]) settingsBy.set(s.program_id, s);

  return (programs.data as Program[]).map((p) => ({
    ...p,
    stages: stagesBy.get(p.id) ?? [],
    transitions: transBy.get(p.id) ?? [],
    settings: settingsBy.get(p.id) ?? null,
  }));
});

/** One program by slug or id. */
export async function getProgramConfig(slugOrId: string): Promise<ProgramConfig | null> {
  const all = await getProgramConfigs();
  return all.find((p) => p.slug === slugOrId || p.id === slugOrId) ?? null;
}

/** The program named in ?programme=, or null for "Tous". */
export async function resolveProgramParam(param: string | undefined): Promise<ProgramConfig | null> {
  if (!param || param === "tous") return null;
  return getProgramConfig(param);
}
