# TECH-01 — Dette technique : CLEAN-03 (tests de synchro hors du banc legacy) et DEP-01 (dépendances)

Lot 0.29.0, point 5 (docs/LOT-0.29.0.md). Budget M à L. Agents : sync-icloud (CLEAN-03, D-26), ci-release (DEP-01). Sources : docs/backlog.md (CLEAN-03, BL-003, BL-035), D-201, docs/CLEAN-02.md. Chapitres : 9 (synchro), 22 (dépendances). Aucune migration de schéma, aucun code livré modifié (`src/**` absent du diff), aucune donnée réelle (valeurs synthétiques).

## Statut

**Livré : DEP-01 (deux mises à jour sûres, une alerte de développement justifiée) ; CLEAN-03 lots A, B et C (49 fichiers de test migrés par script, 450 tests verts en local sur le schéma Spartiate).** **Reporté : le reste de l'inventaire (177 fichiers, détail plus bas), BL-003 et BL-035 (appelants encore présents).** Budget : environ L, consigné (D-333).

## Passe product-owner

1. Étant donné `npm audit --omit=dev`, quand on l'exécute sur la branche, alors 0 alerte (graphe livré). `cargo audit` : non installé sur ce PC, rien installé (à faire en CI ou par Ali).
2. Étant donné une alerte de développement, quand une mise à jour sûre existe (correctif ou mineure, sans changement d'API, sans dépendance nouvelle, lockfile régénéré par npm), alors elle est prise, une par commit ; sinon elle est justifiée ici.
3. Étant donné un test de synchro appuyé sur l'ancien schéma, quand il est migré, alors il garde ses scénarios et ses assertions (même nombre d'`it`/`test` et d'`expect`, vérifié par le script), s'exécute sur la migration réelle et le catalogue de production (base sans table `task`), et passe ; sinon il reste sur le banc legacy, inventorié avec sa raison.
4. Étant donné le banc legacy, quand un fichier n'est pas migré, alors son comportement est inchangé (défaut `legacy` du simulateur conservé).
5. Bundle de départ jamais augmenté ; aucune migration ; aucun test désactivé, supprimé ni affaibli.

## Passe sync-icloud (D-26) — périmètre écrit

Aucun fichier de `src/sync/**`, `src/domain/sync/**`, `src-tauri/src/sync/**` ni `src/**` dans le diff (`git diff --name-only d99e43aa`). Protocole, format, bornes, catalogue, déclencheurs : inchangés. Fichiers touchés :

- `tests/sim/syncDevice.ts` : `selectSimSchema(schema)` (schéma par défaut des appareils d'un fichier, `legacy` par défaut ; vitest isole chaque fichier), `simSchema()`, `I0_SCHEMA_VERSION`, `SimDevice.schema`, `liveTitles()` ; `createTask`/`updateTask`/`deleteTask`/`task`/`taskSnapshot` passent par les entrées simulées hors du banc legacy, chemin legacy identique.
- `tests/sim/syncEntries.ts` (nouveau) : forme « tâche » sur la table publiée `meal_entry` (deux écrivains, ni parent, ni identité naturelle, ni condition de publication) par SQL horodaté (`updated_at`, `device_id`, `hlc`), les déclencheurs de la migration réelle capturant chaque champ. Correspondance : titre = `food_name`, note = `food_id` (vide = NULL), état = `method` (`search`/`quickadd`), date = `date`, heure = `time` (`00:00` = sans heure). Tout autre champ est refusé par une erreur (jamais ignoré).
- `tests/unit/sync/reset/resetKit.ts` : `titles` = `liveTitles` (même requête sur le banc legacy).
- `scripts/cleanup/legacySyncInventory.mjs` : reconnaît le marqueur `selectSimSchema('i0')` comme schéma Spartiate.
- 49 fichiers de test (listes ci-dessous) : une ligne `selectSimSchema('i0')`, `SCHEMA_VERSION` → `I0_SCHEMA_VERSION`, et pour les lots B et C des lectures SQL réécrites par motifs exacts (`task` → `meal_entry`, `title` → `food_name`, `note` → `food_id`, noms de table attendus `task` → `meal_entry`).

Scripts (mécanique, D-51 ; dans `.codex-tmp/lot028/`, hors dépôt) : `tech01-migrate.mjs` (arrêt si le nombre d'`it`/`test` ou d'`expect` change), `tech01-sql.mjs` (jeux `b`, `c` ; arrêt avant écriture si un motif manque). Invariants gardés et preuves : fusion par champ et conflit des deux côtés (`twoDevices`, `simEntries`), horloge de champ hors ligne (`resetQa`), tombstones et purge (`stateRewritesRules`, `resetAdr18`, `forgetSim`), époques et report (`epochCarryGuard`, `epochCarryOptionB`, `epochConcurrent`, `epochCarryForget`, `restore`), reset (`reset/*`), oubli (`forget/*`), reprise après interruption (`resumeCrash`, `crashPoints`, `resetInterrupt`, `forgetInterrupt`), hostile (`hostile/*`), segments clos (`closedSegments*`). Non-régression du banc legacy : `twoDevices`, `resetQa` (avant migration), `resetSim`, `resetAdr18` (avant migration) verts après le changement du simulateur.

| Lot | SHA | Fichiers | Tests exécutés (vitest) | `it`/`test` statiques | `expect` statiques |
| --- | --- | --- | --- | --- | --- |
| A (banc + 29 fichiers) | `0af43855` rouge, `042d7f3a` vert, `98d38021`, `4a74024d` | epochCarryGuard, epochCarryOptionB, epochConcurrent, firstPublicationLoadFailure, forget/forgetRegistry, forget/forgetReplay, hostile/evictedHeadReaders, hostile/mixedOldEpochDeletion, hostile/scenario2CrashBeforeState, hostile/scenario3ReadIo, hostile/scenario5MuteFollowUp, hostile/scenario5MuteTransport, hostile/scenario6EvictedHeadSegment, manualSync, pairing/stateDeletedInflight, reset/resetConcurrent, reset/resetExposure, reset/resetLostClosed, reset/resetMemory, reset/resetMergeNullRow, reset/resetQaDefects, restore, resumeCrash, service, stateRewrites, stateRewritesQa, strayFiles, writeStateAfterSnapshot, yTech02Qa | 135 (+ 3 de `sim/simEntries`) | 98 | 527 |
| B | `7542985e` | closedSegmentsQa, closedSegmentsSim, cycleJournal, epochCarryForget, reset/resetInterrupt, reset/resetQa, stateRewritesRules, twoDevices, conflicts/qaRewriteDuringPublish | 80 | 51 | 290 |
| C | `56b48579` | crashPoints, forget/forgetInterrupt, forget/forgetQa, forget/forgetSecondReview, forget/forgetSim, forget/forgetSnapshotAuthor, hostile/readFailure, positionsQa, reset/resetAdr18, restoreThenForget, yTech02QaFinal | 235 | 85 | 549 |

Comptes de l'inventaire (`node scripts/cleanup/legacySyncInventory.mjs`) : avant 225 fichiers (185 tests, 40 supports) ; après 177 (137 tests, 40 supports). `hostile/evictedHeadReaders` reste compté à tort (variable locale `tasks.push(` prise pour le dépôt `tasks`) alors qu'il est migré.

Restent sur le banc legacy, avec la raison constatée en local : `epochCarry`, `pairing/join`, `pairing/joinInterrupt` (notes de plus de 128 caractères, jusqu'à plus de 256 Kio : borne de `meal_entry.food_id` ; il faut une colonne texte sans borne, `workout.notes` d'une séance close, lot E) ; `reset/resetSim` (table `space`) ; les kits `syncOrphanSession` (`carriedOver`), `epochCarryScenario` (`sortOrder`, colonnes de `task`) et leurs fichiers ; les fichiers qui appellent les dépôts hérités, l'ancien SQL ou `tests/fixtures/legacy-schema` (conflits, versions, purge, `update`, `capsRules`) ; domaine, features et e2e hérités (lot F). Faux positifs de l'inventaire (n'utilisent aucun appareil simulé ni l'ancien schéma) : `src/platform/sync/faultPlan.test.ts`, `hostile/cloudSimDeletions`, `sim/folderSimDeviceWait`, `versions/fixA009Proofs`, `tests/unit/syncCodec*.test.ts`, `syncSeparation`.

BL-003 et BL-035 : **non purgés**, appelants présents. Les méthodes SQL de l'ancien schéma servent encore au banc legacy (177 fichiers). Le cycle `goalRules → week → todayList` reste : `src/domain/week.ts` importe `buildTodayList` et ses types de `todayList.ts`, et `week.ts` est lu en production (`training/progressStats.ts`, `review/weeklyReview.ts`) ; le casser touche du domaine livré, à faire avec le lot F.

## DEP-01

| Paquet | Avant → après | Raison | SHA |
| --- | --- | --- | --- |
| zod (transitif de développement, eslint-plugin-react-hooks) | 4.6.5 → 4.6.7 | GHSA-mrhx-c7xc-m3w5 (élevée) | `d4459000` |
| undici (transitif de développement, jsdom ^8.10.2) | 8.11.2 → 8.13.1 | 8 avis GHSA (élevée), mêmes moteurs node | `114cc7bf` |

Méthode : `npm update <paquet> --package-lock-only --no-audit --no-fund` (lockfile régénéré par npm, `package.json` inchangé, `node_modules` partagé non touché). Tests de ces mises à jour : en CI (vitest et jsdom lisent les `node_modules` partagés, encore aux anciennes versions en local).

Écartées et justifiées :
- **minimatch 10.2.6 (modérée, GHSA-g3hv-75wg-m249, 9 entrées d'`npm audit`)** : correctif à partir de 11.0.1, qui demande eslint 10.15.0 (minimatch ^11.0.5) et typescript-eslint 8.73.0 (mineures). Outils de lint seulement, hors du graphe livré ; non pris car leur vérification demande des `node_modules` réels (consigne du lot : `node_modules` partagé). Proposé en décision.
- Mises à jour non sécuritaires visibles dans `npm outdated` (`@tauri-apps/*`, vite, vitest, recharts, lucide-react, zustand…) : non prises (aucune alerte ; les paquets `@tauri-apps` doivent suivre les crates Rust ; recharts, lucide-react et zustand peuvent changer le bundle ; vérification locale impossible).
- `cargo audit` : non installé ; Cargo.lock non modifié (ni `cargo update`, ni fmt, clippy, cargo test nécessaires).

## Passe qa-test

- Rouge → vert : `0af43855` (C-1 : `tests/unit/sync/sim/simEntries.test.ts`, 3 tests, rouge faute de banc) → `042d7f3a` (vert). Cas limites couverts : base i0 sans aucune table de l'ancien schéma ; fusion de champs différents sans conflit ; suppression propagée ; champ sans équivalent refusé (`sortOrder` à la création, `carriedOver` à la modification).
- Lancé en local (`--coverage.enabled=false --maxWorkers=1`, par lots de 3 à 6 fichiers) : les 49 fichiers migrés et `simEntries` (453 tests), plus 4 fichiers legacy de non-régression ; `npx tsc --noEmit -p .` et eslint sur tous les fichiers touchés : propres.
- Non lancé en local : suite complète, cargo, e2e (CI).

## Passe code-reviewer

Diff relu à froid : 55 fichiers, +489/−91 avant cette fiche. Les fichiers migrés ne changent que par l'en-tête (`selectSimSchema('i0')`), l'import et les motifs SQL listés ; aucune assertion, aucun délai, aucun `skip`. Le chemin legacy du simulateur est le code d'avant, derrière `schema === 'legacy'`. Point d'attention : la correspondance `meal_entry` ne porte ni texte long ni champs d'organisation (projet, ordre, report) ; ces scénarios restent sur le banc legacy plutôt que d'être affaiblis. Verdict : approuvé pour DEP-01 et les lots A à C.

## Mesures

| Mesure | Avant (`d99e43aa`) | Après |
| --- | --- | --- |
| Bundle de départ, normalisé (octets) | 193 878 | 193 878 |
| `npm audit --omit=dev` | 0 | 0 |
| `npm audit` (développement) | 11 (9 modérées, 2 élevées) | 9 modérées (minimatch seul) |

## Décisions proposées (sans numéro)

1. CLEAN-03 : la migration se fait par fichier (`selectSimSchema('i0')`), le défaut `legacy` du simulateur ne bascule qu'au lot F, quand plus aucun fichier ne dépend du banc (révisable par Ali).
2. CLEAN-03 : entrées simulées sur `meal_entry` ; les scénarios à texte long passeront sur une séance close (`workout.notes`, sans borne) dans un lot suivant, sans affaiblir la borne de `food_id`.
3. DEP-01 : eslint 10.15.0 et typescript-eslint 8.73.0 (mineures, correctif minimatch) dans un ticket avec `node_modules` propres, lint complet en CI.
4. DEP-01 : installer `cargo-audit` en CI (`tests.yml`) plutôt que sur ce PC.

## Constats d'Ali à faire

Aucun (rien de visible dans l'app).

## Écarts au brief

- CLEAN-03 partiel : 49 fichiers sur 225, en lots complets ; le reste inventorié ci-dessus. Les lots ne suivent pas le découpage A à F de CLEAN-02 (par famille) mais la dépendance réelle au banc, mesurée par script.
- BL-003, BL-035 : non purgés (appelants).
- `cargo audit` non lancé (non installé). minimatch non corrigé (justifié).
