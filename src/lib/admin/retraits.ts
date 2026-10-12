import { createAdminClient } from "./guard";

/**
 * Withdrawals on request (P2): read side and error wording.
 * The write side is the pair of SQL functions retrait_poser / retrait_lever,
 * called by the server actions in app/admin/portail/retraits/actions.ts.
 * The journal never holds the requester's name or email (R13), only a channel
 * and, optionally, a link to a contact thread.
 */

export * from "./retraits-constantes";
import type { Portee, Canal } from "./retraits-constantes";

export interface RetraitLigne {
  id: string;
  cible: string;
  portee: Portee;
  source: string | null;
  motif: string;
  canal: Canal;
  demandeLe: string;
  poseLe: string;
  posePar: string;
  leveLe: string | null;
  levePar: string | null;
  leveMotif: string | null;
  fiches: number;
}

export async function getRetraits(): Promise<{ actifs: RetraitLigne[]; leves: RetraitLigne[] } | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("import_retraits")
    .select("id, organization_id, annuaire_lieu_id, portee, source, motif, demande_canal, demande_le, pose_le, pose_par, leve_le, leve_par, leve_motif")
    .order("pose_le", { ascending: false })
    .limit(300);
  if (error || !data) return null;

  const orgIds = [...new Set(data.map((r) => r.organization_id).filter(Boolean))] as string[];
  const lieuIds = [...new Set(data.map((r) => r.annuaire_lieu_id).filter(Boolean))] as string[];
  const ids = data.map((r) => r.id as string);
  const [orgs, lieux, fiches] = await Promise.all([
    orgIds.length ? admin.from("organizations").select("id, name").in("id", orgIds) : Promise.resolve({ data: [] }),
    lieuIds.length ? admin.from("annuaire_lieux").select("id, nom").in("id", lieuIds) : Promise.resolve({ data: [] }),
    ids.length ? admin.from("import_retraits_fiches").select("retrait_id").in("retrait_id", ids).limit(20000) : Promise.resolve({ data: [] }),
  ]);
  const nomOrg = new Map((orgs.data ?? []).map((o) => [o.id as string, o.name as string]));
  const nomLieu = new Map((lieux.data ?? []).map((l) => [l.id as string, l.nom as string]));
  const nbFiches = new Map<string, number>();
  for (const f of fiches.data ?? []) nbFiches.set(f.retrait_id as string, (nbFiches.get(f.retrait_id as string) ?? 0) + 1);

  const lignes: RetraitLigne[] = data.map((r) => ({
    id: r.id as string,
    cible:
      (r.organization_id && nomOrg.get(r.organization_id as string)) ||
      (r.annuaire_lieu_id && nomLieu.get(r.annuaire_lieu_id as string)) ||
      "Cible supprimée",
    portee: r.portee as Portee,
    source: (r.source as string | null) ?? null,
    motif: r.motif as string,
    canal: r.demande_canal as Canal,
    demandeLe: r.demande_le as string,
    poseLe: r.pose_le as string,
    posePar: r.pose_par as string,
    leveLe: (r.leve_le as string | null) ?? null,
    levePar: (r.leve_par as string | null) ?? null,
    leveMotif: (r.leve_motif as string | null) ?? null,
    fiches: nbFiches.get(r.id as string) ?? 0,
  }));
  return { actifs: lignes.filter((l) => !l.leveLe), leves: lignes.filter((l) => l.leveLe) };
}

export async function countRetraitsActifs(): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;
  const { count } = await admin
    .from("import_retraits")
    .select("id", { count: "exact", head: true })
    .is("leve_le", null);
  return count ?? 0;
}

export interface CibleRetrait {
  type: "organisation" | "lieu";
  id: string;
  nom: string;
  detail: string;
  /** False when the organization is claimed or born in the admin. */
  retirable: boolean;
  raison?: string;
  fichesTotal: number;
  fichesAvenir: number;
  fichesAvecMedias: number;
  sources: string[];
}

const SOURCE_MAISON = "casaminga";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

async function compter(admin: Admin, orgIds: string[]) {
  const out = new Map<string, { total: number; avenir: number; medias: number; sources: Set<string> }>();
  if (!orgIds.length) return out;
  const { data: evs } = await admin
    .from("evenements")
    .select("id, organization_id, start_at, description, photos")
    .in("organization_id", orgIds)
    .limit(20000);
  const orgDe = new Map<string, string>();
  const now = Date.now();
  for (const e of evs ?? []) {
    const o = e.organization_id as string;
    orgDe.set(e.id as string, o);
    const c = out.get(o) ?? { total: 0, avenir: 0, medias: 0, sources: new Set<string>() };
    c.total += 1;
    if (new Date(e.start_at as string).getTime() >= now) c.avenir += 1;
    const photos = (e.photos as string[] | null) ?? [];
    if ((e.description as string | null) || photos.length) c.medias += 1;
    out.set(o, c);
  }
  const ids = [...orgDe.keys()];
  for (let i = 0; i < ids.length; i += 200) {
    const { data: imp } = await admin.from("evenements_import").select("event_id, source").in("event_id", ids.slice(i, i + 200));
    for (const r of imp ?? []) {
      const o = orgDe.get(r.event_id as string);
      if (o && r.source) out.get(o)?.sources.add(r.source as string);
    }
  }
  return out;
}

function nettoyerRecherche(q: string): string {
  // Keep letters, digits and spaces: the value goes inside a PostgREST filter.
  return q.replace(/[^\p{L}\p{N} '-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Imported organizations (not claimed, not born in the admin) and directory places matching a name. */
export async function chercherCibles(q: string): Promise<CibleRetrait[]> {
  const admin = createAdminClient();
  const terme = nettoyerRecherche(q);
  if (!admin || terme.length < 2) return [];

  const [orgs, lieux] = await Promise.all([
    admin
      .from("organizations")
      .select("id, name, source, claimed_at")
      .ilike("name", `%${terme}%`)
      .not("source", "is", null)
      .neq("source", SOURCE_MAISON)
      .is("claimed_at", null)
      .order("name")
      .limit(15),
    admin
      .from("annuaire_lieux")
      .select("id, nom, commune, organization_id, masque")
      .ilike("nom", `%${terme}%`)
      .order("nom")
      .limit(15),
  ]);
  const orgLignes = orgs.data ?? [];
  const compteurs = await compter(admin, orgLignes.map((o) => o.id as string));

  const resultat: CibleRetrait[] = orgLignes.map((o) => {
    const c = compteurs.get(o.id as string);
    return {
      type: "organisation",
      id: o.id as string,
      nom: o.name as string,
      detail: `Organisation importée (${o.source})`,
      retirable: true,
      fichesTotal: c?.total ?? 0,
      fichesAvenir: c?.avenir ?? 0,
      fichesAvecMedias: c?.medias ?? 0,
      sources: [...(c?.sources ?? [])].sort(),
    };
  });
  for (const l of lieux.data ?? []) {
    resultat.push({
      type: "lieu",
      id: l.id as string,
      nom: l.nom as string,
      detail: `Lieu de l'annuaire${l.commune ? `, ${l.commune}` : ""}${l.masque ? " (déjà masqué)" : ""}`,
      retirable: true,
      fichesTotal: 0,
      fichesAvenir: 0,
      fichesAvecMedias: 0,
      sources: [],
    });
  }
  return resultat;
}

/** One target by id, for the prefilled form (link from the moderation page). */
export async function getCible(type: "organisation" | "lieu", id: string): Promise<CibleRetrait | null> {
  const admin = createAdminClient();
  if (!admin || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (type === "lieu") {
    const { data: l } = await admin.from("annuaire_lieux").select("id, nom, commune, masque").eq("id", id).maybeSingle();
    if (!l) return null;
    return {
      type: "lieu", id, nom: l.nom as string,
      detail: `Lieu de l'annuaire${l.commune ? `, ${l.commune}` : ""}${l.masque ? " (déjà masqué)" : ""}`,
      retirable: true, fichesTotal: 0, fichesAvenir: 0, fichesAvecMedias: 0, sources: [],
    };
  }
  const { data: o } = await admin.from("organizations").select("id, name, source, claimed_at").eq("id", id).maybeSingle();
  if (!o) return null;
  const c = (await compter(admin, [id])).get(id);
  const gere = !!o.claimed_at || o.source === SOURCE_MAISON || !o.source;
  return {
    type: "organisation", id, nom: o.name as string,
    detail: gere ? "Organisation gérée par ses membres" : `Organisation importée (${o.source})`,
    retirable: !gere,
    raison: gere ? "Cette organisation gère ses fiches depuis son espace : un retrait n'est pas possible ici." : undefined,
    fichesTotal: c?.total ?? 0, fichesAvenir: c?.avenir ?? 0, fichesAvecMedias: c?.medias ?? 0,
    sources: [...(c?.sources ?? [])].sort(),
  };
}
