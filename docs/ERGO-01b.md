# ERGO-01b — règles visuelles de tous les écrans et propositions P1 à P5 (0.22.1)

Ticket L (400 k tokens). Branche `ERGO-01b-regles-ecrans`, partie d'origin/main `2f6107f5` (0.22.0, schéma 18). Présentation et ergonomie seules, sans migration (schéma 18 inchangé). Décisions : D-240 (règles d'Ali du 13/11, non révisable), D-241 à D-247 ; propositions P1 à P5 validées par Ali le 13/11 (D-238, consignée à part par le coordinateur). Chapitres : 18 (§ 18.4 charte, § 18.6 accessibilité).

Statut : **code poussé, PR ouverte, non fusionnée** (ni tag, ni build iOS).

Point d'étape budget : le complément P1 à P5 est arrivé en cours de ticket ; le budget L est tenu de justesse. Livré : tout le périmètre ci-dessous ; non fait : voir « Non fait ».

## 1. Passe product-owner (`.claude/agents/product-owner.md`)

Given / When / Then :

- **R1 Titre de section** — Given un écran non refait par ERGO-01 (liste de `docs/ERGO-01.md` § 3), When il s'affiche (440 et 1 440 px), Then chaque titre de section porte `.ct-section-title` (petites capitales bronze espacées).
- **R2 Moins de cartes** — Then chaque carte d'écran (`ct-settings__card`, `ct-training__card`, `ct-nutrition__card`, `ct-body__card`, `ct-today__card`, `ct-supplements__*`) est à plat (`.ct-flat` : filet `--ct-line`, 16 px dedans, 24 px entre blocs).
- **R3 Rouge** — Then une seule action rouge (bouton primaire) à l'état initial de chaque écran principal.
- **R4 Héros** — Then un chiffre héros par bloc là où le bloc a un chiffre de tête (Stratégie : cible ; Profil : dernier poids).
- **R5 44 px** — Then tout bouton (Button, lien de ligne de Plus, enregistrer du Profil, onglets PC) mesure 44 px au moins, arrondi.
- **R6 Icônes** — Then toute icône Lucide passe par `Icon` (tailles nommées, trait 1,8), onglets compris.
- **R7 Indicateur** — Then l'onglet actif (iPhone) et l'entrée active (PC) portent `aria-current="page"` et un indicateur bronze.
- **P1** — Given un cycle actif, When Aujourd'hui ou Entraînement s'affiche, Then « Séance du jour » désigne le jour (D-243) et « Lancer la séance » l'ouvre en un tap ; sans cycle, carte d'avant.
- **P2** — When « Ajouter un repas » est touché, Then le Journal s'ouvre recherche active, champ focalisé (3 taps).
- **P3** — Given la série en cours, Then « − / + » change la charge d'un cran du matériel et les répétitions d'une unité, sans clavier.
- **P4** — Given le PC, Then Récupération est en tête et une seule carte « État » remplace Profil, iPhone et Données.
- **P5** — Then la carte Séance n'a plus « Journal des séances » (historique par la section « Journal » d'Entraînement) ; « Tester le minuteur » est dans Plus › Logs.
- Hors périmètre : navigation (onglets, sections), données, synchro.

Hypothèses : aucune H-n touchée.

## 2. Mise en œuvre

Composants partagés (src/ui) : `SectionTitle`, `HeroFigure`, `Rule`, `Icon` (tailles nommées, `iconStyle.ts`) ; classes globales `.ct-section-title`, `.ct-flat`, `.ct-rule`, `.ct-stack` dans `figures.css` ; jetons `--ct-space-section` (24 px) et `--ct-line`. Pose des classes par script (D-51, scripts sous `.codex-tmp/`, non suivis) : 107 titres et 65 cartes dans 50 fichiers, 3 titres posés à la main (Compléments) ; 23 tailles d’icônes converties.

Écrans touchés (iPhone 440 et PC 1 440, mêmes composants) : Plus (iPhone et PC) et ses sous-écrans (Apparence, Profil et poids, Apple Santé, Export / import, Repartir de zéro, Logs, Appareils et synchro, raccourcis), Entraînement (Routines, Bibliothèque, Matériel, Journal, Cardio, départ de séance), Nutrition (Stratégie, Check-in, Recettes, Compléments, Recherche / Scan, Ajout rapide, aliment perso), Progrès (Corps, Cardio, Récupération), Onboarding ; barre d'onglets iPhone et barre latérale PC ; titres d'Aujourd'hui, Journal, Dashboard et Résumé (titres seulement, D-242) ; Aujourd'hui (P1, P2, P4) ; Séance active (P3).

## 3. Taps des 6 parcours clés

| Parcours | 0.19.0 (ERGO-01) | 0.22.1 (ERGO-01b) |
| --- | --- | --- |
| Démarrer la séance du jour | 2 | **1** avec un cycle actif (P1) ; 2 sans |
| Valider une série | 1 | 1 |
| Changer une charge | 2 taps + saisie | **1 tap par cran**, sans clavier (P3) |
| Ajouter un repas | 4 | **3** (P2) |
| Voir la récupération du jour | 0 (défilement) | 0, en tête sur PC (P4) |
| Lancer un import Santé | 2 (résumé périmé) ou 3 | 2 ou 3 |

## 4. Passe ui-design-system (`.claude/agents/ui-design-system.md`)

- Jetons seulement : `figures.css`, `TabRail.css`, `Session.css` (stepper, liste du jour) n'emploient que `--ct-*` (garde `noHardCodedColors` verte, test `ergo01bRules` « aucune couleur en dur »). Deux jetons nouveaux, parce qu'ils manquaient et ne sont pas des couleurs : `--ct-space-section` (24 px ; l'échelle sautait de 20 à 28) et `--ct-line` (filet sur `--ct-color-border`, redéfini en sombre) ; aucune couleur nouvelle, aucune variante sombre à ajouter (D-242).
- Charte § 18.4 : bronze pour titres de section, chiffres héros et indicateurs d'onglet ; rouge seulement en fond du bouton principal (une action rouge par écran, D-246) ; Cinzel pour les chiffres héros (déjà embarquée, D-241).
- Cascade : les classes partagées sont qualifiées par l'élément (`h2.ct-section-title`, `section.ct-flat`) pour l'emporter sur la classe d'écran du même élément ; trois règles d'écran plus spécifiques (titres de Plus iPhone et PC, Synchro) perdent leur typographie (script `titlecss.mjs`).
- PC 1 440 : mêmes composants ; titres de Plus PC passent des capitales romaines 22 px aux petites capitales bronze (règle d'Ali, « PC compris ») ; barre latérale : liseré bronze 3 px, icône active bronze, entrées de 44 px (40 avant).
- Écarts assumés : carte « Séance » gardée en carte (ERGO-01, aperçu) ; titre « Réinitialiser » de Synchro garde son ton de danger ; P1 sans charges ni durée ; P4 garde la carte Poids (D-243, D-245).
- Verdict : conforme, sous réserve de la relecture humaine des captures `visual-pairs` (avant : dernier run Tests de main ; après : run de cette PR ; aucune capture locale, aucune référence à régénérer).

## 5. Passe accessibility-i18n (`.claude/agents/accessibility-i18n.md`)

- Textes : tous dans `src/i18n` (`fr.training.ts` : séance du jour, « − / + » et leurs noms accessibles ; `fr.nutrition.ts` : `targetKcalUnit`, `cardAddMeal` ; `fr.today.ts` : `stateEyebrow` ; `fr.logs.ts` : `toolsOpen`) ; aucun point d'exclamation ; 24 h inchangé.
- Contraste : bronze sur le fond 4,6:1 (clair) et 6,7:1 (sombre), sur la surface 5,2:1 et 6,2:1 ; titres de section jamais posés sur `--ct-color-surface-raised` en clair (4,2:1) : les blocs sont à plat. Indicateur d'onglet : `--ct-color-nav-accent` sur `--ct-color-nav-bg` 6,2:1 (élément graphique ≥ 3:1). Tests `contrast`, `contrastCss`, `charte` verts.
- Jamais la couleur seule : onglet actif = `aria-current="page"` + indicateur ; « − / + » nommés (« Charge : un cran de plus ») ; « Séance du jour » est une région nommée ; « Outils de test » porte `aria-expanded`.
- Cibles : Button `min-height` 44 px par le jeton, liens de ligne de Plus 44 px sur toutes les plateformes (30 px sur PC avant), « Enregistrer » du Profil 44 px (40 avant), onglets PC 44 px, « − / + » 44 × 44.
- Focus : P2 met le focus dans le champ de recherche (`autoFocus` existant) ; anneau de focus des « − / + » au jeton.
- Dynamic Type : tailles en `rem` par les jetons ; non vérifiable sans iPhone (« À vérifier par Ali »).
- Verdict : conforme.

## 6. Passe performance (`.claude/agents/performance.md`)

- Bundle de départ (build de production, `node tests/bundle/measureStart.ts`) : **avant 197 821 octets** (mesure normalisée, origin/main `2f6107f5`), **après 197 814 (−7)** ; brute 197 829 → 197 795 ; 41 blocs de départ des deux côtés ; plafond 358 400 ; `tests/bundle/start-modules.json` inchangé. Les composants neufs (`SectionTitle`, `HeroFigure`, `Rule`, `iconStyle`, `programDay`) et `currentCycle` restent dans des blocs à la demande ; TabIcon garde ses valeurs écrites (aucun module ajouté au départ).
- CSS du départ (non compté par la garde, pour mémoire) : 2 278 → 2 370 octets gzip (+92 : classes partagées et indicateur d'onglet).
- Police Cinzel : déjà embarquée (D-241), latin 600 15 204 octets + latin-ext 8 352 octets woff2, `font-display: swap`, CSS seule : rien d'ajouté.
- Limite locale : `@tauri-apps/plugin-geolocation` manque dans les node_modules de ce poste (la CI fait `npm ci`) ; les deux builds de mesure l'ont remplacé par un module vide (chargé à la demande par le cardio GPS seulement, jamais au départ) ; `npm run test:bundle` n'a pas tourné en local, il tourne en CI.
- Carte « Séance du jour » : deux lectures de plus (cycle courant, routine et 50 séances closes) à l'ouverture d'Aujourd'hui, seulement sans séance ouverte ; bloc déjà à la demande.

## 7. Passe qa-test (`.claude/agents/qa-test.md`)

Preuve rouge puis verte, commits séparés :

| Lot | Rouge | Vert |
| --- | --- | --- |
| A : composants partagés, onglets, icônes, 44 px | `7eb36593` | `ade3c62e` |
| B : règles sur les écrans (440 et 1 440 px) | `82e9dab4` | `f0f0f019` |
| P1 à P5 (D-238) | `16f56a8b` (17 tests rouges sur 32, preuve par mise de côté de l'implémentation) | `b9e74533` |

Tests : `src/ui/ErgoShared.test.tsx`, `src/ui/ergo01bRules.test.ts`, `src/features/ErgoScreens.test.tsx` (36 cas : 17 écrans × 2 largeurs, héros), `src/domain/training/programDay.test.ts`, `src/features/training/session/ErgoP1.test.tsx`, `src/features/nutrition/ErgoP2.test.tsx`, `src/features/training/session/ErgoP3.test.tsx`, `src/features/ErgoP5.test.tsx`, P4 dans `TodayScreen.test.tsx`.

Tests existants changés, sans affaiblissement, chacun dit dans son commit : `Icon.test.tsx` (taille et trait libres remplacés par l'échelle nommée, règle d'Ali) ; `TodayScreen.test.tsx` PC (carte « État » au lieu de Profil, iPhone, Données ; mêmes « — », aucun faux zéro) ; `History.test.tsx` (« Aujourd'hui mène au journal » devient « Entraînement mène au journal », doublon absent). Ajustements de mes tests neufs avant leur vert, consignés dans les messages : sélecteur `li.ct-flat` (A), carte Séance d'ERGO-01 hors du périmètre « cartes » et attente du contenu pour deux écrans sans section (B), bouton « Outils de test » (P5).

En local (Vitest ciblé, `--maxWorkers=1`) : 184 fichiers, 1 826 tests verts (training, nutrition, app, settings, ui, domaine training, tests ERGO-01b), plus sync, cardio, corps, récupération, onboarding au lot B ; `tsc --noEmit` propre hors `@tauri-apps/plugin-geolocation` introuvable (environnement) ; ESLint propre.

Non testé en local (CI seulement) : e2e `pc`, `iphone`, `iphone-webkit`, visual, perf, smoke, `test:bundle`. Aucune attente e2e ne cite les textes ou classes changés (recherche dans `tests/`).

## 8. Passe code-reviewer (`.claude/agents/code-reviewer.md`)

Relecture à froid de `git diff origin/main...HEAD` :

- Couches ADR 0001 : règle pure du jour (`programDay.ts`) et du cran (`stepLoad`) dans `src/domain/training`, sans import Tauri ni React ; accès base par les dépôts ; rien dans `src/db`, `src/sync`, migrations, Swift, workflows ni contenu (pas de relecture sync-icloud due ; `src/features/sync` : classes seulement). `tokens.css` : passe ui-design-system § 4.
- Constat 1 (corrigé avant le vert) : le minuteur de test monté d'office dans Logs y ajoutait ses alertes (5 tests Logs rouges) ; monté à la demande.
- Constat 2 (sans correctif) : `route.search` reste dans la route après fermeture de la recherche ; sans effet (état initial seulement, un changement de section remplace la route).
- Constat 3 (sans correctif) : P1 lance depuis la routine du cycle comme « Démarrer « jour » » ; la séance proposée (`GeneratedSession`, RIR de la semaine) reste dans « Autre séance… » (D-243).
- Sécurité § 22 : aucun appel réseau, aucune donnée corporelle sortante, aucun secret.
- Verdict : **APPROUVÉ**, sous réserve de la CI verte et de la relecture des captures `visual-pairs`.

## Non fait

- Charges et durée estimée sur la carte « Séance du jour » (maquette P1) : le moteur de prescription ne tourne qu'à l'ouverture de la séance ; à rouvrir sur demande d'Ali.
- Ligne « Poids » dans la carte « État » (maquette P4) : la carte Poids est gardée.
- Chiffre héros sur les autres blocs sans chiffre de tête évident (Cardio, Corps, Historique) : non inventé.

## À vérifier par Ali

- iPhone : barre d'onglets (trait bronze), « Séance du jour » et « Lancer la séance », « − / + » d'une main pendant la séance, « Ajouter un repas » ; Dynamic Type « Très grand ».
- PC 1 440 : barre latérale, Aujourd'hui (Récupération en tête, carte « État »), Plus ; captures `visual-pairs` avant (dernier run Tests de main) et après (run de la PR).
