# ERGO-01 — ergonomie et esthétique (0.19.0)

Ticket L (400 k tokens). Branche `ERGO-01-ergonomie`, partie d'origin/main `f9b99c0f` (0.18.2). Décision d'Ali du 13/11 : le chantier ergonomie commence ; volet esthétique validé par Ali le 12/11 sur aperçu (`docs/maquettes/propositions/esthetique-2026-11-12/`, repris par cherry-pick de `a895319d` : commit `92163125`, premier de la branche). Chapitres : 18 (§ 18.1 coquilles, § 18.3 états dégradés, § 18.4 charte, § 18.5 maquettes, § 18.6 accessibilité). Décisions D-190 à D-197. Sans migration (schéma 15 inchangé).

Statut : **code poussé, PR ouverte, non fusionnée** (consigne : ni fusion, ni tag, ni build iOS). Vérifications natives (iPhone, Dynamic Type « Très grand », VoiceOver) : à faire par Ali, section « À vérifier par Ali ».

## 1. Passe product-owner

Périmètre (Given / When / Then) :

- **C1 Séance active** — Given une séance ouverte depuis une routine, When l'écran s'affiche, Then une seule série porte `aria-current="step"` (la première à faire dans l'ordre de la séance), annoncée « Série en cours », en bloc central (fond relevé, liseré bronze, saisie en grands chiffres, « Valider la série » à 56 px), et l'en-tête dit « Exercice n sur N ». When elle est validée, Then la série suivante devient la série en cours.
- **C2 Repos** — Given une série validée qui lance un repos, Then une barre `role="progressbar"` nommée « Repos » porte `aria-valuemin` 0, `aria-valuemax` = durée lancée (prolongations comprises), `aria-valuenow` = secondes écoulées et `aria-valuetext` « m:ss restantes », recalculée depuis la date de fin persistée.
- **C3 Chiffre héros** — Aujourd'hui (Nutrition : kcal restantes ; Séance ouverte : « 3 / 12 » séries), Journal et Dashboard (kcal restantes), Récupération (cadran Recovery agrandi, toute la ligne), Résumé (trois chiffres bronze), Programme (semaine du mésocycle en capitales) : un chiffre par bloc, unité à part, texte complet de la ligne inchangé.
- **C4 Moins de cartes** — Nutrition d'Aujourd'hui à plat ; Pas fusionnés dans le bloc Récupération ; chiffres du Résumé à plat.
- **C5 Un tap gagné** — Given un résumé de récupération périmé sur l'iPhone, Then « Ouvrir Apple Santé » est proposé dans la carte (import Santé : 3 taps → 2).
- **C6 44 pt** — « Annuler » du bandeau d'annulation et pastilles de jours (onboarding) au jeton `--ct-hit-target-min`.
- **C7 Message vrai** — Progrès ne dit plus « Cette section arrive avec une prochaine version » au-dessus de Récupération et Corps.
- **C8 Bundle** — départ non augmenté ; `start-modules.json` inchangé ; tokens seulement, aucun jeton nouveau.
- **Hors périmètre (structurel, D)** : onglets, navigation, nouvel écran d'accueil, regroupements → propositions P1 à P5 (§ 4), rien d'implémenté.

Hypothèses : aucune H-n touchée (présentation seule ; aucune donnée, aucune capacité native nouvelle).

## 2. Audit (partie A)

Captures : artefact `visual-pairs` du run Tests `43343218983` (main, 0.18.2, 13/11), téléchargé sous `.codex-tmp/visual-main/` (non suivi). Chemins cités : nom du fichier dans l'artefact. Limite : le job visual ne capture que des états de première ouverture (Aujourd'hui vide, Plus, Entraînement, Nutrition dashboard, onboarding) ; séance active, Journal rempli, Récupération et Progrès ne sont pas capturés : leur audit vient du code et des tests DOM (D-195).

### Taps des 6 parcours clés (iPhone 440 px ; PC identique, clavier en plus)

| Parcours | Avant (0.18.2) | Après (0.19.0) | Proposition |
| --- | --- | --- | --- |
| Démarrer la séance du jour | 2 (Aujourd'hui « Commencer une séance » → « Démarrer « Haut A » ») ; 3 par « Proposer une séance » → « Lancer » | 2 | P1 → 1 |
| Valider une série | 1 (« Valider la série », champs pré-remplis ; PC : Entrée) après recherche visuelle de la bonne ligne | 1, série en cours en bloc central, bouton 56 px | — |
| Changer une charge | 2 taps + saisie (champ, clavier, valeur) | 2 + saisie (champ agrandi, centré) | P3 → 1 par cran |
| Ajouter un repas | 4 (« Ouvrir le journal » → « Rechercher un aliment » → aliment → « Ajouter ») | 4 | P2 → 3 |
| Voir la récupération du jour | 0 (Aujourd'hui, sous Séance et Nutrition, défilement) | 0, cadran Recovery agrandi | P4 (en tête) |
| Lancer un import Santé | 3 (Plus → Apple Santé → importer) | 2 quand le résumé est périmé (Aujourd'hui → « Ouvrir Apple Santé » → importer) ; 3 sinon | — |

### Frictions classées (gravité × fréquence d'usage)

G = gravité (1 bloque ou trompe, 2 ralentit, 3 gêne), F = fréquence (quotidienne, par séance, hebdomadaire, rare). Coût : S < 1 h, M < 1/2 j, L > 1/2 j. « Fait » = corrigé dans ce ticket (non structurel).

| # | G | F | Écran (capture) | Friction | Proposition | Coût | État |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F1 | 2 | par série | Séance active (non capturée ; Seance-avant.dc.html) | Toutes les séries ont le même poids visuel : il faut chercher la ligne à valider, bouton Valider de 48 px en bout de ligne | Série en cours en bloc central, `aria-current`, Valider pleine largeur 56 px | M | Fait (C1) |
| F2 | 2 | par série | Séance active, barre de repos | Le repos n'est qu'un nombre ; aucune idée de la part écoulée, rien pour un lecteur d'écran (timer `aria-live="off"`) | Barre de progression `progressbar` avec valeurs aria | S | Fait (C2) |
| F3 | 2 | par séance | Séance active, en-tête | Aucune position dans la séance (exercice n sur N) | « Exercice n sur N » sous le chrono | S | Fait (C1) |
| F4 | 1 | rare (périmé) | Progrès (non capturé ; `SectionNotice.tsx`) | « Cette section arrive avec une prochaine version. Rien n'est affiché ni enregistré ici » au-dessus de Récupération et Corps, qui affichent et enregistrent : message faux | Message retiré sous Progrès | S | Fait (C7, D-193) |
| F5 | 2 | quotidienne | Aujourd'hui (`Aujourdhui-app.png`, `PC-Aujourdhui-app.png`) | Chaque bloc est une carte bordée de même poids ; aucun chiffre ne ressort (« 1 190 kcal restantes » en texte courant) | Chiffre héros par bloc, Nutrition à plat | M | Fait (C3, C4) |
| F6 | 2 | quotidienne | Journal et Dashboard (`Nutrition-dashboard-app.png`) | Calories restantes en texte 22 px comme le reste | Chiffre héros bronze, unité à part | S | Fait (C3) |
| F7 | 3 | quotidienne | Récupération (non capturée) | Trois cadrans de même taille + carte Pas séparée : la Recovery ne domine pas, une carte de trop | Recovery héros 148 px sur toute la ligne, Pas dans le même bloc | S | Fait (C3, C4) |
| F8 | 2 | hebdomadaire | Récupération périmée (iPhone) | « Dernier import il y a n jours » sans action : il faut passer par Plus | « Ouvrir Apple Santé » dans la carte | S | Fait (C5) |
| F9 | 2 | par annulation | Bandeau « Annuler » (`Toast.css`) | Bouton de 34 px sur l'iPhone, sous les 44 pt | Jeton `--ct-hit-target-min` | S | Fait (C6) |
| F10 | 3 | rare | Onboarding 4 (`Onboarding-4-disponibilite-app.png`) | Pastilles de jours à 40 px | 44 px par le jeton | S | Fait (C6) |
| F11 | 3 | par séance | Résumé (Resume-apres.dc.html) | Chiffres dans une carte de plus | À plat, bronze | S | Fait (C3, C4) |
| F12 | 3 | hebdomadaire | Programme (Programme-apres.dc.html) | « semaine 2 sur 5 » en texte courant | Ligne de tête en capitales | S | Fait (C3) |
| F13 | 2 | par séance | Aujourd'hui et Entraînement (`Aujourdhui-app.png`, `Entrainement-routines-app.png`) | « Séance du jour » absente : la carte ne dit ni le jour ni les charges ; 2 taps pour démarrer | Carte « Séance du jour » avec « Lancer » | L | Proposition P1 |
| F14 | 2 | quotidienne | Aujourd'hui → Journal | Ajouter un repas passe par le Journal puis « Rechercher » | « Ajouter un repas » ouvre la recherche | M | Proposition P2 |
| F15 | 2 | par série | Séance active | Changer la charge impose le clavier | « − / + » au cran du matériel | M | Proposition P3 |
| F16 | 3 | quotidienne | PC Aujourd'hui (`PC-Aujourdhui-app.png`) | Trois cartes Profil / iPhone / Données à droite, faites de tirets ; Récupération en 4e position | Une carte « État », Récupération en tête | M | Proposition P4 |
| F17 | 3 | rare | Entraînement (`Entrainement-routines-app.png`) | « Journal des séances » en double avec l'onglet « Journal » ; contrôle segmenté coupé à droite (« Journal » tronqué) | Retirer le doublon, onglets sur deux lignes ou défilement annoncé | S | Proposition P5 |
| F18 | 3 | rare | Plus (`Plus-app.png`) | « Tester le minuteur (60 s) » sous « À propos » : outil de test au milieu des réglages | Le déplacer dans Journaux / Diagnostic | S | Proposition P5 |
| F19 | 2 | hebdomadaire | Dashboard (`Nutrition-dashboard-app.png`) | « Balance 7 jours » dessine des barres vides quand aucun jour n'est complet (§ 18.3 : pas de graphique vide) | Masquer le graphique, garder la phrase | S | Backlog (règle d'Ali attendue, D-195) |
| F20 | 3 | quotidienne | Aujourd'hui iPhone (`Aujourdhui-app.png`) | Accueil (3 réglages) + étapes occupent le premier écran ; Séance sous la ligne de flottaison | Accueil replié en une ligne après le premier réglage | M | Backlog (règle d'Ali attendue) |

## 3. Mise en œuvre (parties B et C)

Écrans refaits sans changer la navigation (`src/features/**`, tokens seulement) :

- Séance active (iPhone et PC, même composant) : série en cours, position, repos en barre.
- Aujourd'hui (iPhone et PC) : Nutrition chiffre héros à plat, Séance ouverte chiffre héros, Récupération (héros, Pas fusionnés, tap Santé).
- Journal et Dashboard (iPhone et PC) : calories restantes en chiffre héros.
- Progrès (iPhone et PC) : message faux retiré.
- Programme (iPhone et PC) : semaine en capitales.
- Récupération et Résumé (iPhone) : voir plus haut.

Classes globales `.ct-hero`, `.ct-hero__num`, `.ct-hero__unit` dans `src/ui/theme/figures.css`, importé par `tokens.css` (CSS seul : aucun JavaScript ajouté au départ). Aucun jeton nouveau : bronze (`--ct-color-bronze`, 6,2:1 sur surface en sombre), secondaire, surface relevée.

Bundle de départ (mesure normalisée, `node tests/bundle/measureStart.ts`, build de production) : **avant 194 871 octets**, après : voir § 6 (qa-test). Plafond 358 400. `tests/bundle/start-modules.json` inchangé.

### Règles des autres écrans : en attente (D-195)

Le message d'Ali a été coupé à « Règles pour tous les autres écrans, PC compris : un… ». Rien n'est inventé. Appliqué ailleurs seulement le sans-risque explicite (chiffre héros, moins de cartes) : Programme, Résumé. Attendent ces règles : Plus et ses sous-écrans, Bibliothèque, Matériel, Historique, Fiche exercice, Stratégie, Check-in, Recherche / Scan, Appareils et synchro, Onboarding, Corps (Progrès), Apple Santé, Journaux ; F19, F20.

## 4. Propositions structurelles à valider par Ali (partie D, rien d'implémenté)

Maquettes SVG dans `docs/maquettes/propositions/ergo-01-structure/` :

- **P1** `P1-Aujourdhui-lancer-direct.svg` : carte « Séance du jour » (jour désigné par le programme, charges) et « Lancer la séance » en un tap.
- **P2** `P2-Nutrition-ajout-direct.svg` : « Ajouter un repas » sur Aujourd'hui ouvre le Journal recherche active (nouveau paramètre de route).
- **P3** `P3-Seance-pas-de-charge.svg` : « − / + » sur charge (cran du profil de matériel) et répétitions de la série en cours.
- **P4** `P4-PC-Aujourdhui-regroupement.svg` : PC, Récupération en tête, une carte « État » au lieu de Profil / iPhone / Données.
- **P5** (sans maquette, texte) : Entraînement sans le doublon « Journal des séances » ; « Tester le minuteur » déplacé de Plus vers Journaux.

## 5. Passe ui-design-system (`.claude/agents/ui-design-system.md`)

- Jetons seulement : `figures.css` et les règles ajoutées n'emploient que `--ct-*` ; aucun hexadécimal (garde `noHardCodedColors` verte, test `ergoRules` « ne portent que des jetons »). Aucun jeton nouveau : rien ne manquait (bronze, secondaire, surface relevée, `--ct-hit-target-min`). `tokens.css` ne gagne qu'une ligne `@import './figures.css'` (aucune valeur changée) : contrastes inchangés, `contrast`, `contrastCss`, `charte` verts.
- Charte § 18.4 : le rouge reste un fond (Valider, Lancer), jamais un texte ; le bronze porte les chiffres héros (rôle « scores, charges » de la charte) ; le vert n'est pas employé. Capitales romaines (Cinzel) pour titres et grands chiffres, chiffres tabulaires.
- Écarts à l'aperçu, assumés : la barre de repos garde sa place (barre collante du bas, D-21) et ses deux boutons « +30 s » / « Passer » ; pas de « − / + » sur la charge (P3, structurel) ; Aujourd'hui garde l'ordre Séance, Nutrition, Poids, Récupération (ordre et carte « Séance du jour » : P1 et P4) ; pas de cadran Recovery sur Aujourd'hui PC autre que la carte Récupération existante.
- PC 1 440 px : mêmes composants ; la série en cours y est aussi le bloc central (Valider pleine largeur sous la saisie), la colonne d'Aujourd'hui garde 660 px.
- Verdict : conforme, sous réserve de la relecture humaine des captures `visual-pairs` de la PR (aucun seuil de pixels, D-35).

## 6. Passe accessibility-i18n (`.claude/agents/accessibility-i18n.md`)

- Textes : tous dans `src/i18n` (`fr.training.ts` : `sessionSetsHero`, `sessionSetsUnit`, `sessionCurrentSet`, `sessionExercisePosition`, `restProgressText` ; `fr.nutrition.ts` : `remainingKcalUnit`, `overKcalUnit`), tutoiement sans objet, aucune heure ajoutée (24 h inchangé), aucun point d'exclamation.
- Lecteurs d'écran : série en cours annoncée par `aria-current="step"` et par le texte « Série en cours » (jamais la couleur seule, § 18.6) ; repos : `progressbar` nommé « Repos » avec `aria-valuemin/max/now` et `aria-valuetext` « 2:30 restantes » (le minuteur garde `aria-live="off"` : pas de bavardage chaque seconde) ; chiffre héros : le texte complet de la ligne reste lisible d'un trait (« 1 900 kcal restantes », espace entre les deux éléments).
- Cibles : « Annuler » du bandeau et pastilles de jours ≥ 44 pt par le jeton ; Valider de la série en cours 56 px ; boutons « Ouvrir Apple Santé » au composant `Button` (≥ 44 px).
- Mouvement : seule animation ajoutée, la largeur de la barre de repos (200 ms, § 18.4), neutralisée par `prefers-reduced-motion` (règle globale de `tokens.css`).
- Dynamic Type : tailles en `rem` par les jetons (`heading` 34 px, `heading-sm` 22 px) ; les grands chiffres passent à la ligne (`overflow-wrap: anywhere`, `flex-wrap`) plutôt que d'être tronqués. Non vérifiable sans iPhone : section « À vérifier par Ali ».
- Verdict : conforme.

## 7. Passe qa-test (`.claude/agents/qa-test.md`)

Preuve rouge puis verte, commits séparés :

| Lot | Rouge | Vert |
| --- | --- | --- |
| C1 à C7 (séance, repos, héros, cartes, 44 pt, Progrès) | `1400fc0c` (16 tests rouges sur 23 dans les fichiers neufs, plus les 5 lignes adaptées) | `c6869d19` |
| Série en cours dans un circuit (constat de la passe code-reviewer) | `99417413` | `c0a82e0d` |

Tests (un par critère, nommés ERGO-01) : `src/features/training/session/ErgoSession.test.tsx` (C1, C2, circuit), `src/features/app/ErgoToday.test.tsx` (C3, C4, C5, C7), `src/features/nutrition/ErgoNutrition.test.tsx` (C3 Journal et Dashboard), `src/ui/ergoRules.test.ts` (classes et jetons : héros, plat, 56 px, barre, 44 pt). Tests existants adaptés sans affaiblissement : les cinq assertions « n kcal restantes » lisent désormais le texte complet de la ligne héros (même chaîne exacte) ; `SectionNotice.test.tsx` ne demande plus le message faux pour Progrès (D-193), le nouveau test en exige l'absence.

En local (Vitest ciblé, `--maxWorkers=1`) : 54 fichiers, 600 tests verts (séance, Aujourd'hui, nutrition, récupération, cycle, historique, thème, i18n) ; `tsc --noEmit` et ESLint propres sur les fichiers touchés ; `npm run test:bundle` vert (4 fichiers, 127 tests).

Bundle de départ, mesure normalisée (build de production, `node tests/bundle/measureStart.ts`) : **194 871 octets avant, 194 869 après (−2)** ; brute 194 865 → 194 883 (+18, bruit des hachages, que la mesure normalisée neutralise, BUNDLE-01) ; 40 blocs de départ des deux côtés ; `start-modules.json` inchangé ; plafond 358 400.

Non testé en local (CI seulement) : e2e `pc`, `iphone`, `iphone-webkit`, visual, perf, smoke. Aucune référence d'image à régénérer : le job visual (`tests.yml`, job `visual`) n'archive que des paires app / maquette pour relecture humaine, sans comparaison au pixel ni capture de référence commitée.

## 8. Passe code-reviewer (`.claude/agents/code-reviewer.md`)

Relecture à froid de `git diff origin/main...HEAD`, critère par critère :

- Couches ADR 0001 : rien dans `src/domain` ni `src/db` ; la règle « prochaine série » vient du domaine existant (`resumeState`). Aucune synchro, migration, Swift, workflow ni contenu touchés (pas de relecture sync-icloud requise). `tokens.css` : une ligne d'import, aucune valeur (propriétaire ui-design-system : passe § 5).
- **Constat 1 (corrigé)** : la série en cours était prise dans l'ordre des blocs ; dans un circuit (séries alternées), elle désignait la 2e série du premier exercice au lieu de la 1re du suivant. Test rouge `99417413`, correctif `c0a82e0d` : `resumeState(workout, now).nextSetId` (ordre des positions, § 13.7).
- Constat 2 (sans correctif) : `restElapsed` dépend de `rest.seconds`, relu de la base (`RestTimer.seconds`, prolongations comprises) à la reprise comme au lancement : la barre reste juste après un redémarrage.
- Constat 3 (sans correctif) : la carte Récupération garde la région « Pas » (`aria-label`), titre passé de `h2` à `h3` sous le `h2` « Récupération » : hiérarchie correcte, tests existants verts.
- Sécurité § 22 : aucun appel réseau, aucune donnée corporelle sortante, aucun secret.
- Verdict : **APPROUVÉ** après le correctif du constat 1, sous réserve de la CI verte (e2e, visual relu).

## À vérifier par Ali

- Sur l'iPhone : séance active, la série en cours se voit d'un coup d'œil ; la barre de repos avance ; Dynamic Type « Très grand » sans troncature des grands chiffres (charge, repos, Recovery).
- Sur le PC 1 440 px : mêmes écrans ; captures `visual-pairs` du run de la PR.
