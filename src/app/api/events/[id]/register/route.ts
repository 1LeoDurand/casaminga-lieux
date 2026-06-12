import { NextRequest, NextResponse } from "next/server";
import { registerForEvent } from "@/lib/events/register";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;

  let body: { full_name: string; email: string; phone?: string; participants?: string[]; notes?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const res = await registerForEvent({
    eventId,
    fullName: body.full_name ?? "",
    email: body.email ?? "",
    phone: body.phone,
    participants: body.participants,
    notes: body.notes,
    source: "public",
  });

  if (!res.ok) {
    const status = res.error === "Événement introuvable." ? 404
      : res.error === "Service non configuré." ? 503
      : 400;
    return NextResponse.json({ error: res.error }, { status });
  }
  return NextResponse.json({ ok: true, status: res.status, id: res.registrationId, tickets: res.ticketsCount });
}
