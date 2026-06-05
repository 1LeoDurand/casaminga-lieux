// Constantes & helpers purs des pôles (non "use server" — importables partout).

export type PoleRole = "responsable" | "referent_ca" | "resp_facturation" | "membre";

export const POLE_ROLES: { value: PoleRole; label: string }[] = [
  { value: "responsable",      label: "Responsable de pôle" },
  { value: "referent_ca",      label: "Référent CA" },
  { value: "resp_facturation", label: "Responsable facturation" },
  { value: "membre",           label: "Membre" },
];

export function poleRoleLabel(r: string): string {
  return POLE_ROLES.find((x) => x.value === r)?.label ?? r;
}

export function currentFiscalYear(): number {
  return new Date().getFullYear();
}
