# PROG-03 — Réordonner exercices et jours d'une routine sur PC (glisser-déposer, Alt+flèches, annonce) (lot 0.26.0)

Statut : **en revue.** Budget S. Branche `PROG-03` depuis `origin/main` (`cdf1a900`). Aucune migration. Lot 0.26.0 (docs/LOT-0.26.0.md, § 3) : pas de tag à la fusion.
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

**Agent du module (training, ui-design-system).** À compléter.

**qa-test.** À compléter.

**code-reviewer.** (laissée vide : relecture à froid par l'orchestrateur)

## Constats à faire par Ali sur le PC
- Éditeur d'une routine : glisser un exercice par sa poignée, puis un jour ; Alt+↑/↓ sur une poignée ; avec le Narrateur, l'annonce de la position.
