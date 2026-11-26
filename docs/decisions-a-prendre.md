# Décisions à prendre par Ali

Questions fermées ouvertes pendant les lots 0.29.2 et suivants (prompt du 24/11, docs/LOT-0.29.2.md) et lignes « à trancher par Ali »
du registre (docs/backlog.md) restées sans réponse au 24/11. Chaque question : 2 à 4 options, une recommandation, les conséquences.
Le lot continue sans la réponse : le comportement actuel reste en place tant qu'une option n'est pas choisie. Réponse attendue sous la
forme « Q-n : option ». Une question tranchée devient une D- dans docs/decisions.md et sort de ce fichier.


Q-1 à Q-10 tranchées par Ali le 24/11 : D-496 à D-505 ; Q-32 à Q-39 tranchées le 26/11 : D-647 à D-654 ; Q-11 à Q-31 et Q-40 tranchées le 26/11 : D-657 à D-678 (docs/decisions.md ; D-655 et D-656 sont prises par TECH-0298). Aucune question ouverte. La revue par thème des choix prudents (D-490, BL-149) est
en fin de fichier, générée par `node scripts/release/prudent-review.mjs --write` (sections « séance et moteur », « nutrition »,
« récupération », « synchro et données », « écrans », « CI et outillage »).

<!-- revue-choix-prudents:debut (généré par scripts/release/prudent-review.mjs --write ; ne pas éditer à la main) -->

## Revue par thème des choix prudents (D-490, BL-149)

376 décisions retenues : colonne source « Claude » ou « choix prudent », ou texte « révisable par Ali », hors décisions validées par Ali dans leur colonne source.
Thème, poids et nature sont calculés par mots-clés (scripts/release/prudent-review.mjs) : un tri mécanique, à corriger par Ali s'il se trompe (D-618).
Poids : synchro 3, schéma 3, moteur 2, données effacées 2, chiffre 1, écran 1, longueur jusqu'à 3, « à trancher » 4. Les plus lourdes en tête de chaque thème.
Réponse attendue : « D-n : A » (garder) ou « D-n : B, … » (réviser, avec ce qui change). Aucun comportement ne change tant qu'Ali n'a pas répondu ; une réponse devient une D- nouvelle.

### Les quinze plus lourdes à trancher, tous thèmes

| Poids | D- | Résumé | Ce qu'Ali tranche |
|---|---|---|---|
| 14 | D-76 | Écrans de Nutrition sans IA ni réseau (I4-03, mission de nuit du 2026-11-08). | A garder · B réviser ; effet : moteur, synchro, schéma, données, chiffre, écran |
| 12 | D-110 | I3-07 (0.15.0) : onboarding en 8 écrans, périmètre, déclenchement et stockage SANS migration (la numérotation saute D-105 à D-109 : D-102 à D-104 … | A garder · B réviser ; effet : synchro, schéma, données, chiffre |
| 12 | D-113 | I6-04 (0.16.0) : import Renpho / Santé par Raccourcis, SANS MIGRATION (schéma 13 inchangé). | A garder · B réviser ; effet : synchro, schéma, données, chiffre |
| 12 | D-402 | BLESSURES (0.28.1) : gênes en stockage local (§ 10.2). | A garder · B réviser (déjà marquée « à trancher ») ; effet : synchro, schéma, données |
| 11 | D-618 | SHELL-0294f (BL-149, D-490) : revue par thème des choix prudents, produite par script. | A garder · B réviser ; effet : moteur, synchro, schéma, données |
| 11 | D-645 | CLEAN-0297 (C-085) : 22 traducteurs de plus typés comme catalogText, par leur corps d'origine. | A garder · B réviser ; effet : moteur, synchro, données, chiffre, écran |
| 10 | D-79 | I4-06 favoris : stockage local, non synchronisé, ne passent pas d'un appareil à l'autre (mission de nuit du 2026-11-09). | A garder · B réviser ; effet : synchro, schéma, données, écran |
| 10 | D-116 | CLEAN-01 (0.17.0) : le banc legacy et ce que les gardes citent sont CONSERVÉS. | A garder · B réviser ; effet : moteur, synchro, schéma, écran |
| 10 | D-172 | FIX-0181 : migration 0015 (schéma 15). | A garder · B réviser ; effet : synchro, schéma, données, écran |
| 10 | D-644 | CLEAN-0296 (C-085) : traducteurs à part typés comme catalogText, garde à liste figée. | A garder · B réviser ; effet : synchro, schéma, chiffre, écran |
| 9 | D-81 | I4-07 « journée complète » : table day_completeness publiée (mission de nuit du 2026-11-09; tranche D-74 point 2 et D-76 point 2). | A garder · B réviser ; effet : synchro, schéma, données |
| 9 | D-85 | REV-01 (0.9.3) : séances ouvertes dans l'archive d'export (constat 1 de la relecture Codex du 9 novembre). | A garder · B réviser ; effet : synchro, schéma, données |
| 9 | D-120 | FIX-0171 (0.17.1) : colonne absente d'une archive ancienne ≠ valeur nulle explicite (relecture Codex du 12/11, constat 1). | A garder · B réviser ; effet : synchro, schéma, données |
| 9 | D-221 | I6-06 : modèle des séances cardio (migration 0018, schéma 18, après la 0017 des compléments, I6-05). | A garder · B réviser ; effet : synchro, schéma, données |
| 9 | D-510 | SEANCE-0292 (§ 11). | A garder · B réviser ; effet : moteur, synchro, schéma, chiffre |

### séance et moteur (114 : 72 à trancher, 42 à confirmer seulement)

| Poids | D- | Résumé | Ce qu'Ali tranche |
|---|---|---|---|
| 9 | D-85 | REV-01 (0.9.3) : séances ouvertes dans l'archive d'export (constat 1 de la relecture Codex du 9 novembre). | A garder · B réviser ; effet : synchro, schéma, données |
| 9 | D-510 | SEANCE-0292 (§ 11). | A garder · B réviser ; effet : moteur, synchro, schéma, chiffre |
| 9 | D-539 | SEANCE-0292b (BL-112, amende D-385). | A garder · B réviser ; effet : moteur, synchro, schéma, chiffre |
| 8 | D-305 | PROG-03 (0.26.0) : réordonner les exercices d’un jour et les jours d’une routine sur PC par glisser-déposer et Alt+↑/↓ (§ 18.1, § 18.6 ). | A garder · B réviser ; effet : synchro, schéma, écran |
| 7 | D-111 | I3-07 (0.15.0) : contenu des écrans, calculs et limites. | A garder · B réviser ; effet : moteur, chiffre, écran |
| 7 | D-312 | STR-01 (0.26.0) : calcul du Strength Score. | A garder · B réviser ; effet : moteur, synchro, chiffre |
| 7 | D-323 | FIX-ABERR (0.28.0). | A garder · B réviser ; effet : moteur, schéma, chiffre |
| 7 | D-365 | TESTS-FIGES (0.28.0) : charge d'historique hors de la grille de la salle courante, à trancher par Ali (C-169; BL-106). | A garder · B réviser (déjà marquée « à trancher ») ; effet : moteur, chiffre |
| 7 | D-386 | MOTEUR-0281b (0.28.1) : retour à la prescription d'avant la dernière hausse (§ 11.5). | A garder · B réviser ; effet : moteur, synchro, données |
| 7 | D-409 | REL-0.28.1 : unités configurables (§ 10, tracabilité « absent ») non livrées, écart proposé. | A garder · B réviser (déjà marquée « à trancher ») ; effet : moteur, écran |
| 7 | D-471 | SEANCE-0291 (BL-106, D-365 non tranchée par Ali le 21/11) : charge d'historique hors de la grille du profil courant signalée, jamais changée en … | A garder · B réviser (déjà marquée « à trancher ») ; effet : moteur, chiffre |
| 6 | D-289 | ERGO-02b (0.25.0) : écarts de charge « par haltère », aperçu illisible, premier cycle. | A garder · B réviser ; effet : moteur, données, chiffre, écran |
| 6 | D-322 | FIX-ASSIST (0.28.0) : exercice assisté, l'assistance est une charge négative (audit Claude 0.27.0, C-001, C-002, C-011; complète D-170 (3), D-273, … | A garder · B réviser ; effet : moteur, chiffre, écran |
| 6 | D-392 | PROGRES-d (0.28.1) : adhérence sur 4 semaines (I2). | A garder · B réviser (déjà marquée « à trancher ») ; effet : moteur |
| 5 | D-73 | Décisions I3 par défaut, révisables par Ali (2026-11-08, mission de nuit sans réponse d'Ali). | A garder · B réviser ; effet : moteur, chiffre |
| 5 | D-102 | I6-03 (0.14.0) : circuits dans la séance. | A garder · B réviser ; effet : moteur, chiffre |
| 5 | D-184 | RESET-01 : séance en cours, ordre et rechargement. | A garder · B réviser ; effet : synchro, données |
| 5 | D-542 | SEANCE-0292b (relecture 1, point B; précédent D-388). | A garder · B réviser ; effet : moteur, synchro |
| 5 | D-599 | SHELL-0294b (§ 13.3 b, BL-108, D-541). | A garder · B réviser ; effet : données, écran |
| 4 | D-269 | PROG-01 (0.24.0) : table du mésocycle. | A garder · B réviser ; effet : moteur, écran |
| 4 | D-286 | FIX-0243 (0.25.0) : relecture des cartes après synchro et après clôture (complète D-260 ). | A garder · B réviser ; effet : synchro |
| 4 | D-297 | ERGO-03 (0.26.0) : repère du cycle sur Aujourd'hui. | A garder · B réviser ; effet : moteur, écran |
| 4 | D-530 | SEANCE-0292 (C-006, relecture à froid A, point important). | A garder · B réviser ; effet : moteur, chiffre |
| 4 | D-540 | SEANCE-0292b (§ 17.1 a, C-191). | A garder · B réviser ; effet : moteur, chiffre, écran |
| 3 | D-278 | FIX-0242 (0.25.0) : unité de dose et nouvel essai d'une séance cardio. | A garder · B réviser ; effet : chiffre, écran |
| 3 | D-313 | STR-01 (0.26.0) : écran Progrès › Strength Score. | A garder · B réviser ; effet : moteur |
| 3 | D-338 | FIX-PLANCHER (0.28.0) : check-in relevé au plancher, confirmation en vigueur reprise, case réelle à « Accepter » (C-031 ). | A garder · B réviser ; effet : moteur, chiffre |
| 3 | D-376 | SESS-01 (0.28.1) : charge estimée au remplacement d'un exercice sans historique. | A garder · B réviser ; effet : moteur, chiffre |
| 3 | D-382 | SESS-01 (0.28.1) : Live Activity, exercice suivant et sa charge dans le libellé existant. | A garder · B réviser ; effet : moteur, écran |
| 3 | D-384 | MOTEUR-0281a (0.28.1) : chronométrés progressés en secondes (§ 11.3). | A garder · B réviser ; effet : moteur, chiffre |
| 3 | D-457 | PROGRES-0291 (BL-125) : règles des recommandations du bilan. | A garder · B réviser ; effet : moteur, chiffre |
| 3 | D-518 | SEANCE-0292 (C-071). | A garder · B réviser ; effet : moteur, chiffre |
| 3 | D-543 | SEANCE-0292b (relecture 1, point D; prolonge D-537 et D-496). | A garder · B réviser ; effet : moteur, chiffre |
| 2 | D-211 | I6-05 : constance, révisable par Ali. | A garder · B réviser ; effet : chiffre, écran |
| 2 | D-273 | PROG-01 (0.24.0) : exercice assisté jamais plus lourd en décharge (constat 6 de Codex, PR #127 ). | A garder · B réviser ; effet : moteur |
| 2 | D-284 | FIX-0243 (0.25.0) : exercice assisté en décharge (complète D-273 ). | A garder · B réviser ; effet : moteur |
| 2 | D-285 | FIX-0243 (0.25.0) : séries de la séance proposée en décharge de cycle. | A garder · B réviser ; effet : moteur |
| 2 | D-298 | ERGO-03 (0.26.0) : Stratégie groupée, une ligne par réglage. | A garder · B réviser ; effet : chiffre |
| 2 | D-300 | MEDIA-02 (0.26.0) : wger examiné image par image, aucune image retenue. | A garder · B réviser ; effet : écran |
| 2 | D-356 | FIX-COQUILLE (0.28.0) : confirmation avant toute perte de saisie, focus après Entrée sur la série suivante (C-067, C-068, C-073, C-094 ). | A garder · B réviser ; effet : données |
| 2 | D-380 | SESS-01 (0.28.1) : fatigue déclarée au démarrage. | A garder · B réviser ; effet : moteur |
| 2 | D-383 | MOTEUR-0281a (0.28.1) : poids du corps, répétitions puis lest (§ 11.3). | A garder · B réviser ; effet : moteur |
| 2 | D-385 | MOTEUR-0281a (0.28.1) : exercices sans charge en deload, pause ou récupération basse. | A garder · B réviser ; effet : moteur |
| 2 | D-387 | MOTEUR-0281c (0.28.1) : filtres de la bibliothèque par muscle et par pattern (§ 14.2). | A garder · B réviser ; effet : moteur |
| 2 | D-388 | MOTEUR-0281 (0.28.1) : ENGINE_VERSION 3 → 4. | A garder · B réviser ; effet : moteur |
| 2 | D-398 | COQUILLE-PC-a (0.28.1) : menu contextuel PC et double-clic (§ 18.1, C-192). | A garder · B réviser ; effet : données |
| 2 | D-403 | BLESSURES-a (0.28.1) : évitement des patterns et muscles déclarés douloureux (§ 10.1 étape 6, § 10.2). | A garder · B réviser ; effet : moteur |
| 2 | D-416 | BILAN-029 (0.29.0) : bilan hebdomadaire par règles, sept thèmes (§ 17.3, D-410). | A garder · B réviser ; effet : moteur |
| 2 | D-422 | IMPORT-029a (0.29.0) : création seulement après confirmation, sans charge. | A garder · B réviser ; effet : moteur |
| 2 | D-456 | PROGRES-0291 (BL-115) : règles de l'adhérence aux prescriptions. | A garder · B réviser ; effet : moteur |
| 2 | D-470 | SEANCE-0291 (BL-092) : résumé de fin, séances passées datées par leur fin et décharges retenues. | A garder · B réviser ; effet : moteur |
| 2 | D-509 | SEANCE-0292 (C-029). | A garder · B réviser ; effet : moteur |
| 2 | D-511 | SEANCE-0292 (C-004). | A garder · B réviser ; effet : moteur |
| 2 | D-517 | SEANCE-0292 (C-081). | A garder · B réviser ; effet : données |
| 2 | D-520 | SEANCE-0292 (C-072). | A garder · B réviser ; effet : moteur |
| 2 | D-537 | SEANCE-0292b (BL-111). | A garder · B réviser ; effet : moteur |
| 2 | D-541 | SEANCE-0292b (§ 13.3 b, non fait). | A garder · B réviser ; effet : écran |
| 2 | D-546 | NUTRI-0292. | A garder · B réviser ; effet : moteur |
| 2 | D-548 | NUTRI-0292. | A garder · B réviser ; effet : données |
| 2 | D-568 | DATA-0293 (BL-135, D-481). | A garder · B réviser ; effet : moteur |
| 2 | D-569 | DATA-0293 (§ 11, D-510). | A garder · B réviser ; effet : moteur |
| 2 | D-570 | DATA-0293 (BL-112, amende D-539). | A garder · B réviser ; effet : moteur |
| 2 | D-582 | DATA-0293. | A garder · B réviser ; effet : moteur |
| 2 | D-588 | CONTENT-0293 (BL-113). | A garder · B réviser ; effet : moteur |
| 2 | D-620 | SHELL-0294f (BL-150) : durée du mésocycle mise en cohérence. | A garder · B réviser ; effet : moteur |
| 1 | D-271 | PROG-01 (0.24.0) : cible des jours de repos. | A garder · B réviser ; effet : chiffre |
| 1 | D-351 | FIX-PROGRAMME (0.28.0) : « Revoir mes réglages » part de la durée réelle du cycle et ne l'écrase plus (C-117, C-064; complète D-315 ). | A garder · B réviser ; effet : écran |
| 1 | D-455 | PROGRES-0291 (BL-114) : plage de séries jugée sur la dernière semaine complète. | A garder · B réviser ; effet : écran |
| 1 | D-516 | SEANCE-0292 (C-066). | A garder · B réviser ; effet : chiffre |
| 1 | D-557 | NUTRI-0292. | A garder · B réviser ; effet : chiffre |
| 1 | D-576 | DATA-0293 (BL-040). | A garder · B réviser ; effet : chiffre |
| 1 | D-602 | SHELL-0294b (C-157). | A garder · B réviser ; effet : écran |

Gardées sans question (à confirmer seulement) :

| Poids | D- | Résumé | Ce qu'Ali tranche |
|---|---|---|---|
| 9 | D-316 | PROG-04 (0.27.0) : séance du jour selon le jour de la semaine (constat d'Ali du 19/11, AUDIT-USAGE U-5 et U-9; complète D-243, D-270). | à confirmer seulement : citée par D-318 d'Ali (déjà validée ?) |
| 6 | D-315 | PROG-05 (0.27.0) : durée du cycle (constats d'Ali du 19/11, AUDIT-USAGE U-6 et U-7; complète D-267, amende ERGO-02b critère 9). | à confirmer seulement : citée par D-318 d'Ali (déjà validée ?) |
| 4 | D-151 | I6-03b : règle du déroulé série par série (src/domain/training/replay.ts). | à confirmer seulement : citée par D-150 d'Ali (déjà validée ?) |
| 4 | D-310 | STR-01 (0.26.0) : normes du Strength Score, source FitnessVolt Strength Standards. | à confirmer seulement : citée par D-503 d'Ali (déjà validée ?) |
| 3 | D-152 | I6-03b : groupes de circuit dans les routines. | à confirmer seulement : citée par D-150 d'Ali (déjà validée ?) |
| 3 | D-270 | PROG-01 (0.24.0) : type de jour pour la cible calorique. | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-350 | FIX-PROGRAMME (0.28.0) : « Mettre à jour la routine » apparie les séries aux lignes par ordre, sans migration (C-003 ). | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-352 | FIX-PROGRAMME (0.28.0) : unicité du jour de la semaine contrôlée sur le brouillon, jours libérés puis écrits dans la même transaction (C-065; … | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-379 | SESS-01 (0.28.1) : la série « Échec » est une série de travail à RIR 0, sans nouveau type. | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-521 | SEANCE-0292 (C-078). | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-536 | SEANCE-0292b (BL-106, D-496). | à confirmer seulement : citée par D-663 d'Ali (déjà validée ?) |
| 0 | D-232 | I6-07 : budgets de taille des médias, révisables par Ali. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-288 | ERGO-02b (0.25.0) : jours d'entraînement par défaut repris de la routine active. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-339 | FIX-PLANCHER (0.28.0) : confirmation reprise à l'ajout ou au retrait de la cible de repos (C-087 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-349 | FIX-PROGRAMME (0.28.0) : séance du jour faite comptée à la date locale de son début (C-063; complète D-316 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-378 | SESS-01 (0.28.1) : « Sauter » renvoie l'exercice en fin de séance. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-381 | SESS-01 (0.28.1) : image partageable du résumé faite sur l'appareil, sans donnée corporelle. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-389 | PROGRES-a (0.28.1) : volume par muscle et par semaine (§ 17.1). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-391 | PROGRES-b (0.28.1) : série en semaines et calendrier du mois (§ 17.1, § 18.2). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-420 | IMPORT-029a (0.29.0) : règles des lignes libres. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-438 | MEDIA-03 (0.29.0) : une photo sous licence reste prioritaire. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-445 | TECH-01 DEP-01 (0.29.0) : minimatch, eslint et typescript-eslint reportés. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-506 | SEANCE-0292 (C-012, Q-9 option B). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-507 | SEANCE-0292 (C-025). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-512 | SEANCE-0292 (C-030). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-513 | SEANCE-0292 (C-010). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-522 | SEANCE-0292 (C-078). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-525 | SEANCE-0292 (BL-121). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-526 | SEANCE-0292 (§ 10.3). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-527 | SEANCE-0292 (BL-160). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-529 | SEANCE-0292 (§ 14.3 b). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-538 | SEANCE-0292b (BL-111, § 14.2 b). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-553 | NUTRI-0292. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-558 | NUTRI-0292. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-573 | DATA-0293 (BL-095, BL-093). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-577 | DATA-0293 (C-142). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-587 | CONTENT-0293 (BL-127). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-590 | CONTENT-0293 (C-180). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-594 | SHELL-0294a (BL-118). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-621 | SHELL-0294f (BL-150) : § 19.2 sans platform.kind. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-633 | DATA-0295 (C-155) : fsync du dossier contrôlé; download sur la file série gardé. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-638 | SHELL-0295 (C-085) : catalogue hérité fr.routines hors du départ, paramètres typés pour les catalogues à part. | à confirmer seulement (aucun effet visible repéré) |

### nutrition (24 : 14 à trancher, 10 à confirmer seulement)

| Poids | D- | Résumé | Ce qu'Ali tranche |
|---|---|---|---|
| 14 | D-76 | Écrans de Nutrition sans IA ni réseau (I4-03, mission de nuit du 2026-11-08). | A garder · B réviser ; effet : moteur, synchro, schéma, données, chiffre, écran |
| 8 | D-78 | I4-05 : Open Food Facts et scan, choix prudents de l'agent (mission de nuit du 2026-11-09), révisables par Ali. | A garder · B réviser ; effet : schéma, chiffre, écran |
| 8 | D-80 | I4-07 recettes : deux tables publiées, aucun changement de meal_entry ni de food (mission de nuit du 2026-11-09). | A garder · B réviser ; effet : synchro, schéma, chiffre |
| 7 | D-124 | FIX-0171 (constat 6) : onboarding, brouillon inachevé et assistant terminé séparés. | A garder · B réviser ; effet : schéma, données |
| 4 | D-114 | I6-04 : règle nutrition « les deux selon les jours », détails prudents révisables par Ali. | A garder · B réviser ; effet : données |
| 4 | D-212 | I6-05 : rappels de compléments, révisable par Ali. | A garder · B réviser ; effet : synchro, écran |
| 3 | D-214 | I6-05 : entrées, révisable par Ali. | A garder · B réviser ; effet : données, écran |
| 2 | D-426 | REPAS-029b (0.29.0) : dépense du jour ajustée aux pas, affichage seul (§ 15.2). | A garder · B réviser ; effet : chiffre, écran |
| 1 | D-272 | PROG-01 (0.24.0) : check-in avec deux cibles. | A garder · B réviser ; effet : chiffre |
| 1 | D-337 | FIX-PLANCHER (0.28.0) : plancher de 1 200 kcal contrôlé sur la plus basse des deux cibles, par une seule fonction de domaine (C-031, C-086 ). | A garder · B réviser ; effet : chiffre |
| 1 | D-342 | FIX-SAISIE-NUTRI (0.28.0) : Open Food Facts, kcal contredit par le kJ remplacé et signalé (C-033 ). | A garder · B réviser ; effet : chiffre |
| 1 | D-343 | FIX-SAISIE-NUTRI (0.28.0) : Quick Add borné sur les macros et cohérent avec l'énergie (C-034 ). | A garder · B réviser ; effet : chiffre |
| 1 | D-550 | NUTRI-0292. | A garder · B réviser ; effet : chiffre |
| 1 | D-563 | NUTRI-0292. | A garder · B réviser ; effet : chiffre |

Gardées sans question (à confirmer seulement) :

| Poids | D- | Résumé | Ce qu'Ali tranche |
|---|---|---|---|
| 3 | D-425 | REPAS-029a (0.29.0) : repas favoris enregistrés comme recettes d'une portion. | à confirmer seulement (aucun effet visible repéré) |
| 1 | D-140 | FIX-0173 (constat 9 de la relecture Codex du 12/11) : les fibres Renpho vivent avec l'entrée « Renpho — total du jour ». | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-396 | NUTRI-c (0.28.1) : « assiette » = composition de plusieurs aliments (§ 15.3, C-194). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-424 | REPAS-029a (0.29.0) : un « repas » est un jour et un moment. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-547 | NUTRI-0292. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-555 | NUTRI-0292. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-556 | NUTRI-0292. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-560 | NUTRI-0292. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-580 | DATA-0293 (C-040, dépôt). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-585 | CONTENT-0293 (C-042). | à confirmer seulement (aucun effet visible repéré) |

### récupération (37 : 13 à trancher, 24 à confirmer seulement)

| Poids | D- | Résumé | Ce qu'Ali tranche |
|---|---|---|---|
| 7 | D-427 | SUIVIS-029a (0.29.0) : objectif de pas (PROG-02). | A garder · B réviser ; effet : moteur, synchro, données |
| 6 | D-345 | FIX-RECUP (0.28.0) : exclusion des valeurs aberrantes de la baseline contre la moyenne et le σ des autres nuits (C-049 ). | A garder · B réviser (déjà marquée « à trancher ») ; effet : chiffre |
| 4 | D-96 | I6-01 (0.12.0) : journal de facteurs (§ 16.7). | A garder · B réviser ; effet : données, chiffre |
| 3 | D-94 | I5-05 (0.11.3) : lecture du dossier sante et journal unique, décisions de l'agent. | A garder · B réviser ; effet : chiffre |
| 2 | D-393 | PROGRES-c (0.28.1) : tendances de récupération sur 30 jours et zone cible affichée (§ 17.1, § 16.3). | A garder · B réviser ; effet : chiffre, écran |
| 1 | D-132 | FIX-0172 : stades de sommeil de l'Apple Watch. | A garder · B réviser ; effet : écran |
| 1 | D-213 | I6-05 : pas d'action « Pris » dans la notification, révisable par Ali. | A garder · B réviser ; effet : écran |
| 1 | D-283 | FIX-0241 (0.25.0) : « 4 sem. : — » pour les lecteurs d'écran. | A garder · B réviser ; effet : écran |
| 1 | D-364 | TESTS-FIGES (0.28.0) : cardio importé sans test ni fixture de récupération par muscle tant qu'Ali n'a pas tranché (C-169, D-88 ). | A garder · B réviser ; effet : chiffre |
| 1 | D-428 | SUIVIS-029b (0.29.0) : minutes en zone 2 (PROG-02). | A garder · B réviser ; effet : chiffre |
| 1 | D-551 | NUTRI-0292. | A garder · B réviser ; effet : chiffre |
| 1 | D-552 | NUTRI-0292. | A garder · B réviser ; effet : écran |
| 1 | D-603 | SHELL-0294b (BL-162, BL-163). | A garder · B réviser ; effet : écran |

Gardées sans question (à confirmer seulement) :

| Poids | D- | Résumé | Ce qu'Ali tranche |
|---|---|---|---|
| 9 | D-93 | I5-02 (0.11.0) : défauts de la récupération en séance et des notifications, décisions de l'agent révisables par Ali. | à confirmer seulement : citée par D-318 d'Ali (déjà validée ?) |
| 3 | D-95 | I6-01 (0.12.0) : valeurs inhabituelles (§ 16.7). | à confirmer seulement : citée par D-134 d'Ali (déjà validée ?) |
| 3 | D-357 | FIX-SAISIE-NUTRI (0.28.0) : dépense mesurée lissée sur 7 jours comme le dit § 15.1, recalculée à la lecture (C-036 ). | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-575 | DATA-0293 (BL-099). | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-616 | SHELL-0294e (C-163). | à confirmer seulement (aucun effet visible repéré) |
| 1 | D-88 | I5-01 : Exertion de récupération = musculation seule, cardio compté à zéro, dit dans l'explication (clé exertion_cardio_not_counted). | à confirmer seulement : citée par D-238, D-505 d'Ali (déjà validée ?) |
| 1 | D-131 | FIX-0172 : épisodes de sommeil définis par les segments endormis (constat 7 de la relecture Codex du 12 nov.). | à confirmer seulement (aucun effet visible repéré) |
| 1 | D-133 | FIX-0172 : recalcul unique d'une nouvelle règle du sommeil (constat 2 de la relecture Codex). | à confirmer seulement : citée par D-134 d'Ali (déjà validée ?) |
| 1 | D-220 | I6-06 (0.21.0) : l'Exertion compte le cardio saisi, règle « minutes × ressenti »; met à jour D-88 (ligne non réécrite). | à confirmer seulement : citée par D-238, D-505 d'Ali (déjà validée ?) |
| 1 | D-348 | FIX-RECUP (0.28.0) : fichiers Raccourcis lus par leurs 10 000 dernières lignes, jour le plus ancien des pas jamais réécrit (C-052 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-224 | I6-06 : saisie d'une séance cardio. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-277 | FIX-0242 (0.25.0) : libellé de la qualité des données de récupération. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-332 | FIX-CONFID-IOS (0.28.0) : journal Rust borné (C-140 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-346 | FIX-RECUP (0.28.0) : minimum de 7 nuits compté sur les nuits valides, avant exclusion (C-049 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-347 | FIX-RECUP (0.28.0) : dette de la proposition de coucher sur les seules nuits valides (C-050 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-397 | NUTRI-a (0.28.1) : lissage EMA de 7 jours (§ 15.1, C-036) déjà fait (D-357). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-429 | SUIVIS-029c (0.29.0) : notes du matin sur 10 sans effet sur la récupération. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-433 | IOS-029a (0.29.0) : aucun verrou sur le PC. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-514 | SEANCE-0292 (C-008). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-562 | NUTRI-0292. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-565 | DATA-0293 (C-058, D-478). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-581 | DATA-0293. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-586 | CONTENT-0293 (BL-128). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-680 | DEC-0299 (D-664, C-056) : le saut de ligne final est exigé des fichiers du raccourci « Spartiate — récupération ». | à confirmer seulement (aucun effet visible repéré) |

### synchro et données (87 : 51 à trancher, 36 à confirmer seulement)

| Poids | D- | Résumé | Ce qu'Ali tranche |
|---|---|---|---|
| 12 | D-110 | I3-07 (0.15.0) : onboarding en 8 écrans, périmètre, déclenchement et stockage SANS migration (la numérotation saute D-105 à D-109 : D-102 à D-104 … | A garder · B réviser ; effet : synchro, schéma, données, chiffre |
| 12 | D-113 | I6-04 (0.16.0) : import Renpho / Santé par Raccourcis, SANS MIGRATION (schéma 13 inchangé). | A garder · B réviser ; effet : synchro, schéma, données, chiffre |
| 12 | D-402 | BLESSURES (0.28.1) : gênes en stockage local (§ 10.2). | A garder · B réviser (déjà marquée « à trancher ») ; effet : synchro, schéma, données |
| 10 | D-79 | I4-06 favoris : stockage local, non synchronisé, ne passent pas d'un appareil à l'autre (mission de nuit du 2026-11-09). | A garder · B réviser ; effet : synchro, schéma, données, écran |
| 10 | D-116 | CLEAN-01 (0.17.0) : le banc legacy et ce que les gardes citent sont CONSERVÉS. | A garder · B réviser ; effet : moteur, synchro, schéma, écran |
| 10 | D-172 | FIX-0181 : migration 0015 (schéma 15). | A garder · B réviser ; effet : synchro, schéma, données, écran |
| 10 | D-644 | CLEAN-0296 (C-085) : traducteurs à part typés comme catalogText, garde à liste figée. | A garder · B réviser ; effet : synchro, schéma, chiffre, écran |
| 9 | D-81 | I4-07 « journée complète » : table day_completeness publiée (mission de nuit du 2026-11-09; tranche D-74 point 2 et D-76 point 2). | A garder · B réviser ; effet : synchro, schéma, données |
| 9 | D-120 | FIX-0171 (0.17.1) : colonne absente d'une archive ancienne ≠ valeur nulle explicite (relecture Codex du 12/11, constat 1). | A garder · B réviser ; effet : synchro, schéma, données |
| 9 | D-221 | I6-06 : modèle des séances cardio (migration 0018, schéma 18, après la 0017 des compléments, I6-05). | A garder · B réviser ; effet : synchro, schéma, données |
| 8 | D-103 | I6-03 (0.14.0) : migration 0013 (schéma 13), colonnes publiées sans déclencheur. | A garder · B réviser ; effet : synchro, schéma, écran |
| 8 | D-123 | FIX-0171 (constat 3) : photo, fiche et capture de synchro dans une seule transaction, choix de mise en œuvre révisable par Ali. | A garder · B réviser ; effet : synchro, schéma, données |
| 8 | D-210 | I6-05 (0.20.0) : modèle des compléments. | A garder · B réviser ; effet : synchro, schéma, écran |
| 8 | D-430 | SUIVIS-029d (0.29.0) : bilans VISBODY en genres nouveaux de measurement, sans migration. | A garder · B réviser ; effet : synchro, schéma, chiffre, écran |
| 8 | D-561 | NUTRI-0292. | A garder · B réviser ; effet : moteur, synchro, schéma |
| 8 | D-630 | DATA-0295 (BL-003) : réparations de l'ancien schéma sorties de SyncRepository. | A garder · B réviser ; effet : moteur, synchro, schéma |
| 7 | D-75 | Catalogue alimentaire et journal persistant (I4-02, mission de nuit du 2026-11-08). | A garder · B réviser ; effet : synchro, schéma |
| 7 | D-100 | I6-02 (0.13.0) : mensurations et migration 0012 (schéma 12). | A garder · B réviser ; effet : schéma, données, écran |
| 7 | D-275 | PROG-01 (0.24.0) : limite connue de la synchro entre schémas, consignée (relecture sync-icloud du 14/11 ). | A garder · B réviser ; effet : synchro, schéma |
| 7 | D-613 | SHELL-0294d (Quitter, effacement, réglages). | A garder · B réviser ; effet : synchro, données, écran |
| 6 | D-187 | RESET-01 : règle de ligne et export. | A garder · B réviser ; effet : schéma, données |
| 6 | D-442 | TECH-01 CLEAN-03 (0.29.0) : migration des tests de synchro hérités par lots, schéma choisi fichier par fichier. | A garder · B réviser ; effet : synchro, schéma |
| 6 | D-462 | TECH-0291 (BL-133) : 29 fichiers de tests de synchro de plus sur le schéma Spartiate (lots D à G), le reste inventorié. | A garder · B réviser ; effet : synchro, schéma |
| 6 | D-464 | SYNC-0291 | A garder · B réviser ; effet : synchro, données, écran |
| 6 | D-468 | SYNC-0291 | A garder · B réviser ; effet : synchro, données |
| 6 | D-532 | DATA-0292 (BL-138). | A garder · B réviser ; effet : synchro, schéma |
| 6 | D-566 | DATA-0293 (migration 0023). | A garder · B réviser ; effet : synchro, schéma |
| 6 | D-574 | DATA-0293 (BL-098). | A garder · B réviser ; effet : synchro, schéma |
| 5 | D-82 | I4-08 (0.9.1, sans migration) : dépense mesurée et cible en vigueur. | A garder · B réviser ; effet : schéma, écran |
| 5 | D-328 | FIX-A009b (0.28.0) : réintégration d'un champ gardé contre l'horloge de ce champ (perte du jour de la semaine trouvée en relecture de FIX-A009; suite … | A garder · B réviser ; effet : synchro, données |
| 4 | D-143 | FIX-0173 (constat 10) : la base vide se juge sur toutes les données de l'utilisateur. | A garder · B réviser ; effet : moteur, données |
| 4 | D-276 | FIX-0242 (0.25.0) : revue de l'onboarding face à une synchro reçue pendant la revue. | A garder · B réviser ; effet : synchro |
| 4 | D-326 | FIX-A008 (0.28.0) : pilote SQLite en échec fermé quand l'annulation d'une transaction ne peut pas être établie (audit Codex 0.26.0, A-008, bloquant; … | A garder · B réviser ; effet : schéma |
| 4 | D-327 | FIX-A009 (0.28.0) : colonnes inconnues d'une table connue gardées à la réception d'un instantané (audit Codex 0.26.0, A-009, bloquant; avenant 38 de … | A garder · B réviser ; effet : schéma |
| 4 | D-583 | DATA-0293. | A garder · B réviser ; effet : synchro, écran |
| 4 | D-627 | SHELL-0294f (BL-166) : intention d'ajout d'une époque passée jamais publiée comme tête. | A garder · B réviser ; effet : synchro |
| 3 | D-469 | SYNC-0291 | A garder · B réviser ; effet : données |
| 2 | D-141 | FIX-0173 (constat 4) : unité de measurement.value dans l'export complet selon le genre. | A garder · B réviser ; effet : chiffre |
| 2 | D-334 | FIX-EXPORT (0.28.0) : horizon de remise à zéro dans le manifeste d'export, refus d'une archive qui ramènerait des données effacées (C-109; complète … | A garder · B réviser ; effet : données |
| 2 | D-406 | SYNC-0281a (0.28.1) : ADR 0018 M3, limite acceptée (reprise depuis l'instantané gaspillée). | A garder · B réviser ; effet : données |
| 2 | D-407 | SYNC-0281a (0.28.1) : ADR 0018 M4, limite acceptée (parties gardées par la 0.24.0). | A garder · B réviser ; effet : données |
| 2 | D-408 | SYNC-0281b (0.28.1) : e2e § 9.2 « séance iPhone → PC → édition PC → iPhone » en Vitest node. | A garder · B réviser ; effet : moteur |
| 2 | D-423 | IMPORT-029b (0.29.0) : lecture d'une photo par la façade OCR existante. | A garder · B réviser ; effet : moteur |
| 2 | D-431 | SUIVIS-029 (0.29.0) : export d'une 0.28.1 qui a reçu ces genres. | A garder · B réviser ; effet : données |
| 2 | D-466 | SYNC-0291 | A garder · B réviser ; effet : données |
| 2 | D-467 | SYNC-0291 | A garder · B réviser ; effet : données |
| 2 | D-609 | SHELL-0294c (C-127). | A garder · B réviser ; effet : données |
| 2 | D-632 | DATA-0295 (C-154) : aucune écriture à côté d'un fichier évincé. | A garder · B réviser ; effet : données |
| 1 | D-281 | FIX-0241 (0.25.0) : plafond de 560 px des notices levé sur PC dans Corps. | A garder · B réviser ; effet : chiffre |
| 1 | D-335 | FIX-EXPORT (0.28.0) : plafond d'import des archives aligné sur 24 Mio, export refusé au-delà (C-136 ). | A garder · B réviser ; effet : chiffre |
| 1 | D-421 | IMPORT-029a (0.29.0) : rapprochement des noms avec la bibliothèque. | A garder · B réviser ; effet : chiffre |

Gardées sans question (à confirmer seulement) :

| Poids | D- | Résumé | Ce qu'Ali tranche |
|---|---|---|---|
| 12 | D-99 | I6-02 (0.13.0) : photos de progression. | à confirmer seulement : citée par D-130 d'Ali (déjà validée ?) |
| 11 | D-314 | FIX-0271 (0.27.0) : prise d'effet d'une cible nutritionnelle; une cible prévue n'est jamais battue par une décision prise avant sa date (constat … | à confirmer seulement : citée par D-318 d'Ali (déjà validée ?) |
| 9 | D-104 | I6-03 (0.14.0) : rejeu de séance et export complet. | à confirmer seulement : citée par D-150 d'Ali (déjà validée ?) |
| 8 | D-153 | I6-03b : migration 0014 (schéma 14). | à confirmer seulement : citée par D-150 d'Ali (déjà validée ?) |
| 7 | D-317 | PROG-04 (0.27.0) : rattachement automatique par le nom du jour. | à confirmer seulement : citée par D-318 d'Ali (déjà validée ?) |
| 7 | D-567 | DATA-0293 (C-072, Q-13 option B appliquée, recommandation sans risque : colonne additive, publiée, sans effet sur les lectures d'avant). | à confirmer seulement : citée par D-659 d'Ali (déjà validée ?) |
| 3 | D-215 | I6-05 : sauvegardes de l'ancien projet au schéma 17, révisable par Ali. | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-226 | I6-06 : sauvegardes de l'ancien projet sans déclencheur, au schéma 18 (complète D-215 d'I6-05, ligne non réécrite), révisable par Ali. | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-353 | FIX-COQUILLE (0.28.0) : dernière frontière d'erreur de la coquille, sans relance pendant une migration ni sur pilote empoisonné (C-114, C-115; D-326 … | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-354 | FIX-COQUILLE (0.28.0) : délai de 120 s pour les étapes de base au démarrage, sans « Réessayer » ni rechargement pendant ces étapes (C-115 ). | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-366 | SAUV-RUST (0.28.0) : la sauvegarde créée par une rotation ou une récupération n'est jamais purgée (C-137 ). | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-377 | SESS-01 (0.28.1) : « Retirer, ne plus proposer » propre à chaque appareil. | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-405 | SYNC-0281a (0.28.1) : ADR 0018 M2 corrigé, écrivain d'une ligne gardée noté à la lecture. | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-463 | SYNC-0291 | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-465 | SYNC-0291 | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-519 | SEANCE-0292 (C-072, § 13.4). | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-571 | DATA-0293 (§ 21.2 a). | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-584 | DATA-0293. | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-619 | SHELL-0294f (BL-150) : D-16 et § 21.2 mis en cohérence. | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-631 | DATA-0295 (C-153) : un seul accès de sécurité ouvert pour la racine de synchro. | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-637 | DATA-0295 (réserves de la relecture sync-icloud de la PR #223) : C-154 et C-153 resserrés. | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-642 | REL-0.29.5 (H-43, C-155) : un dossier sans synchro de dossier ne bloque pas la publication. | à confirmer seulement (aucun effet visible repéré) |
| 1 | D-135 | FIX-0172 : relecture de sante après l'ouverture (automatisation « Lorsque Spartiate est ouverte »). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-280 | FIX-0241 (0.25.0) : colonnes de Progrès › Corps selon la largeur. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-329 | FIX-CONFID-IOS (0.28.0) : base, sauvegardes locales et journal exclus de la sauvegarde iCloud de l'iPhone (audit Claude C-152, C-147; applique D-99 … | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-336 | FIX-EXPORT (0.28.0) : textes de l'export, de l'import et de « Repartir de zéro » vrais et testés contre le code (C-107, C-108 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-355 | FIX-COQUILLE (0.28.0) : échec de chargement du bloc de signature seulement journalisé (C-116 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-367 | SAUV-RUST (0.28.0) : exclusion mutuelle des sauvegardes, restaurations, récupérations et mise de côté, refus « busy » sans attente (C-138, A-008, … | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-368 | SAUV-RUST (0.28.0) : l'échange et le retour arrière ne remplacent jamais une base présente (lien dur, repli sur renommage contrôlé) (C-138 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-369 | SAUV-RUST (0.28.0) : verrou par chemin de base et texte « busy » commun (C-138 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-394 | PROGRES (0.28.1) : graphiques en SVG accessibles, Recharts non importé. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-417 | BILAN-029 (0.29.0) : bilans archivés par recalcul, sans table. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-418 | BILAN-029 (0.29.0) : export Markdown du bilan. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-419 | IMPORT-029a (0.29.0) : format du bloc collé (§ 17.4). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-554 | NUTRI-0292. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-572 | DATA-0293 (BL-094, BL-031, BL-030). | à confirmer seulement (aucun effet visible repéré) |

### écrans (49 : 23 à trancher, 26 à confirmer seulement)

| Poids | D- | Résumé | Ce qu'Ali tranche |
|---|---|---|---|
| 11 | D-645 | CLEAN-0297 (C-085) : 22 traducteurs de plus typés comme catalogText, par leur corps d'origine. | A garder · B réviser ; effet : moteur, synchro, données, chiffre, écran |
| 6 | D-223 | I6-06 : écrans du cardio (sans maquette : motifs de Progrès › Corps, AGENTS.md). | A garder · B réviser ; effet : schéma, données |
| 5 | D-144 | FIX-0173 : petites suites. | A garder · B réviser ; effet : synchro, écran |
| 5 | D-390 | PROGRES-a (0.28.1) : volume affiché sans plage cible (§ 17.1 « vs plage »). | A garder · B réviser (déjà marquée « à trancher ») ; effet : écran |
| 4 | D-101 | I6-02 (0.13.0) : écran Corps et sélecteur d'image. | A garder · B réviser ; effet : synchro |
| 4 | D-279 | FIX-0242 (0.25.0) : échec de l'action « Pris » durable et visible. | A garder · B réviser ; effet : données, écran |
| 3 | D-341 | FIX-SAISIE-NUTRI (0.28.0) : correction des grammes d'une entrée sans perte de précision (C-032 ). | A garder · B réviser ; effet : données, écran |
| 3 | D-508 | SEANCE-0292 (C-007). | A garder · B réviser ; effet : moteur, chiffre |
| 3 | D-612 | SHELL-0294d (journal, diagnostic, marqueur). | A garder · B réviser ; effet : moteur |
| 2 | D-395 | NUTRI-b (0.28.1) : imputation affichée avec son incertitude (§ 15.1, C-194). | A garder · B réviser ; effet : chiffre, écran |
| 2 | D-404 | BLESSURES-b (0.28.1) : check-in tous les 14 jours (§ 10.2). | A garder · B réviser ; effet : chiffre, écran |
| 2 | D-593 | SHELL-0294a (C-135, § 18.5 b, D-480, BL-161). | A garder · B réviser ; effet : chiffre, écran |
| 2 | D-601 | SHELL-0294b (C-156, C-146). | A garder · B réviser ; effet : écran |
| 2 | D-608 | SHELL-0294c (C-126, § 18.3 a). | A garder · B réviser ; effet : écran |
| 2 | D-639 | SHELL-0295 (C-076) : unités, locale et séparateurs par src/i18n/units.ts. | A garder · B réviser ; effet : écran |
| 1 | D-340 | FIX-PLANCHER (0.28.0) : cible du jour (dayTargetFor, D-270) au tableau de bord et au graphique (C-088 ). | A garder · B réviser ; effet : écran |
| 1 | D-399 | COQUILLE-PC-b (0.28.1) : barre latérale PC rétractable, repli non persisté (§ 18.1). | A garder · B réviser ; effet : écran |
| 1 | D-459 | COQUILLE-0291 (BL-119) : disposition PC décidée par le système, fenêtre minimale 800 × 360. | A garder · B réviser ; effet : chiffre |
| 1 | D-515 | SEANCE-0292 (C-022). | A garder · B réviser ; effet : chiffre |
| 1 | D-523 | SEANCE-0292 (C-082). | A garder · B réviser ; effet : écran |
| 1 | D-533 | DATA-0292 (BL-138). | A garder · B réviser ; effet : écran |
| 1 | D-559 | NUTRI-0292. | A garder · B réviser ; effet : écran |
| 1 | D-606 | SHELL-0294c (C-120, C-121, C-122). | A garder · B réviser ; effet : écran |

Gardées sans question (à confirmer seulement) :

| Poids | D- | Résumé | Ce qu'Ali tranche |
|---|---|---|---|
| 13 | D-296 | ERGO-03 (0.26.0) : « Fixer ma cible » replié, vide, et confirmation devant une cible future. | à confirmer seulement : citée par D-502 d'Ali (déjà validée ?) |
| 3 | D-595 | SHELL-0294a (BL-136). | à confirmer seulement (aucun effet visible repéré) |
| 2 | D-331 | FIX-CONFID-IOS (0.28.0) : masquage des valeurs corporelles dans le journal technique, TS et Rust (C-151, C-140; § 22 ). | à confirmer seulement (aucun effet visible repéré) |
| 1 | D-295 | ERGO-03 (0.26.0) : cible à venir dans Stratégie. | à confirmer seulement : citée par D-501 d'Ali (déjà validée ?) |
| 1 | D-592 | SHELL-0294a (C-135, § 18.1 b, D-480). | à confirmer seulement (aucun effet visible repéré) |
| 1 | D-596 | SHELL-0294a (bundle de départ, règle « le départ ne grossit jamais »). | à confirmer seulement (aucun effet visible repéré) |
| 1 | D-605 | SHELL-0294c (C-119, § 18.2 c, C-131 en partie). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-330 | FIX-CONFID-IOS (0.28.0) : suppression sûre des photos et texte exact (C-089 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-344 | FIX-SAISIE-NUTRI (0.28.0) : saisie des nombres en français, jour courant relu, formulaire protégé (C-095 à C-098 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-371 | A11Y (0.28.0) : bordure des contrôles contrastée; interrupteur éteint clair porté à 3:1 (C-112; consigne d'Ali du 21/11). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-432 | IOS-029a (0.29.0) : verrou Face ID / code activable sur l'iPhone (§ 10.2, § 22, H-17; lève l'activation différée de D-37 pour l'iPhone, lot 0.29.0 … | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-434 | IOS-029a (0.29.0) : texte d'usage Face ID réécrit. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-435 | IOS-029b (0.29.0) : essai Apple Intelligence par un plugin séparé apple-intelligence (spike sans engagement). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-439 | MEDIA-03 (0.29.0) : mention « pictogramme » et texte alternatif. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-440 | MEDIA-03 (0.29.0) : pictogrammes validés par liste blanche (revue à froid). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-443 | TECH-01 CLEAN-03 (0.29.0) : scénarios à texte long sur workout.notes. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-524 | SEANCE-0292 (C-080). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-528 | SEANCE-0292 (C-083). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-534 | DATA-0292 (BL-138). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-545 | NUTRI-0292. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-549 | NUTRI-0292. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-578 | DATA-0293 (C-118). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-600 | SHELL-0294b (C-159, H-32). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-607 | SHELL-0294c (C-074, C-075, C-124). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-614 | SHELL-0294e (BL-116). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-626 | SHELL-0294f (§ 18.4 b, C-194) : icônes de l'app générées par script depuis content/brand/spartiate.svg. | à confirmer seulement (aucun effet visible repéré) |

### CI et outillage (65 : 30 à trancher, 35 à confirmer seulement)

| Poids | D- | Résumé | Ce qu'Ali tranche |
|---|---|---|---|
| 11 | D-618 | SHELL-0294f (BL-149, D-490) : revue par thème des choix prudents, produite par script. | A garder · B réviser ; effet : moteur, synchro, schéma, données |
| 9 | D-635 | DATA-0295 (§ 23.1 c, H-18) : tests de parité Wasm / plugin natif. | A garder · B réviser ; effet : moteur, synchro, schéma |
| 6 | D-222 | I6-06 : GPS sur l'iPhone par le plugin OFFICIEL Tauri geolocation, au premier plan seulement (passe architect, décision de l'agent révisable par Ali). | A garder · B réviser ; effet : synchro, écran |
| 6 | D-598 | SHELL-0294b (C-158, BL-129, § 19.3 a, § 19.4 a). | A garder · B réviser ; effet : synchro, données |
| 5 | D-77 | Client Open Food Facts en Rust (I4-05, mission de nuit du 2026-11-08). | A garder · B réviser ; effet : synchro |
| 5 | D-274 | PROG-01 (0.24.0) : exception chiffrée au bundle de départ (choix prudent, révisable par Ali; D-264 (3), D-265). | A garder · B réviser ; effet : schéma, chiffre |
| 5 | D-615 | SHELL-0294e (BL-137, BL-167). | A garder · B réviser ; effet : moteur, schéma |
| 5 | D-624 | SHELL-0294f (BL-148) : matrice et ADR 0014 mises à jour par des constats déjà consignés, jamais par une lecture de code (D-36). | A garder · B réviser ; effet : synchro, écran |
| 5 | D-628 | SHELL-0294f (BL-030) : réintégration en échec au démarrage, vérifiée par test. | A garder · B réviser ; effet : synchro, données |
| 4 | D-122 | FIX-0171 : mise en œuvre de D-121. | A garder · B réviser ; effet : données, écran |
| 4 | D-287 | ERGO-02b (0.25.0) : préchargement sans polyfill et sans blocs du départ entre eux (passe architect). | A garder · B réviser ; effet : moteur, chiffre |
| 4 | D-321 | DOC-PRIV (0.28.0) : retrait des données réelles d'Ali des fichiers suivis (C-165; applique D-318 (5)). | A garder · B réviser ; effet : données, écran |
| 4 | D-591 | CONTENT-0293 (BL-126). | A garder · B réviser (déjà marquée « à trancher ») ; effet : durée, texte long |
| 4 | D-617 | SHELL-0294e (C-084, BL-145, BL-100, BL-105, BL-042, C-167). | A garder · B réviser ; effet : synchro |
| 4 | D-640 | SHELL-0295 (A-004) : tests sans référence partagée nulle, captures sans pause fixe. | A garder · B réviser ; effet : moteur, chiffre |
| 3 | D-282 | FIX-0241 (0.25.0) : pluriels français des compteurs. | A garder · B réviser ; effet : chiffre, écran |
| 3 | D-611 | SHELL-0294d (BL-002, BL-144, CSP). | A garder · B réviser ; effet : moteur |
| 2 | D-400 | COQUILLE-PC-c (0.28.1) : Dynamic Type iOS par font: -apple-system-body (§ 18.6, C-113, D-372). | A garder · B réviser ; effet : chiffre, écran |
| 2 | D-401 | COQUILLE-PC (0.28.1) : zoom PC 150 % (§ 18.6) non testé, à examiner par Ali. | A garder · B réviser ; effet : chiffre, écran |
| 2 | D-610 | SHELL-0294c (BL-143, BL-164, BL-033 et bundle de départ). | A garder · B réviser ; effet : chiffre |
| 2 | D-634 | DATA-0295 (BL-005) : cause de la copie de conflit state 2.spx écrite comme hypothèse H-42. | A garder · B réviser ; effet : données |
| 2 | D-636 | DATA-0295 (BL-166) : trois tests de non-régression de resolveInflight, verts d'emblée. | A garder · B réviser ; effet : moteur |
| 2 | D-643 | CLEAN-0296 (§ 18.4 b) : le --check des icônes est lancé par la CI. | A garder · B réviser ; effet : chiffre |
| 1 | D-105 | CI : projet dom à 2 workers (12/11/2026). | A garder · B réviser ; effet : écran |
| 1 | D-363 | TESTS-FIGES (0.28.0) : seuil de couverture de src/domain/training à 90 % (C-170, § 11.6 ). | A garder · B réviser ; effet : chiffre |
| 1 | D-372 | A11Y (0.28.0) : Dynamic Type iOS reporté en 0.28.1, avec capture CI et constat d'Ali (C-113, H-19a ). | A garder · B réviser ; effet : écran |
| 1 | D-437 | MEDIA-03 (0.29.0) : gabarit unique des pictogrammes (D-413). | A garder · B réviser ; effet : chiffre |
| 1 | D-483 | CI-0292 (BL-104) : erreur de codesign -d affichée; signature de l'installeur PC toujours dans le job de build. | A garder · B réviser ; effet : écran |
| 1 | D-488 | CI-0292 (C-193) : scénarios e2e et scènes visuelles écrits sans exécution locale. | A garder · B réviser ; effet : chiffre |
| 1 | D-641 | SHELL-0295 (BL-044) : relevé des marqueurs de tests et couverture par module, par script. | A garder · B réviser ; effet : chiffre |

Gardées sans question (à confirmer seulement) :

| Poids | D- | Résumé | Ce qu'Ali tranche |
|---|---|---|---|
| 3 | D-484 | CI-0292 (C-161) : le script de préparation A9 (prepare-a9.mjs) retiré. | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-531 | DATA-0292 (BL-138, D-489). | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-535 | DATA-0292 (BL-138, compensation du bundle de départ). | à confirmer seulement (aucun effet visible repéré) |
| 3 | D-564 | REL-0.29.2 (complément d'audit, D-489). | à confirmer seulement (aucun effet visible repéré) |
| 1 | D-604 | SHELL-0294b (bundle de départ, règle « le départ ne grossit jamais »). | à confirmer seulement (aucun effet visible repéré) |
| 1 | D-646 | CLEAN-0297 (C-085) : la garde des traducteurs voit un alias de type local. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-302 | MEDIA-02 : réduction des images web par un script Node sans dépendance (révisable par Ali). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-358 | CI-PUB (0.28.0) : actions des workflows de publication figées par SHA, identiques à tests.yml, test statique (C-166 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-359 | CI-PUB (0.28.0) : job « garde » : aucun build ni signature sur tag sans « suite verte » verte sur le SHA (C-172 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-360 | CI-PUB (0.28.0) : signature de l'installeur dans un job distinct reportée en 0.28.1, trace SHA-256 avant --clobber (C-172 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-361 | CI-PUB (0.28.0) : cargo-audit en version fixée, npm audit du graphe livré, cache iOS en lecture seule sur tag (C-175, C-174 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-362 | TESTS-FIGES (0.28.0) : un test qui fige un défaut non corrigé reste tel quel, listé, et est réécrit par le ticket de correction (C-168 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-370 | A11Y (0.28.0) : anneau de focus unique et contrasté dans les deux thèmes (C-111 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-373 | A11Y (0.28.0) : captures visuelles produites en CI par paires, sans image de référence à régénérer. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-375 | NETTOYAGE (0.28.1) : une source d'image réduite est vérifiée en entier par validate-content (BL-011 ). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-436 | IOS-029b (0.29.0) : preuves à apporter par la CI iOS avant le constat d'Ali. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-441 | MEDIA-03 (0.29.0) : licence des pictogrammes. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-444 | TECH-01 DEP-01 (0.29.0) : mises à jour sûres du lockfile seulement. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-446 | TECH-01 DEP-01 (0.29.0) : cargo audit en CI. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-454 | Lot 0.29.1 : ordre de travail. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-458 | Lot 0.29.1 : statuts du registre remis à jour par un audit en lecture seule. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-460 | TECH-0291 (BL-130) : SDK iOS 26 prouvé en CI. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-461 | TECH-0291 (BL-134) : cargo audit bloquant seulement sur le graphe livré; D-446 corrigée. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-482 | CI-0292 (C-173) : documentation alignée sur le déclenchement réel de tests.yml. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-485 | CI-0292 (C-178) : fuseau des tests fixé à Europe/Paris. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-486 | CI-0292 (BL-043) : avis de licence tiers livrés. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-487 | CI-0292 (A-005) : résumé du job cargo audit à chaque run. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-579 | DATA-0293 (BL-041). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-589 | CONTENT-0293 (BL-010). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-597 | SHELL-0294a (écart de preuve rouge, relecture à froid). | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-622 | SHELL-0294f (BL-150) : versions du § 25.2 mises en cohérence avec D-58. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-623 | SHELL-0294f (BL-150) : renvois à docs/PRD.md mis en cohérence avec D-49. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-625 | SHELL-0294f (BL-165) : corps des six anciennes publications réécrits par le workflow. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-629 | DATA-0295 (BL-035) : cycle statique goalRules → week → todayList rompu. | à confirmer seulement (aucun effet visible repéré) |
| 0 | D-679 | DEC-0299 (D-675, relecture à froid) : le contrôle « git grep -i fitnessvolt vide » porte sur le code, le contenu, les tests et docs/licences.md. | à confirmer seulement (aucun effet visible repéré) |

<!-- revue-choix-prudents:fin -->
