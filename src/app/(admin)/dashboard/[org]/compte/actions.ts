"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { humanError } from "@/lib/errors";

type AR = { ok: boolean; error?: string; message?: string };

/** Met à jour le nom complet de l'utilisateur connecté (table profiles). */
export async function updateProfileAction(orgSlug: string, fullName: string): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const name = fullName.trim();
  if (!name) return { ok: false, error: "Le nom ne peut pas être vide." };
  if (name.length > 120) return { ok: false, error: "Nom trop long (120 caractères max)." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: name })
    .eq("id", user.id);
  if (error) {
    console.error("updateProfileAction", error.code);
    return { ok: false, error: humanError(error) };
  }
  // Rafraîchit le layout pour mettre à jour le nom/initiales de l'avatar.
  revalidatePath(`/dashboard/${orgSlug}`, "layout");
  return { ok: true, message: "Profil mis à jour." };
}

/** Change l'email de connexion. Supabase envoie un email de confirmation. */
export async function updateEmailAction(newEmail: string): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  const email = newEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Adresse email invalide." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };
  if (email === (user.email ?? "").toLowerCase()) {
    return { ok: false, error: "C'est déjà votre adresse actuelle." };
  }

  const { error } = await supabase.auth.updateUser({ email });
  if (error) {
    console.error("updateEmailAction", error.message);
    return { ok: false, error: "Impossible de changer l'email. Réessayez dans un instant." };
  }
  return {
    ok: true,
    message: "Un email de confirmation a été envoyé à la nouvelle adresse. Le changement sera effectif après validation.",
  };
}

/** Change le mot de passe après vérification du mot de passe actuel. */
export async function updatePasswordAction(currentPassword: string, newPassword: string): Promise<AR> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Non configuré." };
  if (newPassword.length < 8) {
    return { ok: false, error: "Le nouveau mot de passe doit faire au moins 8 caractères." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Non connecté." };

  // Vérifie le mot de passe actuel en se réauthentifiant (même utilisateur).
  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signErr) return { ok: false, error: "Mot de passe actuel incorrect." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    console.error("updatePasswordAction", error.message);
    return { ok: false, error: "Impossible de changer le mot de passe. Réessayez dans un instant." };
  }
  return { ok: true, message: "Mot de passe mis à jour." };
}
