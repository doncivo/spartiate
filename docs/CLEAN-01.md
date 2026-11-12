# CLEAN-01 — Suppression des résidus de CircleTasks (0.17.0)

Taille : L | Version : 0.17.0 (PC `v0.17.0`, iPhone `ios-v0.17.0`) | Schéma : 13, **sans migration**
Chapitres : 9 (tables publiées, rien de modifié), 18 (écrans, rien de modifié), 24 (modules supprimés en SPA-001b). Décisions : D-116 à D-118 (choix prudents, révisables par Ali).
Aucune donnée réelle lue ni écrite (D-38). Aucun chemin de synchro touché (`src/sync`, `src/domain/sync`, `src-tauri/src/sync` : zéro ligne du diff) : pas de passe sync-icloud (D-26). Aucun Rust, Swift, capability, migration, table SQLite ni dépendance modifiés.

## Méthode (D-50, D-51 : mécanique par script)

1. `scripts/cleanup/reachability.mjs` : graphe d'imports (statiques, `import()`, `new URL(..., import.meta.url)`, `@import` CSS, `import.meta.glob`) de `src`, `tests`, `scripts` depuis les racines vivantes `src/main.tsx`, `src/features/sync/pairing-window/main.tsx` (page `pairing.html`) et `vite.ocrAssets.ts`. Les tests ne sont jamais des racines.
2. `scripts/cleanup/symbols.mjs` : atteignabilité par symboles (AST TypeScript) : un fichier n'est vivant que si un nom effectivement lu par du code vivant y mène ; les déclarations non lues sont mortes ; barrels et `export *` suivis. Sur-approximation (noms d'identifiants) : en cas de doute, vivant.
3. `scripts/cleanup/plan.mjs` : un fichier mort n'est supprimable que si aucun test « vivant » (test qui importe aussi du code vivant et n'est pas le test du fichier) ne l'importe ; `apply.mjs` supprime par lot, retire les lignes de barrel et les entrées de `start-modules.json` ; `restore-missing.mjs` restaure depuis `origin/main` tout fichier que du code conservé importe encore (tsc comme juge, 18 puis 7 fichiers restaurés).
4. i18n : `i18nKeys.mjs` (clés `fr.ts` aplaties, référence par chaîne littérale ou préfixe dynamique), `i18nDrop.mjs`, `orphanCatalogs.mjs`. CSS : `cssClasses.mjs`, `cssTokens.mjs`.

## Passes

Les quatre passes ont été lancées comme sous-agents de `.claude/agents` ; leurs rapports sont reproduits en fin de fiche (« Résultats des relectures »). Preuve rouge → vert : ticket de suppression, la preuve est que `tsc --noEmit` (juge des imports) et les tests de garde restent verts après chaque lot, et que chaque suppression a été précédée de l'inventaire par script ; aucun test n'a été ajouté, désactivé, allongé ou assoupli.

## Ce qui est supprimé (par famille, en chiffres)

238 fichiers supprimés au total (dont 90 fichiers de test, supprimés avec le seul code qu'ils testaient), 21 600 lignes retirées. Correction après la revue architect : une première version supprimait aussi 32 tests de modules qui restent (règle trop large de reachability.mjs) ;  les a restaurés quand tous leurs imports existent encore (27 restaurés, 5 retirés de nouveau car ils testaient un dépôt supprimé).

| Lot (commit) | Famille | Supprimé | Bundle de départ (octets gzip, mesure normalisée) |
| --- | --- | --- | --- |
| avant | — | — | 209 328 |
| 1 | ui / CSS | 71 fichiers de composants, hooks, catalogues et CSS (ActionMenu, Checkbox, DatePicker, EmojiPicker, SwipeRow, useSortable, etc.), 29 tests, 12 jetons de couleur `--ct-*` sans lecteur, `rowGestureFeedback` | 209 324 |
| 2 | db / repositories, domaine, platform | dépôts hérités sans appelant (événements, jours fériés, Focus, recherche, statistiques, calendriers externes, liens Rappels Apple : interface, SQL, 17 tests de dépôt), 64 modules de domaine (tâches, projets, espaces, événements, récurrences, rappels, Focus, recherche, import CSV, etc.) et leurs tests | 203 705 |
| 3 | i18n | 19 groupes de textes de fr.ts retirés (espaces, Focus, statistiques, calendriers, rappels Apple, récurrence, listes, objectifs, recherche, Quelque jour, gestes, vide, semaine, aujourd'hui, icônes, sélecteur de date, corbeille, terminé, rapport) et 11 catalogues `fr.*.ts` orphelins : 2 698 → 1 799 clés | 193 544 |
| 4 | scripts, docs | `scripts/generate-focus-chime.mjs`, paragraphe de licence du carillon Focus (fichier inexistant) | 193 544 (inchangé) |

Bundle de départ : **209 328 → 193 544 octets gzip** (marge sous le plafond 358 400 : 164 856). `start-modules.json` : uniquement des retraits (7 entrées de modules supprimés), aucun ajout. Mesure faite en local par `vite build --manifest` puis `node tests/bundle/measureStart.ts` (le build fonctionne dans ce worktree) ; le plafond et la garde BUNDLE-01 sont tranchés par la CI.

## Ce qui est conservé, et pourquoi

Voir D-116 à D-118. Inventaire complet des fichiers morts au sens du graphe qui restent, avec la raison (sortie de `plan.mjs`) :

#### db / repositories (3)

- `src/db/index.ts` : conservé
- `src/db/repositories/sql/testSetup.ts` : importé par le test vivant src/db/localWrite.test.ts
- `src/db/seed/sampleData.ts` : importé par le test vivant src/db/repositories/sql/taskRepository.done.test.ts

#### domaine (31)

- `src/domain/chronoAbsolute.ts` : importé par le test vivant src/domain/quickInputEdge.test.ts
- `src/domain/csvImport.ts` : importé par le test vivant src/domain/csvImportHardening.test.ts
- `src/domain/dateInput.ts` : importé par le test vivant src/domain/timeFormat.test.ts
- `src/domain/donePeriod.ts` : importé par le test vivant src/db/repositories/sql/taskRepository.done.test.ts
- `src/domain/eventKinds.ts` : conservé
- `src/domain/eventOccurrences.ts` : conservé
- `src/domain/eventReminders.ts` : conservé
- `src/domain/eventRules.ts` : conservé
- `src/domain/eventTestKit.ts` : importé par le test vivant src/domain/notificationPlan.qa.test.ts
- `src/domain/goalRules.ts` : requis par src/domain/todayList.ts (conservé)
- `src/domain/historyExport.ts` : requis par src/domain/csvImport.ts (conservé)
- `src/domain/itemFilter.ts` : requis par src/domain/historyExport.ts (conservé)
- `src/domain/naturalDate.ts` : importé par le test vivant src/domain/quickInputEdge.test.ts
- `src/domain/notificationStatus.ts` : importé par le test vivant src/domain/notificationLedger.test.ts
- `src/domain/projectRules.ts` : requis par src/domain/itemFilter.ts (conservé)
- `src/domain/quickInput.ts` : importé par le test vivant src/domain/quickInputEdge.test.ts
- `src/domain/quietHours.ts` : importé par le test vivant src/domain/notificationPlan.qa.test.ts
- `src/domain/recap.ts` : importé par le test vivant src/domain/notificationPlan.qa.test.ts
- `src/domain/recurrenceNext.ts` : conservé
- `src/domain/recurrenceRules.ts` : conservé
- `src/domain/routineReport.ts` : importé par le test vivant src/domain/routineStats.perf.test.ts
- `src/domain/routineSchedule.ts` : requis par src/domain/routineStreaks.ts (conservé)
- `src/domain/routineStreaks.ts` : importé par le test vivant src/domain/routineStats.perf.test.ts
- `src/domain/routineTestKit.ts` : importé par le test vivant src/domain/notificationPlan.qa.test.ts
- `src/domain/spaceRules.ts` : requis par src/domain/todayList.ts (conservé)
- `src/domain/sync/repairs.ts` : importé par le test vivant src/domain/sync/catalogue.test.ts
- `src/domain/taskPostpone.ts` : requis par src/domain/dateInput.ts (conservé)
- `src/domain/taskRules.ts` : requis par src/domain/csvImport.ts (conservé)
- `src/domain/taskSchedule.ts` : importé par le test vivant src/domain/week.test.ts
- `src/domain/taskTrash.ts` : conservé
- `src/domain/todayList.ts` : requis par src/domain/routineSchedule.ts (conservé)

#### features (2)

- `src/features/signing/testKit.ts` : importé par le test vivant src/features/security/AppLockGate.test.tsx
- `src/features/sync/testKit.ts` : importé par le test vivant src/features/security/AppLockGate.test.tsx

#### platform (12)

- `src/platform/barcode/testing.ts` : importé par le test vivant src/features/nutrition/scan/scanBarcode.test.ts
- `src/platform/desktop/testing.ts` : importé par le test vivant src/features/app/desktop.test.tsx
- `src/platform/notifications/fakeActions.ts` : importé par le test vivant src/platform/notifications/actions.test.ts
- `src/platform/notifications/fakeBridge.ts` : importé par le test vivant src/platform/notifications/tauriNotifications.test.ts
- `src/platform/ocr/index.ts` : conservé
- `src/platform/ocr/nativeOcr.ts` : conservé
- `src/platform/ocr/tesseractOcr.ts` : conservé
- `src/platform/ocr/testing.ts` : conservé
- `src/platform/ocr/types.ts` : conservé
- `src/platform/off/testing.ts` : importé par le test vivant src/features/nutrition/search/offLookup.test.ts
- `src/platform/speech/testing.ts` : importé par le test vivant src/platform/speech/speech.test.ts
- `src/platform/systemSettings/testing.ts` : importé par le test vivant src/features/nutrition/search/OffSearch.test.tsx

#### ui / CSS (3)

- `src/ui/ListSkeleton.css` : requis par src/ui/ListSkeleton.tsx (conservé)
- `src/ui/ListSkeleton.tsx` : importé par le test vivant src/ui/StatusBanner.test.tsx
- `src/ui/Skeleton.css` : requis par src/ui/ListSkeleton.tsx (conservé)

#### Exports sans lecteur dans des fichiers vivants (inventaire seulement, rien supprimé)

- db / repositories : 55 noms dans 28 fichiers
- domaine : 608 noms dans 118 fichiers
- features : 238 noms dans 94 fichiers
- i18n : 34 noms dans 17 fichiers
- platform : 80 noms dans 33 fichiers
- autre : 65 noms dans 14 fichiers
- ui / CSS : 21 noms dans 15 fichiers

#### Tests conservés qui s'appuient sur des fichiers « morts »

227 tests importent à la fois du code vivant et un de ces fichiers (banc de synchro `tests/unit/sync`, `tests/sim`, tests de dépôts legacy `src/db/repositories/sql/*`, tests du planificateur de notifications, tests de composants qui lisent des kits) : conservés (D-116), non listés un par un ; la liste se régénère par `node scripts/cleanup/symbols.mjs --json x.json` (champ `mixedTests`).

### Autres familles

- **Tables SQLite héritées inutilisées** : aucune table CircleTasks dans le schéma de production (`src/db/migrations`, 13 versions). Les tables `task`, `project`, `space`, `event`, `focus_session`, `checklist`, `goal`, etc. n'existent que dans `tests/fixtures/legacy-schema` (banc de test). Aucune table, migration ni champ publié modifié.
- **i18n** : 754 clés isolées sans lecteur littéral restent dans des groupes encore lus ailleurs (événements 118, routines 103, tâches 91, rappels 89, scan 88, import CSV 76, capture 56, détail 34, raccourcis 42, apparence 19, etc.) : conservées (lecture par préfixe ou par table possible, groupes cités par des gardes) ; inventaire : `node scripts/cleanup/i18nKeys.mjs`.
- **CSS** : 19 classes jamais citées (sous-chaîne) dans 10 fichiers CSS vivants ; sur-approximation (pseudo-états, classes composées) : rien supprimé. Jetons de couleur : 12 supprimés ; les autres sont figés par les tests de contraste (D-117).
- **Scripts** : seul `generate-focus-chime.mjs` était mort ; `make-ocr-fixtures.mjs` reste (fixtures lues par les tests Rust).
- **Docs vivantes** : `docs/licences.md` (carillon Focus) nettoyé ; les fiches de tickets et ADR citent des fichiers supprimés comme historique, `docs/prd/`, `docs/decisions.md` (hors ajout D-116 à D-118) et `docs/adr/` ne sont pas modifiés.
- **Dépendances** : `tesseract.js`, `@tesseract.js-data/fra`, `chrono-node` conservés (D-117).

## Contrôles locaux

`tsc --noEmit` propre (après chaque lot) ; `eslint .` propre ; Vitest ciblé : `src/ui`, `src/db` (77 fichiers, 652 tests), `src/domain` et `tests/unit/sync` et `tests/sim` (162 fichiers, 2 698 tests), `src/i18n` (19 fichiers), `src/features/app`, `settings`, `nutrition` ; gardes `identity`, `agents`, `docs-paths`, `prd-split`, `rename` (78 tests) et `startModules` / `bundleMeasure`. **Non lancés en local** : e2e, visual, smoke, `cargo test`, compilation iPhone, suite complète (CI).

## Résultats des relectures

**architect (sous-agent, lecture seule)** : verdict « à corriger » sur un seul point, les tests supprimés dont le module reste (corrigé : 27 tests restaurés, voir plus haut) ; couches ADR 0001, dépendances, natif, migrations : rien de suspect ; conservations cohérentes avec les gardes. Question posée sur l'export / import et l'application des journaux sans les dépôts retirés : aucune table de production concernée (les tables n'existent que dans le banc legacy), tsc et les tests db / sync verts.

**code-reviewer (sous-agent)** : approuvé sous réserve, aucun bloquant ; usages dynamiques de clés i18n et de jetons vérifiés ; trois commentaires orphelins signalés, corrigés (`dataAccess.ts`, `undo.ts`, `tokens.css`). Recherche d'imports dans les fichiers non typés non terminée par l'agent : couverte par `restore-missing.mjs` / `tsc` et par la recherche du qa-test (aucun `.mjs` ni e2e n'importe un fichier supprimé).

**qa-test (sous-agent)** : recherche statique des tests e2e, visual, smoke : aucun import ni data-testid vers un fichier supprimé ; seule trace, le helper e2e inutilisé `taskRow` (classe `.ct-list-row`), sans appelant, laissé. Risque faible à confirmer en CI : specs qui ouvrent Réglages (groupes de textes retirés). Son Vitest ciblé n'était pas terminé au rapport ; relancé ici (voir contrôles locaux).

**product-owner (sous-agent)** : critères Given / When / Then fixés (aucune fonction du PRD retirée ; migrations, tables, plugins, capabilities, champs synchronisés intacts ; bundle ≤ 358 400 sans ajout à la liste blanche ; gardes verts ; ni `docs/prd/` ni `docs/adr/` modifiés). N'a pas pu exécuter git : la vérification du diff est faite ici (aucun chemin de synchro, Rust, Swift, migration ni PRD dans le diff).

**Limites honnêtes** : e2e, visual, smoke, cargo, compilation iPhone et suite complète non lancés (CI). Après restauration des tests : Vitest `src/domain`, `src/ui`, `src/db/repositories` : 237 fichiers, 3 039 tests verts ; `eslint .` et `tsc --noEmit` propres. Les sous-agents ont rendu des rapports partiels (ils n'avaient pas fini leurs contrôles) : relecture de la PR par Ali recommandée.
