# BILAN-029 — bilan hebdomadaire par règles (lot 0.29.0, IA-0a)

Statut : code et tests verts en local (branche BILAN-029, non poussée, sans PR) ; constats d'Ali à faire. Budget M à L. Modules : training (Progrès), domain-logic ; nutrition et recovery en lecture.
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
  de la dernière semaine COMPLÈTE, et les 6 semaines précédentes sont listées (archivage par recalcul, aucune table ; 7 semaines en tout :
  le journal est relu sur 60 jours, `SNAPSHOT_DAYS`).
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

- Rouge : 603cca60 « BILAN-029 : tests rouges (C-1 à C-7…) » (modules absents : 3 fichiers en échec). Vert : 21b6dee1. QA : commit suivant.
- Tests : `src/domain/review/weeklyReview.test.ts` (24 vecteurs : nominal, donnée absente par thème, pause, programme commencé après,
  records « et N autres », décharge, début de semaine au dimanche, `numbersIn`), `weeklyReview.copies.test.ts` (copies équivalentes à
  weeklyRate.ts et cycleWeek.ts), `src/i18n/weeklyReviewText.test.ts` (phrases, sources, 300 bilans aléatoires : chaque nombre du texte est
  une valeur de ses sources, Markdown), `weeklyReviewText.qa.test.ts`, `src/features/progress/WeeklyReview.test.tsx` et `.qa.test.tsx`
  (base de test : semaine passée, semaine en cours exclue, records, semaines précédentes, dimanche, export, échec de lecture, échec
  d'export dit, retour à la semaine passée, aucune ligne en `sync_outbox`), `tests/bundle/startBundle.test.ts` (bloc à la demande,
  marqueurs hors du départ). Couverture `src/domain/review` : 100 % lignes, 97,75 % branches.
- Typage et eslint propres sur tous les fichiers touchés. Aucune migration, aucune table, `src/sync/**` et `src/domain/sync/**` non touchés.
- Bundle (mesure normalisée) : début 193 879 octets, fin 193 879 octets. Premier essai à 193 923 (+44) : weeklyRate.ts, cycleWeek.ts et
  dayTotals.ts sortaient en blocs partagés listés au préchargement du départ ; corrigé en recopiant les deux petites règles (équivalence
  testée) et en lisant le journal par `loadNutritionSnapshot`.

## Passes

- product-owner : critères C-1 à C-7 ci-dessus.
- training / domain-logic : règle pure, catalogue, carte, export.
- qa-test : accords au singulier, années et 1er du mois, changement d'heure, valeurs non finies, échec d'export, retour, lecture seule.
- code-reviewer (relecture du diff à froid) : aucune écriture en base ni appel réseau ; paramètres des phrases tirés des seules sources ;
  promesses parallèles toutes gérées par `Promise.all` ; aucune couleur en dur (jetons), boutons de semaine à `--ct-hit-target-min`.
  Mineur accepté : les records d'une séance comptent charge et meilleure série séparément (règle du résumé de séance, `personalRecords`).

## Écarts au brief

- Pas de « recommandation » (§ 17.3 « 3 faits, 1 recommandation ») : aucune règle de conseil dans le PRD ; arbitrage d'Ali.
- Export Markdown seul (pas de CSV / JSON du § 17.3) ; archive de 7 semaines (et non 8, borne de l'instantané Nutrition de 60 jours).
- Textes des tests rouges ajustés au vert (point final retiré, gabarit « sessionsPlanned » comparé au texte attendu ; 7 → 6 boutons de
  semaines avec l'archive de 7 semaines) : formulations, sans changement de règle.
- Le repère du cycle d'une semaine passée vient de l'enregistrement actuel du cycle (un cycle clos depuis n'est plus montré).

## Décisions proposées (sans numéro, choix prudents révisables par Ali)

- Bilan hebdomadaire par règles sur l'appareil (D-294, D-410) : sept thèmes (séances, records, volume, poids, nutrition, sommeil, cycle),
  une phrase chacun avec sa source ; « pas assez de données » au lieu de 0 ; sommeil moyen à partir de 3 nuits mesurées ; cible calorique
  citée seulement si elle est unique (pas de cible de repos) ; volume : 3 muscles en tête ; records : 3 exercices nommés.
- Archivage par recalcul, aucune table : une semaine passée peut changer si ses données sont corrigées (le texte n'est pas figé). Figer
  demanderait une table locale non publiée ; non proposé tant qu'Ali ne le demande pas.
- Export : fichier Markdown `spartiate-bilan-AAAA-MM-JJ.md`, feuille de partage du système, sinon téléchargement (comme D-381).

## Constats d'Ali à faire

- iPhone : Progrès › Bilan de la semaine, la semaine passée et une semaine précédente ; « Exporter » ouvre la feuille de partage.
- PC : même carte ; « Exporter » télécharge le fichier Markdown.

## Budget

M à L annoncé ; consommé dans l'enveloppe L (environ 200 k).

## Relecture à froid (code-reviewer, agent distinct)

Verdict initial : à corriger (un bloquant). Une semaine sans pesée dont la dernière pesée tombe la veille du lundi donnait « 0 kg sur la semaine » (fenêtres de `reviewRateKg`, copie de weeklyRate.ts, qui se recouvrent) : variation citée seulement entre deux pesées distinctes (rouge b44494de, vert 0647b196) ; le même défaut du check-in est porté en BL-124. Mineurs consignés : tendance de fin de semaine possiblement issue d'une pesée de la semaine précédente (règle des 7 jours héritée) ; repère de cycle d'une semaine passée tiré de l'état actuel (D-417) ; `revokeObjectURL` au tick suivant à vérifier sur l'iPhone si la feuille de partage est refusée. Numéros : D-416 à D-418, BL-124, BL-125.
