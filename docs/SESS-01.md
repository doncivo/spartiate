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

- Voir la section « Live Activity » en fin de fiche (plugin présent).

## Journal des passes
