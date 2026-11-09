# CONTENT-02 — extension du catalogue d'exercices (0.9.2)

Demande d'Ali (9 nov. 2026) : la bibliothèque est incomplète (exemple : « Extension triceps prise supination »). Liste relue par Ali ; décision D-83.

## Résultat
- **196 exercices** (150 d'origine intacts + 46 nouveaux). Aucun identifiant ni nom existant modifié ; les nouveaux identifiants sont stables.
- **171 compatibles** avec Fitness Park Antony (135 sur les 150 d'origine, 36 sur les 46 nouveaux). Le profil n'est pas modifié.
- 7 matériels ajoutés à `equipment.json` : banc décliné, machine à dips, machine de développé décliné, machine de tirage vertical, belt squat, hyperextension inversée, machine d'adduction. Aucun n'est dans le profil Antony : les 10 exercices qui les exigent restent hors des « compatibles » (dips à la machine, curl marteau au pupitre — pupitre absent du profil —, développés déclinés barre et haltères, presse déclinée, tirage vertical à la machine, belt squat, hyperextension inversée, adduction à la machine, crunch décliné). À Ali de dire si la salle les a ; alors on ajoute le matériel au profil dans un ticket séparé.

## Doublons transformés en alias (2)
- « Rowing T-bar » = `row-t-bar` (« Rowing à la landmine », déjà un rowing T-bar sur landmine) : alias `t-bar row`, `t bar row`.
- « Barre au front à la barre EZ » = `skull-crusher` (« Barre au front », déjà à la barre EZ sur banc plat) : alias `ez bar skull crusher`, `lying triceps extension ez bar`.

## Exercices de la liste non ajoutés
Aucun : les 48 lignes de la liste sont couvertes (46 créés, 2 alias). Variantes proches vérifiées et conservées comme distinctes : « Soulevé de terre jambes tendues » (distinct du roumain), « Relevé de genoux suspendu » (distinct de la chaise romaine), « Kickback à la poulie » (triceps, distinct de l'extension de hanche à la poulie), « Élévation latérale unilatérale ».

## Choix de l'agent (révisables)
- **Adducteurs** : la charte de contenu n'a pas de groupe « adducteurs » (`GROUPS` du validateur, filtres de la Bibliothèque, tests). Les 3 exercices sont classés dans le groupe `glutes` (comme l'abduction de hanche), avec le muscle `adductors` en principal. Ajouter un groupe toucherait le schéma de contenu et l'interface : hors de ce ticket.
- **Alternatives** : le validateur exige exactement 2 alternatives par exercice (le brief dit « au moins 2 ») ; 2 par nouvel exercice, toutes existantes. Les alternatives des exercices existants ne sont pas modifiées.
- **Traction lestée** : matériel `ceinture de lestage` OU `haltère` (tenu entre les pieds), donc compatible Antony. **Mollets à la Smith** : cale, step OU disque (le profil Antony n'a pas de step).
- **Alias** : champ `aliasesEn`, anglais seulement ; la recherche porte sur le nom français et les alias, sans accent.
- Instructions écrites à la main par exercice (réglage, exécution, 3 erreurs), pas de média. Aucune donnée réelle.

## Tests
- `validate-content` vert ; compte exigé : minimum 150 (`EXPECTED_EXERCISES`), plus un compte exact (`scripts/content/validate.test.ts`, `src/features/training/content.test.ts`).
- `src/features/training/content02.test.ts` (rouge avant les données) : originaux intacts (identifiant et nom, fixture `content02.originals.json`), 46 nouveaux présents, pas de nom en double, recherche « supination », « triceps », « ecarte », alias des doublons, compatibilité Antony.
- Bibliothèque : `TrainingScreen.test.tsx` mis à jour (biceps 14 compatibles sur 16).
- Bundle de départ : le catalogue est chargé à la demande (`loadTrainingContent`, import dynamique) ; `content/exercises/exercises.json` n'est pas dans le départ. Mesure par `npm run test:bundle` en CI.

## Passes
- product-owner : critères = liste d'Ali, aucun cardio (I6), pas de migration, originaux intacts.
- content-data : forme exacte du JSON, muscles et matériel existants, validateur.
- training : catalogue, recherche, filtre de compatibilité, génération de séance (le moteur lit le catalogue, pas de nombre figé).
- qa-test : tests ci-dessus rouges puis verts.
- code-reviewer : voir fin de document.

## Relecture à froid (code-reviewer) : corrections
- Butées de sécurité ajoutées aux fiches « Fente à la Smith » et « Mollets à la Smith » ; « Rack pull » : barre juste au-dessus des genoux, au contact du bas des cuisses (et non des tibias).
- « Élévation en Y à la poulie » : deltoïde moyen principal, trapèzes et deltoïde postérieur secondaires, câble `cable-machine` ou `low-pulley`.
- `content/README.md` mis à jour (196 exercices, 76 matériels, minimum 150) ; apostrophes des nouveaux matériels alignées.
- Ouvert : `pull-up-weighted` est en charge + répétitions sans fraction du poids du corps (charge enregistrée = lest seul) ; à confirmer par Ali si l'e1RM doit inclure le poids du corps.
