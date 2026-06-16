"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, MapPin, Users, Ticket, Check, ChevronRight, X } from "lucide-react";
import { eventDayLong, eventTime, eventTypeLabel } from "@/lib/events-meta";
import type { Evenement } from "@/lib/types";
import type { Organization } from "@/lib/types";
import { createEventRegistration } from "@/app/site/[slug]/agenda/[id]/actions";

// ─── Types internes ────────────────────────────────────────────────────────────
type Mode = "view" | "tunnel" | "done";
type TunnelStep = 0 | 1 | 2 | 3;

interface Participant {
  prenom: string;
  nom: string;
}

interface Contact {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  if (n === 0) return "Gratuit";
  return Number.isInteger(n) ? `${n} €` : `${n.toFixed(2)} €`;
}

function inputCls(error?: boolean) {
  return `w-full rounded-xl border ${error ? "border-red-400" : "border-border"} bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15`;
}

// ─── Stepper Header ────────────────────────────────────────────────────────────
const STEPS = ["Billets", "Participants", "Coordonnées", "Récapitulatif"];

function StepperHeader({ step }: { step: TunnelStep }) {
  return (
    <div className="flex items-center justify-between">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={i} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex size-8 items-center justify-center rounded-full text-sm font-bold transition-all ${
                  done
                    ? "bg-[#2f8a4c] text-white"
                    : active
                    ? "bg-coral text-white shadow-md shadow-coral/30"
                    : "bg-warmgray/20 text-warmgray"
                }`}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </div>
              <span
                className={`hidden text-[11px] font-semibold sm:block ${
                  active ? "text-coral" : done ? "text-[#2f8a4c]" : "text-warmgray"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-2 h-0.5 flex-1 rounded-full transition-all ${done ? "bg-[#2f8a4c]" : "bg-warmgray/20"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 0 : Choix des billets ────────────────────────────────────────────────
function StepBillets({
  event,
  accent,
  nbPlaces,
  setNbPlaces,
  onNext,
  remaining,
}: {
  event: Evenement;
  accent: string;
  nbPlaces: number;
  setNbPlaces: (n: number) => void;
  onNext: () => void;
  remaining: number | null;
}) {
  const price = event.price ?? 0;
  const isFull = remaining !== null && remaining <= 0;
  // Complet → on laisse choisir jusqu'à 5 places en liste d'attente
  const maxCap = isFull ? 5 : remaining ?? event.capacity ?? 20;
  const total = price * nbPlaces;

  return (
    <div className="flex flex-col gap-6">
      {isFull && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          Cet événement est <strong>complet</strong>. Vous pouvez rejoindre la
          liste d&apos;attente : si une place se libère, vos billets vous seront
          envoyés automatiquement par email.
        </div>
      )}
      {/* Billet */}
      <div className="rounded-2xl border border-border bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="font-semibold text-ink">{event.title}</div>
            <div className="mt-0.5 text-sm text-warmgray">
              {price === 0 ? "Entrée libre" : `${price} € / personne`}
            </div>
            {event.capacity && (
              <div className="mt-1 text-[12px] text-warmgray">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3" />
                  {isFull
                    ? "Complet — liste d'attente"
                    : remaining !== null
                    ? `${remaining} place${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}`
                    : `${event.capacity} places max`}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setNbPlaces(Math.max(1, nbPlaces - 1))}
              className="flex size-9 items-center justify-center rounded-full border border-border text-lg font-bold text-ink hover:border-coral/40 disabled:opacity-30"
              disabled={nbPlaces <= 1}
            >
              −
            </button>
            <span className="w-6 text-center font-bold text-ink">{nbPlaces}</span>
            <button
              type="button"
              onClick={() => setNbPlaces(Math.min(maxCap, nbPlaces + 1))}
              className="flex size-9 items-center justify-center rounded-full border border-border text-lg font-bold text-ink hover:border-coral/40 disabled:opacity-30"
              disabled={nbPlaces >= maxCap}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between rounded-xl bg-[#FAFAF7] px-5 py-3.5">
        <span className="font-semibold text-ink">Total</span>
        <span className="text-xl font-extrabold" style={{ color: accent }}>
          {fmt(total)}
        </span>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow transition hover:opacity-90"
        style={{ background: accent }}
      >
        Commander <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

// ─── Step 1 : Participants ─────────────────────────────────────────────────────
function StepParticipants({
  nbPlaces,
  participants,
  setParticipants,
  onNext,
  onBack,
}: {
  nbPlaces: number;
  participants: Participant[];
  setParticipants: (p: Participant[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  function update(i: number, field: keyof Participant, val: string) {
    const next = [...participants];
    next[i] = { ...next[i], [field]: val };
    setParticipants(next);
    setErrors((e) => ({ ...e, [`${i}_${field}`]: false }));
  }

  function validate() {
    const errs: Record<string, boolean> = {};
    participants.forEach((p, i) => {
      if (!p.prenom.trim()) errs[`${i}_prenom`] = true;
      if (!p.nom.trim()) errs[`${i}_nom`] = true;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: nbPlaces }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-white p-5">
          <div className="mb-3 text-[13px] font-bold text-ink">
            Participant {nbPlaces > 1 ? i + 1 : ""}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-ink">Prénom *</label>
              <input
                className={inputCls(errors[`${i}_prenom`])}
                value={participants[i]?.prenom ?? ""}
                onChange={(e) => update(i, "prenom", e.target.value)}
                placeholder="Prénom"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-ink">Nom *</label>
              <input
                className={inputCls(errors[`${i}_nom`])}
                value={participants[i]?.nom ?? ""}
                onChange={(e) => update(i, "nom", e.target.value)}
                placeholder="Nom"
              />
            </div>
          </div>
        </div>
      ))}
      <NavButtons onBack={onBack} onNext={() => validate() && onNext()} />
    </div>
  );
}

// ─── Step 2 : Coordonnées ──────────────────────────────────────────────────────
function StepCoordonnees({
  contact,
  setContact,
  onNext,
  onBack,
}: {
  contact: Contact;
  setContact: (c: Contact) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  function set(field: keyof Contact, val: string) {
    setContact({ ...contact, [field]: val });
    setErrors((e) => ({ ...e, [field]: false }));
  }

  function validate() {
    const errs: Record<string, boolean> = {};
    if (!contact.prenom.trim()) errs.prenom = true;
    if (!contact.nom.trim()) errs.nom = true;
    if (!contact.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))
      errs.email = true;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-white p-5">
        <div className="mb-3 text-[13px] font-bold text-ink">Contact de référence</div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-ink">Prénom *</label>
              <input className={inputCls(errors.prenom)} value={contact.prenom} onChange={(e) => set("prenom", e.target.value)} placeholder="Prénom" />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-ink">Nom *</label>
              <input className={inputCls(errors.nom)} value={contact.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Nom" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink">Email *</label>
            <input
              type="email"
              className={inputCls(errors.email)}
              value={contact.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="votre@email.com"
            />
            {errors.email && <p className="mt-1 text-[11px] text-red-500">Email invalide</p>}
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink">Téléphone</label>
            <input
              type="tel"
              className={inputCls()}
              value={contact.telephone}
              onChange={(e) => set("telephone", e.target.value)}
              placeholder="06 00 00 00 00"
            />
          </div>
        </div>
      </div>
      <NavButtons onBack={onBack} onNext={() => validate() && onNext()} />
    </div>
  );
}

// ─── Step 3 : Récapitulatif ────────────────────────────────────────────────────
function StepRecap({
  event,
  org,
  nbPlaces,
  participants,
  contact,
  accent,
  onBack,
  onConfirm,
  pending,
  stripeEnabled = false,
  payOnline,
  setPayOnline,
}: {
  event: Evenement;
  org: Organization;
  nbPlaces: number;
  participants: Participant[];
  contact: Contact;
  accent: string;
  onBack: () => void;
  onConfirm: () => void;
  pending: boolean;
  stripeEnabled?: boolean;
  payOnline: boolean;
  setPayOnline: (v: boolean) => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const price = event.price ?? 0;
  const total = price * nbPlaces;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-white p-5">
        <div className="mb-3 text-[13px] font-bold text-ink">Billets et participants</div>
        <div className="flex flex-col gap-1.5">
          {participants.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-ink">
                {p.prenom} {p.nom}
              </span>
              <span className="font-semibold text-warmgray">{price === 0 ? "Gratuit" : `${price} €`}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-ink">Total</span>
            <span className="text-lg font-extrabold" style={{ color: accent }}>
              {fmt(total)}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-5">
        <div className="mb-2 text-[13px] font-bold text-ink">Vos coordonnées</div>
        <div className="space-y-0.5 text-sm text-warmgray">
          <div>
            {contact.prenom} {contact.nom}
          </div>
          <div>{contact.email}</div>
          {contact.telephone && <div>{contact.telephone}</div>}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-5">
        <div className="mb-2 text-[13px] font-bold text-ink">Événement</div>
        <div className="text-sm text-warmgray">
          <div className="font-semibold text-ink">{event.title}</div>
          <div>
            {eventDayLong(event.start_at)} · {eventTime(event.start_at)} – {eventTime(event.end_at)}
          </div>
          {org.address && <div>{org.address}</div>}
        </div>
      </div>

      {/* Mode de paiement (événement payant + Stripe dispo) */}
      {stripeEnabled && total > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-warmgray">Mode de paiement</p>
          <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${payOnline ? "border-coral bg-[#FFF5F0]" : "border-border bg-white hover:border-coral/40"}`}>
            <input type="radio" name="payMode" checked={payOnline} onChange={() => setPayOnline(true)} className="accent-coral" />
            <span className="text-sm font-semibold text-ink">Payer par carte maintenant</span>
          </label>
          <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${!payOnline ? "border-coral bg-[#FFF5F0]" : "border-border bg-white hover:border-coral/40"}`}>
            <input type="radio" name="payMode" checked={!payOnline} onChange={() => setPayOnline(false)} className="accent-coral" />
            <span className="text-sm text-warmgray">Payer sur place / plus tard</span>
          </label>
        </div>
      )}

      {/* Consentement */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-[#FAFAF7] p-4">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 shrink-0 accent-coral"
        />
        <span className="text-[13px] text-warmgray">
          J&apos;accepte que mes informations soient transmises à <strong>{org.name}</strong> dans le cadre de cette inscription.
        </span>
      </label>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-full border border-border bg-white px-4 py-3 text-sm font-semibold text-ink hover:border-coral/40 disabled:opacity-50"
          disabled={pending}
        >
          Retour
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!agreed || pending}
          className="flex-1 rounded-full px-4 py-3 text-sm font-bold text-white shadow transition hover:opacity-90 disabled:opacity-40"
          style={{ background: accent }}
        >
          {pending ? "Confirmation…" : stripeEnabled && payOnline && total > 0 ? `Payer ${fmt(total)} →` : "Confirmer l'inscription →"}
        </button>
      </div>
    </div>
  );
}

// ─── Nav buttons partagés ──────────────────────────────────────────────────────
function NavButtons({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex-1 rounded-full border border-border bg-white px-4 py-3 text-sm font-semibold text-ink hover:border-coral/40"
      >
        Retour
      </button>
      <button
        type="button"
        onClick={onNext}
        className="flex-1 rounded-full bg-coral px-4 py-3 text-sm font-bold text-white shadow transition hover:bg-coral-dark"
      >
        Suivant →
      </button>
    </div>
  );
}

// ─── Écran succès ──────────────────────────────────────────────────────────────
function SuccessScreen({ event, contact, accent, orgSlug, waiting }: { event: Evenement; contact: Contact; accent: string; orgSlug: string; waiting: boolean }) {
  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <div
        className="flex size-16 items-center justify-center rounded-full"
        style={{ background: waiting ? "#FEF3C7" : `${accent}1a` }}
      >
        {waiting ? <Clock className="size-8 text-amber-600" /> : <Check className="size-8" style={{ color: accent }} />}
      </div>
      <div>
        <h2 className="font-heading text-2xl font-extrabold text-ink">
          {waiting ? "Vous êtes sur liste d'attente" : "Inscription confirmée !"}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {waiting ? (
            <>Merci {contact.prenom}. <strong>{event.title}</strong> est complet — si une place se libère, vos billets vous seront envoyés automatiquement.</>
          ) : (
            <>Merci {contact.prenom}. Votre inscription à <strong>{event.title}</strong> a bien été enregistrée.</>
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {waiting ? "Une confirmation a été envoyée à" : "Vos billets ont été envoyés à"} <strong>{contact.email}</strong>.
        </p>
      </div>
      <Link
        href={`/site/${orgSlug}`}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-6 py-3 text-sm font-semibold text-ink hover:border-coral/40"
      >
        <ArrowLeft className="size-4" /> Retour au site
      </Link>
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────
export function PublicEventPage({
  event,
  org,
  accent,
  orgSlug,
  remaining = null,
  stripeEnabled = false,
}: {
  event: Evenement;
  org: Organization;
  accent: string;
  orgSlug: string;
  remaining?: number | null;
  stripeEnabled?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("view");
  const [step, setStep] = useState<TunnelStep>(0);
  const [nbPlaces, setNbPlaces] = useState(1);
  const [participants, setParticipants] = useState<Participant[]>([{ prenom: "", nom: "" }]);
  const [contact, setContact] = useState<Contact>({ prenom: "", nom: "", email: "", telephone: "" });
  const [waiting, setWaiting] = useState(false);
  const [payOnline, setPayOnline] = useState(true);
  const [pending, startTransition] = useTransition();

  const price = event.price ?? 0;
  const heroPhoto = event.photos?.[0] ?? null;
  const isFull = remaining !== null && remaining <= 0;

  // Sync participants array length with nbPlaces
  function updateNbPlaces(n: number) {
    setNbPlaces(n);
    setParticipants((prev) => {
      if (n > prev.length) return [...prev, ...Array.from({ length: n - prev.length }, () => ({ prenom: "", nom: "" }))];
      return prev.slice(0, n);
    });
  }

  function confirm() {
    startTransition(async () => {
      const res = await createEventRegistration({
        eventId: event.id,
        organizationId: event.organization_id,
        prenom: contact.prenom,
        nom: contact.nom,
        email: contact.email,
        telephone: contact.telephone || undefined,
        nbPlaces,
        participants,
        montantTotal: price * nbPlaces,
        online: stripeEnabled && payOnline && price > 0,
      });
      if (res.ok) {
        if (res.redirectUrl) { window.location.href = res.redirectUrl; return; }
        setWaiting(res.status === "liste_attente");
        setMode("done");
      } else {
        alert(res.error);
      }
    });
  }

  // ── Tunnel overlay ────────────────────────────────────────────────────────────
  if (mode === "tunnel" || mode === "done") {
    return (
      <div className="min-h-screen bg-cream">
        {/* Header léger */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-cream/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-4">
            <button
              type="button"
              onClick={() => { setMode("view"); setStep(0); }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-warmgray hover:text-ink"
            >
              <X className="size-4" />
              <span className="hidden sm:inline">Annuler</span>
            </button>
            <span className="min-w-0 flex-1 truncate text-center font-heading text-base font-bold text-ink">
              {org.name}
            </span>
            <div className="w-14" />
          </div>
        </header>

        <div className="mx-auto max-w-2xl px-6 py-8">
          {mode === "done" ? (
            <SuccessScreen event={event} contact={contact} accent={accent} orgSlug={orgSlug} waiting={waiting} />
          ) : (
            <>
              {/* Récap événement en haut */}
              <div className="mb-6 rounded-2xl border border-border bg-white p-4">
                <div className="flex items-start gap-3">
                  {heroPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={heroPhoto} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: `${accent}1a` }}>
                      🎟
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-heading text-sm font-bold text-ink">{event.title}</div>
                    <div className="mt-0.5 text-[12px] text-warmgray">
                      {eventDayLong(event.start_at)} · {eventTime(event.start_at)}
                    </div>
                    {org.address && <div className="mt-0.5 text-[12px] text-warmgray">{org.address}</div>}
                  </div>
                  <div className="shrink-0 text-right text-[13px] font-bold" style={{ color: accent }}>
                    {nbPlaces} × {price === 0 ? "Gratuit" : `${price} €`}
                  </div>
                </div>
              </div>

              {/* Stepper */}
              <div className="mb-6">
                <StepperHeader step={step} />
              </div>

              {/* Étapes */}
              {step === 0 && (
                <StepBillets
                  event={event}
                  accent={accent}
                  nbPlaces={nbPlaces}
                  setNbPlaces={updateNbPlaces}
                  onNext={() => setStep(1)}
                  remaining={remaining}
                />
              )}
              {step === 1 && (
                <StepParticipants
                  nbPlaces={nbPlaces}
                  participants={participants}
                  setParticipants={setParticipants}
                  onNext={() => setStep(2)}
                  onBack={() => setStep(0)}
                />
              )}
              {step === 2 && (
                <StepCoordonnees
                  contact={contact}
                  setContact={setContact}
                  onNext={() => setStep(3)}
                  onBack={() => setStep(1)}
                />
              )}
              {step === 3 && (
                <StepRecap
                  event={event}
                  org={org}
                  nbPlaces={nbPlaces}
                  participants={participants}
                  contact={contact}
                  accent={accent}
                  onBack={() => setStep(2)}
                  onConfirm={confirm}
                  pending={pending}
                  stripeEnabled={stripeEnabled}
                  payOnline={payOnline}
                  setPayOnline={setPayOnline}
                />
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Vue événement ─────────────────────────────────────────────────────────────
  const mapQuery = org.address ? encodeURIComponent(org.address) : null;

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-cream/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
          <Link
            href={`/site/${orgSlug}#agenda`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-warmgray hover:text-ink"
          >
            <ArrowLeft className="size-4" /> {org.name}
          </Link>
        </div>
      </header>

      {/* Hero photo */}
      {heroPhoto ? (
        <div className="relative h-52 w-full overflow-hidden sm:h-72 md:h-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroPhoto} alt={event.title} className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
        </div>
      ) : (
        <div className="h-32 w-full" style={{ background: `${accent}22` }} />
      )}

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* ── Colonne gauche : infos ─────────────────── */}
          <div>
            {/* Badge type */}
            <span
              className="inline-block rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-wide"
              style={{ background: `${accent}1a`, color: accent }}
            >
              {eventTypeLabel(event.type)}
            </span>

            <h1 className="mt-3 font-heading text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">
              {event.title}
            </h1>

            <p className="mt-1 text-sm text-warmgray">par {org.name}</p>

            {/* Date/heure */}
            <div className="mt-5 flex flex-wrap gap-4">
              <div className="flex items-center gap-2 text-sm text-ink">
                <Calendar className="size-4 shrink-0 text-coral" />
                <span>{eventDayLong(event.start_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-ink">
                <Clock className="size-4 shrink-0 text-coral" />
                <span>
                  {eventTime(event.start_at)} – {eventTime(event.end_at)}
                </span>
              </div>
              {org.address && (
                <div className="flex items-center gap-2 text-sm text-ink">
                  <MapPin className="size-4 shrink-0 text-coral" />
                  <span>{org.address}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {event.description ? (
              <div className="mt-6">
                <h2 className="mb-2 font-heading text-base font-bold text-ink">Description</h2>
                <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground">
                  {event.description.split("\n").filter(Boolean).map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Carte OSM (desktop only) */}
            {mapQuery ? (
              <div className="mt-8 hidden lg:block">
                <h2 className="mb-3 font-heading text-base font-bold text-ink">Localisation</h2>
                <div className="overflow-hidden rounded-2xl border border-border">
                  <iframe
                    title="Carte"
                    src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`}
                    className="h-56 w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <p className="mt-1 text-[12px] text-warmgray">{org.address}</p>
              </div>
            ) : null}
          </div>

          {/* ── Sidebar : billet + inscription ────────── */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
              {/* Prix */}
              <div className="mb-4 flex items-center gap-3">
                <Ticket className="size-5 text-coral" />
                <div>
                  <div className="text-lg font-extrabold text-ink">
                    {price === 0 ? "Entrée libre" : `${price} €`}
                  </div>
                  {event.capacity && (
                    <div className="text-[12px] text-warmgray">
                      <Users className="mr-1 inline size-3" />
                      {isFull
                        ? <span className="font-bold text-amber-600">Complet — liste d&apos;attente ouverte</span>
                        : remaining !== null && remaining <= 10
                        ? <span className="font-bold text-coral-dark">Plus que {remaining} place{remaining > 1 ? "s" : ""} !</span>
                        : `${event.capacity} places maximum`}
                    </div>
                  )}
                </div>
              </div>

              {/* Date récap */}
              <div className="mb-4 flex flex-col gap-2 rounded-xl bg-[#FAFAF7] p-3 text-[13px] text-warmgray">
                <div className="flex items-center gap-2">
                  <Calendar className="size-3.5 text-coral" />
                  {eventDayLong(event.start_at)}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 text-coral" />
                  {eventTime(event.start_at)} – {eventTime(event.end_at)}
                </div>
                {org.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="size-3.5 text-coral" />
                    {org.address}
                  </div>
                )}
              </div>

              {/* Bouton */}
              <button
                type="button"
                onClick={() => setMode("tunnel")}
                className="w-full rounded-full py-3 text-sm font-bold text-white shadow transition hover:opacity-90"
                style={{ background: isFull ? "#d97706" : accent }}
              >
                {isFull
                  ? "Rejoindre la liste d'attente"
                  : price === 0 ? "S'inscrire gratuitement" : "Réserver ma place"}
              </button>

              <p className="mt-3 text-center text-[11px] text-warmgray">
                {isFull
                  ? "Billets envoyés automatiquement si une place se libère"
                  : "Inscription sécurisée · Confirmation immédiate"}
              </p>
            </div>

            {/* Carte mobile */}
            {mapQuery ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-border lg:hidden">
                <iframe
                  title="Carte"
                  src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`}
                  className="h-48 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="bg-white px-3 py-2 text-[12px] text-warmgray">{org.address}</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-10 border-t border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-6 text-center text-sm text-muted-foreground">
          Site généré avec <span className="font-semibold text-foreground">Casa Minga Lieux</span>
        </div>
      </footer>
    </div>
  );
}
