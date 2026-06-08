"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createTask, deleteTask, updateTask, type TaskInput } from "@/lib/data";
import { priorityLabel } from "@/lib/tasks-meta";

function refresh(s: string) { revalidatePath(`/dashboard/${s}/taches`); revalidatePath(`/dashboard/${s}`); }

export async function createTaskAction(orgSlug: string, input: TaskInput): Promise<{ ok: boolean }> {
  const ok = await createTask(input); if (ok) refresh(orgSlug); return { ok };
}
export async function updateTaskAction(orgSlug: string, id: string, patch: Partial<TaskInput>): Promise<{ ok: boolean }> {
  const ok = await updateTask(id, patch); if (ok) refresh(orgSlug); return { ok };
}
export async function deleteTaskAction(orgSlug: string, id: string): Promise<{ ok: boolean }> {
  const ok = await deleteTask(id); if (ok) refresh(orgSlug); return { ok };
}

const APP_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://admin.casaminga.com";

type Res = { ok: boolean; error?: string };

/** Charge la tâche + l'assigné (personne avec email) + le nom de l'org, en garantissant un token de validation. */
async function loadTaskContext(taskId: string) {
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, title, description, priority, due_date, status, assignee_id, validation_token, organization_id, assignee_notified_at")
    .eq("id", taskId)
    .single();
  if (!task) return { error: "Tâche introuvable." as const };
  if (!task.assignee_id) return { error: "Aucune personne assignée." as const };

  const { data: person } = await supabase
    .from("persons")
    .select("name, email")
    .eq("id", task.assignee_id)
    .single();
  if (!person?.email) return { error: "L'assigné·e n'a pas d'adresse email. Ajoutez-en une dans Personnes." as const };

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", task.organization_id)
    .single();

  // Garantit un token unique pour le lien public de validation
  let token = task.validation_token as string | null;
  if (!token) {
    token = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/-/g, "");
    await supabase.from("tasks").update({ validation_token: token }).eq("id", taskId);
  }

  return { supabase, task, person, orgName: org?.name ?? "Votre lieu", token };
}

/** Prévient l'assigné·e par email qu'une tâche lui est confiée. */
export async function notifyAssigneeAction(orgSlug: string, taskId: string): Promise<Res> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Service non configuré." };
  const ctx = await loadTaskContext(taskId);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { supabase, task, person, orgName, token } = ctx;

  const { sendMail } = await import("@/lib/mail");
  const { tplTacheAssignee } = await import("@/lib/mail-templates");

  const ok = await sendMail({
    to: person.email!,
    subject: `Une tâche vous est confiée : ${task.title}`,
    html: tplTacheAssignee({
      orgName,
      assigneeName: person.name,
      title: task.title,
      description: task.description,
      dueDate: task.due_date,
      priorityLabel: priorityLabel(task.priority),
      validateUrl: `${APP_BASE}/tache/${token}`,
    }),
    category: "tache",
    organizationId: task.organization_id,
  });
  if (!ok) return { ok: false, error: "Envoi impossible (SMTP non configuré ?)." };

  await supabase.from("tasks").update({ assignee_notified_at: new Date().toISOString() }).eq("id", taskId);
  refresh(orgSlug);
  return { ok: true };
}

/** Relance l'assigné·e par email. */
export async function remindAssigneeAction(orgSlug: string, taskId: string): Promise<Res> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Service non configuré." };
  const ctx = await loadTaskContext(taskId);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { supabase, task, person, orgName, token } = ctx;

  const { sendMail } = await import("@/lib/mail");
  const { tplTacheRappel } = await import("@/lib/mail-templates");

  const ok = await sendMail({
    to: person.email!,
    subject: `Rappel — ${task.title}`,
    html: tplTacheRappel({
      orgName,
      assigneeName: person.name,
      title: task.title,
      dueDate: task.due_date,
      validateUrl: `${APP_BASE}/tache/${token}`,
    }),
    category: "tache",
    organizationId: task.organization_id,
  });
  if (!ok) return { ok: false, error: "Envoi impossible (SMTP non configuré ?)." };

  const now = new Date().toISOString();
  await supabase.from("tasks").update({ last_reminder_at: now, assignee_notified_at: task.assignee_notified_at ?? now }).eq("id", taskId);
  refresh(orgSlug);
  return { ok: true };
}
