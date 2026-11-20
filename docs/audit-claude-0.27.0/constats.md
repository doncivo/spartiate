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

### C-005 — **bloquant** (reclassé en partie 7a) — charge aberrante de toute une séance reprise telle quelle, sans signalement avant l'enregistrement
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

## Partie 5 — nutrition et compléments

Preuves : `preuves/partie5-nutrition.test.ts`, sortie `preuves/resultats/partie5-nutrition.log` (6 rouges = constats ; 8 vecteurs verts : cible en vigueur D-314 à trois lignes, moyenne hebdo repos/entraînement, écart par les glucides jamais négatifs, check-in ±150, plancher de lipides 0,6 g/kg, plancher 1 200, tendance EMA, dépense mesurée 21 j = 2 737,03, Mifflin-St Jeor, totaux d'un jour, recette en 3 portions, EAN-13/EAN-8, masque ISO des compléments, instants aux deux changements d'heure, « Pris »).
Ce qui part vers Open Food Facts (`src-tauri/src/off.rs`) : GET HTTPS du code (8 à 14 chiffres) ou du texte cherché, champs `code,product_name,brands,quantity,nutriments`, User-Agent `Spartiate/<version> (usage personnel)`, sans referer ni corps, aucune donnée corporelle ; journal : code d'événement et statut seulement.
Hors constat : sel, sodium, repères de qualité et micronutriments (§ 15.7) ne sont pas implémentés (I6) ; le sel et le sodium remontés par Rust sont ignorés par `offProductToDraft`.

### C-031 — important — check-in à deux cibles : la cible de repos passe sous le plancher, refus à « Accepter »
- `src/domain/nutrition/checkIn.ts:111-123`, `:142-167`, `:199` : plancher et `belowStandardFloor` évalués sur la moyenne hebdomadaire, puis le même écart appliqué à la cible de repos sans borne. Entraînement 1 300, repos 1 250, dépense 1 100, 70 kg → repos **1 164 kcal**, `belowStandardFloor` faux. À « Accepter », `validateTargetRecord` (`targetRecord.ts:55-57`) refuse `min(kcal, rest.kcal)` < 1 200 : erreur au lieu d'une demande de confirmation, rien n'est écrit.
- Preuve : test rouge C-031. Correction : borner chaque cible au plancher, ou lever `belowStandardFloor` sur la plus basse.

### C-032 — important — correction des grammes d'une entrée : arrondis cumulés enregistrés
- `src/domain/nutrition/journal.ts:107-112` (`rescaleEntry`), enregistré par `EntryEditor.tsx:38` : le calcul repart des totaux arrondis au dixième. 100 g à 14 kcal → 1 g → 100 g : **10 kcal** enregistrés.
- Preuve : test rouge C-032. Correction : garder les valeurs pour 100 g (ou non arrondies) dans l'entrée.

### C-033 — important — Open Food Facts : kcal pris tel quel même s'il contredit le kJ
- `src/domain/nutrition/offProduct.ts:53` : `energy-kcal_100g` prioritaire ; kcal 0 avec 1 500 kJ et macros 10/5/60 → **0 kcal** (attendu ≈ 359) ; `energyMismatch` avertit seulement.
- Preuve : test rouge C-033. Correction : si kcal × 4,184 s'écarte du kJ de plus de 15 %, prendre kJ / 4,184 et le signaler.

### C-034 — important — Quick Add sans borne ni cohérence sur les macros
- `src/domain/nutrition/mealEntry.ts:100-103` : 100 kcal avec 5 000 g de protéines → aucune erreur.
- Preuve : test rouge C-034. Correction : plafond par macro et contrôle 4P + 4G + 9L ≤ kcal + marge.

### C-035 — mineur — rappel de complément perdu le jour du passage à l'heure d'été
- `src/domain/supplementNotificationPlan.ts:54` : comparaison d'heures murales ; complément à 02:30, replanification le 29/03/2026 à 03:10 → le rappel du jour (qu'iOS sonnerait à 03:30, `notificationInstant.ts:83`) sort du plan et `replace` l'annule (`tauriNotifications.ts:300`).
- Preuve : test rouge C-035. Correction : laisser la plateforme écarter le passé (elle le fait déjà) ou comparer des instants.

### C-036 — important — lissage de la dépense sur 7 jours (§ 15.1) jamais appliqué
- `src/features/nutrition/useCases.ts:96`, `:112` : seuls appels à `estimateTdee`, tous deux avec `previousSmoothed: null` (recherche de motifs) → `measuredSmoothed` = mesure brute. Lié : `tdee.ts:126`, `smoothTdee` avec un pas nul rend la valeur précédente et ignore la mesure (2 500 / 2 800 / pas 0 → 2 500).
- Preuve : recherche `previousSmoothed` (2 appels, null) et test rouge C-036. Correction : persister la dernière valeur lissée et la passer ; pas nul = remplacer ou moyenner.

### C-037 à C-048 — mineurs, améliorations et points à vérifier (lecture)
- C-037 mineur — `restDay.ts:350-357`, `:363-366` : glucides ramenés à 0 sans recalcul des kcal (1 500 kcal annoncées pour des macros à 1 700) ; `floor` dans `restTargetFromGap`, `round` dans `shiftTarget` (199 contre 200 g).
- C-038 à vérifier (D-74) — `checkIn.ts:129` : premier check-in sans cible en cours, couverture non contrôlée (`days` et `weighIns` vides → proposition).
- C-039 mineur, à trancher (D-113) — `renphoDay.ts:79` avec `dayTotals.ts:72-80` : un jour importé de Renpho (une entrée à 00:00) n'est jamais complet, donc jamais dans la dépense mesurée ni la couverture.
- C-040 mineur — `targetRecord.ts:79-91`, `:107` : horloge d'appareil en avance → date de décision future qui passe devant une cible prévue ; HLC illisible classé au-dessus de tout HLC valide à prise d'effet égale (comparaison de chaînes), alors que D-314 (9) ne lui donne que la semaine.
- C-041 mineur — `dayTotals.ts:19-26` : totaux du jour non arrondis (0,1 + 0,2 = 0,30000000000000004).
- C-042 à trancher (D-75) — un seul aliment à lipides « traces » ou un Quick Add sans macros rend inconnus les lipides de toute la journée et le restant (les kcal ne sont pas touchées).
- C-043 mineur — `barcode.ts:38-41` : code à 8 chiffres valide en EAN-8 et en UPC-E toujours lu en EAN-8 ; le format rapporté par le scanner n'est pas transmis.
- C-044 mineur — `recipe.ts:121-124`, `:212` : `servings` à 0 → Infinity ; recette vide avec poids cuit → entrée toute à `null` acceptée par `validateMealEntry` (données corrompues seulement).
- C-045 mineur — `foodSearch.ts:38` : UPC-A tapé sur 12 chiffres ne retrouve pas la fiche en cache (stockée sur 13) ; `normalizeText('Straße')` → « stra e ».
- C-046 mineur — `src-tauri/src/off.rs:422` : virgule remplacée par un point, « 1,234 » (milliers) → 1,234.
- C-047 amélioration — `src/platform/photoImage/picker.ts:41` : aucun plafond de taille avant `createImageBitmap` (mémoire iPhone) ; `offLookup.ts:81` : fiche périmée perdue si OFF répond « not-found ».
- C-048 mineur et à vérifier — compléments : « Pris » silencieux quand l'heure a changé ou le complément est supprimé (`supplementActions.ts:111-116`) ; file d'actions illisible ou tronquée à 200 clés → une prise décochée peut être recochée (contraire à D-252, fenêtre étroite) ; priorité entre plans selon l'ordre des passages et non D-212 (`supplementNotifications.ts:97`, à vérifier) ; heures calmes non appliquées aux compléments (à trancher) ; registre illisible → `pending()` vide, rappels coucher et matin retirés par le `replace` des compléments (`tauriNotifications.ts:461`, à vérifier).

## Partie 6 — récupération et dossier Santé

Preuves : `preuves/partie6-recuperation.test.ts`, sortie `preuves/resultats/partie6-recuperation.log` (7 rouges = constats ; 7 vecteurs verts : baseline 14 nuits moyenne 50 σ √(350/13), Recovery 67 et 74, besoin de sommeil 582, nuit du 25/10 à cheval sur le changement d'heure 540 min, fichier sommeil à stades 520 min endormi / 565 au lit, récupération des quadriceps 25 % à 24 h, HRV à virgule avec BOM/CRLF/doublon/sans fuseau, FC repos, pesées au changement d'heure, livres → 81,65 kg, masse grasse 0,269 → 26,9 %).
Vérifié sans défaut (lecture) : bornes 0-100 et abstention jamais 0, journée rouge ≤ 33, union des intervalles de sommeil, nuit rattachée au réveil, siestes écartées, dette bornée [0, 180], `health_files_read` (liste blanche fermée de 14 noms, lien ou dossier refusé, ≤ 2 Mio, aucun chemin renvoyé), journaux sans valeur corporelle.

### C-049 — important — baseline : l'exclusion des aberrantes (> 2,5 σ) ne peut rien exclure sur 7 ou 8 nuits
- `src/domain/recovery/baseline.ts:29` : exclusion en une passe avec moyenne et σ de l'échantillon complet ; aucune valeur ne peut dépasser (n − 1)/√n σ, soit 2,27 σ pour 7 nuits et 2,47 σ pour 8. HRV [48, 50, 52, 50, 48, 52, 200] → rien d'exclu, moyenne 71,4, σ 56,7. Nuit suivante à HRV 30, FC repos dans sa moyenne : z HRV **−0,73** au lieu de ≤ −2, score ≈ 41 au lieu de ≈ 25 : **la journée rouge (≤ 33) n'est pas proposée** et les charges ne sont pas modulées.
- Preuve : tests rouges C-049 (exclusion, puis z HRV). Conforme à la lettre du § 16.3, sans effet en début d'apprentissage. Correction : médiane et MAD, ou σ calculé sans la valeur testée.

### C-050 — important — proposition d'heure de coucher avancée de 3 h par une nuit non valide
- `src/domain/recovery/bedtimeProposal.ts:25` : la dette retient toute nuit à `asleepMinutes` non nul, sans le seuil de 180 min de D-130 (que `debtNights` et le résumé du jour appliquent). 13 nuits de 450 min et une de 120 min → besoin **630 min, coucher 20:30** au lieu de 450 min, 23:30. Le rappel de coucher suit cette heure.
- Preuve : test rouge C-050. Correction : réutiliser `debtNights(...).valid` ; écrire si la nuit du jour est dans la fenêtre (D-130 dit « aujourd'hui exclu »).

### C-051 — mineur — Exertion : une séance à date illisible fait planter le résumé du jour
- `src/domain/recovery/exertion.ts:15`, `:34` : `new Date(NaN).toISOString()` lève `RangeError` (le cardio est protégé ligne 43, pas la musculation) ; `summarizeRecoveryDay` plante pour tous les jours.
- Preuve : test rouge C-051. Correction : ignorer la séance si `Date.parse` est NaN. Source d'une telle valeur non vérifiée.

### C-052 — important — `pas.csv` : totaux partiels qui écrasent les totaux complets
- `src/domain/recovery/shortcutFiles.ts:78-79` (`MAX_LINES = 10_000`, premières lignes gardées) avec le guide (« Plus ancien en premier ») : au-delà de 10 000 lignes, les jours les plus récents disparaissent en silence (`truncated` seulement), et le jour coupé reçoit un total partiel. Même effet sur le premier jour d'une fenêtre « 30 derniers jours » commencée à l'heure de l'export : `upsertTotals` (`recoverySampleRepository.ts:59-62`, via `recoveryImport/service.ts:172-175`) remplace 8 000 pas par 1 200. `pas.csv` reste UNVERIFIED (H-25).
- Preuve : test rouge C-052 (10 000 lignes du 01/11 puis une du 02/11 → 02/11 absent) ; écrasement par lecture (`upsertTotals` remplace toute valeur différente). Correction : garder la fin du fichier, ne jamais réécrire le premier jour, ou n'accepter qu'un total plus grand.

### C-053 — mineur — fuseau invalide : exception au lieu d'un rejet
- `shortcutFiles.ts:89` avec `timeZone.ts` (`utcToLocal` lève `RangeError`) ; `parseBodyFile` est appelé hors `try` (`healthBodyImport/service.ts:324`) : tout l'import corps s'interrompt.
- Preuve : test rouge C-053. Correction : rejet `bad_timezone` ou fuseau de repli UTC signalé.

### C-054 à C-062 — mineurs, améliorations et points à vérifier (lecture)
- C-054 mineur — `shortcutWeights.ts:69` : 3e colonne vide (`…;81.4;`) rejetée par l'import au sélecteur, acceptée par le lecteur du dossier (`bodyShortcutFiles.ts:106`). Test rouge C-054.
- C-055 mineur — `bodyShortcutFiles.ts:152` (`>=`) : deux pesées au même instant, valeurs différentes → la dernière ligne gagne, résultat dépendant de l'ordre du fichier.
- C-056 mineur, à vérifier — fichier remplacé tronqué : `…;48` (au lieu de `48.5`) accepté en HRV 48 (`bookmark.rs:362-377` ne refuse qu'un fichier qui grandit).
- C-057 amélioration, à vérifier (H-25) — `shortcutFiles.ts:55`, `:99` : virgule lue comme décimale ; un séparateur de milliers anglais (`1,234;count`) donnerait 1 pas sans rejet.
- C-058 à trancher — `recoveryImport/service.ts:221-224` : jour calculé dans le fuseau actuel, y compris au recalcul ; après un voyage, une mesure ancienne peut glisser d'un jour (conforme à REV-01 constat 9).
- C-059 mineur — `recoveryScore.ts:39-42` : la nuit du jour n'est pas soumise au seuil de 180 min (un épisode de 90 min avec HRV produit un score, que `unusualValues` écarte par ailleurs).
- C-060 mineur — `daySummary.ts:58` : baseline complète à σ = 0, ou HRV absente, classée niveau B (« sans baseline complète », § 16.1) ; libellé seulement.
- C-061 amélioration, à trancher — `baseline.ts:41-45` : 14 dernières nuits valides sans limite de calendrier ; après deux mois sans Watch, baseline ancienne en qualité « good ».
- C-062 à vérifier — `muscleRecovery` fige le pourcentage à l'instant du calcul (ligne de 07:00 lue telle quelle à 18:00) ; règle « cardio importé −10/25/40 % » du § 16.3 non implémentée (D-88, D-220) sans ligne dans la matrice ; `recoveryNotificationPlan.ts:74` : rappel à 02:30 le 29/03 (heure inexistante), conversion du service non relue.

## Partie 7a — Aujourd'hui et Entraînement (écrans)

Contrôles déterministes sur tous les écrans (7a, 7b, 7c) : `preuves/partie7-motifs.mjs`, sortie `preuves/resultats/partie7-motifs.json` (150 TSX, 62 CSS : aucun texte visible en dur après filtrage des génériques TypeScript, aucun bouton à icône sans nom, réduction globale des animations dans `tokens.css:417`, couleurs hors jetons limitées à l'appairage, relevées en 7c). Contrastes : `preuves/contrastes.mjs`, sortie `preuves/resultats/contrastes.json` (relevés en 7c).
Preuves de cette partie : `preuves/partie7a-ecrans.test.ts`, sortie `preuves/resultats/partie7a-ecrans.log` (4 rouges, témoin vert). CSS de 7a : contrôles de motifs, lecture complète par deux relecteurs, partielle pour `Session.css` et `TrainingScreen.css` (lignes 200-250 et 360-415).
Vérifié sans défaut (lecture) : confirmations de suppression d'une routine, d'un exercice personnalisé, d'un profil, d'une séance du journal, d'une séance cardio, abandon et retrait d'exercice ; minuteur de repos persistant, nettoyé, sans notification sur PC ; Strength Score conforme à D-312 (absence de sexe ou de poids, bornes « < 10 » / « > 99 ») ; arrêt du GPS au démontage ; aucun catalogue d'entraînement dans le départ ; D-317 jamais appliqué à la saisie ; jetons seulement, cibles ≥ 44 px dans les CSS lus.

### Reclassement de C-005 en bloquant
- Chaîne complète établie : `SetRow.tsx:97-115` → `validateSetEntry` (`session.ts:112`, bornes 0 à 1 000 kg seulement) → `validateSet` ; aucun contrôle de `outlierRatio` avant l'écriture, champ `confirmed` (`types.ts:250`) jamais écrit. Faute plausible : **200 kg tapé au lieu de 100** après trois séances à 100 kg × 8 → accepté sans alerte, affiché comme record (`SummaryFigures.tsx:34`), puis **200 kg prescrits** à la séance suivante (phrase « Vérifie ta saisie » seulement).
- Preuve : `partie7a-ecrans.test.ts`, tests C-005 (saisie acceptée, témoin à 100 kg ; prescription 200 kg). Bloquant : mauvaise charge prescrite, trop lourde.

### C-063 — important — séance du jour proposée de nouveau après avoir été faite (C-018 confirmé)
- `TodaySessionCard.tsx:85-88` → `programDayFor` (`programDay.ts:46-56`) : avec des jours rattachés, `recentClosed` n'est lu qu'en rotation et `ClosedWorkoutLike` ne porte pas de date. Lundi, « Lundi — Haut » faite et close → la carte repropose « Lundi — Haut » avec « Lancer la séance » ; l'aperçu calcule les charges de la progression suivante ; un appui crée une deuxième séance le même jour.
- Preuve : test rouge C-018. Correction : passer la date des séances closes et rendre « faite aujourd'hui » ou le prochain jour ; D-316 à compléter par Ali.

### C-064 — important — semaine de reprise reconduite au 2e cycle dans un même montage (C-020 requalifié)
- `CycleView.tsx:75`, `:93`, `:118`, `:241` : l'état `rampUp` est prérempli depuis l'onboarding pour le premier cycle seulement, mais n'est jamais remis à faux. Premier cycle lancé avec la reprise, clos « sans suite » sans quitter l'écran → l'interrupteur reste coché et `startFresh` lance le 2e cycle avec la reprise (contraire à D-267, D-315). À chaque nouvelle ouverture, l'état repart bien de faux.
- Preuve : lecture du chemin (relecteur) ; le test existant (`CycleView.test.tsx:276-292`) remonte l'écran par `later(1)` et ne couvre pas ce chemin. Correction : `setRampUp(answers?.rampUp ?? false)`.

### C-065 — important — échanger deux jours de la semaine dans l'éditeur de routine échoue
- `RoutinesView.tsx:169-193` avec `trainingRoutineRepository.ts:226` : unicité contrôlée contre la base, jour par jour, dans l'ordre affiché. Jour 1 « Aucun » → « Lundi » et Jour 2 « Lundi » → « Aucun » (ou échange Lundi ↔ Mardi) : le premier `updateDay` trouve encore Jour 2 sur Lundi → `invalid`, transaction annulée, message générique « saveError ».
- Preuve : lecture du code (requête `SELECT 1 FROM routine_day WHERE … weekday = ?` avant l'écriture du second jour). Correction : libérer d'abord les jours qui changent, ou contrôler à la fin.

### C-066 — important — profils de matériel : « 12,16 » lu comme un seul poids de 12,16 kg
- `EquipmentView.tsx:166-173` avec `parseNumber` (`trainingText.ts:20`, `.replace(',', '.')`) : la liste attend des points-virgules ; une virgule est lue comme décimale et acceptée sans erreur (kettlebell de 12,16 kg, disque de 20,1 kg) → grille de charges fausse.
- Preuve : test rouge C-066. Correction : refuser une liste qui contient une virgule suivie d'un entier, ou découper.

### C-067 — important — suivi GPS en cours perdu (mémoire seulement) et « Abandonner » sans confirmation
- `CardioGps.tsx:21`, `:34`, `:49-57`, `:105` : tracé, distance et début ne vivent qu'en mémoire React ; WebView tuée en poche, changement de section (`TrainingScreen.tsx:115-123`) ou autorisation retirée → tout est perdu sans message (§ 18.3 : séance en cours restaurée depuis SQLite). `CardioGps.tsx:187` : « Abandonner le suivi » jette le suivi en un appui, à côté de « Arrêter et reporter ».
- Preuve : lecture (relecteur). Correction : brouillon persistant du suivi ; confirmation de l'abandon.

### C-068 — important — série supprimée sans confirmation ni annulation ; focus perdu après validation au clavier
- `SetRow.tsx:210`, `ActiveSession.tsx:474` : le X voisin de « Valider » supprime aussitôt la série et sa saisie (le retrait d'un exercice entier, lui, est confirmé, `ActiveSession.tsx:579`). `SetRow.tsx:118-122`, `:178` : Entrée dans « Répétitions » → la ligne passe à « Validée », le champ est démonté, le focus tombe sur `body` (§ 18.6, parcours clavier PC). Même perte de focus à chaque case du journal des facteurs (`RecoveryToday.tsx:300`, `:308`, clé `hlc` qui remonte le fieldset).
- Preuve : lecture (relecteurs). Correction : confirmation ou « Annuler » ; focus déplacé sur la série suivante ; clé stable.

### C-069 — important — « Accepter » peut écraser une série déjà validée
- `ExerciseProgression.tsx:287-291` : `decide` part de l'instantané `sets` des props ; `workoutRepository.ts:595` accepte la mise à jour d'une série faite. Valider la série 1 à 90 × 8 puis « Accepter » avant le rendu → la série validée prend la charge proposée.
- Preuve : lecture (relecteur), survenue peu probable. Correction : relire dans la transaction et ignorer les séries `done`.

### C-070 — important — texte faux : « Musculation seule, cardio non compté »
- `fr.recovery.ts:40-41`, affiché par `RecoveryToday.tsx:123`, `:163` : le cardio est compté dans l'Exertion (`domain/recovery/config.ts:57`, `cardioCounted: true`, D-220 ; `fr.cardio.ts:4` le dit).
- Preuve : lecture des deux catalogues et de la constante. Correction : texte conditionnel.

### C-071 — important — tractions et dips : champ « Charge (kg) » sans dire « lest » (C-024 confirmé)
- `SetRow.tsx:189` : même libellé pour tous les exercices ; la convention du domaine est le lest seul (`estimate1rm.ts:18-20`) et le Strength Score ajoute le poids de corps (`strengthScore.ts:118`, `totalLoad: true`). Saisir 85 (poids total) → 1RM calculé sur 170 kg.
- Preuve : lecture. Correction : libellé « Lest (kg) » et aide pour `bodyweight-reps`.

### C-072 à C-085 — mineurs, améliorations et points à vérifier
- C-072 important, à vérifier — `ActiveSession.tsx:472` puis `workoutRepository.ts:614` : correction d'une série validée sans trace (§ 13.4 « correction tracée ») ; idem `HistorySetRow.tsx:70-94` / `correctSet` (seule `corrected_at` est gardée ; vider la charge d'une série `load-reps` est accepté et la sort du tonnage et du 1RM).
- C-073 important — `RoutinesView.tsx:461`, `:564-570`, `:594-604` : « Retour aux routines » abandonne un brouillon modifié sans confirmation ; retraits de jour et d'exercice non confirmés (supprimés à l'enregistrement sans annulation).
- C-074 mineur — `TodaySessionCard.tsx:75`, `:88`, `RecoveryToday.tsx:240`, `TodayPcSide.tsx:129` : jour local lu au rendu, aucune relecture à minuit (PC ouvert de 23:50 à 00:10 → séance de la veille proposée).
- C-075 mineur — `TodayScreen.tsx:152-155`, `:172-190` : échec de lecture du profil ou des pesées → tout l'écran remplacé par « loadFailed », sans « Réessayer » (§ 18.3) ; `TodaySessionCard.tsx:109` : échec de lecture rendu `null`, silencieux.
- C-076 mineur — `display.ts:38-39`, `RecoveryToday.tsx:215`, `:219` : « min », « h » et `toLocaleString('fr-FR')` en dur hors i18n ; « · » et « — » en dur (`ActiveSession.tsx:377`, `GeneratedSession.tsx:365`, `SummaryFigures.tsx:14`).
- C-077 mineur — `ActiveSession.tsx:215`, `:480` : double appui sur « Valider » ou « Ajouter une série » (deux repos lancés, deux séries ajoutées) ; `RoutinesView.tsx:685`, `:786` : « Ajouter le programme » / « Nouvelle routine » sans garde (deux routines) ; `EquipmentView.tsx:325` sans `busy`.
- C-078 mineur — `SetRow.tsx:82` : saisie non validée gardée en mémoire seulement (perdue si la WebView est tuée) ; `CardioView.tsx:252-266` : un report GPS écrase une modification en cours.
- C-079 mineur — erreurs non journalisées ou non rattrapées : `ActiveSession.tsx:189`, `:500` (`reload()` sans `catch`), `StartSession.tsx:55`, `RoutinesView.tsx:727-733`, `LibraryView.tsx:583`, `EquipmentView.tsx:402`.
- C-080 mineur — `ExerciseProgression.tsx:170`, `:212` : référence `live` partagée entre relances, une lecture ancienne peut écraser la nouvelle ; `SetRow.tsx:203`, `ActiveSession.tsx:391` : listes qui écrivent à chaque flèche du clavier.
- C-081 mineur — `EquipmentView.tsx:211-217`, `:124` : nombre de disques par poids non modifiable (`count: 1`), poids en double accepté (clé React en double) ; `EquipmentView.tsx:462-463` : suppression d'un profil actif en deux écritures hors transaction.
- C-082 mineur — `HistoryView.tsx:22`, `:35-36` : journal limité aux 50 dernières séances (les plus anciennes ne peuvent être ni corrigées ni supprimées), 50 lectures `getClosed`.
- C-083 à vérifier (appareil) — `CardioView.tsx:301`, `:305` : `inputMode="numeric"` sur l'heure et la durée ; le clavier numérique iOS n'a pas « : ». Libellé de durée sans « mm:ss » (`fr.cardio.ts:17`, `:30`) ; distance faussée après arrière-plan sans avertissement (H-35) ; `role="status"` mis à jour tous les 10 m (annonces VoiceOver).
- C-084 mineur — `StrengthScore.tsx:108` : « 0 groupes » (règle 0 et 1 au singulier, FIX-0241) ; vocabulaire : « Varied »/« Variée », « deload »/« décharge », « Ischio-jambiers »/« Ischios », « cet appareil »/« cet iPhone », « 1000 kg » sans séparateur (`fr.training.ts:336`) ; noms des boutons « Monter/Descendre/Retirer » identiques sur chaque ligne (`RoutinesView.tsx:552-570`).
- C-085 amélioration — `fr.routines.ts` (textes d'habitudes CircleTasks) importé au départ par `fr.ts:5` et listé dans `start-modules.json:53`, seules des clés de `weekdayName` servent ; `src/features/training/content02.originals.json` ne sert qu'à un test ; paramètres `{x}` non typés dans les `*Text.ts` ; `LibraryView.tsx:511-522` libellés « Répétitions » pour un exercice au temps ; `HistoryView.tsx:72` `setTimeout` non nettoyé.

## Partie 7b — Nutrition et Progrès (écrans)

Preuves : `preuves/partie7b-ecrans.test.ts`, sortie `preuves/resultats/partie7b-ecrans.log` (4 rouges). CSS de 7b : contrôles de motifs et recherche ciblée (`NutritionScreen.css`, `Recipes.css`, `Supplements.css`, `BodyProgress.css` partiellement lus).
Vérifié sans défaut (lecture) : double appui protégé sur « Ajouter » ; le scan ouvre la quantité sans ajouter, caméra refusée gérée, absent sur PC ; ordre déterministe du journal et de la recherche ; seuls la requête ou le code partent vers OFF ; même `effectiveTarget` (D-314) et `dayTargetFor` (D-270) dans le journal ; confirmations de suppression d'une entrée, d'une recette, d'un complément, d'une photo ; « En vigueur depuis … · décidée le … » présent ; photos recodées en JPEG (EXIF et GPS retirés), table `progress_photo_file` hors synchro et hors export, effacée par la remise à zéro ; le texte « Elle passera devant… » a disparu ; aucun catalogue Nutrition, Recettes, Compléments ou Corps dans le départ. **Piste de Codex `SupplementsView.tsx:127` : corrigée par FIX-0272** (gardes `live`), reste un échec non journalisé après démontage et un test sans portée (partie 11).

### C-086 — important — cible de repos sous le plancher : l'écran demande une confirmation qui n'existe pas (aggrave C-031)
- `StrategyView.tsx:162`, `TargetForm.tsx:42`, `CheckInView.tsx:358`, `:376`, `useCases.ts:216` : `belowFloor` ne regarde que la cible d'entraînement. Repos à −200, cible d'entraînement 1 300 → repos 1 100 → « confirme explicitement » sans case ; enregistrement impossible. Au check-in « Personnaliser », message trompeur « L'enregistrement a échoué. Rien n'a changé. ».
- Preuve : lecture (relecteur), cohérente avec le test rouge C-031. Correction : case de confirmation dès que la plus basse des deux cibles passe sous 1 200.

### C-087 — important — cible confirmée sous 1 200 kcal : cible de repos impossible à ajouter ou retirer
- `useCases.ts:285` : `saveRestPlan` écrit avec `lowFloorConfirmed: false` ; cible en vigueur 1 100 confirmée, interrupteur de repos coupé → `confirmation-required` puis « Enregistrement impossible. Réessaie. » (`RestTargetForm.tsx:88`).
- Preuve : lecture. Correction : reprendre la confirmation de la décision en vigueur.

### C-088 — important — tableau de bord : un jour de repos est compté sur la cible d'entraînement
- `DashboardView.tsx:31-33` : `remainingForDay(snapshot.target.target, today)` ; le Journal (`JournalView.tsx:110`) et Aujourd'hui (`NutritionRemainingCard`) appliquent `dayTargetFor` (D-270). Entraînement 2 500, repos 2 300, 2 000 mangées un jour de repos → tableau de bord « reste 500 », Journal et Aujourd'hui « reste 300 ». Même biais sur la ligne de cible du graphique (`Charts.tsx:28`) et « vs cible » (`DashboardView.tsx:62`).
- Preuve : lecture. Correction : `dayTargetFor` partout.

### C-089 — important, à vérifier (8b) — photos « supprimées sans retour possible » encore récupérables
- `src-tauri/src/backup.rs:1-16`, `bodyProgressRepository.ts:151`, `fr.bodyProgress.ts:87`, `:99` : les sauvegardes `VACUUM INTO` copient `progress_photo_file` (14 quotidiennes sur PC) ; une photo supprimée reste dans `backups/` et revient à la restauration ; pas de `secure_delete`. À vérifier : sans `NSURLIsExcludedFromBackupKey`, la base (photos comprises) part probablement dans la sauvegarde iCloud de l'iPhone, contraire au texte « jamais envoyées » et à D-99 (1).
- Preuve : lecture ; exclusion iCloud vérifiée en 8b. Correction : purge des sauvegardes à la suppression ou photos hors base ; texte exact ; exclusion de sauvegarde si elle est voulue.

### C-090 — important — « +5 cm en 4 semaines » faux sur un historique espacé
- `bodyZone.ts:33-36`, `BodyProgress.tsx:240`, `fr.bodyProgress.ts:42`, `:47` : référence = la mesure la plus récente d'au moins 28 jours, sans borne haute. 01/06 à 80, 01/11 à 85 → « +5 cm en 4 semaines » (5 mois en réalité) ; colonne « 4 sem. » du PC fausse de même.
- Preuve : test rouge C-090. Correction : dire la date réelle de la référence (`since`), ou borner la fenêtre.

### C-091 — important — compléments : changer une heure efface la constance passée
- `supplements.ts:108`, `:127` (D-211, configuration courante) : créatine prise à 08:00 pendant 7 jours, heure passée à 08:30 → constance **0 %**, série 0, bande des 14 jours vide ; la prise du jour redevient « à cocher ».
- Preuve : test rouge C-091. Correction : rattacher une prise au créneau du jour (heure en vigueur ce jour-là) ; D-211 à compléter par Ali.

### C-092 — important — recherche : produit Open Food Facts masqué par la coupe à 50 résultats
- `FoodSearchPanel.tsx:383` avec `foodSearch.ts:64` : `searchFoods` coupe à 50 avant le filtre de provenance, OFF classé en dernier. 60 fiches Ciqual « yaourt … » et un yaourt OFF en cache → l'OFF est absent, filtre « OFF » → « Aucun résultat ».
- Preuve : test rouge C-092. Correction : filtrer avant de couper.

### C-093 — mineur — tendance du poids : échelle étirée par une pesée aberrante
- `dashboard/model.ts:28` : 80 ; 80,2 ; 120 (aberrante) → max de l'axe **126**, tendance aplatie. `Charts.tsx:54` : `role="img"` sans liste de valeurs.
- Preuve : test rouge C-093. Correction : exclure les aberrantes de l'échelle (point hors cadre signalé).

### C-094 — important — mesure corporelle supprimée d'un geste, sans confirmation ni annulation
- `BodyProgress.tsx:150-158`, `:311` : la croix efface aussitôt et la suppression se propage par synchro sur les deux appareils.
- Preuve : lecture. Correction : `ConfirmDialog` comme pour les photos.

### C-095 — important, à vérifier (WebKit, WebView2) — virgule décimale dans les champs numériques de la nutrition
- `shared.tsx:38-53` : `<input type="number" inputMode="decimal">` ; si le moteur nettoie « 12,5 » en "", `parseNumber("")` rend `null` : Quick Add enregistre des protéines inconnues sans erreur, et « 150,5 » g désactive « Ajouter » sans message (`FoodSearchPanel.tsx:795`). Les e2e saisissent une virgule ailleurs (`I6-06-cardio.spec.ts:34`, `Y-IOS-01.spec.ts:51`), pas dans ce composant.
- Preuve : lecture ; comportement de jsdom ; e2e iphone-webkit à ajouter. Correction : `type="text"` avec `inputMode="decimal"`, comme les autres champs.

### C-096 — important — journal ouvert après minuit : saisie rattachée à la veille
- `JournalView.tsx:68`, `:114`, `NutritionScreen.tsx:32`, `NutritionRemainingCard.tsx:30` : jour figé à l'ouverture, aucune relecture ni `visibilitychange`. Écran ouvert à 23:50, Quick Add à 00:10 → entrée de la veille à 00:10.
- Preuve : lecture. Correction : relire le jour au retour au premier plan et à minuit (même cause que C-074).

### C-097 — important — saisie enregistrée sur un autre jour que celui de l'ouverture
- `JournalView.tsx:155-166`, `:229-233` : navigation de jour active pendant que Quick Add ou la recherche est ouvert ; le formulaire prend le nouveau jour sans l'afficher. Ouvert aujourd'hui, « ‹ » puis « Ajouter » → entrée d'hier.
- Preuve : lecture. Correction : figer le jour du formulaire et l'afficher, ou bloquer la navigation.

### C-098 — important — supprimer une autre entrée efface le formulaire en cours
- `JournalView.tsx:99-104`, `:134-144` : `afterWrite` remet le mode à idle ; Quick Add en cours, suppression confirmée d'une autre entrée → saisie perdue.
- Preuve : lecture. Correction : ne pas fermer le formulaire sur une écriture étrangère.

### C-099 à C-106 — mineurs, améliorations et points à vérifier
- C-099 mineur — `JournalView.tsx:206-216` avec `SegmentedControl.tsx:58-66` : la déclaration de journée écrit à chaque flèche ; deux flèches rapides enregistrent « Complète » au lieu de « Incomplète » (alimente la dépense, D-81). `FoodSearchPanel.tsx:389`, `:306-314` : les flèches des filtres déplacent aussi le focus dans les résultats.
- C-100 mineur — `FoodSearchPanel.tsx:109`, `useCases.ts:137` : une prise issue d'un code scanné est enregistrée `method: 'search'` (`scan` jamais utilisé).
- C-101 mineur (§ 18.3) — erreurs masquées : `FoodSearchPanel.tsx:196` (échec des récents présenté comme liste vide), `:705`, `:319`, `:257` ; `JournalView.tsx:90-91` sans « Réessayer » ; `SupplementsView.tsx:215-219` (`toggleReminders` sans `catch`, interrupteur muet).
- C-102 mineur — `FoodSearchPanel.tsx:715-716`, `:795-797` : heure invalide signalée « quantité invalide » ; `:573` : fiche OFF périmée choisie depuis la liste sans avertissement ; `:363` : Échap ferme toute la recherche.
- C-103 mineur — `SupplementsView.tsx:159-161` : cocher puis décocher vite laisse la prise cochée ; `RestTargetForm.tsx:18`, `:30` : « −200 » refusé sans message, plan en kcal au-dessus de la cible réaffiché en écart 0, interrupteur incohérent si le retrait échoue ; `<input type="time">` suit le réglage 12/24 h de l'iPhone (à vérifier).
- C-104 mineur — `CheckInView.tsx:143` : colonne « Actuel » = cible de la semaine analysée, pas celle en vigueur aujourd'hui (conforme D-82/D-314, déroutant) ; `StrategyView.tsx:326` : historique sans « décidée le » ; `:115` : préférences appliquées avant l'écriture sans retour arrière.
- C-105 mineur — Corps : « Taille » pour le tour de taille et pour la hauteur (`fr.bodyProgress.ts:32`, `:57`, `:77`) ; silhouette `BodyZones.tsx:55-66` sans rôle ni clavier, zones d'environ 18 px (commentaire « 44 px »), cou et épaules qui se chevauchent ; pastilles en `radiogroup` sans tabulation itinérante, valeur gardée au changement de zone (`BodyProgress.tsx:287`) ; photo importée toujours datée du jour (`:166`) ; date de saisie figée au montage (`:78`) ; sélecteur bloqué si `cancel` n'arrive pas (`picker.ts:14-22`, à vérifier) ; fibres dans la carte « Importé de Santé (Renpho) ».
- C-106 amélioration — anglicismes de `fr.nutrition.ts` (« Dashboard », « non loggé », « Cache OFF ») ; deux réglages « Objectif » aux libellés différents (`fr.body.ts:18-21`, `fr.nutrition.ts:294-297`, à vérifier : peuvent se contredire) ; `fr.capture.ts` et `fr.scan.ts` (textes de CircleTasks) importés au départ (`fr.ts:1-2`, `start-modules.json:49`, `:54`) ; Corps sans tendance ni dépense (§ 17, table, à vérifier dans Progrès).

## Partie 7c — Plus, onboarding, coquilles, composants, catalogues

Preuves : `preuves/partie7c-ecrans.test.ts`, sortie `preuves/resultats/partie7c-ecrans.log` (5 rouges, témoin vert) ; contrastes `preuves/resultats/contrastes.json` recoupés avec l'usage (warn, ok, info : liserés seulement ; nav-accent seulement sur nav-bg à 6,4:1) ; graphe d'imports `preuves/resultats/atteignables.json`.
Vérifié sans défaut (lecture) : double démarrage gardé, chaînes de démarrage avec `catch`, migration ou sauvegarde en échec → écran d'échec avec restauration ; nettoyage des effets de la coquille ; Ctrl+1 à 5 inertes sous une fenêtre modale ; onboarding (abandon sans écriture, relance champ par champ avec confirmation, routine toujours ajoutée, aucune ligne `nutrition_target` écrite donc rien ne passe devant une cible prévue, réponses de l'étape 7 gardées) ; verrou (échec fermé, horloge monotone, cache de confidentialité en capture, portails masqués) ; signature (alerte 24 h avant en instant absolu, rien sur PC) ; updater vérifié côté Rust (`pubkey`, `requireSignedVersion`) ; archive d'import (clés exactes, versions futures refusées, SHA-256, 64 fichiers / 24 Mio, aucun HLC importé) ; « Repartir de zéro » (mot EFFACER, refus avec une séance ouverte, `training.cycleWeeks` effacé) ; restauration confirmée avec copie préalable ; journaux assainis (chemins, jetons, e-mails) ; QR et clé de secours de l'appairage confinés à la fenêtre, vidés à la fermeture, jamais journalisés, capability `sync-pairing.json` à trois commandes ; HLC (horloge qui recule, débordement du compteur) ; heures calmes à cheval sur minuit ; aucune clé de catalogue en double. Piste `pairing-window/main.tsx` sans `removeEventListener` : non retenue (écouteur de la durée du document).

### C-107 — important — export simple : l'aide annonce « profil, pesées et thème », l'archive contient toutes les données corporelles
- `fr.exportImport.ts:11` contre `archive.ts:5-6`, `:92`, `:217` (`canonicalDataJson` : entraînement, nutrition, récupération, mensurations, compléments, cardio) ; archive en clair, partagée par la feuille de partage sur iPhone. `mergeHint` (`:32`) et `replaceHint` (`:33`) ne parlent que des pesées : « Remplacer » supprime sur tous les appareils bien plus que ce qu'Ali croit importer.
- Preuve : test rouge C-107 et lecture d'`archive.ts`. Correction : texte exact du contenu ; avertissement « données de santé en clair » avant le partage.

### C-108 — important — « Repartir de zéro » : « Ce qui est effacé » omet compléments, prises, séances cardio et tracés GPS
- `fr.dataReset.ts:9-13` contre `RESET_TABLES` (`domain/dataReset.ts:36-68`) ; `keptContent` dit « exercices … gardés » alors que la table `exercise` est effacée (vrai seulement si le contenu fourni est réinjecté, à vérifier).
- Preuve : test rouge C-108 (témoin : les quatre tables sont bien `wiped`). Correction : une ligne de texte par table effacée, testée.

### C-109 — important — import d'une archive postérieure à « Repartir de zéro » qui ramène les données effacées
- `ExportImportScreen.tsx:83-87` avec `isArchiveBeforeReset` (`dataReset.ts`) : refus fondé sur `manifest.date` seulement. Effacement sur le PC à 10:00 ; l'iPhone hors ligne, pas encore effacé, exporte à 10:05 ; l'archive importée sur le PC est acceptée et réécrit les anciennes données avec de nouveaux HLC, qui repartent vers les deux appareils.
- Preuve : lecture (relecteur), exposition rare. Correction : comparer l'horizon de remise à zéro aux lignes (HLC ou `created_at`) ; D-187 à compléter.

### C-110 — important — conseils de réinstaller l'app sur l'iPhone
- `fr.ts:378` (`status.signingExpired`, « La signature est expirée : réinstalle l'app », lu par `AppStatusBanner.tsx:38` et `signingNotice.ts:90`) et `fr.syncPairing.ts:24` (erreur `io` → « réinstalle l'application ») : réinstaller l'app sideloadée fait perdre les données (interdit du projet) ; `fr.syncFolder.ts:21` parle de désinstaller.
- Preuve : lecture des catalogues. Correction : « actualise-la dans SideStore », comme `fr.signing.ts:9`, `:20`.

### C-111 — important — anneau de focus sous 3:1 en thème sombre (thème par défaut)
- `Button.css:47`, `SegmentedControl.css:38`, `Switch.css:63`, `StatusBanner.css:37`, `WeekdayToggles.css:31` : anneau en `--ct-color-accent` #b8322a, **2,74:1** sur surface-raised et surface-input (#1d2027), 3,01:1 sur surface ; sur un bouton primaire, l'anneau a la couleur du bouton.
- Preuve : test rouge C-111. Correction : jeton `--ct-color-focus-ring` contrasté dans les deux thèmes, ajouté à `src/ui/theme/contrast.test.ts`.

### C-112 — mineur — contrastes de composants sous 3:1 (WCAG 1.4.11)
- Thème clair : piste de l'interrupteur éteint **2,04:1** sur surface (`Switch.css:23`, `:36`), pouce blanc sur la piste ≈ 2:1 (l'état reste porté par la position) ; thème sombre : bordure forte des champs **1,72:1** (2,04:1 en clair) ; bronze clair sur surface-raised 4,24:1 (texte, usage réel à confirmer).
- Preuve : tests rouges C-112 et `contrastes.json`. Correction : jetons revus et ajoutés aux paires testées.

### C-113 — important — Dynamic Type (« très grand texte », § 18.6) non branché sur iPhone
- Aucune occurrence de `-apple-system-body`, `preferredContentSizeCategory` ni de mise à l'échelle native (src, src-tauri, index.html) ; `html { font-size: 100% }` (`tokens.css:379`) : WKWebView n'applique pas la taille de texte d'iOS. H-19a (`capability-matrix.md:32`) reste UNVERIFIED sans mentionner ce manque. Libellés d'onglets en px fixes (`TabRail.css:75`, `:110`), bouton à hauteur fixe (`Button.css:7`).
- Preuve : recherche de motifs (relecteur). Correction : `font: -apple-system-body` sur `html` côté iOS (ou mise à l'échelle native), capture « Très grand » au lot iPhone.

### C-114 — important — écran blanc définitif : aucune frontière d'erreur au-dessus de la coquille, ni autour de « Démarrage bloqué »
- `App.tsx:241-249`, `main.tsx:16-20` : une erreur de rendu dans un composant chargé d'emblée (AppShell, TabRail, AppStatusBanner, AppLockGate, UndoToast, DbFailureDetails) démonte toute l'app. `StartupWatchdog.tsx:4`, `:27` : l'écran « Démarrage bloqué » est en `lazy()` sans frontière ; si son bloc ne se charge pas (le cas même où il sert), le rejet remonte à la racine et efface le diagnostic.
- Preuve : lecture (relecteur). Correction : frontière d'erreur racine avec message statique et « Réessayer » ; écran d'échec dans le départ ou protégé.

### C-115 — important — chien de garde : « Réessayer » proposé pendant une migration lente
- `startupSteps.ts:8` (8 s par étape), `StartupWatchdog.tsx:17` (`location.reload`), étapes `db.backup` / `db.migration.N` (`bootstrap.ts:75-101`), second minuteur de 15 s armé une seule fois (`DbFailureDetails.tsx:29-31`) : sur un iPhone lent après une mise à jour, « Démarrage bloqué » s'affiche alors que la migration progresse ; un appui recharge en pleine migration. Effet sur la transaction et le pool Rust à vérifier (Codex, A-008 voisin).
- Preuve : lecture. Correction : délai propre aux étapes de base, aucun rechargement pendant une migration.

### C-116 — important — un bloc de signature illisible fait passer l'app entière en « erreur de démarrage »
- `App.tsx:178` : un échec d'`import('./features/signing/signingRun')` après le montage pose `dbStatus='error'` (alerte « app.startError » et DbFailureDetails au-dessus d'une coquille qui fonctionne, hors du verrou) ; l'erreur réelle est remplacée par « chargement impossible ».
- Preuve : lecture. Correction : `logFailure` seul, sans changer l'état de la base.

### C-117 — important — « Revoir mes réglages » écrase la durée de cycle choisie depuis (D-315)
- `onboardingData.ts:215` : la revue repart de `onboarding.answers.mesoWeeks` et écrit `training.cycleWeeks` sans comparer à son point de départ. 4 semaines à l'onboarding, 6 choisies ensuite, revue pour corriger la taille → le réglage repasse à 4 (7 et « illimité » écrasés de même).
- Preuve : lecture. Correction : n'écrire que si la valeur a changé dans la revue ; partir du réglage courant.

### C-118 — important — oublier le dossier et la clé sans dire que les données iCloud deviendront illisibles
- `SyncSettingsSection.tsx:448-460`, `fr.syncFolder.ts:20-23`, `native/fr.json` (`consent.eraseKey`) : sans clé de secours et sans autre appareil, les journaux chiffrés deviennent illisibles, Rust refuse une nouvelle clé sur ce dossier (`folder-has-data`) ; aucune boîte ne le dit, deux options au même niveau `danger`. `SyncDetailsReset.tsx:108-116`, `:185-187` : « Réinitialisation en cours… » affiché sur le bouton de réinitialisation pendant « Synchronise d'abord ». « Repartir de zéro » titre à la fois la réinitialisation de synchro (sans perte, `fr.syncReset.ts:8`) et l'effacement total (`plusText.ts:34`, `fr.dataReset.ts:6`).
- Preuve : lecture. Correction : texte de conséquence ; état `busy` séparé ; libellés distincts.

### C-119 — important, à vérifier — « À propos et licences » absent de Plus (§ 18.2)
- `AboutSection.tsx` : version, Logs, mise à jour seulement ; aucun écran ni texte de licences trouvé (attribution Ciqual, Open Food Facts, FitnessVolt exigée par D-310). À vérifier ailleurs (Progrès affiche la source FitnessVolt).

### C-120 à C-135 — mineurs, améliorations et points à vérifier
- C-120 mineur — toast « Annuler » mal annoncé : `role="status"` monté avec son texte (`Toast.tsx:62`, `UndoToast.tsx:49-66`) ; un message suivant masque « Annuler » sur iPhone (`UndoToast.tsx:49-55`).
- C-121 mineur — piège de focus perméable (`useFocusTrap.ts:79-93` : focus sur le conteneur ou `body` → Tab sort), retour à un ouvreur démonté (`:101`), éléments masqués comptés (`:3-4`) ; `ChoiceDialog.tsx:63` sans `container` (masqué sous le verrou ?) ; `SegmentedControl.tsx:76` : valeur absente → aucun arrêt de tabulation ; destructif et primaire presque identiques en clair (`Button.css:18-34`).
- C-122 mineur — clavier global (`App.tsx:211-216`) : `repeat`, `defaultPrevented`, `isComposing` ignorés (Ctrl+Z maintenu vide la pile, Échap traité deux fois) ; Ctrl+/ démonte l'onboarding en revue et perd les modifications (`registerShellShortcuts.ts:17-21`, `OnboardingHost.tsx:309`).
- C-123 mineur — capture globale des erreurs installée après le chargement de `platform/logs` (`logJournalBoot.ts:18-23`) ; 120 caractères d'un message quelconque gardés (`globalErrors.ts:9`, absence de donnée corporelle dépendante de l'assainissement) ; `timeZoneWatcher.ts:41-43` silencieux ; base laissée ouverte après un échec de démarrage (`bootstrap.ts:353-356`) ; chien de garde réarmé à chaque rendu (`StartupWatchdog.tsx:17-23`).
- C-124 mineur — date de la barre PC figée la nuit (`App.tsx:77`) ; `appStore.ts:48-73`, `:103-116` : état hérité (`spaces`, `projects`, …) jamais posé.
- C-125 mineur — objectif à rythme sans rythme ou sans poids : cible nutrition écrite à « maintien » sans le dire (`review.ts:265-273`, `onboardingData.ts:186-190`).
- C-126 mineur — alerte d'échec de mise à jour impossible à fermer et réannoncée chaque heure (`UpdateBanner.tsx:300`) ; bandeau d'expiration de signature retiré quand une lecture échoue alors que l'échéance connue est proche (`signingNotice.ts:213-216`) ; sauvegarde du jour calculée dans le fuseau du moteur (`backupSchedule.ts:242-244`).
- C-127 mineur — Plus : « Remplacer » en un appui sans seconde confirmation quand des suppressions sont prévues (`ExportImportScreen.tsx:179-185`) ; thème importé non appliqué (`:110`) ; dates d'export en UTC (`archive.ts:270`, `fullExport.ts:273`) ; pesée supprimée sans confirmation, définitive pour une pesée Santé (`BodyScreen.tsx:247`) ; `inputMode="numeric"` sur la taille (`:274`) ; mauvais message à l'échec de lecture du profil (`:104`).
- C-128 mineur, à vérifier — import corps et nutrition : un refus du dépôt (`meals.create`, `measurements.remove`) annule toute la transaction à chaque import (`healthBodyImport/service.ts:303-331`) ; import Raccourcis du poids : une `DbError` de contrainte fait échouer tout le fichier (`AppleHealthScreen.tsx:216-217`) ; `catch {}` sans code (`healthBodyImport/service.ts:396`).
- C-129 mineur — promesses sans `catch` : `RecoveryNotificationsSection.tsx:40-45`, `:56-60` (interrupteurs bloqués si la replanification rejette), `SyncDetailsReset.tsx:146`, `:164`, `syncStore.ts:127-142` ; échec avalé `SyncDetailsDedup.tsx:355-357` ; « en cours » annoncé avant la confirmation native (`SyncDetailsReset.tsx:67`, `SyncDetailsForget.tsx:206`) ; minuteur d'arrivée non arrêté au `dispose` (`pairingStatus.ts:111-127`, `startSync.ts:502-513`).
- C-130 mineur — réinitialisation qui ne recharge jamais si `syncNow` ne se résout pas (`ResetDataScreen.tsx:48`) ; aucune sauvegarde postérieure à l'effacement avant le lendemain (`backupStore.ts:361`) ; `SecuritySection` monté sur le panneau PC sans garde (`SettingsPanels.tsx:225`, sans effet tant que la biométrie est absente).
- C-131 mineur — format 12 h encore proposé (« 9:00 AM », `timeFormat.ts:7`, `format.ts:9`, `fr.appearance.ts:23`, `AppearanceScreen.tsx:18`) contre la règle « heures en 24 h » (défaut 24 h) ; boîtes natives au vouvoiement (`native/fr.json:7`, `:14`, `:35`) ; « Logs » / « Journaux » et chemins « Réglages › … » périmés (`fileFailureText.ts:8`, `fr.backupRestore.ts:16`, `fr.health.ts`) ; pluriels « associé(s) » (`fr.syncReset.ts:50`), « {n} exercices » (`fr.onboarding.ts:208`) ; unités Kio/Go/Ko/Mo mélangées ; erreurs sans action proposée (`fr.exportImport.ts:18`, `fr.syncFolder.ts:28`, `:30`, `fr.syncEngine.ts:45`, `:49`, `fr.logs.ts:20`, `:25`).
- C-132 amélioration — catalogue de départ : 927 clés sur 1 715 de `fr.ts` jamais lues (≈ 37 Ko bruts), catalogues morts dans `start-modules.json` (`fr.importCsv`, `fr.notifications`, `fr.events` quasi mort, `fr.capture`, `fr.scan`, `fr.routines`), catalogues de Réglages dans le départ (`fr.syncPairing`, `fr.syncField`, `fr.syncConflicts`, `fr.syncForget`, `fr.syncReset`, `fr.backup`, …) ; textes CircleTasks encore lus (« Rappels Apple », « Sans projet », « Agenda {name} déconnecté »).
- C-133 amélioration — code mort hérité (aucun import de production) : `csvImport`, `dateInput`, `historyExport`, `itemFilter`, `notificationStatus`, `projectRules`, `routineReport`, `taskPostpone`, `taskRules`, `taskSchedule`, `taskTrash` ; `planNotifications` et sa chaîne (`quietHours`, `eventReminders`, `eventRules`, `eventKinds`) ; `src/platform/ocr` entier inaccessible depuis les points d'entrée.
- C-134 à vérifier (D-36) — « Ce code n'apparaît pas dans les captures d'écran » (`fr.syncPairing.ts:105`, `WDA_EXCLUDEFROMCAPTURE`) sans ligne UNVERIFIED dans la matrice ; exemption de couleurs de `pairing.css` mal justifiée (`hardcodedColors.test.ts:15-17`) et palette iPhone copiée trois fois (`IosPairingScreen.css:3-9`, `:239-256`) ; QR et clé gardés après un échec du dessinateur (`PairingView.tsx:164-166`) ; marqueur réécrit avec un nom de sauvegarde vide (`RestoreMarkerResume.tsx:33`) ; `pickBytes` plafonné à 2 Mo (`platform/files/types.ts:53`) : une archive complète plus grosse serait inimportable.
- C-135 amélioration — PRD : rupture PC à 1 024 px (§ 18.1, D-47, `useLayout.ts:6`) contre ≥ 900 px (§ 18.5) ; Ctrl+K (§ 18.1) absent sans décision consignée ; commentaires faux (`lazyScreens.tsx:11`, `archive.ts:6`, `requestPermission.ts:13`, en-têtes « en.*.ts ») ; date du manifeste non validée sans remise à zéro (`archive.ts:537`).
