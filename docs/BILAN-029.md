# BILAN-029 — bilan hebdomadaire par règles (lot 0.29.0, IA-0a)

Statut : en cours (branche BILAN-029, non poussée). Budget M à L. Modules : training (Progrès), domain-logic ; nutrition et recovery en lecture.
Chapitres : PRD § 17.1, § 17.3 (bilans, modèle de secours « fallback template »), § 12.2 (cycle, décharge), § 15.1 (tendance de poids),
§ 16 (sommeil de `recovery_day`), § 18.4 (charte). Décisions : D-294 (aucun fournisseur d'IA), D-410 (lot 0.29.0 : tout par règles, sur
l'appareil), D-381 (partage local du résumé de séance), D-26 (synchro non touchée).

## Passe product-owner : critères

- C-1 (règle pure, faits) — Given les faits d'une semaine complète (séances closes, objectif du programme suivi, pauses, séries validées,
  records des séances closes, pesées, journal alimentaire, cible en vigueur, nuits de `recovery_day`, cycle suivi), When `weeklyReview` est
  appelée, Then elle rend une phrase par thème (séances, records, volume, poids, nutrition, sommeil, cycle), dans cet ordre, et chaque phrase
  porte ses sources (clé de fait + valeur). Déterministe, entrées non modifiées.
- C-2 (aucun chiffre inventé, § 17.3) — Given n'importe quel vecteur, When les phrases sont rendues en texte, Then chaque nombre du texte
  est l'une des valeurs de ses sources mises en forme ; les paramètres du texte ne viennent que des sources.
- C-3 (donnée absente) — Given un thème sans donnée (aucune séance close, aucune pesée dans les 7 jours, aucun jour complet du journal,
  moins de 3 nuits mesurées, aucune série validée), When le bilan est calculé, Then la phrase du thème est « pas assez de données »,
  jamais une valeur 0 ; un 0 n'est écrit que s'il est un fait (0 séance sur 3 prévues, aucun record dans une semaine avec séances).
- C-4 (semaine) — Given le réglage « Début de semaine » (lundi, samedi, dimanche), When Progrès s'ouvre, Then le bilan montré est celui
  de la dernière semaine COMPLÈTE, et les 7 semaines précédentes sont listées (archivage par recalcul, aucune table).
- C-5 (écran) — Given Progrès (iPhone et PC), When la carte « Bilan de la semaine » se charge (bloc à la demande, catalogue de textes
  chargé avec lui), Then chaque phrase s'affiche avec sa source lisible (« 4 séances sur 4 prévues · source : séances closes ») ; choisir
  une semaine précédente l'affiche ; boutons ≥ 44 pt ; jetons de couleur seulement ; échec de lecture : message et « Réessayer ».
- C-6 (export) — Given un bilan affiché, When « Exporter » est touché, Then un fichier Markdown `spartiate-bilan-AAAA-MM-JJ.md` (titre,
  semaine, phrases et sources) part à la feuille de partage du système, sinon est téléchargé ; aucun envoi réseau, aucune API.
- C-7 (bundle) — Given le build, Then l'écran, son catalogue et la règle sont hors du départ (marqueurs et manifeste), et la mesure
  normalisée de fin ne dépasse pas celle du début.

Hors périmètre : la « recommandation » du § 17.3 (une règle de conseil n'est pas dans le PRD : arbitrage d'Ali) ; export CSV / JSON du
bilan (le brief demande texte ou Markdown) ; aucun fournisseur d'IA (D-294).

## Règles retenues (choix prudents, révisables par Ali)

- Séances : faites = séances closes de la semaine ; prévues = objectif du programme suivi dès la semaine de son début ; semaine avec un
  jour de pause : « semaine en pause », pas de « prévues ». Pas assez de données : aucune séance close jusqu'à la fin de la semaine et aucun
  programme suivi.
- Records : records des séances closes de la semaine (`summary`, mêmes règles que le résumé de séance) ; noms des 3 premiers exercices,
  puis « et N autres ». Semaine sans séance : pas assez de données.
- Volume : `weeklyMuscleVolume` sur la semaine seule, 3 muscles en tête.
- Poids : tendance en fin de semaine (`weekTrendKg`, au dixième) et variation sur la semaine (`weeklyRateKg`, au centième) ; sans
  variation calculable, la tendance seule.
- Nutrition : jours complets du journal (`usableForTdee`) de la semaine, moyenne des calories de ces jours ; cible en vigueur en fin de
  semaine seulement si elle est unique (avec cible de repos, la cible n'est pas citée, pour ne pas comparer à la mauvaise).
- Sommeil : moyenne des nuits mesurées (`recovery_day.sleepMinutes`) si au moins 3 nuits ; sinon pas assez de données.
- Cycle : repère du cycle suivi en fin de semaine (`cycleWeekMarker`), « décharge » si semaine de deload ; aucun cycle : « Aucun cycle
  suivi ». Le repère est calculé sur l'enregistrement actuel du cycle (un cycle clos depuis n'est plus montré pour ses semaines passées).

## Preuves

(à compléter : SHA rouge, SHA vert, tests nommés, mesure du bundle)

## Décisions proposées (sans numéro)

(à compléter)

## Constats d'Ali à faire

- iPhone : Progrès › Bilan de la semaine, la semaine passée et une semaine précédente ; « Exporter » ouvre la feuille de partage.
- PC : même carte ; « Exporter » télécharge le fichier Markdown.
