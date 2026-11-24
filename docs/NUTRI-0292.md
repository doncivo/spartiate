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
  inexistante : défaut confirmé à la relecture (le plan comparait 02:30 > 03:10 en heure flottante : un recalcul dans l'heure sautée perdait le rappel, et la soirée d'hier dont le rappel tombe
  après minuit n'était jamais envisagée) : corrigé (`zone` + `effectiveFireAt`, soirée d'hier incluse), voir « Corrections de la partie A après relecture ».
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

---

# NUTRI-0292 — Partie B : écrans (nutrition, compléments, Corps, Exertion)

Lot 0.29.2, registre « nutrition et récupération », partie B : C-070, C-090 à C-093, C-099 à C-106, BL-117. Chapitres : 15 (nutrition), 16 (Exertion), 18 (états, § 18.3 erreurs
dites). Aucune migration, aucun changement de synchro (voir « Pour données et synchro » en fin de partie). Source des constats : `docs/audit-claude-0.27.0/constats.md` (branche
`audit-claude-0.27.0`), lue ligne à ligne.

## Passe product-owner (critères)

1. C-070 : l'Exertion ne dit plus « cardio non compté » : la portée affichée suit `RECOVERY_CONFIG.exertion.cardioCounted` (D-220 : le cardio saisi compte).
2. C-090 : « +5 cm en 4 semaines » n'est dit que si la référence a entre 28 et 42 jours ; au-delà, l'écart dit sa date réelle (« Écart depuis le … ») et la colonne « 4 sem. » du PC reste « — ».
3. C-091 : changer l'heure d'un complément n'efface plus la constance : une prise cochée à une heure changée depuis couvre un créneau encore libre du même jour (constance, série, bande).
4. C-092 : le filtre Perso / Ciqual / OFF est appliqué AVANT la coupe à 50 résultats. C-093 : l'échelle de la tendance de poids ignore les pesées aberrantes (dessinées au bord, comptées en texte).
5. C-099 : la déclaration de journée ne garde que la dernière valeur de flèches rapides ; les flèches d'un groupe de filtres ne vont plus dans les résultats. C-100 : un code lu par la caméra est enregistré `method: 'scan'`.
6. C-101 (§ 18.3) : récents, recherche, portions de fiche et interrupteur des rappels disent leur échec (plus de « liste vide » ni d'interrupteur muet). C-102 : heure invalide dite comme telle ; fiche OFF périmée signalée depuis la liste ; Échap revient d'une étape.
7. C-103 : cocher puis décocher vite finit décoché ; « −200 » lu comme 200 kcal en moins ; cible de repos au-dessus de la cible d'entraînement refusée avec sa raison ; retrait en échec : l'interrupteur reste sur l'état réel.
8. C-104 : note sous « Actuel » (cible de la semaine analysée) ; historique « décidée le … » ; préférence dont l'écriture échoue : retour à la valeur enregistrée. C-105 : « Tour de taille » / « Hauteur », pastilles de zone au clavier, valeur effacée au changement de zone, date du jour suivie, fibres hors de la carte Corps.
9. C-106 : « Tableau de bord » (au lieu de Dashboard), « Open Food Facts » (au lieu de Cache OFF), « saisi » (au lieu de loggé / logué), « Objectif du profil » (profil) distinct de « Objectif » (Stratégie) ; catalogue `fr.scan` retiré du départ.
10. BL-117 : « Habituels » (go-tos) ; assiette gardée à la fermeture de la recherche, grammes et heure propres à chaque aliment, enregistrable en recette d'une portion.

## Passe agent du module

- Exertion : `src/features/recovery/RecoveryToday.tsx`, `src/i18n/fr.recovery.ts`. Corps : `src/features/bodyProgress/{bodyZone,BodyZones,BodyProgress}.ts(x)`, `src/i18n/fr.bodyProgress.ts`.
- Compléments : `src/domain/nutrition/supplements.ts` (`settledIntakes`), `src/features/nutrition/supplements/{constancy,SupplementsView}`.
- Recherche : `src/domain/nutrition/{foodSearch,plate,goTos}.ts`, `src/features/nutrition/search/{FoodSearchPanel,PlateCard,catalogueSearch}`, `src/features/nutrition/{useCases,shared}`.
- Journal, Stratégie, check-in, dashboard : `journal/JournalView`, `strategy/{StrategyView,RestTargetForm}`, `checkIn/CheckInView`, `dashboard/{model,Charts}`. Textes : `src/i18n/fr.{nutrition,supplements,body}.ts`.

## Vérifications écrites (lignes « à vérifier »)

- **C-095 (fait en 0.27)** : sans objet ici. **C-099 (flèches de filtre)** : défaut confirmé (la flèche bougeait aussi le focus vers les résultats, puis le rerendu le perdait) : corrigé.
- **C-101, `JournalView.tsx:90-91` « sans Réessayer »** : à la lecture de 0.29.2 le bouton « Réessayer » existe déjà : sans défaut, figé par `Search0292.test.tsx` (« journal illisible : message et bouton Réessayer »).
- **C-103, `<input type="time">` suit le réglage 12/24 h de l'iPhone** : NON vérifiable sans appareil. Le champ reste un `type="time"` ; à constater par Ali (docs/constats-ali.md : iPhone, Journal, ouvrir Rechercher, choisir un aliment, lire le champ « Heure »). Si l'iPhone affiche 12 h, remplacer par deux champs numériques (H, M) : Q-24.
- **C-105, silhouette** : zones d'environ 18 px et chevauchement cou / épaules / poitrine : la silhouette reste un complément tactile ; les pastilles (44 pt, clavier et lecteur d'écran, roving tabindex) sont la voie d'accès complète. Taille des zones tactiles à constater par Ali (iPhone, Progrès, Corps, toucher le cou puis l'épaule). Non modifié sans appareil : Q-25.
- **C-105, photo toujours datée du jour / sélecteur bloqué si `cancel` n'arrive pas (`picker.ts`)** : non corrigés (date de la photo = jour de l'ajout, choix de conception D-99 ; `cancel` de `<input type="file">` dépend de WKWebView, H-27 UNVERIFIED) : constat d’Ali, Q-25.
- **C-106, « Corps sans tendance ni dépense (§ 17, à vérifier dans Progrès) »** : hors de cette fiche (`src/features/progress`) : non vérifié ici, reste « à faire » pour la partie Progrès.
- **C-106, deux réglages « Objectif »** : ils sont deux données distinctes (`profile.goal` : prise de masse / perte de poids / maintien ; `nutrition.prefs.goal` : maintien / perte / prise + rythme) et peuvent se contredire. Interim : libellés distincts (« Objectif du profil » / « Objectif »). Fusion en une seule source : Q-23 (Ali).

## Passe qa-test (rouge → vert)

Chaque test rouge a été constaté en échec en local (`npx vitest run --coverage.enabled=false --maxWorkers=1 <fichier>`), commité seul, puis le code dans un commit séparé.

| Ligne | Rouge | Vert |
|---|---|---|
| C-070 | be24d13a | 42adfb3c |
| C-090 | 09e3543d, ec5ac192 | de1514d4 |
| C-091 | b59d81e1 | e63e2824, 212f193e (typage) |
| C-092 | 7f56b3d4 | c9afcaf5 |
| C-093 | 9a97598e | e427879c |
| C-099 | be16071b, 74100ace | 32b3965c, a06355ee |
| C-100 | cc9f83fb | 20bf9f11 |
| C-101 | 07701991 | 32b655b9 |
| C-102 | 988b0f87 | 6e1c7e68 |
| C-103 | e4d89863, 1c296b27 | 70d7327c, 635bbf03 |
| C-104 | 66c0f691 | 70506567 |
| C-105 | a799cca5 | 1141af1e |
| C-106 | 3b0d39b2 | 9d5ca65d |
| BL-117 | 51dcae91, cac35d2a | c5ba8601 (domaine), 4883d94a (écrans) |

- Attentes changées assumées : `RecoveryToday.test.tsx` (texte de l'avis `exertion_cardio_not_counted`, résumés d'avant D-220) ; `BodyProgress*.test.tsx` (« Taille » devient « Tour de taille » ou « Hauteur », fibres absentes de la
  carte) ; `BodyScreen.test.tsx` (groupe « Objectif du profil ») ; `DayCompleteness`, `NutritionScreen`, `CheckInErgo02` (« Tableau de bord », « jours saisis ») et les specs `tests/e2e/FIX-092-onglets`, `V0-7-1-mise-en-page`, `tests/visual/capture`
  (nom de l'onglet) ; `supplements.test.ts` (une prise d'une heure changée couvre un créneau libre : 4 sur 4 au lieu de 3 sur 4) ; `Plate.test.tsx` (le nom est dans un élément exact, la quantité dans un champ) ;
  `permissionTexts.test.ts` (assertion sur `fr.scan.cameraHint` retirée avec le catalogue mort) ; `NutritionScreen.test.tsx:511` (233 g de glucides : résidu de C-037, partie A).
- Lancés en local (`--maxWorkers=1`) : `src/features/{nutrition,bodyProgress,recovery,settings/BodyScreen}`, `src/domain/nutrition`, `src/i18n`, `src/ui/ErgoShared` : verts ; `tsc --noEmit` et `eslint` propres.
- e2e : aucune spec nouvelle ; les trois specs existantes touchées (nom de l'onglet) tournent en CI. Les parcours nouveaux (assiette gardée, recette, Habituels) sont couverts par des tests d'écran (`Search0292.test.tsx`).
- Bundle (mesure normalisée, `CI=1 npx vitest run --config vitest.bundle.config.ts tests/bundle/startBundle.test.ts --silent=false`) : normalisé 182 931 octets (référence main 183 842 : −911 octets, dû au catalogue `fr.scan` retiré) ; 170 tests du bundle verts ; aucun module ajouté à `tests/bundle/start-modules.json`, un retiré.

## Statuts proposés (ID → statut)

- fait : C-070, C-090, C-091, C-092, C-093, C-099, C-100, C-101, C-102, C-104, BL-117 (go-tos : définition choisie, Q-22).
- fait en partie ; reste : **C-103** : `<input type="time">` en 12 h sur l'iPhone, à constater (Q-24) ; **C-105** : zones de la silhouette (taille, chevauchement), date de la photo, sélecteur sans `cancel` (Q-25, constat d'Ali) ;
  **C-106** : « Corps sans tendance ni dépense » à vérifier dans Progrès ; fusion des deux objectifs (Q-23) ; `fr.capture.ts` reste au départ (ses clés `capture.undo.created` et `capture.dictation.*` sont lues par `undo.ts` et `permissionTexts.test.ts` : à démêler avec coquille et iOS).
- Hypothèses : aucune nouvelle (H-27, sélecteur de photo, reste UNVERIFIED).

## D- proposées (à partir de D-553)

- **D-553** : C-091 : l'historique des heures d'un complément n'est pas conservé (D-211 : configuration courante) ; pour les statistiques (constance, série, bande), une prise cochée à une heure qui n'est plus prévue couvre un
  créneau encore libre du même jour, une prise par créneau. La carte du jour et les rappels restent à l'heure exacte (cocher et décocher visent l'heure exacte). Choix prudent, révisable par Ali.
- **D-554** : C-090 : « sur 4 semaines » n'est dit que pour une référence de 28 à 42 jours avant la dernière mesure ; au-delà, l'écart dit sa date (« Écart depuis le … »), la colonne « 4 sem. » reste « — ».
- **D-555** : C-093 : une pesée aberrante (pondérée 0,25, § 15.1) n'entre pas dans l'échelle du graphique de tendance ; elle est dessinée au bord et comptée (« Pesées hors du cadre : n »).
- **D-556** : C-100 : `meal_entry.method = 'scan'` pour un aliment trouvé par un code lu par la caméra ; un code saisi à la main reste `search`.
- **D-557** : C-103 : dans « Écart les jours de repos (kcal en moins) », un signe saisi est lu comme la même quantité en moins (« −200 » = 200 en moins) ; une cible de repos au-dessus de celle des jours d'entraînement est refusée avec sa raison.
- **D-558** : C-099 : les écritures de la déclaration de journée sont mises en file, la dernière valeur gagne (jamais une valeur intermédiaire laissée par des flèches rapides).
- **D-559** : C-106 : vocabulaire fr : « Tableau de bord » (onglet), « Open Food Facts » (filtre), « saisi » (jours, barres) ; « Objectif du profil » pour `profile.goal` ; C-105 : « Tour de taille » / « Hauteur » ; les fibres importées de Santé
  ne s'affichent plus dans la carte Corps (elles restent stockées, `health_fiber_g`). `fr.scan.ts` (scan de tâches, CircleTasks) retiré de l'arbre de départ.
- **D-560** : BL-117 : « go-tos » (§ 15.3, mot non défini par le chapitre) = aliments pris au moins 3 fois sur les 90 derniers jours, 6 au plus, du plus fréquent au moins fréquent, sans Quick Add ; section « Habituels » de la recherche
  vide ; l'assiette appartient au Journal (gardée à la fermeture de la recherche, rien n'est écrit avant « Ajouter l'assiette au journal ») ; grammes et heure propres à chaque aliment ; « Enregistrer en recette » crée une recette d'une portion
  (un ingrédient par aliment, valeurs figées pour 100 g) et laisse l'assiette en place. Complète D-396.

## Questions à Ali (à partir de Q-22)

- **Q-22** (BL-117, D-560) : définition des « go-tos ». A = pris au moins 3 fois sur 90 jours (livré) ; B = les repas entiers répétés (même heure, mêmes aliments) ; C = un réglage d'Ali (épingler des aliments). Recommandation : A, puis C si la liste ne te convient pas.
- **Q-23** (C-106) : `profile.goal` (Réglages › Corps) et `nutrition.prefs.goal` (Stratégie) sont deux réglages qui peuvent se contredire. A = garder deux réglages aux libellés distincts (livré) ; B = une seule source : Stratégie lit le profil (le rythme reste en Stratégie) ;
  C = Stratégie écrit aussi le profil. Recommandation : B (lecture seule, sans schéma ; avis de data-model).
- **Q-24** (C-103) : si l'iPhone affiche le champ « Heure » en 12 h : A = garder (réglage système) ; B = deux champs numériques H et M en 24 h (D-21 : heures en 24 h). Recommandation : B si constaté.
- **Q-25** (C-105) : silhouette de Corps : A = garder la silhouette en complément des pastilles ; B = retirer la silhouette ; C = agrandir les zones (déplacer cou et épaules, rayon de 11). Photo : toujours datée du jour de l'ajout (D-99) : A = garder ; B = proposer la date (champ). Recommandation : A et A, après constat sur l'iPhone.

## Pour données et synchro

1. Aucune migration, table, colonne, déclencheur ni catalogue de synchro modifié dans cette partie ; `src/sync/**`, `src/domain/sync/**`, `src-tauri/**` intacts.
2. **C-100 (D-556)** : `meal_entry.method` reçoit la valeur `scan`, déjà admise par le type `EntryMethod`. Relecture sync-icloud (D-26) : à confirmer par data-model que le `CHECK` de `meal_entry.method` de la migration publiée admet `scan`
   (preuve : `0008_nutrition.test.ts` insère `method: 'scan'` ; la contrainte de la migration 0008 est `CHECK (method IN ('search', 'scan', 'photo', 'quickadd'))`, aucune migration touchée) ; une version précédente lit la valeur sans nouvelle contrainte.
3. **BL-117** : `recipe` et `recipe_ingredient` (tables publiées) reçoivent des recettes créées depuis l'assiette par le dépôt existant (`create`), sans champ nouveau.
4. **Q-23 option B** : lecture seule du profil par Stratégie, sans schéma ; l'option C écrirait `profile.goal` (table publiée) : relecture sync-icloud.
5. **C-091** : aucun historique d'heures n'est ajouté (D-553). Si Ali veut des heures datées exactes, il faudra une table ou une colonne publiée (historique d'heures du complément) : à ne pas faire sans décision.

## Passe code-reviewer

Relecture à froid, distincte. Points à surveiller, aucun bloquant relevé : (1) C-091 : `settledIntakes` suppose qu'une prise orpheline vient d'une heure changée ; une prise cochée par erreur à une heure non prévue couvre un créneau libre, une fois par créneau.
(2) C-092 : changer de filtre relance la recherche (un instant sans résultat, jamais ceux d'une autre provenance). (3) C-099 : la file d'écriture de la déclaration écrit la première valeur puis la dernière si les flèches sont très rapides ;
l'état final est toujours la dernière valeur. (4) BL-117 : l'assiette du Journal n'est pas gardée au changement d'onglet (état d'écran) ; `fr.capture.ts` reste au départ.

## Corrections de la partie A après relecture (CI 45461878768 et relecture à froid)

| Ligne | Rouge | Vert |
|---|---|---|
| CI : cible de repos jamais -0 (`restDay.ts`, `Math.round` entre -0,5 et 0) | 49467e63 | 13b42a03 |
| C-062 (c) : rappel de coucher dans l'heure sautée | 1c9e28b6 | 715c6fdc |
| C-128 : refus au journal technique et au résumé | e5ac8c55, 9520d5af (expression échappée) | 4ed52772 |
| C-046 : énergie en milliers sans décimale (`cargo test` ciblé constaté en échec puis vert ; `cargo fmt` ; `cargo clippy --locked -- -D warnings` propre) | 1f3544d3 | 9b03f425 |
| Mineurs : répétitions infinies, `RECOVERY_ENGINE_VERSION` 2, photo de plus de 40 Mo | 5a98f0f4 | 0aa74d47 (attente), 008db292 |
| C-100 : preuve SQL que `meal_entry.method` admet « scan » (migration 0008 inchangée) | (preuve, verte d'emblée) | 0aa74d47 |

- CI : la cause du rouge était l'attente `carbG: 232` de `NutritionScreen.test.tsx:511` (C-037 donne 233 : corrigée en partie B, commit 9d5ca65d, cohérente) ; la garde « jamais -0 » est en plus posée à la source (`restTargetFromGap` : arrondi + 0) avec son test.
- `RECOVERY_ENGINE_VERSION` : lue par `sql/recoveryRepository.ts` (`sameDay` compare la version) et écrite avec chaque résumé ; passer à 2 fait réécrire une fois chaque jour déjà stocké. `recoveryRepository.test.ts` : attente 2.
- Photo de plus de 40 Mo : `PhotoTooLargeError`, message « Cette image dépasse 40 Mo… » (Progrès, Corps). Espace de `reasonCoverage` corrigée.
- Statuts mis à jour : **C-062** fait (rappel inclus) ; **C-128** fait (refus au journal et au résumé) ; **C-046** fait (kJ et kcal) ; **C-100** : preuve SQL, aucune D- de remplacement.
- **D-561** : `RECOVERY_ENGINE_VERSION` = 2 (moteur de récupération du lot 0.29.2) ; les jours stockés sont recalculés et réécrits une fois (`recovery_day` est publiée : relecture sync-icloud, aucun schéma).
- **D-562** : C-062 (c) : une échéance de rappel de coucher ou du matin est comparée à son heure de déclenchement réelle dans le fuseau de l'appareil ; la soirée d'hier est envisagée (rappel après minuit).
- **D-563** : C-046 : pour l'énergie (kJ et kcal d'Open Food Facts), « 2,252 » ou « 2.252 » (1 à 3 chiffres puis exactement 3) sont des milliers ; les autres nutriments gardent la décimale.
- **Q-26** (C-039, D-547) : un jour dont la seule entrée est « Renpho — total du jour » (reconnue par son nom figé) est rendu complet. Options : A = garder D-547 (le total du jour importé de Santé suffit, la déclaration d'Ali prime) ;
  B = complet seulement si des repas saisis existent et sont complets (le total importé seul reste « partiel » ou « inconnu ») ; C = comme A, mais l'entrée est reconnue par un marqueur (source dédiée) et non par son nom. Recommandation : A.
  Conséquences : A garde la dépense mesurée alimentée par Santé, au prix d'un jour « complet » dont le total vient d'un seul chiffre, et d'un renommage de l'entrée qui la ferait redevenir une saisie ordinaire ; B protège la dépense (moins de jours complets, donc moins de jours utilisés par le TDEE)
  mais rend l'import Santé inutile seul ; C demande une source ou une colonne (migration, relecture sync-icloud) et n'a de sens que si A est retenue.
