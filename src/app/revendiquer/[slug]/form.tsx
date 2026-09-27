"use client";

import { useState } from "react";
import { submitClaim } from "./actions";
import type { ClaimTarget } from "./data";
import { inputCls, cardStyle, btnStyle, labelStyle, fieldStyle } from "./styles";

/**
 * Le formulaire, et ce qui le remplace une fois envoyé.
 *
 * Envoyer ne déclenche plus rien vers le lieu : un lien de confirmation part à
 * l'adresse saisie, et c'est lui qui autorise la suite. Sans cette étape, une
 * requête suffisait à faire écrire Casaminga à un lieu qui n'avait rien
 * demandé. L'écran d'après doit donc dire une seule chose, clairement : allez
 * relever votre boîte.
 *
 * Il annonce aussi ce qui se passera APRÈS le clic, car c'est contre-intuitif
 * en voie automatique : le lien de reprise partira à l'adresse publiée par le
 * lieu, pas à celle qu'on vient de saisir. Un demandeur qui l'ignore attend un
 * courriel qui arrive chez son employeur, et conclut que le site ne marche pas.
 */
export function ClaimForm({ target }: { target: ClaimTarget }) {
  const [fullName, setFullName] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ renvoi: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await submitClaim({
      slug: target.slug,
      eventId: target.eventId,
      fullName,
      roleLabel,
      email,
      phone,
      message,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "La demande n'a pas pu être envoyée.");
      return;
    }
    setDone({ renvoi: res.renvoi === true });
  }

  if (done) {
    return (
      <div style={cardStyle}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>
          {done.renvoi ? "Le lien vient de repartir" : "Vérifiez votre boîte mail"}
        </h2>
        <p style={paraStyle}>
          {done.renvoi ? (
            <>
              Une demande était déjà en cours pour <strong>{target.name}</strong> avec cette
              adresse. Nous venons de vous renvoyer le lien de confirmation à{" "}
              <strong>{email}</strong>.
            </>
          ) : (
            <>
              Nous venons d&apos;envoyer un lien de confirmation à <strong>{email}</strong>.
              Ouvrez-le : c&apos;est ce clic qui lance la reprise de la page de{" "}
              <strong>{target.name}</strong>.
            </>
          )}
        </p>
        <p style={paraStyle}>
          Tant que ce lien n&apos;est pas suivi, <strong>personne n&apos;est prévenu</strong> : ni
          le lieu, ni son équipe. C&apos;est ce qui nous évite d&apos;écrire à des lieux au nom de
          gens qui ne les connaissent pas.
        </p>
        {target.verifiable ? (
          <p style={paraStyle}>
            Ensuite, le lien de reprise partira à l&apos;adresse de contact que{" "}
            <strong>{target.name}</strong> a publiée, et non à la vôtre : c&apos;est notre façon de
            vérifier qu&apos;une page n&apos;est reprise que par quelqu&apos;un du lieu.
          </p>
        ) : (
          <p style={paraStyle}>
            Ensuite, votre demande partira en relecture : <strong>{target.name}</strong> n&apos;a
            pas publié d&apos;adresse de contact, et nous ne confierons pas une page à
            quelqu&apos;un sur sa seule parole. Nous revenons vers vous sous quelques jours.
          </p>
        )}
        <p style={{ ...paraStyle, color: "#9C9590", fontSize: 13, marginBottom: 0 }}>
          Le lien est valable 48 heures. Rien dans vos messages ? Regardez dans les indésirables.
        </p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Qui êtes-vous ?</h2>
      <p style={{ ...paraStyle, fontSize: 14 }}>
        Nous vous enverrons d&apos;abord un lien de confirmation, et rien ne partira vers le lieu
        avant que vous l&apos;ayez suivi.{" "}
        {target.verifiable
          ? "Ce lieu a publié une adresse de contact : le lien de reprise y sera ensuite envoyé directement, et vous n'aurez rien à nous prouver."
          : "Ce lieu n'a pas publié d'adresse de contact : votre demande nous parviendra ensuite et nous la relirons, en vous appelant si besoin."}
      </p>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="nom">
            Prénom et nom *
          </label>
          <input
            id="nom"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Camille Roux"
            className={inputCls}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="fonction">
            Votre fonction dans ce lieu
          </label>
          <input
            id="fonction"
            value={roleLabel}
            onChange={(e) => setRoleLabel(e.target.value)}
            placeholder="Chargée de médiation"
            className={inputCls}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="email">
            Votre adresse professionnelle *
          </label>
          <input
            id="email"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="camille.roux@le-lieu.fr"
            className={inputCls}
          />
          <span style={aideStyle}>
            {target.verifiable
              ? "Elle nous sert à vous répondre. Le lien de reprise, lui, partira à l'adresse publiée par le lieu."
              : "Une adresse au nom de domaine du lieu accélère beaucoup la relecture."}
          </span>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="tel">
            Téléphone
          </label>
          <input
            id="tel"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="04 67 00 00 00"
            className={inputCls}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="message">
            Un mot, si vous le souhaitez
          </label>
          <textarea
            id="message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ce que vous voulez corriger, ce que vous comptez publier…"
            className={inputCls}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        {error && (
          <p
            style={{
              fontSize: 13,
              color: "#E8714D",
              background: "#FFF0EB",
              padding: "10px 14px",
              borderRadius: 10,
              margin: 0,
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{ ...btnStyle, opacity: submitting ? 0.7 : 1, cursor: submitting ? "wait" : "pointer" }}
        >
          {submitting ? "Envoi en cours…" : "Demander à reprendre cette page"}
        </button>
      </form>
    </div>
  );
}

const paraStyle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 15,
  lineHeight: 1.65,
  color: "#4A4540",
};

const aideStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: "#9C9590",
  lineHeight: 1.5,
};
