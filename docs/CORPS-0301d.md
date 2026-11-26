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
- **notifications / settings-personalization** — Plan pur `planMeasurementNotifications` et `parseMeasurementReminder`
  (`src/domain/measurementNotificationPlan.ts`, sur `measurementSchedule` de PROG-0301b) ; famille « measurement » dans `LedgerKind`,
  `LEDGER_KINDS`, `NotificationKind` et `NOTIFICATION_KINDS` ; service `createMeasurementNotificationService` (`readPrefs`, `replan`,
  `savePrefs`), `measurementNotificationsFor` (même file que compléments et gênes), déclencheurs d'ouverture, de retour et de synchro
  (`supplementWake.ts`, table `measurement` ajoutée) ; clés `bodyProgress.measurementRhythm` et `bodyProgress.measurementReminder`
  (`settings.ts`, gardées à la remise à zéro, `dataReset.ts`) ; composant `MeasurementRhythmSettings` et son hôte à la demande
  `lazy.ts` (src/features/settings/measurementRhythm), catalogues `fr.measurementRhythm.ts` (traducteur typé `measurementRhythmText.ts`,
  compteurs par `tPlural`) et `fr.measurementNotifications.ts`. Montage : un import et une ligne dans `BodyProgress.tsx` (sous la
  saisie), qui passe les mesures déjà lues : une saisie locale rafraîchit les phrases et replanifie. Aucune migration : `settings` suffit.
  Choix : D-760 à D-764 ; D-762 : l'appui ouvre l'app, pas Corps › Mesures (aucune famille n'a de lien profond).
- **qa-test** — Rouge : `d4f1d923` (4 fichiers de tests neufs en échec, modules absents, plus 5 assertions « hors du départ » dans
  `tests/bundle/startBundle.test.ts`). Vert : `107e37a0` ; le test d'écran y écrit aussi la mesure dans la base (le service relit la
  table `measurement`, la fixture rouge ne le faisait pas). Suites du module (domaine bodyProgress et plan, src/features/notifications,
  measurementRhythm, bodyProgress, SectionNoticeProgress, notificationLedger, dataReset, model, platform/notifications, src/i18n, tests/unit/arch,
  eslintGuards, hardcodedUnits) : 82 fichiers, 869 tests verts ; `npm run test:bundle` : 201 tests verts (plafond inchangé) ;
  scripts/release : 291 tests verts ; `tsc --noEmit` et eslint sans erreur. Valeurs inventées seulement.
- **code-reviewer** — Relecture à froid par un agent distinct, sur le diff. Premier verdict : « à corriger » (1 bloquant : interrupteur
  rendu seulement après le premier passage, test dépendant de l'ordre à cause de l'import à froid ; 2 importants : échec de chargement avalé,
  fuseau illisible non dit ; non bloquants : lecture des réglages qui écrase un choix, nom `SUPPLEMENT_TABLES` trompeur, échéance dépassée
  à consigner, `role="status"`, test du composant changé dans le commit vert (fixture `seed`, assertions inchangées)). Rouge `bf7edc82`
  (2 tests : interrupteur rendu en synchrone, fuseau illisible dit), vert `c530cd6f` : interrupteur décidé par la plateforme, service importé
  avec le bloc (déjà à la demande), échecs et `no-zone` dits, ref `touched`, `REMINDER_TABLES`, D-761 complétée ; le test du point 1 y reçoit
  le `seed` oublié. Seconde relecture : « approuvé », aucun bloquant. Reste (non bloquant, ticket suivant) : un choix fait avant la fin de la
  lecture des réglages enregistre le rythme par défaut et peut écraser un 14 ou un 28 déjà stocké (désactiver les contrôles jusqu'à la lecture).
  CI : voir la PR.
