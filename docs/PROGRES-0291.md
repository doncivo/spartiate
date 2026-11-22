# PROGRES-0291 — Progrès : plage de séries, adhérence aux prescriptions, recommandations du bilan

Lot 0.29.1 (docs/LOT-0.29.1.md), décisions d'Ali du 21/11 : BL-114 (D-448), BL-115 (D-449, § 8 I2), BL-125 (D-452). Chapitres : 17.1 (Progrès),
17.3 (bilans), 8 (I2). Agents : product-owner, training / domain-logic, qa-test, code-reviewer. Aucune migration (schéma 20), aucune table,
aucun fichier de synchro ; blocs à la demande seulement (Progrès › Entraînement et Progrès › Bilan), catalogues chargés avec eux.

## Passe product-owner (critères)

1. BL-114 : étant donné un muscle travaillé dans la fenêtre de Progrès, quand la dernière semaine complète compte `n` séries difficiles
   (séries de travail et chronométrées validées, part de chaque muscle), alors la ligne dit « Semaine dernière : n, sous / dans / au-dessus
   de la plage cible » (plage de 10 à 20, bornes comprises), en toutes lettres ; la règle est dite sous la carte. Sans semaine complète
   dans la fenêtre : aucun jugement.
2. BL-115 : étant donné les séances closes des 4 dernières semaines complètes, alors la carte Adhérence montre, en plus des séances faites
   sur prévues, « Prescriptions respectées » : séries faites sur proposées, charges tenues sur proposées, avec la règle ; sans série
   proposée, « rien à mesurer », jamais 0 %.
3. BL-125 : étant donné le bilan d'une semaine, alors une recommandation par thème (Entraînement, Nutrition, Sommeil et récupération) suit
   les phrases, chacune avec sa règle dite ; ses chiffres viennent des faits du bilan ou des seuils de sa règle ; sans les données de la
   règle : « aucune recommandation (pas assez de données) ». L'export Markdown les contient.
4. Bundle de départ inchangé ; aucun texte en dur ; aucune information par la couleur seule.

## Décisions (à reporter dans docs/decisions.md à la fusion)

- **D-455** (BL-114) : la plage est jugée sur la dernière semaine COMPLÈTE (la semaine en cours, partielle, dirait toujours « sous ») ; la
  moyenne de la fenêtre reste affichée à côté. Muscle non travaillé dans la fenêtre : non listé (inchangé). Révisable par Ali.
- **D-456** (BL-115) : série proposée = série de travail ou chronométrée portant une cible (répétitions, durée ou charge) ; faite = validée ;
  charge proposée = cible de charge ; tenue = série validée à une charge au moins égale (aucune tolérance, les charges sont arrondies au
  matériel) ; séries ajoutées sans cible, échauffement, drop et partielle : non comptées ; 4 dernières semaines complètes, pauses
  comprises (une séance de pause a ses prescriptions). Les répétitions ne sont pas jugées (le moteur s'en charge). Révisable par Ali.
- **D-457** (BL-125) : règles des recommandations, dans cet ordre, chacune avec sa source :
  - Entraînement : semaine non en pause sous l'objectif du programme suivi → « cale les séances manquantes » (règle « séances prévues ») ;
    sinon muscle le plus travaillé de la semaine comparé à la plage de D-448 → au-dessus : retirer des séries ; en dessous : en ajouter ;
    dans la plage : garder le plan ; aucune séance close dans la semaine et aucun objectif manqué : aucune.
  - Nutrition : moins de 3 jours complets → compléter le journal ; sinon moyenne comparée à la cible calorique unique en vigueur, à 10 %
    près (au-dessus, en dessous, garder le cap) ; aucun jour complet ou aucune cible unique : aucune.
  - Sommeil et récupération : moyenne sur au moins 3 nuits mesurées sous 7 h → avancer le coucher ; sinon garder le rythme (source :
    consensus de l'American Academy of Sleep Medicine et de la Sleep Research Society, 2015, 7 h ou plus par nuit chez l'adulte) ; moins
    de 3 nuits : aucune.
  Les seuils (10, 20, 3 jours, 10 %, 7 h) sont des choix prudents, révisables par Ali ; aucune IA, rien n'est envoyé.

## Passe agent du module (training / domain-logic)

- `src/domain/training/config.ts` : `volumeRange` { min 10, max 20 }.
- `src/domain/training/progressStats.ts` : `volumeRangeStatus`, `prescriptionAdherence`, `PrescribedSet` (règles pures, sans horloge).
- `src/domain/review/weeklyRecommendations.ts` (nouveau) : `weeklyRecommendations`, `recommendationsOf` (tirées des phrases de
  `weeklyReview`, mêmes sources).
- `src/features/progress/TrainingProgress.tsx` et `.css` : ligne de plage par muscle, règle sous la carte, prescriptions dans Adhérence.
- `src/features/progress/WeeklyReview.tsx`, `src/i18n/weeklyReviewText.ts`, `src/i18n/fr.weeklyReview.ts`, `src/i18n/fr.trainingProgress.ts`.

## Passe qa-test

- Rouge → vert : `38cc4f0c` (vecteurs BL-114 / BL-115, 9 rouges) → `eb3680e6` ; `8da3c2f7` (vecteurs BL-125, module absent) → `2d5b2bb4`.
- Vecteurs : bornes 10 et 20 comprises, 9,9 et 20,1, fenêtre sans semaine complète ; charges au-dessus et sous la cible, séries sans
  cible, chronométrées, début de semaine réglé, aucune série proposée (null) ; recommandations de chaque règle et chaque « aucune ».
- Écran : Volume (« dans la plage », « sous la plage », règle), Adhérence (« rien à mesurer »), Bilan (trois « aucune recommandation »
  sur base vide, recommandation d'entraînement avec sa règle et dans l'export Markdown) ; garde « aucun chiffre inventé » sur chaque type.
- Lancés en local (`--maxWorkers=1`) : src/features/progress, src/i18n, src/domain/review, src/domain/training/progressStats (330 tests
  verts) ; `npx tsc --noEmit -p .` et eslint des fichiers touchés : propres. Bundle et e2e : CI.

## Passe code-reviewer (à froid)

À consigner après la relecture.
