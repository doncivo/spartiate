# Préparation I2 — formules et vecteurs de progression

Document de préparation P-10 pour le moteur I2. Les formules ci-dessous
reprennent les spécifications normatives des [§ 11.1–11.6](./prd/11-moteur-de-progression-src-domain-training.md)
et isolent les règles du [§ 12](./prd/12-generation-de-seance-et-mesocycle-src-domain-training-i3.md)
qui ne relèvent pas d’I2. Les vecteurs sont calculés à partir des entrées
explicitement données ; ils ne lèvent pas les ambiguïtés de produit listées à
la fin.

## Ordre normatif d’une prescription

L’entrée `prescribe` reçoit exercice, historique, dernière décision, profil,
matériel, mésocycle, récupération, position, cible, configuration et instant
`now`, puis retourne prescriptions de séries, confiance, raisons, version du
moteur et configuration active.

1. Exclure des statistiques les séries inachevées, échauffements, deloads et
   séries aberrantes non confirmées (> 150 % du 1RM courant) ; préserver
   l’historique brut.
2. Prendre la plage de répétitions, le RIR et le matériel actifs.
3. Utiliser la dernière prescription effective (y compris les modifications
   manuelles) avec l’historique ; sans historique, proposer un départ
   conservateur, confiance faible et explication provisoire.
4. Appliquer la double progression : toutes les séries au haut de plage avec
   difficulté compatible donnent un cran ; sinon ajouter une répétition à une
   seule série selon l’échelle de progression. Une baisse répétée donne une
   stabilité ou une réduction proposée.
5. Appliquer la confirmation de difficulté : Dur ou RIR ≤ 1 bloque la hausse ;
   Juste la confirme ; Facile ou RIR ≥ 4 confirme le cran. Exception : si la
   confiance est < 60 %, Facile peut recalibrer le 1RM de +5 %, une fois par
   exercice et par mois, sans cumul avec un cran.
6. Appliquer les contraintes de fatigue, inactivité, deload et récupération :
   elles maintiennent ou réduisent, jamais de bonus.
7. Snapper au matériel après les calculs, en respectant incréments, minimum,
   maximum, barre et stack ; au-delà du garde-fou, choisir la charge inférieure.
8. Expliquer les règles déclenchées dans l’ordre, la confiance, la version et la
   source des données.
9. Présenter sans imposer ; toute modification manuelle devient la référence
   et est tracée.

Invariant : aucune prescription n’excède `maxGainPerSession` (+10 % de 1RM par
séance) ; une hausse de répétitions n’est pas transformée en hausse de charge
dans la même prescription.

## Formules normatives et vecteurs chiffrés

### Estimation de 1RM (Epley) et pondération

Pour une série éligible de charge `w` et `r` répétitions :

`e1RM = w × (1 + r / 30)`

Une série dépassant 15 répétitions ou représentant moins de 60 % du 1RM courant
reçoit un poids `0,25`. Le 1RM courant est la moyenne pondérée des valeurs des
trois dernières séances, avec poids de récence `1`, `0,6`, `0,3` (une série
ayant en plus la pondération `0,25` conserve son poids réduit).

| Vecteur | Calcul | Résultat |
|---|---|---:|
| 60 kg × 10 reps | `60 × (1 + 10/30)` | 80 kg |
| 100 kg × 5 reps | `100 × (1 + 5/30)` | 116,666… kg |
| Trois séances dont e1RM 100, 110, 120 kg, du plus récent au plus ancien | `(100×1 + 110×0,6 + 120×0,3) / (1 + 0,6 + 0,3)` | 105,263… kg |
| Série de 80 kg × 16 reps lorsque le 1RM courant vaut 150 kg | e1RM `122,666…` kg ; poids effectif `0,25` | contribue au poids `0,25`, ne change pas la règle Epley |
| Série de 80 kg lorsque le 1RM courant vaut 150 kg | `80 / 150 = 53,333… %` | pondération `0,25` car sous 60 % |
| Série de 90 kg lorsque le 1RM courant vaut 150 kg | `90 / 150 = 60 %` | pas de réduction pour le seuil « < 60 % » |

Le calcul consolidé d’un 1RM par séance à partir de plusieurs séries
intra-séance n’est pas détaillé par le PRD : **à décider par Ali**.

### Confiance

`confiance = 0,4 × min(séries_valides / 6, 1) + 0,3 × (1 − dispersion_relative) + 0,3 × récence`

Le facteur de récence vaut 1 si la dernière donnée a moins de 14 jours, 0 si
elle a plus de 60 jours. La dispersion relative est nommée mais sa définition
mathématique n’est pas donnée : les vecteurs ci-dessous fixent explicitement
`dispersion_relative = 0` uniquement pour illustrer les autres facteurs ; il
ne s’agit pas d’une définition proposée.

| Vecteur illustratif | Calcul | Résultat |
|---|---|---:|
| 6 séries valides, dispersion explicitement posée à 0 pour ce calcul, donnée à 7 jours | `0,4×1 + 0,3×1 + 0,3×1` | 1,00 |
| 3 séries valides, dispersion explicitement posée à 0, donnée à 30 jours | `0,4×(3/6) + 0,3×1 + 0,3×(1−(30−14)/(60−14))` | 0,69565… **si** une interpolation linéaire est choisie ; interpolation à décider par Ali |

Le deuxième résultat dépend d’une interpolation linéaire entre 14 et 60 jours,
que le PRD ne formule pas. Il illustre uniquement le calcul conditionnel et
n’est pas un vecteur normatif final.

Seuils donnés : confiance `< 0,4` = provisoire et hausse limitée à un cran ;
confiance `< 0,6` active l’exception de recalibrage facile. À exactement 0,4
ou 0,6, ces conditions strictes ne s’appliquent pas.

### Charge de départ

`charge_de_départ = niveau × standard(sexe, poids) × 0,9`

Le standard numérique n’étant pas fourni par le § 11, aucun poids absolu
arbitraire n’est utilisé. Vecteur de contrat : avec niveau `1,2` et standard
du profil `100 kg`, charge non snappée `1,2 × 100 × 0,9 = 108 kg`. Le niveau
et la table des standards restent à définir/relire par Ali avant un test qui
présenterait une valeur utilisateur réelle.

### Progression de répétitions et de charge

Exemple normatif du PRD, progression d’un cran à la fois sur les séries :

`8-7-6 → 8-8-6 → 8-8-7 → 8-8-8`

La progression de reps ne déclenche pas une hausse de charge dans cette même
prescription. Une fois toutes les séries au haut de la plage et la difficulté
compatible, le cran vaut un incrément du matériel. Exemples purement
arithmétiques : incrément 2 kg sur un haltère à 20 kg → prochain cran 22 kg ;
incrément de stack 5 kg → prochain cran +5 kg. Le matériel réel doit fournir
son pas et ses bornes.

### Position dans la séance

Multiplicateurs : position 1 = `1`, deuxième exercice du même muscle = `0,93`,
troisième = `0,88`.

| Vecteur | Calcul | Résultat avant snap |
|---|---|---:|
| Charge de référence 100 kg, premier exercice | `100 × 1` | 100 kg |
| Charge de référence 100 kg, deuxième exercice | `100 × 0,93` | 93 kg |
| Charge de référence 100 kg, troisième exercice | `100 × 0,88` | 88 kg |

Le classement des exercices « du même muscle » en présence de plusieurs
muscles principaux n’est pas spécifié : **à décider par Ali**.

### Snap matériel et tolérance

Le snap vise le cran disponible ; si l’écart relatif au cran excède 3 %, ajuster
la cible de ±1 répétition ; sinon choisir la charge inférieure. Le PRD ne
précise pas la définition du pourcentage ni la direction du snap dans le cas
supérieur à 3 % ; il indique seulement ±1 répétition.

| Matériel / charge théorique | Écart au cran examiné | Décision chiffrée établie |
|---|---:|---|
| Haltère, pas 2 kg ; valeur théorique 20,5 kg | 0,5 / 20 = 2,5 % | inférieur à 3 % : charge inférieure, 20 kg |
| Stack, pas 5 kg ; valeur théorique 51 kg | 1 / 50 = 2 % | inférieur à 3 % : charge inférieure, 50 kg |
| Haltère, pas 2 kg ; valeur théorique 21 kg | 1 / 20 = 5 % | supérieur à 3 % : variation ±1 rep ; choix de charge et signe à décider par Ali |

Le dénominateur, le traitement des égalités exactes, l’application de la
tolérance lorsque l’incrément est discontinu et le signe de ±1 rep restent
**à décider par Ali**. Le résultat ne peut dépasser le maximum du matériel ;
si un cran dépasse une borne, appliquer la charge inférieure.

### Fatigue et garde-fou de progression

À charge égale, une baisse de répétitions strictement supérieure à 20 % déclenche
une alerte avec proposition refusable `−5 %` ou `−2 reps`.

| Vecteur | Calcul | Résultat |
|---|---|---|
| Référence 10 reps, performance 8 reps à même charge | `(10−8)/10 = 20 %` | pas strictement supérieur à 20 %, seuil non déclenché |
| Référence 10 reps, performance 7 reps à même charge | `(10−7)/10 = 30 %` | alerte ; proposer −5 % ou −2 reps, refus possible |
| 1RM courant 100 kg, hausse maximale par séance 10 % | `100 × 1,10` | plafond 110 kg |
| 1RM courant 100 kg, hausse proposée 12 % | `100 × 1,12 = 112` | prescription plafonnée à une proposition ne dépassant pas 110 kg |

Le point de référence pour calculer la baisse de répétitions, la priorité entre
−5 % et −2 répétitions et la méthode de plafonnement quand le snap matériel
tombe au-dessus de 110 kg sont **à décider par Ali**.

### Stagnation, inactivité, deload et récupération

| Règle | Vecteur chiffré | Résultat |
|---|---|---|
| Stagnation | 3 séances consécutives sans progression | proposer variante, autre plage ou mini-deload à −10 % ; choix parmi ces propositions à décider par Ali |
| Inactivité | dernier travail du muscle à J0 ; prescription à J13 | pas encore de décote liée au seuil de 14 j |
| Inactivité | J14, valeur de référence 100 kg | débute −1 %/semaine ; première décote calculée `100 × 0,99 = 99 kg` après une semaine complète selon le décompte du PRD |
| Plancher d’inactivité | valeur de référence 100 kg ; décote cumulée | ne pas descendre sous `100 × 0,90 = 90 kg` |
| Deload | 5 séries, charge 100 kg | volume `5/2 = 2,5` séries : règle d’arrondi à décider par Ali ; charge `100 × 0,8 = 80 kg`, RIR ≥ 4 |
| Récupération basse | récupération 33, sommeil 6 h, FC repos +8 % | condition Recovery `≤33` active : charge × `0,95`; les deux autres frontières strictes ne sont pas franchies |
| Sommeil sous le seuil | Recovery 34, sommeil 5 h 59 min, FC repos +8 % | condition sommeil `<6 h` active : charge × `0,95` et −1 série sur secondaires |
| Retour après 3 semaines | 21 jours depuis activité du muscle | décote d’inactivité prévue ; résultat dépend de la convention de semaines et du plancher — aucune extrapolation sans choix d’Ali |

Pour `J14`, le PRD dit « −1 %/semaine à partir de 14 j » sans préciser si la
première décote est immédiate à J14 ou après sept jours supplémentaires. Le
tableau montre une application après une semaine complète ; le choix temporel
exact est **à décider par Ali**. Le même caractère strict/non strict des seuils
de sommeil et FC doit être confirmé si le texte « < 6 h » et « > +8 % » est
interprété littéralement.

## Périmètre I2 et règles § 12

I2 implémente le moteur § 11 (estimation, confiance, double progression, snap,
difficulté, explication, fatigue, stagnation, deload manuel). La génération
`generateSession`, modes, contraintes de budget temps, rotation et mésocycle
du § 12.1–12.4 sont I3, pas à anticiper dans I2.

Les éléments § 12 qui nomment I2 sont distincts :

- Calculateur d’échauffement § 13.8 : rampes `40 % × 8`, `60 % × 5`,
  `80 % × 2` de la charge de travail, snap matériel ; ses séries sont
  ignorables et de type Warm-up.
- Le PRD ne donne pas les arrondis des répétitions de rampes, la charge de
  référence si le matériel n’autorise pas le pourcentage exact, ni la gestion
  de plusieurs patterns composés : **à décider par Ali**.

Le tableau mésocycle du § 12.5 illustre cinq semaines (2 séries/RIR 3, 3/RIR 2,
3/RIR 1, 4/RIR 0–1, puis 2/RIR 5+ et charge ×0,8) pour les programmes I1 ; il
ne change pas le périmètre I2 et ses choix de série/RIR appartiennent au
programme initial à relire par Ali.

Vecteur direct du calculateur d’échauffement § 13.8 : pour une charge de travail
de `100 kg`, les cibles avant snap sont `40 kg × 8`, `60 kg × 5` et
`80 kg × 2`. Les trois séries sont de type Warm-up et ignorables. Les charges
effectives après snap dépendent du profil matériel ; elles ne sont pas
déductibles de ce seul vecteur.

Vecteurs de périodisation du programme cinq semaines décrit au § 12.5 (I1,
pas moteur additionnel I2) :

| Semaine | Séries | RIR cible | Charge |
|---|---:|---:|---|
| 1 | 2 | 3 | prescription § 11 |
| 2 | 3 | 2 | prescription § 11 |
| 3 | 3 | 1 | prescription § 11 |
| 4 | 4 | 0–1 | prescription § 11 ; hausse plafonnée à 10 % |
| 5 | 2 | 5+ | charge de la prescription × `0,8` ; 1RM et Strength Score gelés |

La valeur absolue de la charge des semaines 1–4 dépend du moteur § 11 et du
matériel ; aucune valeur n’est inventée ici.

## Questions à Ali — choix fonctionnels non tranchés

1. Quelle formule de dispersion relative et quelle normalisation des valeurs
   du 1RM doivent alimenter la confiance ?
2. Quelle courbe de récence appliquer entre 14 et 60 jours, et quelle valeur
   exacte aux bornes ? Le PRD ne nomme que 1 sous 14 j et 0 au-delà de 60 j.
3. Comment agréger les séries d’une séance en une valeur 1RM de séance avant
   la moyenne pondérée ; comment tenir compte du poids 0,25 dans les poids de
   récence ?
4. Quelle table de standards `strengthStandardKey` et quels niveaux de départ
   utiliser par profil ; quelle provenance/licence et quelle validation d’Ali ?
   Quelle formule d’agrégation du Strength Score par muscle / exercice faut-il
   appliquer ? Le PRD le nomme au § 12.5 mais ne le définit pas.
5. Quel est le dénominateur de la tolérance de snap 3 %, et quel sens donner à
   ±1 répétition lorsque l’écart dépasse cette tolérance ?
6. Comment arrondir les fractions de séries (par exemple 5 ÷ 2 au deload) et
   les répétitions de rampes d’échauffement ?
7. À quel instant s’applique la première réduction d’inactivité après J14 ?
   Comment compter une semaine partielle et choisir la référence/plancher ?
8. Quelle séance/base de comparaison définit « baisse répétée », « stagnation »
   et la baisse de répétitions à charge égale pour l’alerte fatigue ?
9. Comment départager les réponses `Facile` et RIR contradictoires, et les
   conditions simultanées d’augmentation, fatigue, inactivité, deload ou
   récupération basse ? L’ordre général est normatif, mais ces conflits ne
   sont pas tous spécifiés.
10. Comment attribuer la position 2e/3e exercice quand un exercice a plusieurs
    muscles, et comment `maxGainPerSession` se combine avec le recalibrage +5 %,
    les machines propres au profil et le snap au matériel ?
11. Les modes de séance de § 12.3, styles de séries et durées de séance ne
    relèvent pas d’I2 ; confirmer qu’ils restent reportés à I3 sauf les séries
    d’échauffement explicitement prévues en I2.

Aucun de ces choix n’est présumé par ce document. Toute valeur de vecteur
explicitement conditionnelle reste illustrative jusqu’à validation d’Ali.
