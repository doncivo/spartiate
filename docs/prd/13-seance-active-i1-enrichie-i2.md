## 13. Séance active (I1, enrichie I2)

**Priorité :** valider une série pré-remplie en une interaction, d'une main, sans réseau, sur l'iPhone ; le même écran existe sur le PC avec saisie clavier.

### 13.1 Démarrage

Aujourd'hui (séance du jour), Entraîner (routine ou vide), Siri / Action button (I6, plugin App Intents). ≤ 3 taps depuis l'écran verrouillé.

### 13.2 Écran

| Zone | Contenu | Interactions |
| --- | --- | --- |
| Titre | Nom, chrono, FC si séance Watch en cours (I5), Finish | Pause / abandonner |
| Bandeau | Vignettes réordonnables | Glisser ; sauter |
| Exercice | Nom, image (vidéo I6), plage cible, précédent, notes | Remplacer ; retirer « ne plus proposer » |
| Séries | Précédent · charge cible · reps cible · RIR · coche ; types Warm-up / Normal / Drop / Failure / Chrono ; supersets | 1 tap ; clavier ou picker ; ajouter / supprimer ; swipe |
| Charge | Tap → « Pourquoi ? » ; calculateur de disques | — |
| Fin d'exercice | Facile / Juste / Dur ignorable ; RIR si activé | — |
| Repos | Barre collante, +30 s, passer ; auto à la validation | — |
| Fatigue déclarée | Frais / Normal / Fatigué au démarrage | — |

### 13.3 Timer

Date de fin persistée (jamais un compteur) ; Live Activity via plugin si `CONFIRMED` (compact anneau + secondes ; étendu exercice suivant, charge, +30 s, passer) ; fallback notification locale programmée (plugin notifications repris, catégorie avec action « +30 s ») ; haptique via plugin `haptics`.

### 13.4 Persistance et interruptions

Chaque série écrite dans SQLite à la validation (repository, transaction) ; reprise après verrouillage, fermeture forcée, redémarrage ; correction d'une série validée tracée. **La séance en cours n'est pas publiée** par la synchro, ni dans les journaux ni dans les instantanés ; la clôture rend publiable l'agrégat complet (`workout` + `workout_set`). Interruption pendant la clôture, réessai, suppression et correction ultérieure d'une séance close sont testés. Ce mécanisme est une adaptation I1 de la synchro (§ 9.1, D-27), non un acquis du catalogue hérité.

### 13.5 Fin de séance

Résumé (durée, séries, volume hors drop / partielles / chrono, PR, écart, prochaine séance) ; image partageable ; écriture Apple Santé (plugin, si `CONFIRMED`) : un `HKWorkout` `traditionalStrengthTraining` avec début, fin, énergie estimée ; **les séries restent dans Spartiate** (`H-3` : l'écriture dépend de l'entitlement HealthKit).

### 13.6 Rattachement d'une séance Watch

Si un `HKWorkout` de force chevauche ≥ 50 % de la séance : lier (UUID stocké), ne pas écrire ; sinon proposer l'écriture. Jamais de double écriture.

### 13.7 Tests

Reprise après 5 séries et fermeture ; timer après verrouillage ; charge impossible jamais affichée ; séance partielle ne pollue pas le 1RM ; refus HealthKit ne bloque rien ; rattachement sans doublon ; séance en cours absente de la synchro, séance terminée présente.

### 13.8 Compléments issus du benchmark (révision 6.1)

| Fonction | Spécification | Référence | Itération |
| --- | --- | --- | --- |
| Calculateur d'échauffement | Pour le premier exercice composé de chaque pattern : rampes 40 % × 8, 60 % × 5, 80 % × 2 de la charge de travail, snappées au matériel, insérées comme séries Warm-up, ignorables ; paramètres dans `config/training.json` | Alpha Progression, Hevy Pro | I2 |
| Démarrer par copie | Lancer une séance en copiant une séance passée (exercices et dernières charges) ; aucune routine créée | Hevy | I1 |
| Mise à jour de la routine | À la fin, si des exercices ont été remplacés / ajoutés / retirés ou le nombre de séries changé : « Mettre à jour la routine ? » (Oui / Cette fois seulement) | Hevy | I1 |
| Historique éditable | Corriger une série passée (charge, reps, type) depuis Historique ; recalcul du 1RM et des records ; correction tracée (`recommendation_decision` conservée) | Alpha Progression | I1 |
| Replay set par set | Timeline de la séance : charge / reps / repos réels face aux cibles, écarts en couleur | uFit AI (inspiration) | I6 |
| Circuits | Enchaînement de 3+ exercices sans repos intermédiaire, repos après le tour ; type de groupe à côté des supersets | Hevy | I6 |
