# Préparation P-10 — génération de séance, mésocycles et deload (I3)

Cette préparation reprend les règles et exemples chiffrés des
[§ 11.3](./prd/11-moteur-de-progression-src-domain-training.md) et
[§ 12.1–12.6](./prd/12-generation-de-seance-et-mesocycle-src-domain-training-i3.md).
Les valeurs numériques ci-dessous sont des vecteurs de contrat synthétiques,
pas de nouveaux choix produit. Les choix incomplets sont consignés dans
[questions-ali.md](questions-ali.md) et ne doivent pas être codés par
supposition.

## Génération — split, sélection et variété

Les limites de fréquence prévues au § 12.1 donnent les frontières suivantes :

| Split | Jours/semaine | Conséquence |
|---|---:|---|
| Full Body | 3 au plus | 3 jours respectent la borne ; 4 n’y sont pas admis |
| Upper / Lower | 4 | 4 jours correspondent au split prévu |
| Push / Pull / Legs | 5–6 | 5 ou 6 jours correspondent au split prévu |
| Custom | 1–7 | la distribution des muscles et patterns n’est pas spécifiée |

Ordre de sélection prévu : muscles du jour, exercices composés puis
isolations, filtre dur sur le matériel, un exercice par pattern et muscle
principal, priorités, exclusion des patterns douloureux et substitution si
disponible. Aucun exercice incompatible n’est réintroduit pour compléter un
budget. Les priorités ne peuvent pas écarter les filtres matériels ou douleur.

En mode Balanced, le PRD fixe 70 % d’exercices récurrents et une rotation sur
quatre semaines. Exemple arithmétique, si une séance possède 10 emplacements
d’exercice : `10 × 0,70 = 7` emplacements récurrents et 3 emplacements
disponibles pour la rotation. Le nombre 10 est un dénominateur synthétique,
pas une taille de séance normative. Le PRD ne fixe pas le dénominateur exact,
l’arrondi ni les règles de départ si l’historique est incomplet.

En mode Varied, la rotation s’effectue par mésocycle, pas par semaine ; en
mode Consistent, les exercices récurrents sont conservés. Le choix en cas de
conflit de pattern, de priorité ou de substitution indisponible est une
question produit, pas une permission de violer les filtres durs.

## Budget temporel — vecteur Haut A, semaine 2

Le § 12.5 donne Haut A avec 19 séries et repos de 60 à 150 secondes. Le modèle
du § 12.1 estime 45 secondes par série plus repos. En comptant les repos
uniquement entre séries d’un même exercice et sans transitions :

| Exercice | Séries | Repos | Travail `séries × 45 s` | Repos inter-séries `(séries−1) × repos` |
|---|---:|---:|---:|---:|
| Développé couché barre | 3 | 150 s | 135 s | 300 s |
| Rowing barre | 3 | 150 s | 135 s | 300 s |
| Développé incliné haltères | 3 | 120 s | 135 s | 240 s |
| Tirage vertical | 3 | 120 s | 135 s | 240 s |
| Élévations latérales | 3 | 60 s | 135 s | 120 s |
| Curl barre | 2 | 60 s | 90 s | 60 s |
| Extension triceps poulie | 2 | 60 s | 90 s | 60 s |
| **Total** | **19** | — | **855 s = 14 min 15 s** | **1 320 s = 22 min** |

Durée estimée selon cette convention : `855 + 1 320 = 2 175 s`, soit
**36 min 15 s**, hors transitions et échauffement. Si un repos est compté
après chaque série, le total devient `855 + 2 040 = 2 895 s`, soit
**48 min 15 s**. La source du programme du § 12.5 mentionne environ 1 h 05 ;
le modèle simplifié ne chiffre ni les transitions ni l’échauffement et ne
permet donc pas de déduire cette durée de référence. Ces deux résultats
exposent la frontière de calcul ; ils ne permettent pas d’affirmer que le PRD
compte le repos final.

Pour une demande de 35 minutes, la règle normative retire d’abord les
isolations. Dans cet exemple, cela enlève 7 séries (315 s de travail) et
4 minutes de repos inter-séries : la durée passe de 36 min 15 s à **27 min**
selon la convention inter-séries. Aucune réduction supplémentaire n’est
nécessaire pour ce vecteur ; les temps de transition restent hors du calcul.

Le budget est respecté si la durée estimée est dans la cible à ±10 % selon le
test § 12.4. Pour une cible de 45 minutes, cela donne
`45 × 0,90 = 40,5 min` à `45 × 1,10 = 49,5 min`. Le traitement d’une séance
qui ne rentre toujours pas après retrait des isolations est de réduire les
séries ; le calcul exact d’une série supprimée dépend du décompte des repos.

## Mésocycle — périodisation chiffrée

Le tableau du § 12.5 donne le vecteur de référence de cinq semaines :

| Semaine | Séries de travail par exercice | RIR cible | Charge | Lecture |
|---|---:|---:|---:|---|
| 1 | 2 | 3 | Prescription I2 | Introduction |
| 2 | 3 | 2 | Prescription I2 | +1 série par rapport à la semaine 1 |
| 3 | 3 | 1 | Prescription I2 | Plage de série déjà atteinte |
| 4 | 4 | 0–1 | Prescription I2 | Pic, sans hausse supérieure à 10 % |
| 5 | 2 | 5+ | `charge × 0,8` | Deload planifié ; 1RM et Strength Score gelés |

Vérifications directes : `2 + 1 = 3` séries entre les semaines 1 et 2 ;
la semaine 3 reste à 3 dans la plage ; la semaine 4 monte à 4 ; la semaine 5
revient à 2. Pour une charge de travail de 100 kg, la charge de deload vaut
`100 × 0,8 = 80 kg`. Ce tableau est l’exemple de programme livré, pas une
interpolation à imposer à tous les programmes.

Le mésocycle dure de 4 à 7 semaines, avec une dernière semaine de deload ;
la constante d’exemple est `mesoWeeks = 5`, et une option illimitée est
également mentionnée. Une priorité peut ajouter ou retirer une série par
semaine. Les plages de séries et les limites de RIR s’appliquent en même
temps ; le PRD ne spécifie pas l’allocation exacte lorsque plusieurs exercices
partagent un muscle.

## Deload — calculs et bornes

Le volume est réduit avant la charge. Exemple donné au § 11.3 :

| Séries avant | Moitié mathématique | Options entières si séries indivisibles |
|---:|---:|---|
| 4 | 2 | 2 |
| 5 | 2,5 | 2 ou 3 selon la règle d’arrondi à décider |
| 1 | 0,5 | 0 ou 1 selon le minimum à décider |

La charge de 100 kg devient 80 kg par `100 × 0,8`, et le RIR cible est ≥ 4.
Les séries de deload restent visibles, mais ne contribuent pas au 1RM ou aux
calculs de progression. Un deload anticipé est autorisé par le § 12.2 ; son
déclenchement et sa confirmation ne sont pas définis.

## Pause et reprise

Vecteur calendaire conforme aux règles explicites du § 12.6 : si le programme
est suspendu pendant 21 jours, les séances prévues pendant ces 21 jours ne
sont pas comptées comme manquées, le streak est gelé et aucune notification
n’est envoyée. À la reprise, le mésocycle est décalé, il ne repart pas en
semaine 1. Une pause **supérieure à 21 jours** déclenche une proposition de
semaine allégée ; le calcul de cette semaine n’est pas donné.

Le détraînement suit le § 11.3 : après 14 jours sans travail du muscle,
`−1 %/semaine`, avec un plancher à `−10 %`. Sous la convention d’une baisse
après une semaine complète au-delà du seuil, une référence de 100 kg vaut
99 kg après la première semaine de baisse (`100 × 0,99`), puis 98,01 kg après
la seconde (`99 × 0,99`). L’instant de la première baisse reste à décider
par Ali et est également relevé pour I2 dans [questions-ali.md](questions-ali.md).

Le profil « Maison haltères » peut servir temporairement sans modifier le
programme principal. Une reprise ne doit donc ni réécrire la routine ni
compter la pause comme une régression.

## Frontière I5 — Recovery Split différé

Le § 12.1 réserve le Recovery Split à I5 et ne l’ajoute pas au périmètre I3.
Quand l’intégration I5 est disponible, le critère chiffré est strictement
`muscle_recovery ≥ 80 %` :

| Récupération du muscle | Décision selon § 12.1 |
|---:|---|
| 79 % | sous le seuil ; non retenu par Recovery Split |
| 80 % | seuil atteint ; admissible |
| 81 % | au-dessus du seuil ; admissible |

Ce vecteur ne définit ni un score de récupération manquant ni une règle de
remplacement pour les jours où aucun muscle n’atteint 80 %.

## Questions à décider par Ali

Les décisions suivantes sont détaillées dans le tableau de
[questions-ali.md](questions-ali.md), avec options, recommandation PRD et
échéance avant I3 :

- convention de calcul du temps (repos final et transitions), réduction à
  35 minutes et départage des exercices retirés ;
- dénominateur, arrondi et ordre de rotation des 70 % récurrents de Balanced ;
- priorité entre muscles, patterns, préférences et substitutions ; conduite
  si aucun remplacement compatible n’existe ;
- répartition des splits Custom et sémantique Guidé / Libre (Variable, Fixe,
  Statique) ; paramètres exacts des styles droites, pyramide et inversée ;
- durée du mésocycle, option illimitée et placement des deloads ; bornes
  d’augmentation hebdomadaire des séries, répartition par muscle et priorités ;
- frontière RIR du cycle générique face à l’exemple semaine 4 RIR 0–1 ;
- arrondi du volume du deload, minimum de séries et critères d’anticipation ;
- longueur exacte de décalage d’une pause et contenu de la semaine allégée
  après 21 jours.

Ne pas transformer les recommandations du registre en règles définitives sans
validation d’Ali. Le calcul du budget et les vecteurs ci-dessus sont des
contrats conditionnels à ces décisions.
