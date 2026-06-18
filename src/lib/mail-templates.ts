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
function resourceLinks(links: { label: string; href: string }[]) {
  const items = links
    .map(
      (l) =>
        `<a href="${l.href}" style="display:inline-block;margin:4px 6px;padding:8px 16px;background:#FAFAF7;border:1px solid #E5DDD6;border-radius:8px;font-size:13px;color:#FF8A65;font-weight:600;text-decoration:none;">${l.label}</a>`
    )
    .join("");
  return `<div style="margin:20px 0;text-align:center;">${items}</div>`;
}
function signatureLeo() {
  return `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #F0E8E0;">
    <p style="margin:0;font-size:14px;color:#4A4540;line-height:1.5;">
      Léo Durand<br/>
      <span style="color:#9C9590;font-size:13px;">Fondateur · Casa Minga Lieux</span><br/>
      <a href="mailto:leo@casaminga.com" style="color:#FF8A65;font-size:13px;text-decoration:none;">leo@casaminga.com</a>
    </p>
  </div>`;
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

// ── 1b. Confirmation d'inscription newsletter (double opt-in) ──────────────

export function tplNewsletterConfirm(opts: { orgName: string; confirmUrl: string }) {
  return base(
    `
    ${h1("Confirmez votre inscription ✉️")}
    ${p(`Vous (ou quelqu'un avec votre adresse) avez demandé à recevoir la newsletter de <strong>${opts.orgName}</strong>.`)}
    ${p("Pour finaliser votre inscription, cliquez sur le bouton ci-dessous :")}
    ${btn("Confirmer mon inscription", opts.confirmUrl)}
    ${p(`<span style="font-size:13px;color:#9C9590;">Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email : aucune inscription ne sera enregistrée sans cette confirmation.</span>`)}
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
  siteUrl?: string;
}) {
  return base(
    `
    ${h1(`Bienvenue, ${opts.firstName} !`)}
    ${p(`Vous avez été ajouté(e) à l'annuaire de <strong>${opts.orgName}</strong>${opts.role ? ` en tant que <strong>${opts.role}</strong>` : ""}.`)}
    ${p("N'hésitez pas à prendre contact avec l'équipe pour toute question.")}
    ${opts.siteUrl ? btn(`Découvrir ${opts.orgName} →`, opts.siteUrl) : ""}
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
  helpUrl?: string;
  demoUrl?: string;
}) {
  const helpUrl = opts.helpUrl ?? "https://admin.casaminga.com/aide";
  const demoUrl = opts.demoUrl ?? "https://admin.casaminga.com/demo";
  return base(
    `
    ${h1(`Bienvenue sur Casa Minga Lieux !`)}
    ${p(`Bonjour <strong>${opts.firstName}</strong>,`)}
    ${p(`Votre espace de gestion pour <strong>${opts.orgName}</strong> est prêt. Vous avez accès à l'ensemble des outils pour gérer votre lieu : adhésions, événements, réservations, site public et bien plus.`)}
    ${btn("Accéder à mon espace →", opts.dashboardUrl)}
    ${divider()}
    <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#2C2C2C;">Pour bien démarrer en 3 étapes :</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      <tr>
        <td style="padding:10px 12px;background:#FAFAF7;border:1px solid #E5DDD6;border-radius:10px;margin-bottom:8px;display:block;">
          <span style="font-size:18px;">1.</span>
          <span style="font-size:14px;color:#2C2C2C;font-weight:600;margin-left:8px;">Configurez votre profil d'organisation</span>
          <p style="margin:4px 0 0 28px;font-size:13px;color:#9C9590;">Nom, logo, description, coordonnées — ce sont les infos qui apparaissent sur votre site public.</p>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="padding:10px 12px;background:#FAFAF7;border:1px solid #E5DDD6;border-radius:10px;">
          <span style="font-size:18px;">2.</span>
          <span style="font-size:14px;color:#2C2C2C;font-weight:600;margin-left:8px;">Activez vos premiers modules</span>
          <p style="margin:4px 0 0 28px;font-size:13px;color:#9C9590;">Adhésions, événements, réservations — activez uniquement ce dont vous avez besoin.</p>
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="padding:10px 12px;background:#FAFAF7;border:1px solid #E5DDD6;border-radius:10px;">
          <span style="font-size:18px;">3.</span>
          <span style="font-size:14px;color:#2C2C2C;font-weight:600;margin-left:8px;">Invitez votre équipe</span>
          <p style="margin:4px 0 0 28px;font-size:13px;color:#9C9590;">Ajoutez les membres de votre équipe pour qu'ils gèrent le lieu avec vous.</p>
        </td>
      </tr>
    </table>
    ${divider()}
    <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#2C2C2C;">Ressources utiles</p>
    ${resourceLinks([
      { label: "📖 Centre d'aide", href: helpUrl },
      { label: "🎬 Voir une démo", href: demoUrl },
      { label: "✉️ Nous écrire", href: "mailto:leo@casaminga.com" },
    ])}
    ${divider()}
    ${p("Si quelque chose ne fonctionne pas ou si vous avez la moindre question, répondez directement à cet email. Je lis personnellement tous les messages.")}
    ${signatureLeo()}
  `,
    "Casa Minga Lieux"
  );
}

// ── 17-bis. Onboarding J+3 : "Avez-vous commencé ?" ──────────────────────

export function tplOnboardingJ3(opts: {
  orgName: string;
  firstName: string;
  dashboardUrl: string;
  helpUrl?: string;
}) {
  const helpUrl = opts.helpUrl ?? "https://admin.casaminga.com/aide";
  return base(
    `
    ${h1(`Vous vous en sortez bien, ${opts.firstName} ?`)}
    ${p(`Bonjour <strong>${opts.firstName}</strong>,`)}
    ${p(`Il y a 3 jours, vous avez créé l'espace de <strong>${opts.orgName}</strong> sur Casa Minga Lieux. Je voulais juste m'assurer que tout s'est bien passé.`)}
    ${divider()}
    <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#2C2C2C;">Les modules les plus utilisés par les lieux comme le vôtre :</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      <tr>
        <td style="padding:8px 12px;font-size:13px;color:#4A4540;line-height:1.6;">
          🏷️ <strong>Adhésions</strong> — Gérez vos membres, les formules et les renouvellements en quelques clics.<br/>
          📅 <strong>Événements</strong> — Créez un événement public et récoltez des inscriptions depuis votre site.<br/>
          🔑 <strong>Réservations</strong> — Ouvrez vos espaces à la réservation avec un calendrier partagé.
        </td>
      </tr>
    </table>
    ${btn("Continuer la configuration →", opts.dashboardUrl)}
    ${divider()}
    ${p(`Si quelque chose vous bloque — une question technique, une fonctionnalité que vous ne trouvez pas — le <a href="${helpUrl}" style="color:#FF8A65;">centre d'aide</a> répond à 90% des cas. Et sinon, répondez à cet email. Je suis là.`)}
    ${signatureLeo()}
  `,
    "Casa Minga Lieux"
  );
}

// ── 17-ter. Onboarding J+7 : invitation 1-to-1 ───────────────────────────

export function tplOnboardingJ7(opts: {
  orgName: string;
  firstName: string;
  dashboardUrl: string;
  calUrl?: string;
}) {
  const calUrl = opts.calUrl ?? "mailto:leo@casaminga.com?subject=Démo Casa Minga Lieux";
  return base(
    `
    ${h1(`Un coup de main pour ${opts.orgName} ?`)}
    ${p(`Bonjour <strong>${opts.firstName}</strong>,`)}
    ${p(`Ça fait une semaine que vous utilisez Casa Minga Lieux. Je voulais vous proposer quelque chose : <strong>30 minutes ensemble</strong>, en visio ou par téléphone, pour faire le point sur votre configuration.`)}
    ${p(`On regarde ensemble ce qui est déjà en place, je réponds à vos questions, et on identifie les modules qui pourraient vous faire gagner le plus de temps.`)}
    ${p(`<em style="color:#9C9590;">Aucun engagement, aucune vente — juste un échange de terrain.</em>`)}
    ${btn("Réserver un créneau avec Léo →", calUrl)}
    ${divider()}
    ${p(`Pas le temps pour un appel ? Vous pouvez aussi répondre directement à cet email avec vos questions, je réponds sous 24h.`)}
    ${signatureLeo()}
  `,
    "Casa Minga Lieux"
  );
}

// ── 18. Tâche assignée (à l'assigné) ──────────────────────────────────────

export function tplTacheAssignee(opts: {
  orgName: string;
  assigneeName: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priorityLabel: string;
  validateUrl: string;
}) {
  return base(
    `
    ${badge("Tâche qui vous est confiée", "#E8714D")}
    <div style="height:12px;"></div>
    ${h1(opts.title)}
    ${p(`Bonjour <strong>${opts.assigneeName}</strong>,`)}
    ${p(`L'équipe de <strong>${opts.orgName}</strong> vous a confié une tâche.`)}
    ${card([
      { label: "Priorité", value: opts.priorityLabel },
      ...(opts.dueDate ? [{ label: "Échéance", value: new Date(opts.dueDate).toLocaleDateString("fr-FR") }] : []),
      ...(opts.description ? [{ label: "Détails", value: opts.description.slice(0, 300) + (opts.description.length > 300 ? "…" : "") }] : []),
    ])}
    ${p(`Quand c'est fait, cliquez ci-dessous : l'équipe sera prévenue automatiquement. Pas besoin de compte.`)}
    ${btn("✓ Marquer comme faite", opts.validateUrl)}
  `,
    opts.orgName
  );
}

// ── 19. Rappel de tâche (à l'assigné) ─────────────────────────────────────

export function tplTacheRappel(opts: {
  orgName: string;
  assigneeName: string;
  title: string;
  dueDate?: string | null;
  validateUrl: string;
}) {
  const overdue = opts.dueDate ? new Date(opts.dueDate) < new Date() : false;
  return base(
    `
    ${badge(overdue ? "Tâche en retard" : "Petit rappel", overdue ? "#EF4444" : "#F59E0B")}
    <div style="height:12px;"></div>
    ${h1("Cette tâche vous attend")}
    ${p(`Bonjour <strong>${opts.assigneeName}</strong>,`)}
    ${p(`Un rappel concernant la tâche <strong>« ${opts.title} »</strong> confiée par <strong>${opts.orgName}</strong>${opts.dueDate ? `, à rendre pour le <strong>${new Date(opts.dueDate).toLocaleDateString("fr-FR")}</strong>` : ""}.`)}
    ${p(`Si c'est déjà fait, un clic suffit pour prévenir l'équipe :`)}
    ${btn("✓ Marquer comme faite", opts.validateUrl)}
  `,
    opts.orgName
  );
}

// ── 20. Tâche validée par l'assigné (au coordinateur) ─────────────────────

export function tplTacheValidee(opts: {
  orgName: string;
  assigneeName: string;
  title: string;
  dashboardUrl: string;
}) {
  return base(
    `
    ${badge("Tâche terminée ✓", "#22C55E")}
    <div style="height:12px;"></div>
    ${h1("Une tâche vient d'être validée")}
    ${p(`<strong>${opts.assigneeName}</strong> a marqué la tâche <strong>« ${opts.title} »</strong> comme faite.`)}
    ${p(`Elle est désormais en colonne « Fait » dans votre tableau.`)}
    ${btn("Voir le tableau des tâches →", opts.dashboardUrl)}
  `,
    opts.orgName
  );
}

// ── 21. Lien de paiement d'une réservation (au réservant) ─────────────────

export function tplLienPaiement(opts: {
  orgName: string;
  contactName: string;
  label: string;
  amount: number;
  startAt?: string | null;
  payUrl: string;
}) {
  const fmt = (d: string) => new Date(d).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
  return base(
    `
    ${badge("Paiement sécurisé", "#635BFF")}
    <div style="height:12px;"></div>
    ${h1("Réglez votre réservation en ligne")}
    ${p(`Bonjour <strong>${opts.contactName}</strong>,`)}
    ${p(`Voici le lien pour régler votre réservation auprès de <strong>${opts.orgName}</strong>.`)}
    ${card([
      { label: "Objet", value: opts.label },
      ...(opts.startAt ? [{ label: "Créneau", value: fmt(opts.startAt) }] : []),
      { label: "Montant", value: `${opts.amount.toFixed(2)} €` },
    ])}
    ${btn("Payer maintenant →", opts.payUrl)}
    ${p(`Le paiement est traité de façon sécurisée par Stripe. Vous recevrez automatiquement un reçu.`)}
  `,
    opts.orgName
  );
}

// ── 17. Newsletter / bulletin (aux membres) ───────────────────────────────

export function tplNewsletter(opts: {
  orgName: string;
  title: string;
  /** Corps en texte simple : les sauts de ligne deviennent des paragraphes. */
  body: string;
}) {
  const paragraphs = opts.body
    .split(/\n{2,}/)
    .map((para) => p(para.replace(/\n/g, "<br/>")))
    .join("");
  return base(
    `
    ${h1(opts.title)}
    ${paragraphs}
  `,
    opts.orgName
  );
}

// ── 18. Lien espace adhérent (portail) ───────────────────────────────────

export function tplPortalLink(opts: {
  firstName: string;
  portalUrl: string;
  orgName?: string;
  establishmentName?: string | null;
}) {
  const orgName = opts.orgName || "Casa Minga";
  const sender =
    opts.establishmentName && opts.establishmentName !== orgName
      ? `<strong>${orgName}</strong> — ${opts.establishmentName}`
      : `<strong>${orgName}</strong>`;
  return base(
    `
    ${h1("Bienvenue dans votre espace adhérent ✨")}
    ${p(`Bonjour <strong>${opts.firstName || "cher adhérent"}</strong>,`)}
    ${p(`${sender} vous ouvre votre <strong>espace adhérent personnel</strong> : un espace en ligne dédié à votre lien avec le lieu.`)}
    <div style="background:#FAFAF7;border:1px solid #E5DDD6;border-radius:12px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#2C2C2C;">Dans votre espace, vous pouvez :</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;color:#4A4540;line-height:1.9;">
        <tr><td>📋&nbsp;&nbsp;Consulter votre <strong>statut d'adhésion</strong> et votre historique</td></tr>
        <tr><td>🎟️&nbsp;&nbsp;Retrouver vos <strong>billets et inscriptions</strong> à venir</td></tr>
        <tr><td>🔄&nbsp;&nbsp;<strong>Renouveler</strong> votre adhésion en quelques clics</td></tr>
        <tr><td>🧾&nbsp;&nbsp;Télécharger vos <strong>reçus</strong> et documents</td></tr>
      </table>
    </div>
    ${btn("Accéder à mon espace →", opts.portalUrl)}
    ${p(`<span style="font-size:13px;color:#9C9590;">Cet espace est propulsé par <strong>Casa Minga</strong>, l'outil avec lequel ${orgName} gère ses adhésions, ses événements et sa communauté. Rien à installer : tout se passe en ligne, depuis ce lien.</span>`)}
    ${p(`Ce lien est strictement personnel — ne le partagez pas. Il reste valide jusqu'à ce que vous en demandiez un nouveau.`)}
    <p style="margin:24px 0 0;font-size:12px;color:#9C9590;text-align:center;">
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
      <span style="font-size:11px;word-break:break-all;">${opts.portalUrl}</span>
    </p>
  `,
    orgName
  );
}

// ── 19. Convocation assemblée générale (aux membres) ─────────────────────

export function tplConvocation(opts: {
  orgName: string;
  meetingTitle: string;
  meetingDate: string;
  meetingType: string;
  agenda: string | null;
  firstName: string;
}) {
  const fmt = (d: string) =>
    new Date(d).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
  return base(
    `
    ${badge("Convocation officielle", "#6366f1")}
    <div style="height:12px;"></div>
    ${h1(`${opts.meetingTitle}`)}
    ${p(`Bonjour <strong>${opts.firstName || "Madame, Monsieur"}</strong>,`)}
    ${p(`Vous êtes convoqué(e) à la <strong>${opts.meetingType}</strong> organisée par <strong>${opts.orgName}</strong>.`)}
    ${card([
      { label: "Instance", value: opts.meetingType },
      { label: "Titre", value: opts.meetingTitle },
      { label: "Date", value: fmt(opts.meetingDate) },
    ])}
    ${opts.agenda ? `<div style="margin:16px 0;"><p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#2C2C2C;">Ordre du jour</p><div style="background:#FAFAF7;border:1px solid #E5DDD6;border-radius:10px;padding:14px 16px;font-size:13px;color:#4A4540;line-height:1.7;white-space:pre-wrap;">${opts.agenda.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div></div>` : ""}
    ${p("En cas d'empêchement, vous pouvez donner pouvoir à un·e autre membre. Contactez directement l'équipe pour plus d'informations.")}
    ${p("Cordialement,")}
  `,
    opts.orgName
  );
}

// ── 20. Demande de signature électronique ─────────────────────────────────

export function tplSignatureRequest(opts: {
  orgName: string;
  recipientName: string;
  documentTitle: string;
  documentType: string;
  signUrl: string;
}) {
  return base(
    `
    ${badge("Signature requise", "#6366f1")}
    <div style="height:12px;"></div>
    ${h1(`Document à signer : ${opts.documentTitle}`)}
    ${p(`Bonjour <strong>${opts.recipientName || "Madame, Monsieur"}</strong>,`)}
    ${p(`<strong>${opts.orgName}</strong> vous demande de signer électroniquement le document suivant.`)}
    ${card([
      { label: "Document", value: opts.documentTitle },
      { label: "Type", value: opts.documentType },
    ])}
    ${btn("Signer le document →", opts.signUrl)}
    ${p(`Ce lien est strictement personnel — ne le partagez pas. Une fois signé, votre signature sera enregistrée avec la date et l'heure.`)}
    ${p(`Si vous ne vous attendiez pas à recevoir ce message, ignorez simplement cet email.`)}
  `,
    opts.orgName
  );
}

// ── 21. Confirmation de signature (au coordinateur) ──────────────────────

export function tplDocumentSigned(opts: {
  orgName: string;
  documentTitle: string;
  signerName: string;
  signedAt: string;
  dashboardUrl: string;
}) {
  return base(
    `
    ${badge("Document signé ✓", "#22C55E")}
    <div style="height:12px;"></div>
    ${h1("Un document vient d'être signé")}
    ${p(`<strong>${opts.signerName}</strong> a signé le document <strong>« ${opts.documentTitle} »</strong>.`)}
    ${card([
      { label: "Document", value: opts.documentTitle },
      { label: "Signataire", value: opts.signerName },
      { label: "Date", value: new Date(opts.signedAt).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" }) },
    ])}
    ${btn("Voir le document →", opts.dashboardUrl)}
  `,
    opts.orgName
  );
}

// ── Reçu fiscal par email (pièce jointe PDF) ─────────────────────────────

export function tplReceiptEmail(opts: {
  orgName: string;
  donorName: string;
  year: number;
  amount: number;
}) {
  return base(
    `
    ${h1("Votre reçu fiscal")}
    ${p(`Bonjour <strong>${opts.donorName}</strong>,`)}
    ${p(`Veuillez trouver en pièce jointe votre reçu fiscal ${opts.year} émis par <strong>${opts.orgName}</strong>.`)}
    ${card([
      { label: "Organisme",       value: opts.orgName },
      { label: "Exercice fiscal", value: String(opts.year) },
      { label: "Montant",         value: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(opts.amount) },
    ])}
    ${p("Ce reçu vous permet de bénéficier de la réduction d'impôt prévue à l'article 200 du Code général des impôts (CGI). Conservez-le pour votre déclaration de revenus.")}
    ${p("Pour toute question, répondez directement à cet email.")}
  `,
    opts.orgName
  );
}

// ── 16. Facture / rappel de paiement (au client) ──────────────────────────

export function tplFactureRappel(opts: {
  orgName: string;
  clientName: string;
  invoiceNumber: string;
  amountTtc: string;
  dueDate: string;
  iban?: string | null;
  isReminder?: boolean;
}) {
  return base(
    `
    ${badge(opts.isReminder ? "RAPPEL DE PAIEMENT" : "FACTURE", opts.isReminder ? "#E8714D" : "#FF8A65")}
    ${h1(opts.isReminder ? "Rappel : facture en attente" : `Votre facture ${opts.invoiceNumber}`)}
    ${p(`Bonjour <strong>${opts.clientName}</strong>,`)}
    ${p(
      opts.isReminder
        ? `Sauf erreur de notre part, la facture ci-dessous reste en attente de règlement. Vous la trouverez en pièce jointe.`
        : `Veuillez trouver ci-joint votre facture émise par <strong>${opts.orgName}</strong>.`
    )}
    ${card([
      { label: "N° de facture", value: opts.invoiceNumber },
      { label: "Montant TTC", value: opts.amountTtc },
      { label: "Échéance", value: opts.dueDate },
      ...(opts.iban ? [{ label: "IBAN", value: opts.iban }] : []),
    ])}
    ${p("Le PDF de la facture est joint à cet email. Merci de votre confiance.")}
  `,
    opts.orgName
  );
}

// ── Reçu de paiement en ligne (adhésion ou billet) ───────────────────────

export function tplPaiementConfirme(opts: {
  orgName: string;
  firstName: string;
  description: string;
  amountEuros: number;
  receiptRef: string;
  date: string;
}) {
  const fmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(opts.amountEuros);
  const dateStr = new Date(opts.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  return base(
    `
    ${badge("Paiement confirmé ✓", "#22C55E")}
    <div style="height:12px;"></div>
    ${h1("Votre paiement a été reçu")}
    ${p(`Bonjour <strong>${opts.firstName}</strong>,`)}
    ${p(`Merci ! Votre paiement auprès de <strong>${opts.orgName}</strong> a bien été enregistré.`)}
    ${card([
      { label: "Objet",        value: opts.description },
      { label: "Montant payé", value: fmt },
      { label: "Date",         value: dateStr },
      { label: "Référence",    value: opts.receiptRef.slice(0, 24) + "…" },
    ])}
    ${p("Le reçu PDF est joint à cet email. Conservez-le comme justificatif de paiement.")}
    ${p("Merci pour votre confiance !")}
  `,
    opts.orgName
  );
}

// ── Invitation compte admin ───────────────────────────────────────────────────

export function tplInvitationCompte(opts: {
  orgName: string;
  inviteUrl: string;
  roleLabelStr: string;
}) {
  return base(
    `
    ${badge("Invitation", "#6366f1")}
    <div style="height:12px;"></div>
    ${h1(`Rejoignez l'espace de gestion`)}
    ${p(`<strong>${opts.orgName}</strong> vous invite à rejoindre son espace de gestion sur <strong>Casa Minga Lieux</strong>, en tant que <strong>${opts.roleLabelStr}</strong>.`)}
    <div style="background:#FAFAF7;border:1px solid #E5DDD6;border-radius:12px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#2C2C2C;">Casa Minga Lieux, c'est quoi ?</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;color:#4A4540;line-height:1.9;">
        <tr><td>👥&nbsp;&nbsp;Gérer les <strong>membres et adhésions</strong> de l'association</td></tr>
        <tr><td>📅&nbsp;&nbsp;Planifier et publier des <strong>événements</strong></td></tr>
        <tr><td>🔑&nbsp;&nbsp;Suivre les <strong>réservations d'espaces</strong></td></tr>
        <tr><td>💬&nbsp;&nbsp;Communiquer avec les membres et partenaires</td></tr>
      </table>
    </div>
    ${btn("Créer mon compte →", opts.inviteUrl)}
    ${p(`<span style="font-size:13px;color:#9C9590;">Ce lien est valable 7 jours. Si vous n'êtes pas concerné(e) par cette invitation, ignorez simplement cet email.</span>`)}
  `,
    opts.orgName
  );
}

// ── Facture ecommunication (superadmin / Léo Durand EI) ─────────────────────

export function tplFactureEcommunication(opts: {
  issuerName: string;
  clientName: string;
  number: string;
  object: string | null;
  amountEuros: number;
  dueDate: string | null;
  iban: string | null;
  bic: string | null;
}) {
  const fmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(opts.amountEuros);
  const dueStr = opts.dueDate
    ? new Date(opts.dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : "à réception";
  const rows = [
    { label: "Facture n°", value: opts.number },
    ...(opts.object ? [{ label: "Objet", value: opts.object }] : []),
    { label: "Montant", value: fmt },
    { label: "Échéance", value: dueStr },
  ];
  const paiement = opts.iban
    ? p(`Règlement par virement — IBAN <strong>${opts.iban}</strong>${opts.bic ? ` · BIC ${opts.bic}` : ""}.`)
    : "";
  return base(
    `
    ${badge("Nouvelle facture", "#FF8A65")}
    <div style="height:12px;"></div>
    ${h1("Votre facture")}
    ${p(`Bonjour,`)}
    ${p(`Veuillez trouver ci-joint la facture <strong>${opts.number}</strong> émise par <strong>${opts.issuerName}</strong>.`)}
    ${card(rows)}
    ${paiement}
    ${p("La facture détaillée est jointe au format PDF. Pour toute question, répondez directement à cet email.")}
  `,
    opts.issuerName
  );
}
