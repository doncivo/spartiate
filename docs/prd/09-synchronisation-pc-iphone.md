## 9. Synchronisation PC ↔ iPhone

Le mécanisme de CircleTasks (ADR 0011) est repris : dossier `iCloud Drive/Spartiate`, un sous-dossier par appareil, journaux d'opérations chiffrés AES-256-GCM (clé maîtresse dans le coffre de chaque appareil, jamais dans iCloud), HLC par champ, fusion par champ, tombstones, instantanés, reprise après interruption, appairage par QR entre PC et iPhone, clé de secours imprimable, oubli d'appareil, réinitialisation, bandeaux d'état. Ces **invariants sont conservés et testés** (vecteurs existants, tests Rust).

La synchro n'est pas « inchangée » pour autant (D-26). Le fork adapte :

| Élément | Fichiers | Ce qui change |
| --- | --- | --- |
| Catalogue des tables publiées | `src/domain/sync/syncTables.ts`, `SYNC_TABLE_ORDER` dans `src/domain/sync/format.ts`, `src/domain/sync/naturalIds.ts` | Tables, colonnes et identifiants naturels Spartiate ; ordre d'application respectant les clés étrangères |
| Captures SQL et repositories de synchro | `src/db/repositories/syncRepository.ts`, `src/db/repositories/sql/syncRepository.ts`, déclencheurs de `sync_outbox` dans la migration `0001_spartiate_init` | Déclencheurs recréés pour les tables Spartiate ; méthodes métier CircleTasks (`routinePauses`, `setRoutinePaused`, `openFocusSessions`, …) retirées |
| Règles métier d'application et de réparation | `src/sync/apply.ts`, `repair.ts`, `snapshot.ts`, `epochSwitch.ts` | Restauration de rappels, recalcul des pauses de routine, fermeture des focus, suppression d'événements externes et traitement des réglages / espaces fixes retirés ; règles Spartiate (séance close, § 9.1) ajoutées |
| Réglages partagés | `settings` (mécanisme hérité) | Aucun réglage partagé en I0 ; tout partage ultérieur est une décision explicite |

Toute PR touchant `src/sync/**`, `src/domain/sync/**` ou `src-tauri/src/sync/**` est relue par l'agent `sync-icloud`, avec un périmètre écrit dans le ticket et des tests de non-régression (deux bases profil / poids, conflit, instantané, reset, oubli d'appareil, reprise). Aucun seuil de lignes ne remplace cette revue.

### 9.1 Tables publiées

Vocabulaire canonique = § 20.2 (D-25). Toute table absente de ce tableau est locale.

| Table | Publiée | Itération | Règle propre à Spartiate |
| --- | --- | --- | --- |
| `profile`, `body_weight` | Oui | **I0** | Fusion par champ ; `body_weight` unique par date et source |
| `equipment_profile` | Oui | I1 | Le profil actif reste une préférence locale (`settings`) |
| `exercise` (custom seulement ; la bibliothèque embarquée n'est pas publiée) | Oui | I1 | Identifiant naturel = `id` du JSON ; `is_custom = 0` jamais publié, dans les journaux comme dans les instantanés |
| `routine`, `routine_day`, `routine_exercise`, `mesocycle` | Oui | I1 / I3 | Édition surtout PC |
| `workout`, `workout_set` | **Oui, seulement quand la séance est close** (`ended_at` non nul) ; une séance en cours reste locale | I1 | Voir ci-dessous |
| `recommendation_decision`, `progression_profile` | Oui | I2 | `progression_profile` est **recalculable** : en cas de conflit, le dernier HLC gagne, puis recalcul local depuis l'historique |
| `food`, `food_portion` (custom + cache OFF), `meal_entry`, `nutrition_target` | Oui | I4 | — |
| `measurement` | Oui | I6 | — |
| `progress_photo` | Métadonnées seulement | I6 | Le fichier reste sur l'appareil (option « synchroniser les photos de progression » via le dossier iCloud, I6) |
| `recovery_day`, `muscle_recovery` | **Oui, écrits par l'iPhone seul** ; le PC est lecteur | I5 | Résumés quotidiens, jamais les échantillons HealthKit |
| `cardio_session` | Oui, tracé compressé | I6 | — |
| `health_sample_cache`, `ai_call`, `settings` (hors réglages partagés explicites), tables techniques § 20.0 | **Non** | — | Locales ; les métadonnées d'appareil et du moteur de synchro ne sont jamais publiées comme données métier |

**Séance close (D-27).** L'exclusion des séances ouvertes et des exercices embarqués vaut pour les journaux **et** les instantanés. Le catalogue hérité ne connaît ni filtre de ligne ni publication atomique d'un agrégat : les déclencheurs capturent chaque écriture et les instantanés ont leur propre parcours. La clôture doit rendre publiable l'agrégat complet (`workout` + ses `workout_set`) ; interruption pendant la clôture, réessai, reprise après crash, édition ultérieure d'une séance close et suppression sont conçus et testés en I1. C'est une adaptation I1, pas un acquis.

### 9.2 Règles

- Les lignes publiées portent notamment `updated_at`, `device_id` et `hlc` ; `sync_field_clock` conserve les horloges et bases par champ (§ 20.1). Les suppressions passent par les tombstones (`sync_tombstone`) ; `deleted_at` porte la suppression logique côté métier ; restauration par `deleted_at` à `null` avec un HLC plus récent.
- Les conflits (même champ modifié des deux côtés) sont consignés dans `conflict_log`, consultables et réversibles dans Plus → Appareils et synchro (écran repris).
- Un appareil qui voit une version de format supérieure se met en pause et demande la mise à jour (`SYNC_FORMAT_MAJOR`, repris).
- La synchro tourne au premier plan sur l'iPhone et en cycle périodique sur le PC (comme CircleTasks) ; une séance close sur l'iPhone est visible sur le PC au cycle suivant.
- Tests : vecteurs de synchro existants (`tests/fixtures/sync/vectors.json`) étendus aux tables Spartiate ; test de catalogue (`src/domain/sync/catalogue.test.ts`) vérifiant qu'il couvre exactement les tables « Oui » du § 9.1 ; en I0, deux bases profil / poids, conflit, instantané, reset, oubli, reprise ; en I1, scénario e2e « séance iPhone → PC → édition PC → iPhone » en CI.
