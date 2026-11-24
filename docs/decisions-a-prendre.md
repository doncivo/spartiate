# Décisions à prendre par Ali

Questions fermées ouvertes pendant les lots 0.29.2 et suivants (prompt du 24/11, docs/LOT-0.29.2.md) et lignes « à trancher par Ali »
du registre (docs/backlog.md) restées sans réponse au 24/11. Chaque question : 2 à 4 options, une recommandation, les conséquences.
Le lot continue sans la réponse : le comportement actuel reste en place tant qu'une option n'est pas choisie. Réponse attendue sous la
forme « Q-n : option ». Une question tranchée devient une D- dans docs/decisions.md et sort de ce fichier.


Q-1 à Q-10 tranchées par Ali le 24/11 : D-496 à D-505 (docs/decisions.md). La revue par thème des choix prudents (D-490, BL-149) sera
ajoutée ici en sections « séance et moteur », « nutrition », « récupération », « synchro et données », « écrans », « CI et outillage ».

## Q-11 — Décision d'Ali postérieure à la dernière séance et réductions (C-026, SEANCE-0292)

Une décision (modification ou retour en arrière depuis la fiche) datée après la dernière séance de l'exercice est reprise telle quelle,
même en semaine de décharge, après 3 semaines de pause ou un jour de journée rouge acceptée (règle I2-02 « l'entrée d'Ali l'emporte »).
- A. Garder la règle (décision jamais modulée).
- B. La décision devient la référence ; la décharge, la pause et la journée rouge la réduisent comme une référence d'historique.
- C. Seule la décharge (semaine programmée) la réduit.

Recommandation : B (une semaine de décharge à pleine charge contredit le § 12.2). Conséquences : deux tests existants qui figent A
changent d'attente ; correctif prêt hors git, à porter aussi sur les exercices au poids du corps.

## Q-12 — Pause de séance (BL-110, § 13.2 « Pause / abandonner », SEANCE-0292)

La durée publiée est `ended_at − started_at` : une pause qui n'en retire pas son temps n'a pas d'effet utile.
- A. Colonnes additives `workout.paused_at` et `workout.paused_ms` (publiées avec la séance close ; anciens exports et journaux : 0) ;
  chrono, résumé, énergie Apple Santé et replay hors pause ; repos annulé pendant la pause.
- B. Pause locale : chrono figé à l'écran, durée publiée inchangée.
- C. Pas de pause : « Abandonner » seulement (actuel).

Recommandation : A. Conséquences : migration additive et relecture sync-icloud (module données et synchro), puis écran de séance.

## Q-13 — Trace d'une correction de série (C-072, § 13.4, § 13.8, SEANCE-0292)

Seule la date de correction (`corrected_at`) est gardée, pas la valeur d'avant.
- A. Garder la date seule (actuel).
- B. Colonne additive `workout_set.corrected_from` (valeurs d'avant la dernière correction), publiée ; « corrigée : 80 → 82,5 kg ».
- C. Table publiée de l'historique complet des corrections.

Recommandation : B. Conséquences : migration additive, relecture sync-icloud, affichage au journal.

## Q-14 — « Fermer le résumé » de séance (BL-160, SEANCE-0292)

- A. Retour à l'accueil de l'Entraînement (choix prudent, fait en SEANCE-0292).
- B. Rester sur « Nouvelle séance » ; un nouvel appui sur l'onglet actif ramène à son accueil (règle commune à tous les onglets).

Recommandation : A (moins de gestes).

## Q-15 — Arrondi de la décote de position (H-1, écart G3) (SEANCE-0292b)

Constat : 2ᵉ exercice du muscle, 40 kg × 0,93 = 37,2 kg. Gravl publie 37,5 kg (arrondi au plus proche, répétitions compensées dans les deux
sens) ; Spartiate propose 35 kg et une répétition de plus (arrondi vers le bas, § 11.3 « +1 rep si l'écart dépasse 3 % »).
- A (recommandé) : garder l'arrondi vers le bas (jamais au-dessus de la cible, règle unique du moteur). Conséquence : séance un peu plus
  légère au 2ᵉ rang.
- B : arrondi au plus proche avec une répétition de moins si la charge monte. Conséquence : règle d'arrondi propre à la position, ENGINE_VERSION
  relevée.

## Q-16 — Échelle après un cran (H-1, écart G2b) (SEANCE-0292b)

Constat : après 8-8-8 et un cran, Gravl repart à 8-7-6 (série d'appui en tête), Spartiate au bas de la plage sur chaque série (6-6-6).
- A (recommandé) : garder (règle D-72, figée par TESTS-FIGES). B : repartir au profil de répétitions de la première séance de l'échelle.

