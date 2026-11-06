# I1-01 — valeurs à relire par Ali (H-8)

Le contenu de `content/` est généré par script depuis les préparations (`preparation-i1-exercices.md`, `preparation-i1-catalogues.md`) ; pour chaque valeur « à décider », l'option la plus prudente a été retenue. Rien ici n'est approuvé tant qu'Ali n'a pas relu. Aucun état CONFIRMED n'est produit.

| Valeur | Portée | Option retenue | Pourquoi |
| --- | --- | --- | --- |
| Poids des muscles | 150 exercices | Principal 1,0 ; premier secondaire 0,5 ; suivants 0,3 | Gradation de l'exemple du PRD § 14.1 (1,0 / 0,5 / 0,3) ; plusieurs muscles principaux ont chacun 1,0 |
| Rôle `primary` / `secondary` | 150 exercices | Champ ajouté à chaque muscle (`role`) | Déduit de la position avant / après « ; » de la préparation |
| `aliasesEn` | 150 exercices | Un alias dérivé de l'identifiant (`bench press barbell`) | Aucune source anglaise fournie ; à remplacer par les usages courants |
| `kind` | 150 exercices | `isolation` si pattern `isolation` ou `core`, sinon `compound` | Déduit du pattern ; exemples discutables : face-pull, tirage menton, haussements |
| `bodyweightFraction` | 150 exercices | `null` partout | Non fourni ; pas de valeur inventée |
| `strengthStandardKey` | 150 exercices | `null` partout | Liste des standards non définie |
| `defaultRestSec` | 150 exercices | Composé : 180 s si max ≤ 8, 150 s si ≤ 10, sinon 120 s ; isolation : 90 s si max ≤ 12, sinon 60 s ; tenue 60 s ; porté 90 s | Reprend les repos du PRD § 12.5 ; les programmes portent leurs propres repos |
| Instructions (`setup`, `execution`, `mistakes[3]`) | 150 exercices | Gabarits par famille de mouvement avec le matériel de l'exercice ; génériques, sans prétention médicale | Texte propre à chaque exercice non fourni ; à personnaliser |
| Plage des tenues statiques | plank, hollow-hold, side-plank, dead-hang | Métrique `time`, `defaultDurationSec` 45 s pour plank (valeur du PRD), 30 s pour les trois autres | « à décider (durée) » |
| Métrique des portés | suitcase-carry, farmer-carry | `distance`, `defaultDistanceM` 20 m, repos 90 s | « à décider (distance ou durée) » |
| Famille « poussée oblique » | développés inclinés, landmine | `push-horizontal` | Confirmé par Ali le 3 novembre |
| Planche dans Haut / Bas | Bas A | 3 × 45 s, 60 s de repos, `durationSec` 45 | PRD § 12.5 |
| « Dips ou extension nuque » | Haut B | `dips` seul ; aucune variante « extension nuque » créée | Préparation : pas d'identifiant sans décision |
| Matériel `Machine assise` | calf-raise-seated | `seated-machine` (générique) | Correspondance du catalogue ; `seated-calf-machine` existe mais n'est pas retenu |
| Matériel `Machine épaules` | lateral-raise-machine | `shoulder-press-machine` | Correspondance du catalogue |
| « Barre » sur poulie | tirages et extensions | `straight-bar-attachment` | Contexte : sibling poulie |
| Matériel facultatif | « éventuel », « buste penché » | Dans `equipment`, hors `equipmentGroups` | Non requis pour la compatibilité |
| Champs ajoutés au PRD § 14.1 | exercices | `group`, `unilateral`, `alternatives[2]`, `equipmentGroups`, `muscles[].role`, `defaultDurationSec`, `defaultDistanceM` | Présents dans la préparation ou nécessaires au filtrage matériel ; `defaultRepRange` est `null` pour `time` / `distance` |
| `media` | 150 exercices | `{ images: [], video: null, license: null, source: null }` | H-9 / D-71 : aucun média sans licence vérifiée |
| Exercices au poids du corps (`bodyweight-reps`) avec lest éventuel | dips, calf-raise-standing… | Métrique de la préparation conservée | Catalogue § 3 |
| Full Body 3 j | programme | Lun A, Mer B, Ven A (A répété) ; 6 exercices par jour ; séries de la semaine 2 | « Alternés A / B » du PRD ; exercices proposés, non fournis |
| PPL 6 j | programme | Push A, Pull A, Legs A, Push B, Pull B, Legs B (Lun à Sam), 6 exercices par jour, plages et repos par défaut de l'exercice | Exercices proposés, non fournis |
| Maison haltères 3 j | programme | Jours A, B, C (Lun, Mer, Ven), uniquement haltères, banc, élastique et poids du corps | PRD § 12.5 ; exercices proposés |
| Jours de la semaine | programmes | Haut / Bas Lun, Mar, Jeu, Ven (PRD) ; les autres proposés | `weekday` ISO 1 à 7 |
| Périodisation | 4 programmes | Reprise exacte de D-20 (2/3/3/4/2 séries, RIR 3/2/1/0–1/5+, charge × 0,8 en S5) ; `sets` des exercices = valeurs de la semaine 2 | PRD § 12.5 |
| Profil « Fitness Park Antony » | profil par défaut | Matériel confirmé le 3 novembre : barres, disques, haltères, kettlebells, toutes machines et poulies, bancs plat / incliné / lombaires, rack, traction, dips ; pupitre, bandes, marche, box, roue abdominale, ancrage landmine, ceinture de lest non inclus (non confirmés) ; tapis, sol, mur inclus pour le poids du corps | Prudence : à compléter en salle ; poids de barres à vérifier (`toVerify`) |
| Pas des machines et poulies Antony | profil | `null`, `perMachineToVerify: true` | « À relever à la première utilisation » |
| Incrément barre | profils | 2,5 kg au total (1,25 kg par côté) | Salle Antony : 2,5 kg ; préréglage : 1,25 kg par côté |
| `kind` des profils | profils | Antony et salle commerciale `salle` ; maison `maison` ; poids de corps `voyage` | § 14.3 : salle, maison, voyage ; `kind` du préréglage poids de corps non fourni |
| Préréglage « salle commerciale » | profil | Matériel d'Antony plus pupitre, bande, marche, box, roue abdominale, lest, landmine, point d'ancrage | Valeurs de la préparation ; modifiable |
| Équipements forcés / interdits | profils | Listes vides | Préparation |
