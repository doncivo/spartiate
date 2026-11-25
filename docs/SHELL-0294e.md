# SHELL-0294e — qualité du code et des tests, recharts retiré, mesure de démarrage (lot 0.29.4)

Lot 0.29.4 (docs/LOT-0.29.2.md, docs/LOT-0.29.2-audit.md), registre « coquille, iOS et qualité », cinquième PR (après SHELL-0294a #216, SHELL-0294b #217, SHELL-0294c, SHELL-0294d #219).
Chapitres : 23.1 (pyramide, budgets), 17.1 (graphiques), 18.5. Choix prudents : D-614 à D-617, « Claude (choix prudent) ; révisable par Ali ». Question : Q-36.
Aucune migration, aucun fichier de `src/sync/**`, `src-tauri/src/sync/**` ni Swift touché ; aucun test désactivé, aucun délai allongé.

## Passe product-owner (critères)

1. BL-116 : `recharts` n'est ni déclaré (package.json, verrou) ni crédité (écran Licences, licences.md, avis tiers).
2. BL-137, BL-167 (fusionnées) : la mesure de démarrage juge la médiane de plusieurs chargements après un premier jeté ; budgets 1 500 / 2 000 ms inchangés.
3. C-163 : dans l'app installée, un système resté « other » est noté au journal (`os-unknown`) au lieu de masquer sans trace la synchro et les sauvegardes.
4. C-084 : « 0 groupe » (singulier français, jamais « 0 groupes »).
5. BL-100, BL-105, C-176 (en partie) : valeurs exactes à la place de bornes lâches.
6. BL-145 : les tests de `src` suivent les couches de leur code (ADR 0001), exceptions nommées.
7. BL-042 : retrait de ce qui est sûrement mort. C-167 : « graphiques < 300 ms » gardé.

## Passe agent du module (coquille et qualité)

Fichiers : `package.json`, `package-lock.json` (`npm uninstall --package-lock-only`, node_modules partagé non touché), `docs/licences.md`, `public/THIRD-PARTY-NOTICES.txt` (régénéré par `third-party-notices.mjs --write`, `--check` vert),
`src/i18n/fr.licenses.ts`, `src/features/settings/LicensesScreen.{tsx,css}`, `src/platform/{runtime,index}.ts`, `src/features/app/bootstrap.ts`, `src/features/strength/{groupCount.ts,StrengthScore.tsx}`,
`tests/e2e/perf-start.spec.ts`, `tests/e2e/helpers/perfStart.ts`, six tests déplacés, `src/db/index.ts` retiré.

## Passe qa-test (rouge → vert)

| Ligne | SHA rouge | SHA vert |
|---|---|---|
| BL-116 | c20cb885 (1 rouge sur 4 ; l'expression régulière du dernier contrôle y était mal écrite, corrigée au vert) | 5dc91077 |
| C-163 | 43740971 (2 rouges sur 4 : plateforme de repli et `osUnknownInApp` absents), puis 3da9a74f (rouge : `openLogJournal` n'écrit pas `os-unknown` ; ce commit remet aussi `bootstrap.ts` et `platform/index.ts` d'avant : le journal du démarrage ajoutait 21 octets au départ) | 9102b722 (première version, abandonnée), 0e725a4f, puis le commit du retour de `detectOs` à l'original (repli sur `navigator.platform` : +14 octets de départ) |
| C-084 | 02525421 (rouge à l'import : module absent) | 316ac2c2 |
| BL-137, BL-167 | dc4ef679 (rouge à l'import : `perfStart` absent) | d842a31a (e2e non lancé ici : CI) |
| BL-145 | d137c5e0 (13 fichiers hors couches) | 9ff7d2eb |
| BL-100 | 3793989c, test seul (aucun rouge : les anciens tests passaient) | écart consigné |
| BL-105 | 2d5b7408, test seul | écart consigné |
| BL-042 | dbe67595 (retrait du barrel `src/db/index.ts`), rétabli ensuite : `docs-paths.test.ts` refuse les chemins cités par SPA-001 et decisions.md | écart consigné |
| C-167 | d1684372, test seul (budget déjà tenu, aucune régression à montrer) | écart consigné |

Écarts à « rouge avant vert » : BL-100, BL-105, BL-042, C-167 sont des lignes de test ou de retrait sans comportement nouveau ; un commit suffit (consigne du ticket).

## Ce qui est fait, par ligne

- **BL-116** : `recharts` et ses dix-sept dépendances transitives retirés du verrou. L'écran « Licences » ne cite plus Recharts ni d3-ease (l'avis BSD en pied d'écran, dont le test lisait `node_modules/d3-ease/LICENSE`, disparaît avec le paquet). Les ADR 0001 et 0009 gardent leur texte d'époque.
- **BL-137, BL-167** : analyse. Les mesures vues (1 512, 1 576, 1 683 ms PC ; 2 183 ms iPhone) viennent de runs sans changement du départ : une mesure unique mêle le bruit du runner (premier chargement du navigateur, du serveur de prévisualisation, de l'ordonnanceur) et la dérive réelle. Le premier cas du projet `perf` était aussi le premier chargement du navigateur. Nouvelle mesure (D-615) : contexte neuf par chargement (la base reste vide, la migration du premier lancement est mesurée), un chargement jeté, médiane de cinq. Une dérive réelle relève la médiane et échoue toujours ; le budget n'est pas touché. Non prouvé ici : à confirmer sur un run de la CI.
- **C-163** : `detectOs` inchangé (un repli sur `navigator.platform` fait grossir le départ de 14 à 24 octets, D-616) ; l'entrée `app` / `os-unknown` est écrite par `openLogJournal` (bloc à la demande, journal de session seule quand le système est inconnu) (D-616, Q-36).
- **C-084** : « 0 groupe » (`groupCountKey`, `Intl.PluralRules`). Reste : vocabulaire (Variée, décharge, Ischios, à arrêter avec Ali) et nombres sans séparateur.
- **BL-100** : le test C-108 lit la liste `WIPED` dans `ResetDataScreen.tsx`, vérifie l'égalité avec les clés du catalogue et le mot clé précis de chaque table dans sa famille.
- **BL-105** : valeurs exactes de la dépense lissée et brute (semaines 3, 4 et 7) ; déterminisme de `testsFiges` sans horloge (horloge simulée à deux dates). Reste : la garde avant `readPrefs` de `SupplementsView` sans cas.
- **BL-145** : garde `tests/unit/testLayers.test.ts` ; six tests déplacés (`serializedDriver.a008` → features/app, `injuryKinds` → features/notifications, `moteur0281a`, `prescribe.i408`, `prescribe.review` → features/training, `fixExport.limits` → features/settings). Exceptions : `domain/sync/compat`, `domain/sync/devices`, `domain/syncBanners`, `domain/sync/epochCarryReport` (relecture sync-icloud), `i18n/plural` (balaie son dossier).
- **BL-042** : un script d'atteignabilité (graphe d'imports depuis `main.tsx`, les configurations et les scripts de release) trouve 29 modules de `src` sans importeur de production : un seul n'a aucun importeur du tout, le barrel `src/db/index.ts`, rétabli (cité par SPA-001 et decisions.md, `docs-paths.test.ts`). Les 28 autres : code CircleTasks hérité (CLEAN-03 : `csvImport`, `taskRules`, `projectRules`…), kits de test (`testing.ts`, `testKit`), `muscleGroupLabel.ts` (prévu par BL-142, à brancher). Aucun fichier de `src/sync`.
- **C-167** : « graphiques < 300 ms » gardé par `src/domain/training/chartData.perf.test.ts` (séries sur trois ans, `npm run test:perf`) ; « génération < 1 s » l'était déjà (`generateSession.test.ts`) ; démarrage : BL-137.

## Ce qui reste (et pourquoi)

- **A-004, BL-044** : relevé, rien changé. Les `test.skip` des e2e filtrent par projet (pc ou iphone) pour ne lancer un scénario qu'une fois ; `waitForTimeout(1500)` de `lot-f-qa.spec.ts` et `P-04.spec.ts` attendent l'ABSENCE d'un redémarrage (aucun signal à attendre) ; les cinq `waitForTimeout` de `tests/visual/capture.spec.ts` (300 à 500 ms) laissent finir une animation ; `timeout: 10_000` de `App.test.tsx` et `logsUnavailable.test.tsx` sont des plafonds d'attente sur signal, pas des pauses. Les remplacer par un signal exige les e2e, jamais lancés ici. Couverture par module : à établir par la CI (rapport fusionné).
- **C-176** : « tests qui se recalculent avec le code » non recensés un à un (BL-100 et BL-105 faits).
- **C-076, C-085** : non traités (unités et séparateurs touchent cinq catalogues ; `fr.routines` partagé avec le module séance).
- **BL-145** : cinq exceptions. **BL-042** : 29 modules (voir plus haut).

## Mesure du bundle de départ

Mesures normalisées du même poste (build du 25/11) : **origin/main 180 702** (brut 180 711 ; worktree de comparaison, retiré). Première version de la branche 180 742 (+40 : `detectOs` à repli sur `navigator.platform` et journal `os-unknown` dans `bootstrap.ts`) ; variantes 180 758, 180 759 (gzip : une expression plus courte n'est pas plus petite), 180 737 sans le journal du départ, 180 726 avec le journal déplacé dans `openLogJournal` (bloc à la demande) et le repli, 180 716 avec un repli plus court. **Version finale : `detectOs` d'origine et journal dans `openLogJournal` : 180 702 (brut 180 697), soit ±0 contre main** ; le repli sur `navigator.platform` est renvoyé à Q-36. Aucun module ajouté à `tests/bundle/start-modules.json` ; `startBundle.test.ts` vert (174 réussis).

## Vérifications

`npm run typecheck` propre ; eslint propre sur les fichiers touchés ; Vitest ciblés verts (`LicensesScreen`, `licences`, `third-party-notices` `--check`, `runtime`, `osUnknown`, `groupCount`, `StrengthScore`, `fixExport.texts`, `eightWeeks`, `testsFiges`, `testLayers`, les six tests déplacés, `startMeasure`, `chartData.perf` par `vitest.perf.config.ts`) ; gardes documentaires (`docs-paths`, `agents`, `backlogCount`, `privacy`, `identity`). Non lancés ici : e2e (dont la nouvelle mesure de démarrage), visual, perf Playwright, Rust (aucun fichier Rust touché).
