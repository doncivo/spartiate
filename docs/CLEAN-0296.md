# CLEAN-0296 — `--check` des icônes par la suite, traducteurs typés par `catalogText` (lot 0.29.6)

Statut : **fait en partie** (C-085 : 24 restes nommés ; § 18.4 b et BL-044 faits), PR #226, run 45745432439 vert, branche `CLEAN-0296` depuis `origin/main` `7f1885f2`. Module « coquille, iOS et qualité ». Budget annoncé : M (150 k).
Lignes du registre : § 18.4 b, C-085 ; BL-044 (lecture de la couverture par module, si lisible). Chapitres PRD : 18 (§ 18.4, textes et
icône), 23 (qualité et tests). Choix prudents : D-643 et suivantes, « Claude (choix prudent) ; révisable par Ali ». Aucune question.
Aucun fichier de `src/sync/**`, `src/domain/sync/**`, `src-tauri/src/sync/**` ni `src/platform/sync/**` touché ; aucune migration ;
aucun test désactivé, allongé ni retardé. Fixtures synthétiques uniquement (D-292).

## Passe product-owner : critères (étant donné / quand / alors)

1. **§ 18.4 b** : étant donné les icônes suivies de `src-tauri/icons`, quand la suite Vitest node tourne (CI comprise), alors
   `node scripts/release/generate-icons.mjs --check` est lancé et réussit ; étant donné une copie de ces icônes dont une est retouchée à
   la main (fichier temporaire sous `.codex-tmp/`, désigné par `--target`), alors `--check` échoue (code 1) et nomme le fichier.
2. **C-085** : étant donné les traducteurs `*Text.ts` de `src/` aux paramètres libres (`Record<string, …>`), quand un module passe à
   `catalogText`, alors ses paramètres `{x}` sont typés depuis le texte français, tout appel mal paramétré est corrigé (tsc) et le texte
   affiché ne change pas (tests existants inchangés) ; une garde relève les traducteurs restants et refuse toute hausse : la liste figée
   est exacte dans les deux sens et ne peut que décroître.
3. **Bundle** : le départ ne grossit pas ; `tests/bundle/start-modules.json` inchangé (ou retrait seulement).
4. **Périmètre** : aucun fichier des dossiers de synchro ; un traducteur dont la migration en exigerait un reste nommé dans la liste.

## Passe agent du module (coquille et qualité)

- **§ 18.4 b** (D-643) : étape « Icônes générées (--check) » du job « Lint et typecheck » de `tests.yml` ; options `--from <dossier>` et
  `--target <dossier>` de `scripts/release/generate-icons.mjs`, sortie générée retirée en fin de script (`finally`). Le test
  `generateIcons.test.ts` garde l'étape et éprouve `--check` sur arbres synthétiques (sans `tauri icon`, sans délai propre).
- **C-085** (D-644) : scripts `.codex-tmp/clean0296/convert.mjs` (corps standard remplacé par `catalogText`, catalogue `as const`
  vérifié, `--plain` exporte `XPlainKey`), `attribute.mjs` (erreurs tsc par module : 158 si tout est converti, 72 après le changement de
  `tPlural`), `inline.mjs` (corps d'origine exporté sous `CatalogTranslator`). 20 modules typés, un par commit : 13 par `catalogText`
  (circuit, injuries, routineCircuit, todayPc, tracking, trainingCycle, trainingProgress, trainingRecovery, workoutReplay, nutritionQuick,
  programImport, recoveryFactors, trainingMedia), 7 par leur corps d'origine typé (body, supplements, exportImport, appleIntelligence,
  timer, syncCarryReport, syncRestore ; ce dernier accepte désormais `string | number`, affichage identique). 9 tables de libellés en
  `XPlainKey` (`PlainCatalogKey`), dont `src/features/sync/conflictText.ts` et `carryReportText.ts` (types seulement ; hors des dossiers
  de synchro relus par sync-icloud).
- Bundle de départ (`vite build` + `node tests/bundle/measureStart.ts`, même poste) : main 180 109 octets normalisés (brut 180 102) ;
  migration par `catalogText` seule : 180 147 (bloc `catalogText` nommé par la table de préchargement) ; corps dans `units.ts` : 180 116
  (`units` ajouté à 7 listes) ; final : **180 109 (brut 180 111), égal à main** ; 89 listes de préchargement identiques.
  `tests/bundle/start-modules.json` inchangé.
- Restes (24, liste figée `tests/untyped-translators.json`) : corps non standard `appUpdateRestoreText`, `logsText`, `plusText`,
  `settingsRefonteText`, `syncOwnDeletionText`, `syncRefonteText` ; appels à retyper `bodyProgressText`, `cardioText`, `healthText`,
  `nutritionText`, `onboardingText`, `progressionText`, `recipesText`, `recoveryText`, `strengthText`, `todayText`,
  `trainingGenerationText`, `trainingSessionText`, `trainingText`, `visbodyText`, `weeklyReviewText` ; hors `*Text.ts` : `tRn`
  (fr.recoveryNotifications.ts), `tStartupBlocked` (fr.startupBlocked.ts), `tDynamic` (index.ts, clé calculée de `t()`).

## Passe qa-test : rouge puis vert

| Ligne | SHA rouge | SHA vert |
|---|---|---|
| § 18.4 b | 2d49b479 (`--check` sur copie altérée : code 0 au lieu de 1) ; réécrit 3e109a3c (`--from` ignoré, étape absente de `tests.yml`) | de1cf282 ; 6edcd721 |
| C-085 | 2d49b479 (relevé de 40 contre 21 figés) ; garde élargie 3e109a3c (43 relevés, 24 figés) | 68d7f3f0 (base), 20 commits de module (garde verte à 50b81cf1), départ ramené à main en 15b85b3b |

Tests locaux : `src/i18n` et gardes (33 fichiers, 269 verts), `generateIcons`, `untypedTranslators`, `ciTrigger`, `ciPub` ; `vitest related`
sur les fichiers changés (voir ci-dessous) ; `tsc --noEmit` et `npm run lint` propres. Non lancés ici : e2e, visual, perf, Rust.

## Relecture à froid (code-reviewer, distinct) et suites

Verdict initial : refusé (1 bloquant, 3 importants) ; seconde relecture : (a) à (d) acceptés, run 45745432439 vert, étape `--check` réussie sous Linux : plus d’objection. Traités :
- bloquant (CI Linux non prouvée) : levé par le run de la PR (étape `--check` du job « Lint et typecheck ») ;
- plafond 40 trop lâche : plafond égal à la liste figée (24), abaissé à chaque migration ;
- plafond de 60 s, qui allongeait un test : retiré ; `--check` réel dans `tests.yml`, test sur arbres synthétiques ;
- dossiers temporaires laissés dans `.codex-tmp/` : nettoyés (script et `afterEach`) ;
- garde contournable (signature sur plusieurs lignes, fichiers hors `*Text.ts`) : relevé élargi à `src/i18n`, signature lue jusqu'au corps ;
  un alias de type (`type P = Record<string, …>`) reste hors de portée, limite connue.
Non retenus, avec la cause : interdire `n` dans les paramètres de `tPlural` casserait la revue hebdomadaire, qui passe un `n` déjà mis en
forme (« 12,5 ») ; ce comportement est figé par un test (21064264). Test des clés `kind…` de `carryReportText.ts` : il demanderait
d'importer `src/domain/sync` ; laissé, le type est plus étroit qu'avant. Mineur consigné : `syncRestoreText` accepte `string | number`.

## Couverture par module (BL-044)

Run 45745432439 (PR #226, tête 64906641), job « Couverture fusionnée » : artefact `couverture-html`, `coverage-summary.json` passé à
`coverageByModule` de `scripts/release/coverage-by-module.mjs` avec la racine du runner (même calcul que l’étape « Couverture par module »,
qui écrit ce tableau dans le résumé du job). Total : 959 fichiers, 94,6 % des lignes, 87,1 % des branches. Lecture seule, aucun seuil
nouveau ; les plus bas : `src/platform/photoImage` (40,6 % des lignes), `src/platform/haptics` (63,4), `src/platform/files` (64,9),
`src/domain/model` (66,7).

| Module | Fichiers | Lignes % | Branches % |
|---|---|---|---|
| src | 1 | 80,4 | 67,1 |
| src/db | 8 | 95,3 | 90,4 |
| src/db/drivers | 1 | 100 | 81,5 |
| src/db/migrations | 25 | 100 | 100 |
| src/db/parse | 7 | 100 | 93 |
| src/db/repositories | 80 | 94,6 | 85,7 |
| src/db/seed | 3 | 90 | 33,3 |
| src/domain | 62 | 93,8 | 86,6 |
| src/domain/bodyProgress | 4 | 96,4 | 84 |
| src/domain/cardio | 4 | 100 | 98 |
| src/domain/exportImport | 5 | 98,7 | 91,6 |
| src/domain/health | 2 | 100 | 93,5 |
| src/domain/model | 14 | 66,7 | 63,9 |
| src/domain/nutrition | 32 | 99,7 | 94,7 |
| src/domain/onboarding | 5 | 100 | 99,2 |
| src/domain/recovery | 16 | 98,7 | 91,6 |
| src/domain/review | 2 | 100 | 96,7 |
| src/domain/sync | 26 | 99,8 | 95,8 |
| src/domain/tracking | 5 | 100 | 95,7 |
| src/domain/training | 53 | 99,8 | 93,2 |
| src/features/app | 39 | 93,5 | 87,6 |
| src/features/bodyProgress | 4 | 96,4 | 78,5 |
| src/features/cardio | 4 | 95,3 | 86,2 |
| src/features/notifications | 8 | 88,8 | 79,7 |
| src/features/nutrition | 41 | 91,5 | 82,1 |
| src/features/onboarding | 9 | 88,9 | 79,8 |
| src/features/palette | 2 | 97,3 | 77,3 |
| src/features/progress | 6 | 91,7 | 70,2 |
| src/features/recovery | 8 | 97,7 | 86,1 |
| src/features/security | 9 | 96 | 90,3 |
| src/features/settings | 50 | 93,8 | 83,7 |
| src/features/shortcuts | 4 | 100 | 82,1 |
| src/features/signing | 7 | 88,9 | 84,6 |
| src/features/strength | 2 | 94,4 | 72,5 |
| src/features/sync | 52 | 93,9 | 88,9 |
| src/features/tracking | 7 | 97,3 | 77,4 |
| src/features/training | 49 | 91,2 | 77,5 |
| src/features/updater | 4 | 96,2 | 88,2 |
| src/i18n | 131 | 98,6 | 84,2 |
| src/platform | 10 | 78,3 | 72,6 |
| src/platform/appleIntelligence | 5 | 93,8 | 87,7 |
| src/platform/backup | 7 | 80,1 | 78 |
| src/platform/barcode | 2 | 96,3 | 94,1 |
| src/platform/biometric | 5 | 97,7 | 92,4 |
| src/platform/desktop | 6 | 97,2 | 93,5 |
| src/platform/files | 8 | 64,9 | 78 |
| src/platform/geolocation | 4 | 93,8 | 87 |
| src/platform/haptics | 4 | 63,4 | 48 |
| src/platform/healthkit | 5 | 87,7 | 76,9 |
| src/platform/liveActivity | 4 | 88,6 | 78,7 |
| src/platform/logs | 6 | 97,9 | 97 |
| src/platform/notifications | 13 | 87,4 | 80,4 |
| src/platform/ocr | 4 | 82,5 | 81 |
| src/platform/off | 4 | 97,1 | 95,9 |
| src/platform/photoImage | 1 | 40,6 | 21,4 |
| src/platform/privacyShield | 2 | 86,8 | 86,7 |
| src/platform/shortcutFiles | 1 | 87,7 | 85,9 |
| src/platform/signing | 5 | 83,6 | 80,7 |
| src/platform/speech | 5 | 77,9 | 74,6 |
| src/platform/sync | 6 | 96,5 | 88,3 |
| src/platform/systemSettings | 3 | 92,9 | 85 |
| src/platform/tauri | 2 | 97,8 | 83,9 |
| src/sync | 32 | 96,4 | 88,7 |
| src/ui | 24 | 95,7 | 84,2 |
