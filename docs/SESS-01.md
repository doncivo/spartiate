# SESS-01 — séance active complète (lot 0.28.1, phase 3, point 3.1)

Budget L (400 k). Chapitres : § 13.2 (écran), § 13.3 (minuteur), § 13.5 (fin de séance), § 13.8 (mise à jour de la routine), § 11.2–11.3 (cran,
arrondi), § 14.1–14.3 (fiche, alternatives, matériel). Constat : C-190. Base : origin/main c5b44d4d. Aucune donnée réelle ; valeurs synthétiques.
Une branche, une PR (D-374) : un commit rouge puis un commit vert par sous-ticket. Ni `src/sync/**` ni `src/domain/sync/**` touchés.

## Périmètre et critères (product-owner)

### SESS-01a — Remplacer l'exercice en séance

- Given une séance ouverte avec « Développé couché à la barre » (3 séries à faire, plage 6–10, charge saisie 80 kg), When Ali touche « Remplacer »,
  Then la liste propose d'abord les alternatives de la fiche compatibles avec le profil actif (« Développé couché aux haltères »…), puis les exercices du
  même groupe musculaire compatibles, puis une recherche dans la bibliothèque ; un exercice déjà dans la séance ou écarté (01b) n'est pas proposé.
- When il choisit « Développé couché aux haltères » sans historique, Then les séries à faire passent à cet exercice à la même position, même nombre,
  même plage, même repos, et la charge cible est estimée par la règle de conversion (barre → paire d'haltères × 0,75, arrondie au cran inférieur
  du matériel : 80 kg → 2 × 30 kg), dite en texte avec la règle ; une série déjà validée reste à l'exercice d'origine.
- Given le nouvel exercice a un historique clos, Then aucune estimation : la prescription habituelle s'applique.
- Given la séance vient d'une routine, When la case « Remplacer aussi dans la routine » est cochée, Then la ligne du jour de routine change
  d'exercice (même position, séries, plage, repos) dans la même transaction ; sinon la question « Mettre à jour la routine ? » est posée à la fin
  (écart retrait + ajout, mécanisme existant).
- Règle pure (`src/domain/training/replacement.ts`) : vecteurs d'abord ; jamais une charge impossible (cran inférieur de la grille, sinon aucune
  estimation) ; métriques différentes, pattern différent, exercice assisté ou lesté, kettlebell : aucune estimation.

### SESS-01b — « Retirer, ne plus proposer », vignettes réordonnables, « Sauter »

- When Ali choisit « Retirer, ne plus proposer » sur un exercice, Then l'exercice quitte la séance et ne revient plus dans les alternatives ni
  dans la génération de séance ; il peut le rétablir (« Proposer à nouveau »).
- Given plusieurs exercices, Then un bandeau de vignettes (une par exercice ou groupe) se réordonne au glisser (pointeur) et au clavier
  (Alt + flèche) ; les positions sont écrites en base (séance ouverte seulement), un groupe se déplace d'un bloc.
- When Ali touche « Sauter » sur l'exercice en cours, Then il passe en fin de séance (séries gardées, à faire) et l'exercice suivant devient courant.

### SESS-01c — Image et notes, type « Échec », calculateur de disques

- Given un exercice avec média, Then son image s'affiche dans le bloc de l'exercice (à la demande) ; « Notes » déplie les consignes (mise en
  place, exécution, erreurs fréquentes).
- Type de série « Échec » choisissable dans le sélecteur de type ; il est enregistré comme série de travail à RIR 0 (aucune migration).
- Calculateur de disques sur un exercice à la barre : charge totale, barre réglable (barres du profil, sinon 20 kg), disques du profil sinon jeu
  standard ; résultat par côté ; reste non atteignable dit en texte.

### SESS-01d — Fatigue déclarée au démarrage

- Given une séance ouverte, Then « Frais / Normal / Fatigué » est proposé en tête, facultatif, jamais bloquant ; un second appui efface.
- When « Fatigué » est déclaré, Then aucune hausse de charge ce jour-là : une proposition qui montait reste à la charge de référence (arrondie au
  matériel), avec une phrase qui le dit ; « Frais » et « Normal » ne changent rien.

### SESS-01e — Résumé de fin

- Résumé : écart à la prescription par exercice (séries faites / prévues, charge et répétitions faites contre la cible) ; prochaine séance
  (jour suivant de la routine) ; image partageable générée localement (canvas), sans donnée corporelle ; partage par `navigator.share` avec
  fichier si disponible, sinon téléchargement.

### Live Activity étendue

- Plugin `live-activity` présent : la Live Activity du repos annonce l’exercice suivant et sa charge (SESS-01f) ; boutons reportés (fin de fiche).

## Journal des passes

### Passe product-owner

Critères ci-dessus, chapitres § 13.2, 13.3, 13.5, 13.8, 11.2–11.3, 14.1–14.3 ; constat C-190 ; recette du brief (barre → haltères) en test DOM.

### Passe agent du module (training)

- 01a : `src/domain/training/replacement.ts` (candidats, conversion, charge de référence), `REPLACEMENT_LOAD_FACTORS` (config.ts),
  `WorkoutRepository.replaceExercise`, feuille `ReplaceExercise.tsx` (à la demande), bouton « Remplacer » du bloc.
- 01b : `sessionOrder.ts` (unités, déplacement, « Sauter »), `exclusions.ts` (réglage local `training.excludedExercises`),
  `WorkoutRepository.reorderSets`, `SessionStrip.tsx`, `GenerationProgram.excludedExerciseIds` (raison `excluded`, textes de la séance
  proposée), « Retirer, ne plus proposer » et « Proposer à nouveau » (feuille de remplacement).
- 01c : `ExerciseExtras.tsx` (notes, calculateur), image par `ExerciseMedia` (à la demande), `failureSet.ts` (Échec = travail + RIR 0),
  `plates.ts` (recherche exacte), `STANDARD_PLATES_KG`.
- 01d : `declaredFatigue.ts`, raison `declared-fatigue` (dernière de `REASON_ORDER`), phrase `explainDeclaredFatigue`, `DeclaredFatigueBar.tsx`,
  réglage local `training.declaredFatigue` (effacé par « Repartir de zéro »).
- 01e : `summaryGap.ts`, `summaryShare.ts` (canvas, partage ou téléchargement), résumé : écart, prochaine séance, « Partager l'image ».
- 01f (Live Activity) : libellé du repos « Repos · ensuite : <exercice>, <charge> » (plugin existant, aucun changement Swift).

Aucune migration ; aucune table publiée modifiée ; ni `src/sync/**` ni `src/domain/sync/**` touchés ; deux réglages LOCAUX ajoutés
(`settings` n'est pas publié, D-55) ; export / import inchangés (les réglages ajoutés ne sont pas dans la liste blanche de D-57).
Bundle de départ : aucun module ajouté au départ (tout est dans les blocs de la séance, déjà à la demande ; garde non relancée en local).

## Décisions proposées (numéros à donner par l'appelant)

1. **Conversion de charge au remplacement (SESS-01a).** Exercice remplacé en séance par un exercice SANS historique clos, même métrique
   « charge × répétitions », même pattern, ni lesté ni assisté : charge totale de l'exercice remplacé (deux haltères comptés) × facteur prudent,
   barre → paire d'haltères 0,75 ; haltères → barre 1 ; barre, haltères ↔ machine (charges guidées ou poulie) 0,6 ; puis charge par unité du
   nouvel exercice arrondie au cran INFÉRIEUR de sa grille (sans grille : 2,5 kg vers le bas) ; sous la plus petite charge : aucune estimation.
   Même matériel, kettlebell, poids du corps : aucune estimation (« à saisir »). Référence : dernière série de travail validée, sinon charge
   saisie, sinon cible. Facteurs dans `REPLACEMENT_LOAD_FACTORS` (config.ts), révisables par Ali ; l'estimation est dite avec sa règle.
2. **« Retirer, ne plus proposer » local à l'appareil (SESS-01b).** Liste dans le réglage local `training.excludedExercises` (non publié,
   conservé par « Repartir de zéro », hors export) : l'iPhone et le PC ont chacun la leur. La rendre commune demanderait une colonne ou une
   table publiée (catalogue de synchro, D-26) : à trancher par Ali, sinon reste locale.
3. **« Sauter » = l'exercice (ou son groupe) passe en fin de séance**, séries gardées à faire ; aucune série n'est marquée sautée (aucune
   colonne). Un exercice jamais repris reste « à faire » à la clôture (question existante « séries prévues restent à faire »).
4. **Série « Échec » = série de travail à RIR 0 (SESS-01c)** : pas de nouveau `set_kind` (la contrainte CHECK de 0003 exigerait une
   reconstruction de la table publiée `workout_set`) ; une série de travail saisie avec RIR 0 s'affiche « Échec ». Le moteur la lit déjà
   comme menée à l'échec.
5. **Fatigue déclarée (SESS-01d)** : facultative, locale à la séance (réglage `training.declaredFatigue`, non publié) ; seul « Fatigué » agit :
   aucune HAUSSE de charge ce jour-là (charge de référence arrondie au cran inférieur du matériel actif, répétitions de la référence ; assisté :
   assistance gardée) ; jamais de baisse imposée ; raison `declared-fatigue`, phrase dédiée. « Frais » et « Normal » ne changent rien.
6. **Image partageable (SESS-01e)** : PNG 1080 × 1080 dessiné localement (canvas), nom, date, durée, séries, volume, 4 records au plus ;
   aucune donnée corporelle ; feuille de partage du système si elle accepte un fichier, sinon téléchargement ; aucun envoi réseau.
7. **Live Activity étendue (SESS-01f)** : l'exercice suivant et sa charge passent dans le libellé existant (« Repos · ensuite : Rowing à la
   barre, 60 kg », 80 caractères), sans changement Swift. Boutons « +30 s » et « Passer » DANS la Live Activity : reportés (App Intents
   `LiveActivityIntent` dans l'extension et retour vers la date de fin persistée : périmètre ios-mobile, essai sur l'iPhone requis).

## Commits (rouge puis vert, D-374)

| Sous-ticket | Rouge | Vert |
| --- | --- | --- |
| 01a Remplacer | bbdbe307 | 1ee65c7e |
| 01b Vignettes, Sauter, ne plus proposer | c0118ee3 | 9c70a857 |
| 01c Image, notes, Échec, disques | 4139a123 | 1425cfe9 |
| 01d Fatigue déclarée | 1d33362e | 9bb29b63 |
| 01e Résumé : écart, prochaine séance, image | 54ef33bf | 431468c4 |
| 01f Live Activity (exercice suivant, charge) | 28a9514d | 2d5c2bd1 |
| qa-test (focus, choix successifs) | decdcfdb | 8f1e139c |

Écarts de méthode : le vert de 01a ajuste son test DOM (libellé du champ par la clé de catalogue `sessionLoad`, attente de l'estimation
avant « Remplacer ») ; le vert de 01c réécrit le test qui figeait C-190 (liste des types de série de `SessionScreen.test.tsx`, « Échec » ajouté)
et ajoute « Échec » à l'aide d'une ligne des types. Le test « jamais bloquant » de 01d était vert dès le rouge (garde de non-régression).

## Passe qa-test

- Cas couverts : série validée gardée à l'exercice d'origine, échauffement de l'ancien exercice retiré, refus (déjà présent, rien à faire,
  close, absente, hors bornes) sans écriture ; groupe déplacé d'un bloc ; « Sauter » d'un dernier exercice ou sans série à faire : rien ;
  valeur de réglage illisible : aucun exercice écarté, aucune fatigue ; fatigue d'une autre séance ignorée ; assisté (assistance gardée) ;
  référence hors grille (cran inférieur) ; disques : recherche exacte, reste dit, sous la barre ; canvas indisponible ; partage annulé ou refusé.
- Défauts trouvés et corrigés (rouge decdcfdb, vert 8f1e139c) : (1) après un déplacement de vignette, le focus revenait à la vignette à chaque
  re-rendu (chrono : chaque seconde) et volait la saisie ; (2) dans « Remplacer », la lecture d'historique tardive d'un premier choix écrasait
  l'estimation du choix courant.
- `RedDay.test.tsx` (« Recovery 20 ») a échoué une fois sous charge (suite large à 2 workers), vert seul et en combinaison (2 relances) :
  instabilité de temps sous charge, à surveiller en CI ; aucune cause trouvée dans le diff (aucun test modifié).

## Passe code-reviewer (relecture à froid du diff)

- Couches respectées : règles dans `src/domain/training` (remplacement, ordre, exclusions, Échec, disques, fatigue, écart), accès base par
  les repositories, textes dans `src/i18n/fr.trainingSession.ts` (catalogue chargé avec les blocs de la séance), jetons de couleur seulement.
- Aucune charge impossible : estimation et maintien « Fatigué » au cran de la grille du profil actif, sinon aucune valeur.
- Rien de publié avant la clôture : `replaceExercise` et `reorderSets` refusent une séance close ; la ligne de routine n'est écrite que sur la
  case cochée (table déjà publiée, mise à jour ordinaire).
- Limites connues : « Remplacer aussi dans la routine » ne change que la première ligne de l'exercice dans le jour ; « Oui » à « Mettre à jour
  la routine ? » ajoute le remplaçant en fin de jour (mécanisme existant) ; l'historique éditable n'offre pas « Échec » dans son sélecteur ;
  le glisser des vignettes n'est pas testé en jsdom (clavier testé ; glisser à vérifier sur l'iPhone par Ali).
- Approuvé sous réserve de la CI (suite complète, e2e, visual, bundle).

## Constats d'Ali à faire (iPhone)

1. Séance : remplacer « Développé couché à la barre » par « aux haltères » (charge estimée dite, case routine).
2. Glisser une vignette au doigt ; « Sauter » ; « Retirer, ne plus proposer » puis « Proposer à nouveau ».
3. « Fatigué » au démarrage sur un exercice qui devait monter : charge maintenue et phrase.
4. Résumé : écart, prochaine séance, « Partager l'image » (feuille de partage iOS avec l'image).
5. Live Activity pendant un repos : « Repos · ensuite : … » sur l'écran verrouillé et dans la Dynamic Island étendue.

## Reporté

- Boutons « +30 s » et « Passer » dans la Live Activity (App Intents, ios-mobile), action « +30 s » de la notification de repli.
- Exercices écartés communs aux deux appareils (décision 2).
- Pause de séance (§ 13.2 « Pause / abandonner », C-190) : hors des sous-tickets du brief.
