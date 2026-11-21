# COQUILLE-PC : clic droit, barre latérale rétractable, Dynamic Type (lot 0.28.1, phase 3)

Budget M à L. Chapitres : § 18.1 (gestes PC, barre latérale, minuteur), § 18.6 (accessibilité, Dynamic Type). Constats : C-192, C-113 ;
décision D-372 ; hypothèse H-19a (reste UNVERIFIED, aucune ligne CONFIRMED). Une branche, une PR (D-374). Ni `src/sync/**`, ni migration.
Aucune donnée réelle.

## Périmètre et critères (product-owner)

### COQUILLE-PC-a : menu contextuel et double-clic (PC)
- Composant commun `src/ui/ContextMenu.tsx` (`ContextMenuZone`, chargé par les écrans à la demande, hors du départ) : clic droit, touche
  Menu ou Maj+F10 ouvrent un `role="menu"` nommé ; flèches, Début, Fin, Entrée ; Échap ferme et rend le focus à la ligne ; clic ailleurs ferme.
- Given PC (≥ 1 024 px) et une entrée du journal, When clic droit, Then « Corriger » et « Supprimer » (les mêmes actions que les boutons
  de la ligne, supprimer demande la confirmation habituelle) ; When double-clic, Then la correction s'ouvre.
- Given une séance de l'historique, une routine ou un exercice de la bibliothèque, When clic droit, Then « Ouvrir » (= le clic) ; le
  double-clic ouvre aussi. Ces trois écrans n'ont pas d'autre action de ligne : le menu n'en invente aucune.
- Given iPhone (< 1 024 px), Then aucun effet (menu natif et gestes intacts ; l'appui long reste hors périmètre).
- Textes : `trainingFr.openItem`, `rowActions`, `nutritionFr.entryActions` (catalogues à la demande). Couleurs : jetons uniquement.

### COQUILLE-PC-b : barre latérale rétractable (PC)
- Given PC, When on active le bouton « Barre latérale » (atteignable au clavier, `aria-expanded` dit replié ou déployé), Then la barre passe à 64 px,
  icônes seules ; chaque onglet garde son nom accessible (libellé lu, sans infobulle : retirée pour tenir le bundle) ; la carte d'état est masquée ; le même bouton la rétablit.
  État en mémoire du composant, non persisté (aucune donnée ajoutée). iPhone : pas de bouton.
- Badge du minuteur dans le titre de la fenêtre : REPORTÉ (voir écarts).

### COQUILLE-PC-c : Dynamic Type iOS (§ 18.6, D-372)
- `html { font: -apple-system-body }` sous `@supports (font: -apple-system-body)` (WebKit iOS ; WebView2 l'ignore : `html` garde 100 %).
  Les tailles étant en rem, tout le texte suit le réglage jusqu'à « Très grand ».
- Bouton : `min-height: max(48px, 3rem)` (grandit avec le texte, jamais sous 48 puis 44 px) ; cibles ≥ 44 px gardées (`--ct-hit-target-min`) ;
  `overflow-wrap: anywhere` sur `body` ; colonne et zone centrale en `min-width: 0` : pas de défilement horizontal à 440 px.
- Effet de bord assumé : au réglage par défaut d'iOS (« Large »), le corps vaut 17 px au lieu de 16 px (+ 6 %), noté dans l'ancien test.

## Preuves
- Tests : `src/ui/ContextMenu.test.tsx`, `src/features/nutrition/journal/ContextMenu.test.tsx`, `src/features/training/history/ContextMenu.test.tsx`,
  `src/ui/TabRail.test.tsx`, `src/ui/theme/a11y.test.ts` (règle CSS Dynamic Type).
- SHA : a rouge 9da7a3e5, a vert a487e689 ; b rouge bba7a6d9, b vert 692cf685 ; c rouge 2393e703, c vert 83713a26.
- Bundle de départ (normalisé) : origin/main 193 956 octets, première mesure de la branche 194 130 (+ 174 : bouton de repli
  et deux clés `nav.*` dans la coquille), compensée par 011b44d6 : **193 901 octets** (− 55), plafond 358 400 inchangé, marge 164 499 ; `startModules.test.ts` vert, aucun module ajouté.
  Le menu contextuel n'est importé que par des écrans à la demande.

## Écarts, reporté
- Badge du minuteur dans le titre : exige un état de minuteur accessible à la coquille et la permission fenêtre (`src-tauri/capabilities`,
  hors de ce groupe) ; reporté.
- Capture CI webkit à 440 px « Très grand » : Playwright WebKit (Linux) ne simule ni `-apple-system-body` ni les tailles Dynamic Type ;
  seul le test unitaire de la règle CSS est fourni. Zoom PC 100-150 % : non testé en unitaire (jsdom ne calcule pas la mise en page) ;
  à 150 %, une fenêtre de 1 024 px physiques donne 683 px CSS, sous la rupture : la disposition passe en iPhone. À examiner par Ali.
- Pas d'e2e ni de visual ajoutés (CI seulement).

## Constats à faire par Ali
- PC : clic droit et double-clic sur les quatre listes, Maj+F10, Échap ; repli de la barre latérale.
- iPhone : Réglages > Accessibilité > Taille du texte > « Très grand » : onglets, boutons, charges et minuteur sans troncature ni défilement
  horizontal à 440 px. H-19a reste UNVERIFIED jusque-là.

## Décisions proposées (sans numéro)
1. Menu contextuel PC = composant commun `src/ui/ContextMenu`, jamais une action absente de l'élément ; PC seulement, iPhone inchangé.
2. Dynamic Type par `font: -apple-system-body` sous `@supports` ; accepter le corps de 17 px au réglage par défaut d'iOS.
3. Barre latérale repliée non persistée ; badge du minuteur reporté à un ticket qui possède l'état du minuteur et la permission fenêtre.

## Relecture à froid (code-reviewer, agent distinct)

Verdict initial : à corriger (trois points importants). Compensation du bundle (011b44d6) : un libellé « Barre latérale » porté par `aria-expanded`, chevron unique retourné en CSS, carte masquée en CSS, clés héritées de CircleTasks sans usage retirées de `fr.ts` (`tasks`, `reminders.*` sauf `status`, `detail.createdModified`, `undo.postponeTomorrow`, `undo.moveDate` ; tests ajustés). Corrections (rouge abe1fce8, vert 55edaa0d) : la liste servant aussi de sélecteur (routine, séance, remplacement) dit « Choisir » et non « Ouvrir » ; Échap rend le focus à l'élément d'où le menu est parti (ligne `<li>` non focalisable du journal) ; un double-clic parti d'un bouton de la ligne n'est pas l'action principale ; recalage horizontal à 280 px (largeur maximale du menu). Numéros : D-398 à D-401, BL-118, BL-119.
