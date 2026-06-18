"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, UserRound, Mail, KeyRound } from "lucide-react";
import {
  updateProfileAction,
  updateEmailAction,
  updatePasswordAction,
} from "@/app/(admin)/dashboard/[org]/compte/actions";

const inputCls =
  "w-full rounded-xl border border-border bg-[#FAFAF7] px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15";
const labelCls = "mb-1 block text-[12px] font-semibold text-ink";
const btnCls =
  "inline-flex items-center gap-2 rounded-full bg-coral px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-coral-dark disabled:opacity-50";

// ── Carte profil ─────────────────────────────────────────────────────────────
function ProfileCard({ orgSlug, initialName }: { orgSlug: string; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateProfileAction(orgSlug, name);
      if (res.ok) toast.success(res.message ?? "Profil mis à jour ✓");
      else toast.error(res.error ?? "Erreur");
    });
  }

  const dirty = name.trim() !== initialName.trim();

  return (
    <div className="mc-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <UserRound className="size-4 text-coral" />
        <h3 className="font-heading text-base font-bold text-foreground">Profil</h3>
      </div>
      <p className="mb-4 text-[12.5px] text-warmgray">
        Votre nom s&apos;affiche dans l&apos;équipe du lieu et sur vos actions (factures, contrats, messages).
      </p>
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelCls}>Nom complet</label>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Prénom Nom"
            maxLength={120}
          />
        </div>
        <div className="flex justify-end">
          <button onClick={save} disabled={pending || !dirty} className={btnCls}>
            <Save className="size-3.5" />
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Carte sécurité (email + mot de passe) ────────────────────────────────────
function SecurityCard({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState(currentEmail);
  const [emailPending, startEmail] = useTransition();

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwPending, startPw] = useTransition();

  function saveEmail() {
    startEmail(async () => {
      const res = await updateEmailAction(email);
      if (res.ok) toast.success(res.message ?? "Email envoyé ✓", { duration: 7000 });
      else toast.error(res.error ?? "Erreur");
    });
  }

  function savePassword() {
    if (newPw !== confirmPw) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    startPw(async () => {
      const res = await updatePasswordAction(currentPw, newPw);
      if (res.ok) {
        toast.success(res.message ?? "Mot de passe mis à jour ✓");
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      } else {
        toast.error(res.error ?? "Erreur");
      }
    });
  }

  const emailDirty = email.trim().toLowerCase() !== currentEmail.trim().toLowerCase();
  const pwReady = currentPw.length > 0 && newPw.length >= 8 && confirmPw.length > 0;

  return (
    <div className="mc-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="size-4 text-coral" />
        <h3 className="font-heading text-base font-bold text-foreground">Connexion &amp; sécurité</h3>
      </div>

      {/* Email */}
      <div className="flex flex-col gap-3 border-b border-border pb-6">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
          <Mail className="size-3.5 text-warmgray" /> Adresse email de connexion
        </div>
        <input
          className={inputCls}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.org"
        />
        <p className="text-[11.5px] text-warmgray">
          Un email de confirmation est envoyé à la nouvelle adresse. Le changement n&apos;est effectif qu&apos;après validation.
        </p>
        <div className="flex justify-end">
          <button onClick={saveEmail} disabled={emailPending || !emailDirty} className={btnCls}>
            <Save className="size-3.5" />
            {emailPending ? "Envoi…" : "Changer l'email"}
          </button>
        </div>
      </div>

      {/* Mot de passe */}
      <div className="flex flex-col gap-4 pt-6">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
          <KeyRound className="size-3.5 text-warmgray" /> Mot de passe
        </div>
        <div>
          <label className={labelCls}>Mot de passe actuel</label>
          <input
            className={inputCls}
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Nouveau mot de passe</label>
            <input
              className={inputCls}
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              placeholder="8 caractères minimum"
            />
          </div>
          <div>
            <label className={labelCls}>Confirmer</label>
            <input
              className={inputCls}
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={savePassword} disabled={pwPending || !pwReady} className={btnCls}>
            <KeyRound className="size-3.5" />
            {pwPending ? "Mise à jour…" : "Changer le mot de passe"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AccountView({
  orgSlug,
  fullName,
  email,
}: {
  orgSlug: string;
  fullName: string;
  email: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ProfileCard orgSlug={orgSlug} initialName={fullName} />
      <SecurityCard currentEmail={email} />
    </div>
  );
}
