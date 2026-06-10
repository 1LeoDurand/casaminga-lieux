# Schéma de production — snapshot du 10 juin 2026

> ⚠️ Les 4 fichiers de `supabase/migrations/` ne représentent **pas** l'état réel :
> ~80 migrations ont été appliquées directement via MCP (historique ci-dessous,
> traçé dans `supabase_migrations.schema_migrations` côté serveur).
> Ce fichier est un **snapshot documentaire** (tables + colonnes, `*` = NOT NULL).
> Pour un dump exécutable : `npx supabase db pull` (nécessite le mot de passe DB —
> action Léo), ou Dashboard → Database → Backups.

## Tables (66)

### Socle & organisation
- **organizations** : id*, slug*, name*, structure, siret, address, email, phone, website, description, hours, plan*, primary_color*, helloasso_client_id/secret/org_slug/connected_at, org_type, is_demo*, demo_archetype, onboarding_j3/j7_sent_at, stripe_account_id/connected_at/charges_enabled*, created_at*, updated_at*
- **organization_members** : organization_id*, user_id*, role* (enum), zones*, status*, last_seen_at, perm_pilotage/gestion_lieu/structure/publication/systeme*, created_at*
- **organization_modules** : organization_id*, module_key*, enabled*, activated_at, activated_by
- **profiles** : id*, email, full_name, role*, zones*, created_at*, updated_at*
- **super_admins** : user_id*, email*, created_at
- **establishments** : id*, organization_id*, name*, slug*, city, address, siret, description, is_primary*, active*, position*, public_site_status*, portal_status*, created_at*
- **subscriptions** : id*, organization_id*, tier*, status*, comped*, founding_member*, trial_ends_at, current_period_end, stripe_subscription_id/customer_id, notes, created_at*, updated_at*
- **invitations** : id*, organization_id*, email*, role*, token*, expires_at*, used_at, created_at
- **workspace** : id*, data* (jsonb), updated_at*, updated_by

### CRM & communauté
- **persons** : id*, organization_id*, name*, email, phone, role*, status*, tags*, notes, newsletter_opt_out*, unsubscribe_token*, establishment_id, anonymized_at, anonymized_by, created_at*, updated_at*
- **member_groups** : id*, organization_id*, name*, color*, description, created_at*
- **member_group_links** : group_id*, person_id*
- **community_posts** : id*, organization_id*, author_id, type*, title*, content*, status*, establishment_id, created_at*, updated_at* _(module coupé 10/06/2026)_
- **partners** : id*, organization_id*, contact_id, name*, type*, status*, email, phone, website, notes, created_at*, updated_at* _(module coupé 10/06/2026)_
- **requests** : id*, organization_id*, name, email, phone, organization_ext, type, status*, priority*, summary, message, assignee_id, received_at*, created_at*

### Adhésions
- **membership_campaigns** : id*, organization_id*, title*, slug*, description, status*, period_type*, period_start/end, max_members, allow_donation*, donation_amounts*, show_member_count*, show_collected*, generate_cards*, photos*, establishment_id, created_at*, updated_at*
- **membership_tiers** : id*, campaign_id*, organization_id*, name*, description, amount*, sort_order*, created_at*, updated_at
- **membership_applications** : id*, campaign_id*, tier_id, organization_id*, first_name*, last_name*, email, phone, payer_name/email, amount_paid*, donation_amount, status*, membership_start/end, notes, payment_method, payment_ref, created_at*, updated_at*

### Événements & billetterie
- **evenements** : id*, organization_id*, title*, description, type*, status*, space_id, start_at*, end_at*, capacity, price, photos*, show_on_public_site*, establishment_id, portal_status*, created_at*, updated_at*
- **event_registrations** : id*, event_id*, organization_id*, email*, status*, ticket_token, person_id, full_name, phone, seats*, payment_status*, amount_ttc*, checked_in_at, source*, notes, created_at*
- **event_tickets** : id*, organization_id*, event_id*, registration_id, holder_name*, ticket_token*, checked_in_at, created_at*
- **event_scan_links** : id*, organization_id*, event_id*, token*, label, revoked*, expires_at, created_at*

### Espaces & résidences
- **spaces** : id*, organization_id*, name*, type*, capacity, area, price_hour/day, description, photos*, status*, establishment_id, created_at*, updated_at*
- **reservations** : id*, organization_id*, space_id*, person_id, title, start_at*, end_at*, status*, price, notes, establishment_id, payment_status*, stripe_session_id, amount_paid, paid_at, created_at*, updated_at*
- **residences** : id*, organization_id*, space_id, person_id, artist_id, title*, discipline*, status*, start_date/end_date, description, notes, budget, logement_fourni/notes, convention_signee/date, restitution_date/status, projet_description, created_at*, updated_at*
- **artists** : id*, organization_id*, name*, discipline*, bio, portfolio_url, website, email, phone, origin_city, nationality, instagram, tags*, photo_url, status*, created_at, updated_at
- **artist_milestones** : id*, residence_id*, title*, description, due_date, done_at, status*, created_at

### Finances
- **transactions** : id*, organization_id*, person_id, type*, category*, amount*, date*, label*, status*, notes, cash_closure_id, created_at*, updated_at*
- **invoices** : id*, organization_id*, number, reference, object, status*, client_id/name*/email/address, issue_date, due_date, lines* (jsonb), vat_applicable*, total_ht/vat/ttc*, notes, source*, kind*, parent_invoice_id, subscription_id, pole, pole_id, payment_method, paid_at, validation_status/by/at, created_at*, updated_at*
- **invoice_sequences** : organization_id*, last_number*
- **invoice_settings** : organization_id*, issuer_name/address, siret, vat_number, email, phone, iban, bic, payment_terms_days*, late_penalty, accent_color*, footer_mentions, number_prefix*, number_start*, logo_url, require_validation_above, tax_receipt_quality/signatory, **tax_receipt_eligible***, **tax_receipt_rescrit_ref**, updated_at*
- **coworking_subscriptions** : id*, organization_id*, person_id, client_name*/email/address, space_id, designation, monthly_amount_ht*, vat_rate*, vat_applicable*, day_of_month*, active*, start/end_date, last_invoiced_month, created_at*, updated_at*
- **expenses** : id*, organization_id*, label*, amount_ttc*, vat_applicable*, vat_amount, category, supplier_name, supplier_person_id, pole_id, payment_method, paid_at, receipt_url, notes, spent_at*, validation_status/by/at, created_at*
- **tax_receipts** : id*, organization_id*, number, donor_person_id, donor_name*, donor_address, amount*, donation_date*, donation_type*, fiscal_year*, transaction_id, pdf_url, created_at*

### Caisse certifiée (NF525)
- **cash_entries** : id*, organization_id*, seq*, ticket_ref*, occurred_at*, label*, amount_ttc/ht/vat*, vat_rate*, payment_method*, source*, source_ref, operator*, is_void*, voids_seq, prev_hash*, entry_hash*, pole_id, person_id, created_at*
- **cash_closures** : id*, organization_id*, seq*, closure_type*, period_label*, period_start/end*, first/last_entry_seq, entry_count*, total_ttc/ht/vat*, vat_breakdown* (jsonb), perpetual_total_ttc*, operator*, closed_at*, prev_hash*, closure_hash*, opening_float, counted_cash, expected_cash, variance
- **cash_pointings** : id*, organization_id*, entry_id*, pointed_at*, operator
- **cash_register_settings** : organization_id*, shortcuts* (jsonb), updated_at*

### Subventions
- **grants** : id*, organization_id*, title*, funder*, funder_type*, amount*, amount_received*, start/end_date, status*, convention_ref, description, reporting_due_date, kpi_beneficiaires/heures/artistes/evenements, kpi_note, created_at, updated_at
- **grant_tranches** : id*, grant_id*, label*, amount*, due_date, received_date, status*, created_at
- **grant_opportunities** : id*, title*, funder, funder_type, themes*, regions*, structure_types*, amount_min/max, deadline, recurring*, application_url, required_documents*, description, source*, external_id, published*, created_at*, updated_at*
- **grant_applications** : id*, organization_id*, opportunity_id*, status*, notes, amount_requested, applied_at, result_at, linked_grant_id, created_at*, updated_at*
- **org_grant_profile** : organization_id*, region, structure_type, themes*, annual_budget, project_summary, updated_at*

### Pôles
- **poles** : id*, organization_id*, name*, color*, description, active*, position*, type*, establishment_id, created_at*
- **pole_budgets** : id*, organization_id*, pole_id*, fiscal_year*, allocated_amount*, created_at*
- **pole_members** : id*, organization_id*, pole_id*, user_id*, pole_role*, created_at*

### Documents & médias
- **documents** : id*, organization_id*, person_id, title*, type*, status*, file_url, file_name, notes, signing_status, signed_at, signing_provider, signing_token, created_at*, updated_at*
- **media** : id*, organization_id*, title*, type*, url*, thumbnail_url, alt_text, tags*, created_at*, updated_at* _(module coupé 10/06/2026)_

### Gouvernance
- **meetings** : id*, organization_id*, type*, title*, date*, agenda, minutes, status*, is_general_assembly*, quorum, created_at*, updated_at*
- **mandates** : id*, organization_id*, person_id, role*, start_date, end_date, status*, created_at*, updated_at*
- **assembly_attendance** : id*, organization_id*, meeting_id*, person_id*, present*, checked_in_at*
- **assembly_proxies** : id*, organization_id*, meeting_id*, giver_person_id*, holder_person_id, created_at*

### Communication & site
- **public_sites** : id*, organization_id*, slug*, title*, content_blocks* (jsonb), status*, seo_description, published_at, created_at*, updated_at*
- **announcements** : id*, organization_id*, title*, content*, status*, audience*, establishment_id, created_at*, updated_at*
- **newsletter_campaigns** : id*, organization_id*, sujet*, statut*, blocs* (jsonb), html_archive, programmee_pour, envoyee_le, nb_envoyes, nb_echecs, segment_id, created_at*, updated_at*
- **newsletter_settings** : id*, organization_id*, actif*, mode*, frequence_semaines*, jour_envoi*, heure_envoi*, segment_id, blocs_template* (jsonb), prochain_envoi_le, dernier_envoi_le, nb_evenements_declencheur*, garde_fou_jours*, created_at*, updated_at*

### Système & plateforme
- **tasks** : id*, organization_id*, assignee_id, title*, description, priority*, status*, due_date, related_label, assignee_notified_at, last_reminder_at, validation_token, validated_at, created_at*, updated_at*
- **automations** : id*, organization_id*, name*, trigger_type*, condition, action_type*, action_detail, active*, last_run_at, run_count*, created_at*, updated_at*
- **impact_indicators** : id*, organization_id*, label*, value*, unit, period, category*, created_at*, updated_at*
- **notifications** : id*, organization_id*, user_id, type*, title*, body, link, read_at, created_at*
- **email_log** : id*, organization_id, recipient*, subject*, category, status*, error, created_at*
- **cron_log** : id*, job_key*, status*, duration_ms, rows_affected, error_msg, ran_at* _(RLS activée 10/06/2026)_
- **feedback** : id*, type*, priority*, description*, url, page_title, org_slug, status*, screenshot_url, user_agent, device_type, screen_width/height, os_hint, admin_note, user_id, user_email, created_at, updated_at
- **helloasso_sync_log** : id*, organization_id*, event_type*, helloasso_payment_id, helloasso_form_slug, status*, details (jsonb), created_at
- **help_categories** : slug*, label*, icon*, description, sort_order*, updated_at*
- **help_articles** : slug*, category_slug, title*, excerpt, keywords*, body*, published*, view_count*, helpful_yes/no*, sort_order*, updated_at*

## Fonctions sensibles (SECURITY DEFINER)

| Fonction | Garde | anon |
|---|---|---|
| `assign_invoice_number(p_org)` | `org_assert_member` ✅ | ❌ révoqué |
| `assign_receipt_number(p_org, p_year)` | `org_assert_member` ✅ | ❌ révoqué |
| `cash_add_entry(…)` ×2 | `cash_assert_member` ✅ | ❌ révoqué |
| `cash_close(…)` ×2, `cash_verify` | `cash_assert_member` ✅ | ❌ révoqué |
| `org_assert_member(p_org)` | service_role/super-admin/membre actif | ❌ révoqué |
| `help_vote`, `help_increment_view` | — (public par design) | ✅ |
| `is_org_member/admin`, `is_super_admin` | — (utilisées par les policies RLS) | ✅ |
| triggers (`set_updated_at`, `handle_new_user`, …) | — | ❌ révoqué (anon + authenticated) |
