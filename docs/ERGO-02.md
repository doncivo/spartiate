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
