# PROGRESS — Sprint finition (10 juin 2026)

> Audit → backlog → arbitrage Léo → exécution par vagues. 1 commit / vague.

| Vague | Contenu | Commit | État |
|---|---|---|---|
| 1 — Sécurité | Garde `org_assert_member` sur la numérotation, revoke anon/PUBLIC (fonctions + triggers), RLS `cron_log`, search_path, listing buckets fermé, XSS `file_url` | `07aab26` | ✅ |
| 2 — Conformité fiscale | Éligibilité art. 200 CGI (déclaration sur l'honneur + rescrit), bandeau bloquant, encart déclaration annuelle (loi 24/08/2021), champs qualité/signataire enfin exposés | `61caac5` | ✅ |
| 3 — Périmètre | CUT Communauté + Partenaires + Médiathèque (redirects, code en git), Upgrade masqué (Stripe reporté) | `f713f4e` | ✅ |
| 4 — Hygiène | `supabase/SCHEMA.md` (66 tables versionnées), bugs.md purgé (3 obsolètes), ROADMAP corrigée | `abb69b4` | ✅ |
| 5 — Caisse | **Découverte : #50-54 déjà construits** (raccourcis, rapport Z PDF, ticket PDF, person picker, facture auto) — rien à coder | — | ✅ |
| 6 — Recette | `RECETTE.md` : checklist 20 min pour Léo (seule la passe authentifiée échappe à l'agent) | ce commit | 🔶 attend Léo |

## Découvertes en route
- bugs.md : AUTH-001 = faux positif (Next 16 → `proxy.ts` officiel), AUTH-002/003 déjà corrigés.
- Persistance cookies : fausse alerte (localStorage OK).
- `assign_invoice_number`/`assign_receipt_number` étaient appelables par un
  anonyme **sans garde** → corrigé Vague 1 (enjeu continuité de numérotation).
- Formulaire Paramètres → Facturation n'exposait pas qualité/signataire Cerfa → ajouté Vague 2.
- Migrations locales (4) vs ~80 réelles → snapshot SCHEMA.md ; dump exécutable = `supabase db pull` (action Léo).

## Reste à faire (hors sprint)
- Recette authentifiée par Léo (RECETTE.md) + corrections issues de la recette
- Actions infra Léo : leaked password protection (1 clic), `PORTAL_LINK_SECRET` Infomaniak
- Reportés : Stripe (Lots 10.1*), Lot 5 billetterie avancée, Lot 8 AG, Lot 9 signature, Lot 12 subventions P4
