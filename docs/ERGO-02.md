# ERGO-02 — écrans restants, onboarding complet et Aujourd'hui PC réaligné (0.23.0)

Statut : **en cours** (pas de PR, pas de tag). Budget L (400 k). Branche `ERGO-02-ecrans-restants` depuis `origin/main` `cb1a1120` (0.22.3, schéma 18). Présentation seule : aucune migration, aucune règle métier modifiée, aucun changement de navigation entre onglets. Décision d'Ali du 13/11 (aperçu validé) ; D-261 (charge aux haltères, révise D-260) et D-262 suivantes.

Chapitres PRD : 10 (§ 10.1 onboarding), 13 (séance), 14 (fiche, matériel), 15 (check-in, compléments), 17 (Corps), 18 (§ 18.2 Plus, § 18.4 charte, § 18.5 états dégradés, § 18.6 accessibilité). Référence visuelle : `docs/maquettes/propositions/esthetique-2026-11-13/` (29 écrans, reprise du commit `74721fc` de `origin/maquettes-esthetique-2026-11-13`) ; `esthetique-2026-11-12/` pour les écrans déjà faits et `PC-Aujourdhui-apres.dc.html`.

## 1. Passe product-owner (`.claude/agents/product-owner.md`)

| # | Critère (Given / When / Then) |
| --- | --- |
| C1 | Given un écran listé (Corps, Fiche, Check-in, Appareils et synchro, États dégradés, Compléments, Cardio GPS en cours, Plus ; PC : Corps, Fiche, Matériel, Appareils et synchro, Plus), When il s'affiche à 440 ou 1 440 px, Then sa structure suit l'aperçu (blocs, ordre, chiffre héros, une seule action rouge) avec les vraies données. |
| C2 | Given une donnée manquante, Then un tiret « — » et sa raison ; un état dégradé est un bandeau fin, jamais une carte pleine. |
| C3 | Given Plus, Then 4 groupes Moi, Sources, App, Données ; une ligne par réglage avec sa valeur actuelle ; PC : liste à gauche, réglage ouvert à droite. |
| C4 | Given l'onboarding (premier lancement ou « Revoir mes réglages »), Then 8 étapes (§ 10.1) selon l'aperçu ; PC : étapes à gauche avec avancement, question au centre ; Entrée continue, Tab champ suivant, flèches pour le rythme, 1 / 2 / 3 pour l'expérience. |
| C5 | FIX-0171 inchangé : seuls les champs modifiés sont écrits, aucune pesée sans saisie, brouillon gardé à chaque étape, toute question non essentielle passable. |
| C6 | Étape 1 : iPhone, poids pré-rempli depuis Santé si l'autorisation existe ; PC, jamais, texte de l'aperçu. Étape 8 : dépense « point de départ, recalculée après 2 semaines ». |
| C7 | Given le PC, When Aujourd'hui s'affiche, Then colonne gauche : récupération puis séance du jour en tableau (exercices, cibles, charges) avec « Saisir la séance ici » ; droite : nutrition et macros, poids et dépense, semaine, derniers records ; carte « État » petite en bas à droite ; profil dans Plus. |
| C8 | Given une charge d'exercice aux haltères (deux haltères), Then « 2 × 26 kg » partout où une charge est montrée (Aujourd'hui, séance, fiche, historique, résumé, records ; PC et iPhone) ; un seul haltère : « 26 kg » ; la valeur stockée ne change pas (D-261). |
| C9 | Garde-fous : jetons seulement, contrastes AA par test, cibles ≥ 44 pt, Dynamic Type « Très grand » sans texte coupé ; onboarding, Plus et écrans neufs hors du départ ; liste blanche et plafond inchangés. |

Hors périmètre : navigation entre onglets, données, synchro (protocole), moteurs. Hypothèses : aucune H-n nouvelle ; le pré-remplissage Santé de l'étape 1 réutilise la lecture existante.

## 2. Preuves rouge → vert

| Lot | Rouge | Vert |
| --- | --- | --- |
| C8 domaine et format (`dumbbellsHeld`, `formatExerciseLoad`) | `da0059f2` | `a60debf6` |
| Onboarding 8 étapes (C4 à C6) | `31f8723b` | `d915c957` ; test existant `34e5c891` |
| Écrans Entraînement et « 2 × » (C1, C8) | `bf41a27e` | `11d69061`, `e780a370` ; tests existants `9ff9462c`, `3d18a9b2` |
| Aujourd'hui PC, bandeaux, tiret (C2, C7, C8) | `0fbf1b27` | `e1fdcdef` ; tests existants `2ebefba4`, `aa7adbd4` (attente allongée retirée) |
| Plus, Appareils et synchro (C3) | `fc960129` | `f30961dd`, `032fe529` ; tests existants `fc150f48`, `433dfb35` |
| Corps, check-in, Compléments (C1, C2) | `ede9cc94` | `14ad6ba9`, `06e61082`, `5fe99ffe` ; test existant `5f3fdc7b` |
| Accessibilité (relecture) | `0d8fe825` | `f62d2d69` |
| Version 0.23.0 | `6048f42e` | commit « version 0.23.0 » |
| Défauts trouvés par la CI (run `43433586735` puis run de `d39fdc6e`) : carte Poids démontée, bouton d'association en double (deux états) | tests existants rouges en CI | `33075410`, `83071323`, `3258d3bc` |

Tests d'interface existants mis à jour (commits qui le disent, aucune assertion affaiblie) : e2e I3-07, RESET-01, I-04, lot-f, Y-IOS-02, aides `sync.ts` / `settings.ts`, capture visuelle, marqueurs de `startBundle.test.ts` (`4606d1a7`, `e7b972c7`, `83071323`, `d39fdc6e`).

## 3. Passes des agents du module

Travail découpé par zones disjointes, une branche et un worktree par zone, fusionnés dans la branche du ticket (D-51 : mécanique par script).

- **settings-personalization (onboarding)** : 8 étapes de l'aperçu ; PC : étapes à gauche (`aria-current="step"`, « terminée » / « en cours » en texte), question au centre ; Entrée, 1 / 2 / 3, ← → (rythme et séances par semaine), jamais dans un champ texte. Étape 1 iPhone : un seul `bodyMassToday()` sans demande d'autorisation, valeur écrite seulement par « Commencer » ; PC : texte de PC-Onb-1. FIX-0171 inchangé (tests verts). Cartes nommées par leur libellé, précision en `aria-describedby`.
- **training** : fiche (iPhone ; PC bibliothèque à gauche), Matériel PC, cardio GPS en cours (D-263) ; « 2 × » dans la séance (cible, dernière fois, séries, proposition, échauffement), le journal, le rejeu, le résumé, les records et la fiche ; saisie « Charge par haltère (kg) ». Volume et valeurs stockées inchangés.
- **app-shell (Aujourd'hui PC, états dégradés)** : D-262 ; colonne droite et carte « État » dans un bloc à la demande (`TodayPcSide`, catalogue `fr.todayPc.ts`) ; `StatusBanner` à teinte (`info` / `warn`), mêmes déclencheurs et textes ; `MissingValue` (tiret et raison).
- **settings-personalization (Plus, synchro)** : MOI (Profil et poids, « Revoir mes réglages ») ; SOURCES (Apple Santé iPhone, Appareils et synchro) ; APP (thème, semaine, heure, fuseau, démarrage, signature, version, Logs) ; DONNÉES (export, sauvegarde, journaux, Repartir de zéro). PC : liste à gauche, panneau à droite, ↑ ↓ et Entrée. Synchro : présentation seule, aucun fichier de `src/sync`, `src/domain/sync`, `src-tauri`.
- **nutrition (Corps, check-in, Compléments)** : silhouette et zones en boutons radio, dernière mesure en héros, écart sur 4 semaines, courbe, saisie en une ligne (PC : Entrée, ↑ ↓ change de zone) ; check-in : héros kg / sem, 4 cases, Actuel / Proposé / Écart, « Accepter » seul rouge ; Compléments : « n / m pris aujourd'hui », prises par moment, bande de constance 14 jours lisible sans couleur.

## 4. Écarts à l'aperçu (aucune donnée ni logique inventée)

- Onboarding : ni charges de départ, ni cibles kcal / macros du jour, ni « séries par séance », ni détail du matériel « Salle complète », ni « Changer » / « Autres choix » du split, ni phrase « ≈ 80 % » : aucune règle existante ; rythme en choix discrets (pas de curseur) pour garder les rythmes proposés.
- Aujourd'hui PC : voir D-262. Entraînement : pas de « Ajouter à une routine », « Pause » GPS, « + Nouveau profil » (actions absentes de l'app) ; colonne « Crans » au lieu de « Postes » ; record écrit « 70 kg × 8 ».
- Plus : Objectifs, Compléments, Matériel, Notifications, Clé IA n'ont pas d'écran dans Plus (non ajoutés) ; Apple Santé absent sur PC (comme avant) ; QR du PC dans la fenêtre d'association (protocole intouchable), la colonne de droite porte « Associer l'iPhone ».
- Compléments : heure réelle de prise non enregistrée (aucune migration) : « pris » ou « prévu à 20:00 ». Corps : zones gauche / droite séparées (saisie par zone en base).

## 5. Passe ui-design-system (`.claude/agents/ui-design-system.md`)

Verdict : conforme sous réserve. Aucune couleur en dur, `tokens.css` inchangé (aucun jeton neuf) ; une seule action rouge par écran (tests `redActions`) ; composants partagés réemployés (SectionTitle, HeroFigure, Icon, MissingValue). Corrigé : valeurs en dur → jetons (Corps 48 px → `--ct-hit-target-min`, liste de Plus PC → `--ct-space-*`, `--ct-radius-md`) ; rouge retiré comme couleur de texte dans Plus (§ 18.4). Écart noté : l'eyebrow « Étape n sur 8 » de l'onboarding garde sa classe (gris secondaire, comme l'aperçu). À vérifier en « Très grand » sur iPhone : cellule de charge du tableau (non coupée), défilement de la question de l'onboarding.

## 6. Passe accessibility-i18n (`.claude/agents/accessibility-i18n.md`)

Verdict : conforme après corrections (`0d8fe825` → `f62d2d69`). Textes tous dans `src/i18n`, tutoiement, 24 h, aucun « ! » ; jamais la couleur seule (onboarding, constance, coches, courbe, tracé) ; rôles radiogroup / radio, `aria-current`, régions nommées ; raccourcis PC sans capture de saisie. Corrigé : tiret sans raison (Corps, check-in), tabindex itinérant et focus des zones, coche à libellé constant, annonce GPS à la minute, 14 clés mortes retirées. Contrastes : couples employés couverts par `charte` / `contrastCss` (bronze, secondaire sur surface) ; Dynamic Type « Très grand » : tailles en rem, à constater sur l'iPhone.
