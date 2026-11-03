# Préparation I1 — catalogues fermés

Document de préparation, non contractuel, pour les catalogues d'exercices et de
profils de matériel. Les noms et les identifiants ci-dessous sont rédigés pour
Spartiate ; aucune base tierce n'a été reprise. Références : [préparation des
exercices](./preparation-i1-exercices.md), [§ 14 — Bibliothèque et profils de
matériel](./prd/14-bibliotheque-d-exercices-et-profils-de-materiel.md) et
[§ 20.2 — Tables](./prd/20-modele-de-donnees-sqlite.md).

## 1. Liste fermée des muscles

Les identifiants sont stables, en anglais, minuscules et séparés par des
tirets. Les groupes sont des catégories d'affichage, pas des muscles.

| Identifiant | Nom français | Groupe |
|---|---|---|
| chest | Pectoraux | Torse |
| lats | Grand dorsal | Dos |
| middle-traps | Trapèzes moyens | Dos |
| upper-traps | Trapèzes supérieurs | Dos |
| trapezius | Trapèzes | Dos |
| erector-spinae | Érecteurs du rachis | Dos |
| lower-back | Lombaires | Dos |
| front-delts | Deltoïdes antérieurs | Épaules |
| middle-delts | Deltoïdes moyens | Épaules |
| rear-delts | Deltoïdes postérieurs | Épaules |
| deltoids | Deltoïdes | Épaules |
| rotator-cuff | Coiffe des rotateurs | Épaules |
| shoulders | Épaules | Épaules |
| biceps | Biceps | Bras |
| triceps | Triceps | Bras |
| brachialis | Brachial | Bras |
| brachioradialis | Brachio-radial | Bras |
| forearms | Avant-bras | Bras |
| forearm-flexors | Fléchisseurs de l’avant-bras | Bras |
| quads | Quadriceps | Jambes |
| hamstrings | Ischio-jambiers | Jambes |
| glutes | Fessiers | Jambes |
| gluteus-medius | Moyen fessier | Jambes |
| gluteus-minimus | Petit fessier | Jambes |
| adductors | Adducteurs | Jambes |
| calves | Mollets | Jambes |
| gastrocnemius | Gastrocnémien | Jambes |
| soleus | Soléaire | Jambes |
| tibialis-anterior | Tibial antérieur | Jambes |
| toe-extensors | Extenseurs des orteils | Jambes |
| abs | Sangle abdominale | Tronc |
| obliques | Obliques | Tronc |
| quadratus-lumborum | Carré des lombes | Tronc |
| hip-flexors | Fléchisseurs de hanche | Tronc |

### Correspondance des libellés de la préparation

La casse et les majuscules initiales ne changent pas l'identifiant. Dans la
source, la virgule sépare généralement des muscles cités ensemble ; elle ne
crée pas un muscle composé. Les formes génériques et synonymes sont explicitées
ci-dessous.

| Libellé français de la source | Identifiant |
|---|---|
| Pectoraux | chest |
| Grand dorsal, dorsaux | lats |
| Trapèzes moyens | middle-traps |
| Trapèzes supérieurs | upper-traps |
| Trapèzes | trapezius |
| Érecteurs du rachis | erector-spinae |
| Lombaires | lower-back |
| Deltoïdes antérieurs | front-delts |
| Deltoïdes moyens | middle-delts |
| Deltoïdes postérieurs | rear-delts |
| Deltoïdes | deltoids |
| Coiffe des rotateurs | rotator-cuff |
| Épaules | shoulders |
| Biceps | biceps |
| Triceps, « chef long » (précision de portion) | triceps |
| Brachial | brachialis |
| Brachio-radial | brachioradialis |
| Avant-bras | forearms |
| Fléchisseurs de l’avant-bras | forearm-flexors |
| Quadriceps | quads |
| Ischio-jambiers | hamstrings |
| Fessiers | glutes |
| Moyen fessier | gluteus-medius |
| Petit fessier | gluteus-minimus |
| Adducteurs | adductors |
| Mollets | calves |
| Gastrocnémien | gastrocnemius |
| Soléaire | soleus |
| Tibial antérieur | tibialis-anterior |
| Extenseurs des orteils | toe-extensors |
| Sangle abdominale | abs |
| Obliques | obliques |
| Carré des lombes | quadratus-lumborum |
| Fléchisseurs de hanche | hip-flexors |

Tous les libellés musculaires de `preparation-i1-exercices.md` ont une
correspondance. « Épaules », « deltoïdes », « trapèzes », « avant-bras » et
« mollets » restent des libellés génériques ; leur normalisation vers un
muscle plus précis ne doit pas être inventée.

## 2. Liste fermée du matériel

Les familles sont celles prévues par la demande ; un équipement de machine ou
d'accessoire peut avoir un identifiant précis tout en gardant sa famille.

| Identifiant | Nom français | Famille |
|---|---|---|
| barbell | Barre droite | barre |
| ez-bar | Barre EZ | barre |
| trap-bar | Barre hexagonale | barre |
| low-bar | Barre basse | barre |
| pull-up-bar | Barre de traction | barre |
| parallel-bars | Barres parallèles | barre |
| weight-plate | Disque de poids | disque |
| dumbbell | Haltère | haltère |
| kettlebell | Kettlebell | kettlebell |
| machine | Machine (générique) | machine |
| seated-machine | Machine assise (générique) | machine |
| assisted-pull-up-machine | Machine de traction assistée | machine |
| chest-supported-row-machine | Machine de rowing avec appui poitrine | machine |
| chest-press-machine | Machine convergente de développé pectoral | machine |
| incline-chest-press-machine | Machine de développé pectoral incliné | machine |
| pec-deck | Machine pec-deck | machine |
| reverse-pec-deck | Machine pec-deck inversée | machine |
| shoulder-press-machine | Machine de développé épaules | machine |
| preacher-curl-machine | Machine à pupitre pour curl | machine |
| triceps-machine | Machine triceps | machine |
| hack-squat-machine | Machine hack squat | machine |
| smith-machine | Machine Smith | machine |
| pendulum-squat-machine | Machine pendulaire | machine |
| leg-press-machine | Presse à cuisses | machine |
| leg-extension-machine | Machine d'extension des jambes | machine |
| leg-curl-machine | Machine leg curl | machine |
| seated-leg-curl-machine | Machine leg curl assis | machine |
| lying-leg-curl-machine | Machine leg curl couché | machine |
| hip-thrust-machine | Machine hip thrust | machine |
| glute-kickback-machine | Machine fessiers | machine |
| hip-abduction-machine | Machine abducteurs | machine |
| standing-calf-machine | Machine mollets debout | machine |
| seated-calf-machine | Machine mollets assis | machine |
| tibialis-machine | Machine tibiale | machine |
| ab-crunch-machine | Machine abdominale | machine |
| captain-chair | Chaise romaine | machine |
| low-pulley | Poulie basse | poulie |
| high-pulley | Poulie haute | poulie |
| cable-machine | Poulie(s), installation générique | poulie |
| bench | Banc (générique) | banc |
| flat-bench | Banc plat | banc |
| incline-bench | Banc incliné | banc |
| back-extension-bench | Banc à lombaires | banc |
| preacher-bench | Pupitre | banc |
| rack | Rack | rack |
| bodyweight | Poids du corps | poids du corps |
| cable-handle | Poignée de poulie | accessoire |
| neutral-grip-handle | Poignée neutre | accessoire |
| close-grip-handle | Poignée serrée | accessoire |
| straight-bar-attachment | Barre droite pour poulie | accessoire |
| rope-attachment | Corde pour poulie | accessoire |
| ankle-strap | Sangle de cheville | accessoire |
| resistance-strap | Sangle résistante | accessoire |
| suspension-straps | Sangles de suspension | accessoire |
| resistance-band | Bande élastique ou résistante | accessoire |
| landmine-attachment | Ancrage landmine | accessoire |
| loading-belt | Ceinture ou dispositif de lest | accessoire |
| ankle-anchor | Support d'ancrage pour chevilles | accessoire |
| support | Support (générique) | accessoire |
| plyo-box | Caisse ou box | accessoire |
| step | Marche | accessoire |
| heel-wedge | Cale | accessoire |
| mat | Tapis | accessoire |
| ab-wheel | Roue abdominale | accessoire |
| sliders | Disques glisseurs ou patins | accessoire |
| towel | Serviettes | accessoire |
| wall | Mur | accessoire |
| floor | Sol | accessoire |
| anchor-point | Point d'ancrage | accessoire |

### Correspondance des libellés de matériel

Les variantes de casse, de singulier et de pluriel ci-dessous sont équivalentes.
Les éléments sont séparés en équipements lorsque la source énumère plusieurs
objets dans la même cellule.

| Libellé(s) français de la source | Identifiant(s) |
|---|---|
| Barre (charge libre) | barbell |
| Barre (sur poulie) | straight-bar-attachment |
| Barre (sur machine de traction assistée) | pull-up-bar |
| Barre EZ | ez-bar |
| Barre hexagonale | trap-bar |
| Barre basse | low-bar |
| Barre de traction | pull-up-bar |
| Barres parallèles | parallel-bars |
| Disque, disques | weight-plate |
| Haltère, haltères | dumbbell |
| Kettlebell, kettlebells | kettlebell |
| Banc, banc éventuel | bench |
| Banc plat | flat-bench |
| Banc incliné | incline-bench |
| Banc à lombaires | back-extension-bench |
| Pupitre | preacher-bench |
| Rack | rack |
| Poids du corps | bodyweight |
| Barre ou haltères | barbell ou dumbbell |
| Banc ou caisse | bench ou plyo-box |
| Banc, poids du corps ou haltère | bench, bodyweight ou dumbbell |
| Banc incliné ou buste penché | incline-bench ; « buste penché » est une position, pas du matériel |
| Haltère ou kettlebell | dumbbell ou kettlebell |
| Haltère ou poids du corps | dumbbell ou bodyweight |
| Haltères ou poids du corps | dumbbell ou bodyweight |
| Bande élastique | resistance-band |
| Poids du corps ou bande | bodyweight ou resistance-band |
| Poids du corps ou disque | bodyweight ou weight-plate |
| Poids du corps ou haltère(s) | bodyweight ou dumbbell |
| Poids du corps ou kettlebell | bodyweight ou kettlebell |
| Poids du corps, lest ou lest éventuel | bodyweight, loading-belt |
| Machine (sans précision) | machine |
| Machine assise | seated-machine |
| Machine assistée | assisted-pull-up-machine |
| Machine avec appui poitrine | chest-supported-row-machine |
| Machine convergente | chest-press-machine |
| Machine inclinée | incline-chest-press-machine |
| Machine Smith | smith-machine |
| Machine abdominale | ab-crunch-machine |
| Machine abducteurs | hip-abduction-machine |
| Machine debout | standing-calf-machine |
| Machine fessiers | glute-kickback-machine |
| Machine hack squat | hack-squat-machine |
| Machine hip thrust | hip-thrust-machine |
| Machine leg curl | leg-curl-machine |
| Machine leg curl assis | seated-leg-curl-machine |
| Machine leg curl couché | lying-leg-curl-machine |
| Machine leg extension | leg-extension-machine |
| Machine pec-deck | pec-deck |
| Machine pec-deck inversée | reverse-pec-deck |
| Machine pendulaire | pendulum-squat-machine |
| Machine tibiale | tibialis-machine |
| Machine triceps | triceps-machine |
| Machine à pupitre | preacher-curl-machine |
| Machine épaules | shoulder-press-machine |
| Machine ou support, lest éventuel | machine, support, loading-belt |
| Machine ou marche | standing-calf-machine ou step |
| Presse à cuisses | leg-press-machine |
| Chaise romaine | captain-chair |
| Poulie, poulies | cable-machine |
| Poulie basse | low-pulley |
| Poulie haute | high-pulley |
| Poignée, poignées | cable-handle |
| Poignée neutre | neutral-grip-handle |
| Poignée serrée | close-grip-handle |
| Corde | rope-attachment |
| Sangle de cheville | ankle-strap |
| Sangle ou bande résistante | resistance-strap ou resistance-band |
| Sangles | suspension-straps |
| Élastique | resistance-band |
| Ancrage landmine | landmine-attachment |
| Point d'ancrage | anchor-point |
| Support, support éventuel | support |
| Support pour chevilles | ankle-anchor |
| Caisse | plyo-box |
| Marche | step |
| Cale | heel-wedge |
| Tapis | mat |
| Roue abdominale | ab-wheel |
| Patins ou disques glisseurs | sliders |
| Serviettes | towel |
| Mur | wall |
| Sol | floor |

Tous les éléments matériels cités ont une correspondance. « Buste penché » est
le seul élément non matériel relevé dans ces cellules : il décrit une posture
et n'a donc pas d'identifiant d'équipement. Le sens de « barre » et de « lest »
dépend du contexte indiqué dans la table.

## 3. Correspondance des 150 exercices

Valeurs de `pattern` et `metric` conformes à § 14.1. Règle de préparation :
**« poussée oblique » → `push-horizontal` (à confirmer par Ali)**. Les
mouvements de gainage, anti-rotation, anti-extension et flexion du tronc sont
classés `core`. Les exercices dont le matériel ou le mouvement est principalement
au poids du corps utilisent `bodyweight-reps`, sauf les tenues statiques.
Les deux portés dont la source indique « distance ou durée » restent à décider.

| Identifiant | pattern | metric |
|---|---|---|
| bench-press-barbell | push-horizontal | load-reps |
| incline-press-dumbbell | push-horizontal | load-reps |
| bench-press-dumbbell | push-horizontal | load-reps |
| incline-press-barbell | push-horizontal | load-reps |
| chest-press-machine | push-horizontal | load-reps |
| incline-press-machine | push-horizontal | load-reps |
| chest-press-cable | push-horizontal | load-reps |
| push-up | push-horizontal | bodyweight-reps |
| push-up-weighted | push-horizontal | load-reps |
| dip-chest | push-vertical | bodyweight-reps |
| cable-fly | isolation | load-reps |
| cable-fly-low | isolation | load-reps |
| cable-fly-high | isolation | load-reps |
| pec-deck | isolation | load-reps |
| pullover-dumbbell | isolation | load-reps |
| squeeze-press-dumbbell | push-horizontal | load-reps |
| landmine-press | push-horizontal | load-reps |
| row-barbell | pull-horizontal | load-reps |
| lat-pulldown | pull-vertical | load-reps |
| pull-up | pull-vertical | bodyweight-reps |
| row-dumbbell-one-arm | pull-horizontal | load-reps |
| seated-row-cable | pull-horizontal | load-reps |
| chest-supported-row-dumbbell | pull-horizontal | load-reps |
| chest-supported-row-machine | pull-horizontal | load-reps |
| row-t-bar | pull-horizontal | load-reps |
| row-inverted | pull-horizontal | bodyweight-reps |
| pull-up-assisted | pull-vertical | bodyweight-reps |
| chin-up | pull-vertical | bodyweight-reps |
| lat-pulldown-neutral | pull-vertical | load-reps |
| lat-pulldown-close | pull-vertical | load-reps |
| straight-arm-pulldown | isolation | load-reps |
| cable-pullover | isolation | load-reps |
| back-extension | hinge | bodyweight-reps |
| good-morning | hinge | load-reps |
| shrug-barbell | isolation | load-reps |
| shrug-dumbbell | isolation | load-reps |
| cable-shrug | isolation | load-reps |
| seated-row-one-arm | pull-horizontal | load-reps |
| face-pull | pull-horizontal | load-reps |
| overhead-press-barbell | push-vertical | load-reps |
| lateral-raise-dumbbell | isolation | load-reps |
| overhead-press-dumbbell | push-vertical | load-reps |
| shoulder-press-machine | push-vertical | load-reps |
| lateral-raise-cable | isolation | load-reps |
| lateral-raise-machine | isolation | load-reps |
| front-raise-dumbbell | isolation | load-reps |
| front-raise-cable | isolation | load-reps |
| front-raise-plate | isolation | load-reps |
| reverse-fly-dumbbell | isolation | load-reps |
| reverse-fly-cable | isolation | load-reps |
| reverse-fly-machine | isolation | load-reps |
| arnold-press | push-vertical | load-reps |
| landmine-press-one-arm | push-horizontal | load-reps |
| upright-row-cable | pull-vertical | load-reps |
| upright-row-dumbbell | pull-vertical | load-reps |
| curl-barbell | isolation | load-reps |
| curl-incline-dumbbell | isolation | load-reps |
| curl-dumbbell | isolation | load-reps |
| curl-cable | isolation | load-reps |
| preacher-curl | isolation | load-reps |
| preacher-curl-machine | isolation | load-reps |
| hammer-curl | isolation | load-reps |
| rope-hammer-curl | isolation | load-reps |
| reverse-curl | isolation | load-reps |
| reverse-curl-cable | isolation | load-reps |
| triceps-pushdown-cable | isolation | load-reps |
| triceps-pushdown-rope | isolation | load-reps |
| overhead-triceps-extension-dumbbell | isolation | load-reps |
| overhead-triceps-extension-cable | isolation | load-reps |
| skull-crusher | isolation | load-reps |
| triceps-extension-machine | isolation | load-reps |
| triceps-kickback | isolation | load-reps |
| close-grip-bench-press | push-horizontal | load-reps |
| diamond-push-up | push-horizontal | bodyweight-reps |
| bench-dip | push-vertical | bodyweight-reps |
| dips | push-vertical | bodyweight-reps |
| squat-barbell | squat | load-reps |
| leg-press | squat | load-reps |
| split-squat-bulgarian | lunge | bodyweight-reps |
| leg-extension-machine | isolation | load-reps |
| front-squat-barbell | squat | load-reps |
| goblet-squat | squat | load-reps |
| hack-squat | squat | load-reps |
| smith-squat | squat | load-reps |
| split-squat-dumbbell | lunge | load-reps |
| reverse-lunge | lunge | bodyweight-reps |
| walking-lunge | lunge | bodyweight-reps |
| step-up | lunge | bodyweight-reps |
| sissy-squat | squat | bodyweight-reps |
| leg-press-one-leg | squat | load-reps |
| front-foot-elevated-split-squat | lunge | bodyweight-reps |
| lateral-lunge | lunge | bodyweight-reps |
| cossack-squat | squat | bodyweight-reps |
| sledge-squat | squat | load-reps |
| spanish-squat | squat | bodyweight-reps |
| romanian-deadlift-barbell | hinge | load-reps |
| leg-curl-machine | isolation | load-reps |
| deadlift-barbell | hinge | load-reps |
| romanian-deadlift-dumbbell | hinge | load-reps |
| single-leg-romanian-deadlift | hinge | bodyweight-reps |
| leg-curl-seated | isolation | load-reps |
| leg-curl-lying | isolation | load-reps |
| leg-curl-one-leg | isolation | load-reps |
| nordic-curl | isolation | bodyweight-reps |
| leg-curl-sliding | isolation | bodyweight-reps |
| cable-pull-through | hinge | load-reps |
| trap-bar-deadlift | hinge | load-reps |
| single-leg-curl | isolation | load-reps |
| kettlebell-swing | hinge | load-reps |
| hip-thrust-barbell | hinge | load-reps |
| glute-bridge | hinge | bodyweight-reps |
| hip-thrust-machine | hinge | load-reps |
| single-leg-glute-bridge | hinge | bodyweight-reps |
| single-leg-hip-thrust | hinge | bodyweight-reps |
| cable-kickback | isolation | load-reps |
| glute-kickback-machine | isolation | load-reps |
| quadruped-hip-extension | isolation | bodyweight-reps |
| hip-abduction-machine | isolation | load-reps |
| cable-hip-abduction | isolation | load-reps |
| band-lateral-walk | isolation | bodyweight-reps |
| sumo-deadlift | hinge | load-reps |
| cable-hip-extension | isolation | load-reps |
| frog-pump | isolation | bodyweight-reps |
| calf-raise-standing | isolation | bodyweight-reps |
| calf-raise-seated | isolation | load-reps |
| calf-raise-leg-press | isolation | load-reps |
| calf-raise-dumbbell | isolation | load-reps |
| calf-raise-one-leg | isolation | bodyweight-reps |
| calf-raise-donkey | isolation | bodyweight-reps |
| tibialis-raise | isolation | bodyweight-reps |
| tibialis-raise-machine | isolation | load-reps |
| tibialis-raise-band | isolation | bodyweight-reps |
| plank | core | time |
| hanging-leg-raise | core | bodyweight-reps |
| dead-bug | core | bodyweight-reps |
| hollow-hold | core | time |
| captain-chair-knee-raise | core | bodyweight-reps |
| reverse-crunch | core | bodyweight-reps |
| cable-crunch | core | load-reps |
| machine-crunch | core | load-reps |
| side-plank | core | time |
| pallof-press | core | load-reps |
| ab-wheel-rollout | core | bodyweight-reps |
| body-saw | core | bodyweight-reps |
| bird-dog | core | bodyweight-reps |
| suitcase-carry | carry | à décider |
| wrist-curl | isolation | load-reps |
| wrist-curl-cable | isolation | load-reps |
| farmer-carry | carry | à décider |
| dead-hang | carry | time |

## 4. Profils de matériel

Les configurations suivantes sont des valeurs initiales proposées et modifiables,
non des inventaires garantis. Pour les machines, les valeurs de stack sont des
défauts à préciser machine par machine. La structure JSON d'`inventory`,
`increments` et l'énumération de `kind` restent à arrêter conformément à
`equipment_profile` en § 20.2. Les équipements forcés et interdits sont vides
par défaut.

### Préréglage « salle commerciale »

| Rubrique § 14.3 | Valeurs par défaut modifiables |
|---|---|
| Barres (type, poids) | Barre olympique droite 20 kg ; barre EZ 10 kg ; barre hexagonale 25 kg ; poids à ajuster aux barres réelles. |
| Disques par côté | 1 disque de chaque côté aux masses 1,25, 2,5, 5, 10, 15, 20 et 25 kg ; quantité modifiable. |
| Haltères (plage et pas) | 2 à 40 kg par haltère, pas de 2 kg. |
| Kettlebells | 4, 8, 12, 16, 20, 24, 28 et 32 kg. |
| Machines (stack min / max / pas) | 5 / 100 / 5 kg, à configurer pour chaque machine. |
| Câbles | 2,5 / 100 / 2,5 kg. |
| Bancs | Plat, incliné et réglable. |
| Racks | Rack à squat et rack à barre ; présence de la Smith à déclarer dans les machines. |
| Poids du corps | Disponible. |
| Incréments par type | Barre/disques : 1,25 kg par côté ; haltères : 2 kg ; kettlebells : 4 kg ; machines : 5 kg ; câbles : 2,5 kg. |
| Forcés / interdits | Aucun par défaut. |

### Préréglage « maison haltères »

| Rubrique § 14.3 | Valeurs par défaut modifiables |
|---|---|
| Barres (type, poids) | Aucune. |
| Disques par côté | Aucun inventaire distinct ; à configurer si haltères réglables à disques. |
| Haltères (plage et pas) | Haltères réglables de 2 à 30 kg par haltère, pas de 2 kg. |
| Kettlebells | Aucune par défaut. |
| Machines (stack min / max / pas) | Aucune. |
| Câbles | Aucun. |
| Bancs | Un banc réglable (plat / incliné). |
| Racks | Aucun. |
| Poids du corps | Disponible. |
| Incréments par type | Haltères : 2 kg ; autres types : non configurés. |
| Forcés / interdits | Aucun par défaut. |

### Préréglage « poids de corps »

| Rubrique § 14.3 | Valeurs par défaut modifiables |
|---|---|
| Barres (type, poids) | Aucune. |
| Disques par côté | Aucun. |
| Haltères (plage et pas) | Aucun. |
| Kettlebells | Aucune. |
| Machines (stack min / max / pas) | Aucune. |
| Câbles | Aucun. |
| Bancs | Aucun. |
| Racks | Aucun. |
| Poids du corps | Disponible. |
| Incréments par type | Aucun équipement externe configuré. |
| Forcés / interdits | Aucun par défaut. |

### Gabarit « Salle Antony »

Toutes les valeurs sont volontairement à renseigner, sans présumer de
l'équipement réel de la salle.

| Rubrique § 14.3 | Valeur |
|---|---|
| Barres (type, poids) | à confirmer par Ali |
| Disques par côté | à confirmer par Ali |
| Haltères (plage et pas) | à confirmer par Ali |
| Kettlebells | à confirmer par Ali |
| Machines, avec stack min / max / pas par machine | à confirmer par Ali |
| Câbles (min / max / pas) | à confirmer par Ali |
| Bancs | à confirmer par Ali |
| Racks | à confirmer par Ali |
| Poids du corps | à confirmer par Ali |
| Incréments par type | à confirmer par Ali |
| Équipements forcés / interdits | à confirmer par Ali |
| `kind` du profil | à confirmer par Ali |

Questions pour remplir le profil :

1. La barre olympique droite pèse-t-elle 20 kg, et quelles autres barres sont disponibles ?
2. Quels disques sont disponibles, en quelle quantité par côté ?
3. Les haltères vont-ils de quel poids à quel poids, avec quel pas ?
4. Quelles kettlebells sont disponibles ?
5. Quelles machines sont présentes, et quels sont leurs stacks min / max / pas ?
6. Quelles poulies sont disponibles, avec quelles masses min / max / pas ?
7. Quels bancs sont disponibles : plat, incliné, réglable ou à lombaires ?
8. Quels racks, barres de traction et barres parallèles sont disponibles ?
9. Y a-t-il des équipements à forcer ou à interdire dans ce profil ?
