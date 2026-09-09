/**
 * Habillage de la page de revendication.
 *
 * Repris tel quel de /rejoindre/[token], son voisin immédiat : ces deux pages
 * sont les seules de l'admin qu'un visiteur non connecté voit, et elles se
 * suivent dans le même parcours. Les faire diverger donnerait l'impression de
 * changer de site en cours de route.
 */

export const inputCls =
  "w-full rounded-xl border border-[#E5DDD6] bg-[#FAFAF7] px-4 py-3 text-sm text-[#2C2C2C] placeholder:text-[#9C9590] outline-none transition focus:border-[#FF8A65] focus:ring-2 focus:ring-[#FF8A65]/20 disabled:opacity-60";

export const mainStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#FFFBF0",
  fontFamily: "'Poppins', sans-serif",
  padding: "24px",
};

export const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 20,
  padding: "32px 28px",
  boxShadow: "0 8px 32px rgba(28,28,28,0.08)",
  border: "1px solid #E5DDD6",
};

export const btnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "14px",
  borderRadius: 100,
  background: "#FF8A65",
  color: "#fff",
  fontWeight: 700,
  fontSize: 15,
  border: "none",
  textAlign: "center",
  textDecoration: "none",
};

export const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#2C2C2C",
};

export const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
};
