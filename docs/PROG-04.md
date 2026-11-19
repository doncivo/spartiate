# PROG-04 — séance du jour selon le jour de la semaine (lot 0.27.0)

Budget M (training, data-model, sync-icloud, D-26). Constats AUDIT-USAGE U-5, U-9. Décisions D-316, D-317 (révisables par Ali).
PRD § 12, § 13, § 20 ; ADR 0011 § 7.2, ADR 0018.

## Passes

- **product-owner** — (1) Given une routine programme de 5 jours rattachés (lun, mar, jeu, ven, sam) et une seule séance close le lundi,
  When Aujourd'hui s'ouvre un jeudi, Then « Jeudi — Poussée ». (2) Un mercredi : « Repos aujourd'hui. Prochaine séance jeudi : … », sans
  « Lancer la séance », avec « Autre séance… ». (3) Séance manquée sautée, pas décalée. (4) Sans jour rattaché : rotation d'avant. (5) Saisie
  « Jour de la semaine » dans l'éditeur ; deux jours au même jour refusés. (6) Migration additive, schéma 20 : jours « Lundi — … » rattachés
  (unique par routine), rien en file. (7) Export sv 20 ; archives sv 18 et 19 importées avec rattachement par le nom. (8) Appareil resté au
  schéma 19 : jour de la semaine jamais perdu ; ligne créée sur le 19 gardée de côté et signalée (SYNC-01). (9) Jours d'entraînement de la
  nutrition déduits des jours rattachés.
- **data-model** — migration `0020_routine_weekday` (colonne, rattachement sous garde, déclencheur propre `sync_routine_day_weekday_au`) ;
  dépôt des routines (lecture tolérante, écriture de la colonne seulement si elle est donnée, unicité par routine) ; référence Rust des
  déclencheurs (112) et `APP_SCHEMA_VERSION` 20 ; fixture `spartiate-migrations.json` régénérée par `scripts/backup/export-migrations-fixture.mjs`.
- **training** — `programDayFor`, `weekdayFromDayName`, `routineTrainingDays` (programDay.ts), règles de validation ; carte « Séance du
  jour » (repos) ; éditeur de routine ; Stratégie (jours d'entraînement).
- **sync-icloud (D-26)** — Périmètre écrit : catalogue `routine_day.weekday` (colonne publiée nullable, valeurs 1 à 7), `SCHEMA_REPUBLISH[20]`
  = `routine_day` (ADR 0018), simulateur `v19`. Invariants inchangés : protocole, HLC par champ, tombstones, reprise, reset, oubli. Tests de
  non-régression : `tests/unit/sync/versions/routineWeekday19.test.ts` (deux bases, appareil au schéma 19, renommage sans perte du jour de la
  semaine, aucun conflit ; création sur le 19 gardée de côté), garde `schemaRepublish.test.ts`.
- **qa-test** — Rouge : `14cb5db1`. Vert : commit suivant (voir la PR).
- **code-reviewer** — voir la PR.
