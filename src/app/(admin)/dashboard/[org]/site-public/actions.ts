"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";
import type { SiteContent } from "@/lib/site-public/types";

type Result = { ok: boolean; error?: string };

export async function saveSiteConfig(
  orgId: string,
  orgSlug: string,
  payload: {
    title: string;
    seo_description: string | null;
    status: "brouillon" | "publie";
    content: SiteContent;
  }
): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Disponible une fois Supabase configuré." };
  const supabase = await createClient();

  const row = {
    organization_id: orgId,
    slug: orgSlug,
    title: payload.title,
    seo_description: payload.seo_description,
    status: payload.status,
    content_blocks: payload.content,
    published_at: payload.status === "publie" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("public_sites")
    .upsert(row, { onConflict: "organization_id" });

  if (error) {
    console.error("saveSiteConfig:", error);
    return { ok: false, error: humanError(error) };
  }

  revalidatePath(`/dashboard/${orgSlug}/site-public`);
  revalidatePath(`/site/${orgSlug}`);
  return { ok: true };
}
