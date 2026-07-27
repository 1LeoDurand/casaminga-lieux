# Communication — audit du site public et modèle idéal

Document de tri. Coche ce que tu veux, raye le reste.
État du code au 26/07/2026.

---

# Partie 1 — Audit du site public

## Ce qui existe vraiment

Sept routes publiques : accueil, à propos, agenda (+ détail événement), espaces,
soutenir, adhésion. **L'objectif « au moins cinq pages » est donc déjà atteint en
nombre.** Le problème n'est pas le nombre de pages, c'est ce qu'on peut y mettre.

Onze thèmes visuels, une couleur d'accent, un hero, une galerie de neuf photos,
quatre sections activables, quatre pages activables. `robots.ts` et `sitemap.ts`
existent, chaque page a son `generateMetadata`.

C'est un socle sérieux. Les manques ci-dessous sont classés par gravité.

## A1 — Les sites des lieux ne sont dans aucun sitemap ⚠️

`src/app/sitemap.ts` ne liste que les pages de Casa Minga (accueil, approche,
histoire, CGU…). **Aucun `/site/<slug>` n'y figure**, alors que `robots.ts` les
autorise explicitement à l'indexation et que le commentaire du fichier dit les
assumer comme URL indexables.

Conséquence : un lieu publie son site, et Google n'en est jamais informé. Le
bénéfice le plus attendu d'un site vitrine — être trouvé quand on cherche le nom
du lieu — ne se produit pas.

Correctif : sitemap dynamique listant les sites publiés et leurs pages actives.
Une demi-journée, effet immédiat et durable.

- [ ] **A1 — Sitemap dynamique des sites publiés**

## A2 — Aucune page légale propre à l'association ⚠️

`mentions-legales`, `confidentialite`, `cgu`, `cgv` existent — mais sous
`src/app/(admin)/`, ce sont celles de **Casa Minga éditeur**. Un site de lieu n'a
ni mentions légales, ni politique de confidentialité.

Or chaque site publie un formulaire de contact, et depuis cette semaine la
newsletter dépose un pixel de suivi. Les mentions légales sont obligatoires pour
tout site d'une personne morale, et la politique de confidentialité l'est dès
qu'on collecte une donnée. **Nous mettons aujourd'hui nos clients en défaut sans
qu'ils le sachent.**

Correctif : deux pages générées à partir de ce que nous connaissons déjà (nom,
adresse, SIRET, président·e, hébergeur = nous), avec les zones manquantes
signalées à l'association plutôt que laissées vides.

- [ ] **A2 — Mentions légales + politique de confidentialité générées**

## A3 — Les pages sont des interrupteurs, pas du contenu

Sur cinq pages, deux seulement ont un texte éditable (`about_text`,
`soutenir_text`). Agenda et Espaces affichent des données, sans un mot
d'introduction possible. Impossible de créer **une page libre** : pas de page
« Nos actions », « L'équipe », « Partenaires », « Nous rejoindre », « Contact »
dédiée, aucun article d'actualité.

C'est la vraie limite du site : on choisit son apparence bien plus finement que
son contenu. Onze thèmes pour deux champs de texte, le rapport est inversé.

**Le moteur de blocs existe déjà** — celui de la newsletter (texte, titre, image,
bouton, séparateur, événements, adhésion, espaces) dans `src/lib/newsletter/`.
Le réemployer pour composer des pages libres est le chantier le plus rentable du
lot : une association compose sa page comme elle compose sa newsletter, et nous
n'entretenons qu'un seul éditeur.

- [ ] **A3 — Pages libres composées avec le moteur de blocs**

## A4 — On édite à l'aveugle

Le bouton « Aperçu » ouvre le site publié dans un onglet : il montre l'état
enregistré, pas ce qu'on est en train de modifier. Il faut enregistrer pour voir.
Sur un site publié, cela veut dire publier pour voir.

- [ ] **A4 — Aperçu en direct dans l'éditeur (et « voir le brouillon »)**

## A5 — Pas d'image de partage

Aucun `opengraph-image` pour les sites de lieux. Un lien partagé sur WhatsApp,
Facebook ou dans un message apparaît sans vignette — c'est le partage le plus
fréquent, et le moins soigné.

Next sait générer ces images à la volée (`ImageResponse`). La même brique servira
aux affiches (partie 3) : c'est le même moteur.

- [ ] **A5 — Images de partage générées (site + événement)**

## A6 — Manques de second rang

- [ ] Pas de favicon par lieu
- [ ] Pas de coordonnées structurées (adresse, horaires, téléphone) ni de balisage
      `schema.org` — c'est ce qui alimente la fiche Google et Maps
- [x] ~~Pas de bandeau cookies~~ — **faux, corrigé le 26/07.** `CookieBanner` et
      `GoogleAnalytics` sont montés dans le **layout racine** : ils s'appliquent
      donc aussi aux sites des lieux. L'implémentation est correcte (GA ne se
      charge qu'après acceptation explicite, IP anonymisée, bouton Refuser),
      mais **c'est la mesure d'audience de Casa Minga qui tourne sur le site de
      nos clients**, et leur politique de confidentialité doit le dire — c'est
      désormais le cas. Question ouverte : est-il légitime de mesurer l'audience
      des sites clients sous notre propre compte GA, ou faut-il la leur
      restituer (voir 7.5) ?
- [ ] Pas de page « Contact » dédiée (uniquement une section d'accueil)
- [ ] Accessibilité jamais auditée sur les onze thèmes (contrastes surtout)
- [ ] Le commentaire de `robots.ts` dit `casaminga.com` « hors service » alors que
      le domaine a été livré — **à vérifier**, l'URL canonique en dépend

## A7 — Rendre la personnalisation simple sans la rendre pauvre

Ta demande : personnaliser « sans que ça soit compliqué ». Trois principes que je
recommande de tenir, dans cet ordre :

1. **Partir d'un site déjà rempli, pas d'une page blanche.** À la création,
   pré-remplir avec les données du lieu et un texte d'exemple explicitement
   marqué comme tel. Une page blanche fait abandonner ; un texte à corriger fait
   avancer.
2. **Deux niveaux d'édition assumés.** Un mode simple (titre, photo, texte,
   couleur) qui couvre 90 % des besoins, et un mode blocs pour qui veut composer.
   Pas un seul éditeur qui essaie de servir les deux.
3. **Rien qui puisse casser le site.** C'est déjà le parti pris des thèmes et il
   est bon : le contenu ne dépend pas de la mise en forme. À conserver — surtout
   ne pas offrir de CSS libre.

---

# Partie 2 — Ce qu'une association produit dans l'année

Avant de lister des fonctionnalités, voici le cycle réel. C'est lui qui doit
dicter le logiciel, pas l'inverse.

## Septembre — la rentrée

Forum des associations, relance des adhésions. Il faut : une **affiche de
rentrée**, des **flyers** à distribuer, un **kakémono**, des **cartes de visite**,
un **bulletin d'adhésion**, et la mise à jour du site.

C'est le pic de production graphique de l'année, concentré sur trois semaines.

## Toute l'année — les événements

Pour chaque événement : affiche A3, flyer A5, post carré réseaux, story verticale,
événement Facebook, envoi newsletter, parfois communiqué de presse locale et
annonce radio. Puis, après : photos, remerciements, bilan.

**Un même événement se décline en six à huit supports.** Toutes les informations
sont déjà dans la fiche événement du logiciel.

## Janvier–mars — l'assemblée générale

Convocation (délai statutaire), ordre du jour, pouvoir/procuration, rapport moral,
rapport d'activité, rapport financier, feuille d'émargement, procès-verbal.
Ensuite : déclarations en préfecture si le bureau change.

Ce sont des documents **obligatoires et normés**, pénibles à produire, que
personne ne fait avec plaisir. C'est là qu'un logiciel soulage vraiment.

## Toute l'année — les financements

Dossier de subvention (CERFA 12156), compte-rendu financier (CERFA 15059),
budget prévisionnel, rapport d'activité, dossier de partenariat pour les mécènes.
Reçus fiscaux de dons (CERFA 11580) — avec la réduction d'impôt de 66 %.

Le module Subventions couvre déjà une partie de ce terrain.

## Décembre — la fin d'année

Vœux, bilan de l'année, **appel aux dons avant le 31/12** (c'est la date qui
déclenche la défiscalisation, donc le meilleur moment de l'année pour demander).

## En continu

Adhésions (bulletin, carte de membre, reçu, attestation), bénévoles (appel,
convention, attestation, planning), réseaux sociaux, presse locale.

---

# Partie 3 — Modèle idéal des fonctionnalités de communication

## Le principe directeur

**Ne pas construire un Canva médiocre.** Un tiers-lieu a déjà Canva, gratuit et
meilleur que ce que nous ferons.

Ce que Canva ne peut pas faire, et nous si : produire l'affiche **avec les bonnes
données** — date, heure, tarif, adresse, QR code de réservation — sans ressaisie,
et la décliner en six formats d'un coup. La valeur n'est pas dans l'éditeur
graphique, elle est dans le fait que **l'information est déjà chez nous et qu'elle
est juste**.

Le jour où quelqu'un corrige l'heure de l'événement, tous ses supports suivent.
Ça, aucun outil graphique ne sait le faire.

Corollaire : privilégier systématiquement **la génération à partir d'une fiche
existante** plutôt que la création libre.

## Famille 1 — Identité du lieu

- [ ] **1.1 Charte** : logo, deux couleurs, une typo, stockés une fois et
      réutilisés partout (site, newsletter, affiches, documents)
- [ ] **1.2 Carte de visite** générée (recto/verso, PDF prêt à imprimer)
- [ ] **1.3 Signature email** HTML à copier dans Gmail/Outlook
- [ ] **1.4 Papier à en-tête** pour les courriers officiels
- [ ] **1.5 Plaquette de présentation** (2 ou 4 pages) générée depuis le site

## Famille 2 — Supports d'événement *(le cœur, à mon avis)*

- [ ] **2.1 Affiche A3/A4** générée depuis la fiche événement
- [ ] **2.2 Flyer A5/A6**, plusieurs par page pour l'impression maison
- [ ] **2.3 Post carré 1:1** réseaux sociaux
- [ ] **2.4 Story verticale 9:16**
- [ ] **2.5 Bannière** de couverture Facebook/LinkedIn
- [ ] **2.6 QR code de billetterie** intégré aux supports *(le module existe déjà)*
- [ ] **2.7 Déclinaison en un clic** : un événement → tous les formats d'un coup
- [ ] **2.8 Programme de saison** : plusieurs événements sur un seul document

## Famille 3 — Réseaux sociaux

- [ ] **3.1 Modèles de posts** par type (annonce, rappel, remerciement, recrutement)
- [ ] **3.2 Rédaction assistée** du texte de post depuis la fiche événement
- [ ] **3.3 Calendrier éditorial** — quoi publier, quand
- [ ] **3.4 Rappels automatiques** : « ton événement est dans 10 jours, rien n'a
      été publié »
- [ ] **3.5 Publication directe** (Facebook/Instagram) — *coûteux : validation
      Meta, jetons à renouveler, API instable. Je le déconseille en première
      intention.*

## Famille 4 — Presse et institutions

- [ ] **4.1 Communiqué de presse** généré (format normé, contact, visuel)
- [ ] **4.2 Carnet de contacts presse** locaux
- [ ] **4.3 Dossier de partenariat / mécénat** avec contreparties
- [ ] **4.4 Dossier de presse** annuel

## Famille 5 — Documents de vie associative

- [ ] **5.1 Convocation à l'AG** + feuille d'émargement + pouvoirs
- [ ] **5.2 Procès-verbal d'AG** à partir de l'ordre du jour et des votes
- [ ] **5.3 Rapport d'activité annuel** nourri par les données de l'année
      (événements tenus, adhérents, heures de bénévolat, fréquentation)
- [ ] **5.4 Carte de membre** avec QR code
- [ ] **5.5 Reçu fiscal de don** (CERFA 11580) — *attention : document fiscal,
      erreur = responsabilité de l'association*
- [ ] **5.6 Attestation de bénévolat**

**5.3 mérite un regard particulier** : le rapport d'activité est le document le
plus pénible de l'année, et nous détenons déjà presque toutes ses données. C'est
peut-être le meilleur rapport valeur/effort de toute cette liste.

## Famille 6 — Assistance par IA

**Tu l'as déjà** : `src/lib/grants/ai-draft.ts` utilise **Gemini 2.5 Flash** par
défaut, avec repli sur Claude, piloté par `AI_DRAFT_PROVIDER`. Il ne sert
aujourd'hui **qu'aux brouillons de dossiers de subvention**. La brique est
là, elle n'est branchée qu'à un seul endroit.

*(Note : le repli Claude cible `claude-opus-4-8`, une génération antérieure à
Opus 5. À vérifier au passage — je n'ai pas contrôlé si la clé est configurée.)*

- [ ] **6.1 Rédaction assistée** : texte d'événement, post, newsletter, page du site
- [ ] **6.2 Réécriture** : raccourcir, changer de ton, corriger
- [ ] **6.3 Objet de newsletter** : trois propositions à partir du contenu
- [ ] **6.4 Texte alternatif** des images — accessibilité et référencement
- [ ] **6.5 Génération d'images** — *je le déconseille pour l'instant : coût par
      image, rendu daté, et une association a besoin de SES photos, pas
      d'illustrations génériques.*

**Garde-fou à tenir sur toute la famille 6** : l'IA propose, elle ne publie
jamais. Aucun texte ne doit partir sans qu'un humain l'ait vu — c'est déjà la
règle qu'on s'est donnée pour les emails de relance et les vérités comptables.

## Famille 7 — Diffusion et mesure

- [ ] **7.1 Page « Actualités »** sur le site (articles courts)
- [ ] **7.2 Flux RSS** — repris par les agendas culturels locaux
- [ ] **7.3 Export vers les agendas locaux** (Open Agenda, offices de tourisme)
- [ ] **7.4 Widget agenda** à coller sur un site tiers *(`/embed` existe déjà)*
- [ ] **7.5 Statistiques de fréquentation** du site vitrine
- [ ] **7.6 Affichage écran** pour le hall du lieu (programme en boucle)

---

# Partie 4 — Comment produire les visuels, techniquement

Une seule recommandation : **`ImageResponse` de Next.js** (le moteur derrière les
images Open Graph). Il transforme du JSX + CSS en PNG, sans navigateur headless.

Pourquoi c'est le bon choix ici :

- déjà présent dans Next, aucune dépendance lourde à héberger chez Infomaniak ;
- les gabarits sont du code versionné, donc relisibles et corrigeables ;
- **un même gabarit produit tous les formats** en changeant les dimensions ;
- il sert aussi les images de partage du site (A5), donc une brique pour deux
  besoins.

Ses limites, à connaître avant de s'engager : sous-ensemble de CSS seulement (ni
grille complexe, ni filtres), polices à embarquer, et sortie **RVB** — parfait
pour l'écran et l'impression courante, insuffisant pour un imprimeur exigeant du
CMJN. Pour du A3 professionnel, il faudra un PDF, et c'est un autre chantier.

Je proposerais donc : PNG haute définition + PDF simple pour l'impression maison,
et on ne promet pas le CMJN.

---

# Partie 5 — Ce que je ferais, dans l'ordre

Si tu ne devais en retenir que cinq, ce serait ceux-là.

1. **A1 — Sitemap dynamique.** Une demi-journée. Sans lui, les sites que tu
   vends n'existent pas pour Google.
2. **A2 — Pages légales des associations.** Rapide, et ça nous sort d'une
   situation où nos clients sont en défaut sans le savoir. D'autant plus depuis
   que la newsletter trace les ouvertures.
3. **2.1 + 2.7 — Affiche et déclinaison multi-formats depuis un événement.**
   C'est le différenciateur le plus net face à Canva, et le besoin le plus
   fréquent de l'année.
4. **A3 — Pages libres avec le moteur de blocs de la newsletter.** Le chantier
   le plus structurant : il débloque toutes les pages manquantes d'un coup, et
   mutualise un éditeur au lieu d'en entretenir deux.
5. **5.3 — Rapport d'activité annuel.** Le document le plus pénible, et nous
   avons déjà les données.

Ce que je laisserais de côté pour l'instant : la publication automatique sur les
réseaux sociaux (3.5) et la génération d'images par IA (6.5). Beaucoup d'efforts,
beaucoup de fragilité, peu de valeur propre.

---

## Question ouverte, à trancher avant de commencer la famille 2

Une affiche, ça se retouche. Si on génère un PNG figé, la première demande sera
« je voudrais déplacer le titre ». Trois réponses possibles, très différentes en
coût :

- **(a)** Gabarits fixes, aucun réglage. Simple, rapide, et parfois frustrant.
- **(b)** Gabarits avec quelques réglages (photo, couleur, position du bloc
  texte, avec/sans QR code). Le bon compromis à mon sens.
- **(c)** Éditeur libre façon Canva. Très coûteux, et nous perdrions la
  comparaison.

Je recommande **(b)**, en démarrant par deux ou trois gabarits vraiment soignés
plutôt que dix médiocres.
