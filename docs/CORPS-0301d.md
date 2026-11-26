# CORPS-0301d — rythme des mesures et rappel iPhone (lot 0.30.1)

Budget M (≈ 150 k ; coquille, iOS et qualité : notifications, settings-personalization). Registre : BL-180. Décisions lues : D-710, D-713,
D-714, D-734 ; ajoutées : D-760 à D-764 (choix prudents). Chapitres : 17.1 (Progrès, ligne « Corps »), 18.6 (accessibilité), 23.1 (bundle
de départ) ; ADR 0012 (planificateur pur et NotificationScheduler). Préparation : docs/PROGRES-0301.md (ligne CORPS-0301d). Aucune
migration (la table `settings` suffit, D-713), aucune table, aucun fichier de synchro.

## Passes

- **product-owner** — Périmètre : registre des familles de notification (`LedgerKind`, `LEDGER_KINDS`, `NotificationKind`), plan pur du
  rappel (`src/domain/measurementNotificationPlan.ts`), service iPhone (`src/features/notifications/measurementNotifications.ts`) et ses
  déclencheurs, deux définitions de `settings`, composant de réglage à part chargé à la demande
  (`src/features/settings/measurementRhythm/`), son catalogue (`fr.measurementRhythm.ts`) et le texte de l'écran verrouillé
  (`fr.measurementNotifications.ts`), tests ; une ligne de montage dans Corps › Mesures, en dernier. Hors périmètre : écran Mesures
  (CORPS-0301c, src/features/bodyProgress hors montage), src/sync, migrations, CHANGELOG, version. Critères :
  1. Given aucun réglage, When Corps › Mesures s'ouvre, Then le rythme vaut « Chaque semaine » (7 jours) et le rappel est actif ; Given
     un choix 7, 14 ou 28 jours, Then il est écrit dans `settings` (clé locale) et relu à la réouverture ; toute autre valeur lue vaut 7.
  2. Given une dernière mesure de zone il y a N jours (hors `health_*`, `note_*`, `visbody_*`), Then « Dernière séance de mesures il y a N
     jours » (aujourd'hui, 1 jour : formes propres) et « Prochaine conseillée dans N jours » ; échéance passée : « Prochaine conseillée
     aujourd'hui », jamais un nombre négatif ; sans mesure : « Aucune séance de mesures », sans prochaine (D-713).
  3. Given l'iPhone, le rappel actif et une échéance future, Then une seule notification `measurement:AAAA-MM-JJ` à 09:00 (heure locale
     flottante) le jour prévu ; échéance dépassée : aujourd'hui à 09:00 si l'heure n'est pas passée, sinon rien ; texte neutre, sans zone
     ni valeur ; les notifications d'autres familles sont reposées telles quelles ; la fenêtre des 64 est respectée (D-714).
  4. Given l'interrupteur coupé, Then le rappel déjà posé est retiré et aucun n'est posé ; rallumé, il revient.
  5. Given le PC, Then rythme et phrases visibles, interrupteur absent, « Le rappel est émis sur l'iPhone. » ; aucun envoi (planificateur
     vide : `unsupported`).
  6. Given la famille « measurement », Then le registre local la relit (`parseNotificationLedger` valide) et la validation commune l'accepte.
  7. Given le bundle de départ, Then inchangé : composant, catalogue, service et texte de notification hors du départ (assertions).
- **notifications / settings-personalization** — à remplir.
- **qa-test** — à remplir.
- **code-reviewer** — à remplir.
