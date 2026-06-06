import { notFound } from "next/navigation";
import { resolveScanLink } from "@/lib/tickets";
import { QrScanner } from "@/components/qr-scanner";

export const dynamic = "force-dynamic";

export const metadata = { title: "Scanner les billets" };

export default async function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await resolveScanLink(token);
  if (!link) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#fff", fontFamily: "'Poppins',sans-serif", padding: 24, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 40 }}>🔒</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>Lien de scan invalide</h1>
          <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 4 }}>Ce lien a été révoqué ou a expiré.</p>
        </div>
      </main>
    );
  }
  if (!link.eventId) notFound();
  return <QrScanner linkToken={token} eventTitle={link.eventTitle} />;
}
