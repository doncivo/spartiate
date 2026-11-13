# CLEAN-02 — Second nettoyage (0.19.1)

Taille : M (budget 150 k tokens) | Version : 0.19.1 (PC `v0.19.1`, iPhone `ios-v0.19.1`) | Schéma : 15, **sans migration**
Décision d'Ali du 12 novembre 2026 (D-119 : D-116 et D-117 révisées, second nettoyage). Décisions du ticket : D-200 (ce qui part, ce qui reste), D-201 (point d'étape de budget, migration des tests de synchro reportée).
Chapitres : 3 (pile), 17.4 (import de programme), 19 (plugins Swift), 22 (dépendances). Aucune donnée réelle lue ni écrite (D-38). Aucune migration, table de production, Rust, Swift, capability ni chemin de synchro touché.

## Statut

**Livré : lot 1 (dépendances et repli OCR) et mesures.** **Point d'étape : lot 2 (migration des tests de synchro hors du banc legacy) non commencé**, reporté à un ticket CLEAN-03 de taille L (D-201) : l'inventaire par script compte 222 fichiers, hors budget M. Rien de ce lot n'a été supprimé ni modifié : les dépôts hérités, leur SQL, le domaine appelé et `tests/fixtures/legacy-schema` restent (D-116 vaut encore pour cette partie).

## Passe product-owner

Critères (Given / When / Then) :

1. Étant donné le dépôt, quand on cherche `tesseract`, `chrono-node`, `ocrAssets` dans `package.json`, `package-lock.json`, `vite.config.ts` et `src`, alors il n'en reste aucune trace exécutable ; `package-lock.json` est régénéré par `npm uninstall`.
2. Étant donné un appareil (PC, iPhone, navigateur), quand l'app ouvre les moteurs de lecture de texte, alors seul le moteur natif est proposé (`fallback: null`) : test `nativeOcr.test.ts`, rouge `f696842a`, vert `b54b8759`.
3. Étant donné le plugin `vision`, quand on vérifie s'il sert, alors il est gardé si le PRD le destine à une fonction de Spartiate, et la raison est écrite (D-200).
4. Étant donné les tests de synchro appuyés sur CircleTasks, quand ils sont migrés, alors chaque scénario a son équivalent (tableau) avant toute suppression de dépôt ; sinon rien n'est supprimé (D-201).
5. Bundle de départ ≤ 358 400 octets gzip, liste blanche inchangée ou réduite ; taille de l'installeur mesurée avant et après.
6. Aucune fonction du PRD retirée ; `docs/prd/` et `docs/adr/` non modifiés.

Hypothèses H-n : aucune touchée. Hors périmètre : PRD § 19 (ligne `vision`), CSP, Rust, Swift.

## Passe architect

- **Dépendances retirées** (`npm uninstall tesseract.js @tesseract.js-data/fra chrono-node`, 15 paquets retirés de `node_modules`, `package-lock.json` régénéré par npm : −132 lignes) : `tesseract.js` 7.0.0, `tesseract.js-core` (transitif), `@tesseract.js-data/fra` 1.0.0, `chrono-node` 2.10.
- **Chaîne de build** : plugin Vite `vite.ocrAssets.ts` retiré de `vite.config.ts` ; plus de dossier `dist/ocr/` (worker 111 Ko, noyau WebAssembly 3,9 Mo, données `fra` 0,7 Mo). Racines des scripts `scripts/cleanup/reachability.mjs` et `symbols.mjs` mises à jour.
- **Code retiré** : `src/platform/ocr/tesseractOcr.ts` et son test ; saisie rapide héritée de CircleTasks sans appelant de production : `src/domain/quickInput.ts`, `naturalDate.ts`, `chronoAbsolute.ts` et leurs trois tests (`quickInput.test.ts`, `quickInputEdge.test.ts`, `naturalDate.test.ts`). `OcrEngineId` perd `'tesseract'`. `tsc --noEmit` comme juge : propre.
- **Conservé, et pourquoi (D-200)** : la lecture native (`src-tauri/plugins/vision`, `src-tauri/src/ocr`, commandes `ocr_status` / `ocr_recognize`, Windows.Media.Ocr, `src/platform/ocr/nativeOcr.ts`, `types.ts`, `testing.ts`, `index.ts`, capabilities `ocr.json` et `capture-ios.json`, `tests/fixtures/ocr` et `scripts/make-ocr-fixtures.mjs` lus par `src-tauri/tests/desktop/ocr.rs` et `ocr_vision.rs`). Le graphe d'imports montre qu'aucun écran ne l'appelle aujourd'hui, mais le PRD (§ 19 « OCR d'un programme papier (I6) », § 17.4, D-33) et la fiche I6-06 la destinent à l'import de programme : la retirer modifierait le PRD, ce qui demande une décision d'Ali. `CLAUDE.md` (liste des plugins Swift) reste donc juste et n'est pas modifié. `src/domain/dateInput.ts` reste (`parseTimeInput`, lu par `timeFormat.test.ts` et `formatPrefs.qa.test.ts`). La règle ESLint qui refuse l'import statique de `chronoAbsolute` et son test (`tests/unit/eslintGuards.test.ts`) restent : une garde n'est pas affaiblie, elle est seulement sans objet.
- **Restes signalés, non traités** : la CSP garde `'wasm-unsafe-eval'` (`src-tauri/tauri.conf.json`) ; elle pouvait servir au noyau WebAssembly de tesseract, mais son retrait relève de security-privacy et d'un essai sur appareil (autre usage WebAssembly possible) : à trancher dans un ticket dédié.
- Couches ADR 0001 : rien de nouveau ; aucun Cargo, aucune capability, aucun Info.plist touché (le plugin Swift n'est pas retiré : pas de passe ios-mobile).

## Passe sync-icloud (D-26)

Périmètre écrit : **aucun fichier de `src/sync/**`, `src/domain/sync/**`, `src-tauri/src/sync/**`, `tests/unit/sync/**`, `tests/sim/**` ni `tests/fixtures/legacy-schema/**` n'est dans le diff** (`git diff --name-only origin/main...HEAD`, vérifié). Invariants (protocole chiffré, HLC par champ, tombstones, reprise, reset, oubli d'appareil) intacts. Comptes figés de déclencheurs et de tables (TS et Rust) inchangés : rien supprimé.

Lot 2, inventaire (`node scripts/cleanup/legacySyncInventory.mjs`, sur-approximation : `routines` désigne aussi la table Spartiate `routine`) : 222 fichiers, 183 tests et 39 supports ; `tests/unit/sync` 61 et sous-dossiers `hostile` 13, `conflicts` 12, `reset` 12, `pairing` 9, `versions` 9, `forget` 8, `i0` 1, `sim` 1 ; `src/db/repositories/sql` 15, `src/domain` 17, `src/domain/sync` 6, `src/features/**` 19, `tests/unit/update` 6, `tests/sim` 5, e2e 7. Entités appelées : `tasks` 51 fichiers, `routines` 16, `reminders` 16, `projects` 13, `spaces` 5, `goals` 5, `checklists` 3, `routineLogs` 3, `recurrences` 2, `checklistItems` 2. Le simulateur (`tests/sim/syncDevice.ts`) prend `legacy` par défaut : tout test qui n'indique pas de schéma passe par le banc.

**Tableau d'équivalence : vide, aucun test migré.** Découpage proposé pour CLEAN-03 (L, une passe sync-icloud par lot, un commit par lot, tableau test d'origine → test migré → scénario) :

| Lot | Contenu | Entités Spartiate de remplacement |
| --- | --- | --- |
| A | Simulateur : schéma par défaut `i0` courant (`SCHEMA_CATALOGUES`), assistants de création d'entités publiées | `body_weight`, `routine`, `food_favorite`, `profile` (singleton) |
| B | Conflits, époques, suppressions, tombstones (`conflicts`, `epochCarry*`, `deletions`, `purge*`) | `body_weight` (identité naturelle), `routine` / `routine_exercise` |
| C | Reset, oubli, appairage, restauration (`reset`, `forget`, `pairing`, `restore*`) | idem |
| D | Ancien schéma et versions (`versions`, `tests/unit/update`) : remplacer l'ancien schéma CircleTasks par les schémas Spartiate 3 à 14 (`v3` … `v14` déjà dans le simulateur) | toutes les tables publiées |
| E | Outbox, publication, hostile, positions | `workout` clos, `food_favorite` |
| F | Suppression des dépôts hérités, de leur SQL, du domaine appelé et de `tests/fixtures/legacy-schema`, une fois A à E verts en CI | — |

## Passe qa-test

- Preuve rouge → vert : `f696842a` (3 tests rouges : `openOcrService` attend `fallback: null`), `b54b8759` (vert). Pour le reste (suppressions), le juge est `tsc --noEmit` et la suite ciblée verte ; aucun test désactivé, allongé ni affaibli ; trois tests supprimés avec le seul code qu'ils testaient, un test supprimé avec le repli (`tesseractOcr.test.ts`).
- Lancé en local (`--coverage.enabled=false --maxWorkers=1`) : `src/platform` (dont `capture.ios.consistency`, `lotM.consistency`), `src/domain/timeFormat*.test.ts`, `dateInput`, `formatPrefs.qa`, `tests/unit/eslintGuards`, `tests/bundle/bundleMeasure`, `startModules`, `scripts/ios` : 68 fichiers, 890 tests verts ; `npm run test:bundle` : 4 fichiers, 127 tests verts ; cinq gardes documentaires (78 tests) ; `npm run typecheck`, `eslint .` propres.
- **Non lancé en local** : `cargo test` (aucun Rust modifié), e2e, visual, smoke, suite complète (CI), compilation iPhone (aucun Swift).

## Mesures

| Mesure | Avant (main `f9b99c0f`) | Après |
| --- | --- | --- |
| Bundle de départ (octets gzip, normalisée) | 194 871 | 194 871 (aucun module de départ touché ; marge 163 529) |
| Sortie `vite build` (octets) | 18 011 656 | 13 293 471 (−4 718 185, dossier `ocr/` retiré) |
| Installeur Windows (artefact `Spartiate-windows`) | 6 081 323 (run 43344970372, `v0.18.2`) ; `Spartiate_0.18.2_x64-setup.exe` : 6 096 579 | voir ci-dessous |

Installeur après : build manuel `build-windows.yml` sur la branche (run 43352270542, non signé, sans publication) ; valeur relevée en fin de ticket.

## Passe code-reviewer

Diff relu à froid (`git diff origin/main...HEAD`) : 21 fichiers, +74 / −1 723 avant la documentation. `openOcrService` : la branche du faux moteur (e2e) est inchangée, le service réel renvoie `fallback: null` et un `dispose` sans effet ; aucun appelant de production (graphe d'imports). Commentaires retouchés seulement là où ils décrivaient le repli retiré (`types.ts`, `index.ts`, `dateInput.ts`, `startBundle.test.ts` : commentaires, aucune assertion). `docs/licences.md` : sections chrono-node et tesseract remplacées par une ligne de retrait. Pas de `docs/prd/` ni `docs/adr/` modifié. Verdict : approuvé pour le lot 1 ; lot 2 non livré, consigné (D-201). À vérifier en CI : e2e qui ouvriraient la lecture de texte (aucune référence trouvée à `/ocr/` ni à `tesseract` dans `tests/e2e`).
