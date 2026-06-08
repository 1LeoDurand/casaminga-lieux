import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/admin/guard";
import { ticketQrDataUrl } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export default async function BilletPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  if (!admin) notFound();

  const { data: reg } = await admin
    .from("event_tickets")
    .select("holder_name, checked_in_at, event_id")
    .eq("ticket_token", token)
    .maybeSingle();
  if (!reg) notFound();

  const { data: ev } = await admin
    .from("evenements")
    .select("title, start_at, end_at")
    .eq("id", reg.event_id)
    .maybeSingle();

  const qr = await ticketQrDataUrl(token);
  const dateStr = ev
    ? new Date(ev.start_at).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    : "";
  const timeStr = ev
    ? new Date(ev.start_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : "";
  const used = !!reg.checked_in_at;

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFBF0", fontFamily: "'Poppins',sans-serif", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 24, boxShadow: "0 8px 32px rgba(28,28,28,0.08)", overflow: "hidden", border: "1px solid #E5DDD6" }}>
        <div style={{ background: "#FF8A65", color: "#fff", padding: "20px 24px" }}>
          <div style={{ fontSize: 12, opacity: 0.9, textTransform: "uppercase", letterSpacing: 1 }}>Billet</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{ev?.title ?? "Événement"}</div>
        </div>
        <div style={{ padding: 24, textAlign: "center" }}>
          <img src={qr} alt="QR billet" width={240} height={240} style={{ display: "block", margin: "0 auto", opacity: used ? 0.35 : 1 }} />
          {used && (
            <div style={{ marginTop: 10, color: "#2f8a4c", fontWeight: 700, fontSize: 14 }}>
              ✅ Déjà validé le {new Date(reg.checked_in_at!).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
          <p style={{ marginTop: 14, fontSize: 13, color: "#9c9590" }}>Présentez ce QR code à l&apos;entrée.</p>
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px dashed #E5DDD6", textAlign: "left", fontSize: 14, color: "#2C2C2C" }}>
            <div style={{ marginBottom: 6 }}><strong>{reg.holder_name}</strong></div>
            {ev && <div style={{ color: "#6B6460" }}>📅 {dateStr} · {timeStr}</div>}
          </div>
        </div>
      </div>
    </main>
  );
}
