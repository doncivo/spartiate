# NUTRI — lissage, imputation affichée, assiette (lot 0.28.1, phase 3)

Chapitre : docs/prd/15-nutrition-adaptative-src-domain-nutrition-i4.md (§ 15.1, § 15.3). Constats : C-036, C-194. Budget M. Branche NUTRI, une PR pour le groupe (D-374).
Périmètre : `src/domain/nutrition` (imputation.ts, plate.ts), `src/features/nutrition/{dashboard,search}`, catalogue `fr.nutrition.ts`. Aucune migration, aucune table publiée touchée, `src/sync/**` non touché. Fixtures synthétiques.

## NUTRI-a — lissage EMA 7 jours (C-036)
Texte du § 15.1 : « Dépense sur N jours (21) : TDEE = … ; lissage EMA demi-vie 7 jours ». Le lissage porte donc sur la DÉPENSE mesurée (pas sur les apports ni le poids).
État : déjà corrigé dans main par FIX-SAISIE-NUTRI (D-357 : `estimateTdeeSmoothed`, `previousSmoothedFor`, pas nul = remplacement). Aucun code modifié ; le chemin emprunté par l'app (`tdeeAt`) et les jours non loggés (jamais 0) sont prouvés par `useCases.nutria.test.ts`. Pas de commit rouge possible (le constat n'existe plus) : un seul commit de preuve.
- Given une dépense mesurée brute et un historique, When `tdeeAt` est appelé, Then la valeur lissée diffère de la brute et se situe entre la précédente et la brute.
- Given des jours non loggés dans l'historique, When le lissage est rejoué, Then ils sont ignorés, jamais comptés à 0 kcal.

## NUTRI-b — imputation affichée avec incertitude (C-194)
Règle (domaine pur, `imputation.ts`) : un jour non complet (absent, sans entrée, partiel) reçoit, À L'AFFICHAGE seulement, la moyenne des jours complets de la fenêtre de 21 jours, ± max(écart type d'échantillon, 5 % de la moyenne), arrondis ; un jour partiel ne descend pas sous ce qui est déjà logué. Moins de 4 jours complets (`minLoggedDays`) : aucune imputation, raison dite. Poids : tendance reportée ± max(0,3 kg, écart quadratique des pesées à la tendance sur 28 j) ; rien avant la 1re pesée ni si la dernière a plus de 7 jours.
Affichage (dashboard) : ligne « Jours estimés, non mesurés (n) : environ X kcal par jour, à ± Y kcal près », barre en tirets (motif, pas seulement la couleur), liste lecteur d'écran « estimé », ligne « poids estimé … ce n'est pas une mesure ». Rien n'est écrit en base, rien n'entre dans la dépense mesurée ni la couverture.
- Given 2 jours non loggés sur la semaine et ≥ 4 jours complets, When le dashboard s'affiche, Then ils sont dits estimés avec la valeur et l'incertitude, les barres chiffrées du journal gardent `null`.
- Given moins de 4 jours complets, When le dashboard s'affiche, Then « pas assez de jours complets… », aucune valeur, jamais 0.
- Given aujourd'hui sans pesée, Then le poids estimé s'affiche avec « ce n'est pas une mesure ».

## NUTRI-c — assiette (§ 15.3)
Le chapitre ne définit « assiette » que par la ligne « Quick Add, recettes, assiette ». Lecture retenue (plus petit usage utile) : composer un repas à plusieurs aliments sans créer de recette, voir le total, puis l'écrire d'un coup. Dans la recherche du Journal : « Ajouter à l'assiette » à l'étape quantité ; carte Assiette (aliments, total, retirer, vider) ; « Ajouter l'assiette au journal » écrit une entrée par aliment (`createMany`, méthode search, provenance conservée, jour affiché, heure par défaut). Total inconnu pour un nutriment si un aliment l'ignore.
- Given deux aliments ajoutés à l'assiette, Then total affiché, aucune entrée écrite ; When confirmation, Then deux entrées.
Reporté : « go-tos » (§ 15.3) non traités ; assiette enregistrable en recette ; modification des grammes dans l'assiette (retirer puis rajouter) ; heure propre à l'assiette ; assiette conservée si on ferme la recherche.

## Décisions proposées (sans numéro)
1. Imputation affichée : moyenne des jours complets sur 21 j ± max(écart type, 5 %), minimum 4 jours complets ; poids = tendance ± max(0,3 kg, dispersion 28 j) ; jamais écrite, jamais dans la dépense (révisable par Ali).
2. « Assiette » = composition multi-aliments écrite en entrées indépendantes à la confirmation (pas de nouvelle table, pas de lien entre les entrées).
3. C-036 clos dans main (D-357) ; aucune persistance de la valeur lissée.
Backlog proposé : « go-tos » du § 15.3 ; assiette → recette.

## Preuves
`imputation.test.ts`, `Imputation.test.tsx`, `plate.test.ts`, `Plate.test.tsx`, `useCases.nutria.test.ts`. tsc et eslint propres ; `unusedKeys.test.ts`, `plural.test.ts`, `src/domain/nutrition` (563 tests) et `src/features/nutrition` + `today` (342 tests) verts.
Bundle de départ (`CI=1 npx vitest run --config vitest.bundle.config.ts tests/bundle/startBundle.test.ts --silent=false`) : origin/main c9059b26 = 45 blocs, normalisé 193956 octets (brut 193996) ; branche NUTRI = 45 blocs, normalisé 193956 octets (brut 193980) : aucun octet de plus. Le commit 1b49bdc0 ne fait que normaliser des espaces dans `Imputation.test.tsx` pour le bundle : aucun effet sur la mesure.

## À faire par Ali (iPhone)
Dashboard : vérifier la lisibilité de la barre en tirets et de la ligne « estimés ». Journal : composer une assiette de deux aliments au pouce, cibles ≥ 44 pt, clavier qui ne masque pas « Ajouter l'assiette au journal ».

## Relecture à froid
Verdict : à corriger, corrigé. Rouge 0cbebc04, vert 90fc2681.
1. Bloquant : clé `barImputed` morte (`unusedKeys.test.ts` rouge) : retirée ; le test lit `barItemImputed`.
2. Le poids estimé n'est plus affiché pendant l'apprentissage de la tendance (moins de 14 pesées), comme la tendance elle-même.
3. Jours partiels : jamais estimés (imputation.ts ignore tout jour qui porte des kcal) ; la ligne ne compte que les jours sans kcal et affiche la moyenne des jours complets ; les partiels restent partiels partout (champ `loggedKcal` supprimé).
4. « logué » unifié dans `fr.nutrition.ts` ; garde du double appui de l'assiette par une ref (`committingPlate`, comme `togglingFavorite`). Limite : `fireEvent` re-rend entre deux clics et le bouton est désactivé, le test de double appui ne distingue donc pas la ref de l'état ; c'est une garde de non-régression.
5. Mesure du bundle ci-dessus ; un worktree temporaire `wt-NUTRI-main` (c9059b26) a servi à mesurer main, à supprimer.
