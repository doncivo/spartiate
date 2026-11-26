# CLEAN-0296 — `--check` des icônes par la suite, traducteurs typés par `catalogText` (lot 0.29.6)

Statut : **en revue (CI de la PR)**, branche `CLEAN-0296` depuis `origin/main` `7f1885f2`. Module « coquille, iOS et qualité ». Budget annoncé : M (150 k).
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

Verdict initial : refusé (1 bloquant, 3 importants). Traités :
- bloquant (CI Linux non prouvée) : levé par le run de la PR (étape `--check` du job « Lint et typecheck ») ;
- plafond 40 trop lâche : plafond égal à la liste figée (24), abaissé à chaque migration ;
- plafond de 60 s, qui allongeait un test : retiré ; `--check` réel dans `tests.yml`, test sur arbres synthétiques ;
- dossiers temporaires laissés dans `.codex-tmp/` : nettoyés (script et `afterEach`) ;
- garde contournable (signature sur plusieurs lignes, fichiers hors `*Text.ts`) : relevé élargi à `src/i18n`, signature lue jusqu'au corps ;
  un alias de type (`type P = Record<string, …>`) reste hors de portée, limite connue.
Non retenus, avec la cause : interdire `n` dans les paramètres de `tPlural` casserait la revue hebdomadaire, qui passe un `n` déjà mis en
forme (« 12,5 ») ; ce comportement est figé par un test (21064264). Test des clés `kind…` de `carryReportText.ts` : il demanderait
d'importer `src/domain/sync` ; laissé, le type est plus étroit qu'avant. Mineur consigné : `syncRestoreText` accepte `string | number`.
