"use server";
import { revalidatePath } from "next/cache";
import { createTask, deleteTask, updateTask, type TaskInput } from "@/lib/data";
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
