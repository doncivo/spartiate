# Préparation I1 — bibliothèque d’exercices

Document de travail pour préparer `content/exercises/exercises.json` (§ 14.1).
La sélection compte 150 propositions rédigées pour Spartiate, sans reprise d’une
base tierce ni source externe. Les identifiants sont stables, en minuscules et
séparés par des tirets. Les alternatives sont des identifiants de cette même
bibliothèque ; elles indiquent des substitutions possibles, pas une équivalence
biomécanique garantie.

Les groupes classent chaque exercice par muscle principal. Les muscles secondaires
sont indicatifs et seront normalisés avec le catalogue fermé `muscles.json`.
Les libellés de matériel sont en français ; leurs identifiants du catalogue fermé
`equipment.json` restent à décider. « Unilatéral » décrit l’exécution prévue.
Les plages suivent les exemples du PRD (§ 12.5) et ses valeurs générales (§ 12.1).

## Pectoraux (17)

| Identifiant | Nom français | Muscles principaux ; secondaires | Matériel | Mouvement | Unilatéral | Répétitions par défaut | Alternatives (2 identifiants) |
|---|---|---|---|---|---|---|---|
| bench-press-barbell | Développé couché à la barre | Pectoraux ; triceps, deltoïdes antérieurs | Barre, banc plat | Poussée horizontale | Non | 6–10 | incline-press-dumbbell, bench-press-dumbbell |
| incline-press-dumbbell | Développé incliné aux haltères | Pectoraux ; triceps, deltoïdes antérieurs | Haltères, banc incliné | Poussée oblique | Non | 8–12 | incline-press-barbell, incline-press-machine |
| bench-press-dumbbell | Développé couché aux haltères | Pectoraux ; triceps, deltoïdes antérieurs | Haltères, banc plat | Poussée horizontale | Non | 8–12 | bench-press-barbell, chest-press-machine |
| incline-press-barbell | Développé incliné à la barre | Pectoraux ; triceps, deltoïdes antérieurs | Barre, banc incliné | Poussée oblique | Non | 6–10 | incline-press-dumbbell, incline-press-machine |
| chest-press-machine | Presse pectorale | Pectoraux ; triceps, deltoïdes antérieurs | Machine convergente | Poussée horizontale | Non | 8–12 | bench-press-dumbbell, chest-press-cable |
| incline-press-machine | Presse pectorale inclinée | Pectoraux ; triceps, deltoïdes antérieurs | Machine inclinée | Poussée oblique | Non | 8–12 | incline-press-dumbbell, incline-press-barbell |
| chest-press-cable | Développé à la poulie | Pectoraux ; triceps, deltoïdes antérieurs | Poulie, poignées | Poussée horizontale | Non | 8–12 | chest-press-machine, bench-press-dumbbell |
| push-up | Pompe | Pectoraux ; triceps, deltoïdes antérieurs, sangle abdominale | Poids du corps | Poussée horizontale | Non | 8–15 | bench-press-dumbbell, chest-press-machine |
| push-up-weighted | Pompe lestée | Pectoraux ; triceps, deltoïdes antérieurs, sangle abdominale | Poids du corps, lest | Poussée horizontale | Non | 6–10 | bench-press-barbell, push-up |
| dip-chest | Dips buste penché | Pectoraux ; triceps, deltoïdes antérieurs | Barres parallèles, lest éventuel | Poussée verticale | Non | 6–12 | dips, chest-press-machine |
| cable-fly | Écarté à la poulie | Pectoraux ; deltoïdes antérieurs | Poulie, poignées | Isolation | Non | 12–15 | pec-deck, cable-fly-low |
| cable-fly-low | Écarté poulie de bas en haut | Pectoraux ; deltoïdes antérieurs | Poulie basse, poignées | Isolation | Non | 12–15 | cable-fly, cable-fly-high |
| cable-fly-high | Écarté poulie de haut en bas | Pectoraux ; deltoïdes antérieurs | Poulie haute, poignées | Isolation | Non | 12–15 | cable-fly, pec-deck |
| pec-deck | Écarté à la machine | Pectoraux ; deltoïdes antérieurs | Machine pec-deck | Isolation | Non | 12–15 | cable-fly, chest-press-machine |
| pullover-dumbbell | Pull-over à l’haltère | Pectoraux ; grand dorsal, triceps | Haltère, banc plat | Isolation | Non | 10–15 | cable-pullover, lat-pulldown |
| squeeze-press-dumbbell | Développé serré aux haltères | Pectoraux ; triceps, deltoïdes antérieurs | Haltères, banc plat | Poussée horizontale | Non | 8–12 | bench-press-dumbbell, chest-press-machine |
| landmine-press | Développé à la landmine | Pectoraux ; deltoïdes antérieurs, triceps | Barre, ancrage landmine | Poussée oblique | Non | 8–12 | incline-press-dumbbell, overhead-press-dumbbell |

## Dos (22)

| Identifiant | Nom français | Muscles principaux ; secondaires | Matériel | Mouvement | Unilatéral | Répétitions par défaut | Alternatives (2 identifiants) |
|---|---|---|---|---|---|---|---|
| row-barbell | Rowing à la barre | Grand dorsal, trapèzes moyens ; biceps, lombaires | Barre | Tirage horizontal | Non | 6–10 | row-t-bar, seated-row-cable |
| lat-pulldown | Tirage vertical à la poulie | Grand dorsal ; biceps, trapèzes moyens | Poulie haute, barre | Tirage vertical | Non | 8–12 | pull-up, lat-pulldown-neutral |
| pull-up | Traction pronation | Grand dorsal ; biceps, trapèzes moyens | Barre de traction | Tirage vertical | Non | 6–10 | pull-up-assisted, lat-pulldown |
| row-dumbbell-one-arm | Rowing unilatéral à l’haltère | Grand dorsal ; biceps, trapèzes moyens | Haltère, banc | Tirage horizontal | Oui | 8–12 | seated-row-one-arm, chest-supported-row-dumbbell |
| seated-row-cable | Tirage assis à la poulie | Grand dorsal, trapèzes moyens ; biceps | Poulie basse, poignée | Tirage horizontal | Non | 8–12 | row-barbell, chest-supported-row-machine |
| chest-supported-row-dumbbell | Rowing haltères buste appuyé | Grand dorsal, trapèzes moyens ; biceps | Haltères, banc incliné | Tirage horizontal | Non | 8–12 | row-dumbbell-one-arm, chest-supported-row-machine |
| chest-supported-row-machine | Rowing à la machine avec appui poitrine | Grand dorsal, trapèzes moyens ; biceps | Machine avec appui poitrine | Tirage horizontal | Non | 8–12 | seated-row-cable, chest-supported-row-dumbbell |
| row-t-bar | Rowing à la landmine | Grand dorsal, trapèzes moyens ; biceps, lombaires | Barre, ancrage landmine | Tirage horizontal | Non | 6–10 | row-barbell, seated-row-cable |
| row-inverted | Rowing inversé au poids du corps | Grand dorsal, trapèzes moyens ; biceps, sangle abdominale | Barre basse ou sangles | Tirage horizontal | Non | 8–15 | seated-row-cable, pull-up-assisted |
| pull-up-assisted | Traction assistée | Grand dorsal ; biceps, trapèzes moyens | Machine assistée ou élastique, barre | Tirage vertical | Non | 6–10 | pull-up, lat-pulldown |
| chin-up | Traction supination | Grand dorsal, biceps ; trapèzes moyens | Barre de traction | Tirage vertical | Non | 6–10 | pull-up, lat-pulldown-close |
| lat-pulldown-neutral | Tirage vertical prise neutre | Grand dorsal ; biceps, trapèzes moyens | Poulie haute, poignée neutre | Tirage vertical | Non | 8–12 | lat-pulldown, pull-up |
| lat-pulldown-close | Tirage vertical prise serrée | Grand dorsal ; biceps, trapèzes moyens | Poulie haute, poignée serrée | Tirage vertical | Non | 8–12 | lat-pulldown-neutral, chin-up |
| straight-arm-pulldown | Tirage bras tendus à la poulie | Grand dorsal ; triceps, sangle abdominale | Poulie haute, corde ou barre | Isolation | Non | 10–15 | cable-pullover, lat-pulldown |
| cable-pullover | Pull-over à la poulie | Grand dorsal ; pectoraux, triceps | Poulie haute, corde ou barre | Isolation | Non | 10–15 | straight-arm-pulldown, pullover-dumbbell |
| back-extension | Extension du dos au banc | Érecteurs du rachis ; fessiers, ischio-jambiers | Banc à lombaires | Charnière | Non | 8–15 | good-morning, deadlift-barbell |
| good-morning | Good morning à la barre | Érecteurs du rachis ; fessiers, ischio-jambiers | Barre, rack | Charnière | Non | 6–10 | romanian-deadlift-barbell, back-extension |
| shrug-barbell | Haussement d’épaules à la barre | Trapèzes supérieurs ; avant-bras | Barre | Isolation | Non | 8–15 | shrug-dumbbell, cable-shrug |
| shrug-dumbbell | Haussement d’épaules aux haltères | Trapèzes supérieurs ; avant-bras | Haltères | Isolation | Non | 8–15 | shrug-barbell, cable-shrug |
| cable-shrug | Haussement d’épaules à la poulie | Trapèzes supérieurs ; avant-bras | Poulie basse, poignées | Isolation | Non | 10–15 | shrug-dumbbell, shrug-barbell |
| seated-row-one-arm | Tirage assis unilatéral | Grand dorsal ; biceps, trapèzes moyens | Poulie basse, poignée | Tirage horizontal | Oui | 8–12 | row-dumbbell-one-arm, seated-row-cable |
| face-pull | Tirage visage à la corde | Trapèzes moyens ; deltoïdes postérieurs, coiffe des rotateurs | Poulie haute, corde | Tirage horizontal | Non | 12–15 | reverse-fly-cable, reverse-fly-machine |

## Épaules (16)

| Identifiant | Nom français | Muscles principaux ; secondaires | Matériel | Mouvement | Unilatéral | Répétitions par défaut | Alternatives (2 identifiants) |
|---|---|---|---|---|---|---|---|
| overhead-press-barbell | Développé militaire à la barre | Deltoïdes antérieurs ; triceps, deltoïdes moyens | Barre, rack | Poussée verticale | Non | 6–10 | overhead-press-dumbbell, shoulder-press-machine |
| lateral-raise-dumbbell | Élévation latérale aux haltères | Deltoïdes moyens ; trapèzes supérieurs | Haltères | Isolation | Non | 12–15 | lateral-raise-cable, lateral-raise-machine |
| overhead-press-dumbbell | Développé épaules aux haltères | Deltoïdes antérieurs ; triceps, deltoïdes moyens | Haltères, banc | Poussée verticale | Non | 8–12 | overhead-press-barbell, shoulder-press-machine |
| shoulder-press-machine | Développé épaules à la machine | Deltoïdes antérieurs ; triceps, deltoïdes moyens | Machine épaules | Poussée verticale | Non | 8–12 | overhead-press-dumbbell, overhead-press-barbell |
| lateral-raise-cable | Élévation latérale à la poulie | Deltoïdes moyens ; trapèzes supérieurs | Poulie basse, poignée | Isolation | Non | 12–15 | lateral-raise-dumbbell, lateral-raise-machine |
| lateral-raise-machine | Élévation latérale à la machine | Deltoïdes moyens ; trapèzes supérieurs | Machine épaules | Isolation | Non | 12–15 | lateral-raise-dumbbell, lateral-raise-cable |
| front-raise-dumbbell | Élévation frontale aux haltères | Deltoïdes antérieurs ; deltoïdes moyens | Haltères | Isolation | Non | 10–15 | front-raise-cable, front-raise-plate |
| front-raise-cable | Élévation frontale à la poulie | Deltoïdes antérieurs ; deltoïdes moyens | Poulie basse, poignée | Isolation | Non | 10–15 | front-raise-dumbbell, front-raise-plate |
| front-raise-plate | Élévation frontale avec disque | Deltoïdes antérieurs ; sangle abdominale | Disque | Isolation | Non | 10–15 | front-raise-dumbbell, front-raise-cable |
| reverse-fly-dumbbell | Oiseau aux haltères | Deltoïdes postérieurs ; trapèzes moyens | Haltères, banc incliné ou buste penché | Isolation | Non | 12–15 | reverse-fly-cable, reverse-fly-machine |
| reverse-fly-cable | Oiseau à la poulie | Deltoïdes postérieurs ; trapèzes moyens | Poulies, poignées | Isolation | Non | 12–15 | face-pull, reverse-fly-dumbbell |
| reverse-fly-machine | Oiseau à la machine | Deltoïdes postérieurs ; trapèzes moyens | Machine pec-deck inversée | Isolation | Non | 12–15 | reverse-fly-cable, reverse-fly-dumbbell |
| arnold-press | Développé Arnold | Deltoïdes antérieurs ; deltoïdes moyens, triceps | Haltères, banc | Poussée verticale | Non | 8–12 | overhead-press-dumbbell, shoulder-press-machine |
| landmine-press-one-arm | Développé landmine à un bras | Deltoïdes antérieurs ; pectoraux, triceps | Barre, ancrage landmine | Poussée oblique | Oui | 8–12 | landmine-press, overhead-press-dumbbell |
| upright-row-cable | Tirage menton à la poulie | Deltoïdes moyens ; trapèzes supérieurs, biceps | Poulie basse, barre | Tirage vertical | Non | 10–15 | upright-row-dumbbell, lateral-raise-cable |
| upright-row-dumbbell | Tirage menton aux haltères | Deltoïdes moyens ; trapèzes supérieurs, biceps | Haltères | Tirage vertical | Non | 10–15 | upright-row-cable, lateral-raise-dumbbell |

## Biceps (10)

| Identifiant | Nom français | Muscles principaux ; secondaires | Matériel | Mouvement | Unilatéral | Répétitions par défaut | Alternatives (2 identifiants) |
|---|---|---|---|---|---|---|---|
| curl-barbell | Curl à la barre | Biceps ; brachial, avant-bras | Barre | Isolation | Non | 8–12 | curl-dumbbell, curl-cable |
| curl-incline-dumbbell | Curl incliné aux haltères | Biceps ; brachial, avant-bras | Haltères, banc incliné | Isolation | Non | 10–15 | curl-dumbbell, preacher-curl |
| curl-dumbbell | Curl aux haltères | Biceps ; brachial, avant-bras | Haltères | Isolation | Non | 8–12 | curl-barbell, curl-cable |
| curl-cable | Curl à la poulie | Biceps ; brachial, avant-bras | Poulie basse, poignée | Isolation | Non | 10–15 | curl-barbell, curl-dumbbell |
| preacher-curl | Curl au pupitre | Biceps ; brachial, avant-bras | Pupitre, barre ou haltères | Isolation | Non | 10–15 | curl-incline-dumbbell, preacher-curl-machine |
| preacher-curl-machine | Curl au pupitre machine | Biceps ; brachial, avant-bras | Machine à pupitre | Isolation | Non | 10–15 | preacher-curl, curl-cable |
| hammer-curl | Curl marteau | Brachial ; biceps, avant-bras | Haltères | Isolation | Non | 8–12 | rope-hammer-curl, reverse-curl |
| rope-hammer-curl | Curl marteau à la corde | Brachial ; biceps, avant-bras | Poulie basse, corde | Isolation | Non | 10–15 | hammer-curl, reverse-curl |
| reverse-curl | Curl inversé | Brachio-radial ; avant-bras, biceps | Barre ou haltères | Isolation | Non | 10–15 | hammer-curl, reverse-curl-cable |
| reverse-curl-cable | Curl inversé à la poulie | Brachio-radial ; avant-bras, biceps | Poulie basse, barre | Isolation | Non | 10–15 | reverse-curl, rope-hammer-curl |

## Triceps (11)

| Identifiant | Nom français | Muscles principaux ; secondaires | Matériel | Mouvement | Unilatéral | Répétitions par défaut | Alternatives (2 identifiants) |
|---|---|---|---|---|---|---|---|
| triceps-pushdown-cable | Extension triceps à la poulie | Triceps ; avant-bras | Poulie haute, barre ou corde | Isolation | Non | 8–12 | triceps-pushdown-rope, triceps-extension-machine |
| triceps-pushdown-rope | Extension triceps à la corde | Triceps ; avant-bras | Poulie haute, corde | Isolation | Non | 10–15 | triceps-pushdown-cable, triceps-kickback |
| overhead-triceps-extension-dumbbell | Extension triceps au-dessus de la tête | Triceps, chef long ; deltoïdes | Haltère | Isolation | Non | 10–15 | overhead-triceps-extension-cable, skull-crusher |
| overhead-triceps-extension-cable | Extension triceps au-dessus de la tête à la poulie | Triceps, chef long ; deltoïdes | Poulie, corde | Isolation | Non | 10–15 | overhead-triceps-extension-dumbbell, skull-crusher |
| skull-crusher | Barre au front | Triceps ; avant-bras | Barre EZ, banc plat | Isolation | Non | 8–12 | overhead-triceps-extension-dumbbell, triceps-extension-machine |
| triceps-extension-machine | Extension triceps à la machine | Triceps ; avant-bras | Machine triceps | Isolation | Non | 10–15 | triceps-pushdown-cable, skull-crusher |
| triceps-kickback | Extension triceps arrière à l’haltère | Triceps ; deltoïdes postérieurs | Haltère, banc | Isolation | Oui | 10–15 | triceps-pushdown-rope, overhead-triceps-extension-dumbbell |
| close-grip-bench-press | Développé couché prise serrée | Triceps ; pectoraux, deltoïdes antérieurs | Barre, banc plat | Poussée horizontale | Non | 6–10 | dips, triceps-pushdown-cable |
| diamond-push-up | Pompe diamant | Triceps ; pectoraux, deltoïdes antérieurs | Poids du corps | Poussée horizontale | Non | 8–15 | close-grip-bench-press, triceps-pushdown-cable |
| bench-dip | Dips entre deux bancs | Triceps ; pectoraux, deltoïdes antérieurs | Banc | Poussée verticale | Non | 8–15 | dips, triceps-pushdown-rope |
| dips | Dips aux barres parallèles | Triceps ; pectoraux, deltoïdes antérieurs | Barres parallèles, lest éventuel | Poussée verticale | Non | 8–12 | dip-chest, triceps-pushdown-cable |

## Quadriceps (19)

| Identifiant | Nom français | Muscles principaux ; secondaires | Matériel | Mouvement | Unilatéral | Répétitions par défaut | Alternatives (2 identifiants) |
|---|---|---|---|---|---|---|---|
| squat-barbell | Squat à la barre | Quadriceps ; fessiers, érecteurs du rachis | Barre, rack | Squat | Non | 5–8 | front-squat-barbell, leg-press |
| leg-press | Presse à cuisses | Quadriceps ; fessiers, ischio-jambiers | Presse à cuisses | Squat | Non | 8–12 | squat-barbell, hack-squat |
| split-squat-bulgarian | Fente bulgare | Quadriceps, fessiers ; ischio-jambiers | Haltères ou poids du corps, banc | Fente | Oui | 8–12 | split-squat-dumbbell, reverse-lunge |
| leg-extension-machine | Extension des jambes | Quadriceps | Machine leg extension | Isolation | Non | 12–15 | sissy-squat, step-up |
| front-squat-barbell | Squat avant à la barre | Quadriceps ; fessiers, sangle abdominale | Barre, rack | Squat | Non | 5–8 | squat-barbell, goblet-squat |
| goblet-squat | Squat gobelet | Quadriceps ; fessiers, sangle abdominale | Haltère ou kettlebell | Squat | Non | 8–12 | front-squat-barbell, hack-squat |
| hack-squat | Hack squat | Quadriceps ; fessiers | Machine hack squat | Squat | Non | 8–12 | leg-press, squat-barbell |
| smith-squat | Squat guidé | Quadriceps ; fessiers | Machine Smith | Squat | Non | 8–12 | squat-barbell, hack-squat |
| split-squat-dumbbell | Fente statique aux haltères | Quadriceps ; fessiers, ischio-jambiers | Haltères | Fente | Oui | 8–12 | split-squat-bulgarian, reverse-lunge |
| reverse-lunge | Fente arrière | Quadriceps ; fessiers, ischio-jambiers | Poids du corps ou haltères | Fente | Oui | 8–12 | split-squat-dumbbell, walking-lunge |
| walking-lunge | Fente marchée | Quadriceps ; fessiers, ischio-jambiers | Poids du corps ou haltères | Fente | Oui | 8–12 | reverse-lunge, step-up |
| step-up | Montée sur banc | Quadriceps ; fessiers, ischio-jambiers | Banc ou caisse, poids du corps ou haltères | Fente | Oui | 8–12 | walking-lunge, split-squat-bulgarian |
| sissy-squat | Sissy squat | Quadriceps ; sangle abdominale | Poids du corps, support éventuel | Squat | Non | 8–15 | leg-extension-machine, goblet-squat |
| leg-press-one-leg | Presse à cuisses unilatérale | Quadriceps ; fessiers, ischio-jambiers | Presse à cuisses | Squat | Oui | 8–12 | leg-press, step-up |
| front-foot-elevated-split-squat | Fente statique pied avant surélevé | Quadriceps ; fessiers, ischio-jambiers | Haltères ou poids du corps, cale | Fente | Oui | 8–12 | split-squat-dumbbell, split-squat-bulgarian |
| lateral-lunge | Fente latérale | Quadriceps, adducteurs ; fessiers | Poids du corps ou haltère | Fente | Oui | 8–12 | cossack-squat, reverse-lunge |
| cossack-squat | Squat cosaque | Quadriceps, adducteurs ; fessiers | Poids du corps ou kettlebell | Squat | Oui | 8–12 | lateral-lunge, goblet-squat |
| sledge-squat | Squat à la machine pendulaire | Quadriceps ; fessiers | Machine pendulaire | Squat | Non | 8–12 | hack-squat, leg-press |
| spanish-squat | Squat espagnol | Quadriceps ; fessiers | Sangle ou bande résistante, point d’ancrage | Squat | Non | 10–15 | sissy-squat, leg-extension-machine |

## Ischio-jambiers (14)

| Identifiant | Nom français | Muscles principaux ; secondaires | Matériel | Mouvement | Unilatéral | Répétitions par défaut | Alternatives (2 identifiants) |
|---|---|---|---|---|---|---|---|
| romanian-deadlift-barbell | Soulevé de terre roumain à la barre | Ischio-jambiers ; fessiers, érecteurs du rachis | Barre | Charnière | Non | 6–10 | romanian-deadlift-dumbbell, good-morning |
| leg-curl-machine | Leg curl assis ou couché | Ischio-jambiers ; mollets | Machine leg curl | Isolation | Non | 10–15 | nordic-curl, leg-curl-sliding |
| deadlift-barbell | Soulevé de terre à la barre | Ischio-jambiers, fessiers ; érecteurs du rachis, quadriceps | Barre | Charnière | Non | 4–6 | trap-bar-deadlift, romanian-deadlift-barbell |
| romanian-deadlift-dumbbell | Soulevé de terre roumain aux haltères | Ischio-jambiers ; fessiers, érecteurs du rachis | Haltères | Charnière | Non | 8–12 | romanian-deadlift-barbell, single-leg-romanian-deadlift |
| single-leg-romanian-deadlift | Soulevé de terre roumain unilatéral | Ischio-jambiers, fessiers ; érecteurs du rachis | Haltère ou poids du corps | Charnière | Oui | 8–12 | romanian-deadlift-dumbbell, cable-pull-through |
| leg-curl-seated | Leg curl assis | Ischio-jambiers ; mollets | Machine leg curl assis | Isolation | Non | 10–15 | leg-curl-machine, leg-curl-lying |
| leg-curl-lying | Leg curl couché | Ischio-jambiers ; mollets | Machine leg curl couché | Isolation | Non | 10–15 | leg-curl-machine, nordic-curl |
| leg-curl-one-leg | Leg curl unilatéral | Ischio-jambiers ; mollets | Machine leg curl | Isolation | Oui | 10–15 | leg-curl-seated, leg-curl-lying |
| nordic-curl | Curl nordique | Ischio-jambiers ; mollets | Support pour chevilles, poids du corps | Isolation | Non | 5–10 | leg-curl-lying, leg-curl-sliding |
| leg-curl-sliding | Leg curl glissé | Ischio-jambiers ; fessiers | Serviettes ou disques glisseurs, sol | Isolation | Non | 8–15 | nordic-curl, leg-curl-machine |
| cable-pull-through | Extension de hanches à la poulie | Ischio-jambiers, fessiers ; érecteurs du rachis | Poulie basse, corde | Charnière | Non | 10–15 | romanian-deadlift-dumbbell, back-extension |
| trap-bar-deadlift | Soulevé de terre à la barre hexagonale | Ischio-jambiers, fessiers ; quadriceps, érecteurs du rachis | Barre hexagonale | Charnière | Non | 5–8 | deadlift-barbell, romanian-deadlift-barbell |
| single-leg-curl | Flexion du genou unilatérale à la poulie | Ischio-jambiers ; mollets | Poulie basse, sangle de cheville | Isolation | Oui | 10–15 | leg-curl-one-leg, leg-curl-sliding |
| kettlebell-swing | Balancement de kettlebell | Ischio-jambiers, fessiers ; érecteurs du rachis | Kettlebell | Charnière | Non | 10–15 | cable-pull-through, romanian-deadlift-dumbbell |

## Fessiers (14)

| Identifiant | Nom français | Muscles principaux ; secondaires | Matériel | Mouvement | Unilatéral | Répétitions par défaut | Alternatives (2 identifiants) |
|---|---|---|---|---|---|---|---|
| hip-thrust-barbell | Hip thrust à la barre | Fessiers ; ischio-jambiers, sangle abdominale | Barre, banc | Charnière | Non | 8–12 | hip-thrust-machine, glute-bridge |
| glute-bridge | Pont fessier | Fessiers ; ischio-jambiers, sangle abdominale | Poids du corps ou disque | Charnière | Non | 10–15 | hip-thrust-barbell, single-leg-glute-bridge |
| hip-thrust-machine | Hip thrust à la machine | Fessiers ; ischio-jambiers | Machine hip thrust | Charnière | Non | 8–12 | hip-thrust-barbell, glute-bridge |
| single-leg-glute-bridge | Pont fessier unilatéral | Fessiers ; ischio-jambiers, sangle abdominale | Poids du corps, banc éventuel | Charnière | Oui | 8–12 | glute-bridge, single-leg-hip-thrust |
| single-leg-hip-thrust | Hip thrust unilatéral | Fessiers ; ischio-jambiers | Banc, poids du corps ou haltère | Charnière | Oui | 8–12 | hip-thrust-barbell, single-leg-glute-bridge |
| cable-kickback | Extension de hanche à la poulie | Fessiers ; ischio-jambiers | Poulie basse, sangle de cheville | Isolation | Oui | 10–15 | glute-kickback-machine, quadruped-hip-extension |
| glute-kickback-machine | Extension de hanche à la machine | Fessiers ; ischio-jambiers | Machine fessiers | Isolation | Oui | 10–15 | cable-kickback, quadruped-hip-extension |
| quadruped-hip-extension | Extension de hanche à quatre pattes | Fessiers ; ischio-jambiers | Poids du corps ou bande | Isolation | Oui | 10–15 | cable-kickback, glute-kickback-machine |
| hip-abduction-machine | Abduction de hanche à la machine | Moyen fessier ; petit fessier | Machine abducteurs | Isolation | Non | 12–15 | cable-hip-abduction, band-lateral-walk |
| cable-hip-abduction | Abduction de hanche à la poulie | Moyen fessier ; petit fessier | Poulie basse, sangle de cheville | Isolation | Oui | 12–15 | hip-abduction-machine, band-lateral-walk |
| band-lateral-walk | Marche latérale avec bande | Moyen fessier ; petit fessier, quadriceps | Bande élastique | Isolation | Oui | 10–15 | cable-hip-abduction, hip-abduction-machine |
| sumo-deadlift | Soulevé de terre sumo | Fessiers, adducteurs ; quadriceps, ischio-jambiers | Barre | Charnière | Non | 5–8 | deadlift-barbell, trap-bar-deadlift |
| cable-hip-extension | Extension de hanche debout à la poulie | Fessiers ; ischio-jambiers | Poulie basse, sangle de cheville | Isolation | Oui | 10–15 | cable-kickback, glute-kickback-machine |
| frog-pump | Relevé de bassin grenouille | Fessiers ; adducteurs | Poids du corps ou disque | Isolation | Non | 12–20 | glute-bridge, hip-thrust-machine |

## Mollets (9)

| Identifiant | Nom français | Muscles principaux ; secondaires | Matériel | Mouvement | Unilatéral | Répétitions par défaut | Alternatives (2 identifiants) |
|---|---|---|---|---|---|---|---|
| calf-raise-standing | Mollets debout | Gastrocnémien ; soléaire | Machine debout ou marche, lest éventuel | Isolation | Non | 10–15 | calf-raise-seated, calf-raise-leg-press |
| calf-raise-seated | Mollets assis | Soléaire ; gastrocnémien | Machine assise | Isolation | Non | 12–15 | calf-raise-standing, calf-raise-dumbbell |
| calf-raise-leg-press | Mollets à la presse | Gastrocnémien ; soléaire | Presse à cuisses | Isolation | Non | 10–15 | calf-raise-standing, calf-raise-seated |
| calf-raise-dumbbell | Mollets debout avec haltères | Gastrocnémien ; soléaire | Haltères, marche | Isolation | Non | 10–15 | calf-raise-standing, calf-raise-seated |
| calf-raise-one-leg | Mollet debout unilatéral | Gastrocnémien ; soléaire | Marche ou poids du corps, lest éventuel | Isolation | Oui | 10–15 | calf-raise-dumbbell, calf-raise-standing |
| calf-raise-donkey | Mollets penché en avant | Gastrocnémien ; soléaire | Machine ou support, lest éventuel | Isolation | Non | 10–15 | calf-raise-standing, calf-raise-leg-press |
| tibialis-raise | Relevé des pointes de pieds | Tibial antérieur ; extenseurs des orteils | Mur ou machine tibiale | Isolation | Non | 12–20 | tibialis-raise-band, tibialis-raise-machine |
| tibialis-raise-machine | Relevé des pointes à la machine | Tibial antérieur ; extenseurs des orteils | Machine tibiale | Isolation | Non | 12–20 | tibialis-raise, tibialis-raise-band |
| tibialis-raise-band | Relevé des pointes avec bande | Tibial antérieur ; extenseurs des orteils | Bande élastique, point d’ancrage | Isolation | Non | 12–20 | tibialis-raise, tibialis-raise-machine |

## Sangle abdominale (14)

| Identifiant | Nom français | Muscles principaux ; secondaires | Matériel | Mouvement | Unilatéral | Répétitions par défaut | Alternatives (2 identifiants) |
|---|---|---|---|---|---|---|---|
| plank | Planche | Sangle abdominale ; deltoïdes, fessiers | Poids du corps, tapis | Gainage | Non | à décider (durée) | dead-bug, hollow-hold |
| hanging-leg-raise | Relevé de jambes suspendu | Sangle abdominale ; fléchisseurs de hanche | Barre de traction | Flexion du tronc | Non | 10–15 | captain-chair-knee-raise, reverse-crunch |
| dead-bug | Dead bug | Sangle abdominale ; fléchisseurs de hanche | Poids du corps, tapis | Gainage | Oui | 8–12 | plank, bird-dog |
| hollow-hold | Gainage hollow | Sangle abdominale ; fléchisseurs de hanche | Poids du corps, tapis | Gainage | Non | à décider (durée) | plank, dead-bug |
| captain-chair-knee-raise | Relevé de genoux à la chaise romaine | Sangle abdominale ; fléchisseurs de hanche | Chaise romaine | Flexion du tronc | Non | 10–15 | hanging-leg-raise, reverse-crunch |
| reverse-crunch | Enroulement de bassin | Sangle abdominale ; fléchisseurs de hanche | Poids du corps, tapis | Flexion du tronc | Non | 10–15 | hanging-leg-raise, captain-chair-knee-raise |
| cable-crunch | Enroulement du tronc à la poulie | Sangle abdominale | Poulie haute, corde | Flexion du tronc | Non | 10–15 | machine-crunch, reverse-crunch |
| machine-crunch | Enroulement du tronc à la machine | Sangle abdominale | Machine abdominale | Flexion du tronc | Non | 10–15 | cable-crunch, reverse-crunch |
| side-plank | Planche latérale | Obliques ; carré des lombes, deltoïdes | Poids du corps, tapis | Gainage | Oui | à décider (durée) | pallof-press, suitcase-carry |
| pallof-press | Pallof press | Obliques ; sangle abdominale | Poulie ou bande élastique | Anti-rotation | Oui | 8–12 | side-plank, dead-bug |
| ab-wheel-rollout | Déploiement à la roue abdominale | Sangle abdominale ; dorsaux, épaules | Roue abdominale | Anti-extension | Non | 6–12 | plank, body-saw |
| body-saw | Scie abdominale | Sangle abdominale ; épaules | Sangles ou patins, tapis | Anti-extension | Non | 8–15 | ab-wheel-rollout, plank |
| bird-dog | Bird dog | Sangle abdominale ; érecteurs du rachis, fessiers | Poids du corps, tapis | Anti-rotation | Oui | 8–12 | dead-bug, side-plank |
| suitcase-carry | Marche du fermier unilatérale | Obliques ; avant-bras, trapèzes | Haltère ou kettlebell | Porté | Oui | à décider (distance ou durée) | pallof-press, side-plank |

## Avant-bras (4)

| Identifiant | Nom français | Muscles principaux ; secondaires | Matériel | Mouvement | Unilatéral | Répétitions par défaut | Alternatives (2 identifiants) |
|---|---|---|---|---|---|---|---|
| wrist-curl | Flexion des poignets | Fléchisseurs de l’avant-bras ; biceps | Barre ou haltères, banc | Isolation | Non | 12–20 | wrist-curl-cable, farmer-carry |
| wrist-curl-cable | Flexion des poignets à la poulie | Fléchisseurs de l’avant-bras ; biceps | Poulie basse, barre | Isolation | Non | 12–20 | wrist-curl, reverse-curl |
| farmer-carry | Marche du fermier | Avant-bras ; trapèzes, sangle abdominale | Haltères ou kettlebells | Porté | Non | à décider (distance ou durée) | suitcase-carry, dead-hang |
| dead-hang | Suspension à la barre | Avant-bras ; grand dorsal, épaules | Barre de traction | Porté | Non | à décider (durée) | farmer-carry, wrist-curl |

## Champs du modèle de données (§ 20.2)

Cette proposition ne constitue pas un schéma JSON validé. Pour l’enregistrement
`exercise`, les valeurs préparées sont `id`, `name_fr`, muscles principaux et
secondaires, matériel, famille de mouvement et plage de répétitions. La
normalisation des identifiants de muscles et de matériel dans leurs catalogues
fermés reste **à décider**.

| Colonne de `exercise` (§ 20.2) | État dans cette préparation |
|---|---|
| `id`, `name_fr` | Renseignés dans les tableaux |
| `aliases_en` | à décider |
| `muscles` | Muscles indiqués en français ; identifiants et pondérations à décider |
| `equipment` | Matériel indiqué en français ; identifiants du catalogue à décider |
| `pattern` | Famille de mouvement indiquée ; correspondance avec l’énumération du schéma à décider |
| `kind` | à décider |
| `metric` | à décider, sauf exercices au temps ou à la distance explicitement signalés dans la plage |
| `bodyweight_fraction` | à décider |
| `default_rep_min` / `default_rep_max` | Plage proposée dans les tableaux ; à décider pour les mouvements au temps ou à la distance |
| `default_rest_sec` | à décider |
| `instructions` | à décider |
| `media` | à décider ; aucune image, vidéo ni aucun lien d’image n’est proposé (Q-3 ouverte) |
| `strength_standard_key` | à décider |
| `is_custom` | `false` pour le contenu embarqué, conformément au périmètre de § 20.2 |
| `schema_version` | `1`, valeur de l’exemple de § 14.1 |

Pour `equipment_profile`, § 20.2 nomme `name`, `kind`, `inventory` (JSON) et
`increments` (JSON). Les valeurs de `kind`, la structure détaillée de ces JSON,
les inventaires et les incréments restent **à décider**. Les profils de départ
« salle commerciale », « maison haltères » et « poids de corps » sont ceux de
§ 14.3 ; leurs configurations ne sont pas inventées ici.

## Vérification Haut / Bas 4 j (§ 12.5)

Les 26 identifiants utilisés dans les jours Haut A, Bas A, Haut B et Bas B du
programme figurent tous dans les tableaux : `bench-press-barbell`,
`row-barbell`, `incline-press-dumbbell`, `lat-pulldown`,
`lateral-raise-dumbbell`, `curl-barbell`, `triceps-pushdown-cable`,
`squat-barbell`, `romanian-deadlift-barbell`, `leg-press`,
`leg-curl-machine`, `calf-raise-standing`, `plank`,
`overhead-press-barbell`, `pull-up`, `bench-press-dumbbell`,
`row-dumbbell-one-arm`, `cable-fly`, `curl-incline-dumbbell`, `dips`,
`deadlift-barbell`, `split-squat-bulgarian`, `hip-thrust-barbell`,
`leg-extension-machine`, `calf-raise-seated` et `hanging-leg-raise`.

Le programme propose aussi « extension nuque » comme variante des dips ; aucun
identifiant séparé n’est créé sans décision sur la variante exacte.
