# Recette finale — checklist Léo (~20 min, sur tes vraies données)

> L'agent ne saisit jamais de mot de passe : cette passe authentifiée est la
> seule chose qu'il ne peut pas vérifier à ta place. Coche au fil de l'eau ;
> note tout ce qui cloche dans le widget feedback (bouton en bas à droite).

## 1. Connexion & navigation (2 min)
- [ ] Login → tu atterris sur le dashboard de TON org (pas un slug en dur)
- [ ] La sidebar n'affiche plus : Partenaires, Médiathèque, encart « Passer à l'Asso complète »
- [ ] `/dashboard/<ton-org>/upgrade` redirige vers le dashboard

## 2. Reçus fiscaux — le point légal (5 min)
- [ ] Paramètres → Facturation : nouvelle section **Reçus fiscaux (dons)** :
      qualité, signataire, référence rescrit, case « déclaration sur l'honneur »
- [ ] Page Reçus fiscaux SANS la case cochée → bandeau rouge ⛔ « Éligibilité non confirmée »
- [ ] Coche la case dans Paramètres + Enregistrer → le bandeau rouge disparaît
- [ ] Émets un reçu de test de **81 €** lié à une fiche membre avec email →
      le PDF affiche « quatre-vingt-un euros » en toutes lettres
- [ ] Bouton « Envoyer » sur la ligne du reçu → email reçu avec le PDF joint
- [ ] L'encart vert « Déclaration annuelle 2026 » affiche total + nombre de reçus

## 3. Espace adhérent (3 min)
- [ ] `/espace` → saisis l'email du membre de test → email reçu avec le lien
- [ ] Le portail montre : adhésion, billets à venir, **et le reçu fiscal de test**
- [ ] Le PDF du reçu se télécharge depuis le portail
- [ ] Modifie l'id du reçu dans l'URL → 403/404 (pas le reçu d'un autre)

## 4. Facturation & caisse (5 min)
- [ ] Créer une facture → le numéro suit la séquence (pas de trou)
- [ ] Caisse : nouvelle écriture avec un client lié (person picker) → ticket PDF OK
- [ ] Bouton « Créer une facture » depuis une écriture → brouillon pré-rempli
- [ ] Clôture (X ou Z) → PDF de clôture avec totaux TVA

## 5. Parcours public (3 min)
- [ ] Ton site public s'affiche, lien « Mon espace » présent dans la nav
- [ ] Inscription à un événement de test → billet reçu par email → `/billet/<token>` OK
- [ ] Tunnel adhésion → candidature visible dans le dashboard

## 6. Actions infra (2 min, dashboard Supabase)
- [ ] Auth → Settings → activer **Leaked password protection** (1 clic)
- [ ] Infomaniak : env var `PORTAL_LINK_SECRET` (openssl rand -base64 32) si pas fait

## En cas de pépin
Chaque vague du sprint = 1 commit (`git log --oneline -6`) : on peut reverter
finement. Les migrations DB sont dans l'historique Supabase.
