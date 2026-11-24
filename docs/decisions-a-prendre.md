# Décisions à prendre par Ali

Questions fermées ouvertes pendant les lots 0.29.2 et suivants (prompt du 24/11, docs/LOT-0.29.2.md) et lignes « à trancher par Ali »
du registre (docs/backlog.md) restées sans réponse au 24/11. Chaque question : 2 à 4 options, une recommandation, les conséquences.
Le lot continue sans la réponse : le comportement actuel reste en place tant qu'une option n'est pas choisie. Réponse attendue sous la
forme « Q-n : option ». Une question tranchée devient une D- dans docs/decisions.md et sort de ce fichier.

## Q-1 — Charge d'historique hors du matériel de la salle (BL-106, § 12.4, D-365, D-471)

Après un changement de salle, la dernière charge n'existe pas dans le matériel du nouveau profil (ou dépasse son maximum).
- A. Garder la charge et la signaler (comportement actuel, D-471).
- B. Arrondir vers le bas à la grille du profil et plafonner au maximum du matériel, avec la note.
- C. Arrondir au plus proche de la grille, avec la note.

Recommandation : B (jamais plus lourd que ce qui existe, l'échelle de répétitions reprend). Conséquence : une séance d'autre salle
propose une charge plus légère ; aucune donnée modifiée.

## Q-2 — Modes Variable, Fixe et Statique (§ 12.3, D-73 (1))

Ces trois choix existent sans effet tant qu'ils ne sont pas définis.
- A. Les retirer de l'écran (écart décidé au PRD).
- B. Les définir : Variable = plages du § 12.1.4, Fixe = répétitions figées de la routine, Statique = charge figée.
- C. Les laisser sans effet (comportement actuel).

Recommandation : A (un choix sans effet trompe). Conséquence : § 12.3 amendé par une D-.

## Q-3 — Cardio importé dans la récupération par muscle (§ 16.3 d, C-062, D-364, D-88)

- A. Le cardio importé de Santé ne charge aucun muscle (comportement actuel, écart décidé).
- B. Il charge les jambes selon minutes × ressenti, comme le cardio saisi.

Recommandation : A tant que HealthKit direct est bloqué (pas de ressenti fiable à l'import). Conséquence : § 16.3 amendé.

## Q-4 — Déclenchement de la CI (§ 23.2 a, C-173)

- A. Sur PR et sur main seulement (comportement actuel ; documentation alignée en CI-0292).
- B. À chaque push de toute branche, en plus des PR (runs doublés).

Recommandation : A. Conséquence : le PRD § 23.2 dit « à chaque push de branche » ; une D- l'amende.

## Q-5 — Nutrition dans le guide Santé par Raccourcis (D-293)

- A. Facultative (comportement actuel). - B. Retirée du guide. - C. Obligatoire.

Recommandation : A.

## Q-6 — Cible à venir montrée dans Stratégie (D-295)

- A. Montrée avec sa date de début (comportement actuel). - B. Cachée jusqu'à son début.

Recommandation : A.

## Q-7 — « Fixer ma cible » (D-296 (1) et (3))

(1) section repliée et vide à l'ouverture ; (3) confirmation demandée devant une cible future.
- A. Garder (1) et (3) (comportement actuel). - B. Section dépliée et pré-remplie, sans confirmation.

Recommandation : A.

## Q-8 — Normes du Strength Score (D-310, H-37)

- A. FitnessVolt (comportement actuel, H-37 UNVERIFIED). - B. Strength Level. - C. Aucun centile, score relatif à son propre historique.

Recommandation : A, H-37 gardée ouverte.

## Q-9 — Durée estimée d'une séance (D-73 (4), C-012)

- A. 45 s par série plus le repos (actuel). - B. Durée réelle de la série pour les exercices chronométrés, 45 s pour les autres.
- C. Moyenne de ses séances passées.

Recommandation : B (traité avec C-012 si choisi). Conséquence : budget de séance plus juste pour le gainage et le cardio.

## Q-10 — Exertion du cardio (D-88, D-220)

- A. Minutes × ressenti (actuel, faute de zones FC). - B. Zones FC quand une FC est importée, sinon A.

Recommandation : A tant que HealthKit direct est bloqué (H-3a).
