# CLEAN-0297 — 22 traducteurs de plus typés, garde des alias de type (lot 0.29.7)

Statut : **fait en partie** (C-085 : 2 restes nommés, `tDynamic` et `tProgression`), PR à venir, branche `CLEAN-0297` depuis `origin/main`
`8c499215`. Module « coquille, iOS et qualité ». Budget annoncé : M (150 k). Ligne du registre : C-085. Chapitres PRD : 18 (§ 18.4, textes),
23 (qualité et tests). Choix prudents : D-645, D-646, « Claude (choix prudent) ; révisable par Ali ». Aucune question.
Aucun fichier de `src/sync/**`, `src/domain/sync/**`, `src-tauri/src/sync/**` ni `src/platform/sync/**` touché ; aucune migration ;
aucun test désactivé, allongé ni retardé. Fixtures synthétiques uniquement (D-292).

## Passe product-owner : critères (étant donné / quand / alors)

1. **Typage** : étant donné un traducteur de `tests/untyped-translators.json`, quand son module passe au typage (`CatalogTranslator`,
   méthode de CLEAN-0296 qui garde le départ égal), alors ses paramètres `{x}` sont typés depuis le texte français, tout appel mal
   paramétré est retypé (tsc) et le texte affiché ne change pas (tests existants inchangés).
2. **Garde** : étant donné la liste figée, quand un traducteur est typé, alors il en sort et le plafond baisse d'autant (test rouge
   d'abord) ; étant donné un traducteur dont les paramètres passent par un alias local (`type P = Record<string, …>`), alors la garde le
   relève (faille signalée par CLEAN-0296).
3. **Bundle** : départ ≤ 180 109 octets normalisés ; `tests/bundle/start-modules.json` inchangé.
4. **Périmètre** : aucun fichier des dossiers de synchro ; un traducteur dont la migration en exigerait un reste nommé.

## Passe agent du module (coquille et qualité)

- Scripts (D-51) sous `.codex-tmp/clean0297/` : `convert.mjs` (traducteur exporté → `translate` local exporté sous
  `CatalogTranslator<typeof xFr>`, import de type seul), `plain.mjs` (type `XPlainKey` par module), `retype.mjs` et `imports.mjs`
  (tables de libellés et clés variables en `XPlainKey`), `satisfies.mjs` (tables mêlées en `as const satisfies`), `commits.sh` (un commit
  par module, liste figée intermédiaire indexée). Erreurs tsc après conversion : 67, puis 26, puis 0 après les retypages site par site.
- 22 traducteurs typés (D-645) : `tUpdateRestore`, `tBodyProgress`, `tCardio`, `tRn`, `tStartupBlocked`, `tHealth`, `tLogs`, `tNutrition`,
  `tOnboarding`, `tPlus`, `tRecipes`, `tRecovery`, `tSettingsRefonte`, `tStrength`, `tOwnDeletion`, `tSyncRefonte`, `tToday`,
  `tGeneration`, `tSession`, `tTraining`, `tVisbody`, `tWeeklyReview`. Corps à chaînes seules élargis à `string | number` par `String()`
  (affichage identique). Les sites d'appel de `tOwnDeletion` et `tSyncRefonte` (`src/features/sync`) n'ont pas changé.
- Restes (2) : `tDynamic` (clé calculée de `t()`, voulue) ; `tProgression` (paramètres dynamiques du moteur, `explanation.params` :
  les typer demanderait de retyper `src/domain/training`).
- Garde (D-646) : alias de type locaux aux paramètres libres (alias d'alias compris) ; signature bornée au premier `;`. Limite : alias
  importé d'un autre fichier.
- Bundle de départ (`vite build --manifest` + `node tests/bundle/measureStart.ts`) : **180 109 octets normalisés (brut 180 113)**, égal
  à main ; `npm run test:bundle` vert (4 fichiers, 195 tests) ; `tests/bundle/start-modules.json` inchangé.

## Passe qa-test : rouge puis vert

| Ligne | SHA rouge | SHA vert |
|---|---|---|
| C-085 | 92612063 : 3 rouges sur 5 (extraction `git archive` sous `.codex-tmp/red0297`) : « expected 24 to be less than or equal to 2 » ; alias et débordement par symbole absent (`looseAliases`, `untypedTranslatorsOf`) | db6d9b0b (garde), 22 commits de module, garde verte à 9c6ed74c |

Tests locaux : `src/i18n` et la garde (33 fichiers, 271 verts) ; les 67 fichiers de test qui importent un fichier changé, en deux lots (34 fichiers, 366 verts ; 33 fichiers, 157 verts ; un `vitest related` global dépassait 590 s) ; `npm run test:bundle` (195 verts) ; `tsc --noEmit` et
`npm run lint` propres ; contrôles documentaires. Non lancés ici : e2e, visual, perf, Rust.

## Relecture à froid (code-reviewer, distinct)

Verdict : **approuvé**, sans bloquant ni important dans le code. Le relecteur a relu le diff `8c499215..HEAD` et lancé `tsc` (propre),
la garde (5/5) et 35 tests i18n et recettes. Ses vérifications : corps repris à l'identique, `String(…)` sans effet sur une chaîne,
aucun appel au niveau module avant un `export const` ni de cycle d'import, aucun cast `XPlainKey` qui cache une clé à paramètre,
`INSUFFICIENT` sans `sleep` sans effet, `@ts-expect-error` justifié. Conditions hors code : la fiche et les documents commités, la CI
verte constatée (ci-dessous). Mineurs :
- limites de la garde (`interface`, signature d'index, alias générique à valeur par défaut, `fill` de `pairingText.ts` hors du motif
  `t[A-Z]`) : ajoutées à D-646 ;
- les tests d'alias du commit rouge échouent par symbole absent (`looseAliases`), le plafond échoue par assertion : consigné ; la prochaine
  preuve rouge partira d'un bouchon exporté ;
- `as RecoveryPlainKey` sur la clé calculée de `RecoveryToday.tsx` reste un cast non vérifié (antérieur) ; commentaire d'en-tête répété :
  laissés.
