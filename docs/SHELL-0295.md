# SHELL-0295 — unités et séparateurs par src/i18n, `fr.routines` hors du départ, tests sans pause ni référence partagée, relevé des marqueurs (lot 0.29.5)

Statut : **fait en partie**, branche `SHELL-0295` depuis `origin/main` `52722de2`. Registre « coquille, iOS et qualité » : les quatre dernières lignes « à faire » (C-076, C-085, A-004, BL-044), instruites en SHELL-0294e.
Chapitres PRD : 18 (textes, § 18.4), 23 (qualité et tests, § 23.1). Choix prudents : D-638 à D-641, « Claude (choix prudent) ; révisable par Ali ». Aucune question.
Aucune migration, aucun fichier de `src/sync/**`, `src/domain/sync/**`, `src-tauri/**` ni Swift touché ; aucun test désactivé, allongé ni retardé, aucun `test.fixme`. Fixtures synthétiques uniquement (D-292).

## Passe product-owner : critères (étant donné / quand / alors)

1. **C-076** : étant donné `src/features` et `src/ui` (hors tests), quand un script relève « min », « h », « · », « — », `'fr-FR'` et `toLocaleString(`, alors aucun n'est écrit en dur hors des exceptions nommées ; ils passent par `src/i18n/units.ts` et `src/i18n/fr.units.ts` ; les tests existants qui figent l'affichage ne changent pas.
2. **C-085** : étant donné le départ, alors aucun texte de `fr.routines` n'y figure (assertion « hors du départ ») et la liste blanche ne le cite plus ; la fixture lue par un seul test sort de `src` ; un catalogue à part a des paramètres typés.
3. **A-004** : aucun test ne lit une référence de module laissée nulle par un test précédent ; les pauses fixes remplaçables sans e2e local deviennent des signaux observables, prouvés par la CI.
4. **BL-044** : les skip conditionnels et délais sont relevés et classés par script, figés dans une liste exacte ; la couverture par module est produite par script depuis le rapport fusionné de la CI.

## Passe agent du module (coquille et qualité ; qa-test pour A-004 et BL-044)

- **C-085** (D-638) : `fr.routines.ts` quitte `fr.ts` et `tests/bundle/start-modules.json` ; il ne garde que les dix clés lues par `formatRoutine.ts` (`tRoutines`), les autres (écrans d'habitudes de CircleTasks) n'avaient aucun appelant. `src/i18n/catalogText.ts` : traducteur d'un catalogue à part, paramètres typés depuis le texte (type `ParamNames` exporté de `types.ts`). `content02.originals.json` passe dans `tests/fixtures/training/` (chemin mis à jour dans docs/CONTENT-0293.md).
- **C-076** (D-639) : `src/i18n/units.ts` et `src/i18n/fr.units.ts` ; 31 fichiers de `src/features` changés par script (`.codex-tmp/lot028/shell0295/c076-units.mjs`, remplacements exacts : `'fr-FR'` → `INTL_LOCALE`, `x.toLocaleString('fr-FR', …)` → `formatLocaleNumber`, « · » → `SEP`, « — » → `NONE`, durées → `formatMinutes`, majuscule initiale → `upperFirst`). Exception nommée : `src/features/sync/syncText.ts` (module du départ).
- **A-004** (D-640) : script `.codex-tmp/lot028/shell0295/a004-fix.mjs` (remplacements exacts) : référence calculée une fois et refaite après un échec dans `tests/unit/sync/epochCarryReplacedParentResume.test.ts` et `tests/unit/sync/epochCarryReportRules.test.ts` (le second trouvé par la garde) ; `settled(page)` dans `tests/visual/capture.spec.ts`.
- **BL-044** (D-641) : `scripts/release/test-markers.mjs` (relevé, `--check`, `--write`), `tests/test-markers.json`, `scripts/release/coverage-by-module.mjs`, reporter `json-summary` (vitest.config.ts), étape « Couverture par module » du job « Couverture fusionnée » (tests.yml).

## Passe qa-test : rouges puis verts

Chaque rouge a été constaté en échec en local (`--coverage.enabled=false`), commité seul, puis le vert.

| Ligne | SHA rouge | SHA vert |
|---|---|---|
| C-085 | a0e05a8c (3 rouges : texte `toutes les {count} semaines` dans `assets/i18n-*.js` du départ ; `catalogText` absent ; fixture absente de `tests/fixtures/training/`) | 3a3e1cd1 |
| C-076 | 28e381c1 (garde : 55 sites relevés ; `units.ts` absent) | b5916ca1 (la garde reçoit au vert une seconde exception nommée, `PairingView.tsx`, après le refus de `pairingBundle.test.ts`) |
| A-004 | 3c189675 (garde : 2 fichiers à référence nulle partagée, le second trouvé par elle ; 5 `waitForTimeout` dans `capture.spec.ts`) | 04d916aa |
| BL-044 | a75c9219 (rouge à l'import : scripts absents) | 445567aa, puis a70e90b3 (globales Node pour eslint) |

Preuve d'isolement de A-004 : les trois tests « critère 9 » lancés seuls (`-t`) sur la version de main échouent (« expected null not to be null », 3 sur 3) ; sur la version corrigée, avec `epochCarryReportRules.test.ts` : 9 verts. Un premier vert (référence calculée par le premier test qui la demande) doublait le travail de ce test et dépassait 5 s lancé seul : la référence est amorcée par `beforeAll` (délai de crochet par défaut, inchangé), refaite par un test si l'amorce a échoué, nettoyée en `finally`.

Tests existants qui figent l'affichage : aucun changé ; `vitest related` sur les 31 fichiers de C-076 et les nouveaux modules : 184 fichiers, 1 431 tests verts.

## Relevé des marqueurs (BL-044)

| Module | skipProjet | skipCondition | pause | plafond | interdit |
|---|---|---|---|---|---|
| src/App | 0 | 0 | 0 | 1 | 0 |
| src/db/migrations | 0 | 1 | 0 | 0 | 0 |
| src/db/serializedDriver | 0 | 0 | 1 | 0 | 0 |
| src/features/app | 0 | 0 | 1 | 0 | 0 |
| src/features/cardio | 0 | 0 | 1 | 0 | 0 |
| src/features/notifications | 0 | 0 | 3 | 0 | 0 |
| src/features/nutrition | 0 | 0 | 4 | 0 | 0 |
| src/features/progress | 0 | 0 | 1 | 0 | 0 |
| src/features/security | 0 | 0 | 1 | 0 | 0 |
| src/features/settings | 0 | 0 | 1 | 1 | 0 |
| src/features/training | 0 | 0 | 4 | 0 | 0 |
| src/platform/geolocation | 0 | 0 | 0 | 1 | 0 |
| src/platform/haptics | 0 | 0 | 1 | 0 | 0 |
| src/platform/speech | 0 | 0 | 1 | 0 | 0 |
| tests/e2e | 17 | 0 | 2 | 11 | 0 |
| tests/setup | 0 | 0 | 1 | 0 | 0 |
| tests/sim | 0 | 0 | 1 | 0 | 0 |
| tests/smoke | 0 | 0 | 0 | 4 | 0 |
| total | 17 | 1 | 23 | 18 | 0 |

Les 17 skip filtrés par projet lancent un scénario sur un seul projet Playwright (pc ou iphone) ; le seul skip sur une autre condition est la régénération du manifeste des migrations (`UPDATE_MIGRATION_MANIFEST=1`, jamais en CI). Aucun `only`, `fixme` ni `todo`. Les « plafonds » bornent une attente sur signal ; ils ne sont pas des pauses.

## Ce qui reste, avec la cause

- **C-085** : 39 traducteurs `*Text.ts` aux paramètres libres (`params?: Readonly<Record<…>>`) à passer à `catalogText`, un module à la fois : chaque migration fait apparaître les appels mal paramétrés et dépasse une ligne S. Hors registre, cités par l'audit : libellé « Répétitions » d'un exercice au temps (`LibraryView.tsx`), `setTimeout` non nettoyé (`HistoryView.tsx`).
- **A-004** : le job « Captures app et maquettes » (visual, hors suite verte) doit être constaté vert sur `settled` ; **e2e et visual non lancés ici : preuve par la CI de la PR**. Les deux `waitForTimeout(1500)` de `tests/e2e/lot-f-qa.spec.ts` et `tests/e2e/P-04.spec.ts` attendent l'absence d'un redémarrage : aucun signal à attendre, gardés. Les 13 délais de 5 s et 7 attentes DOM de l'audit 0.26.0 sont des plafonds sur un signal, dépassés sous charge (suite locale à un worker, 6 240 s) : jamais allongés ; la suite de la CI les tient.
- **BL-044** : le tableau de couverture par module n'existe qu'après le job « Couverture fusionnée » de la PR (résumé du job).
- **C-076** : `src/domain` (couche sans i18n) et `src/platform` (locales de configuration) hors garde ; « s » des secondes non traité (hors de la ligne).
- Passe code-reviewer : à lancer par le coordinateur (relecture à froid du diff).
- Écart de méthode : une attente locale par boucle `while … sleep` a été lancée puis arrêtée (contraire à AGENTS.md) ; aucune autre.

## Gardes et bundle

Bundle de départ (même poste, `CI=1 npx vitest run --config vitest.bundle.config.ts tests/bundle/startBundle.test.ts`) : **avant 180 514 octets normalisés** (main `52722de2`) ; après C-085 180 084 (−430) ; **après C-076 et final 180 108 (brut 180 119), soit −406 contre main**. C-076 seul coûte +24 octets : le bloc partagé `units` entre dans la table de préchargement des écrans à la demande (D-639). `start-modules.json` : une ligne retirée (`fr.routines.ts`), aucune ajoutée ; 175 tests de `startBundle.test.ts` et `pairingBundle.test.ts` verts.

`tsc --noEmit` propre ; eslint propre sur les fichiers touchés ; Vitest ciblés verts (`vitest related` C-076, `src/i18n`, `content02`, `hardcodedUnits`, `testIsolation`, `visualCoverage`, les deux fichiers `epochCarry*`, `testMarkers`, gardes de tests.yml `ciPub`, `ciTrigger`, `cargoAuditGate`, `cargoAuditSummary`, `purge`, `third-party-notices`) ; gardes documentaires (voir rapport de PR) ; contrôle des noms de lieux à 0. Non lancés ici : e2e, visual, perf, Rust (aucun fichier Rust touché).
