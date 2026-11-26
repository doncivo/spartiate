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
     « pas assez de mesures », neutre (D-716) ; la référence suit l'écran actuel (une mesure 28 à 42 jours avant ; sinon la plus récente des mesures
     de plus de 28 jours ; sinon la plus ancienne).
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
- **qa-test** — Rouge : `299e9efc` (5 fichiers de tests, modules absents). Vert : `226b34aa`. Suite du module
  (`CI=1 npx vitest run --coverage.enabled=false src/domain/bodyProgress`) : 9 fichiers, 89 tests verts ; `npm run typecheck` et
  `npm run lint` verts ; contrôles documentaires (docs-paths, agents, backlogCount, privacy, prudentReview) : 47 tests verts. Valeurs
  attendues calculées à la main (pentes, ratios, évolutions, symétrie, périodes, échéances) ; toutes les valeurs sont inventées.
- **code-reviewer** — Relecture à froid par un agent distinct, sur le diff : « approuvé », aucun bloquant (valeurs recalculées, balayage
  de la borne de 2 % sans faux signalement, couches et absence de repère vérifiées). Remarques reprises : arrondi symétrique (`roundTo`),
  regex stricte du rythme (`/^(7|14|28)$/`), référence de la tendance précisée (critère 2 et D-730), tests ajoutés (hauteur du profil hors
  bornes remplacée par Santé, taille / hauteur avec une seule taille, premier jour de période inclus) ; rouge `8b524a71` (2 tests rouges
  sur l'ancien code), vert au commit suivant, 93 tests verts. Laissées à BL-179 : brancher l'écran sur `zoneTrend` et retirer
  `summarizeZone` (règle en double, src/features/bodyProgress/bodyZone.ts) ; filtrer les mesures datées après la fin pour la valeur
  actuelle des ratios, de la symétrie et de la tendance (aujourd'hui seule la séance de mesures les écarte, D-734).

## Q-41 tranchée (Ali, 26/11, D-745)

- Réponse A pour les quatre ratios. `ratioReference(kind, valeur, sexe)` dans `src/domain/bodyProgress/ratioReferences.ts` (pur) :
  taille / hauteur en bandes NICE avec « non valable si IMC ≥ 35 » ; taille / hanches < 0,90 homme, < 0,85 femme, « populations
  européennes », sans sexe aucun repère ; épaules / taille sans repère ; poitrine / taille 1,30 à 1,35 chez l'homme, « esthétique, sans
  valeur santé ». Affichage : BL-179 (écran), aucun texte ici.
- Rouge `d092fea3` (8 tests en échec, module absent) ; vert `d6c60752`. qa-test : `src/domain/bodyProgress` 101 tests verts, lint,
  typage. code-reviewer : domaine pur, aucune dépendance nouvelle, bornes au centième comme la valeur affichée ; approuvée.
