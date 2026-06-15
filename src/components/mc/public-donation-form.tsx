"use client";

import { useState, useTransition } from "react";
import { submitPublicDonation } from "@/app/site/[slug]/soutenir/actions";

interface PublicCampaignLite {
  id: string;
  title: string;
}

/**
 * Formulaire de don public (page « Soutenir »).
 * Montants suggérés + libre. Paiement en ligne si Stripe connecté, sinon promesse de don.
 * Le style s'adapte via la couleur d'accent du thème.
 */
export function PublicDonationForm({
  slug,
  accent,
  campaigns,
}: {
  slug: string;
  accent: string;
  campaigns: PublicCampaignLite[];
}) {
  const [amount, setAmount] = useState<string>("50");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [online, setOnline] = useState(true);
  const [done, setDone] = useState<null | "pledged">(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const presets = [20, 50, 100, 200];
  const fieldCls =
    "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-[#2C2C2C] outline-none transition focus:border-black/30";

  function submit() {
    setError(null);
    const a = parseFloat(amount.replace(",", "."));
    if (isNaN(a) || a <= 0) { setError("Indiquez un montant valide."); return; }
    if (!name.trim()) { setError("Indiquez votre nom."); return; }
    start(async () => {
      const res = await submitPublicDonation({
        slug,
        donorName: name.trim(),
        donorEmail: email.trim(),
        donorAddress: address.trim(),
        amount: a,
        campaignId: campaignId || null,
        online,
      });
      if (!res.ok) { setError(res.error); return; }
      if (res.redirectUrl) { window.location.href = res.redirectUrl; return; }
      setDone("pledged");
    });
  }

  if (done === "pledged") {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-6 text-center">
        <div className="text-3xl">🙏</div>
        <h3 className="mt-2 text-lg font-bold text-[#2C2C2C]">Merci pour votre soutien !</h3>
        <p className="mt-2 text-sm text-[#6B6460]">
          Votre intention de don a bien été enregistrée. L&apos;équipe vous recontacte avec les
          modalités de règlement (virement / chèque) et votre reçu fiscal.
        </p>
      </div>
    );
  }

  const reduction = (() => {
    const a = parseFloat(amount.replace(",", "."));
    if (isNaN(a) || a <= 0) return null;
    return { cost: (a * 0.34).toFixed(0), value: a.toFixed(0) };
  })();

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(String(p))}
            className="rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
            style={
              amount === String(p)
                ? { background: accent, color: "#fff", borderColor: accent }
                : { borderColor: "rgba(0,0,0,0.12)", color: "#2C2C2C" }
            }
          >
            {p} €
          </button>
        ))}
        <div className="flex items-center gap-1 rounded-full border border-black/10 px-3 py-1">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-16 bg-transparent text-sm font-semibold text-[#2C2C2C] outline-none"
            aria-label="Montant libre"
          />
          <span className="text-sm text-[#6B6460]">€</span>
        </div>
      </div>

      {reduction && (
        <p className="mt-3 text-[13px] text-[#6B6460]">
          Après réduction d&apos;impôt (66 %), un don de <strong>{reduction.value} €</strong> ne vous
          coûte que <strong>{reduction.cost} €</strong>.
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input className={fieldCls} placeholder="Votre nom *" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={fieldCls} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={`${fieldCls} sm:col-span-2`} placeholder="Adresse (pour le reçu fiscal)" value={address} onChange={(e) => setAddress(e.target.value)} />
        {campaigns.length > 0 && (
          <select className={`${fieldCls} sm:col-span-2`} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">Don général</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>Soutenir : {c.title}</option>)}
          </select>
        )}
      </div>

      <label className="mt-3 flex items-center gap-2 text-[13px] text-[#6B6460]">
        <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} />
        Payer en ligne maintenant (si indisponible, vous serez recontacté·e)
      </label>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="mt-4 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: accent }}
      >
        {pending ? "Traitement…" : "Faire un don"}
      </button>
    </div>
  );
}
