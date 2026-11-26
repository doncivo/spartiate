# PROG-0301a — Progrès en 6 onglets, sous-onglets de Corps, test « rien ne disparaît » (lot 0.30.1)

Statut : **fait** (CI de la PR ; fusion après la publication de la 0.30.0), branche `PROG-0301a` depuis `origin/main` `5191d828`. Registre « coquille, iOS et qualité » : BL-177.
Décisions d'origine : D-700, D-701 (Ali, 26/11), D-712, D-719 (choix prudents). Chapitres PRD : 17.1, 18 (§ 18.4, § 18.6), 23.1.
Inventaire et table P-01 à P-38 : `docs/PROGRES-0301.md`. Plage de décisions : D-720 à D-729.
Aucune migration, aucune table, aucun fichier de `src/sync/**`, `src/domain/**`, `src/features/training`, `src/features/nutrition`
ni du module santé touché.

## Passe product-owner : critères (étant donné / quand / alors)

1. Étant donné Progrès ouvert (iPhone 440 px et PC), alors une barre `role="tablist"` nommée « Progrès » montre 6 onglets `role="tab"`
   dans cet ordre : Récup, Séances, Bilan, Force, Corps, Activité ; un seul `role="tabpanel"` est rendu, nommé par son onglet
   (`aria-labelledby`), et l'onglet choisi porte `aria-selected="true"` et `aria-controls` vers ce panneau.
2. Étant donné Corps, alors une seconde barre `tablist` « Corps » montre Mesures · Santé · VISBODY · Photos, avec son propre panneau.
3. Clavier (PC et iPhone avec clavier) : un seul arrêt de tabulation par barre (onglet choisi) ; ← et → passent à l'onglet voisin (en
   boucle), Début et Fin au premier et au dernier ; l'activation suit le focus (D-719).
4. Étant donné un onglet et un sous-onglet choisis, quand Ali va dans une autre section puis revient sur Progrès (barre, palette), alors
   ils sont rendus tels quels ; quand Ali appuie sur Progrès (barre du bas, barre latérale ou Ctrl+4) alors que Progrès est déjà
   affiché, alors Progrès revient à Récup et Corps à Mesures (D-719). Mémoire seulement : rien dans `settings`, un redémarrage rouvre Récup.
5. Étant donné chaque onglet, alors ses blocs ne sont importés qu'à son ouverture ; l'hôte des onglets est lui-même un bloc à la
   demande ; `tests/bundle/start-modules.json`, le plafond de 358 400 octets et la mesure normalisée sont inchangés.
6. Règle absolue (D-700) : un test parcourt la liste figée P-01 à P-38 (fermée : mêmes ID que la table de `docs/PROGRES-0301.md`) et
   retrouve chaque élément, par un repère vérifiable (rôle et nom, ou texte du catalogue), dans le `tabpanel` de son onglet et
   sous-onglet, sur le gabarit iPhone et sur le gabarit PC ; les éléments d'une seule plateforme (P-13, P-14 iPhone ; P-15 PC) sont
   absents de l'autre, comme aujourd'hui. Il est rouge avant l'hôte en onglets, vert après.
7. Étant donné un onglet dont le bloc ne se charge pas, alors son panneau affiche « Impossible d'afficher cet écran. » et
   « Réessayer » (P-37) ; les autres onglets restent utilisables.
8. Les tests unitaires et e2e qui supposaient l'enchaînement des 7 blocs (SectionNotice, ErgoToday, BL-119, I6-06, captures)
   ouvrent l'onglet voulu ; aucun test désactivé, allongé ni retardé.

Hors périmètre : contenu des blocs (aucun texte, aucun calcul ni aucune donnée ne change) ; Corps › Mesures enrichi (BL-179) ; rappel
de mesure (BL-180) ; `src/domain/bodyProgress` ; CHANGELOG, version.

Exception annoncée (brief) : découpage de `BodyProgress` strictement nécessaire aux sous-onglets, sans changement de comportement du
rendu complet ; **la PR BL-179 (CORPS-0301c) modifiera `BodyProgress` ensuite et doit partir de ce découpage.**

## Passe agent du module (app-shell, ui-design-system, accessibility-i18n)

- `src/ui/Tabs.tsx` et `Tabs.css` : barre d'onglets (tablist nommée, tabs avec `aria-selected`, `aria-controls` sur l'onglet choisi, un seul
  tabpanel `aria-labelledby`, arrêt de tabulation unique, ← → en boucle, Début, Fin, activation au focus) ; aspect du contrôle segmenté,
  44 pt, tokens seulement, défilement horizontal à 440 px ; importé directement (`../../ui/Tabs`), jamais par le barrel.
- `src/features/app/navigation.ts` : `PROGRESS_TAB_IDS`, `BODY_TAB_IDS`, `progressView` (mémoire seulement) et `setProgressView` ;
  `goToTab('progress')` alors que Progrès est affiché remet Récup et Mesures (barre du bas, barre latérale et Ctrl+4 passent tous par
  `goToTab`) ; `navigate` (palette) garde la vue. `route` inchangée.
- `src/features/app/SectionNoticeProgress.tsx` : hôte des 6 onglets, bloc à la demande ; les quatre blocs déclarés dans SectionNotice
  (Strength Score, Entraînement, Bilan, Suivis) y sont déplacés tels quels ; Activité = Cardio puis Suivis (Notes du matin en dernier, D-712).
  `SectionNotice.tsx` ne garde que le h1 et l'hôte à la demande (le bloc de cette section porte aussi Aujourd'hui).
- `SectionNotice.css` : pleine largeur PC portée par la section Progrès quel que soit l'onglet (P-30) ; dans Corps › Mesures, dès 1 280 px,
  deux colonnes au lieu d'une troisième vide.
- Textes : `src/i18n/fr.progressTabs.ts` (+ `progressTabsText.ts`, traducteur typé `catalogText`), chargé avec l'hôte.
- **Découpage de BodyProgress (exception du brief ; BL-179 part de là)** : prop facultative `part` (`measures`, `health`, `visbody`,
  `photos`) ; sans `part`, DOM et effets inchangés (tests BodyProgress* verts sans retouche). Avec `part` : Mesures = liste PC, mensurations,
  saisie, relevés (grille PC gardée) ; Santé = carte importée, ou sans import le titre, `healthEmpty` et la note (D-720, une clé ajoutée à
  `fr.bodyProgress.ts`) ; VISBODY = `VisbodySection` seule, sans lecture des mesures ni des photos ; Photos = carte photos, seul sous-onglet
  qui demande le bouclier (D-721). L'hôte remonte le bloc à chaque sous-onglet (`key`).
- Tests suivis : `SectionNotice.test.tsx` (blocs ouverts par leur onglet), e2e `I6-06-cardio` (Activité), `BL-119-zoom-pc` (Corps),
  captures `capture.spec.ts` (PC-Corps-1280 ouvre Corps ; contrôle de géométrie sur chaque onglet et chaque sous-onglet).

## Passe qa-test : rouge puis vert

- Rouge `00bcb78f` : `src/ui/Tabs.test.tsx`, `navigation.progress.test.ts` (5 rouges, P-38 compris), `SectionNoticeProgress.inventory.test.tsx`
  (liste figée P-01 à P-38, fermée sur la table de `docs/PROGRES-0301.md` ; iPhone et PC ; absences par plateforme ; états d'échec P-07,
  P-29, P-36), `SectionNoticeProgress.failure.test.tsx` (P-37), `SectionNotice.test.tsx`, garde du bundle : 5 fichiers rouges.
- Vert `083c41bd` : ces 5 fichiers verts (25 tests) ; voisins (`src/features/bodyProgress`, navigation, raccourcis, écrans paresseux,
  ErgoToday, coquille, palette, TrackingFailure, `src/ui`, `src/i18n`) : 85 fichiers, 891 tests verts ; `npm run test:bundle` : 196 verts
  (plafond, mesure normalisée et `start-modules.json` inchangés) ; `npm run typecheck` et eslint propres. Valeurs inventées seulement.
- e2e et captures : CI de la PR.

## Passe code-reviewer (relecture à froid)

Agent code-reviewer distinct, sur le diff 5191d828..083c41bd : **approuvé**, aucun bloquant (100 tests ciblés relancés verts). Remarques
non bloquantes traitées : repères « ailleurs » de P-07, P-29, P-36 retirés (le test « lecture impossible » les prouve) ; aiguille de P-37
renforcée ; module simulé du test P-37 sans trace parasite ; barre d'onglets qui ne fait défiler que sa liste (plus de ).
Noté pour BL-179 : chaque sous-onglet de Corps remonte son bloc et relit ses données ().

## Constats à faire par Ali

Section « 0.30.1 (Progrès en onglets et Mensurations) » de  (BL-177, iPhone et PC). Libellé nouveau : Corps › Santé sans
import, « Aucune valeur importée de Santé pour l’instant. » (D-720).
