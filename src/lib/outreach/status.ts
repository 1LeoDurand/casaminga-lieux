/**
 * Parameterised state machine (spec section 4). Pure functions over a
 * ProgramConfig loaded from outreach_program_stages / outreach_program_transitions
 * (see programs.ts, which caches the load per request). Safe for client code.
 *
 * The database trigger outreach_threads_stage() is the last line of defence:
 * it refuses an unknown stage or a transition absent from the table. This
 * module adds the actor check (the trigger only knows the actor when an RPC
 * states it) and the closed-reason rule.
 */

import type {
  ClosedReason, OutreachActor, ProgramConfig, Stage, StageRole, Transition,
} from "./types";

export type { StageRole, ClosedReason, OutreachActor, ProgramConfig } from "./types";

export function stageBySlug(program: ProgramConfig, slug: string): Stage | null {
  return program.stages.find((s) => s.slug === slug) ?? null;
}

export function stageByRole(program: ProgramConfig, role: StageRole): Stage | null {
  return program.stages.find((s) => s.role === role) ?? null;
}

export function transitionOf(program: ProgramConfig, from: string, to: string): Transition | null {
  return program.transitions.find((t) => t.from_slug === from && t.to_slug === to) ?? null;
}

/**
 * True when `actor` may move a thread from `from` to `to` in this program.
 * A move into a "clos" stage needs a closed reason; a move to any other stage
 * must not carry one (same rule as the database trigger).
 */
export function canTransition(
  program: ProgramConfig,
  from: string,
  to: string,
  actor: OutreachActor,
  reason?: ClosedReason,
): boolean {
  const target = stageBySlug(program, to);
  if (!target || !stageBySlug(program, from)) return false;
  const tr = transitionOf(program, from, to);
  if (!tr || !tr.actors.includes(actor)) return false;
  if ((target.role === "clos") !== (reason !== undefined)) return false;
  return true;
}

/** Stages the actor may move a thread to from `from`, in pipeline order. */
export function allowedTargets(program: ProgramConfig, from: string, actor: OutreachActor): Stage[] {
  return program.transitions
    .filter((t) => t.from_slug === from && t.actors.includes(actor))
    .map((t) => stageBySlug(program, t.to_slug))
    .filter((s): s is Stage => s !== null)
    .sort((a, b) => a.position - b.position);
}

/** Stages shown as columns on the board, in order. */
export function boardStages(program: ProgramConfig): Stage[] {
  return program.stages.filter((s) => s.on_board).sort((a, b) => a.position - b.position);
}

/** Closed reasons Leo may pick by hand ('rebond' is only set by the mail engine). */
export const MANUAL_CLOSED_REASONS: ClosedReason[] = [
  "refus", "ne_plus_ecrire", "sans_suite", "abandonne", "doublon", "resolu", "sans_reponse",
];

/** Roles whose threads are still alive. */
export function isActiveRole(role: StageRole | null | undefined): boolean {
  return role !== undefined && role !== null && role !== "clos";
}
