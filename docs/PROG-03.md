# PROG-03 — Réordonner exercices et jours d'une routine sur PC (glisser-déposer, Alt+flèches, annonce) (lot 0.26.0)

Statut : **en revue (code-reviewer à faire).** Budget S. Branche `PROG-03` depuis `origin/main` (`cdf1a900`). Aucune migration. Lot 0.26.0 (docs/LOT-0.26.0.md, § 3) : pas de tag à la fusion.
Rôles : training, ui-design-system. Chapitres PRD : 18 (§ 18.1 gestes PC « glisser-déposer pour réordonner », § 18.6 clavier PC, lecteur d'écran, 44 pt),
14 (routines). Hypothèse H-n touchée : aucune (pas de capacité de plateforme nouvelle ; l'API HTML5 drag and drop de WebView2 est vérifiée par Ali, constat ci-dessous).
Fixtures synthétiques uniquement.

## Passe product-owner : critères

| # | Critère (Given / When / Then) | Tests (src/features/training/RoutineReorder.test.tsx) |
| --- | --- | --- |
| 1 | PC (≥ 1 024 px), éditeur d'une routine : chaque exercice d'un jour porte une poignée « Déplacer « nom » (Alt+Flèche haut ou bas) », `draggable`. Je glisse la poignée du 3ᵉ exercice et la dépose sur le 1ᵉʳ → il passe en tête ; la région polie dit « Rowing à la barre déplacé en position 1 sur 3 » ; à l'enregistrement, `routine_exercise.position` suit l'ordre affiché. | glisser le troisième exercice… |
| 2 | PC : poignée au focus, Alt+↓ / Alt+↑ déplacent d'une place, annoncent ; le focus reste sur la poignée ; en bout de liste ou sans Alt, rien ne bouge. | Alt+↓ puis Alt+↑… |
| 3 | PC : chaque jour porte une poignée « Déplacer le jour « nom » … » ; glisser-déposer et Alt+flèches changent l'ordre des jours ; `routine_day.day_order` (1, 2, …) suit l'ordre affiché. | les jours se réordonnent… |
| 4 | Un exercice déposé sur un autre jour, ou un jour déposé sur un exercice : rien ne change (pas de déplacement entre jours dans ce ticket). | un exercice déposé sur un autre jour… |
| 5 | iPhone (< 1 024 px) : aucune poignée ; « Monter » / « Descendre » comme avant (ils annoncent aussi la nouvelle position). | à 440 px, aucune poignée |
| 6 | Poignée ≥ 44 px, contour visible au focus (`--ct-color-select-ring`), tokens seulement, aucune couleur en dur. | la feuille de styles donne 44 px… |
| 7 | Synchro inchangée : l'ordre passe par `saveDraft` → `updateExercise(position)` / `updateDay(dayOrder)` existants ; ni src/sync, ni src/domain/sync, ni le schéma touchés. | diff (ci-dessous) ; tests existants de l'éditeur verts |
| 8 | Bundle de départ non augmenté. | `npm run test:bundle`, mesure en octets |

## Passes

**Agent du module (training, ui-design-system).** Rouge : `c5411577` (6 tests sur 7 en échec : poignées `Déplacer « … »` introuvables, région `.ct-training__reorder-live` absente, règle `.ct-training__drag-handle` absente ; le 7ᵉ, « sans glisser en cours », est une garde de non-régression verte dès l'origine).
Vert : `6fabc60e`. Dans `src/features/training/RoutinesView.tsx` : poignée `GripVertical` (lucide-react, déjà présent) rendue si `useLayout() === 'pc'`, `draggable`, Alt+↑/↓
(sans Ctrl, Maj ni Méta), focus rendu à la poignée après le déplacement (`data-reorder-handle`) ; dépôt d'un exercice sur une ligne du même jour, d'un jour sur la carte
d'un autre jour ; `dataTransfer` facultatif (jsdom). Région `aria-live="polite"` masquée (`ct-visually-hidden`) ; « Monter » / « Descendre » annoncent aussi. Textes
`reorderHandle`, `reorderDayHandle`, `reorderMoved` dans src/i18n/fr.training.ts ; CSS par tokens dans TrainingScreen.css. Choix prudents : D-305.
L'arrangement d'une liste (`moveItem`) reste dans la feature : simple ordre d'affichage, pas une règle métier (src/domain/training évité, STR-01 y travaille).

**Synchro (D-26) : aucune colonne ni règle de synchro changée, pas de relecture D-26 requise.** Preuve : `git diff --stat origin/main -- src/sync src/domain/sync src-tauri src/db`
est vide ; l'ordre est écrit à l'enregistrement par `saveDraft` → `updateExercise(position)` / `updateDay(dayOrder)`, chemin inchangé et déjà publié.

**Bundle de départ** (`npm run build -- --manifest` puis `node tests/bundle/measureStart.ts`, origin/main `cdf1a900` puis branche) : normalisée 195 861 → 195 861 octets
(brute 195 865 → 195 853, écart de hachage), 44 blocs dans les deux cas, marge 162 539 octets. L'éditeur reste dans le bloc Entraînement chargé à la demande.
`npm run test:bundle` sur origin/main dans ce worktree : startBundle vert ; 2 échecs de `pairingBundle.test.ts` (chemins `../../node_modules` dus à la jonction du
worktree sous .codex-tmp), sans lien avec ce ticket, à juger par la CI.

**qa-test.** Rouge rejoué (ci-dessus). Cas limite ajouté : exercice déposé sur un exercice d'un autre jour (jour B garni par le repository). Mutation : retrait de la garde
« même jour » dans `lineDropProps` → ce test seul passe au rouge (1 échec sur 8), mutation annulée, 8/8 verts. Suites ciblées : RoutineReorder (8), RoutineCircuit,
TrainingScreen, Ergo02Screens, trainingNavigation, src/i18n : 26 fichiers, 227 tests verts ; `npm run typecheck` vert ; eslint vert sur les fichiers touchés
(Prettier non imposé par `npm run lint`, fichiers déjà non conformes sur main). Non testable en jsdom : le rendu réel du glisser dans WebView2 et l'annonce du Narrateur
(constat d'Ali ci-dessous ; e2e PC en CI seulement).

Budget : S (≈ 50k) dépassé (≈ 90k, attentes de build et une mutation) ; poursuivi sur consigne d'Ali.

**code-reviewer.** (laissée vide : relecture à froid par l'orchestrateur)

## Constats à faire par Ali sur le PC
- Éditeur d'une routine : glisser un exercice par sa poignée, puis un jour ; Alt+↑/↓ sur une poignée ; avec le Narrateur, l'annonce de la position.
