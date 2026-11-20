# AUDIT-CLAUDE-0.27.0 — traçabilité des chapitres 8 à 23

SHA audité : `d056640910db32cc9d08b940e9a6ae9e602d3b19` (`v0.27.0`). Statuts : **fait** / **partiel** / **absent** / **hors pér.** (itération future, liste « Hors périmètre » du § 8, ou D-n qui l'écarte). Preuves : fichier:ligne, D-n ou constat C-xxx de `constats.md`. Relevé par recherche ciblée (grep) et lecture, sans exécution (D-36 : « fait » ne vaut pas CONFIRMED). Chapitres 9 et 20 : existence seulement (moteur et migrations audités par Codex, PR #148).
Corrections de l'auditeur aux relevés : § 12.4 « < 1 s » couvert par `generateSession.test.ts:444-457` ; § 8 : usage réel commencé le 16/11 (D-292), critères de durée non encore atteignables.

| Chapitre | Fait | Partiel | Absent | Hors pér. |
|---|---|---|---|---|
| 8 Itérations | 7 | 3 | 1 | 1 |
| 9 Synchronisation (existence) | 8 | 0 | 1 | 0 |
| 10 Onboarding et profil | 21 | 4 | 2 | 6 |
| 11 Moteur de progression | 18 | 6 | 4 | 2 |
| 12 Génération et mésocycle | 15 | 5 | 0 | 1 |
| 13 Séance active | 14 | 7 | 9 | 4 |
| 14 Bibliothèque et matériel | 9 | 4 | 1 | 1 |
| 15 Nutrition | 20 | 5 | 3 | 8 |
| 16 Récupération | 15 | 8 | 0 | 2 |
| 17 Progrès, bilans, IA | 3 | 3 | 4 | 1 |
| 18 Navigation et écrans | 23 | 17 | 2 | 1 |
| 19 Plugins Swift | 10 | 6 | 0 | 2 |
| 20 Modèle de données (existence) | 13 | 0 | 0 | 2 |
| 21 Persistance, export | 5 | 8 | 0 | 1 |
| 22 Sécurité | 6 | 5 | 0 | 0 |
| 23 Qualité et tests | 8 | 9 | 1 | 0 |
| **Total** | **195** | **90** | **28** | **32** |

## 8 — Itérations
| § | Exigence | Statut | Preuve |
|---|---|---|---|
| I0 | Gate passé, matrice remplie | fait | D-71 (1) ; `capability-matrix.md:7` |
| I1 | Carnet (bibliothèque, routines, séance, historique, export) | fait | `content/exercises/exercises.json` (196), `src/features/training/session/*` |
| I1 | « 2 semaines d'usage réel » | partiel | usage réel depuis le 16/11 (D-292) : non encore atteint |
| I2 | Moteur déterministe, aucune hausse imposée | fait | `prescribe.test.ts:272`, `ExerciseProgression.tsx:26-31` |
| I2 | Adhérence ≥ 70 % sur 2 semaines | absent | aucune mesure |
| I3 | Onboarding, génération, mésocycle, Strength Score | fait | `domain/onboarding/draft.ts:14`, `generateSession.ts`, `mesocycle.ts`, `strengthScore.ts` |
| I3 | Aucun exercice impossible, deload non destructif | partiel | C-001, C-007 |
| I4 | Cibles, journal, Ciqual + OFF, TDEE, check-in | fait | `src/domain/nutrition/*`, `src-tauri/src/off.rs` |
| I4 | Photo corrigeable, budget IA | hors pér. | D-294 |
| I5 | Récupération, scores, Recovery Split, PC lecteur | fait | `syncTables.ts` (`recovery_day`) ; C-009 |
| I6 | Confort (App Intents, vidéos, import, bilans…) | partiel | circuits D-152, compléments D-212, GPS D-222, médias ; App Intents et import absents |
| § 8 | Hors périmètre définitif respecté (Watch, Android) | fait | aucun `gen/android`, aucune cible watchOS ; D-4 |

## 9 — Synchronisation (existence seulement)
| § | Exigence | Statut | Preuve |
|---|---|---|---|
| 9 | Journaux chiffrés, HLC, QR, oubli, reset | fait | `src/sync/*`, `src-tauri/src/sync/{crypto,pairing,forget,reset}.rs` |
| 9 | Catalogue, ordre, identifiants naturels | fait | `domain/sync/format.ts:680`, `naturalIds.ts`, D-26 |
| 9.1 | Tables publiées selon le tableau | fait | `SYNC_TABLE_ORDER` (29 tables), `catalogue.test.ts` |
| 9.1 | Exercice embarqué jamais publié | fait | `syncTables.ts:321`, `:344` |
| 9.1 | Séance publiée seulement close (D-27) | fait | `syncTables.ts:395-412`, `:416` |
| 9.2 | Conflits consultables et réversibles | fait | `ConflictList.tsx`, `SyncDetailsConflicts.tsx` |
| 9.2 | Pause si format supérieur | fait | `domain/sync/compat.ts` |
| 9.2 | Vecteurs étendus par itération | fait | `tests/fixtures/sync/vectors.json`, `tests/unit/sync/i0`…`i6` |
| 9.2 | E2E « séance iPhone → PC → édition PC → iPhone » | absent | aucun spec dans `tests/e2e/` (à confirmer par Codex) |

## 10 — Onboarding et profil
| § | Exigence | Statut | Preuve |
|---|---|---|---|
| 10 | Unités configurables | absent | kg seul (`fr.body.ts:35`) |
| 10 | Onboarding complet, profil publié | fait | `onboardingData.ts:159` |
| 10.0-1 | Dossier iCloud | fait | `SyncDetailsFolder.tsx` |
| 10.0-2 | 8 écrans, Mifflin « point de départ » | fait | `draft.ts:14`, `fr.onboarding.ts:39`, `:211` |
| 10.0-3 | Programme de départ, édition sur PC | fait | `RoutinesView.tsx:291`, `:476` |
| 10.0-3 | Charges de départ par standards −10 % | hors pér. | D-72 (1) |
| 10.0-4 | QR « Ajouter un iPhone » | fait | `syncRefonteText.ts:10`, `fr.syncPairing.ts:46-57` |
| 10.0-5 | Séance en ≤ 3 taps, timer, Facile / Juste / Dur | fait | `TodaySessionCard.tsx`, `restTimer.ts`, `ExerciseProgression.tsx:314` |
| 10.0-5 | Écriture Apple Santé en fin de séance | hors pér. | D-69, H-3a BLOCKED |
| 10.0-6 | Séance visible sur le PC < 60 s | fait | existence, § 9 |
| 10.0-7 | « Pourquoi ? », records | fait | `explain.ts`, `WorkoutSummary.tsx:75` |
| 10.0-8 | Signature à renouveler, check-in J+7 | fait | `domain/signingNotice.ts:19`, `firstCheckIn.ts:8` |
| 10.0 | Scénario rejoué (Playwright 1–3 et 6) | partiel | `I3-07-onboarding.spec.ts:37` (2–3), étape 6 sans e2e |
| 10.1-1 | Poids prérempli depuis Santé | partiel | par Raccourcis (D-69) |
| 10.1-2 | Objectif, rythme borné | fait | `StepsBasics.tsx:145` ; C-125 |
| 10.1-3/4 | Expérience, disponibilité | fait | `OnboardingFlow.tsx:331-349` |
| 10.1-5 | Préréglage salle / maison | fait | `content/equipment-profiles/profiles.json` |
| 10.1-6 | Body map, patterns douloureux | fait | `draft.ts:27-28`, `BodyMap.tsx`, `generateSession.ts:118` |
| 10.1-7 | Split et variété | fait | `draft.ts:50`, `:83` |
| 10.1-8 | Résultat : séance et cibles | fait | `StepsPlan.tsx` |
| 10.1 | Brouillon persisté, questions ignorables | fait | `onboardingData.ts:34-39` ; C-117, C-122 |
| 10.2 | Mensurations, photos, % MG | fait | `bodyProgress/measurements.ts`, `BodyProgress.tsx` ; C-089, C-090, C-094 |
| 10.2 | Blessures avec check-in bimensuel | absent | grep `blessure|injur` : 0 |
| 10.2 | Clé API et plafond | hors pér. | D-294 |
| 10.2 | Jour de check-in, notifications iPhone | fait | `StrategyView.tsx`, `RecoveryNotificationsSection.tsx` |
| 10.2 | Verrou Face ID / code | hors pér. | D-37 |
| 10.2 | Profil de matériel actif, écran synchro | fait | `EquipmentView.tsx`, `src/features/sync/*` |
| 10.3 | Permissions HealthKit | hors pér. | D-69 |
| 10.3 | Notifications demandées en fin de première séance | partiel | demandées au premier repos (`restTimer.ts:60`) |
| 10.3 | Caméra au premier scan | fait | `fr.nutrition.ts:162` |
| 10.3 | Localisation au premier cardio | fait | D-222 |
| 10.3 | Face ID à l'activation du verrou | hors pér. | D-37 |

## 11 — Moteur de progression
| § | Exigence | Statut | Preuve |
|---|---|---|---|
| 11 | Déterministe, constantes, `now` injecté | fait | `prescribe.ts:8-20`, `config.ts:73-107`, `prescribe.test.ts:414` |
| 11 | Constantes ajustables par exercice | partiel | seul `deloadLoad` (`mesocycle.ts:80`) |
| 11.1 | Signature `prescribe` | fait | `prescribe.ts`, `prescriptionInput.ts` |
| 11.2-1 | Validation, aberrante > 150 % | fait | `estimate1rm.test.ts:90` ; C-028 |
| 11.2-2/3 | Cible ; sans historique « provisoire » | fait | D-72 (1) : « à saisir » |
| 11.2-4 | Double progression, échelle 8-7-6 | fait | `prescribe.test.ts:35`, `:64` ; vecteur vert `partie4-moteur.test.ts` |
| 11.2-5 | Difficulté, recalibrage Facile borné | partiel | C-004, C-027 |
| 11.2-6 | Contraintes : maintien ou réduction seulement | partiel | C-001 (bloquant) |
| 11.2-7 | Snap matériel | partiel | C-006, C-007, C-029 |
| 11.2-8/9 | Explication, modification manuelle tracée | fait | `explain.ts`, `recommendation_decision` |
| 11.2 | Invariant `maxGainPerSession` | fait | `prescribe.property.test.ts` ; C-177 |
| 11.3 | 1RM Epley, pondérations, récence | fait | `config.ts:73-76` ; vecteurs verts |
| 11.3 | Confiance 0,4 / 0,3 / 0,3 | fait | `config.ts:79-83` ; vecteurs verts |
| 11.3 | Charge de départ par standards × 0,9 | hors pér. | D-72 (1) |
| 11.3 | Cran, position 0,93 / 0,88 | fait | `config.ts:93` ; vecteurs verts |
| 11.3 | Snap 3 % | fait | `config.ts:90` ; vecteurs verts |
| 11.3 | Fatigue, stagnation, inactivité | fait | `constraints.test.ts:66`, `:130-146` ; C-025 |
| 11.3 | Deload ÷ 2, × 0,8, RIR 4+ | fait | `constraints.test.ts:49`, `:203` ; vecteurs verts |
| 11.3 | Récupération × 0,95, jamais de bonus | fait | `config.ts:104-107`, D-93 |
| 11.3 | Machines : 1RM par profil de salle | partiel | D-86 (constat 5 reporté) |
| 11.3 | Poids de corps (reps puis lest), chronométrés | absent | `prescribe.ts:104` (« non prise en charge ») ; C-189 |
| 11.3 | Dégressives et partielles hors tonnage et 1RM | fait | `estimate1rm.ts:35` ; C-010, C-011 |
| 11.4 | Phrase depuis `reasons` | fait | `explain.ts`, `prescribe.test.ts:304` |
| 11.5 | Aberrantes signalées avant enregistrement | absent | C-005 (bloquant) |
| 11.5 | Séance < 50 % sans effet ; RIR facultatif | fait | `prescribe.test.ts:229`, `:317` |
| 11.5 | Retour à une prescription antérieure | absent | grep `revert|antérieur|revenir` : rien ; C-189 |
| 11.5 | Douleur ≠ incitation | fait | `generateSession.ts:118-124` |
| 11.6 | Fixtures et propriétés | partiel | C-169 (nominal 8 séances, changement de salle absents) |
| 11.6 | Couverture `src/domain` ≥ 80 % | fait | `vitest.config.ts:47` |
| 11.6 | Couverture training ≥ 90 % | absent | C-170 |

## 12 — Génération et mésocycle
| § | Exigence | Statut | Preuve |
|---|---|---|---|
| 12.1-1 | Split ; Recovery Split ≥ 80 % | partiel | C-009 (50 %) |
| 12.1-2 | Composés puis isolations, filtres | fait | `generateSession.ts:23`, `:124` ; D-73 (6), D-86 |
| 12.1-3 | Variété | fait | `config.ts:233-234`, D-73 (5) |
| 12.1-4 | Budget 45 s, plages 5–10 / 8–15 | partiel | C-012, C-013 |
| 12.1-5 | Styles | fait | `generationTypes.ts:20` |
| 12.1-6 | « J'ai 35 min » | fait | `GeneratedSession.tsx`, `generationInput.ts` |
| 12.2 | Durée 4–7, illimité, deload final | fait | D-267, D-269 ; vecteurs verts 4/5/6 semaines |
| 12.2 | +1 série/semaine, RIR 3 → 1 | fait | `config.ts:256-258` |
| 12.2 | Deload anticipable, fin de bloc | fait | `mesocycle.ts:22`, `:348-366` ; C-064 |
| 12.2 | Priorités ± 1 série | fait | `config.ts:259` |
| 12.3 | Modes Guidé / Libre / Maison | partiel | Variable / Fixe / Statique sans effet (D-73 (1)) |
| 12.3 | Mode Importé | hors pér. | I6, D-294 |
| 12.4 | Budget ± 10 %, sans doublon, sans matériel manquant | fait | `generateSession.test.ts:85-95`, `:165-188`, `:330-346` |
| 12.4 | Génération < 1 s | fait | `generateSession.test.ts:444-457` ; mesure `partie10-perf.test.ts` (0,26 ms) |
| 12.4 | Changement de salle sans perte | partiel | D-86 (constat 5) ; C-169 |
| 12.5 | Quatre programmes validés | fait | `content/programs/*.json`, `validate-content.mjs` ; H-8 UNVERIFIED |
| 12.5 | Périodisation 5 semaines | fait | amendée par D-269 (1) ; `mesocycle.prog01.test.ts` |
| 12.5 | Programme chargé = routine ordinaire | fait | `RoutinesView.tsx:33` |
| 12.6 | Pause : pas de jour manqué, streak gelé, aucune notification | fait | `programPause.ts:8-10`, `:62-63` |
| 12.6 | Reprise : détraînement, semaine allégée > 21 j, décalage | fait | `programPause.ts:11-14` ; vecteur vert |
| 12.6 | Maison haltères pendant la pause | fait | profil `maison-halteres` |

## 13 — Séance active
| § | Exigence | Statut | Preuve |
|---|---|---|---|
| 13 | Une interaction, hors ligne, clavier PC | fait | `SetRow.tsx`, `ActiveSession.tsx` ; C-068, C-077 |
| 13.1 | Démarrage depuis Aujourd'hui ou Entraîner | fait | `TodaySessionCard.tsx`, `StartSession.tsx:14` ; C-063 |
| 13.1 | Siri / bouton Action | hors pér. | I6 |
| 13.2 | Chrono, Terminer, abandonner | partiel | `ActiveSession.tsx:374`, `:515` ; pas de pause de séance |
| 13.2 | FC de la Watch | hors pér. | D-69 |
| 13.2 | Vignettes réordonnables, sauter | absent | C-190 |
| 13.2 | Remplacer, « ne plus proposer », image, notes | absent | seul « Retirer » (`ActiveSession.tsx:484`) ; C-190 |
| 13.2 | Précédent, cible, RIR, coche, supersets | fait | `SetRow.tsx:45-46`, `circuit.ts` |
| 13.2 | Type Failure | absent | `0003_workout.ts:48` ; C-190 |
| 13.2 | Tap charge → « Pourquoi ? » | fait | `ExerciseProgression.tsx` |
| 13.2 | Calculateur de disques | absent | reporté (`docs/I2-01.md:305`), jamais livré ; C-190 |
| 13.2 | Facile / Juste / Dur ignorable | fait | `ExerciseProgression.tsx:314` |
| 13.2 | Repos : barre, +30 s, passer, auto | fait | `restTimer.ts:43-45`, `:99-104` |
| 13.2 | Fatigue déclarée | absent | grep `Frais|declaredFatigue` : 0 ; C-190 |
| 13.3 | Date de fin persistée | fait | `syncTables.ts:412` |
| 13.3 | Live Activity compacte | fait | H-4 CONFIRMED |
| 13.3 | Live Activity étendue (suivant, +30 s, passer) | absent | `SpartiateTimerAttributes.swift:11-14` ; C-190 |
| 13.3 | Notification de repli avec « +30 s » | partiel | sans catégorie d'action (`timerNotification.ts:9`) |
| 13.3 | Haptique | fait | `src/platform/haptics` |
| 13.4 | Série écrite à la validation, reprise après fermeture | fait | `workoutRepository.ts`, `ActiveSession.tsx:162` ; C-078 |
| 13.4 | Correction d'une série validée tracée | partiel | C-072 |
| 13.4 | Séance en cours non publiée | fait | `syncTables.ts:395-412` |
| 13.5 | Résumé : durée, séries, volume, records | fait | `WorkoutSummary.tsx:13-15` |
| 13.5 | Résumé : écart, prochaine séance | absent | C-190 |
| 13.5 | Image partageable | absent | C-190 |
| 13.5 | Écriture `HKWorkout` | hors pér. | D-69 |
| 13.6 | Rattachement d'une séance Watch | hors pér. | D-69 |
| 13.7 | Tests : reprise, partielle, synchro | fait | `SessionClosure.test.tsx`, `trainingTables.test.ts` |
| 13.7 | Tests : timer après verrouillage | partiel | `restTimer.test.ts` |
| 13.8 | Échauffement | partiel | `warmup.ts` ; C-002, C-030 |
| 13.8 | Démarrer par copie | fait | `StartSession.tsx:14-18` |
| 13.8 | « Mettre à jour la routine ? » | partiel | C-003, C-010 |
| 13.8 | Historique éditable, recalcul | partiel | C-072, C-082 |
| 13.8 | Replay, circuits | fait | `replay.ts`, `circuit.ts`, D-152 ; C-014, C-015 |

## 14 — Bibliothèque et matériel
| § | Exigence | Statut | Preuve |
|---|---|---|---|
| 14.1 | ≥ 150 exercices, relus par Ali | fait | 196 exercices ; H-8 UNVERIFIED |
| 14.1 | Validation CI, listes fermées | fait | `validate-content.mjs:15-17` |
| 14.1 | Licence et source par média | fait | 101 images ; H-9 UNVERIFIED ; C-180 |
| 14.1 | Médias à la demande | fait | `ExerciseMedia.tsx:9`, `:23` |
| 14.2 | Fiche, 1RM, confiance | fait | `LibraryView.tsx:169-171`, `ExerciseSheetStats.tsx:11` |
| 14.2 | Graphique Recharts | partiel | tracé SVG décoratif (`ExerciseSheetStats.tsx:42`) ; C-191 |
| 14.2 | Recherche nom FR / alias EN | fait | `LibraryView.tsx:53-59` |
| 14.2 | Filtres body map et pattern | absent | `LibraryView.tsx:57-59` (groupe, compatible, texte) ; C-191 |
| 14.2 | Exercice personnalisé publié | fait | `syncTables.ts:344` ; C-001 |
| 14.2 | Complétion IA | hors pér. | D-294 |
| 14.3 | Plusieurs profils, actif local | fait | `profiles.json` |
| 14.3 | Inventaire complet | partiel | C-066, C-081 |
| 14.3 | Forcés / interdits | partiel | C-029 |
| 14.3 | Préréglages | fait | `profiles.json` (3) |
| 14.3 | Machines : 1RM par profil | partiel | D-86 (constat 5) |

## 15 — Nutrition
| § | Exigence | Statut | Preuve |
|---|---|---|---|
| 15.1 | Tendance EMA 14 j, aberrante 0,25 | fait | `weightTrend.ts:3` ; vecteur vert ; C-093 |
| 15.1 | TDEE 21 j, 7 700 kcal | fait | `tdee.ts` ; vecteur vert (2 737,03) |
| 15.1 | Lissage EMA 7 j | absent | C-036 |
| 15.1 | Mifflin et transition 28 j | fait | `config.ts:20-23`, `:52` ; vecteur vert |
| 15.1 | Jours non loggés jamais 0 | fait | `journal.ts:25`, D-74 (2) |
| 15.1 | Imputation affichée avec incertitude | absent | `weightTrend.ts:3` (« aucune imputation ») ; C-194 |
| 15.1 | Confiance affichée | fait | `DashboardView.tsx:12-14` |
| 15.2 | Couverture 4/7 et 2 pesées | fait | `config.ts:28-32` ; C-038, C-039 |
| 15.2 | Jour complet déclaré ou déduit | fait | D-81 ; C-099 |
| 15.2 | Amplitude ± 150 | fait | `config.ts:35` ; vecteur vert |
| 15.2 | Macros | fait | `config.ts:57-63` ; C-037 |
| 15.2 | Check-in accepter / refuser / personnaliser | partiel | C-031, C-086 |
| 15.2 | Bornes 1 200 / 800, perte 1 %, alerte 25 % | partiel | C-031, C-087 |
| 15.2 | Styles | fait | `prefs.ts:19` |
| 15.2 | Modificateur des pas | hors pér. | I6 |
| 15.3 | Recherche : récents, favoris, provenances | partiel | C-092, C-100 ; « go-tos » non trouvés |
| 15.3 | Quick Add, recettes | fait | `QuickAddForm.tsx`, `recipes/*` ; C-034, C-044 |
| 15.3 | Assiette | absent | grep `assiette|plate` : 0 ; C-194 |
| 15.3 | Code-barres sur iPhone | fait | `BarcodeScanView.tsx` ; C-043 |
| 15.3 | Camera Control | hors pér. | H-10 UNVERIFIED |
| 15.3 | Photo → IA | hors pér. | D-294 |
| 15.3 | Describe, dictée | hors pér. | I6 ; C-141 |
| 15.3 | Compléments avec rappels | fait | D-210, D-212 ; C-035, C-048, C-091 |
| 15.4 | Ciqual embarqué, licence | fait | `content/food/ciqual.json` (3 484), `docs/licences.md` |
| 15.4 | OFF par Rust, cache 90 j | fait | `off.rs`, `offProduct.ts:73` ; C-033, C-046 |
| 15.4 | Fiches perso synchronisées | fait | `CustomFoodForm.tsx` |
| 15.5 | Journal : timeline, restant, couverture | fait | `JournalView.tsx:30-52` ; C-096, C-097, C-098 |
| 15.5 | Dashboard | partiel | C-088 |
| 15.5 | Stratégie | fait | `StrategyView.tsx` |
| 15.5 | Écriture Apple Santé | hors pér. | D-69 |
| 15.6 | Fixtures 8 semaines, signe, jamais 0, ± 150 | fait | `eightWeeks.test.ts`, `tdee.test.ts`, `checkIn.test.ts` ; C-168 |
| 15.7 | Étiquette, repères OMS, micronutriments | hors pér. | I6 |
| 15.7 | Jours hauts / bas | fait | `restDay.ts`, D-74 (c) ; C-031 |
| 15.7 | Note d'équilibre | hors pér. | écartée par le PRD |

## 16 — Récupération
| § | Exigence | Statut | Preuve |
|---|---|---|---|
| 16 | Abstention, jamais un diagnostic | fait | `fr.recovery.ts:31-35`, `:63` ; `engine.test.ts:108-138` |
| 16 | Mesures par le plugin healthkit | hors pér. | D-69 ; fichiers Raccourcis (`shortcutFiles.ts`) |
| 16.1 A | Fatigue, récupération par muscle | fait | `muscleRecovery.ts:13`, `daySummary.ts:58` |
| 16.1 B | Seuils absolus | fait | `daySummary.ts:73-76` ; C-060 |
| 16.1 C | Recovery, Exertion, zone cible, sommeil | partiel | zone cible jamais affichée ; C-191 |
| 16.2 | Commandes `healthkit_*` complètes | hors pér. | D-69 ; C-158 |
| 16.3 | Baseline 14 nuits, 7 minimum, > 2,5 σ | partiel | C-049, C-061 |
| 16.3 | Recovery 0-100, null avec raison | fait | `recoveryScore.ts:27` ; vecteurs verts (67, 74) |
| 16.3 | Qualité good / partial / insufficient | fait | `fr.recovery.ts:37-39` |
| 16.3 | Exertion par zones FC | partiel | minutes × ressenti (D-88, D-220) ; C-051, C-070 |
| 16.3 | Zone cible ≥ 66 / 34-65 / ≤ 33 | partiel | calculée et stockée, non affichée ; C-191 |
| 16.3 | Besoin de sommeil, dette, régularité | fait | `sleepNeed.ts:25` ; vecteur vert (582) |
| 16.3 | Récupération par muscle 48/72/96 h | partiel | cardio importé non retiré ; C-062 |
| 16.4 | Recovery Split, modulation | partiel | C-009 |
| 16.4 | Notification du matin ≤ 1/jour, iPhone | fait | `recoveryNotificationPlan.ts:18` |
| 16.4 | L'iPhone écrit, le PC lit | fait | `bootstrap.ts:266` |
| 16.5 | « En apprentissage J+x/14 », contributeurs | fait | `fr.recovery.ts:27-30`, `:45-56` |
| 16.5 | Aucun faux zéro | fait | partie 6 |
| 16.6 | Fixtures 30 nuits | fait | `engine.test.ts:12-152` ; C-169 (7 nuits) |
| 16.6 | Vecteurs `recovery_day` | fait | `tests/fixtures/sync/vectors.json` |
| 16.7 | Journal de facteurs | fait | `factors.ts:14-64` |
| 16.7 | Heure de coucher, rappel 30 min avant | partiel | C-050 |
| 16.7 | Valeurs inhabituelles | fait | `unusualValues.ts:55` |
| 16.7 | Tuile Pas | fait | `fr.recovery.ts:64-72` ; C-052 |
| 16.7 | Bandeau journée rouge en séance | fait | `ActiveSession.tsx:101-102` |

## 17 — Progrès, bilans, IA
| § | Exigence | Statut | Preuve |
|---|---|---|---|
| 17.1 | Charges et 1RM, bande de confiance | fait | `ExerciseSheetStats.tsx` |
| 17.1 | Records, notification en séance | partiel | records au résumé seulement ; C-191 |
| 17.1 | Volume par muscle et par semaine | absent | C-191 |
| 17.1 | Constance : streak, calendrier | partiel | bande de semaine PC seulement ; C-191 |
| 17.1 | Corps : tendance, dépense, mensurations, photos | fait | `fr.bodyProgress.ts:11`, `:95-113` ; C-090, C-093 |
| 17.1 | Strength Score | fait | `strengthScore.ts` ; vecteurs verts ; C-023, C-024 |
| 17.1 | Récupération : tendances 30 j | absent | `RecoveryProgress.tsx:29`, `:61-70` ; C-191 |
| 17.1 | Graphiques Recharts < 300 ms | partiel | `recharts` déclaré, jamais importé ; C-167, C-191 |
| 17.2 | Appels IA | hors pér. | D-294 |
| 17.3 | Bilans avec repli gabarit | absent | grep « bilan » ; C-191 |
| 17.4 | Import de programme | absent | C-141, C-191 |

## 18 — Navigation, écrans, états dégradés
| § | Exigence | Statut | Preuve |
|---|---|---|---|
| 18.1 | 5 onglets iPhone | fait | `navigation.ts:11`, `:25` |
| 18.1 | Barre latérale PC rétractable | partiel | aucun repli ; C-192 |
| 18.1 | Ctrl+1…5, Ctrl+K | partiel | `tabShortcuts.ts:13-30` ; C-135 |
| 18.1 | Safe areas | fait | `tokens.css` |
| 18.1 | Fenêtre ≥ 1 024 × 700, maître-détail | fait | `tauri.conf.json:20-21`, `useLayout.ts:6` |
| 18.1 | Swipe, long-press, haptique | partiel | haptique seule ; C-192 |
| 18.1 | Clic droit, double-clic | absent | 0 `onContextMenu`, 0 `onDoubleClick` ; C-192 |
| 18.1 | Glisser-déposer | fait | `RoutinesView.tsx:129`, `:294` |
| 18.1 | Minuteur iPhone, Live Activity | fait | H-4 CONFIRMED |
| 18.1 | Minuteur PC, badge dans le titre | partiel | aucun badge ; C-192 |
| 18.1 | Coquille unique | fait | `useLayout.ts:18`, D-47 |
| 18.1 | « Disponible sur iPhone » | fait | `fr.health.ts:16`, `:63` |
| 18.2 | Aujourd'hui | partiel | streak absent ; C-191 |
| 18.2 | Entraînement | fait | `src/features/training/*` |
| 18.2 | Nutrition | fait | `src/features/nutrition/*` |
| 18.2 | Progrès : graphiques, records, bilans | partiel | C-191 |
| 18.2 | Plus | partiel | C-119 |
| 18.3 | Première semaine sans faux zéro | fait | `fr.recovery.ts:27-30`, `fr.today.ts:29-33` |
| 18.3 | Pas de Watch / Santé refusée | fait | `fr.recovery.ts:31-35` |
| 18.3 | iCloud hors ligne | fait | `fr.syncEngine.ts:12-14` |
| 18.3 | Conflit sans boîte bloquante | fait | `fr.syncConflicts.ts` |
| 18.3 | Signature < 24 h avec lien SideStore | partiel | aucun lien ; C-126, C-192 |
| 18.3 | Clé IA absente | hors pér. | D-294 |
| 18.3 | Live Activity indisponible | fait | `timerNotification.ts` ; C-162 |
| 18.3 | Crash : séance restaurée depuis SQLite | fait | `SessionScreen.tsx:37` ; cardio non restauré : C-067 |
| 18.3 | États dégradés testés | partiel | C-193 |
| 18.4 | Tokens, aucune couleur en dur | fait | `charte.test.ts:43-69` ; C-134 |
| 18.4 | Contrastes AA | partiel | C-111, C-112 |
| 18.4 | Typographie, chiffres tabulaires | fait | D-241 |
| 18.4 | Sombre par défaut, forçable | fait | `contrast.test.ts:77` |
| 18.4 | Icônes Lucide | fait | `package.json:42` |
| 18.4 | Icône d'app générée par script | partiel | `content/brand/spartiate.svg` non lu par un script ; C-194 |
| 18.4 | Rayon 10, cibles ≥ 44 pt | fait | `tokens.css:40`, `:61` |
| 18.4 | Ton sans point d'exclamation | fait | 0 dans `fr.ts` |
| 18.4 | Transitions ≤ 200 ms, réduire les animations | fait | `tokens.css:417` |
| 18.5 | Maquettes livrées | fait | 24 planches |
| 18.5 | `npm run visual`, toutes les paires | partiel | C-193 |
| 18.5 | Rupture ≥ 900 px | partiel | 1 024 px ; C-135, C-188 |
| 18.6 | Dynamic Type « Très grand » | absent | C-113 |
| 18.6 | Zoom 100-150 % PC | partiel | aucun test |
| 18.6 | Équivalent clavier | partiel | C-068, C-121, C-122 |
| 18.6 | Réduire la transparence, pas de couleur seule | fait | 0 `backdrop-filter` |

## 19 — Plugins Swift et contrat iOS
| § | Exigence | Statut | Preuve |
|---|---|---|---|
| 19.1 | haptics, files, folder-bookmark, notification-actions | fait | `lib.rs:125`, `:139`, `:217`, `:222` ; C-153, C-155 |
| 19.1 | notification-actions : … check-in | partiel | aucune notification de check-in ; C-194 |
| 19.1 | privacy-shield activable | partiel | C-159 |
| 19.1 | speech / vision conservés | fait | D-33 ; sans usage : C-141 |
| 19.1 | barcode-scanner | fait | `lib.rs:126` |
| 19.1 | reminders et web-auth supprimés | fait | grep vide |
| 19.2 | healthkit lecture / écriture | hors pér. | D-69 ; C-188 |
| 19.2 | live-activity | fait | H-4 ; C-156 |
| 19.2 | camera (photo de repas) | hors pér. | D-294 |
| 19.2 | Structure des plugins, stubs Windows | fait | 9/9 plugins |
| 19.2 | Aucun `UIBackgroundModes` | fait | `plist-contract.json` |
| 19.3 | Bundle id, iOS 18 vérifiés en CI | fait | `build-ios.yml:205-211` |
| 19.3 | Textes `NSHealth*`, caméra | partiel | C-158 |
| 19.3 | `NSPhotoLibraryUsageDescription` interdite | fait | `plist-contract.json` |
| 19.3 | `NSSupportsLiveActivities` | fait | `plist-contract.json` ; valeur non contrôlée : C-160 |
| 19.3 | `ITSAppUsesNonExemptEncryption` vérifiée en CI | partiel | présente, non contrôlée ; C-194 |
| 19.4 | Entitlements | partiel | C-158 |
| 19.4 | Ni App Groups, iCloud container, push ; codesign | partiel | C-160, C-174 |

## 20 — Modèle de données (existence)
| § | Exigence | Statut | Preuve |
|---|---|---|---|
| 20.0 | `settings`, tables `sync_*`, `conflict_log`, `epoch_carry_report` | fait | `0001_spartiate_init.ts` |
| 20.0 | `schema_migrations` | fait | `migrator.ts:87` |
| 20.0 | Ni `app_meta` ni `app_pref` | fait | grep vide |
| 20.2 | `profile`, `body_weight` | fait | `0001_spartiate_init.ts` |
| 20.2 | Entraînement (exercise … routine_exercise) | fait | `0002_training.ts` |
| 20.2 | `workout`, `workout_set` | fait | `0003_workout.ts` |
| 20.2 | `recommendation_decision`, `progression_profile` | fait | `0005_progression.ts` |
| 20.2 | `mesocycle` | fait | `0007_mesocycle.ts` |
| 20.2 | Nutrition (food … nutrition_target) | fait | `0008_nutrition.ts` |
| 20.2 | `recovery_day`, `muscle_recovery` | fait | `0010_recovery.ts` |
| 20.2 | `measurement`, `progress_photo` | fait | `0012_body_progress.ts` |
| 20.2 | `cardio_session` | fait | `0018_cardio.ts` |
| 20.2 | `health_sample_cache` | hors pér. | sans objet depuis D-69 (sans D-n explicite) |
| 20.2 | `ai_call` | hors pér. | D-294 |
| 20.3 | `PRAGMA foreign_keys = ON` | fait | `wrapper.rs:418` |

## 21 — Persistance, sauvegarde, export / import
| § | Exigence | Statut | Preuve |
|---|---|---|---|
| 21.1 | URL et fichier de base alignés | fait | `sqlDriver.ts:62`, `guard.rs:30`, `backup.rs:28` |
| 21.1 | Clé au coffre | fait | `Cargo.toml:60`, `:69` ; C-142, C-148 |
| 21.1 | Données réelles interdites | partiel | C-165 |
| 21.2 | WAL, `synchronous = NORMAL`, checkpoint | partiel | `synchronous` jamais posé ; C-194 |
| 21.2 | Sauvegardes 14 / 5 / 3 | partiel | C-137, C-138 |
| 21.2 | Journaux 256 Kio × 2 | partiel | C-140, C-147 |
| 21.2 | Mise à jour SideStore sans supprimer l'app | partiel | H-5 ; C-110, C-181 |
| 21.3 | Zip `data.json`, `manifest.json`, `media/` | partiel | D-57, D-104 ; C-136 |
| 21.3 | CSV par domaine | fait | `fullExport.ts:6`, D-104 |
| 21.3 | Import zip fusion / remplacement, aperçu | partiel | D-57 ; C-109, C-127 |
| 21.3 | Import CSV Hevy / Strong | hors pér. | Q-4, D-230 |
| 21.3 | Import par les repositories, HLC | fait | D-57 |
| 21.3 | Export PC dossier, iPhone partage | fait | `export.rs`, `export_ios.rs` ; C-145 |
| 21.4 | Effacement en deux étapes | partiel | D-180 à D-182 ; C-108, C-130 |

## 22 — Sécurité, journaux, clé API
| § | Exigence | Statut | Preuve |
|---|---|---|---|
| 22 | Base en clair protégée par l'OS | fait | D-17 ; C-152 |
| 22 | Transit chiffré, rustls, pas de HTTP | fait | `Cargo.toml:48-56`, `off.rs` |
| 22 | Secrets au coffre seulement | fait | partie 9 |
| 22 | CSP stricte, capabilities par plateforme | partiel | C-141 |
| 22 | Permissions iOS au premier usage | fait | `fr.health.ts:16`, `:63` |
| 22 | Journaux sans donnée corporelle | partiel | C-140, C-151, C-123 |
| 22 | Export des journaux | fait | `LogsScreen.tsx` |
| 22 | `cargo audit`, `npm audit` | partiel | C-175 |
| 22 | Versions épinglées | fait | `Cargo.lock`, `package-lock.json`, `--locked` |
| 22 | Mise à jour signée | partiel | C-166, C-172, C-179 |
| 22 | privacy-shield optionnel, verrou différé | fait | D-37 ; C-159 |

## 23 — Qualité et tests
| § | Exigence | Statut | Preuve |
|---|---|---|---|
| 23.1 | Couverture `src/domain/**` ≥ 80 % | fait | `vitest.config.ts:45-48` |
| 23.1 | 90 % sur training | absent | C-170 |
| 23.1 | Vecteurs des § 11 à 16 | partiel | C-168, C-169 |
| 23.1 | DB Wasm, parité H-18 | partiel | H-18 UNVERIFIED |
| 23.1 | Vecteurs de synchro | fait | `vectors.json` |
| 23.1 | Rust : tests, clippy, fmt | fait | `tests.yml:179-200` |
| 23.1 | typecheck, lint, contraste | fait | `package.json`, `contrast.test.ts` |
| 23.1 | E2E : séance au clavier, journal, export / import | partiel | C-193 |
| 23.1 | E2E WebKit | partiel | `playwright.config.ts:62-64` ; C-095 |
| 23.1 | Smoke natif et NSIS | fait | `tests.yml:508-510` |
| 23.1 | Visuel de chaque onglet et états dégradés | partiel | C-193 |
| 23.1 | Perf : démarrage, graphiques, bundle | partiel | bundle 196 042 octets ; C-167 |
| 23.1 | Scripts iOS testés | fait | `scripts/ios/*` ; C-160 |
| 23.1 | Recette iPhone signée par itération | partiel | `docs/qa/iphone.md` ; C-183 |
| 23.2 | `tests.yml` à chaque push, « suite verte » | partiel | C-173, C-174 |
| 23.2 | Builds sur tag | fait | sécurité : C-166, C-172 |
| 23.2 | Fixtures entièrement synthétiques | partiel | fixture de sommeil construite autour d'une valeur réelle ; C-165 |
| 23.3 | Matrice de non-régression à chaque release | partiel | H-5, `I-02.spec.ts` ; verrouillage et visuel manuels |
