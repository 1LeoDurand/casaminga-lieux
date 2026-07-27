# Module Subventions — audit

Mesures faites sur la base de production le 27/07/2026, 1 261 aides importées.

---

## 1. Qualification des aides : les chiffres

| Champ | Renseigné | Verdict |
|---|---|---|
| Lien vers l'appel | 1 259 / 1 261 (99,8 %) | bon |
| Contact du financeur | 1 156 (92 %) | bon |
| Critères d'éligibilité | 931 (74 %) | correct |
| Exemples de projets | 402 (32 %) | passable |
| **Échéance** | **338 (27 %)** | **bloquant** |
| **Montant** | **1 (0,08 %)** | **bloquant** |
| **Pièces requises** | **0 (0 %)** | **bloquant** |
| Étapes du projet | 0 (0 %) | absent |

### Les trois derniers ne sont pas des trous de données, ce sont des choix de code

Dans `src/lib/grants/aides-territoires.ts` :

```
amount_min: null,
amount_max: null,
required_documents: [],
```

Ces trois champs sont **écrits en dur à vide** par le mapping d'import. D'où
« Montant variable » sur 1 260 aides sur 1 261, et « Aucune pièce spécifique
renseignée » sur la totalité d'entre elles.

Pour le montant, la raison de fond est réelle : Aides-Territoires met les
montants en **texte libre** dans `subvention_comment`, et `subvention_rate_min/max`
sont des **pourcentages**, pas des euros. Le texte est bien récupéré et affiché
dans la description — il n'est simplement jamais transformé en nombre
comparable, donc ni triable ni filtrable.

`aid_steps` est correctement mappé (`names(aid.aid_steps)`) mais ressort vide :
l'endpoint de liste ne le renvoie probablement pas, contrairement à l'endpoint
de détail. **À vérifier** avant d'en conclure quoi que ce soit.

### Conséquence

Un chargé de subvention trie sur trois critères : **combien**, **pour quand**,
**quoi fournir**. Ce sont exactement les trois que nous ne savons pas afficher.

---

## 2. L'assistant IA n'est pas cassé, il n'est pas configuré

`pickProvider()` (`src/lib/grants/ai-draft.ts`) renvoie `null` quand ni
`GEMINI_API_KEY` ni `ANTHROPIC_API_KEY` ne sont définies — d'où le message
« Assistant IA non configuré (clé API manquante) », qui est exact.

**À faire** : ajouter `GEMINI_API_KEY` dans les variables d'environnement du
manager Infomaniak, puis Redémarrer. Gemini 2.5 Flash a un palier gratuit et
c'est le fournisseur choisi par défaut. Aucun code à modifier.

Deux points à vérifier au passage :

- le repli Claude cible `claude-opus-4-8`, une génération antérieure à Opus 5 ;
- `AI_DRAFT_PROVIDER` permet de forcer un fournisseur (`gemini`, `claude`, `auto`).

---

## 3. Le brouillon n'est enregistré nulle part

`grant_applications` contient : `status`, `notes`, `amount_requested`,
`applied_at`, `result_at`, `linked_grant_id`. **Aucun champ ne stocke le texte
produit.**

Le brouillon est donc généré, affiché… et perdu au rechargement de la page.
C'est le manque le plus grave du module : on propose de rédiger un dossier dans
un outil qui ne garde pas ce qu'il rédige.

---

## 4. Ce qui manque au métier, pas au produit

Le module est construit autour de **chercher**. Le métier, lui, est construit
autour de **tenir des échéances** et **produire des dossiers**.

Manquent aujourd'hui :

- un tri et une alerte par échéance — impossible tant que 73 % des aides n'en
  ont pas ;
- une vue calendrier / rétroplanning (un dossier se prépare sur 4 à 8 semaines) ;
- un budget prévisionnel par dossier (`amount_requested` existe, seul) ;
- plus d'un champ de notes ;
- le passage au bilan après obtention — la liaison existe pourtant déjà
  (`linked_grant_id` vers `grants`, qui porte `reporting_due_date`).

---

## 5. Faut-il un brouillon si le dépôt se fait en ligne ?

Oui — et le formulaire montré le prouve : **162 minutes de remplissage estimées**.
Personne ne rédige directement dans un formulaire administratif : on prépare à
côté, on fait relire, on colle. Le brouillon est donc le bon objet.

Mais pas sous sa forme actuelle. Trois changements le rendraient utile :

1. **L'enregistrer et le versionner.** Cf. point 3.
2. **Le découper selon les champs réels du formulaire**, pas selon trois
   sections génériques — avec un bouton « copier » par bloc et un compteur de
   caractères, puisque ces formulaires imposent presque toujours des limites.
3. **Une bibliothèque de réponses réutilisables.** C'est le point le plus
   important : un chargé de subvention réécrit dix fois par an la même
   présentation de structure, la même gouvernance, le même ancrage territorial.
   **La valeur n'est pas de générer du texte, c'est de ne pas réécrire ce qui a
   déjà été validé.** L'IA devrait *adapter* un paragraphe existant au
   dispositif visé, pas repartir de zéro à chaque fois.

À ajouter : un export du dossier complet (PDF ou DOCX). Beaucoup de financeurs
demandent encore un envoi par courriel ou un CERFA 12156, pas un formulaire.

---

## 6. Dans quel ordre

1. **Configurer la clé IA** — cinq minutes, débloque une fonctionnalité déjà écrite.
2. **Enregistrer les brouillons** — sans ça, le reste ne sert à rien.
3. **Extraire le montant** de `subvention_comment` (fourchette + « variable » si
   illisible) et afficher franchement « non précisé » au lieu de « variable »
   quand on ne sait pas. Dire qu'on ne sait pas vaut mieux que laisser croire
   qu'on a vérifié.
4. **Vérifier `required_documents` et `aid_steps`** : mapping à compléter, ou
   appel à l'endpoint de détail. Tant que c'est vide, retirer l'encart plutôt
   que d'afficher « aucune pièce » sur toutes les aides.
5. **Trier par échéance** et alerter à J-30 sur les dossiers suivis.
6. **Bibliothèque de réponses réutilisables.**
