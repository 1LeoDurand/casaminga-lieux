import { createAdminClient } from "@/lib/admin/guard";
import { priorityLabel } from "@/lib/tasks-meta";
import { validateTaskByToken } from "./actions";

export const dynamic = "force-dynamic";

const WRAP: React.CSSProperties = {
  fontFamily: "'Poppins', sans-serif",
  background: "#FFFBF0",
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};
const CARD: React.CSSProperties = {
  width: "min(480px, 100%)",
  background: "#fff",
  border: "1px solid #F0E8E0",
  borderRadius: 20,
  boxShadow: "0 8px 32px rgba(44,44,44,0.08)",
  overflow: "hidden",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={WRAP}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={CARD}>
        <div style={{ background: "#FF8A65", padding: "20px 28px", textAlign: "center" }}>
          <span style={{ display: "inline-block", background: "rgba(255,255,255,0.2)", borderRadius: 12, padding: "6px 14px", color: "#fff", fontSize: 17, fontWeight: 800 }}>
            Casa Minga Lieux
          </span>
        </div>
        <div style={{ padding: "32px 28px" }}>{children}</div>
      </div>
    </main>
  );
}

export default async function TacheValidationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { token } = await params;
  const { done, error } = await searchParams;

  const admin = createAdminClient();

  if (!admin) {
    return (
      <Shell>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#2C2C2C", margin: "0 0 8px" }}>Service indisponible</h1>
        <p style={{ fontSize: 14, color: "#6B6460", lineHeight: 1.6, margin: 0 }}>
          La validation en ligne est momentanément indisponible. Réessayez plus tard.
        </p>
      </Shell>
    );
  }

  const { data: task } = await admin
    .from("tasks")
    .select("id, title, description, priority, due_date, status, validated_at, organization_id")
    .eq("validation_token", token)
    .maybeSingle();

  let orgName = "Votre lieu";
  if (task) {
    const { data: org } = await admin.from("organizations").select("name").eq("id", task.organization_id).maybeSingle();
    if (org?.name) orgName = org.name;
  }

  // Lien invalide
  if (!task) {
    return (
      <Shell>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#2C2C2C", margin: "0 0 8px" }}>Lien invalide</h1>
        <p style={{ fontSize: 14, color: "#6B6460", lineHeight: 1.6, margin: 0 }}>
          Ce lien de validation n&apos;est plus valide ou a expiré. Contactez l&apos;équipe qui vous a confié la tâche.
        </p>
      </Shell>
    );
  }

  // Déjà validée (ou validation qui vient d'aboutir)
  if (done || task.validated_at) {
    return (
      <Shell>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 12 }}>✅</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#2C2C2C", margin: "0 0 8px" }}>Tâche validée, merci !</h1>
          <p style={{ fontSize: 14.5, color: "#6B6460", lineHeight: 1.6, margin: "0 0 4px" }}>
            <strong style={{ color: "#2C2C2C" }}>« {task.title} »</strong>
          </p>
          <p style={{ fontSize: 14, color: "#6B6460", lineHeight: 1.6, margin: 0 }}>
            L&apos;équipe de {orgName} a été prévenue. Vous pouvez fermer cette page.
          </p>
        </div>
      </Shell>
    );
  }

  // Écran d'action
  return (
    <Shell>
      <span style={{ display: "inline-block", background: "#FFF0EB", color: "#E8714D", border: "1px solid #FFB4A2", borderRadius: 100, padding: "4px 12px", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.05em", marginBottom: 14 }}>
        Tâche qui vous est confiée
      </span>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#2C2C2C", margin: "0 0 6px", lineHeight: 1.25 }}>{task.title}</h1>
      <p style={{ fontSize: 13.5, color: "#9C9590", margin: "0 0 18px" }}>confiée par {orgName}</p>

      <div style={{ background: "#FAFAF7", border: "1px solid #E5DDD6", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ padding: "6px 0", fontSize: 13, color: "#9C9590", width: 110 }}>Priorité</td>
              <td style={{ padding: "6px 0", fontSize: 14, color: "#2C2C2C", fontWeight: 600 }}>{priorityLabel(task.priority)}</td>
            </tr>
            {task.due_date ? (
              <tr>
                <td style={{ padding: "6px 0", fontSize: 13, color: "#9C9590" }}>Échéance</td>
                <td style={{ padding: "6px 0", fontSize: 14, color: "#2C2C2C", fontWeight: 600 }}>{new Date(task.due_date).toLocaleDateString("fr-FR")}</td>
              </tr>
            ) : null}
            {task.description ? (
              <tr>
                <td style={{ padding: "6px 0", fontSize: 13, color: "#9C9590", verticalAlign: "top" }}>Détails</td>
                <td style={{ padding: "6px 0", fontSize: 14, color: "#2C2C2C", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{task.description}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {error ? (
        <p style={{ fontSize: 13, color: "#EF4444", margin: "0 0 14px" }}>
          Une erreur est survenue. Réessayez.
        </p>
      ) : null}

      <form action={validateTaskByToken}>
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          style={{ width: "100%", background: "#22C55E", color: "#fff", border: "none", borderRadius: 100, padding: "14px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
        >
          ✓ Marquer comme faite
        </button>
      </form>
      <p style={{ fontSize: 12, color: "#9C9590", textAlign: "center", margin: "14px 0 0", lineHeight: 1.5 }}>
        En cliquant, l&apos;équipe de {orgName} sera automatiquement prévenue que c&apos;est terminé.
      </p>
    </Shell>
  );
}
