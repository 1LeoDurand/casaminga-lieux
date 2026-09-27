# API de l'espace adhérent (pour casaminga.com)

Deux routes de l'admin, appelées depuis le navigateur par la page
`/mon-espace` de casaminga.com (site statique, sans secret). L'admin garde le
secret de signature et lit la base ; le site public affiche.

Base : `https://admin.casaminga.com` (en local : l'adresse du `next start`).

## Jeton

- Chaîne opaque, caractères `A-Z a-z 0-9 _ - .`. Ne pas l'analyser côté site.
- Valable **30 jours** après son émission (`PORTAL_TOKEN_TTL_MS`,
  `src/lib/portal/token.ts`). Les anciens liens, sans date, restent acceptés
  jusqu'au **31/12/2026 inclus** (`LEGACY_TOKEN_ACCEPTED_UNTIL`).
- Il arrive dans le **fragment** de l'adresse envoyée par courriel :
  `https://casaminga.com/mon-espace#<jeton>`. Le fragment ne part jamais vers
  un serveur : ni journaux d'accès, ni en-tête Referer. La page doit le lire,
  le retirer aussitôt de la barre d'adresse (`history.replaceState`) et ne
  l'envoyer qu'en en-tête `Authorization`.
- Le même jeton ouvre aussi les pages `/espace/<jeton>/...` de l'admin : les
  liens de téléchargement renvoyés par l'API le contiennent déjà.

## CORS

Commun aux deux routes (`src/lib/http/cors.ts`) :

- Origines autorisées : `https://casaminga.com`, `https://www.casaminga.com`,
  et `http://localhost:5174` hors production ou si `CORS_ALLOW_LOCALHOST=1`
  (à ne poser qu'en local : `next start` tourne en mode production).
- Pas de cookies : ne pas utiliser `credentials: "include"`.
- `OPTIONS` répond `204`. Origine autorisée : `Access-Control-Allow-Origin`
  (l'origine exacte), `-Allow-Methods`, `-Allow-Headers`, `-Max-Age: 600`.
  Origine refusée : aucun en-tête `Access-Control-*`.
- Toute réponse porte `Vary: Origin`.
- Une requête dont l'en-tête `Origin` n'est pas autorisé reçoit `403`
  `{ "error": "forbidden_origin" }`. Sans en-tête `Origin` (curl, serveur),
  la route répond normalement, sans en-têtes CORS.

## POST /api/espace/lien

Demande qu'un lien d'accès soit envoyé par courriel.

Requête :

```
POST /api/espace/lien
Content-Type: application/json

{ "email": "adresse saisie", "retour": "public" }
```

- `email` : texte libre, tel que saisi.
- `retour` : `"public"` (le lien pointe vers
  `https://casaminga.com/mon-espace#<jeton>`) ou `"admin"` (le lien pointe vers
  `https://admin.casaminga.com/espace/<jeton>`). casaminga.com envoie toujours
  `"public"`.

Réponses :

| Code | Corps | Quand |
|---|---|---|
| 200 | `{ "ok": true }` | **Toujours** dès que le corps est bien formé : courriel connu, inconnu, malformé, limite atteinte, envoi en panne. |
| 400 | `{ "error": "invalid_body" }` | Corps absent, illisible (JSON invalide) ou de plus de 2 Ko. |
| 400 | `{ "error": "invalid_retour" }` | `retour` n'est ni `"public"` ni `"admin"`. |
| 403 | `{ "error": "forbidden_origin" }` | Origine non autorisée. |

Le `200` ne dit **rien** de l'existence d'un dossier : afficher un message
neutre du type « Si un dossier correspond à cette adresse, un lien vient de
vous être envoyé ». La recherche et l'envoi se font après la réponse, pour que
le temps de réponse ne trahisse pas non plus un dossier existant.

Limites (silencieuses, même réponse `200`) : 3 liens par courriel et par heure,
20 demandes par adresse IP et par heure. Aucun courriel n'est envoyé à une
adresse sans adhésion, billet, fiche ou facture. En-tête `Cache-Control: no-store`.

## GET /api/espace/donnees

Lit l'espace de la personne dont le courriel est signé dans le jeton, toutes
organisations confondues (`getPortalDataByEmail`, projeté par
`src/lib/portal/public-view.ts`).

Requête :

```
GET /api/espace/donnees
Authorization: Bearer <jeton>
```

Réponses :

| Code | Corps | Quand |
|---|---|---|
| 200 | `PortalView` (ci-dessous) | Jeton valide. `orgs` peut être vide. |
| 401 | `{ "error": "unauthorized" }` + `WWW-Authenticate: Bearer` | Jeton absent, altéré, expiré ou ancien format après la transition. La raison n'est jamais donnée : proposer un nouveau lien. |
| 403 | `{ "error": "forbidden_origin" }` | Origine non autorisée. |
| 503 | `{ "error": "unavailable" }` | Base non configurée côté admin. Dire « service indisponible », jamais « aucun billet ». |

Toujours `Cache-Control: no-store`.

### PortalView

```ts
interface PortalView {
  email: string;                 // courriel du jeton, normalisé en minuscules
  orgs: PortalViewOrg[];         // un bloc par organisation ; adhésion active en premier
}

interface PortalViewOrg {
  orgSlug: string;               // slug public du lieu (casaminga.com/<slug>)
  orgName: string;
  displayName: string;           // nom de la fiche de la personne, sinon orgName
  adhesion: PortalViewAdhesion | null;   // la plus récente
  billets: PortalViewBillet[];           // à venir seulement, par date croissante
  reservations: PortalViewReservation[]; // réservations d'espace à venir
  recus: PortalViewRecu[];               // reçus fiscaux, plus récent d'abord
  factures: PortalViewFacture[];         // hors brouillons, annulées et avoirs
}

interface PortalViewAdhesion {
  status: "active" | "expire_bientot" | "expiree" | "en_attente" | "aucune";
  tierName: string | null;
  amount: number;                // euros
  membershipStart: string | null;  // date ISO
  membershipEnd: string | null;    // date ISO
  renewUrl: string | null;           // formulaire de la campagne d'adhésion ouverte du lieu
  attestationUrl: string | null;     // PDF, seulement si status = active ou expire_bientot
  declineRenewalUrl: string | null;  // « je ne renouvelle pas », seulement si expire_bientot
}

interface PortalViewBillet {
  holderName: string;
  eventTitle: string;
  eventStartAt: string;          // ISO
  ticketUrl: string;             // billet avec QR code : /billet/<jeton du billet>
}

interface PortalViewReservation {
  title: string | null;
  spaceName: string | null;
  startAt: string;               // ISO
  endAt: string | null;          // ISO
  status: "demandee" | "confirmee";
  manageUrl: string;             // détail et annulation
}

interface PortalViewRecu {
  number: string | null;
  year: number;                  // année fiscale
  amount: number;                // euros
  donationDate: string;          // date ISO
  pdfUrl: string;                // reçu fiscal PDF
}

interface PortalViewFacture {
  number: string | null;
  object: string | null;
  amountTtc: number;             // euros
  dueDate: string | null;        // date ISO
  issueDate: string | null;      // date ISO
  status: "payee" | "a_regler" | "en_retard" | "declaree";
  canDeclare: boolean;           // la personne peut encore signaler un paiement
  url: string;                   // page de la facture (état, déclaration de paiement)
}
```

Aucun identifiant interne n'est renvoyé (organisation, adhésion, facture,
reçu, réservation, jeton de billet) : ils ne figurent que dans les URL.

### Liens

Toutes les URL sont absolues et pointent vers l'admin ; les ouvrir telles
quelles (nouvel onglet ou navigation), sans les recomposer :

| Champ | Page de l'admin | Réponse |
|---|---|---|
| `adhesion.renewUrl` | `/site/<lieu>/adhesion/<campagne>` | page |
| `adhesion.attestationUrl` | `/espace/<jeton>/attestation/<lieu>` | PDF |
| `adhesion.declineRenewalUrl` | `/espace/<jeton>/adhesion/<id>` | page |
| `billets[].ticketUrl` | `/billet/<jeton du billet>` | page avec QR code |
| `reservations[].manageUrl` | `/espace/<jeton>/reservation/<id>` | page |
| `recus[].pdfUrl` | `/espace/<jeton>/recu/<id>` | PDF |
| `factures[].url` | `/espace/<jeton>/facture/<id>` | page |

Les liens qui contiennent le jeton cessent de fonctionner quand il expire :
les reconstruire à chaque chargement à partir de la réponse, ne pas les
stocker.

## Exemple (site public)

```js
const r = await fetch(`${ADMIN}/api/espace/donnees`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (r.status === 401) { /* lien expiré ou invalide : proposer un nouveau lien */ }
else if (!r.ok) { /* erreur : le dire, sans conclure à l'absence de données */ }
else { const data = await r.json(); }
```
