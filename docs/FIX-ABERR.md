# FIX-ABERR — Charge aberrante signalée avant enregistrement, référence plafonnée (lot 0.28.0)

Statut : **en cours.** Budget M. Branche `FIX-ABERR` depuis `origin/main` (`68af109d`). Aucune migration (schéma 20 inchangé). Lot 0.28.0, phase 1.2.
Origine : audit Claude 0.27.0 (`origin/audit-claude-0.27.0`, `docs/audit-claude-0.27.0/constats.md`) : C-005 (bloquant), C-028, C-168 (partie
C-005) ; preuves `preuves/partie7a-ecrans.test.ts` et `preuves/partie4-moteur.test.ts`, describe « C-005 » (copiées dans `src/`, jamais
branchées depuis docs/). Chapitres PRD : 11 (§ 11.2 point 1, § 11.3, § 11.4, § 11.5 « aberrantes signalées avant enregistrement »), 13 (séance
active, § 13.2, § 13.4), 17 (§ 17.1 records). Décisions lues : D-170 (6), D-284 (`ENGINE_VERSION`), D-322 (assisté, PR #157). Fixtures
synthétiques uniquement (D-292).

## Règle appliquée (choix prudents, révisables par Ali)

- Référence d'un exercice : son 1RM courant (moteur, § 11.3) ramené à la charge pour les répétitions saisies (Epley inverse) ; à défaut (aucune
  séance valide : séances toutes partielles ou de décharge), la plus grande charge de travail validée de l'historique. Seuil : `outlierRatio`
  (1,5, constante existante, seule constante du contrôle).
- Saisie : une série de travail dont la charge dépasse 150 % de la référence n'est pas écrite ; Spartiate demande « Confirmer » ou
  « Corriger ». Sans historique de l'exercice : aucun contrôle relatif (bornes absolues 0 à 1 000 kg inchangées).
- Pas d'indicateur persistant (aucune migration) : la confirmation à la saisie n'est pas mémorisée. Pour le moteur, une séance aberrante
  reste non confirmée tant qu'une **deuxième séance complète (≥ 50 % des séries faites) hors décharge** ne l'atteint pas (e1RM ≥ 90 % du sien).
- Moteur : tant qu'elle n'est pas confirmée, la référence de charge est la dernière séance non aberrante (fin du choix B1 de la PR #60) ;
  1RM, Strength Score, record de la fiche et records du résumé de fin ne la prennent pas.

## Passe product-owner : critères

| # | Critère (Given / When / Then) | Test |
| --- | --- | --- |
| 1 | Given trois séances closes à 100 kg × 8 au développé couché, When Ali saisit 200 kg × 8 et valide, Then une confirmation « 200 kg : c'est 200 % de ta charge habituelle… (100 kg) » s'affiche et aucune série n'est écrite. | `FixAberr.test.tsx` « 200 kg » |
| 2 | Given la confirmation affichée, When Ali choisit « Corriger », Then rien n'est écrit, la confirmation disparaît et le focus revient au champ Charge. | `FixAberr.test.tsx` « Corriger » |
| 3 | Given la confirmation affichée, When Ali choisit « Confirmer », Then la série est écrite telle quelle (200 kg × 8, validée). | `FixAberr.test.tsx` « Confirmer » |
| 4 | Given le même historique, When Ali saisit 102 kg × 8, Then la série est écrite sans question. | `FixAberr.test.tsx` « 102 kg » |
| 5 | Given trois séances à 100 kg puis une séance à 200 kg (ou 1 000 kg) non confirmée, When le moteur prescrit, Then la charge est < 150 kg, la référence est 100 kg et une note dit pourquoi. | `fixAberr.test.ts` C-005 |
| 6 | Given 100 kg puis deux séances complètes à 200 kg, When le moteur prescrit, Then 200 kg est la référence (confirmée) et le 1RM la prend. | `fixAberr.test.ts` confirmation |
| 7 | Given 100 kg, 200 kg puis une séance partielle (< 50 %) ou de décharge à 200 kg, When le moteur prescrit, Then 200 kg reste non confirmée (C-028). | `fixAberr.test.ts` C-028 |
| 8 | Given une séance aberrante non confirmée, Then le record de la fiche et le 1RM affiché ne la prennent pas ; le résumé de fin ne présente pas une série aberrante comme record, et une aberrante passée n'empêche pas un vrai record. | `fixAberr.test.ts` records |
| 9 | Contrôle de saisie, cas limites : sans historique → rien ; séances seulement partielles → plus grande charge de travail ; lesté (poids de corps connu) sur la charge totale ; haltères par haltère ; exercice sans charge ou série non « travail » → rien ; assisté : voir passe qa-test. | `outlierEntry.test.ts` |
| 10 | C-168 : les tests qui figeaient le défaut sont réécrits (prescribe.test.ts « charge aberrante », prescribe.review.test.ts B1, session.test.ts bornes). | commit rouge |

Périmètre : `src/domain/training/{estimate1rm,prescribe,explain,exerciseSheet,closure,outlierEntry}.ts`, `src/features/training/session/{SetRow,ActiveSession,outlierCheck,ExerciseProgression}.tsx?`,
`src/i18n/fr.training.ts`, `src/i18n/fr.progression.ts`, `src/db/repositories/sql/workoutRepository.ts` (lecture de l'historique du résumé).
Hors périmètre : migrations, synchro, contenu, C-028 « faute à la toute première séance » (voir risques).
