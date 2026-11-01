## 20. Modèle de données SQLite

Mécanisme repris de CircleTasks : migrations TypeScript dans `src/db/migrations/`, registre `src/db/migrations/index.ts`, exécutées par `src/db/migrator.ts` via `SqlDriver` (driver natif `tauri-plugin-sql` vendored en production, `@sqlite.org/sqlite-wasm` en mémoire dans les tests et le navigateur), historique dans `schema_migrations`, sauvegarde avant migration (`src/db/migrationBackup.ts`) et sauvegardes natives (`src-tauri/src/backup.rs`, `APP_SCHEMA_VERSION`). Repositories dans `src/db/repositories/` ; aucun type généré, les types sont écrits à la main. Spartiate initialise une **nouvelle base** : le registre est réinitialisé avec `0001_spartiate_init` et `APP_SCHEMA_VERSION` vaut 1 ; aucune base CircleTasks n'est migrée ni purgée (D-23).

### 20.0 Tables techniques héritées (D-24)

Conservées telles quelles, jamais publiées comme données métier :

| Table | Rôle |
| --- | --- |
| `settings` | Clé / valeur, local ou partagé : identité d'appareil (`device.id`), préférences, version ; utilisée par le démarrage (`src/features/app/bootstrap.ts`), `settingsRepository` et la restauration Rust |
| `schema_migrations` | Historique des migrations appliquées |
| `sync_guard` | Verrou d'exclusivité de la synchro |
| `sync_field_clock` | Horloges HLC et bases par champ |
| `sync_outbox` | File d'envoi alimentée par les déclencheurs |
| `sync_state`, `sync_meta` | État et métadonnées du moteur |
| `sync_tombstone` | Suppressions à propager |
| `sync_unknown`, `sync_parked` | Lignes de format inconnu ou mises en attente |
| `conflict_log` | Conflits consultables et réversibles |
| `epoch_carry_report` | Rapport local des bascules d'époque (restauration, concurrence, reset) |

`app_meta` et `app_pref` n'existent pas et ne sont pas créées : leurs usages (identité, version, préférences) sont couverts par `settings`. Les tables métier Spartiate sont celles du § 20.2 ; les déclencheurs de `sync_outbox` sont recréés pour elles dans `0001_spartiate_init`.

### 20.1 Colonnes communes

Chaque table métier porte `id TEXT PRIMARY KEY` (UUID v7), `created_at`, `updated_at`, `deleted_at` (suppression logique). Les lignes publiées portent notamment `updated_at`, `device_id` et `hlc` ; `sync_field_clock` conserve les horloges et bases par champ (mécanisme ADR 0011). Les colonnes publiées, locales et techniques de chaque table sont définies dans le catalogue (`src/domain/sync/syncTables.ts`). Les tables locales (cache, journal d'appels) n'ont ni `device_id` ni `hlc`.

### 20.2 Tables

| Table | Colonnes principales | Publiée | Itération |
| --- | --- | --- | --- |
| `profile` | sex, birth\_year, height\_cm, goal, experience, units | Oui | I0 |
| `body_weight` | date, kg, source (manual / health), health\_uuid | Oui | I0 |
| `exercise` | id, name\_fr, aliases\_en (JSON), muscles (JSON), equipment (JSON), pattern, kind, metric, bodyweight\_fraction, default\_rep\_min / max, default\_rest\_sec, instructions (JSON), media (JSON), strength\_standard\_key, is\_custom, schema\_version | Oui (custom uniquement ; les 150 embarqués sont lus du JSON) | I1 |
| `equipment_profile` | name, kind, inventory (JSON), increments (JSON) | Oui | I1 |
| `routine` / `routine_day` / `routine_exercise` | name, mode (Libre / Programme), day\_order, exercise\_id, sets, rep\_min, rep\_max, rir, rest\_sec, position | Oui | I1 |
| `mesocycle` | routine\_id, start\_date, weeks, deload\_week, status | Oui | I3 |
| `workout` | started\_at, ended\_at, routine\_day\_id, notes, rating, health\_uuid, device\_id | Oui **à la fin** (`ended_at` non nul) | I1 |
| `workout_set` | workout\_id, exercise\_id, position, set\_index, kg, reps, rir, difficulty, is\_warmup, is\_pr, rest\_sec\_actual | Oui (avec le workout) | I1 |
| `recommendation_decision` | workout\_set\_id, exercise\_id, engine\_version, prescription (JSON), reasons (JSON), accepted | Oui | I2 |
| `progression_profile` | exercise\_id, estimated\_1rm, confidence, last\_easy\_recalibration | Oui | I2 |
| `food` / `food_portion` | source (ciqual / off / custom), barcode, name, kcal, protein, fat, carbs, fiber, per\_100g (JSON) | Oui (custom + cache OFF) | I4 |
| `meal_entry` | date, time, food\_id, grams, kcal, macros (JSON), method (search / scan / photo / quickadd), confidence | Oui | I4 |
| `nutrition_target` | week\_start, kcal, protein, fat, carbs, source (auto / manual), accepted | Oui | I4 |
| `recovery_day` | date, level (A / B / C), recovery, exertion, sleep\_score, quality, abstain\_reason, inputs (JSON) | Oui (iPhone → PC) | I5 |
| `muscle_recovery` | date, muscle\_id, percent | Oui | I5 |
| `health_sample_cache` | type, start, end, value, uuid | **Non** (local iPhone) | I5 |
| `ai_call` | date, kind, tokens\_in / out, cost\_estimate, status | Non (local, par appareil) | I4 |
| `settings` (héritée, § 20.0) | key, value, portée (local / partagé) | Non en I0 ; tout réglage partagé est une décision explicite ; le catalogue hérité publie encore des clés de `settings` : SPA-001b les retire explicitement du catalogue et des chemins de publication (D-47) | I0 |
| `measurement` / `progress_photo` | date, kind, value / file\_name | Oui / photos : métadonnées seulement (fichiers locaux, export manuel) | I6 |
| `cardio_session` | started\_at, ended\_at, distance\_m, track (compressé), avg\_hr | Oui | I6 |

### 20.3 Index et contraintes

`workout_set(exercise_id, created_at)`, `meal_entry(date)`, `body_weight(date)`, `recovery_day(date)` ; `UNIQUE(date)` sur `recovery_day` et `body_weight` par source ; clés étrangères activées (`PRAGMA foreign_keys = ON`, déjà le cas). Les JSON sont validés à l'écriture par `src/db/parse/*.ts` (fonctions écrites à la main, règle ADR 0008).

### 20.4 Migrations

`0001_spartiate_init` crée les tables techniques du § 20.0, `profile`, `body_weight` et leurs déclencheurs de synchro (I0) ; les tables I1 et suivantes arrivent par une migration par itération, jamais créées par anticipation. Jamais de modification d'une migration publiée. Tests : Vitest + `@sqlite.org/sqlite-wasm` (driver mémoire, clés étrangères actives), commande ciblée `npx vitest run --coverage.enabled=false src/db/migrator.test.ts src/db/migrations` ; chaque migration a son test colocalisé (`000N_*.test.ts`) qui rejoue 0001 → N sur une base vide et sur des **fixtures synthétiques** (jamais une donnée réelle, D-38) et vérifie insertion, modification, suppression, restauration, `sync_guard`, file d'envoi et horloges. Le plugin SQL natif vendored est validé en CI par `cargo test --locked -p tauri-plugin-sql --features sqlite` ; la parité Wasm / natif (DDL, déclencheurs, transactions, pragmas, restauration) reste l'hypothèse H-18 (D-31). Le test de catalogue vérifie que `syncTables.ts` couvre exactement les tables marquées « Oui » au § 9.1.
