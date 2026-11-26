# PROG-0301b — calculs purs de Corps › Mesures (lot 0.30.1)

Budget M (nutrition et récupération, domain-logic). Registre : BL-178. Décisions lues : D-705 à D-708, D-710, D-711, D-713, D-715, D-716,
D-718 ; ajoutées : D-730 à D-734 (choix prudents). Chapitres : 17.1 (Progrès, ligne « Corps »), 10.2 (profil), 15.1 (tendance des pesées).
Préparation : docs/PROGRES-0301.md. Aucun écran, aucun texte, aucune table, aucune migration, aucun fichier de synchro.

## Passes

- **product-owner** — Périmètre : modules purs neufs de `src/domain/bodyProgress` (sans import React ni Tauri, D-711), tests sur des valeurs
  inventées ; hors périmètre : src/features, src/ui, src/i18n, src/domain/training, module santé, réglage et rappel (BL-180), écran (BL-179),
  repères des ratios (BL-181, D-717 : aucun champ de repère). Critères :
  1. Given une zone avec une mesure 28 jours avant la dernière et un écart de −1 cm, When l'objectif est « perte », Then tendance « baisse »
     favorable ; « prise » : favorable pour le tour de taille, défavorable ailleurs ; « maintien » : défavorable ; sans objectif : neutre.
  2. Given un écart absolu sous 0,5 cm, Then « stable », neutre ; Given moins de 2 mesures ou une référence à moins de 14 jours, Then
     « pas assez de mesures », neutre (D-716) ; la référence suit l'écran actuel (28 à 42 jours, sinon la plus ancienne retenue).
  3. Given des mesures `health_*`, `note_*` ou `visbody_*` dans la liste, Then elles n'entrent ni dans la tendance, ni dans les ratios, ni
     dans la symétrie, ni dans la dernière séance de mesures (D-713, D-715).
  4. Given une hauteur de profil, Then elle sert aux ratios ; sans elle, la dernière hauteur de Santé ; une différence de plus de 2 cm est
     signalée ; sans hauteur, taille / hauteur est « inconnu », jamais 0 (D-707, D-715).
  5. Given les deux zones d'un ratio à plus de 7 jours d'écart, Then « inconnu » ; évolution = valeur actuelle moins valeur à la première
     date de la période où les deux zones sont mesurées à 7 jours au plus d'écart, sinon « inconnu » (D-718).
  6. Given un côté gauche et un côté droit à 7 jours au plus, Then écart en cm (dixième) et en % de la moyenne, signalé strictement au-dessus
     de 2 % avec le côté le plus grand ; sinon « pas de mesure récente des deux côtés » (D-718).
  7. Given au moins 2 mesures sur au moins 14 jours dans la période, Then rythme par mois = pente des moindres carrés × 30,44 ; sinon
     « inconnu » (D-718).
  8. Given des pesées, Then évolution du poids = tendance (`computeTrend`) à la fin moins au début de la période ; moins de 14 pesées :
     « en apprentissage », jamais 0 (D-718).
  9. Given une dernière mesure saisie et un rythme de 7, 14 ou 28 jours, Then dernière séance, jours écoulés, prochaine conseillée ; échéance
     passée : « aujourd'hui », jamais un nombre négatif ; sans mesure : aucune séance, sans prochaine (D-713).
- **domain-logic** — Six modules purs neufs dans `src/domain/bodyProgress` (non réexportés par `index.ts` : l'écran de BL-179 les
  importera directement, le bundle de départ ne change pas) : `period.ts` (périodes, série d'une zone, arrondis), `zoneTrend.ts`
  (`zoneTrend`, `zoneTrends`, `monthlyRate`), `ratios.ts` (`resolveHeight`, `bodyRatio`, `bodyRatios`, sans repère), `symmetry.ts`
  (`symmetry`, `symmetryAll`), `weightEvolution.ts` (sur `computeTrend` et `isTrendLearning` de la nutrition), `measurementSchedule.ts`
  (`lastMeasurementSession`, `measurementSchedule`, `parseMeasurementRhythm`). Choix non tranchés : D-730 à D-734. Aucun import React ni
  Tauri ; aucune table, aucun écran, aucun texte.
- **qa-test** — à compléter.
- **code-reviewer** — à compléter.
