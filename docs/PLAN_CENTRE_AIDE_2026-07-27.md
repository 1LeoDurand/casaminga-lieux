# Centre d'aide — état réel et mise en place

État du code et de la base de production au 27/07/2026.

---

## 1. Ce qui existe déjà

Le centre d'aide n'est pas à créer, il est à **remplir et à illustrer**.

| Élément | État |
|---|---|
| Routes `/aide`, `/aide/categorie/<slug>`, `/aide/<slug>` | en service |
| Catégories | 7 en base |
| Articles | **11 en base**, tous publiés |
| Repli en dur (`src/lib/help-content.ts`) | 9 articles, 7 catégories |
| Rendu Markdown maison (`help-md.ts`) | gras, code, liens, listes, citations |
| Mesure d'usage | `view_count`, `helpful_yes`, `helpful_no` |
| Indexation | autorisée (`/aide` est dans le passthrough du proxy) |

Le compteur « utile / pas utile » est déjà là : c'est ce qui dira quels articles
réécrire. Peu d'outils l'ont dès le départ.

### Le piège de la double source

`help-data.ts` bascule **en tout ou rien** : si `help_articles` contient au
moins une ligne, la base fait foi et le fichier en dur n'est plus jamais servi.
C'est le cas aujourd'hui (11 lignes).

Vérifié : aucun article n'est orphelin, les 9 slugs du code existent tous en
base. Mais **le fichier est déjà en retard de deux articles**, et quiconque
l'éditera de bonne foi ne verra aucun effet en production. À trancher :
soit le fichier redevient une simple graine d'amorçage clairement identifiée,
soit on l'abandonne.

---

## 2. Le rendu ne gère pas les images

`renderMarkdown` traite `**gras**`, `` `code` ``, `[lien](url)`, listes et
citations. **Pas d'images.** Un `![capture](url)` s'afficherait en texte, et le
`!` resterait visible devant un lien.

C'est donc la **première brique** : sans elle, produire des captures ne sert à
rien. À prévoir dans la foulée, parce qu'une capture non légendée est une
capture inutilisable :

- syntaxe image, avec texte alternatif obligatoire (accessibilité *et*
  référencement) ;
- légende sous l'image ;
- largeur maîtrisée et agrandissement au clic — une capture de 1440 px lue sur
  téléphone n'est pas lisible.

---

## 3. Le pipeline de captures : ce qui marche, et les pièges

Démontré le 27/07 sur le compte **Tiers-lieu Bernard Kohn**, avec
`playwright-cli` contre un `next start` local branché sur la base de production.
Trois pièges sont apparus immédiatement — aucun n'est deviné, tous ont été vus :

1. **Le bandeau cookies masque le contenu.** Il s'affiche sur toute première
   visite et se retrouve au milieu de la capture. Neutralisé en posant
   `localStorage.cookie_consent = "refused"` avant la navigation.
2. **Le thème local n'est pas le thème public.** `applyHostTheme` force le thème
   « Chaleureux » sur `casaminga.com`, mais laisse le thème choisi ailleurs. Une
   capture prise sur `localhost` montre donc un site que le visiteur ne verra
   jamais. Il faut capturer avec l'en-tête `Host` de production, ou assumer et
   documenter l'écart.
3. **Les vraies données contiennent de vraies informations sensibles.** Voir
   point 5 : c'est le piège le plus sérieux.

Cadrage retenu : 1440 × 900, format dans lequel les captures restent lisibles
une fois réduites dans un article.

---

## 4. Le tableau de bord : le vrai obstacle

Les pages publiques se capturent sans compte. **Le tableau de bord exige une
session, et je ne saisis pas d'identifiants.** C'est la contrainte structurante
de tout ce chantier, puisque 90 % de la documentation porte sur le tableau de
bord.

Trois voies, par ordre de simplicité :

| Voie | Comment | Limite |
|---|---|---|
| **(a) Navigateur déjà connecté** | piloter Chrome où la session de Léo est ouverte | capture des **vraies** données ; navigation seule, aucun clic sur un bouton d'action |
| **(b) Organisation de démo** | un jeu de données fabriqué, un accès réservé à la documentation | demande de créer et d'entretenir la démo — mais sert aussi aux démonstrations commerciales |
| **(c) Léo capture** | manuel | ne tient pas dans la durée : à chaque évolution d'écran, tout est à refaire |

**Je recommande (b)**, et (a) en attendant. L'organisation de démo est le seul
chemin qui permette d'automatiser, et elle règle le problème du point 5 : des
données inventées ne divulguent rien.

Il existe déjà une organisation `demo-tiers-lieu` et un indicateur `is_demo`
sur `organizations` — la moitié du travail est faite.

---

## 5. Ne jamais documenter avec de vraies données

La capture d'accueil de Bernard Kohn affiche, dans l'accroche du site :
**le RIB complet de l'association — IBAN et BIC**. C'est leur contenu, pas un
défaut du logiciel. Mais cela règle la question du jeu de données :

- une capture d'illustration se diffuse, s'indexe, se retrouve dans un PDF
  commercial ; ce qui y figure est publié pour de bon ;
- les captures montrent des noms, des adresses, des montants, des courriels de
  personnes réelles, qui n'ont jamais consenti à illustrer notre documentation.

**Règle : la documentation se fait sur l'organisation de démo, jamais sur un
compte client.** Les trois captures du jour servent à valider le pipeline, pas à
être publiées.

---

## 6. Le problème qui décide de l'architecture : la péremption

Une documentation aux captures périmées est **pire que pas de documentation** :
elle fait douter de tout le reste, y compris de ce qui est juste.

C'est pour cela que les captures ne doivent pas être des fichiers déposés à la
main, mais un **produit du dépôt** :

- un script énumère les écrans à capturer (`docs/captures.config.ts` : chemin,
  nom, viewport, préparation éventuelle) ;
- il tourne sur l'organisation de démo et écrit dans `public/aide/captures/` ;
- les images sont versionnées, donc une modification d'écran se voit **dans la
  revue de code** : un `git diff` sur une image signale que la capture a bougé ;
- l'article référence un nom stable, jamais une URL fabriquée à la main.

C'est le même raisonnement que pour le reste : ce qui n'est pas régénérable
dérive.

---

## 7. Structure éditoriale

Calquée sur le cycle réel d'une association, pas sur nos menus — un utilisateur
cherche « comment faire ma newsletter », pas « module Communication ».

1. **Démarrer** — créer son compte, son lieu, publier son site
2. **Communiquer** — site public, newsletter, abonnés, supports
3. **Faire vivre le lieu** — événements, billetterie, espaces, réservations
4. **Gérer les membres** — adhésions, relances, reçus
5. **Financer** — subventions, dons, facturation
6. **Obligations** — RGPD, mentions légales, AG, documents obligatoires

La catégorie 6 n'existe nulle part aujourd'hui et c'est celle qui rassure le
plus un bureau d'association. Elle a de quoi être écrite immédiatement : la
désinscription en un clic, la preuve de consentement et les mentions légales
générées ont toutes été livrées cette semaine.

### Forme d'un article

Une tâche par article, titrée par l'intention (« Envoyer votre première
newsletter »), avec : à quoi ça sert, les étapes numérotées avec une capture par
étape décisive, les pièges, et les articles liés. Pas d'article fourre-tout.

---

## 8. Ordre de mise en place

1. **Les images dans le rendu** — sans ça, rien d'autre n'a d'effet.
2. **L'organisation de démo documentaire** — données fabriquées, crédibles,
   sans aucune donnée personnelle réelle.
3. **Le script de captures** versionné, avec les trois pièges du point 3 déjà
   traités.
4. **Six articles illustrés** sur les parcours les plus fréquents, plutôt que
   trente articles nus.
5. **Lire les compteurs** `helpful_no` au bout d'un mois : ils diront quoi
   réécrire, mieux que n'importe quelle intuition.
6. **Un lien contextuel** depuis chaque écran vers l'article correspondant
   (le bouton « Aide » existe déjà en bas à droite).

---

## 9. À trancher

- **Quel jeu de données de démo ?** Un tiers-lieu crédible avec 30 membres, 5
  événements, 2 espaces, quelques factures. C'est un travail d'écriture autant
  que de code.
- **Le fichier `help-content.ts` reste-t-il ?** Double source aujourd'hui sans
  dommage, mais elle dérivera.
- **Documentation publique ou réservée aux comptes ?** Publique, elle sert le
  référencement et la vente. C'est déjà le choix fait dans `robots.ts`.
