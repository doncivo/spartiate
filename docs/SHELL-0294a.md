# SHELL-0294a — Navigation PC, palette Ctrl+K, barre latérale adaptative, badge du minuteur (lot 0.29.4)

Lot 0.29.4 (docs/LOT-0.29.2.md, docs/LOT-0.29.2-audit.md), registre « coquille, iOS et qualité », première PR. Chapitres : 18.1 (navigation), 18.5 (écrans et
largeurs), 13.3 (minuteur de repos). Décisions d'Ali appliquées : D-480 (C-135), D-448 et D-459 (jamais la disposition iPhone sur PC). Tous les choix
prudents ci-dessous : « Claude (choix prudent) ; révisable par Ali » (D-592 à D-597). Aucune migration, aucune synchro, aucun Rust modifié.

## Passe product-owner (critères Étant donné / quand / alors)

1. C-135, § 18.1 b : étant donné un PC (disposition PC), quand j'appuie sur Ctrl+K, alors une palette s'ouvre (aller à un écran, démarrer la séance du jour,
   ajouter un repas) ; je filtre sans casse ni accents, je choisis aux flèches et à Entrée ou au clic ; Échap ou Ctrl+K la ferme ; sous une fenêtre modale
   Ctrl+K est ignoré ; sur iPhone la palette n'existe pas ; son code et son catalogue de textes ne sont pas dans le bundle de départ.
2. C-135, § 18.5 b : étant donné un PC Windows à n'importe quelle largeur, quand la place manque (1 099 px CSS et moins), alors la barre latérale se replie en
   icônes (noms accessibles conservés) et la disposition reste celle du PC ; au-dessus, elle est dépliée et repliable à la main.
3. BL-161 : étant donné la barre latérale à 1 440 px, alors « SPARTIATE » tient sur une ligne et « Entraînement » est séparé de « Ctrl 2 » d'au moins 12 px.
4. BL-118 : étant donné un repos en cours sur PC, alors le titre de la fenêtre affiche « Repos m:ss · Spartiate », décroît chaque seconde et redevient
   « Spartiate » à l'échéance, à « Passer » et à l'abandon ; si je quitte l'écran de séance, le repos continue et le badge court jusqu'à l'échéance ;
   hors PC rien ne change.
5. BL-136 : étant donné un PC sous 1 024 px CSS (zoom 150 %), alors Progrès › Corps est en une colonne et les sous-écrans de Plus ne débordent pas.

## Passe agent du module (coquille)

Fichiers : `src/features/palette/{CommandPalette.tsx,CommandPalette.css,commands.ts}` (bloc à la demande), `src/i18n/{fr.palette.ts,paletteText.ts,shortcutsUiText.ts}` (catalogues à la
demande), `src/features/app/{navigation.ts,shortcuts.ts,restBadge.ts}`, `src/features/shortcuts/ShortcutsHelp.tsx` (hôte déjà à la demande : monte la palette et enregistre Ctrl+K), `src/ui/TabRail.css`,
`src/platform/desktop/{types,tauriDesktop,testing}.ts`, `src-tauri/capabilities/desktop.json` (permission `core:window:allow-set-title`),
`src/features/training/session/{restTimer.ts,SessionScreen.tsx}` (crochet `onRest`, texte dans `fr.trainingSession.ts`), `tests/e2e/BL-119-zoom-pc.spec.ts`. La liste blanche `tests/bundle/start-modules.json`
a perdu une ligne (`src/i18n/fr.shortcuts.ts`, sorti du départ, D-596) et n'en a gagné aucune ; le raccourci et la surcouche restent dans des modules déjà du départ.

- Le chapitre 18 du PRD est figé : § 18.1 (Ctrl+K « recherche ») et § 18.5 (rupture à 900 px) sont amendés par D-592 et D-593, pas dans le chapitre.
- `BEYOND_PRD` de `shortcutsHelp.test.ts` et le décompte de `shortcuts.dom.test.tsx` (9 → 10 raccourcis) figeaient l'absence de Ctrl+K (C-135) : réécrits dans
  le commit vert de la palette.

## Passe qa-test (rouge → vert)

| Ligne | SHA rouge | SHA vert |
|---|---|---|
| C-135 palette Ctrl+K (§ 18.1 b) | 0ef7a3e0 | b6051bfd |
| C-135 repli de la barre (§ 18.5 b) | e3e6bd53 | 6d71e080 |
| BL-161 | 2c0beaad | 2a72882a |
| BL-118 | 05df8a0b | 80aabf9d (lint du test : 016a9bf4) |
| Compensation du bundle (D-596) | — | commit « SHELL-0294a : le départ ne grossit plus » |
| BL-136 | — (déjà en une colonne : garde CSS et e2e, pas de rouge local possible) | b6dc7949 |

Preuves : tests ciblés verts (`src/features/palette`, `src/ui`, `src/features/app/desktop*`, `src/platform/desktop`, `restTimer`, `src/features/shortcuts`, `src/i18n`) ;
`npm run typecheck` et eslint propres ; le rouge de la palette est un échec d'import (module absent) et d'assertion de bundle ; les e2e (barre repliée, Corps,
sous-écrans par la palette) ne tournent qu'en CI.

## Écart de preuve rouge (D-597) et relecture à froid

- Le commit aaa9c59e (compensation du bundle, D-596) a **réécrit `src/ui/TabRail.fold.test.tsx`** : supprimés, les trois tests du repli JavaScript (`RAIL_FOLD_MAX_WIDTH_PX` 1 099 et sa requête
  exportée, « 853 px : barre repliée `data-collapsed` », « un redimensionnement replie puis déplie ») ; raison : le repli est passé en CSS seul pour que le bundle de départ ne grossisse pas.
  Remplacés par deux tests de règle CSS et deux tests de disposition. Il a aussi posé trois assertions de bundle (badge, liste des raccourcis ; palette déjà posée) dans le même commit que le code.
- Rouge propre rétabli après coup : `TabRail.fold.test.tsx` lancé contre le `TabRail.css` de 2a72882a (sans requête de repli) échoue sur les deux tests de règle (« 64 px, bouton et carte masqués »,
  « aucune règle de disposition conditionnée par une largeur ») ; vert avec le CSS actuel.
- Relecture à froid : rouge 9ba05f06 (Ctrl+K répété ou en composition, `aria-expanded` / `aria-controls` de la palette ; les tests de focus à l'ouverture, de rendu du focus à l'ouvreur et de continuité
  du badge étaient déjà verts, gardés), vert au commit suivant. Ctrl+K ignore `held` (répétition, composition) ; le titre de repli du badge vient de `app.name`.
- CI : l'e2e BL-119 attendait `data-collapsed` (absent depuis le repli en CSS) ; il lit désormais la largeur calculée de `nav.ct-tab-rail` (64 / 256 px) et celle du premier libellé (masqué ≤ 1 px).

## Mesure du bundle de départ (règle « le départ ne grossit jamais », D-596)

| Étape | Normalisé (octets) |
|---|---|
| main (mesure locale du 25/11) | 181 028 |
| première version de la PR (avant compensation) | 183 333 (+2 305) |
| badge sorti de `desktop.ts` (module `restBadge.ts`, texte dans `fr.trainingSession.ts`) | 181 274 |
| palette montée par l'hôte `ShortcutsHelp`, repli de la barre en CSS | 181 057 |
| catalogue `shortcutsUi` sorti de `fr.ts` (D-583 pour précédent) | **180 733** (marge 177 667 ; main − 295, après la relecture à froid : 180 714 avant) |

Liste blanche : une seule ligne retirée (`src/i18n/fr.shortcuts.ts`, sorti du départ), aucune ajoutée. Assertions « hors du départ » : bloc et texte de la palette, texte du badge, texte de la liste des raccourcis (les deux dernières n'ont pas été vues rouges : les textes étaient dans le départ avant ce commit, mesure 183 333 puis 181 057 ; pas de commit rouge séparé, la correction et l'assertion sont dans le même commit).

## Statuts

| Ligne | Statut |
|---|---|
| C-135, § 18.1 b, § 18.5 b | fait (D-592, D-593) |
| BL-118 | fait en partie (D-594) : titre réel de la fenêtre Windows à constater par Ali (D-36) |
| BL-161 | fait en partie (D-593) : relecture de la paire visuelle au prochain run `visual` |
| BL-136 | fait en partie (D-595) : autres sous-écrans de Réglages, e2e iphone sans agent utilisateur iPhone |

Question ajoutée : Q-32 (« Démarrer la séance du jour » ouvre l'écran de séance ou la crée).
