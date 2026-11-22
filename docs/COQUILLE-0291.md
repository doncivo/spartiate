# COQUILLE-0291 — Coquille PC au zoom Windows de 150 %

Lot 0.29.1 (docs/LOT-0.29.1.md), décision d'Ali du 21/11 : BL-119 (D-450), § 18.6 b. Chapitre 18 (navigation, § 18.6 zoom et texte agrandi).
Agents : product-owner, app-shell / desktop-tauri, qa-test, code-reviewer. Aucune migration, aucun fichier de synchro.

## Passe product-owner (critères)

1. Étant donné le PC Windows au zoom de 150 %, quand la largeur effective de la fenêtre passe sous 1 024 px CSS (1 280, 1 366 px
   physiques), alors la disposition reste PC (barre latérale), jamais la barre d'onglets de l'iPhone, et aucune des cinq sections ne
   déborde horizontalement.
2. Étant donné les écrans de 1 280 × 720, 1 366 × 768 et 1 920 × 1 080 physiques à 150 %, alors la fenêtre tient dans la zone de travail
   (taille minimale abaissée, jamais en silence sous le minimum).
3. iPhone et navigateur : rupture de 1 024 px inchangée.

## Décision (à reporter dans docs/decisions.md à la fusion)

- **D-459** (BL-119) : la disposition PC est décidée par le système déclaré au démarrage (`setDesktopLayout(detectOs() === 'windows')`
  dans `src/main.tsx`, la couche ui ne détecte rien) ; sous 1 024 px CSS, marges de la zone centrale resserrées (20 × 24 px). Fenêtre
  minimale abaissée de 1 024 × 700 à **800 × 360** px logiques : à 150 %, 1 024 logiques demandent 1 536 px physiques, plus que l'écran
  de 1 280 ; 360 est la hauteur utile d'un écran de 1 280 × 720 à 150 % (barre des tâches et cadre déduits : 837 × 393). Sous ce
  minimum, `Fit::TooSmall` reste signalé, jamais abaissé en silence. Révisable par Ali.

## Passe agent du module

- `src/ui/useLayout.ts` : `layoutFor(width, isDesktop)`, `setDesktopLayout`, `currentLayout` ; abonnés prévenus au changement.
- `src/main.tsx` : déclaration avant le premier rendu. `src/ui/AppShell.css` : marges sous 1 024 px en disposition PC.
- `src-tauri/tauri.windows.conf.json`, `src-tauri/tauri.conf.json`, `src-tauri/src/window_fit.rs` : minimum 800 × 360.

## Passe qa-test

- Rouge → vert : `905edf32` (src/ui/useLayout.test.ts, tests/desktop/window_fit.rs : constantes, trois écrans à 150 %, zone sous le
  minimum) → commit suivant.
- e2e `tests/e2e/BL-119-zoom-pc.spec.ts` (projet pc, agent utilisateur Windows) : 837 × 393, 895 × 425 et 1 264 × 633 px CSS, cinq sections,
  disposition PC, aucun débordement horizontal (document et zone centrale). CI seulement.
- Local : src/ui/useLayout.test.ts (vert), `cargo test --test desktop window_fit`, `cargo fmt --check`, clippy ; tsc et eslint propres.

## Passe code-reviewer (à froid)

Relecture 1 (agent code-reviewer distinct, lecture seule) : **à corriger**. (1, bloquant probable) le smoke Windows exigeait encore une zone cliente
de 1 024 × 700 ; avec le minimum abaissé, la fenêtre tient dans la zone de travail du runner (1 024 × 768) et y serait plus petite :
smoke aligné sur 800 × 360 et vérifie désormais `data-layout="pc"` dans la vraie WebView2 (preuve de D-450 sur le binaire). Mineurs traités :
commentaires « 1 024 × 700 » et « PC ≥ 1024 px » mis à jour. Mineurs consignés : Progrès › Corps sous 1 024 px en disposition PC passe en
une colonne sans débordement (grille de FIX-0241 seulement dès 1 024 px), sous-écrans (Réglages, Synchro, Corps) non couverts par l'e2e,
projet e2e `iphone` sans agent utilisateur iPhone (sans effet en CI Linux) : BL-136. Contrôlés sans défaut : couches, iPhone et iPad, bundle (aucun
module nouveau), isolement des tests jsdom, calculs des trois écrans.
