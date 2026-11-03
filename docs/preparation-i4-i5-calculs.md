# Préparation P-10 — calculs nutrition I4 et récupération I5

Les vecteurs sont synthétiques et appliquent les constantes des
[§ 15.1–15.2](./prd/15-nutrition-adaptative-src-domain-nutrition-i4.md) et
[§ 16.1–16.6](./prd/16-recuperation-src-domain-recovery-plugin-healthkit-i5.md).
Les contrats HealthKit et les colonnes persistées sont référencés dans
[§ 19](./prd/19-plugins-swift-et-contrat-ios.md) et
[§ 20.2–20.4](./prd/20-modele-de-donnees-sqlite.md), avec D-55 pour la pesée
Health quotidienne.
Ils servent de contrats de tests, pas de preuves d’une capacité ni de règles
médicales. Aucun point non spécifié ci-dessous ne devient un choix produit
sans décision d’Ali.

## I4 — journée complète et dépense mesurée

### Complétude et total quotidien

Une journée est complète si l’utilisateur la déclare complète ou si elle
contient au moins 3 entrées couvrant au moins 8 heures ; sinon son état est
`partial` ou `unknown`. Le total loggé est la somme des entrées :

`kcal_jour = Σ kcal_i` ; de même, `protéines_jour = Σ protéines_i`,
`lipides_jour = Σ lipides_i` et `glucides_jour = Σ glucides_i`.

Un jour non loggé ne vaut jamais zéro. Il peut être représenté avec incertitude
dans l’interface, mais il est exclu du calcul TDEE si la couverture minimale
n’est pas satisfaite.

| Entrées synthétiques | Calcul | Résultat |
|---|---|---|
| 08:00 = 500 kcal, 12:00 = 700 kcal, 17:00 = 600 kcal | 3 entrées sur 9 h ; `500 + 700 + 600` | Jour complet inféré, 1 800 kcal |
| Aucune entrée le jour suivant | Aucun total observé | `unknown`, jamais 0 kcal |
| 3 entrées de 08:00 à 15:00 | 7 h de couverture | `partial`, car inférieur à 8 h |

La complétude déduite ne prouve pas que tous les aliments ont été saisis. Cette
limite doit rester visible dans la confiance affichée.

Le § 20.2 décrit `meal_entry(date, time, ...)` et `nutrition_target` hebdomadaire,
mais ne définit pas de colonne/table de persistance du statut de journée
complète, de son auteur (déclaré ou inféré) ni de sa synchronisation. Ne pas
ajouter un schéma avant décision ; l’état dérivé peut changer après correction
ou suppression d’une entrée.

### Tendance et TDEE

La tendance `T(t)` est une EMA des pesées, de demi-vie 14 jours. Pour un pas de
`Δj` jours, la demi-vie donne `α = 1 − 2^(−Δj/14)`. Une pesée située à plus de
2 % de `T` reçoit le poids 0,25 selon le PRD ; l’application exacte de ce poids
à la mise à jour EMA n’est pas davantage spécifiée ici.

Sur `N = 21` jours :

`ΔT_kg = T(fin) − T(début)`

`TDEE_brut = moyenne(kcal des jours complets) − (ΔT_kg / 21) × 7 700`

La série TDEE est lissée par une EMA de demi-vie 7 jours. Le calcul n’est
utilisable pour l’ajustement qu’avec au moins 4 jours complets par semaine et
2 pesées par semaine durant 2 semaines ; sinon aucun ajustement n’est proposé.

| Vecteur synthétique | Calcul | Résultat attendu |
|---|---|---|
| 12 jours complets sur 21, 4 par semaine, chacun à 2 400 kcal ; 2 pesées par semaine ; `T(début)=80,0 kg`, `T(fin)=79,4 kg` | `ΔT=-0,6 kg` ; `2 400 − (−0,6/21)×7 700` | TDEE brut = 2 620 kcal/j |
| TDEE lissé précédent = 2 500 ; brut = 2 620 ; pas de 7 jours | `α=1−2^(−7/7)=0,5` ; `2 500+0,5×(2 620−2 500)` | TDEE lissé = 2 560 kcal/j |
| `T=80,0 kg`, pesée reçue = 81,8 kg | Écart = `1,8/80 = 2,25 %` | Le poids 0,25 de la règle anti-outlier s’applique ; le détail de son application reste à décider |

L’initialisation est Mifflin–St Jeor × activité ; la pondération de la formule
vers la mesure se fait sur 28 jours. Le PRD ne donne ni la fonction de
transition ni les coefficients intermédiaires : ne pas inventer une moyenne
linéaire.

Les ajustements restent hebdomadaires et plafonnés à ±150 kcal, avec semaines
indépendantes. À 70 kg, les protéines cibles sont `70×1,6` à `70×2,2`, soit
112–154 g/j, et les lipides sont au moins `70×0,6 = 42 g/j` ; l’ajustement
porte sur les glucides. Le plancher est 1 200 kcal (800 seulement après
confirmation), la perte visée ne dépasse pas 1 %/semaine et un écart de plus
de ±25 % du TDEE déclenche une alerte et une révision manuelle.

## I5 — sommeil, Recovery et Exertion

### Baseline et Recovery

La baseline est la moyenne `μ` et l’écart-type `σ` glissants de HRV et FC au
repos sur 14 nuits valides (7 au minimum) ; les valeurs situées à plus de
2,5 `σ` sont exclues. `σ=0`, une mesure absente ou moins de 7 nuits entraînent
un résultat `null` avec raison, jamais un score nul présenté comme mesuré.

`z_hrv = (HRV − μ_HRV) / σ_HRV`

`z_fc = (μ_FC − FC) / σ_FC`

`raw = clamp(0,7×z_hrv + 0,3×z_fc, −2, 2)`

`Recovery_brut = 50 + 25×raw` ; `Recovery = Recovery_brut × facteur_sommeil`,
avec `facteur_sommeil ∈ [0,8 ; 1,0]`.

| Vecteur synthétique | Calcul | Résultat attendu |
|---|---|---|
| HRV 60 ms, `μ=50 ms`, `σ=10 ms` ; FC repos 50 bpm, `μ=60 bpm`, `σ=5 bpm` | `z_hrv=1`, `z_fc=2`, `raw=1,3`, `Recovery_brut=82,5` | Avec un facteur illustratif de 0,9 : 74,25 ; le calcul du facteur n’est pas spécifié par le PRD |
| 14 HRV : treize valeurs 50 et une valeur 100 | Moyenne initiale ≈53,57 ; `σ` population ≈12,88 ; écart de 100 ≈3,60 `σ` | La valeur 100 dépasse 2,5 `σ` et est exclue ; les 13 restantes ont moyenne 50 et `σ=0`, donc abstention pour Recovery |
| 6 nuits valides, HRV et FC présentes | `6 < minNights: 7` | Recovery `null` avec raison d’abstention |

### Exertion et besoin de sommeil

`cardio = Σ min_zone_i × w_i`, avec `w=[1,2,3,4,5]`.
`muscu = tonnage_kg / 1 000 × facteur`, facteur PRD `0,8`, `1` ou `1,2`.

`Exertion = 10 × (1 − e^(−(cardio + muscu)/300))`

Pour le vecteur d’exemple, `min_zone_2=10`, `min_zone_3=5` et
`tonnage=6 000 kg`, facteur musculaire `1` :
`cardio=10×2+5×3=35`, `muscu=6`, puis
`Exertion=10×(1−e^(−41/300)) ≈ 1,28/10`.
Les unités attendues par `min_zone_i` et l’origine exacte de ces valeurs
doivent être arrêtées avant l’implémentation.

`besoin_h = 7,5 + 0,2×max(0, Exertion_veille−5) + dette_7j_h`

La dette sur 7 jours est plafonnée à 3 h ; `score_sommeil = durée_h /
besoin_h`. Exemple de vecteur, `Exertion_veille=8`, dette fournie de 1,25 h et
durée de sommeil de 7 h : besoin `7,5+0,6+1,25=9,35 h`, score
`7/9,35 ≈ 0,749`. La manière de calculer la dette n’est pas définie par le PRD.

La zone cible dérivée de Recovery est 6–8 si Recovery ≥66, 4–6 entre 34 et 65,
0–3 si ≤33, et aucune si Recovery est `null`. Les seuils de la séance ne
remplacent ni un résultat absent ni un avis clinique.

## Frontière de nuit et fuseau

Le PRD fournit des segments de sommeil horodatés et un `recovery_day(date)`,
mais ne fixe ni l’ancrage d’une nuit à la date de réveil ou à minuit, ni le
fuseau de regroupement, ni la sémantique de durée lors d’un changement d’heure.
La pesée I0, elle, est explicitement datée selon le fuseau de l’appareil au
moment de la mesure (D-55).

| Vecteur synthétique | Résultat à préserver |
|---|---|
| Europe/Paris, 24 oct. 2026 23:30 CEST → 25 oct. 2026 07:00 CET | 8 h 30 écoulées en UTC, mais 7 h 30 par soustraction naïve des heures locales ; le test expose la règle à décider |
| Événement horodaté 23:55, puis déplacement de fuseau avant le réveil | L’instant reste identique ; l’affectation à `recovery_day.date` dépend de la règle locale à décider |
| Repas à 23:50 puis entrée à 00:15 en fuseau local | Les dates civiles diffèrent ; le PRD ne dit pas si une journée nutrition peut franchir minuit |

Ne pas coder une frontière ni convertir une date locale en UTC sans décision.
Conserver distincts les instants, dates locales et fuseaux attachés à leur
mesure.

## Déduplication des sources Santé

D-55 tranche le cas `body_weight` : identité naturelle
`(date locale, source)`, une seule pesée `health` retenue par jour, l’échantillon
le plus récent gagne et son `health_uuid` est conservé ; le fuseau de la mesure
est stocké. Le PRD § 20.2 prévoit aussi un `health_sample_cache` local à
l’iPhone avec `type`, `start`, `end`, `value`, `uuid`, tandis que § 16.2
retourne des échantillons horodatés et l’UUID des workouts.

| Vecteur synthétique | Traitement établi ou limite |
|---|---|
| La pesée `health` du jour a `u1` à 07:00, 79,8 kg, puis `u2` à 08:00, 79,6 kg | D-55 retient `u2`, 79,6 kg et le fuseau de cette mesure pour l’identité journalière |
| Une même mesure `uuid=u1` revient dans deux fenêtres de lecture qui se chevauchent | L’UUID fournit un candidat de clé idempotente ; la règle de déduplication du cache reste à décider |
| Deux échantillons ont type, heure et valeur identiques mais des UUID distincts | Le PRD ne dit pas s’il s’agit de doublons de sources ou de deux mesures réelles ; ne pas fusionner sur la seule égalité des valeurs |
| Deux sources ont des échantillons différents dans la même journée | Seule la règle spécifique à `body_weight` (dernier `measured_at`) est tranchée ; aucune priorité globale n’est définie pour HRV, FC, sommeil ou workouts |

## Questions à décider par Ali

- à décider par Ali : une déclaration « journée complète » prime-t-elle toujours sur l’inférence (ou son absence), et quelle date/fuseau délimite la journée nutrition après un voyage ou le changement d’heure ?
- à décider par Ali : où persister une complétude explicitement déclarée, faut-il synchroniser cette déclaration, et que signifie une déclaration complète sans entrée (zéro réellement consommé ou journal encore inconnu) ?
- à décider par Ali : quelle fonction pondère la pesée à 0,25 dans l’EMA 14 jours et quelle transition exacte combine Mifflin–St Jeor avec la mesure pendant les 28 jours ?
- à décider par Ali : quelle fonction transforme durée/besoin de sommeil en facteur Recovery `[0,8 ; 1,0]`, et comment calculer la dette de sommeil sur 7 jours ?
- à décider par Ali : quelle nuit alimente `recovery_day.date` (minuit local, date de réveil ou fenêtre fixe), quel fuseau utiliser lors d’un changement de fuseau, et faut-il mesurer le sommeil en durée écoulée ou selon une autre convention ?
- à décider par Ali : quelle définition de `min_zone_i` et quelles unités entrent dans le calcul cardio de l’Exertion ; quelle méthode de variance (`σ`) sert à la baseline et au filtrage des outliers ?
- à décider par Ali : pour le cache Santé hors pesée, l’UUID est-il la seule clé de déduplication ; quelle provenance/priorité appliquer aux UUID distincts ou absents, et quelles différences de source doivent rester visibles ?
- à décider par Ali : comment agréger les nuits partielles, périodes éveillées et échantillons HealthKit qui chevauchent la fenêtre, sans transformer une absence en zéro ?
