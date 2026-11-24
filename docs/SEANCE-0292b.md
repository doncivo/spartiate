# SEANCE-0292b — Séance et moteur, suite (lot 0.29.2)

Lot 0.29.2 (docs/LOT-0.29.2.md, docs/LOT-0.29.2-audit.md), registre « séance et moteur », suite de SEANCE-0292 (#206) : BL-106 et § 12.4
(D-496), § 12.3 (D-497), BL-140, BL-141, BL-111, BL-112, § 17.1 a, § 13.3 b, H-1, § 13.2 a (statut seulement). Chapitres : 11 (moteur),
12.3–12.4, 13.2–13.5 (séance, repos, résumé), 14.2–14.3 (bibliothèque, matériel), 17.1 (records). Branche `SEANCE-0292b` depuis
`origin/main` `f2a2a1d2`, `origin/main` fusionné ensuite (`03abaf8d`, DATA-0292 : renommage du profil par défaut, conflit d'import résolu
dans testsFiges.test.ts). Aucune migration, aucun fichier de synchro, aucun module du départ touché (fichiers modifiés comparés à
tests/bundle/start-modules.json : aucun) ; mesure du bundle après la relecture 1 : voir la passe code-reviewer. `ENGINE_VERSION` 4 → 5
après la relecture 1 (D-542).

## Passe product-owner (critères par ligne)

1. BL-106 / § 12.4 (D-496) : étant donné une charge d'historique absente de la grille du profil courant, alors la proposition est la plus
   grande charge de la grille ≤ référence (plafonnée au maximum du matériel), la note dit « ramenée à n kg » ; un cran de la grille (haut de
   plage atteint) n'est jamais touché ; les choix proposés restent sur la grille ; sous le minimum de la grille : « à saisir » (D-536).
2. § 12.3 (D-497) : les variantes Variable, Fixe et Statique de Libre n'existent plus (type, entrée de génération, écran) ; les modes
   restent Guidé, Libre, Maison, Importé.
3. BL-140 : charge faite d'un exercice assisté au résumé = série la moins assistée (la plus dure).
4. BL-141 : écart de répétitions au résumé = chaque série faite comparée à la série retenue de même rang dans l'exercice.
5. BL-111 : en séance, après une hausse dans les décisions, « Revenir à la prescription précédente » remplit les séries avec les valeurs
   d'avant la hausse (D-537) ; sans hausse : aucun bouton. Bibliothèque : carte du corps qui choisit le groupe musculaire (D-538).
6. BL-112 : exercice sans charge : fatigue (valeurs maintenues, choix « −2 reps »), stagnation (deux choix, progression continue), décote de
   position sur les valeurs (D-539). Distance : non faite (aucune colonne de distance dans `workout_set`, migration exigée).
7. § 17.1 a : record établi par la série validée dit en séance (région vivante) avec un retour haptique appuyé ; aucune notification
   système (D-540).
8. § 13.3 b : action « +30 s » sur la notification de repli de fin de repos : non faite, reste consigné ci-dessous (D-541).
9. H-1 : vecteurs comparés aux exemples chiffrés publiés par Gravl ; sources, vecteurs et écarts écrits ci-dessous.
10. § 13.2 a : pause de séance non implémentée, Q-12 non tranchée (docs/decisions-a-prendre.md:23, vérifié le 24/11).

## Passe agent du module

- `prescribe.ts` : D-496 (`offGrid`, `gridLoad` / `toGrid`, grille seule disponible hors grille, retour « à saisir » sous le minimum) ;
  `prescribeUnloaded` : fatigue (`isFatigued`), stagnation (`isStalled`), décote de position sur les valeurs (BL-112).
- `explain.ts` : note `noteReferenceOffGrid` avec `kept`, `noteReferenceBelowGrid`, `notePositionValues` ; `fr.progression.ts`,
  `progressionText.ts` (`kept` écrit comme `load`, `progressionDay`).
- `summaryGap.ts` (BL-140 : paramètre `assisted`, min ; BL-141 : appariement par rang de la série) ; `WorkoutSummary.tsx` passe les assistés
  (catalogue et personnalisés, comme HistoryView).
- `generationTypes.ts`, `generationInput.ts`, fixture `generation.ts` : `LIBRE_VARIANTS`, `LibreVariant`, `libreVariant` retirés.
- `ExerciseProgression.tsx` : `revertProposal` sur les décisions des séances closes, bouton dans la proposition (BL-111).
- `library/LibraryBodyMap.tsx`, `LibraryView.tsx`, `TrainingScreen.css`, `fr.training.ts` (`bodyMapFront`, `bodyMapBack`).
- `sessionRecords.ts` (`recordsOfSet`), `ActiveSession.tsx` (`announceRecords` après chaque validation), `Session.css`,
  `fr.trainingSession.ts` (`liveRecord`).
- Vecteurs : `src/domain/training/seance0292b.test.ts` (BL-106, § 12.3, BL-112), `gravl.h1.test.ts` (H-1).

## Décisions proposées (Claude (choix prudent) ; révisable par Ali ; à reporter dans docs/decisions.md)

- **D-536** (BL-106, D-496) : référence SOUS la plus petite charge de la grille du profil (4 kg, haltères à partir de 5) : rien n'est proposé
  (« à saisir », note « sous la plus petite charge de ce profil »), parce que la charge minimale serait une hausse au-delà du plafond de
  +10 % (le vecteur rouge proposait 5 kg ; les propriétés du moteur l'ont refusé, vecteur révisé dans le commit vert `4221658a`). Hors
  grille au-dessus du minimum : arrondi vers le bas et plafond (D-496) ; assisté exclu (l'assistance n'est pas une charge du matériel).
  Tests réécrits parce qu'ils figeaient D-471 : `testsFiges.test.ts` (BL-106), `prescribe.test.ts` (paire de 9 kg → 8 kg),
  `prescribe.property.test.ts` (« ne baisse jamais sous la référence » : sauf référence hors grille).
- **D-537** (BL-111) : en séance, le retour à la prescription d'avant la dernière hausse est la valeur retenue de CETTE séance, tracée comme
  une modification (`accepted = 0`, prescription du jour) et non comme la décision de retour de la fiche (raison `revert-previous`, attachée
  à la séance close, que le repository exclut des valeurs retenues : le premier essai ne montrait rien). Proposé dès qu'une hausse existe
  dans les décisions des séances closes, quelle que soit la raison principale du jour.
- **D-538** (BL-111, § 14.2 b) : carte du corps de la bibliothèque = reflet visuel du filtre « Groupe musculaire » (11 groupes du contenu),
  masquée aux technologies d'assistance (la liste reste la saisie accessible), un toucher choisit, un second retire ; aussi dans le choix
  d'un exercice d'une routine. Tracé repris de la body map de l'onboarding, copié pour ne pas charger son catalogue de textes (à mettre en
  commun dans `src/ui` par ui-design-system si souhaité).
- **D-539** (BL-112, amende D-385) : exercice sans charge : fatigue = même règle que chargé sur les valeurs au même lest (> 20 % de moins) :
  valeurs maintenues, choix « −2 répétitions » (aucun choix pour un chronométré) ; stagnation (3 séances sans progrès) : choix variante et
  autre plage, sans mini-deload, la progression continue ; décote de position : valeurs × multiplicateur relatif au rang de la séance de
  référence (0,93, 0,88), arrondies vers le bas, au moins 1, lest inchangé. Limite : la phrase « fatigue » dit « répétitions » aussi pour
  un chronométré. Distance : exige une colonne de distance dans `workout_set` (migration, données et synchro) ; reste « unsupported ».
- **D-540** (§ 17.1 a, C-191) : record en séance = records du résumé (charge la plus lourde, meilleure série en kg soulevés, contre les
  séances closes) établis par la série validée, dits dans une région vivante sous la barre de fatigue, avec `haptics.impact('heavy')` ;
  PC : texte seul ; aucune notification système (l'app est au premier plan ; le PC n'en émet aucune). Lecture impossible : journalisée,
  rien n'est dit (le résumé de fin les donne). Records de répétitions et de 1RM : absents du résumé comme de la séance (BL-114 à BL-116).
- **D-541** (§ 13.3 b, non fait) : reste pour notifications et ios-mobile, dans l'ordre : (1) un seul consommateur du fichier d'actions du
  plugin : `supplementActions.ts` acquitte toutes les lignes lues (`ack` de `lines`), une action de repos y serait perdue ; il faut un
  répartiteur unique par `sid` avant tout second consommateur ; (2) identifiant d'action : le Swift n'accepte que `done` et `snooze15`
  (`NotificationActionsPlugin.swift:71`, `knownActions`) : soit ajouter `extend30` (Swift, une compilation iOS), soit réutiliser `snooze15`
  avec le titre « +30 s » dans une catégorie propre (précédent : « Pris » réutilise `done`, D-250) ; (3) `timerNotification.ts`, sorte
  `rest` : envoyer `actionTypeId` de la catégorie ; stub Windows inchangé (le PC n'envoie rien) ; (4) séance : à la réception, `extendRest(30)`
  seulement si `extra.at` est l'échéance du repos en cours (sinon ignorée et comptée). Aucun code écrit : (1) et (3) sont hors de la zone
  du module (src/platform/notifications, src/features/notifications).

- **D-542** (relecture 1, point B ; précédent D-388) : `ENGINE_VERSION` 4 → 5, parce que D-496 (charge hors grille ramenée sur la grille)
  et D-539 (sans charge : fatigue, stagnation, décote de position) changent les propositions. La version est stockée, validée (≥ 1) et
  publiée (`progression_profile.engine_version`, JSON de `recommendation_decision`) mais jamais comparée : aucune donnée relue autrement.
  Épinglages mis à jour (explainNotes, fixAberr, fixAssist, moteur0281a, prescribe, progressionRepository).
- **D-543** (relecture 1, point D ; prolonge D-537 et D-496) : en séance, la cible du retour à la prescription précédente est ramenée sur la
  grille du profil courant (plus grande charge ≤ cible, donc plafonnée au maximum ; phrase « 61 kg n'existe pas sur ce profil : ramenée à
  60 kg ») ; sous la plus petite charge : aucun retour (comme D-536) ; exercice sans charge ou assisté : cible telle quelle. Jour de décharge
  (deload du cycle ou demandé) : retour caché s'il alourdit la séance (charge plus lourde, assisté : moins d'assistance, ou même charge et
  plus de répétitions au total) ou si rien n'est chiffré ; choix le plus prudent (la décharge prime ; le retour reste dans la fiche).
  Domaine : `revertForSession` (revertPrescription.ts).

## Questions (à reporter dans docs/decisions-a-prendre.md)

### Q-17 — Référence sous la plus petite charge du profil (D-536 dépasse D-496)

Constat : D-496 (Ali) dit « arrondie vers le bas à la grille, plafonnée au maximum » ; sous le minimum, il n'existe aucune charge en dessous.
D-536 (Claude) répond « à saisir » (aucune charge proposée) ; ce cas n'était pas tranché par Ali. Aucun code changé par cette question.
- A (recommandé) : garder « à saisir », note « sous la plus petite charge de ce profil ». Conséquences : jamais de hausse au-delà du plafond
  de +10 % (4 kg → 5 kg = +25 %) ; Ali saisit la charge qu'il utilise ; la propriété `prescribe.property.test.ts` (D-536) le fige.
- B : proposer la plus petite charge du profil avec des répétitions réduites pour garder l'effort (e1RM ≤ référence + 10 %). Conséquences :
  une proposition chiffrée tout de suite ; règle nouvelle (répétitions ajustées à la baisse sur une hausse de charge, contraire au
  « reps → charge jamais dans la même prescription »), vecteurs et propriété à réécrire, `ENGINE_VERSION` relevée.

### Q-15 — Arrondi de la décote de position (H-1, écart G3)

Constat : 2ᵉ exercice du muscle, 40 kg × 0,93 = 37,2 kg. Gravl publie 37,5 kg (arrondi au plus proche, répétitions compensées dans les deux
sens) ; Spartiate propose 35 kg et une répétition de plus (arrondi vers le bas, § 11.3 « +1 rep si l'écart dépasse 3 % »).
- A (recommandé) : garder l'arrondi vers le bas (jamais au-dessus de la cible, règle unique du moteur). Conséquence : séance un peu plus
  légère au 2ᵉ rang.
- B : arrondi au plus proche avec une répétition de moins si la charge monte. Conséquence : règle d'arrondi propre à la position, ENGINE_VERSION
  relevée.

### Q-16 — Échelle après un cran (H-1, écart G2b)

Constat : après 8-8-8 et un cran, Gravl repart à 8-7-6 (série d'appui en tête), Spartiate au bas de la plage sur chaque série (6-6-6).
- A (recommandé) : garder (règle D-72, figée par TESTS-FIGES). B : repartir au profil de répétitions de la première séance de l'échelle.

## H-1 — vérification écrite (sources, vecteurs, écarts)

Source : Gravl, « How the Gravl algorithm works », https://gravl.ai/blog/how-gravl-algorithm-works (page publique lue le 24/11/2026, seul
article de l'index du blog, sitemap gravl.ai/sitemap.xml, dont le titre porte sur l'algorithme ; aucune autre documentation chiffrée
trouvée). Vecteurs : `src/domain/training/gravl.h1.test.ts` (verts dès l'écriture : vérification, aucun défaut).
- G1 écart (formule) : 8 × 100 kg → Gravl 124,2 kg ; Spartiate Epley 126,7 kg (+2 %). Gravl plafonne à 15 répétitions, non vérifié ici.
- G2 concordant : 8-7-6 « Dur » → 8-8-6 → 8-8-7 → 8-8-8 à 40 kg puis 42,5 kg (haltères par 2,5) ; G2b écart : reprise 6-6-6 (Q-16).
- G3 écart (arrondi) : 2ᵉ rang −7 % : Gravl 37,5 kg, Spartiate 35 kg + 1 répétition (Q-15).
- G4 écart (plancher) : inactivité −1 %/semaine au-delà de 2 semaines : Gravl « quelques % au plus », Spartiate −10 % au plus (D-72).
- G5 concordant : hausse du 1RM ≤ ~10 % par séance (`maxGainPerSession` 0,1).
- Sans exemple chiffré, non comparés : transfert de progrès entre variantes (90 %) et exercices du muscle (50 %), absent de Spartiate ;
  « Juste » qui relève le 1RM (Spartiate : échelle) ; « Facile » recalibrage « d'un saut » (Spartiate : +5 % si confiance < 60 %) ; plages
  par objectif (force 3–8, muscle 8–15 ; Spartiate 5–10 / 8–15, D-472). Statut proposé pour H-1 : « vérifié en partie (5 vecteurs, 2
  concordants, 4 écarts assumés) », ligne de capability-matrix inchangée (aucun CONFIRMED depuis une lecture, D-36).

## Hors périmètre (consigné)

- Distance (BL-112) : migration ; § 13.3 b : D-541 ; § 13.2 a : Q-12 ; records de répétitions et 1RM en séance : BL-114 à BL-116.
- `programImport.qa.test.ts` (rapprochement des 150 noms) dépasse 5 s sur ce PC en local, avec ou sans les commits de ce ticket : lenteur
  du poste sous `--maxWorkers=1`, aucun délai changé ; à surveiller en CI.

## Passe qa-test (rouges constatés en local, puis verts ; `--maxWorkers=1`, couverture coupée)

| Ligne | Rouge | Vert | Test |
|---|---|---|---|
| BL-106 / § 12.4 | `038942f6` (6 échecs sur 7, note 1 échec) | `4221658a` | seance0292b.test.ts, progressionNotes.test.ts, testsFiges.test.ts |
| BL-140 | `85788ee5` | `ecb11693` | summaryGap.test.ts |
| BL-141 | `da40fbaf` | `084d1e2c` | summaryGap.test.ts |
| § 12.3 | `eaf0f5c1` | `0f3f90ec` | seance0292b.test.ts, generateSession.test.ts |
| BL-111 (séance) | `4997e407` (bouton absent) | `63268551` | ExerciseProgression.seance0292b.test.tsx |
| BL-111 (carte) | `68701478` (carte absente) | `cdf3a30b` | LibraryBodyMap.test.tsx |
| BL-112 | `5a037a24` (4 échecs) | `c35aa706` | seance0292b.test.ts |
| § 17.1 a | `451ecf99` (module absent : rouge faible) | `76d1feb7` | SessionRecords.test.tsx |
| H-1 | — (vérification) | `8602be78` | gravl.h1.test.ts |

Après fusion de main (`03abaf8d`) : src/domain/training, progressionNotes, SessionRecords, ExerciseProgression.seance0292b, LibraryBodyMap,
SummaryGap : 935 verts ; `tsc --noEmit` vert ; eslint sans erreur. Suite complète, e2e et visuel : CI.

## Passe code-reviewer (à froid, même agent)

- D-496 : `toGrid` n'agit que hors grille et jamais sur un cran de la grille ; les choix partent de `gridLoad` (sans raison ajoutée) :
  point corrigé pendant le module (la note apparaissait au haut de plage atteint).
- BL-111 : un essai traçait une décision de retour invisible (repository) ; corrigé par D-537, test à l'appui.
- Commit `be694d9f` (code de séance et test de carte mêlés par un `git add -A`) défait localement avant tout push (`reset --soft`) et
  rejoué en trois commits ; aucun historique publié réécrit.
- Restes : phrase « fatigue » d'un chronométré (D-539) ; géométrie de carte copiée (D-538).

### Relecture 1 (à froid, run CI 45443720283 rouge) : « à corriger », 8 points, corrigés (un commit par point, rouge local puis vert)

| Point | Constat | Rouge | Vert | Test |
|---|---|---|---|---|
| A | V0-7-1 point 5 (iphone, 440 px) : interrupteur « Compatibles » hors de l'écran, carte du corps (BL-111) au-dessus des filtres | `988278df` (ordre DOM) | `ed998dd4` (carte après les filtres, D-538 inchangée) | LibraryBodyMap.test.tsx ; e2e : la CI tranche |
| B | `ENGINE_VERSION` restée à 4 malgré D-496 et D-539 | `2d27bdaf` (6 épinglages) | `d50b3568` (D-542) | explainNotes, fixAberr, fixAssist, moteur0281a, prescribe, progressionRepository |
| C | propriété hors grille lâche (`loadKg < référence`) | — (vert d'emblée ; portée prouvée par mutation locale non commitée) | `9699c83f`, lint `ee202d94` | prescribe.property.test.ts (max de la grille ≤ référence, plafond ; D-536) |
| D | retour en séance hors grille ; jour de décharge alourdi | `c7c8a8e1` (2 composant, 12 domaine) | `ab83dadc` (D-543 ; grille synthétique du test domaine corrigée : 50 kg ajouté) | ExerciseProgression.seance0292b.test.tsx, revertForSession.test.ts |
| E | `announceRecords` sans jeton : réponse ancienne écrase la nouvelle | `26b4d102` (« Record » dit après coup) | `ca8ced2d` | SessionRecords.test.tsx |
| F | décote de position sans charge sur inactivité et récupération basse | — (vert d'emblée : résultat juste, même règle que l'exercice chargé) | `b43cd240` | seance0292b.test.ts |
| G | D-536 dépasse D-496 | — | — (Q-17, aucun code) | — |
| H | vert BL-112 `c35aa706` sans test | rouge `5a037a24` revérifié contre `c35aa706^` : 4 échecs | `6d88ad46` (texte `notePositionValues`, seul ajout non couvert) | progressionNotes.test.ts |

Vérifications locales (`--maxWorkers=1`, couverture coupée) : src/domain/training, progressionNotes, LibraryBodyMap, SessionRecords,
ExerciseProgression.seance0292b : 953 verts (76 fichiers) ; ExerciseProgression*.test.tsx : 38 verts ; `tsc --noEmit` vert ; eslint sans erreur sur
les fichiers modifiés. Bundle (mesure finale) : `CI=1 npx vitest run --config vitest.bundle.config.ts tests/bundle/startBundle.test.ts` :
« normalisé 183842 octets » ; plafond 358 400. Écart de +48 avec le chiffre de référence 183 794 vérifié par builds locaux
(`npm run build -- --manifest`, `node tests/bundle/measureStart.ts`) : `origin/main` `d4d46030` (DATA-0292, base actuelle de la
branche) mesure lui-même 183 842 normalisés, et les 45 blocs de départ ont des tailles identiques bloc par bloc entre main et la branche
(seul un nom de bloc haché diffère, même taille) : la branche n'ajoute aucun octet au départ ; 183 794 ne correspond pas à `d4d46030`
(`f2a2a1d2`, avant DATA-0292 : 192 104). Aucune compensation faite (aucun module du départ dans la zone du module). Intermittence de
SessionRecords.test.tsx (« 65 kg × 8 », `76d1feb7`) : cause trouvée, les `findBy` (1 s) couvraient la première importation à froid
des modules à la demande (contenu JSON, progression, contrôle d'aberration à la validation, journée rouge) ; 3 échecs sur 3 avant,
préchauffage en `beforeAll` (`e647a415`, précédent Circuit.test.tsx, aucun délai changé) ; 10 passages consécutifs verts après.
Relecture 2 : à faire sur le run CI de ce lot.

## Statuts proposés

- BL-106, § 12.4 : fait (SEANCE-0292b, D-496, D-536). § 12.3 : fait (D-497). BL-140, BL-141 : fait.
- BL-111 : fait (D-537, D-538, D-543) ; § 14.2 b : fait (carte du corps, après les filtres).
- BL-112 : fait en partie ; reste la métrique distance (migration, données et synchro).
- § 17.1 a : fait (D-540) ; C-191 : reste BL-114 à BL-116.
- § 13.3 b : à faire, reste D-541 (notifications, ios-mobile ; Swift si `extend30`).
- H-1 : vérifié en partie (gravl.h1.test.ts ; Q-15, Q-16). § 13.2 a : inchangé, attend Q-12.
