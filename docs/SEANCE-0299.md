# SEANCE-0299 — Séance et moteur : décision d'Ali réduite comme une référence (BL-171), correction affichée au journal (BL-176)

Lot 0.29.9, module « séance et moteur ». Branche `SEANCE-0299` depuis `origin/main` (`89d2a5da`). Registre : BL-171 (C-026, D-657),
BL-176 (C-072, D-659, § 13.4, § 13.8 c). Chapitres : 11 (moteur, § 11.2, § 11.5), 12.2 (décharge), 13.4 et 13.8 (journal, correction),
16.7 (journal rouge). Décisions réservées : D-681 à D-685. Budget annoncé : S (50k).

## Passe product-owner (Given / When / Then)

BL-171 (D-657, Ali, Q-11 option B) :
1. Étant donné une décision d'Ali (modification ou retour) datée après la dernière séance de l'exercice, sans contrainte, alors elle est
   reprise telle quelle (inchangé : raison principale « décision »).
2. Étant donné la même décision en semaine de décharge, alors elle devient la référence et est réduite comme une séance : moitié des séries,
   charge × 0,8 arrondie vers le bas au matériel, RIR ≥ 4 (90 kg × 8, 8, 8 → 70 kg × 8, une série).
3. Étant donné une pause de 3 semaines ou plus, alors la décote d'inactivité s'applique à la décision (90 kg, 35 jours : −3 % → 87,5 kg).
4. Étant donné une journée rouge acceptée (ou une récupération basse), alors × 0,95 vers le bas (90 → 85 kg ; 110 → 102,5 kg).
5. Fatigue, stagnation et décote de position ne s'appliquent pas (lues dans l'historique, pas dans la décision) ; aucun choix facultatif.
6. Même règle au poids du corps et chronométré (`prescribeUnloaded`) : décharge (moitié des séries, lest × 0,8 vers le bas), pause et
   récupération basse (mêmes valeurs, raison principale de la contrainte).
7. La phrase est celle de la contrainte ; une note dit que la référence est la dernière décision d'Ali (texte dans src/i18n, chargé à la
   demande avec fr.progression).
8. `ENGINE_VERSION` 5 → 6 (les propositions changent) ; épinglages mis à jour.
9. Les tests qui figeaient l'option A (constraints.test.ts, redDay.test.ts, seance0292.test.ts C-026) changent d'attente dans le commit rouge.

BL-176 (D-659, Q-13 B) :
10. Étant donné une série d'une séance close corrigée avec `correctedFrom` connu, quand le journal l'affiche, alors l'étiquette dit
    « corrigée : 80 → 82,5 kg » (virgule décimale, « → », unité) ; plusieurs valeurs changées : jointes par « ; » (répétitions, durée, RIR).
11. Deux haltères tenus : « corrigée : 2 × 26 → 2 × 28 kg ». Valeur d'avant absente : « — ».
12. `correctedFrom` absent ou identique (validation retirée sans changer les valeurs) : « corrigée » seul, comme avant.
13. Aucune migration, aucune table publiée changée, aucun module ajouté au départ (fr.training déjà hors départ).

Hors périmètre : historique complet des corrections (option C de Q-13, refusée) ; décote de position d'une décision.

## Passe agent du module

- `src/domain/training/prescribe.ts` : `prescribe`, branche de la décision : contraintes évaluées sans estimations (ni fatigue ni
  stagnation), réduction par `reducedTarget` sur la décision, charge décidée ajoutée à la grille, même arrondi que la référence d'historique
  (D-682) ; `prescribeUnloaded` : pause, récupération basse et décharge évaluées avant la référence (`deloaded`, `reducedReasons` partagés
  avec la branche de l'historique, comportement de celle-ci inchangé).
- `explain.ts` : note `noteDecisionReference` ; `fr.progression.ts` : son texte (hors départ).
- `config.ts` : `ENGINE_VERSION` 6 (D-681).
- `src/features/training/history/HistorySetRow.tsx` : `correctionText` (D-683) ; `fr.training.ts` : 8 clés (hors départ, déjà à la demande).
- Aucune migration, aucun fichier de synchro, aucune table publiée changée ; `tests/bundle/start-modules.json` inchangé.

## Passe qa-test

| Ligne | Rouge | Vert | Remarque |
|---|---|---|---|
| BL-171 | `437e8bc7` | `2b1ee3d3` | attentes de l'option A changées : constraints.test.ts, redDay.test.ts, seance0292.test.ts (C-026) ; seance0299.test.ts ; épinglages 6 |
| BL-176 | `c1ed6f9f` | `15b6bea5` | HistorySetRow.seance0299.test.tsx (7 cas, 5 rouges : les 2 « corrigée » seul passaient déjà) ; History.test.tsx : attente changée (bout en bout par la base) |

Local : `src/domain/training` et `moteur0281a.test.ts` : 938 / 939 ; l'échec restant, `programImport.qa.test.ts` (délai de 5 s dépassé
sur ce PC, 9,4 s seul), n'importe ni le moteur ni sa configuration : lenteur locale, laissée à la CI. Typage et lint verts.

## Relecture à froid (code-reviewer)

Agent code-reviewer distinct, diff `89d2a5da..2b1ee3d3..cf234688` donné sans conclusions : approuvé avec réserves (aucun bloquant,
3 importants, 6 mineurs). Corrigés : rouge `eb40fa57`, vert `1e9e70fb`.

| Point | Suite |
|---|---|
| I1 décision à 0 kg d'un lesté non réduite | corrigé (`>= 0`), D-682 (2) révisé |
| I2 bouton de deload absent sur une décision (impossible de le rétablir) | corrigé (ExerciseProgression.tsx), test d'interface ExerciseProgressionCycle.test.tsx, D-684 (4) |
| I3 notes de la dernière séance (partielle, aberrante) contredisant la note de décision | corrigé (raisons retirées), D-684 (1) |
| m4 retour réduit : phrase de la contrainte | voulu, testé, D-684 (2) |
| m5 1RM de l'historique dans la référence d'une décision | corrigé (0), D-684 (3) |
| m6 charge décidée hors grille gardée | voulu (entrée d'Ali), D-682 (1), commentaire corrigé (D-471 → D-682) |
| m7 cas limites non testés | ajoutés (assisté, reps vides, plan de cycle, fatigue seule, isolation) ; passaient déjà |
| m8 singulier, valeur absente d'un côté | corrigé, D-683 révisée |
| m9 attente de History.test.tsx changée dans le vert `15b6bea5`, pas dans le rouge | écart de méthode consigné : branche non réécrite (pas de réécriture d'historique) ; l'attente nouvelle est couverte en rouge par HistorySetRow.seance0299.test.tsx (`c1ed6f9f`) |

Pas de relecture sync-icloud : aucun fichier de synchro ni table publiée touché (`corrected_from` seulement lu).
