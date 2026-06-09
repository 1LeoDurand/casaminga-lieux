"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(id: string, orgSlug: string) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  revalidatePath(`/dashboard/${orgSlug}/notifications`);
}

export async function markAllNotificationsRead(orgId: string, orgSlug: string) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .is("read_at", null);
  revalidatePath(`/dashboard/${orgSlug}/notifications`);
}
