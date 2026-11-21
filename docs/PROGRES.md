# PROGRES — Progrès : volume, constance, tendances de récupération, adhérence (lot 0.28.1, phase 3, point 3.2)

Budget L (400 k). Chapitres : § 17.1 (indicateurs), § 16.3 (zone cible), § 18.2 (Aujourd'hui : streak), § 14.1 (poids des muscles),
§ 12.6 (pause : streak gelé), § 8 (I2 : adhérence). Constats : C-191, C-167. Base : origin/main 773e881a. Aucune donnée réelle ; valeurs
synthétiques. Une branche, une PR (D-374) : un commit rouge puis un commit vert par sous-ticket. Ni `src/sync/**`, ni `src/domain/sync/**`,
ni migration, ni table publiée touchés ; ni `src/domain/training/prescribe.ts` ni `src/features/training/library/**` (branche MOTEUR-0281).

## Périmètre et critères (product-owner)

### PROGRES-a — Volume par muscle et par semaine (§ 17.1)

- Règle pure `src/domain/training/progressStats.ts` (`weeklyMuscleVolume`) : séries validées (`done`) de séances closes ; types comptés :
  travail et chrono (échauffement, drop et partielle exclus) ; chaque série compte, pour chaque muscle de l'exercice, le **poids du muscle
  du contenu** (§ 14.1 : `chest 1.0`, `triceps 0.5`, `front-delts 0.3`) : le PRD fixe la part du secondaire, la règle « moitié » du brief
  ne s'applique donc pas. 8 semaines glissantes (la semaine en cours comprise), semaine commençant au réglage « Début de semaine » (lundi
  par défaut), séance rattachée au jour local de son début. Exercice inconnu (supprimé du contenu) : séries comptées à part, dites.
- Given 2 séances synthétiques (développé couché 3 × travail + 1 échauffement ; rowing 2 séries dont 1 non validée), When on calcule à la
  date du jour, Then pectoraux 3, triceps 1,5, deltoïdes antérieurs 0,9, grand dorsal 1 (poids du rowing) cette semaine ; les semaines sans
  séance valent 0 ; l'ordre est par total décroissant puis identifiant.
- Écran Progrès › Volume (bloc à la demande `TrainingProgress`, catalogue `fr.trainingProgress` chargé avec lui) : une ligne par muscle avec
  valeur écrite (« 12 séries cette semaine · moyenne 9,5 sur 8 semaines ») et barres en SVG décoratif doublées d'une étiquette textuelle
  (`role="img"`, valeurs semaine par semaine) ; aucune couleur seule. « vs plage » (§ 17.1) : aucune plage dans le PRD → non affichée,
  décision proposée.
- Repository : `WorkoutRepository.closedSince(fromIso)` (séances closes non supprimées commencées à partir de l'instant, séries vivantes,
  2 requêtes) ; lecture seule, aucun changement de schéma.

### PROGRES-b — Constance : streak, séances par semaine, calendrier (§ 17.1, § 18.2, § 12.6)

- Règle pure (`constancy`) : objectif hebdomadaire = jours du programme suivi (cycle actif : jours de la semaine rattachés, sinon jours garnis
  de la routine) à partir de la semaine de début du cycle ; avant, ou sans programme suivi : 1 séance. Streak = semaines consécutives
  atteignant l'objectif, en remontant depuis la semaine passée ; la semaine en cours s'ajoute si l'objectif est déjà atteint et ne casse
  jamais la série ; une semaine non atteinte qui contient un jour de pause est gelée (ni comptée ni cassante, § 12.6).
- Given objectif 3, semaines S-1, S-2 à 3 séances, S-3 en pause à 0, S-4 à 3, S-5 à 2, When on calcule, Then streak 3 semaines.
- Calendrier du mois courant : grille de semaines (début de semaine du réglage), chaque jour dit en texte (« 12 novembre : 1 séance »,
  « en pause ») ; séances / semaine : cette semaine x sur objectif.
- Aujourd'hui (§ 18.2) : carte « Constance » (streak et semaine en cours), bloc à la demande déclaré dans `TodayScreen.tsx` (hors départ,
  comme `TodayPcSide`) ; bundle de départ inchangé (mesure ci-dessous).
- Repository : `WorkoutRepository.closedStarts()` (débuts des séances closes non supprimées, une colonne).

### PROGRES-c — Tendances de récupération sur 30 jours et zone cible (§ 17.1, § 16.3)

- Règle pure `src/domain/recovery/trends.ts` (`recoveryTrends`) : 30 jours finissant aujourd'hui, depuis `recovery_day` ; par mesure
  (Recovery, HRV, FC repos, sommeil) : points par jour (absents = `null`, jamais 0), nombre de jours mesurés, moyenne 30 j, moyenne 7 j,
  min et max. Aucune interprétation de tendance (aucun seuil dans le PRD).
- Given 30 jours synthétiques dont 2 sans mesure, Then 28 points, moyennes arrondies (Recovery entier, HRV et FC à l'unité, sommeil en
  minutes) ; Given aucun jour, Then « aucune mesure » dit, pas de graphique.
- `RecoveryProgress.tsx` : carte « Tendances sur 30 jours », une courbe SVG par mesure, `role="img"` et étiquette avec moyenne, min, max.
- Zone cible (§ 16.3, déjà calculée et stockée) : cadran Exertion d'Aujourd'hui, « Zone cible : 6 à 8 » et son sens en texte (« Récupération
  haute (66 ou plus) : effort soutenu possible » / moyenne 34–65 / basse 33 ou moins : effort léger) ; `null` : rien.

### PROGRES-d — Adhérence (I2, § 8)

- Règle pure (`adherence`) : 4 dernières semaines complètes ; séances prévues = objectif du programme suivi ; faites = séances closes de
  la semaine, plafonnées à l'objectif (une séance en plus ne compense pas une autre semaine) ; semaine avant le début du cycle ou contenant
  un jour de pause : non comptée. Sans programme suivi : non calculée, dit.
- Given objectif 3, semaines 3, 2, 4, 1 → (3 + 2 + 3 + 1) / 12 = 75 %. Given une semaine en pause → 3 semaines comptées.
- Progrès : « Adhérence : 75 % (9 séances faites sur 12 prévues, 4 dernières semaines) » et la règle en une phrase.

### Hors périmètre ou reporté

- Records en séance (§ 17.1 « notification en séance ») : non trivial sans toucher la séance active (SESS-01 vient d'y passer) → reporté.
- Recharts : non importé (C-167) ; SVG simple accessible à la place (voir décisions).

## Journal des passes

À remplir au fil des passes.
