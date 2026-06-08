/**
 * Contenu du centre d'aide (global, commun à tous les lieux).
 * v1 : contenu en dur dans le repo — édité par l'équipe Casa Minga.
 * Migration possible vers une édition autonome via Supabase en v2.
 *
 * Le corps des articles est écrit en markdown léger :
 *   ## / ###  titres
 *   **gras**, `code`
 *   - listes à puces  /  1. listes ordonnées
 *   [texte](url)      liens
 *   > citation        encadré
 * (voir renderMarkdown dans help-md.ts)
 */

export interface HelpCategory {
  slug: string;
  label: string;
  /** clé d'icône lucide, mappée dans la page */
  icon: string;
  description: string;
}

export interface HelpArticle {
  slug: string;
  categorySlug: string;
  title: string;
  excerpt: string;
  keywords: string[];
  body: string;
  updatedAt: string; // ISO date
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    slug: "demarrage",
    label: "Débuter sur Casa Minga",
    icon: "rocket",
    description: "Créer votre espace, comprendre le tableau de bord, premiers réglages.",
  },
  {
    slug: "membres-adhesions",
    label: "Membres & adhésions",
    icon: "users",
    description: "Annuaire CRM, campagnes d'adhésion, formules et validations.",
  },
  {
    slug: "reservations-espaces",
    label: "Réservations & espaces",
    icon: "door",
    description: "Catalogue d'espaces, créneaux, confirmation et annulation.",
  },
  {
    slug: "evenements",
    label: "Événements",
    icon: "calendar",
    description: "Programmer un événement, inscriptions et rappels.",
  },
  {
    slug: "finances-caisse",
    label: "Finances & caisse certifiée",
    icon: "wallet",
    description: "Transactions, suivi du solde, caisse NF525 (loi anti-fraude TVA).",
  },
  {
    slug: "site-public",
    label: "Site public & demandes",
    icon: "globe",
    description: "Publier votre site, recevoir et traiter les demandes entrantes.",
  },
  {
    slug: "compte-equipe",
    label: "Compte & équipe",
    icon: "settings",
    description: "Se connecter, inviter des membres d'équipe, gérer les accès.",
  },
];

export const HELP_ARTICLES: HelpArticle[] = [
  // ── Démarrage ──────────────────────────────────────────────────────────
  {
    slug: "creer-mon-espace",
    categorySlug: "demarrage",
    title: "Créer l'espace de gestion de mon lieu",
    excerpt: "Les étapes pour créer votre compte et l'espace de votre lieu en quelques minutes.",
    keywords: ["inscription", "compte", "créer", "espace", "démarrer", "signup"],
    updatedAt: "2026-06-02",
    body: `
## Bienvenue !

Casa Minga Lieux est l'outil de pilotage des lieux collectifs : tiers-lieux, lieux culturels, résidences et espaces partagés. Voici comment créer votre espace.

### 1. Créez votre compte

Rendez-vous sur la page d'inscription et renseignez :

- Votre **prénom et nom** (vous serez administrateur du lieu)
- Votre **email** et un **mot de passe** (8 caractères minimum)

### 2. Décrivez votre lieu

À l'étape suivante, indiquez :

- Le **nom de votre lieu** — il génère automatiquement l'adresse de votre espace
- Le **type de structure** (association, SCIC, SCOP, collectif…)
- Un **email de contact** (facultatif)

### 3. Confirmez votre email

Vous recevrez un email de confirmation. Cliquez sur le lien, puis connectez-vous : vous arrivez directement sur votre tableau de bord.

> Besoin d'aide pour démarrer ? Écrivez à **support@casaminga.com**, nous accompagnons chaque nouveau lieu.
`,
  },
  {
    slug: "comprendre-tableau-de-bord",
    categorySlug: "demarrage",
    title: "Comprendre le tableau de bord",
    excerpt: "Le cockpit de votre lieu : ce qui se passe aujourd'hui, ce qui demande votre attention.",
    keywords: ["tableau de bord", "dashboard", "accueil", "kpi", "pilotage"],
    updatedAt: "2026-06-02",
    body: `
## Le cockpit de votre lieu

Le tableau de bord rassemble en un coup d'œil l'essentiel de l'activité.

### Les indicateurs clés

En haut, des tuiles résument : revenus du mois, espaces au catalogue, membres actifs, demandes en attente, événements à venir et solde net.

### Aujourd'hui

La colonne **Aujourd'hui** liste ce qui demande votre attention immédiate : réservations du jour, demandes à traiter, documents à signer, tâches urgentes.

### Premiers pas

Le bloc **Premiers pas** vous guide à travers les actions de configuration recommandées (ajouter des membres, créer une campagne d'adhésion, déclarer un espace…).

### La navigation

Le menu de gauche est organisé en sections repliables : **Pilotage**, **Gestion du lieu**, **Structure**, **Communication** et **Système**. Cliquez sur un titre de section pour la déplier.
`,
  },

  // ── Membres & adhésions ──────────────────────────────────────────────────
  {
    slug: "ajouter-un-membre",
    categorySlug: "membres-adhesions",
    title: "Ajouter une personne à l'annuaire",
    excerpt: "Enregistrer un membre, un contact ou un partenaire dans votre CRM.",
    keywords: ["membre", "personne", "crm", "annuaire", "contact", "ajouter"],
    updatedAt: "2026-06-02",
    body: `
## L'annuaire des personnes

La rubrique **Personnes** est le CRM de votre lieu : membres, bénévoles, contacts, partenaires.

### Ajouter une personne

1. Ouvrez **Personnes** dans le menu
2. Cliquez sur **Ajouter une personne**
3. Renseignez au minimum le **nom** ; email, téléphone, rôle, statut, tags et notes sont facultatifs
4. Cliquez sur **Ajouter**

> Ajouter une personne ne lui envoie **aucun email**. C'est un enregistrement interne dans votre annuaire.

### Les tags

Les tags (séparés par des virgules) servent à segmenter votre annuaire : \`bénévole\`, \`bureau\`, \`gestionnaire\`… Vous pourrez filtrer dessus plus tard.
`,
  },
  {
    slug: "creer-campagne-adhesion",
    categorySlug: "membres-adhesions",
    title: "Créer une campagne d'adhésion",
    excerpt: "Mettre en place vos formules d'adhésion et recevoir les souscriptions en ligne.",
    keywords: ["adhésion", "campagne", "cotisation", "formule", "membre", "helloasso"],
    updatedAt: "2026-06-02",
    body: `
## Campagnes d'adhésion

Une campagne regroupe vos **formules** d'adhésion sur une période donnée (ex. « Adhésion 2026 »).

### Créer une campagne

1. Ouvrez **Adhésions**
2. Créez une campagne : nom, période de validité, statut
3. Ajoutez une ou plusieurs **formules** (libellé, montant, avantages)
4. Publiez la campagne pour activer le tunnel public

### Recevoir les souscriptions

Une fois publiée, votre campagne dispose d'une page publique où les futurs membres choisissent leur formule et renseignent leurs coordonnées.

Chaque souscription crée une **candidature en attente** : un email de confirmation est automatiquement envoyé au candidat. Vous validez ensuite la candidature depuis le tableau de bord — la validation déclenche un **email de bienvenue avec reçu**.
`,
  },

  // ── Réservations & espaces ────────────────────────────────────────────────
  {
    slug: "declarer-un-espace",
    categorySlug: "reservations-espaces",
    title: "Déclarer un espace réservable",
    excerpt: "Ajouter une salle ou un espace à votre catalogue de réservation.",
    keywords: ["espace", "salle", "catalogue", "réservation", "déclarer"],
    updatedAt: "2026-06-02",
    body: `
## Le catalogue d'espaces

Avant de gérer des réservations, déclarez vos espaces (salles, ateliers, studios…).

### Ajouter un espace

1. Ouvrez **Espaces**
2. Cliquez sur **Ajouter un espace**
3. Renseignez le nom, la capacité, les tarifs (heure / journée) et une description
4. Définissez son statut (disponible / indisponible)

Vos espaces apparaissent ensuite dans le module **Réservations** et, si vous le souhaitez, sur votre site public.
`,
  },
  {
    slug: "gerer-une-reservation",
    categorySlug: "reservations-espaces",
    title: "Gérer une réservation",
    excerpt: "Confirmer, annuler une réservation et comprendre les emails automatiques.",
    keywords: ["réservation", "confirmer", "annuler", "créneau", "agenda"],
    updatedAt: "2026-06-02",
    body: `
## Les réservations

Le module **Réservations** affiche les créneaux par espace et empêche les **chevauchements** automatiquement.

### Confirmer une réservation

Une réservation arrive au statut « demandée ». Lorsque vous la passez en **confirmée**, un email de confirmation est envoyé au contact.

### Annuler

Passer une réservation en **annulée** libère le créneau et envoie un email d'annulation au contact.

> Les emails ne sont envoyés que si l'adresse du contact est renseignée.
`,
  },

  // ── Finances & caisse ──────────────────────────────────────────────────────
  {
    slug: "caisse-certifiee-nf525",
    categorySlug: "finances-caisse",
    title: "La caisse certifiée NF525 (loi anti-fraude TVA)",
    excerpt: "Comprendre la caisse inaltérable conforme à la loi anti-fraude TVA de 2018.",
    keywords: ["caisse", "nf525", "tva", "fraude", "certifiée", "inaltérable", "clôture"],
    updatedAt: "2026-06-02",
    body: `
## Caisse certifiée

Si votre lieu encaisse des paiements (buvette, billetterie, boutique…), la **loi anti-fraude TVA** de 2018 impose un logiciel de caisse respectant 4 conditions : **inaltérabilité, sécurisation, conservation, archivage**.

La caisse de Casa Minga Lieux est conçue pour répondre à ces obligations.

### Inaltérabilité

Chaque écriture est **figée** dès sa création : impossible de la modifier ou de la supprimer. Pour corriger une erreur, on enregistre une écriture d'**annulation** (montant négatif) qui référence l'écriture d'origine.

### Sécurisation par chaînage

Les écritures sont chaînées entre elles par une **empreinte cryptographique (SHA-256)**. La moindre altération romprait la chaîne, ce qui la rend détectable. Le bouton **Vérifier l'intégrité** contrôle la chaîne à tout moment.

### Conservation & clôtures

Vous pouvez réaliser des **clôtures** journalières, mensuelles et annuelles. Chaque clôture fige les totaux de la période, conserve la ventilation de TVA et reporte le **grand total perpétuel**.

### Archivage

Les données de caisse sont conservées et exportables pour répondre à un contrôle de l'administration fiscale.

> En cas de contrôle, ces mécanismes permettent de prouver que vos encaissements n'ont pas été altérés.
`,
  },

  // ── Site public & demandes ───────────────────────────────────────────────
  {
    slug: "recevoir-traiter-demandes",
    categorySlug: "site-public",
    title: "Recevoir et traiter les demandes",
    excerpt: "Le pont entre votre site public et votre équipe.",
    keywords: ["demande", "contact", "formulaire", "site public", "traiter"],
    updatedAt: "2026-06-02",
    body: `
## Les demandes entrantes

Lorsque votre site public est publié, le formulaire de contact alimente directement la rubrique **Demandes** de votre tableau de bord.

### Ce qui se passe à la réception

1. La demande est enregistrée et apparaît dans **Demandes**
2. Le demandeur reçoit un **accusé de réception** par email
3. Votre équipe reçoit une **alerte** par email

### Traiter une demande

Faites évoluer le statut : **à étudier**, **acceptée** ou **refusée**. Chaque changement de statut envoie un email d'information au demandeur.
`,
  },

  // ── Compte & équipe ──────────────────────────────────────────────────────
  {
    slug: "se-connecter",
    categorySlug: "compte-equipe",
    title: "Se connecter à mon espace",
    excerpt: "Accéder à votre tableau de bord et retrouver l'adresse de votre lieu.",
    keywords: ["connexion", "login", "mot de passe", "accès", "se connecter"],
    updatedAt: "2026-06-02",
    body: `
## Se connecter

Rendez-vous sur la page de connexion et saisissez votre **email** et votre **mot de passe**. Vous êtes redirigé automatiquement vers le tableau de bord de votre lieu.

### Mot de passe oublié

Sur la page de connexion, utilisez le lien de réinitialisation : vous recevrez un email pour définir un nouveau mot de passe.

### L'adresse de mon espace

Votre espace est accessible à l'adresse \`admin.casaminga.com/dashboard/\` suivie de l'identifiant de votre lieu.
`,
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getCategory(slug: string): HelpCategory | undefined {
  return HELP_CATEGORIES.find((c) => c.slug === slug);
}

export function getArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function articlesByCategory(categorySlug: string): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.categorySlug === categorySlug);
}
