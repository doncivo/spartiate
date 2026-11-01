## 8. Itérations et critères « terminé »

| Itération | Contenu | Critère « terminé » | Remplace |
| --- | --- | --- | --- |
| **I0 — Fork et pipeline** | § 7 et tickets § 25.2 | Gate § 7.2 passé, matrice remplie | — |
| **I1 — Carnet** | Bibliothèque 150 exercices, profils de matériel, routines, écran de séance (iPhone et PC), timer (Live Activity si `CONFIRMED`), historique, PR, constance, export / import, synchro des tables I1, écriture HealthKit si `CONFIRMED`, Diagnostic | Une séance entière hors ligne sur l'iPhone ; reprise après fermeture forcée ; visible sur le PC après synchro ; export / import vérifié ; 2 semaines d'usage réel | Hevy |
| **I2 — Moteur** | `src/domain/training` : 1RM avec confiance, double progression, snap, difficulté, explication, fatigue, stagnation, deload manuel ; séries pré-remplies | Fixtures déterministes ; même historique → même prescription ; zéro augmentation imposée ; adhérence ≥ 70 % sur 2 semaines | Gravl |
| **I3 — Programme** | Onboarding, génération, mésocycle, Semaine, « moins de temps », Strength Score ; édition confortable sur PC | Programme modifiable ; aucun exercice impossible ; deload non destructif ; un mésocycle suivi | Gravl + Alpha |
| **I4 — Nutrition** | `src/domain/nutrition` : cibles, journal (PC clavier, iPhone scan et photo), Ciqual + OFF, pesées, tendance, TDEE, check-in ; adaptateur IA | Journées incomplètes neutres ; check-in suspendu sans données ; photo corrigeable ; budget plafonné ; ≥ 4 j/7 loggés | MacroFactor |
| **I5 — Récupération** | Plugin HealthKit complet, `src/domain/recovery`, scores, récupération par muscle, Recovery Split, modulation, cadrans ; publication des résumés vers le PC | Scores masqués sans données ; tests 30 nuits ; aucune hausse due au score ; PC affiche la Recovery du jour | Athlytic + WHOOP |
| **I6 — Confort** | App Intents (plugin), bilans rédigés, import de programme, vidéos, cardio GPS, photos de progression synchronisées, export complet | Seules les surfaces `CONFIRMED` ; bilan avec nombres vérifiés | Reboot Plan |

Dépendances : I0 avant tout ; I2 avant I3 ; I4 et I5 indépendants après I3 ; I6 après I5. Hors périmètre définitif : app Watch, social, commercialisation, Android, form check, coach conversationnel.
