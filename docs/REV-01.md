# REV-01 — correctifs de la relecture Codex du 9 novembre (0.9.3)

Source : `docs/relecture-codex-2026-11-09.md` (PR #90) et demande d'Ali du 9 novembre. Une branche (`rev-01-relecture-codex`), une PR, version 0.9.3.
**Migration : aucune, le schéma reste 9.** Aucune donnée réelle touchée (D-38 : conteneur de laboratoire pour les tests) ; aucun changement ne modifie ni ne perd une donnée déjà saisie. Budget : L.

## Passes (AGENTS.md, dans l'ordre)

1. **product-owner.** Critères Given / When / Then repris du rapport (colonne « Test qui le détecterait ») : un test par constat, écrit rouge dans un commit séparé avant le correctif. Périmètre : constats 1, 2, 3, 4, 6, 7, 9, 10 corrigés ; 8 et 5 consignés sans code (D-86, reporté) ; plus le point 7 du rapport 0.9.2 (1RM des exercices au poids du corps).
2. **Agents des modules** (training, nutrition, settings, data-model pour l'archive). Voir « Traitement par constat ».
3. **sync-icloud** (D-26, tout ce qui touche l'export / import et la synchro) : voir « Relectures ».
4. **qa-test.** Tests rouges avant correctif (commits ci-dessous), puis verts ; non-régression des PR #56 et #84 rejouée sur les commits parents (section dédiée). Aucun e2e, visual ni perf en local (CI seulement).
5. **code-reviewer.** Relecture à froid : voir « Relectures ».

## Traitement par constat

| Constat | Cause confirmée | Correctif | Commit rouge → vert |
| --- | --- | --- | --- |
| 1 — export sans les séances ouvertes | `exportableSql` reprenait `publishWhen` (exportabilité = publication) ; le parseur refusait `ended_at` nul | l'archive contient la séance ouverte et ses séries (`ended_at` nul) ; à l'import elles sont écrites sans horloge de champ ni file (la clôture les publie, D-27) ; règles D-85 | `473d955e` → `e29ce493` |
| 2 — « Remplacer » avec une archive vide du schéma 9 | l'absence de la clé `training` valait « archive ancienne » | une archive de schéma ≥ 5 (avant, l'exporteur écrivait `training` sans toujours la clé : schéma 4) sans clé `training` vaut tables vides ; schéma ≤ 4 ou sans version : rien n'est supprimé ; `TABLE_SINCE_SV` toujours respecté. Le test utilise `buildExportArchive` puis `parseExportArchive` | `e04cf7cf` → `2058015b` |
| 3 — cible active changée par l'import | l'ordre des décisions (HLC) n'était pas dans l'archive, l'import réattribuait des HLC par identifiant | clé d'archive `decided_at` (= `created_at` de la décision, hors catalogue de synchro, **sans migration**) ; l'import écrit les décisions dans cet ordre, avec `created_at` d'origine ; en fusion, une décision acceptée plus ancienne que la dernière décision locale n'est pas réintroduite. Une archive sans `decided_at` s'importe comme avant | `1a015ccb` → `a5676355` |
| 4 — relecture de Nutrition en échec silencieux | les deux chemins d'erreur gardaient `ready` sans signal | état `stale` : valeurs gardées, bandeau « Ces valeurs sont peut-être périmées : la relecture de Nutrition a échoué. » + Réessayer ; effacé au premier succès ; événement journalisé `nutrition-reload-failed` (scope `nutrition`) | `27705f25` → `bdaf4c7f` |
| 6 — multiplicateur de position jamais branché | utilitaire non appelé (« application en I3 » oubliée) | `positionRanks` (rang parmi les exercices du même muscle principal, séance active) ; `prescribe` applique `m(rang) / m(rang de la séance de référence)`, jamais une hausse ; raison `position-discount`, phrase « −x kg (−y %) : 2ᵉ exercice de ce muscle… » ou note ; autres muscles inchangés ; décision d'Ali, « à saisir » non modulés | `4ff2aaee`, `edec295f` → `86b13284` |
| 7 — nom d'ingrédient trop long | instantané 200 (`ENTRY_NAME_MAX`), dépôt 120, aucune validation de domaine | une seule borne `RECIPE_INGREDIENT_NAME_MAX = 120` (instantané rogné, validation `ingredient-name-too-long`, dépôt, archive). **Écart à la demande (200)** : le `CHECK (length(name) BETWEEN 1 AND 120)` de `recipe_ingredient` (migration 0009) ne se change que par une migration, que la consigne demande d'éviter ; 120 est donc la borne sans migration. Test à la limite exacte (120 accepté, 121 refusé) en domaine et en base | `c11fa53e` → `40ef34b2` |
| 8 — doublons du mode Guidé | D-73 non validé par Ali | **décision d'Ali du 9 novembre : D-86** ; test du générateur sur la séance finale (vert d'emblée, aucun code : le comportement est celui voulu) ; le chapitre 12 du PRD n'est pas modifié (le test prd-split n'accepte que les corrections D-47/48/49/58/59), D-86 le précise | `9d8d0fca` |
| 9 — pesées Raccourcis de deux jours fusionnées | dédoublonnage sur le jour écrit dans le fichier, enregistrement sur le jour local | `parseShortcutWeights(text, today, timeZone)` : jour = jour local de l'appareil (celui de `saveHealth`) ; deux instants du rapport (`+09:00` et `-08:00`) = deux jours à Paris ; passage à l'heure d'hiver du 25 octobre 2026 ; pesée du lendemain local refusée | `e967df79` → `95c1b008` |
| 10 — preuves rouges de #56 et #84 | tests livrés avec le code | historique non réécrit ; tests de non-régression ajoutés (Dégressive / Partielle) et rejeu sur les commits parents (section suivante) | — |
| 5 — historiques machine par profil de salle | — | **reporté** : Ali ne s'entraîne qu'à Fitness Park Antony. Condition de reprise : un second profil de salle utilisé (même exercice machine dans deux salles) | — |
| Point 7 du rapport 0.9.2 — 1RM sans le poids du corps | le moteur estimait le 1RM sur le seul lest | `BodyLoad` (poids de corps × `bodyweightFraction` ± lest, signe −1 pour l'assistance) dans `analyzeHistory`, le plafond +10 % et la qualité de série ; poids de corps = dernière tendance de poids (sinon dernière pesée) ; lest nul accepté (traction au poids du corps) ; sans pesée : comportement d'avant et phrase « Poids de corps inconnu… » ; la charge saisie et affichée reste le lest. Catalogue : `pull-up-weighted` fraction 1, `push-up-weighted` 0,64 (approximations usuelles, à ajuster par Ali) | `df6b9e0f` → `ac21d9fb` |

Limites assumées (point 7) : une traction assistée du catalogue (`pull-up-assisted`, métrique `bodyweight-reps`) reste « hors moteur » comme avant ; le calcul assisté (signe −1) est testé dans le domaine et prêt quand la métrique sera prise en charge. Les dips du catalogue sont aussi `bodyweight-reps` : le test de dips porte sur un exercice lesté `load-reps` (personnalisé, fraction 0,95).

## Preuve rouge de #56 et #84 (constat 10)

Méthode : worktree jetable (`git worktree add --detach .codex-tmp/wt-<commit> <commit>^`, `node_modules` en jonction, rien poussé depuis ces worktrees, supprimés ensuite), fichiers de tests copiés depuis le commit de la correction (`git show <commit>:<fichier>`), exécutés par Vitest sur le code d'AVANT.

| Correction | Parent rejoué | Tests rejoués | Résultat sur l'ancien code |
| --- | --- | --- | --- |
| #56 « Enregistrer la routine » revient à la liste (`8cee6024`) | `8cee6024^` | `TrainingScreen.test.tsx` | **2 échecs** (le formulaire reste affiché : `expected <input> to be null`) ; 10 autres verts |
| #56 types de série Normale / Échauffement / Dégressive / Partielle (`2b4e6e30`) | `2b4e6e30^` | `SessionScreen.test.tsx` | **1 échec** (options `['Travail', 'Échauffement']` au lieu de `['Normale', 'Échauffement', 'Dégressive', 'Partielle']`) ; 23 autres verts |
| #84 0.7.1, points 1 à 10 (`7ad292a1`) | `7ad292a1^` | `trendLearning`, `firstCheckIn`, `model`, `dayOrdinal`, `DateField`, `SegmentedControl`, `layoutRules`, `TodayScreen`, `NutritionScreen` | **15 tests en échec + 2 fichiers qui ne se chargent pas** (modules `trendLearning` et `firstCheckIn` absents) ; 57 verts : points 1, 2, 3, 4, 5 (garde CSS), 6, 7, 8, 9, 10 couverts |

Les e2e `tests/e2e/V0-7-1-mise-en-page.spec.ts` et les captures ne sont pas rejoués en local (règle du dépôt : CI seulement). Non-régression ajoutée : `SessionScreen.test.tsx` « REV-01 constat 10 » (Dégressive et Partielle depuis une série normale, puis retour à Normale).

## Décisions

- **D-85** : séances ouvertes dans l'archive et ordre des décisions de cible (point 6 : instant de décision). Choix prudents de l'agent, révisables par Ali : séance importée **close à son dernier instant connu** quand une autre est déjà ouverte ici (sans série validée : mise de côté) ; jamais de suppression ni d'écrasement d'une séance locale ouverte ; jamais de réouverture d'une séance close.
- **D-86** (décision d'Ali du 9 novembre) : mode Guidé, aucune ligne de sa routine retirée.
- **Constat 5 reporté** (voir tableau).

## Ce qu'Ali verra de différent

Charges proposées plus basses au 2ᵉ (−7 %) et 3ᵉ (−12 %) exercice d'un même muscle, avec la phrase ; sur la traction et la pompe lestées, des 1RM et plafonds calculés avec le poids de son corps ; « peut-être périmées » + Réessayer sur Nutrition quand une relecture échoue ; une sauvegarde qui contient aussi la séance en cours.

## Check-list iPhone

1. Séance avec deux exercices de pectoraux : le 2ᵉ affiche « 2ᵉ exercice de ce muscle » et une charge plus basse ; le 1ᵉʳ et un autre muscle non.
2. Traction lestée avec une pesée enregistrée : proposition cohérente (lest, pas le poids du corps) ; sans pesée : phrase « Poids de corps inconnu ».
3. Plus → Export, puis Import sur une base de laboratoire pendant une séance ouverte : la séance reste ouverte, rien n'est publié avant sa clôture.
4. Nutrition : couper puis rétablir la synchro ; en cas d'échec de relecture, bandeau + Réessayer, disparu au succès.
5. Recettes : ajouter un aliment au nom très long, enregistrer.
6. Pesées Raccourcis : importer un fichier contenant deux jours proches ; deux pesées.
7. Onglets Entraînement et Nutrition toujours lisibles (0.9.2).

## Relectures

(à compléter à la clôture : sync-icloud, code-reviewer.)

## Reste

DEP-01 (SQLite ≥ 0.39, revue au 30 novembre, D-84). Constat 5 (second profil de salle). `pull-up-assisted` et dips du catalogue hors moteur (métrique). Compatibilité d'archive : une archive 0.9.3 contenant une séance ouverte est refusée par une app antérieure (mettre les deux appareils à jour).
