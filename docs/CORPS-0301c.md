# CORPS-0301c — Corps › Mesures : tendance, période, ratios, symétrie, saisie guidée (lot 0.30.1)

Budget L (nutrition et récupération ; ui-design-system, accessibility-i18n). Registre : BL-179 (et l'affichage de BL-181). Décisions lues :
D-700, D-702 à D-709, D-715, D-716, D-718, D-719, D-745 ; ajoutées : D-750 à D-754 (choix prudents). Chapitres : 17.1 (Progrès, ligne
« Corps »), 18 (§ 18.4 charte, § 18.6 accessibilité), 10.2 (profil), 15.1 (tendance des pesées), 23.1 (bundle de départ). Préparation :
docs/PROGRES-0301.md. Domaine pur utilisé tel quel (PROG-0301b) : `zoneTrend`, `ratios`, `ratioReferences`, `symmetry`, `weightEvolution`,
`period`. Aucune table, aucune migration, aucun fichier de synchro, aucun module du domaine modifié.

## Passes

- **product-owner** — Périmètre : `src/features/bodyProgress/**`, `src/i18n/fr.bodyProgress.ts`, `BodyProgress.css`, tests. Hors
  périmètre : rythme des mesures, rappel, settings, notifications, phrases « dernière séance de mesures… / prochaine conseillée… »
  (BL-180, CORPS-0301d), src/sync, migrations, src/domain. Critères :
  1. Given le champ « Mesure (cm) », Then l'unité est insécable et ne rétrécit pas, le champ rétrécit à sa place (D-703).
  2. Given l'iPhone, When Ali touche un point de la silhouette ou une pastille, Then la même zone est choisie des deux côtés, et le point
     et la pastille portent la même tendance (D-704).
  3. Given l'objectif du profil, Then chaque zone est verte (vers l'objectif), orange (à l'inverse) ou grise (stable, pas assez de mesures,
     objectif absent), selon D-716 ; une légende en mots sous la silhouette ; la tendance de la zone choisie est dite en texte (D-705).
  4. Given le PC, Then la liste « Zones · dernière · 4 sem. » garde son radiogroup et ses ↑ ↓, chaque ligne porte une marque et un mot,
     aucune silhouette n'est ajoutée (D-719).
  5. Given la courbe, Then 4 sem. · 3 mois · 6 mois · Tout, 3 mois par défaut, toutes les mesures de la période ; le tour de taille de
     Santé en pointillé sur le tour de taille seulement ; sous la courbe, rythme par mois et évolution du poids, « inconnu » ou
     « en apprentissage » dits, jamais 0 (D-706, D-718).
  6. Given les dernières mesures, Then 4 ratios avec valeur, évolution sur la période et repère D-745 avec sa mention ; hauteur du profil,
     sinon de Santé, dite ; sans hauteur ou mesures trop éloignées, « inconnu », jamais 0 (D-707, D-715, D-745).
  7. Given bras, cuisses, mollets, Then écart en cm et en %, côté le plus grand, signalé au-delà de 2 %, raison dite quand il est inconnu
     (D-708).
  8. Given la saisie guidée, Then 11 zones à la suite, conseil et dernière valeur, Passer n'écrit rien, Suivant enregistre à la date de la
     séance, une mesure déjà saisie à cette date est rappelée puis remplacée, résumé ; la saisie zone par zone reste (D-709, D-719).
  9. Given la liste figée P-01 à P-38, Then elle reste verte (D-700, D-702) ; bundle de départ inchangé.
- **agent du module (ui-design-system, accessibility-i18n)** — Écrits : `BodyZones.tsx` (tendance partagée par silhouette, pastilles et
  liste ; `TrendLegend` ; `trendWords` ; toucher entre les points → zone la plus proche ; courbe sans plafond avec pointillé),
  `bodyZone.ts` (`periodCurveGeometry`, calcul d'affichage), `MeasureInsights.tsx` (rythme, poids, cartes Ratios et Symétrie, mots
  seulement), `GuidedEntry.tsx` (saisie guidée, validation par `validateMeasurement`), `BodyProgress.tsx` (lecture du profil, des pesées,
  des séries de Santé pour Mesures seulement ; période ; montage), `BodyProgress.css` (tokens `--ct-color-ok`, `--ct-color-warn`,
  `--ct-color-text-secondary`, aucune couleur en dur), 97 textes dans `fr.bodyProgress.ts` (catalogue déjà à la demande). Choix non
  tranchés : D-750 à D-754.
- **qa-test** — Rouge `a26aa70c` : 19 tests (un par critère ou sous-critère), tous rouges. Vert `26124613` : module
  (`src/features/bodyProgress`, inventaire P-01 à P-38, SectionNotice, règles CSS, thème) 17 fichiers, 309 tests verts ; `npx tsc --noEmit`,
  `npx eslint src/features/bodyProgress` verts ; `npm run test:bundle` vert (4 fichiers, 196 tests) ; contrôles documentaires
  (`--project node scripts/release/`) 25 fichiers, 291 tests verts. Valeurs inventées seulement (profil, pesées, mesures).
- **code-reviewer** — Relecture à froid par un agent distinct, sur le diff : **approuvé**, aucun bloquant. Remarques traitées : focus au
  résumé et au retour au bouton « Saisie guidée » (6), « Arrêter » inactif pendant un enregistrement (7), pesées lues sans plafond pratique
  pour « Tout » (3, 10 000 au lieu de 400), comparateur des pesées antisymétrique (4) ; test de relecture rouge `0793b63f`, vert `7c6ddb9a`.
  Gardé et consigné : un échec de lecture du profil ou des pesées fait passer le bloc en « Lecture impossible. Réessaie. » (2) ; un repli
  silencieux sur « objectif non renseigné » afficherait un état faux (AGENTS : aucune défaillance silencieuse). Gardé : `curveGeometry`
  (plafond de 12 points), plus appelé par l'écran, encore couvert par `bodyZone.test.ts` (5) : à retirer avec CLEAN-03. Non traité :
  message d'erreur de la saisie guidée non relié au champ par `aria-describedby` (8, `role="alert"` suffit au minimum § 18.6).

## Résultats

- Rouge : `a26aa70c` (19 tests de `BodyProgressMeasures0301c.test.tsx`, tous rouges). Vert : `26124613`. Relecture : rouge `0793b63f`, vert `7c6ddb9a`.
- Écart au rouge, consigné : l'assertion PC « Cou décrit "pas assez de mesures" » est devenue « Cou garde la description de FIX-0241 et
  reste gris » (une zone sans mesure dit déjà « aucune mesure » ; le test existant de FIX-0241 fige cette description exacte ; D-752).
- Test d'inventaire rouge 2 fois sur 5 en local sous charge (17 fichiers ensemble), vert seul : cause probable et correctif dans
  docs/journal.md (2026-11-26) ; aucun délai allongé.
- Constats d'Ali : à faire (docs/constats-ali.md, section 0.30.1, lignes BL-179 et D-703). Hors périmètre, en parallèle : BL-180
  (CORPS-0301d).
- CI, essai 1 (run 45828839184) : rouge, deux gardes de catalogue non lancées en local (src/i18n/plural.test.ts : « {count} pesées » sans variante au singulier ; src/i18n/unusedKeys.test.ts : clés trendGoal_* appelées par un nom construit). Corrigé : weightLearningOne avec tPlural, table GOAL_TEXT ; src/i18n et src/ui verts en local (68 fichiers, 779 tests).
- CI, essai 2 (run 45831813969, commit ead74e5a) : vert, « suite verte » réussie. PR non fusionnée (consigne).
