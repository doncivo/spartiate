# AUDIT-CLAUDE-0.27.0 — constats

SHA audité : `d056640910db32cc9d08b940e9a6ae9e602d3b19` (`v0.27.0`).
Format : ID, gravité, partie, fichier:ligne, scénario, preuve, correction suggérée. Sans preuve : « à vérifier ».

## Partie 4 — moteur d'entraînement

Preuves : `preuves/partie4-moteur.test.ts`, sortie `preuves/resultats/partie4-moteur.log` (11 rouges = constats, 20 vecteurs verts recalculés à la main : Epley, pondérations, confiance, cran, échelle, « Dur », plafond, position, inactivité, fatigue, décharges 5/4/6 semaines, assisté en décharge, snap barre/stack/haltères, échauffement, tables 4/5/6 semaines, pause > 21 j, séance du jour par jour de la semaine et rotation, centiles et paliers du Strength Score, haversine).

### C-001 — bloquant — exercice assisté hors décharge : progression et réductions inversées
- Fichiers : `src/domain/training/prescribe.ts:303-319` (cran sur `refLoad`), `:224-241` (position sans poids de corps), `constraints.ts:162-164` (facteurs), `prescribe.ts:275` et `:369` (`proposalOptions` sans `assisted`).
- Portée : exercice personnalisé en `load-reps` (défaut du formulaire, `LibraryView.tsx:397`) avec le matériel `assisted-pull-up-machine` → `assisted: true` (`prescriptionInput.ts:46`). L'assisté du catalogue (`pull-up-assisted`) est en `bodyweight-reps` et n'est pas prescrit (`prescribe.ts:104`).
- Scénario : 3 × 10 avec 30 kg d'assistance, « Juste », machine non décrite → **32,5 kg proposé comme une hausse** (exercice plus facile). 84 jours sans l'exercice, stack de 5 kg → **25 kg** (plus dur après une interruption, contraire à « maintien ou réduction seulement », § 11.2.6). Rang 2 dans la séance, poids de corps inconnu → **25 kg**. Les choix « −5 % » (fatigue) et « mini-deload » baissent aussi l'assistance.
- Preuve : tests rouges C-001a2, C-001b, C-001c. D-284 reconnaît l'inactivité et la Recovery hors décharge (« point laissé à Ali ») ; l'inversion du cran et la décote de position ne sont consignées nulle part.
- Correction : pour `assisted`, inverser le sens (cran = −1 incrément d'assistance, facteurs de réduction appliqués à la charge totale ou neutralisés) dans `prescribe` et `proposalOptions` ; tests sur les quatre chemins.

### C-002 — important — échauffement d'un assisté plus dur que le travail
- `src/domain/training/warmup.ts:36-58` : la rampe 40/60/80 % s'applique à l'assistance. 30 kg d'assistance au travail → échauffements à 10, 15, 20 kg d'assistance, donc plus durs que les séries de travail. Même portée que C-001.
- Preuve : test rouge C-002. Correction : aucune rampe (ou rampe inversée) quand `assisted`.

### C-003 — important — « Mettre à jour la routine » double les séries d'un exercice présent sur deux lignes
- `src/domain/training/closure.ts:162-177` : séries comptées par exercice, comparées à chaque ligne. Jour à deux lignes du même exercice (3 + 2, admis hors groupe par `validateRoutineDay`), séance faite à l'identique (5 séries) → écarts L1 3→5 et L2 2→5 ; si Ali accepte, `workoutRepository.ts:772` écrit 5 et 5 : 10 séries dans la routine.
- Preuve : test rouge C-003. Correction : apparier les séries aux lignes (par `routineExerciseId` ou par ordre) au lieu de les agréger par exercice.

### C-004 — important — recalibrage « Facile » au-delà d'un cran en confiance provisoire
- `prescribe.ts:175-176`, `:297-300` : recalibrage permis jusqu'à 0,6 de confiance, cible × 1,05. Une série 100 × 8 « Facile » (confiance 0,367 < 0,4) → **105 kg**, soit deux crans de barre ; le § 11.3 dit « < 0,4 → provisoire, hausse ≤ 1 cran ».
- Preuve : test rouge C-004. Correction : borner le recalibrage à un cran sous 0,4, ou consigner par une D-n que l'exception du § 11.2.5 prime.

### C-005 — important — charge aberrante de toute une séance reprise telle quelle, sans signalement avant l'enregistrement
- `prescribe.ts:141-145`, `:291-296` (choix B1) : 3 × 8 à 1 000 kg (faute de frappe) après 100 kg → **1 000 kg × [9, 8, 8]** prescrits, avec l'explication « vérifier ». Le § 11.5 exige « aberrantes signalées avant enregistrement » : aucun signalement dans `src/features/training` (recherche `outlier|aberran` : seulement l'explication après coup, `ExerciseProgression.tsx:108`).
- Preuve : test rouge C-005 et recherche de motifs. Correction : contrôle de saisie > 150 % du 1RM courant dans la séance active, et référence plafonnée tant que non confirmée.

### C-006 — mineur — décharge « arrondie vers le bas » qui ajoute une répétition
- `prescribe.ts:256-258` : en décharge sans journée rouge, `snapToEquipment` (et non `snapDownAtLeastMin`). Haltères 26 kg × 10, décharge × 0,9 → 22 kg × **11** (écart 6,4 % > 3 %). D-269 dit « arrondie vers le bas » ; la journée rouge, elle, n'ajoute rien.
- Preuve : test rouge C-006. Correction : `snapDownAtLeastMin` en décharge, ou D-n qui assume la répétition ajoutée.

### C-007 — mineur — grille de barre sans contrôle des disques réellement montables
- `loadGrid.ts:46-54` : pas réguliers de la barre seule à « barre + tous les disques ». Disques par côté {20, 2,5} → 45 kg proposé, impossible à monter. Concerne surtout un profil maison.
- Preuve : test rouge C-007. Correction : grille par combinaisons de disques (sous-ensembles par côté).

### C-008 — important — distance GPS gonflée à l'arrêt
- `src/domain/cardio/track.ts:19-23`, `:61` : précision admise jusqu'à 50 m, pas minimal 3 m. 61 points immobiles alternant à 10 m, précision 20 m → **600 m** comptés pour 0 m réel ; la distance est proposée à l'enregistrement.
- Preuve : test rouge C-008. Correction : pas minimal lié à la précision (`max(3, accuracyM)`).

### C-009 — mineur — Recovery Split : seuil 50 % contre « ≥ 80 % » du § 12.1, commentaire faux
- `recoverySplit.ts:31-34`, `config.ts:112-114` : seuil 50 % (D-93 (2)) ; le commentaire dit « le PRD ne fixe pas le seuil », or le § 12.1.1 dit « muscles ≥ 80 % ». Muscle à 79 % → `ready`.
- Preuve : test rouge C-009. Correction : corriger le commentaire et faire trancher l'écart PRD/D-93 par Ali (amendement du § 12.1 ou du seuil).

### C-010 à C-030 — mineurs, améliorations et points à vérifier (lecture, sans test rouge)
- C-010 mineur — `closure.ts:164` : les séries `drop` et `partial` comptent dans l'écart de routine (3 séries + 1 dégressive → proposition 3→4 séries de travail). Correction : compter `work`/`timed` seulement.
- C-011 mineur — `closure.ts:46-52`, `:81-100`, `exerciseSheet.ts:60-69` : tonnage et records d'un assisté comptent l'assistance (plus d'assistance = record « charge »). Même portée que C-001.
- C-012 mineur — `generateSession.ts:44-47` : 45 s par série quelle que soit la métrique ; planche 3 × 60 s estimée 255 s au lieu de ≥ 300 s.
- C-013 mineur — `generateSession.ts:258-261` : plages 5–10 / 8–15 du § 12.1.4 appliquées seulement à une substitution ; une ligne composée en 12–15 garde 12–15 en mode Guidé (à faire trancher : D-86 ne couvre que le non-retrait).
- C-014 mineur — `replay.ts:79` : `doneAt` illisible → comparateur NaN, ordre indéfini au lieu de l'ordre par position.
- C-015 mineur — `circuit.ts:93-95` : un exercice dont seules les séries d'échauffement portent le `circuitId` compte comme membre du groupe.
- C-016 amélioration — `session.ts:133` : `isCompletedWorkSet` inutilisée hors tests, compte `drop`/`partial` comme travail (piège).
- C-017 mineur — `programDay.ts:46-55` : dernier jour fait vidé ensuite → la rotation repart de l'avant-dernier (A, B, C ; C fait puis vidé, A avant → B proposé au lieu de A). Ambigu dans D-243.
- C-018 à vérifier (partie 7a) — `programDay.ts:68-80` : `programDayFor` ignore la séance déjà close du jour ; le lundi reste proposé après la séance du lundi.
- C-019 mineur — `programDay.ts:61`, `:87` : jour de la semaine non entier accepté (2,5 rendu comme prochain jour) ; `weekdayFromDayName` rend 1 pour « Lundi2 » et « Lundi_x » (« mot entier » de D-317 limité aux lettres).
- C-020 important, à vérifier (partie 7a) — `features/training/cycle/CycleView.tsx:118`, `:241` : l'interrupteur « Semaine de reprise » est prérempli avec la réponse de l'onboarding à chaque ouverture ; un cycle lancé de zéro après un cycle arrêté repartirait avec la reprise (D-267, D-315 : premier cycle seulement).
- C-021 mineur — `recoverySplit.ts:332-333` : arrondi avant la comparaison au seuil (49,6 % → 50 % → prêt).
- C-022 mineur — `track.ts:57` : premier point GPS sans contrôle (un premier point décalé de 300 m bloque les suivants une vingtaine de secondes puis ajoute environ 300 m) ; `track.ts:62-63`, `:104` : au-delà de 10 000 points, l'allure du dernier kilomètre reste figée sur un ancien kilomètre.
- C-023 mineur — `strengthScore.ts:151` : à score égal, le premier mouvement l'emporte sans regarder la borne (« 99 » affiché au lieu de « > 99 »).
- C-024 à vérifier (partie 7a) — `pull-up`, `chin-up`, `dips` ont `bodyweightFraction: null` ; le Strength Score ajoute le poids de corps à la charge saisie (D-312) : double compte si l'écran de séance fait saisir le poids total.
- C-025 mineur — `constraints.ts:83-84`, `prescribe.ts:121`, `:187-190` : inactivité comptée en tranches de 24 h depuis `endedAt` et non en jours civils ; dates comparées comme chaînes ISO (juste seulement au même format UTC).
- C-026 à vérifier — `prescribe.ts:124-140` : une décision datée après la dernière séance est rendue sans contraintes (décharge, inactivité, journée rouge) ; dépend de l'horodatage de `decided_at`.
- C-027 mineur — `prescribe.ts:321-324` : « Dur » bloque le cran mais pas l'échelle de répétitions ([8, 7, 6] « Dur » → [8, 8, 6]) ; § 11.2.5 ambigu.
- C-028 mineur — `estimate1rm.ts:107-111`, `:123-124` : la confirmation d'une aberrante compte les séances partielles et de décharge ; une faute de frappe à la toute première séance n'est jamais aberrante et pèse sur le 1RM pendant trois séances.
- C-029 mineur — `loadGrid.ts:31` : `stackMaxKg` NaN (ligne synchronisée abîmée) → 2 000 charges ; `:72-74` une seule poulie retenue ; `:57-84` matériel `forbidden` non filtré.
- C-030 mineur — `warmup.ts:50-58` : exercice lesté, échauffement calculé sur le lest seul (≈ 95 % de la charge totale).
