# NUTRI-0292 — Nutrition et récupération, partie A : règles, import Santé, récupération

Lot 0.29.2 (docs/LOT-0.29.2.md, docs/LOT-0.29.2-audit.md), registre « nutrition et récupération », partie A. Chapitres : 15 (nutrition), 16
(récupération, import Santé). Décisions d'Ali appliquées : D-475 à D-479, D-498. Aucune migration, aucun changement de synchro : ce qui en exige est
listé en fin de fiche (« Pour données et synchro »). Reste de la section nutrition et récupération (partie B) : hors de cette fiche.

## Passe product-owner (critères)

1. C-035, C-062 (rappel) : un rappel dont l'heure n'existe pas le jour du passage à l'heure d'été est comparé à son heure de déclenchement réelle (une
   heure plus tard), jamais perdu.
2. C-037 : cible de repos cohérente (kcal = macros) même quand les glucides sont ramenés à 0 g ; glucides arrondis, pas tronqués.
3. C-038 (D-475) : sans cible en cours, le premier check-in n'exige aucune couverture (figé). C-125 : un objectif de perte ou de gain sans rythme
   exploitable suspend le check-in avec sa raison, il n'écrit plus « maintien » en silence.
4. C-039 (D-476) : le total du jour importé de Santé (entrée « Renpho — total du jour ») rend le jour complet ; la déclaration d'Ali prime. C-042
   (D-477) : côté journal, 0 g de lipides laisse le total calculé (figé) ; la source Ciqual (« traces » en `null`) relève de content-data.
5. C-040 : une décision datée d'après aujourd'hui (horloge en avance) ne passe pas devant une cible prévue ; un HLC illisible perd toujours.
6. C-041 : totaux du jour sans erreur de virgule flottante. C-044 : recette à 0 portion ou sans ingrédient : jamais Infinity ni entrée nulle.
7. C-043, C-045, C-046, C-047 : code à 8 chiffres lu selon le format du scanner ; UPC-A et EAN-13 équivalents dans le cache ; « ß » normalisé ;
   virgule de milliers d'OFF (off.rs) distinguée de la décimale ; fiche OFF périmée gardée si OFF ne connaît plus le produit ; fichier photo refusé au-delà de
   40 Mo avant tout décodage.
8. C-048 : « Pris » sur une heure qui n'existe plus est signalé (jamais en silence). C-051, C-053, C-054, C-055, C-057 : fichiers Santé (date illisible,
   fuseau invalide, 3e colonne vide, même instant indépendant de l'ordre, séparateurs de milliers de `pas.csv`). C-128 : un refus du dépôt sur un jour de
   nutrition est compté, il n'annule plus tout l'import.
9. C-058 (D-478), C-059, C-061 (D-479), C-062 (D-498) : jour d'une mesure dans le fuseau de la mesure ; nuit du jour soumise au seuil de 180 min ; baseline
   sur les 30 derniers jours calendaires (sous 14 nuits valides : jamais « good ») ; cardio importé sans effet sur les muscles ; récupération musculaire
   relue à l'heure courante.
10. BL-139 : Exertion des séries au poids du corps, assistées et chronométrées. BL-142 : groupes musculaires par identifiants neutres.

## Passe agent du module

- Nutrition : `src/domain/nutrition/` (`restDay`, `dayTotals`, `mealEntry`, `types`, `targetRecord`, `barcode`, `recipe`, `foodSearch`, `checkIn`),
  `src/features/nutrition/` (`scan/scanBarcode`, `search/offLookup`, `checkIn/CheckInView`, `dashboard/model`, `journal/JournalView`), `src/db/repositories/sql/foodRepository.ts`,
  `src/features/settings/healthBodyImport/service.ts`, `src-tauri/src/off.rs`.
- Récupération : `src/domain/recovery/` (`shortcutFiles`, `baseline`, `config`, `recoveryScore`, `exertion`, `types`, `muscleRecovery`), `src/domain/health/`
  (`shortcutWeights`, `bodyShortcutFiles`), `src/features/settings/recoveryImport/`, `src/features/recovery/muscleGroupLabel.ts`.
- Notifications : `src/domain/notificationInstant.ts` (`effectiveFireAt`), `supplementNotificationPlan`, `src/features/notifications/` (`supplementActions`,
  `supplementNotifications`). Photo : `src/domain/bodyProgress/measurements.ts`, `src/platform/photoImage/picker.ts`.
- Textes : `src/i18n/fr.nutrition.ts` (`reasonNoGoalRate`), `src/i18n/fr.recovery.ts` (`muscleGroup_*`).

## Vérifications écrites (lignes « à vérifier »)

- **C-048** : (a) « Pris » après un changement d'heure du complément : `intakesToTake` rendait une liste vide, l'action était comptée « appliquée » sans rien
  cocher ni dire : défaut confirmé, corrigé (`unmatched`, bandeau d'échec, journal `supplement-action-unmatched`). (b) File tronquée qui recoche une
  prise : les actions retirées d'une file pleine sont des non appliquées (`dropped` visible) ; les clés appliquées sont gardées 30 jours et 200 au plus (au
  plus 4 prises par jour, soit 120 en 30 jours) et la ligne native est acquittée après l'enregistrement de la file : aucun rejeu possible. Sans défaut ;
  preuve : `notificationActions.test.ts` (file pleine, `dropped`, 200 clés).
- **C-056** : un fichier remplacé tronqué EN PLEINE VALEUR (« 4000 » lu « 40 ») est indiscernable d'un fichier complet : le guide ne promet pas de saut de ligne
  final. Limite connue, figée par `shortcutFiles.steps.test.ts` (avec et sans saut de ligne final : même lecture). Question Q-18.
- **C-057 (H-25)** : le format réel de `pas.csv` n'est pas constaté (H-25 reste UNVERIFIED). Par prudence, les séparateurs de milliers (« 12,345 », « 1.234 »)
  sont lus comme des milliers pour un nombre de pas (entier) ; une décimale d'un chiffre reste lue comme avant.
- **C-060** : σ = 0 et HRV du jour absente donnent le niveau B (sommeil et FC repos connus, seuils absolus) : conforme au tableau du § 16.1 lu comme « sans
  baseline exploitable ». Sans défaut ; figé par `tonightValidity.test.ts`. Question Q-19.
- **C-062** : (a) cardio importé non retiré : D-498 le décide (le cardio ne charge aucun muscle), figé par `muscleRecovery.live.test.ts` ; (b) récupération
  musculaire figée au calcul : `muscleRecoveryPercentAt` relit le pourcentage à l'heure courante (aucun écran ne l'affiche encore) ; (c) rappel à heure
  inexistante : le matin est fixe à 08:00 et le rappel de coucher de la nuit du saut est planifié dès la veille : sans défaut, figé par
  `recoveryNotificationPlan.dst.test.ts`.
- **C-128** : le refus d'une pesée ou d'une mesure était déjà compté par élément ; seul le dépôt des repas (`create`, `update`, `softDelete`) laissait remonter
  un refus et annulait la transaction de tout l'import (inatteignable aujourd'hui, la validation de l'import étant exemptée de bornes, mais fatal à chaque
  import si elle l'était un jour). Corrigé (`refused`).

## Passe qa-test (rouge → vert)

| Ligne | Rouge | Vert |
|---|---|---|
| C-035 | 7ac1abbb | cd0111da |
| C-037 | 0d5deda3 | e3b3240d |
| C-038 (fige) | — | 03aacdb4 |
| C-039 | ae876983 | 5717af49 |
| C-040 | 1c8bd71c | 42e2f999 |
| C-041 | b0cb27c2 | 72aac54f |
| C-042 (fige) | — | 697ac2c1 |
| C-043 | 11613824 | 354d2762 |
| C-044 | 1d1b55f3 | 1c5cc28e |
| C-045 | e37c6282 | f4fbe630 |
| C-046 (Rust : `cargo test` ciblé rouge constaté, puis vert ; `cargo fmt`, `cargo clippy --locked -- -D warnings` propres) | be7acb89 | 6567b4e2 |
| C-047 | e6168860, 47391a76 | 547e278e |
| C-048 | 28ce39bb | 5e3bbcc1, f63f2223 (typage) |
| C-051 | 7346914a | dc831ac2 |
| C-053 | 5bfa7b8e, 580fa8ed | e548e430, a44e0346, ac375e82 (fuseau mémorisé : fichiers de 10 000 lignes) |
| C-054 | 580fa8ed | a44e0346 |
| C-055 | 6ad7bda2 | 6a1bc7ac |
| C-056 (fige) | 2ed5ea25 | — |
| C-057 | 2ed5ea25 | ca952c80 |
| C-058 | 894d27c1 | 118986fd, f63f2223 |
| C-059 | 7d3326d3 | 0c18c73d |
| C-060 (fige) | 7d3326d3 | — |
| C-061 | 156e4da2 | 73f812cc |
| C-062 | ef6e3148 (réécrit en « sans défaut » dans 2185e81f), 90285311 | 2185e81f, 11c12ae5 |
| C-125 | 26bbb95e | f20d92bc |
| C-128 | 42164de4 | bf134018 |
| BL-139 | 3eaf23b4 | ee16f28f |
| BL-142 | 9b59c121 | 5443736d |

- Attentes changées assumées : `restDay.test.ts` (2 250 kcal : 233 g de glucides au lieu de 232, arrondi) ; `shortcutFiles.test.ts` (jour du fuseau de la mesure,
  D-478 remplace la règle « jour local de l'appareil » de REV-01 constat 9 ; `offsetMin` dans les échantillons) ; `engine.test.ts` (groupes neutres) ;
  `unusedKeys.test.ts` (famille `muscleGroup_*`).
- Lancés en local (`--maxWorkers=1`) : `src/domain/nutrition`, `src/domain/recovery`, `src/domain/health`, `src/domain/bodyProgress`, `src/features/nutrition`,
  `src/features/notifications`, `src/features/settings/recoveryImport` et `healthBodyImport`, `src/features/recovery`, `src/i18n`, `foodRepository` : verts ;
  `tsc --noEmit` et `eslint` propres. Quelques délais de 5 s dépassés par intermittence pendant les compilations Rust en parallèle (fichiers de 10 000 lignes) :
  verts quand ils tournent seuls. Bundle : aucun module de `tests/bundle/start-modules.json` touché (mesure CI).

## Statuts proposés (ID → statut)

- fait : C-035, C-037, C-039, C-040, C-041, C-043, C-044, C-045, C-046, C-047, C-048, C-051, C-053, C-054, C-055, C-057, C-059, C-061, C-125, C-128, BL-139, BL-142.
- fait (comportement conservé, test qui fige) : C-038 (D-475), C-056 (limite connue, Q-18), C-060 (Q-19).
- fait en partie ; reste : **C-042** (D-477) — côté journal figé ; reste la source Ciqual : « traces » écrit en `null` (content-data, `scripts/content/ciqual.mjs`,
  régénération de `content/food/ciqual.json` ; D-75 à amender) ; **C-058** (D-478) — jour de la mesure à l'import fait ; reste la colonne de décalage (voir
  ci-dessous) pour que le recalcul des nuits et des échantillons relus utilise le décalage enregistré ; **C-062** — sans défaut pour le rappel et le cardio (D-498),
  fait pour la relecture à l'heure courante (aucun écran ne l'affiche encore).
- Hypothèses : H-25 (`pas.csv`) reste UNVERIFIED.

## D- proposées (à partir de D-545)

- **D-545** : C-055 : deux valeurs au même instant dans un fichier Santé : la plus grande gagne (résultat indépendant de l'ordre des lignes). Choix prudent, révisable par Ali.
- **D-546** : BL-139 : charge totale d'une série au poids du corps = poids de corps × fraction ± charge saisie (poids de corps le plus récent ; inconnu : série non
  devinée) ; série chronométrée = charge totale × minutes × 12 répétitions équivalentes par minute (`timedRepsPerMinute`) ; assistance au-delà du poids de corps : ignorée.
  Choix prudent, révisable par Ali.
- **D-547** : C-039 appliquée (précise D-476) : le total du jour importé de Santé (entrée unique « Renpho — total du jour » à énergie connue) rend le jour complet ; la déclaration
  « incomplet » d'Ali prime ; l'origine de la pesée n'intervient pas.
- **D-548** : C-125 : objectif de perte ou de gain sans rythme exploitable (absent, nul, négatif, non fini) : check-in suspendu, raison « no-goal-rate » dite à l'écran.
- **D-549** : C-040 : une décision datée d'après aujourd'hui prend effet au plus tôt aujourd'hui ; à prise d'effet égale, un HLC illisible perd contre un HLC lisible.
- **D-550** : C-037 : cible de repos : glucides arrondis (non tronqués) ; glucides à 0 g : kcal recalculées sur protéines et lipides (jamais des kcal sans macros pour les porter).
- **D-551** : C-058 appliquée (D-478) : le jour d'une mesure Santé est celui du décalage écrit dans la cellule (±HH:MM) ; « Z » ou décalage absent : fuseau de l'appareil ; remplace la règle
  REV-01 constat 9 pour les échantillons. C-061 appliquée (D-479) : fenêtre `baselineWindowDays` = 30. C-059 : la nuit du jour est soumise au seuil de 180 min (raison « sommeil »).
- **D-552** : BL-142 : `muscle_recovery.muscle_group` porte un identifiant neutre (`arms`, `shoulders`, `core`, `chest`, `back`, `legs`) ; les lignes anciennes gardent leur libellé français,
  affiché tel quel. C-057 : séparateurs de milliers admis dans `pas.csv` (H-25). C-048 : action « Pris » sans prise correspondante signalée.

## Questions à Ali (à partir de Q-18)

- **Q-18** (C-056) : un fichier Santé tronqué en pleine valeur (« 4000 » lu « 40 ») est indiscernable. A = garder (limite connue) ; B = le raccourci écrit toujours un saut de ligne
  final et l'app refuse un fichier qui n'en a pas (guide à modifier, constat d'Ali sur l'iPhone). Recommandation : B si le raccourci le permet, sinon A.
- **Q-19** (C-060) : σ = 0 (nuits toutes identiques) ou HRV du jour absente : niveau B (seuils absolus). A = garder ; B = un message dédié (« base trop régulière », « HRV manquante »).
  Recommandation : A.
- **Q-20** (C-042, D-477) : la source Ciqual écrit « traces » en `null` pour chaque nutriment. A = « traces » compté 0 g pour les lipides seulement (D-477 à la lettre) ; B = pour tous les
  nutriments. Recommandation : B (même logique, aucune raison d'un traitement à part), à faire par content-data.
- **Q-21** (C-061, D-479) : le libellé « Base en construction : J+x/14 » sert aux deux cas (premier apprentissage, base redevenue trop courte). A = garder ; B = « en reconstruction »
  seulement quand des nuits plus anciennes existent. Recommandation : A.

## Pour données et synchro

1. **C-058 (D-478)** : colonne additive sur la table LOCALE `recovery_sample` (non publiée) : `utc_offset_min INTEGER NULL CHECK (utc_offset_min IS NULL OR utc_offset_min BETWEEN -840 AND 840)`,
   décalage en minutes de la cellule d'origine (`ShortcutSample.offsetMin`, déjà produit par `parseShortcutHrv`, `parseShortcutRestingHr`, `parseShortcutSteps`) ; `NULL` pour « Z » et pour les
   lignes existantes (calcul actuel conservé, D-478). À écrire par `recoverySampleRepository` (`INSERT OR IGNORE` : la clé d'unicité ne change pas), à lire par `recompute`
   (`src/features/settings/recoveryImport/service.ts:236`, qui reconstruit aujourd'hui `day` par `utcToLocal(startAt, fuseau actuel)` et passe `offsetMin: null`). Sommeil : le jour du réveil devrait
   aussi se calculer avec le décalage de la fin du segment (`parseShortcutSleep` ne le garde pas encore ; même colonne). L'archive d'export doit lire une archive sans cette colonne.
2. **BL-142** : `muscle_recovery.muscle_group` (table PUBLIÉE) reçoit désormais des identifiants neutres pour les nouvelles lignes ; aucune colonne, aucun schéma changé, la valeur reste une chaîne de
   1 à 64 caractères. Relecture sync-icloud (D-26) : une version précédente lit ces lignes sans erreur (elle ne les affiche pas) ; les lignes anciennes (libellés français) restent lues.
3. **C-042** (content-data, hors de ce module) : `scripts/content/ciqual.mjs` (`parseDecimal`, `kind: 'traces'`) écrit `null` ; D-477 demande 0 g pour les lipides (Q-20 : tous les nutriments ?) ;
   régénérer `content/food/ciqual.json` depuis les fichiers Anses et amender D-75.
4. **C-040** : `effectiveTarget(records, date, today?)` : `NutritionTargetRepository.effective(date)` (`src/db/repositories/sql/nutritionTargetRepository.ts`) n'a pas encore le paramètre
   `today` (les écrans le passent) : à faire avec data-model si la lecture par le dépôt doit suivre la même règle. Aucune table ni colonne.
5. Aucune table, colonne, déclencheur ni catalogue de synchro modifié dans ce lot ; `src/sync/**`, `src/domain/sync/**`, `src-tauri/src/sync/**` intacts.

## Passe code-reviewer

Relecture à froid de l'agent lui-même, distincte : points à surveiller, aucun bloquant relevé. (1) C-039 : `toMealEntryInput` reconnaît l'entrée Renpho par son nom figé : un
renommage par Ali la ferait redevenir une saisie ordinaire (comportement d'avant). (2) C-058 : `parseInstant` ne contrôle plus le décalage de la cellule contre le fuseau de l'appareil ; le jour
« futur » (`day > today`) est jugé dans le fuseau de la mesure. (3) BL-142 : `muscleGroupLabel` est sans appelant d'écran (aucun écran n'affiche encore les groupes) ; la famille est déclarée dans
`unusedKeys.test.ts`.
