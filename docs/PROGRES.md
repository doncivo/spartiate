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
  valeur écrite (« Cette semaine : 12 · moyenne par semaine : 9,5 ») et barres en SVG décoratif doublées d'une étiquette textuelle
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
- Aujourd'hui (§ 18.2) : carte « Constance » (streak et semaine en cours), servie par le bloc à la demande `TrainingProgress`, déclarée
  dans `TodayScreen.tsx` (hors départ, comme `TodayPcSide`) ; bundle de départ inchangé (mesure ci-dessous).
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

- product-owner : critères ci-dessus, écrits avant le premier test (commit rouge `da3da563`).
- agent du module (training, recovery, domain-logic) : un commit rouge puis un commit vert par sous-ticket (tableau ci-dessous). Règles
  pures dans `src/domain/training/progressStats.ts` et `src/domain/recovery/trends.ts` (+ `recoveryZoneTier` dans `recoveryScore.ts`) ;
  constantes dans `config.ts` (`DEFAULT_PROGRESS_CONFIG`) ; lectures `WorkoutRepository.closedSince` et `closedStarts` (lecture seule) ;
  écran `src/features/progress/TrainingProgress.tsx` (Constance, Adhérence, Volume), `TodayStreak.tsx`, `constancyData.ts` ;
  `src/features/recovery/RecoveryTrends.tsx` ; catalogues `fr.trainingProgress.ts` (nouveau, chargé avec le bloc), `fr.recovery.ts`,
  `fr.recoveryFactors.ts`.
- qa-test (`progressStats.qa.test.ts`) : pause en cours sans fin, objectif nul, séance future, février de 28 jours avec semaine du samedi,
  muscle de poids nul, valeur non finie, bornes 33 / 34 / 65 / 66 de la zone, équivalence `pausedOn` / `isPausedOn` sur 70 jours.
  Deux tests rouges de PROGRES-b corrigés dans le commit vert (dit dans son message) : 0 et 1 s'accordent au singulier (FIX-0241).
- code-reviewer (relecture du diff à froid, même agent) : aucune écriture en base, aucune table publiée ni migration, ni `src/sync/**` ni
  `src/domain/sync/**` ; ni `prescribe.ts` ni `library/**` (MOTEUR-0281) ; textes en i18n, jetons seulement, chiffres tabulaires, barres
  et courbes doublées d'un texte (`role="img"` + étiquette, valeurs écrites) ; eslint propre sur les 30 fichiers touchés, `tsc` propre ;
  854 tests ciblés verts. Point relevé et accepté : quatre petites règles recopiées (début de semaine, pause, date locale, durée) pour ne
  pas scinder les blocs du départ ; chacune le dit en commentaire, la pause est gardée par un test d'équivalence.

## Commits (rouge puis vert, D-374)

| Sous-ticket | Rouge | Vert |
| --- | --- | --- |
| PROGRES-a volume | `da3da563` | `f1f4a3fe` |
| PROGRES-b constance | `e9f96d61` | `cf5eac21` |
| PROGRES-c tendances, zone cible | `e423c272` | `faac5568` |
| PROGRES-d adhérence | `a24f1c13` | `6062e91f` |
| Bundle et qa-test | — | `989fa890` |

## Mesure du bundle de départ

`CI=1 npx vitest run --config vitest.bundle.config.ts tests/bundle/startBundle.test.ts` : origin/main 773e881a **45 blocs, 193 956 octets
normalisés** ; branche **45 blocs, 193 956 octets normalisés** (inchangé). Première version verte : 47 blocs, 194 492 (+536) : `week.ts`,
`formatPrefs.ts` et `localDate.ts` sortis de leurs blocs, blocs partagés (`display`, `currentCycle`, `loadDisplay`, `programPause`) ajoutés aux
listes de préchargement du bloc d'entrée, exports de `localDate` en plus ; corrigé dans `989fa890` sans toucher au départ ni à la liste blanche.

## Décisions proposées (numéros à donner par l'appelant)

1. Volume (§ 17.1) : séries validées de travail et chrono (échauffement, drop, partielle exclus), chaque muscle compté pour son poids du
   contenu (§ 14.1), non « moitié » ; séance rattachée au jour local de son début ; semaine au réglage « Début de semaine ». Révisable par Ali.
2. « vs plage » (§ 17.1) : aucune plage de séries par muscle dans le PRD : volume affiché sans plage ni jugement. **À trancher par Ali**
   (exemple courant : 10 à 20 séries par semaine et par muscle principal).
3. Streak en semaines : objectif = jours du programme suivi (jours de la semaine rattachés, sinon jours garnis) depuis le début du cycle,
   1 séance avant ou sans programme ; semaine en cours ajoutée si atteinte, jamais cassante ; semaine non atteinte contenant un jour de pause
   gelée (§ 12.6). Révisable par Ali.
4. Adhérence (I2) : 4 dernières semaines complètes, faites plafonnées à l'objectif, semaines de pause ou d'avant le cycle non comptées ;
   sans programme : non calculée. Le § 8 peut aussi se lire « part des prescriptions acceptées » (`recommendation_decision.accepted`) :
   **à trancher par Ali** ; la règle du brief est appliquée.
5. Tendances de récupération : moyenne 30 j, 7 j, min, max, jours mesurés ; aucune flèche de tendance (aucun seuil dans le PRD). Zone cible
   affichée sous le cadran Exertion d'Aujourd'hui, avec son sens (haute / moyenne / basse). Révisable par Ali.
6. Graphiques : SVG simples accessibles (barres et courbes), Recharts toujours non importé (C-167 : dépendance déclarée, inutile pour ces
   vues ; la retirer de `package.json` relève d'un ticket à part). Révisable par Ali.

## Constats d'Ali à faire (iPhone et PC, données réelles)

- Progrès : cartes Constance (série, semaine, calendrier du mois), Adhérence, Volume par muscle ; valeurs cohérentes avec ses séances.
- Aujourd'hui : carte Constance sous la carte Séance (iPhone et PC) ; zone cible sous le cadran Exertion.
- Progrès › Récupération : « Tendances sur 30 jours », quatre courbes lisibles en mode clair et sombre ; VoiceOver lit les valeurs.
- Réglage « Début de semaine » sur dimanche : calendrier et semaines suivent.

## Écarts au brief

- Part du muscle secondaire : poids du contenu (§ 14.1) au lieu de « moitié » (le brief demandait de suivre le PRD s'il le dit).
- Records en séance (§ 17.1 « notification en séance ») : **reporté** (toucherait l'écran de séance active, non trivial).
- Budget L : environ 250 k consommés ; rien à signaler.
