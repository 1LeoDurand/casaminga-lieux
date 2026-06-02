/**
 * Templates HTML pour tous les emails Casa Minga Lieux.
 * Design : crème/corail, cohérent avec l'identité du produit.
 */

// ── Base layout ────────────────────────────────────────────────────────────

function base(content: string, orgName = "Casa Minga Lieux") {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${orgName}</title>
</head>
<body style="margin:0;padding:0;background:#FFFBF0;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBF0;padding:32px 16px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
      <!-- Header -->
      <tr><td style="background:#FF8A65;border-radius:16px 16px 0 0;padding:24px 32px;text-align:center;">
        <span style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:12px;padding:8px 16px;color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">${orgName}</span>
      </td></tr>
      <!-- Body -->
      <tr><td style="background:#fff;padding:32px;border-left:1px solid #F0E8E0;border-right:1px solid #F0E8E0;">
        ${content}
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:#FFF8F5;border:1px solid #F0E8E0;border-top:none;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9C9590;">Cet email a été envoyé par <strong>${orgName}</strong> via Casa Minga Lieux.<br/>Pour toute question, répondez directement à cet email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function h1(text: string) {
  return `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#2C2C2C;">${text}</h1>`;
}
function p(text: string) {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4A4540;">${text}</p>`;
}
function badge(text: string, color = "#FF8A65") {
  return `<span style="display:inline-block;background:${color}20;color:${color};border:1px solid ${color}40;border-radius:100px;padding:4px 12px;font-size:12px;font-weight:700;letter-spacing:0.05em;">${text}</span>`;
}
function card(rows: { label: string; value: string }[]) {
  const cells = rows
    .map(
      (r) =>
        `<tr><td style="padding:8px 0;font-size:13px;color:#9C9590;width:140px;vertical-align:top;">${r.label}</td><td style="padding:8px 0;font-size:14px;color:#2C2C2C;font-weight:600;">${r.value}</td></tr>`
    )
    .join("");
  return `<table style="width:100%;background:#FAFAF7;border:1px solid #E5DDD6;border-radius:12px;padding:16px 20px;margin:20px 0;" cellpadding="0" cellspacing="0"><tbody>${cells}</tbody></table>`;
}
function btn(text: string, href: string) {
  return `<div style="text-align:center;margin:24px 0;"><a href="${href}" style="display:inline-block;background:#FF8A65;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:100px;">${text}</a></div>`;
}
function divider() {
  return `<hr style="border:none;border-top:1px solid #F0E8E0;margin:24px 0;" />`;
}

// ── 1. Confirmation demande reçue (au demandeur) ───────────────────────────

export function tplDemandeRecue(opts: {
  orgName: string;
  personName: string;
  type: string;
  message: string;
}) {
  return base(
    `
    ${h1("Votre demande a bien été reçue ✓")}
    ${p(`Bonjour <strong>${opts.personName}</strong>,`)}
    ${p(`Nous avons bien reçu votre demande auprès de <strong>${opts.orgName}</strong>. Notre équipe la traitera dans les meilleurs délais.`)}
    ${card([
      { label: "Type", value: opts.type },
      { label: "Message", value: opts.message.slice(0, 200) + (opts.message.length > 200 ? "…" : "") },
    ])}
    ${p("Vous recevrez un email dès que notre équipe aura traité votre demande.")}
    ${p("Merci de votre confiance !")}
  `,
    opts.orgName
  );
}

// ── 2. Alerte équipe — nouvelle demande ───────────────────────────────────

export function tplDemandeAlerteEquipe(opts: {
  orgName: string;
  orgSlug: string;
  personName: string;
  personEmail: string;
  type: string;
  message: string;
  dashboardUrl: string;
}) {
  return base(
    `
    ${badge("Nouvelle demande", "#E8714D")}
    <div style="height:12px;"></div>
    ${h1(`Demande de ${opts.personName}`)}
    ${p("Une nouvelle demande vient d'être soumise sur votre site public.")}
    ${card([
      { label: "Nom", value: opts.personName },
      { label: "Email", value: opts.personEmail },
      { label: "Type", value: opts.type },
      { label: "Message", value: opts.message.slice(0, 300) + (opts.message.length > 300 ? "…" : "") },
    ])}
    ${btn("Traiter la demande →", opts.dashboardUrl)}
  `,
    opts.orgName
  );
}

// ── 3. Mise à jour statut demande (au demandeur) ──────────────────────────

const STATUS_FR: Record<string, { label: string; color: string; msg: string }> = {
  en_attente: { label: "En attente", color: "#F59E0B", msg: "Votre demande est en attente de traitement." },
  a_etudier:  { label: "À étudier",  color: "#3B82F6", msg: "Votre demande est en cours d'étude par notre équipe." },
  validee:    { label: "Acceptée",   color: "#22C55E", msg: "Votre demande a été acceptée. Nous vous contacterons prochainement." },
  refusee:    { label: "Refusée",    color: "#EF4444", msg: "Après examen, nous ne sommes pas en mesure de donner suite à votre demande." },
  archivee:   { label: "Archivée",   color: "#9C9590", msg: "Votre demande a été archivée." },
};

export function tplDemandeStatut(opts: {
  orgName: string;
  personName: string;
  status: string;
}) {
  const s = STATUS_FR[opts.status] ?? { label: opts.status, color: "#9C9590", msg: "" };
  return base(
    `
    ${badge(s.label, s.color)}
    <div style="height:12px;"></div>
    ${h1("Mise à jour de votre demande")}
    ${p(`Bonjour <strong>${opts.personName}</strong>,`)}
    ${p(s.msg)}
    ${p(`N'hésitez pas à nous contacter si vous avez des questions.`)}
  `,
    opts.orgName
  );
}

// ── 4. Confirmation candidature adhésion (au candidat) ────────────────────

export function tplAdhesionCandidat(opts: {
  orgName: string;
  firstName: string;
  lastName: string;
  tierLabel: string;
  amount: number;
  membershipEnd: string;
}) {
  return base(
    `
    ${h1("Votre candidature d'adhésion est enregistrée ✓")}
    ${p(`Bonjour <strong>${opts.firstName} ${opts.lastName}</strong>,`)}
    ${p(`Nous avons bien reçu votre candidature d'adhésion à <strong>${opts.orgName}</strong>. Elle sera validée par notre équipe.`)}
    ${card([
      { label: "Formule",       value: opts.tierLabel },
      { label: "Montant",       value: `${opts.amount.toFixed(2)} €` },
      { label: "Valable jusqu'au", value: new Date(opts.membershipEnd).toLocaleDateString("fr-FR") },
    ])}
    ${p("Vous recevrez un email de confirmation dès la validation de votre adhésion.")}
    ${p("Bienvenue dans notre communauté !")}
  `,
    opts.orgName
  );
}

// ── 5. Validation adhésion + reçu (au membre) ────────────────────────────

export function tplAdhesionValidee(opts: {
  orgName: string;
  firstName: string;
  lastName: string;
  tierLabel: string;
  amount: number;
  membershipStart: string;
  membershipEnd: string;
}) {
  return base(
    `
    ${badge("Adhésion validée ✓", "#22C55E")}
    <div style="height:12px;"></div>
    ${h1("Bienvenue, vous êtes maintenant membre !")}
    ${p(`Bonjour <strong>${opts.firstName} ${opts.lastName}</strong>,`)}
    ${p(`Votre adhésion à <strong>${opts.orgName}</strong> a été validée. Voici votre reçu :`)}
    ${card([
      { label: "Membre",         value: `${opts.firstName} ${opts.lastName}` },
      { label: "Formule",        value: opts.tierLabel },
      { label: "Montant réglé",  value: `${opts.amount.toFixed(2)} €` },
      { label: "Début",          value: new Date(opts.membershipStart).toLocaleDateString("fr-FR") },
      { label: "Fin de validité",value: new Date(opts.membershipEnd).toLocaleDateString("fr-FR") },
    ])}
    ${p("Conservez cet email comme reçu de votre adhésion.")}
    ${p("Merci pour votre soutien !")}
  `,
    opts.orgName
  );
}

// ── 6. Rappel renouvellement adhésion ─────────────────────────────────────

export function tplAdhesionRappelRenouvellement(opts: {
  orgName: string;
  firstName: string;
  membershipEnd: string;
  renewUrl?: string;
}) {
  return base(
    `
    ${badge("Adhésion bientôt expirée", "#F59E0B")}
    <div style="height:12px;"></div>
    ${h1("Votre adhésion expire dans 30 jours")}
    ${p(`Bonjour <strong>${opts.firstName}</strong>,`)}
    ${p(`Votre adhésion à <strong>${opts.orgName}</strong> expire le <strong>${new Date(opts.membershipEnd).toLocaleDateString("fr-FR")}</strong>.`)}
    ${p("Renouvelez dès maintenant pour continuer à bénéficier de tous les avantages.")}
    ${opts.renewUrl ? btn("Renouveler mon adhésion →", opts.renewUrl) : ""}
  `,
    opts.orgName
  );
}

// ── 7. Confirmation réservation (au réservant) ────────────────────────────

export function tplReservationConfirmee(opts: {
  orgName: string;
  contactName: string;
  spaceName: string;
  startAt: string;
  endAt: string;
  purpose?: string;
}) {
  const fmt = (d: string) =>
    new Date(d).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
  return base(
    `
    ${h1("Votre réservation est enregistrée ✓")}
    ${p(`Bonjour <strong>${opts.contactName}</strong>,`)}
    ${p(`Votre demande de réservation auprès de <strong>${opts.orgName}</strong> a été enregistrée. Elle est en attente de confirmation par notre équipe.`)}
    ${card([
      { label: "Espace",  value: opts.spaceName },
      { label: "Début",   value: fmt(opts.startAt) },
      { label: "Fin",     value: fmt(opts.endAt) },
      ...(opts.purpose ? [{ label: "Objet", value: opts.purpose }] : []),
    ])}
    ${p("Vous recevrez un email de confirmation dès la validation.")}
  `,
    opts.orgName
  );
}

// ── 8. Approbation réservation ────────────────────────────────────────────

export function tplReservationApprouvee(opts: {
  orgName: string;
  contactName: string;
  spaceName: string;
  startAt: string;
  endAt: string;
}) {
  const fmt = (d: string) =>
    new Date(d).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
  return base(
    `
    ${badge("Réservation confirmée ✓", "#22C55E")}
    <div style="height:12px;"></div>
    ${h1("Votre réservation est confirmée !")}
    ${p(`Bonjour <strong>${opts.contactName}</strong>,`)}
    ${p(`Bonne nouvelle ! Votre réservation chez <strong>${opts.orgName}</strong> est confirmée.`)}
    ${card([
      { label: "Espace", value: opts.spaceName },
      { label: "Début",  value: fmt(opts.startAt) },
      { label: "Fin",    value: fmt(opts.endAt) },
    ])}
    ${p("En cas d'empêchement, merci de nous prévenir dès que possible.")}
  `,
    opts.orgName
  );
}

// ── 9. Rappel réservation J-1 ─────────────────────────────────────────────

export function tplReservationRappel(opts: {
  orgName: string;
  contactName: string;
  spaceName: string;
  startAt: string;
  endAt: string;
}) {
  const fmt = (d: string) =>
    new Date(d).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
  return base(
    `
    ${badge("Rappel — demain", "#3B82F6")}
    <div style="height:12px;"></div>
    ${h1("Votre réservation est demain")}
    ${p(`Bonjour <strong>${opts.contactName}</strong>,`)}
    ${p(`Petit rappel : vous avez une réservation chez <strong>${opts.orgName}</strong> demain.`)}
    ${card([
      { label: "Espace", value: opts.spaceName },
      { label: "Début",  value: fmt(opts.startAt) },
      { label: "Fin",    value: fmt(opts.endAt) },
    ])}
    ${p("À demain !")}
  `,
    opts.orgName
  );
}

// ── 10. Annulation réservation ────────────────────────────────────────────

export function tplReservationAnnulee(opts: {
  orgName: string;
  contactName: string;
  spaceName: string;
  startAt: string;
}) {
  const fmt = (d: string) =>
    new Date(d).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
  return base(
    `
    ${badge("Réservation annulée", "#EF4444")}
    <div style="height:12px;"></div>
    ${h1("Votre réservation a été annulée")}
    ${p(`Bonjour <strong>${opts.contactName}</strong>,`)}
    ${p(`Votre réservation de <strong>${opts.spaceName}</strong> prévue le <strong>${fmt(opts.startAt)}</strong> a été annulée.`)}
    ${p("Si vous pensez qu'il s'agit d'une erreur, contactez-nous directement.")}
  `,
    opts.orgName
  );
}

// ── 11. Confirmation inscription événement ────────────────────────────────

export function tplEvenementInscription(opts: {
  orgName: string;
  firstName: string;
  eventTitle: string;
  startAt: string;
  location?: string;
}) {
  const fmt = (d: string) =>
    new Date(d).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
  return base(
    `
    ${h1("Inscription confirmée ✓")}
    ${p(`Bonjour <strong>${opts.firstName}</strong>,`)}
    ${p(`Votre inscription à l'événement de <strong>${opts.orgName}</strong> est confirmée.`)}
    ${card([
      { label: "Événement", value: opts.eventTitle },
      { label: "Date",      value: fmt(opts.startAt) },
      ...(opts.location ? [{ label: "Lieu", value: opts.location }] : []),
    ])}
    ${p("À bientôt !")}
  `,
    opts.orgName
  );
}

// ── 12. Rappel événement J-1 ──────────────────────────────────────────────

export function tplEvenementRappel(opts: {
  orgName: string;
  firstName: string;
  eventTitle: string;
  startAt: string;
  location?: string;
}) {
  const fmt = (d: string) =>
    new Date(d).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
  return base(
    `
    ${badge("Rappel — demain", "#3B82F6")}
    <div style="height:12px;"></div>
    ${h1("C'est demain !")}
    ${p(`Bonjour <strong>${opts.firstName}</strong>,`)}
    ${p(`Petit rappel : <strong>${opts.eventTitle}</strong> organisé par <strong>${opts.orgName}</strong> a lieu demain.`)}
    ${card([
      { label: "Date", value: fmt(opts.startAt) },
      ...(opts.location ? [{ label: "Lieu", value: opts.location }] : []),
    ])}
    ${p("On vous attend !")}
  `,
    opts.orgName
  );
}

// ── 13. Bienvenue CRM (manuel) ────────────────────────────────────────────

export function tplPersonneBienvenue(opts: {
  orgName: string;
  firstName: string;
  role?: string;
}) {
  return base(
    `
    ${h1(`Bienvenue, ${opts.firstName} !`)}
    ${p(`Vous avez été ajouté(e) à l'annuaire de <strong>${opts.orgName}</strong>${opts.role ? ` en tant que <strong>${opts.role}</strong>` : ""}.`)}
    ${p("N'hésitez pas à prendre contact avec l'équipe pour toute question.")}
  `,
    opts.orgName
  );
}

// ── 14. Reçu caisse ───────────────────────────────────────────────────────

export function tplCaisseRecu(opts: {
  orgName: string;
  contactName?: string;
  ticketRef: string;
  label: string;
  amountTtc: number;
  paymentMethod: string;
  occurredAt: string;
}) {
  return base(
    `
    ${h1("Reçu de paiement")}
    ${opts.contactName ? p(`Bonjour <strong>${opts.contactName}</strong>,`) : ""}
    ${p(`Voici votre reçu pour le paiement effectué auprès de <strong>${opts.orgName}</strong>.`)}
    ${card([
      { label: "N° ticket",   value: opts.ticketRef },
      { label: "Objet",       value: opts.label },
      { label: "Montant TTC", value: `${opts.amountTtc.toFixed(2)} €` },
      { label: "Règlement",   value: opts.paymentMethod },
      { label: "Date",        value: new Date(opts.occurredAt).toLocaleDateString("fr-FR") },
    ])}
    ${p("Conservez cet email comme justificatif.")}
  `,
    opts.orgName
  );
}

// ── 15. Bienvenue compte ──────────────────────────────────────────────────

export function tplCompteBienvenue(opts: {
  orgName: string;
  orgSlug: string;
  firstName: string;
  dashboardUrl: string;
}) {
  return base(
    `
    ${h1(`Bienvenue sur Casa Minga Lieux !`)}
    ${p(`Bonjour <strong>${opts.firstName}</strong>,`)}
    ${p(`Votre espace de gestion pour <strong>${opts.orgName}</strong> est prêt.`)}
    ${divider()}
    ${p("Connectez-vous pour commencer à gérer votre lieu :")}
    ${btn("Accéder à mon espace →", opts.dashboardUrl)}
    ${p("Si vous avez des questions, répondez directement à cet email.")}
  `,
    opts.orgName
  );
}
