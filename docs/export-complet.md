# Export complet (CSV et JSON)

Plus › Export et import › « Export complet (CSV et JSON) » enregistre une archive zip `spartiate-export-complet-AAAA-MM-JJ.zip` : toutes les données de l’utilisateur, lisibles sans l’app. Ce document décrit chaque fichier, chaque colonne, son unité et les règles d’ordre. Il est gardé à l’identique du code par un test (`src/domain/exportImport/fullExportDoc.test.ts`) : une colonne ajoutée sans mise à jour de ce document fait échouer la CI.

## Contenu de l’archive

| Fichier | Rôle |
| --- | --- |
| `manifest.json` | Application, version de schéma (`sv`), date, empreinte SHA-256 de `data.json`. Même forme que l’export habituel. |
| `contenu.json` | Format de l’archive, version de l’app, réglages CSV, liste des fichiers (nombre de lignes, colonnes, types, unités) et des tables exclues. |
| `data.json` | Toutes les données en JSON canonique (clés triées, lignes triées par `id`) : même fichier que l’export habituel, réimportable. |
| `csv/<table>.csv` | Un fichier CSV par table, décrit plus bas. |

L’archive complète est aussi une archive d’import valide : l’import ne lit que `manifest.json` et `data.json` et ignore les autres fichiers.

## Format des CSV

- Codage UTF-8 avec marque d’ordre des octets (BOM) : Excel affiche correctement les accents.
- Séparateur : le point-virgule (`;`), comme l’export de l’historique ; Excel en français l’ouvre directement. Fin de ligne : CRLF.
- Une cellule qui contient un point-virgule, un retour à la ligne ou des guillemets est entourée de guillemets (`"`) ; les guillemets qu’elle contient sont doublés (`""`).
- Première ligne : noms des colonnes, identiques à `contenu.json`. Ordre des colonnes : `id` d’abord, puis l’ordre du catalogue de synchro (fixe). Les colonnes sont stables : une colonne n’est jamais renommée ni retirée sans nouvelle version du format (`format` dans `contenu.json`).
- Dates : ISO 8601. `date` : `AAAA-MM-JJ` ; `time` : `HH:MM` (24 h) ; `datetime` : instant UTC `AAAA-MM-JJTHH:MM:SS.sssZ`.
- Nombres : point décimal, sans séparateur de milliers, sans notation scientifique. Booléens : `1` ou `0`.
- Une cellule vide est une valeur absente (NULL) ; un texte vide ne s’en distingue pas. `data.json` garde la distinction.
- Colonnes `json` : texte JSON dans une seule cellule (entre guillemets).
- Un texte qui commencerait par `=`, `+`, `-`, `@`, `%`, une tabulation ou un retour chariot est précédé d’une apostrophe (`'`) pour qu’un tableur ne l’exécute pas comme une formule ; `data.json` garde le texte exact.

## Règles d’ordre

- Dans chaque CSV, les lignes sont triées par `id` (par `key` pour `settings.csv` ; comparaison des unités de code, sans tenir compte de la langue) ; l’ordre ne dépend ni de l’appareil ni de la date de saisie.
- Dans `workout_set.csv`, l’ordre d’exécution d’une séance se lit par `position` (à partir de 0), pas par l’ordre des lignes.
- Les fichiers sont écrits dans l’ordre : `manifest.json`, `contenu.json`, `data.json`, puis `csv/` : `profile`, `body_weight`, `settings`, puis les tables dans l’ordre du catalogue (parents avant enfants).

## Exclusions

Jamais exportés : les photos de progression (fichiers image : elles ne quittent jamais l’appareil, seule leur fiche figure dans `progress_photo.csv`), jamais de clé de chiffrement ni de jeton, aucun identifiant d’appareil, aucune horloge de synchro, les lignes supprimées, et les tables suivantes :

- `progress_photo_file`
- `sync_outbox`
- `sync_field_clock`
- `sync_tombstone`
- `sync_guard`
- `sync_meta`
- `sync_state`
- `sync_unknown`
- `sync_parked`
- `conflict_log`
- `epoch_carry_report`
- `recovery_sample`
- `recovery_import_state`
- `schema_migrations`
- `data_reset` (remises à zéro « Repartir de zéro », technique de synchro)

Les réglages de l’app autres que le thème et les favoris alimentaires locaux ne sont pas exportés.

## Fichiers et colonnes

Type : `text`, `int`, `real`, `bool` (0 ou 1), `json`, `date`, `time`, `datetime`, `enum` (liste fermée de codes). Unité : « — » = sans unité.

### `csv/profile.csv`

Profil de l’utilisateur (une ligne au plus, `id` = `profile|singleton`).

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `sex` | enum | — | oui |  |
| `birth_year` | int | — | oui |  |
| `height_cm` | real | cm | oui |  |
| `goal` | enum | — | oui |  |
| `experience` | enum | — | oui |  |
| `units` | enum | — | oui |  |

### `csv/body_weight.csv`

Pesées, une par jour et par source (`manual` ou `health`). L’`id` est `weight|<date>|<source>`.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `date` | date | — | non |  |
| `kg` | real | kg | non | masse corporelle en kilogrammes |
| `source` | enum | — | non |  |
| `timezone` | text | — | non |  |
| `health_uuid` | text | — | oui |  |
| `measured_at` | datetime | — | oui |  |

### `csv/settings.csv`

Réglages exportés : seulement `ui.theme` (`system`, `light` ou `dark`). Un thème jamais touché (valeur par défaut) n’a pas de ligne ; les autres réglages de l’app ne sont pas exportés.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `key` | text | — | non |  |
| `value` | text | — | non |  |

### `csv/exercise.csv`

Exercices personnalisés (les exercices de la bibliothèque embarquée ne sont pas des données de l’utilisateur).

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `name_fr` | text | — | non |  |
| `aliases_en` | json | — | non |  |
| `muscles` | json | — | non |  |
| `equipment` | json | — | non |  |
| `pattern` | enum | — | non |  |
| `kind` | enum | — | non |  |
| `metric` | enum | — | non |  |
| `bodyweight_fraction` | real | — | oui | part du poids de corps (rapport sans unité) |
| `default_rep_min` | int | — | non |  |
| `default_rep_max` | int | — | non |  |
| `default_rest_sec` | int | s | non |  |
| `instructions` | json | — | non |  |
| `media` | json | — | oui |  |
| `strength_standard_key` | text | — | oui |  |
| `schema_version` | int | — | non |  |

### `csv/equipment_profile.csv`

Profils de matériel (inventaire et incréments en JSON).

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `name` | text | — | non |  |
| `kind` | enum | — | non |  |
| `inventory` | json | — | non |  |
| `increments` | json | — | non |  |

### `csv/routine.csv`

Routines.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `name` | text | — | non |  |
| `mode` | enum | — | non |  |

### `csv/routine_day.csv`

Jours d’une routine (`routine_id` renvoie à `routine.csv`).

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `routine_id` | text | — | non |  |
| `name` | text | — | non |  |
| `day_order` | int | — | non |  |

### `csv/routine_exercise.csv`

Lignes d’exercice d’un jour de routine (`routine_day_id` renvoie à `routine_day.csv`). Les lignes d’un même groupe (superset, triset, circuit ; schéma 14) portent le même `circuit_id` ; la séance démarrée depuis ce jour alterne leurs séries tour par tour.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `routine_day_id` | text | — | non |  |
| `exercise_id` | text | — | non |  |
| `exercise_name` | text | — | non |  |
| `sets` | int | — | non |  |
| `rep_min` | int | — | non |  |
| `rep_max` | int | — | non |  |
| `rir` | int | — | oui |  |
| `rest_sec` | int | s | non | repos après la série ; dans un groupe, repos de fin de tour |
| `position` | int | — | non |  |
| `circuit_id` | text | — | oui | identifiant du groupe (superset, triset, circuit) ; vide hors groupe |
| `circuit_rest_sec` | int | s | oui | repos entre deux exercices d’un même tour ; 0 = aucun ; vide hors groupe |

### `csv/workout.csv`

Séances, terminées ou ouvertes (`ended_at` vide = séance ouverte).

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `routine_id` | text | — | oui |  |
| `routine_day_id` | text | — | oui |  |
| `name` | text | — | non |  |
| `started_at` | datetime | — | non |  |
| `ended_at` | datetime | — | oui |  |
| `source` | enum | — | non |  |
| `copied_from_workout_id` | text | — | oui |  |
| `notes` | text | — | non |  |

### `csv/workout_set.csv`

Séries des séances (`workout_id` renvoie à `workout.csv`). Les séries d’un exercice peuvent être alternées avec celles d’un autre exercice d’un même groupe (superset, triset, circuit) : l’ordre d’exécution est `position`.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `workout_id` | text | — | non |  |
| `exercise_id` | text | — | non |  |
| `exercise_name` | text | — | non |  |
| `position` | int | — | non | rang d’exécution de la série dans la séance, à partir de 0 |
| `set_kind` | enum | — | non |  |
| `target_reps_min` | int | — | oui |  |
| `target_reps_max` | int | — | oui |  |
| `target_load_kg` | real | kg | oui |  |
| `target_rest_sec` | int | s | oui | repos visé après la série ; dans un groupe, repos de fin de tour |
| `reps` | int | — | oui |  |
| `load_kg` | real | kg | oui |  |
| `duration_sec` | int | s | oui |  |
| `rir` | int | — | oui | répétitions en réserve (0 à 5) |
| `done` | bool | — | non | 1 = série validée, 0 = à faire |
| `done_at` | datetime | — | oui |  |
| `corrected_at` | datetime | — | oui |  |
| `difficulty` | enum | — | oui |  |
| `circuit_id` | text | — | oui | identifiant du groupe (superset, triset, circuit) ; vide hors groupe |
| `circuit_rest_sec` | int | s | oui | repos entre deux exercices d’un même tour ; 0 = aucun ; vide hors groupe |

### `csv/progression_profile.csv`

Estimation de 1RM par exercice, `id` = `progression|<exercice>`.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `exercise_id` | text | — | non |  |
| `estimated_1rm_kg` | real | kg | oui |  |
| `confidence` | real | — | oui |  |
| `last_easy_recalibration_at` | datetime | — | oui |  |
| `engine_version` | int | — | non |  |

### `csv/recommendation_decision.csv`

Décisions prises sur les cibles proposées (charge et répétitions choisies).

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `exercise_id` | text | — | non |  |
| `workout_id` | text | — | oui |  |
| `workout_set_id` | text | — | oui |  |
| `engine_version` | int | — | non |  |
| `prescription` | json | — | non |  |
| `reasons` | json | — | non |  |
| `accepted` | bool | — | non |  |
| `chosen_load_kg` | real | kg | oui |  |
| `chosen_reps` | json | — | non |  |
| `decided_at` | datetime | — | non |  |

### `csv/mesocycle.csv`

Cycles d’entraînement.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `routine_id` | text | — | non |  |
| `start_date` | date | — | non |  |
| `weeks` | int | — | non |  |
| `unlimited` | bool | — | non |  |
| `deload_week` | int | — | oui |  |
| `block_origin_week` | int | — | non |  |
| `block_origin_index` | int | — | non |  |
| `rotation_index` | int | — | non |  |
| `pauses` | json | — | non |  |
| `status` | enum | — | non |  |
| `outcome` | enum | — | oui |  |
| `ended_on` | date | — | oui |  |

### `csv/food.csv`

Fiches alimentaires personnelles et cache Open Food Facts.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `source` | enum | — | non |  |
| `barcode` | text | — | oui |  |
| `name` | text | — | non |  |
| `brand` | text | — | oui |  |
| `kcal` | real | kcal pour 100 g | oui |  |
| `protein_g` | real | g pour 100 g | oui |  |
| `fat_g` | real | g pour 100 g | oui |  |
| `carb_g` | real | g pour 100 g | oui |  |
| `fiber_g` | real | g pour 100 g | oui |  |
| `fetched_at` | datetime | — | oui |  |

### `csv/food_portion.csv`

Portions d’une fiche alimentaire (`food_id` renvoie à `food.csv`).

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `food_id` | text | — | non |  |
| `label` | text | — | non |  |
| `grams` | real | g | non |  |
| `position` | int | — | non |  |

### `csv/meal_entry.csv`

Journal alimentaire.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `date` | date | — | non |  |
| `time` | time | — | non |  |
| `food_id` | text | — | oui |  |
| `food_name` | text | — | non |  |
| `source` | enum | — | non |  |
| `grams` | real | g | oui |  |
| `kcal` | real | kcal | oui |  |
| `protein_g` | real | g | oui |  |
| `fat_g` | real | g | oui |  |
| `carb_g` | real | g | oui |  |
| `method` | enum | — | non |  |
| `confidence` | real | — | oui |  |

### `csv/nutrition_target.csv`

Cibles de nutrition, une ligne par décision ; `decided_at` = instant de la décision.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `week_start` | date | — | non |  |
| `kcal` | real | kcal par jour | non |  |
| `protein_g` | real | g par jour | non |  |
| `fat_g` | real | g par jour | non |  |
| `carb_g` | real | g par jour | non |  |
| `source` | enum | — | non |  |
| `accepted` | bool | — | non |  |
| `engine_version` | int | — | oui |  |
| `decided_at` | datetime | — | oui |  |

### `csv/day_completeness.csv`

Journées déclarées complètes ou non.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `date` | date | — | non |  |
| `state` | enum | — | non |  |

### `csv/recipe.csv`

Recettes.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `name` | text | — | non |  |
| `servings` | int | — | non |  |
| `cooked_weight_g` | real | g | oui |  |

### `csv/recipe_ingredient.csv`

Ingrédients d’une recette (`recipe_id` renvoie à `recipe.csv`).

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `recipe_id` | text | — | non |  |
| `position` | int | — | non |  |
| `name` | text | — | non |  |
| `source` | enum | — | non |  |
| `food_ref` | text | — | oui |  |
| `grams` | real | g | non |  |
| `kcal_100g` | real | kcal pour 100 g | oui |  |
| `protein_100g` | real | g pour 100 g | oui |  |
| `fat_100g` | real | g pour 100 g | oui |  |
| `carb_100g` | real | g pour 100 g | oui |  |
| `fiber_100g` | real | g pour 100 g | oui |  |

### `csv/recovery_day.csv`

Résumé de récupération par jour (calculé sur l’iPhone).

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `date` | date | — | non |  |
| `level` | enum | — | non |  |
| `recovery` | int | — | oui |  |
| `abstain_reason` | enum | — | oui |  |
| `quality` | enum | — | non |  |
| `exertion` | real | — | non |  |
| `exertion_prev_day` | real | — | non |  |
| `sleep_minutes` | real | min | oui |  |
| `sleep_need_minutes` | real | min | non |  |
| `sleep_score` | int | — | oui |  |
| `bedtime_sigma_minutes` | real | min | oui |  |
| `target_zone_from` | real | — | oui |  |
| `target_zone_to` | real | — | oui |  |
| `hrv_ms` | real | ms | oui |  |
| `resting_hr` | real | bpm | oui |  |
| `learning_nights` | int | — | non |  |
| `contributors` | json | — | non |  |
| `explanation_keys` | json | — | non |  |
| `computed_at` | datetime | — | non |  |
| `engine_version` | int | — | non |  |

### `csv/muscle_recovery.csv`

Récupération par muscle et par jour.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `date` | date | — | non |  |
| `muscle_id` | text | — | non |  |
| `muscle_group` | text | — | non |  |
| `percent` | int | % | non |  |
| `hours` | real | h | non |  |
| `last_worked_at` | datetime | — | non |  |
| `ready_at` | datetime | — | non |  |

### `csv/recovery_factor.csv`

Journal de facteurs du matin (`factors` : liste JSON de codes).

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `date` | date | — | non |  |
| `factors` | json | — | non |  |
| `none` | bool | — | non |  |

### `csv/measurement.csv`

Mensurations et mesures importées de Santé (Renpho), une par date et par genre ; `id` = `measurement|<date>|<genre>`. L’unité de `value` dépend du genre (FIX-0173, D-141) : la colonne `unit`, ajoutée au CSV seulement, la donne ligne par ligne, et `contenu.json` la rappelle dans `measurementUnits`. La valeur exportée est la valeur stockée, jamais convertie ; `data.json` n’a pas de colonne `unit`.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `date` | date | — | non |  |
| `kind` | text | — | non |  |
| `value` | real | selon kind (colonne unit) | non | valeur stockée, dans l’unité de la colonne `unit` |
| `unit` | enum | — | oui | dérivée du genre ; vide pour un genre inconnu (appareil plus récent) |

Unité par genre :

| Unité | Genres |
| --- | --- |
| cm | `neck`, `shoulders`, `chest`, `waist`, `hips`, `arm_left`, `arm_right`, `thigh_left`, `thigh_right`, `calf_left`, `calf_right` (zones saisies) ; `health_waist_cm`, `health_height_cm` (importés) |
| pct | `health_body_fat_pct` (masse grasse, en pour cent ; « pct » plutôt que « % », qu’un tableur prendrait pour une formule) |
| kg | `health_lean_mass_kg` (masse maigre) |
| g | `health_fiber_g` (fibres du jour) |

### `csv/progress_photo.csv`

Fiches des photos de progression (date et nom de fichier). Les fichiers image ne sont jamais exportés : ils restent sur l’appareil.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `date` | date | — | non |  |
| `file_name` | text | — | non |  |

### `csv/food_favorite.csv`

Favoris de la recherche d’aliments (FIX-0181, schéma 15), écrits sur l’un ou l’autre appareil, le plus récent d’abord par `added_at`. `ref` est la référence de l’aliment : `ciqual:<code>` ou l’identifiant d’une fiche (`food.csv`).

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non | « favorite », une barre verticale, puis `ref` |
| `source` | text | — | non | `custom`, `ciqual` ou `off` |
| `ref` | text | — | non |  |
| `added_at` | datetime | — | non | instant de la mise en favori |

### `csv/supplement.csv`

Compléments (I6-05, schéma 17), écrits sur l’un ou l’autre appareil. `times` : liste JSON des heures de prise (`HH:mm`, 24 h, une à quatre) ; `days` : jours de la semaine en masque (lundi = 1, mardi = 2, mercredi = 4, jeudi = 8, vendredi = 16, samedi = 32, dimanche = 64 ; tous les jours = 127) ; `active` = 0 : en pause.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `name` | text | — | non |  |
| `dose` | real | — | oui | dans l’unité `unit` |
| `unit` | text | — | oui |  |
| `times` | json | — | non |  |
| `days` | int | — | non |  |
| `active` | bool | — | non |  |

### `csv/supplement_intake.csv`

Prises de compléments cochées (I6-05, schéma 17), une par complément, date et heure ; `id` = `intake|<supplement_id>|<date>|<moment>`.

| Colonne | Type | Unité | NULL possible | Remarque |
| --- | --- | --- | --- | --- |
| `id` | text | — | non |  |
| `supplement_id` | text | — | non | `id` de `supplement.csv` |
| `date` | date | — | non |  |
| `moment` | time | — | non | heure prévue de la prise |
| `taken_at` | datetime | — | non | instant où la prise a été cochée |
