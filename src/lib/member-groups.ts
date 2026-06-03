import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface MemberGroup {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  description: string | null;
  memberCount: number;
  memberIds: string[];
}

/** Groupes d'une org avec leurs membres (ids) et le compte. */
export async function getMemberGroups(orgId: string): Promise<MemberGroup[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  const { data: groups } = await supabase
    .from("member_groups")
    .select("id, organization_id, name, color, description")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });
  if (!groups) return [];

  const { data: links } = await supabase
    .from("member_group_links")
    .select("group_id, person_id");

  const byGroup = new Map<string, string[]>();
  for (const l of links ?? []) {
    const arr = byGroup.get(l.group_id) ?? [];
    arr.push(l.person_id);
    byGroup.set(l.group_id, arr);
  }

  return groups.map((g) => {
    const ids = byGroup.get(g.id) ?? [];
    return { ...g, color: g.color ?? "#FF8A65", memberIds: ids, memberCount: ids.length };
  });
}
