"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin, createAdminClient } from "@/lib/admin/guard";
import { messageRetrait } from "@/lib/admin/retraits";

type Res = { ok: boolean; error?: string; resume?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PORTEES = ["medias", "fiches", "import"];
const CANAUX = ["courriel", "telephone", "formulaire", "equipe", "plainte"];

function uuidOuNull(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return UUID.test(s) ? s : null;
}

/** Places a withdrawal through the SQL function (one transaction, reversible). */
export async function poserRetrait(formData: FormData): Promise<Res> {
  const { email } = await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Service indisponible." };

  const organisation = uuidOuNull(formData.get("organization_id"));
  const lieu = uuidOuNull(formData.get("annuaire_lieu_id"));
  const portee = String(formData.get("portee") ?? "");
  const canal = String(formData.get("canal") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();
  const sourceBrute = String(formData.get("source") ?? "").trim();
  const demandeLe = String(formData.get("demande_le") ?? "").trim();
  const thread = uuidOuNull(formData.get("thread"));

  if (!organisation && !lieu) return { ok: false, error: messageRetrait("retrait_cible_manquante") };
  if (!PORTEES.includes(portee)) return { ok: false, error: messageRetrait("retrait_portee_invalide") };
  if (!CANAUX.includes(canal)) return { ok: false, error: "Choisissez le canal de la demande." };
  if (motif.length < 3 || motif.length > 500) return { ok: false, error: "Le motif doit faire entre 3 et 500 caractères." };
  if (demandeLe && !/^\d{4}-\d{2}-\d{2}$/.test(demandeLe)) return { ok: false, error: "La date de la demande n'est pas valide." };
  // A source only makes sense for the "import" scope.
  const source = portee === "import" && sourceBrute ? sourceBrute.slice(0, 120) : null;

  const { data, error } = await admin.rpc("retrait_poser", {
    p_organization_id: organisation,
    p_annuaire_lieu_id: lieu,
    p_portee: portee,
    p_source: source,
    p_motif: motif,
    p_canal: canal,
    p_thread: thread,
    p_demande_le: demandeLe || null,
    p_par: email,
  });
  if (error) return { ok: false, error: messageRetrait(error.message) };

  revalidatePath("/admin/portail/retraits");
  revalidatePath("/admin/portail");
  const r = (data ?? {}) as { fiches?: number; vitrines?: number; annuaire?: number };
  return {
    ok: true,
    resume: `Retrait posé : ${r.fiches ?? 0} fiche(s) touchée(s), ${r.vitrines ?? 0} vitrine(s), ${r.annuaire ?? 0} lieu(x) d'annuaire masqué(s).`,
  };
}

/** Lifts a withdrawal: the saved state of each event is put back. */
export async function leverRetrait(formData: FormData): Promise<Res> {
  const { email } = await requireSuperAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Service indisponible." };

  const id = uuidOuNull(formData.get("retrait_id"));
  const motif = String(formData.get("motif") ?? "").trim();
  if (!id) return { ok: false, error: messageRetrait("retrait_introuvable") };
  if (motif.length < 3 || motif.length > 500) return { ok: false, error: "Le motif de la levée doit faire entre 3 et 500 caractères." };

  const { error } = await admin.rpc("retrait_lever", { p_retrait_id: id, p_motif: motif, p_par: email });
  if (error) return { ok: false, error: messageRetrait(error.message) };

  revalidatePath("/admin/portail/retraits");
  revalidatePath("/admin/portail");
  return { ok: true, resume: "Retrait levé. Les fiches sont remises dans l'état d'avant." };
}
