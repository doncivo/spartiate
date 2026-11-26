# STR-0300 — Seuils du Strength Score maison : proposition soumise à Ali (Q-42, D-678)

**Statut : proposition non validée.** Rien n'est publié avec ce tableau (aucune version, aucun tag) avant la décision d'Ali, consignée
par une D- (D-678). Le tableau est dans `src/domain/training/config.ts` (`STRENGTH_LIFT_THRESHOLDS`, marqué « proposition non validée
(Q-42) »), et un test vérifie qu'il est la copie exacte de la méthode ci-dessous (`deriveStrengthThresholds`). Aucune donnée d'Ali,
aucune norme tierce recopiée : chaque nombre sort des cinq paramètres de la méthode.

## Unité

Force relative en kg : e1RM (Epley, moteur de prescription) × (80 / poids de corps)^(2/3), donc **un e1RM ramené à 80 kg de poids de
corps**. Pour un pratiquant de 80 kg, la force relative est son e1RM. Tractions et dips : e1RM de la **charge totale** (poids de corps +
lest). Le score vaut 20, 40, 60, 80 et 100 aux seuils Débutant, Novice, Intermédiaire, Avancé et Élite, interpolé entre deux (D-741).

## Méthode (à partir de nos formules)

1. **Ancre** : pour chaque mouvement, un multiple « Intermédiaire » du poids de corps normalisé (80 kg), chez l'homme, choisi en nombres
   ronds pour un pratiquant régulier de 1 à 3 ans : développé couché 1,00 ; incliné 0,85 ; rowing 0,90 ; développé militaire 0,65 ;
   squat 1,35 ; squat avant 1,10 ; soulevé de terre et sumo 1,65 ; charge totale : traction pronation 1,35 ; supination 1,40 ; dips 1,50.
   Les mouvements secondaires sont fixés par rapport au mouvement de référence de leur groupe (incliné = 85 % du couché, squat avant environ
   80 % du squat, etc.).
2. **Échelle des niveaux** (× l'ancre) :
   - mouvements à la barre : Débutant 0,50 · Novice 0,75 · Intermédiaire 1 · Avancé 1,30 · Élite 1,65 ;
   - charge totale (tractions, dips) : 0,80 · 0,90 · 1 · 1,20 · 1,40, plus resserrée car le poids de corps fait déjà le plancher (un
     Débutant à 0,80 × 1,35 = 1,08 fois son poids fait environ 2 tractions ; un Intermédiaire environ 10).
3. **Coefficient femme** (× l'ancre de l'homme) : haut du corps à la barre 0,60 ; bas du corps 0,75 ; charge totale 0,82.
4. **Arrondi** : au 0,5 kg.

Seuil = 80 kg × ancre × coefficient du sexe × échelle, arrondi au 0,5 kg.

## Tableau proposé : mouvement de référence de chaque groupe (kg de force relative, ramenée à 80 kg)

| Groupe | Mouvement de référence | Sexe | Débutant | Novice | Intermédiaire | Avancé | Élite |
|---|---|---|---:|---:|---:|---:|---:|
| Pectoraux | Développé couché à la barre | homme | 40 | 60 | 80 | 104 | 132 |
| Pectoraux | Développé couché à la barre | femme | 24 | 36 | 48 | 62,5 | 79 |
| Dos | Traction pronation (charge totale) | homme | 86,5 | 97 | 108 | 129,5 | 151 |
| Dos | Traction pronation (charge totale) | femme | 71 | 79,5 | 88,5 | 106,5 | 124 |
| Épaules | Développé militaire à la barre | homme | 26 | 39 | 52 | 67,5 | 86 |
| Épaules | Développé militaire à la barre | femme | 15,5 | 23,5 | 31 | 40,5 | 51,5 |
| Biceps | Traction supination (charge totale) | homme | 89,5 | 101 | 112 | 134,5 | 157 |
| Biceps | Traction supination (charge totale) | femme | 73,5 | 82,5 | 92 | 110 | 128,5 |
| Triceps | Dips aux barres parallèles (charge totale) | homme | 96 | 108 | 120 | 144 | 168 |
| Triceps | Dips aux barres parallèles (charge totale) | femme | 78,5 | 88,5 | 98,5 | 118 | 138 |
| Quadriceps | Squat à la barre | homme | 54 | 81 | 108 | 140,5 | 178 |
| Quadriceps | Squat à la barre | femme | 40,5 | 61 | 81 | 105,5 | 133,5 |
| Ischios | Soulevé de terre à la barre | homme | 66 | 99 | 132 | 171,5 | 218 |
| Ischios | Soulevé de terre à la barre | femme | 49,5 | 74,5 | 99 | 128,5 | 163,5 |
| Fessiers | Soulevé de terre sumo | homme | 66 | 99 | 132 | 171,5 | 218 |
| Fessiers | Soulevé de terre sumo | femme | 49,5 | 74,5 | 99 | 128,5 | 163,5 |

## Mouvements secondaires (même méthode)

| Mouvement | Groupes | Sexe | Débutant | Novice | Intermédiaire | Avancé | Élite |
|---|---|---|---:|---:|---:|---:|---:|
| Développé incliné à la barre | Pectoraux | homme | 34 | 51 | 68 | 88,5 | 112 |
| Développé incliné à la barre | Pectoraux | femme | 20,5 | 30,5 | 41 | 53 | 67,5 |
| Rowing à la barre | Dos | homme | 36 | 54 | 72 | 93,5 | 119 |
| Rowing à la barre | Dos | femme | 21,5 | 32,5 | 43 | 56 | 71,5 |
| Squat avant à la barre | Quadriceps | homme | 44 | 66 | 88 | 114,5 | 145 |
| Squat avant à la barre | Quadriceps | femme | 33 | 49,5 | 66 | 86 | 109 |
| Traction supination | Dos (et Biceps, ci-dessus) | — | voir Biceps | | | | |
| Soulevé de terre à la barre | Fessiers (et Ischios) | — | voir Ischios | | | | |

Un groupe prend le meilleur score de ses mouvements chiffrés.

## Exemple (valeurs inventées)

Homme de 80 kg, développé couché 75 kg × 6 : e1RM = 75 × (1 + 6/30) = 90 kg, force relative 90 kg ; entre Intermédiaire (80) et Avancé
(104) : 60 + 20 × 10 / 24 = 68,3 → **68, Intermédiaire**. Le même e1RM à 64 kg de poids de corps : 90 × (80/64)^(2/3) = 104,4 kg → 80,
Avancé.

## Limites

- Les ancres et les coefficients sont des choix ronds, non mesurés sur une population : le score situe une progression personnelle, il
  ne classe pas parmi d'autres pratiquants (pas de centile).
- L'exposant 2/3 (loi d'échelle des surfaces musculaires) avantage un peu les poids légers face aux formules de compétition ; sur la
  charge totale des tractions et dips, il porte aussi sur le poids de corps.
- Fessiers et Ischios partagent les mêmes seuils (soulevé de terre et sumo à la même ancre) : un seul mouvement les distingue peu.
- Aucun mouvement aux haltères ni aux machines n'est pris en référence (charges peu comparables d'une salle à l'autre).
- L'âge n'entre pas dans les seuils.
- Option B de Q-42 : un coefficient global (par exemple 0,9 ou 1,1) multiplierait tous les seuils ; il se règle en un seul paramètre
  de la méthode et relève `STRENGTH_SCORE_VERSION`.
