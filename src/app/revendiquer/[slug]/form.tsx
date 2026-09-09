"use client";

import { useState } from "react";
import { submitClaim, type Voie } from "./actions";
import type { ClaimTarget } from "./data";
import { inputCls, cardStyle, btnStyle, labelStyle, fieldStyle } from "./styles";

/**
 * Le formulaire, et ce qui le remplace une fois envoyé.
 *
 * L'accusé de réception change selon la voie suivie, et c'est le point le plus
 * important de cette page. En voie automatique, le lien de reprise part à
 * l'adresse publiée par le lieu, pas à celle qu'on vient de saisir : un
 * demandeur qui l'ignore attend un courriel qui arrive chez son employeur, et
 * conclut que le site ne marche pas.
 */
export function ClaimForm({ target }: { target: ClaimTarget }) {
  const [fullName, setFullName] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ voie: Voie; adresseIndice: string | null } | null>(null);

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
    setDone({ voie: res.voie ?? "manuel", adresseIndice: res.adresseIndice ?? null });
  }

  if (done) {
    return (
      <div style={cardStyle}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>
          Votre demande est enregistrée
        </h2>
        {done.voie === "auto" ? (
          <>
            <p style={paraStyle}>
              Nous venons d&apos;envoyer le lien de reprise à l&apos;adresse de contact que{" "}
              <strong>{target.name}</strong> a publiée
              {done.adresseIndice ? ` (${done.adresseIndice})` : ""}, et non à la vôtre.
            </p>
            <p style={paraStyle}>
              C&apos;est notre façon de vérifier qu&apos;une page n&apos;est reprise que par
              quelqu&apos;un du lieu, sans avoir à vous demander de justificatif. Si vous relevez
              cette boîte, le lien vous y attend. Sinon, demandez-le à la personne qui s&apos;en
              occupe.
            </p>
          </>
        ) : (
          <>
            <p style={paraStyle}>
              <strong>{target.name}</strong> n&apos;a pas publié d&apos;adresse de contact : nous
              ne pouvons pas vérifier votre demande automatiquement, et nous n&apos;allons pas
              confier une page à quelqu&apos;un sur sa seule parole.
            </p>
            <p style={paraStyle}>
              Votre demande part donc en relecture. Nous revenons vers vous sous quelques jours, et
              il se peut que nous vous appelions avant.
            </p>
          </>
        )}
        <p style={{ ...paraStyle, color: "#9C9590", fontSize: 13 }}>
          Un accusé de réception vient de partir à votre adresse. Vous n&apos;avez rien d&apos;autre
          à faire.
        </p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Qui êtes-vous ?</h2>
      <p style={{ ...paraStyle, fontSize: 14 }}>
        {target.verifiable
          ? "Ce lieu a publié une adresse de contact : le lien de reprise y sera envoyé directement, et vous n'aurez rien à nous prouver."
          : "Ce lieu n'a pas publié d'adresse de contact. Votre demande nous parviendra et nous la relirons, en vous appelant si besoin."}
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
