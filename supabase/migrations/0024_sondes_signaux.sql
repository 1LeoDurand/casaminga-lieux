-- 0024_sondes_signaux.sql
-- Appliquée le 2026-10-08 (accord de Léo sur l'élargissement du moissonneur), avant le premier import réel de
-- scripts/import-sites.py élargi (2026-10-08). Sans elle, l'écriture de
-- annuaire_sites_sondes échoue sur la contrainte CHECK dès qu'un site a un
-- signal autre que tribe / ics / jsonld / aucun / erreur.
--
-- Le moissonneur lit désormais, en plus de l'API The Events Calendar, des flux
-- ICS, du JSON-LD : Events Manager (em), Event Organiser (eo), My Calendar
-- (mycalendar), All-in-One Event Calendar (ai1ec), Google Agenda embarqué
-- (gcal), Squarespace (squarespace), Wix Events (wix) et les pages
-- de billetterie Billetweb (billetterie). Le signal garde en mémoire quelle
-- source a parlé, pour ne resonder que ce qui a du rendement.

alter table public.annuaire_sites_sondes
  drop constraint if exists annuaire_sites_sondes_signal_check;

alter table public.annuaire_sites_sondes
  add constraint annuaire_sites_sondes_signal_check
  check (signal in (
    'tribe', 'ics', 'jsonld', 'aucun', 'erreur',
    'em', 'eo', 'mycalendar', 'ai1ec', 'gcal', 'squarespace', 'wix', 'billetterie'
  ));

comment on column public.annuaire_sites_sondes.signal is
  'tribe = API The Events Calendar ; ics = flux ICS annoncé par la page ; em / eo / mycalendar / ai1ec = ICS propre à l''extension Events Manager / Event Organiser / My Calendar / All-in-One Event Calendar ; gcal = ICS public d''un Google Agenda embarqué ; squarespace = collection événements ?format=json ; wix = pages /event-details/ de Wix Events ; jsonld = JSON-LD schema.org Event ; billetterie = pages Billetweb liées ; aucun = rien d''exploitable trouvé ; erreur = site injoignable ou refusé.';
