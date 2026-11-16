# STR-01 — Strength Score : 8 groupes, normes publiques, Progrès › Strength Score (lot 0.26.0)

Statut : **en cours.** Budget M (≈ 150 k tokens ; Ali a demandé de poursuivre en cas de dépassement : dépassement éventuel consigné ici).
Branche `STR-01` depuis `origin/main` (`cdf1a900`). Rôles : domain-logic, training, ui-design-system. Plage de décisions : D-310 à D-319.
Énoncé : docs/LOT-0.26.0.md, § 4. Chapitres PRD : [17 (§ 17.1, Strength Score)](prd/17-progres-bilans-appels-ia.md),
[11 (§ 11.2–11.3, 1RM estimé, deload hors statistiques)](prd/11-moteur-de-progression-src-domain-training.md),
[12 (§ 12.4, deload : « 1RM et Strength Score gelés »)](prd/12-generation-de-seance-et-mesocycle-src-domain-training-i3.md),
[14 (§ 14.1, `strengthStandardKey`)](prd/14-bibliotheque-d-exercices-et-profils-de-materiel.md),
[18 (§ 18.1 Progrès, § 18.4 charte, § 18.6 accessibilité)](prd/18-navigation-ecrans-et-etats-degrades.md). Maquette de référence : `docs/maquettes/PC-Progres.html`
(carte « Strength Score », 8 groupes, paliers Fer / Bronze / Argent / Or). Fixtures synthétiques uniquement (usage réel depuis le 16/11, D-292).
Hypothèse touchée : H-37 (nouvelle, registre provisoire dans docs/decisions.md, ligne UNVERIFIED dans docs/capability-matrix.md).

## Passe product-owner : critères

| # | Critère (Given / When / Then) | Tests |
| --- | --- | --- |
| 1 | Un homme de 81,4 kg, un 1RM estimé de développé couché à la barre → le score du groupe Pectoraux est le rang centile de ce 1RM dans la catégorie de poids ≤ 83 kg des normes embarquées, interpolé linéairement entre les centiles publiés (10, 25, 50, 75, 90, 95, 99), arrondi à l'entier. | vecteurs du domaine |
| 2 | Même 1RM, sexe féminin ou autre poids de corps → la table du sexe et la catégorie de poids changent le score (ajusté au poids et au sexe). | vecteurs |
| 3 | Un 1RM sous le 10e centile → « < 10 » (palier Fer), au-dessus du 99e → « > 99 » ; aucun nombre extrapolé. | vecteurs |
| 4 | Groupe sans séance valide d'un mouvement de référence, sexe absent du profil ou aucune pesée → le groupe affiche « — » avec sa raison, jamais 0 ; le score global ne compte que les groupes chiffrés, et dit combien. | vecteurs, écran |
| 5 | Pendant une décharge (séances `deload`), le score ne change pas : les séances de décharge n'entrent pas dans le 1RM (§ 11.3, § 12.4). | vecteur (séance de décharge plus lourde : score identique) |
| 6 | Tractions, tractions supination et dips : la norme compte la charge totale (poids de corps + lest) ; le 1RM se calcule sur ce total avec le poids de corps actuel. | vecteurs |
| 7 | Le catalogue renseigne `strengthStandardKey` des exercices qui sont un mouvement de référence de la source (par script, D-51) ; validate-content refuse une clé inconnue et un groupe incohérent avec les muscles principaux de l'exercice. | validate.test.ts |
| 8 | Progrès › Strength Score (iPhone et PC) : chiffre global en bronze et palier, 8 lignes (nom, barre décorative, valeur ou « — » et raison), poids et sexe pris, mention de la source visible (attribution exigée), textes dans `src/i18n`, tokens seulement, cibles ≥ 44 pt. | Testing Library |
| 9 | Écran chargé à la demande avec son catalogue de textes, hors du départ (assertion dans startBundle.test.ts) ; bundle de départ non augmenté (main `cdf1a900` : 195 861 octets normalisés, 44 blocs). | test:bundle, measureStart |

Choix prudents (Ali absent, révisables) : D-310 (source des normes), D-311 (8 groupes et mouvements de référence), D-312 (calcul du score), D-313 (écran).

## Passes

**Agent du module (rouge puis vert).** À compléter.

**qa-test.** À compléter.

**code-reviewer.** (laissé vide : relecture à froid par l'orchestrateur)
