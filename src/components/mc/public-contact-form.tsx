"use client";

import { useState } from "react";
import { toast } from "sonner";
import { REQUEST_TYPES } from "@/lib/requests-meta";

const inputClass =
  "rounded-lg border border-input bg-cream px-3 py-2 text-sm outline-none focus:border-coral";

export function PublicContactForm({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      name: fd.get("name"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      structure: fd.get("structure"),
      type: fd.get("type"),
      message: fd.get("message"),
    };

    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${slug}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Envoi impossible. Réessayez.");
        return;
      }
      form.reset();
      setSent(true);
      toast.success("Message envoyé — l'équipe vous recontactera.");
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-6 rounded-2xl border border-mint/40 bg-mint/10 px-6 py-10 text-center">
        <p className="font-heading text-lg font-bold text-[#15803d]">Merci !</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Votre message est bien arrivé à l&apos;équipe.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 text-sm font-semibold text-coral-dark hover:underline"
        >
          Envoyer un autre message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
      <input name="name" required placeholder="Votre nom *" className={inputClass} />
      <input
        name="email"
        type="email"
        required
        placeholder="Votre email *"
        className={inputClass}
      />
      <input name="phone" placeholder="Téléphone" className={inputClass} />
      <input
        name="structure"
        placeholder="Votre structure"
        className={inputClass}
      />
      <select name="type" defaultValue="contact" className={`${inputClass} sm:col-span-2`}>
        {REQUEST_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <textarea
        name="message"
        required
        rows={4}
        placeholder="Votre message *"
        className={`${inputClass} sm:col-span-2`}
      />
      <button
        type="submit"
        disabled={loading}
        className="justify-self-start rounded-lg bg-coral px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-dark disabled:opacity-60 sm:col-span-2"
      >
        {loading ? "Envoi…" : "Envoyer"}
      </button>
    </form>
  );
}
