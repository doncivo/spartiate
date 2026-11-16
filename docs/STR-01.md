# STR-01 — Strength Score : 8 groupes, normes publiques, Progrès › Strength Score (lot 0.26.0)

Statut : **code prêt, en revue** (pas « fait » : relecture à froid et CI à venir). Budget M (≈ 150 k tokens ; Ali a demandé de poursuivre en cas de dépassement : dépassement éventuel consigné ici).
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

**Agent du module (rouge puis vert).** Source des normes (D-310) : API publique FitnessVolt (population « gym », Symmetric Strength), CC BY 4.0,
recopiée par script (`scripts/content/build-strength-standards.mjs`, réponses brutes téléchargées le 16/11 dans `.codex-tmp/tmp-STR-01/`, non
versionnées). Clés du catalogue par `scripts/content/set-strength-keys.mjs` (12 exercices, D-311). Calcul (D-312) dans
`src/domain/training/strengthScore.ts` ; écran `src/features/strength/StrengthScore.tsx`, monté par `SectionNotice.tsx` (D-313).

| Critère | Point | Rouge | Vert | Échec observé au rouge |
| --- | --- | --- | --- | --- |
| 1–6 | Vecteurs du domaine (20 cas : interpolation, bornes, catégorie, paliers, sexe, poids, décharge, charge totale, meilleur mouvement, « — » et raisons, global) | `b8055511` | `d54ab40b` | `expected { score: +0 } to deeply equal { score: 63 }`, `groupe chest absent` (bouchon) |
| 7 | validate-content : clé inconnue, groupes incohérents, norme orpheline, centiles, catégories, source ; contenu réel (12 clés, 11 mouvements, recopie exacte homme ≤ 83 kg) | `b8055511` | `d54ab40b` | `ENOENT … content/strength/standards.json` (suite entière rouge) |
| 8 | Écran (5 cas Testing Library : sans sexe, sans pesée, homme 45 Bronze, femme 96 Or, attribution) | `b8055511` | `d54ab40b` | `Unable to find … Sexe non renseigné…` (bouchon qui ne rend rien) |
| 9 | Hors du départ : `StrengthScore.tsx` et `standards.json` blocs à la demande, textes absents du départ | `b8055511` | `d54ab40b` | bloc absent du manifeste |

Ajustement après le rouge, avant le vert : dans le test d'écran, l'ordre des mouvements de référence cités par la raison du Dos est alphabétique
(choix de l'écran, « Traction lestée » avant « Traction pronation »). Bundle : un premier essai ajoutait 9 octets au départ (l'estimation du 1RM
devenait un bloc commun de plus, ajouté aux préchargements des imports à la demande du départ) ; corrigé par un groupe de découpage `prescribe`
sans dépendances récursives (vite.config.ts) : le bloc `prescribe` retrouve exactement son contenu et son empreinte d'avant
(`prescribe-CrizTkXB.js`). Départ : **195 861 octets normalisés avant (main `cdf1a900`) et après, 44 blocs** (brut 195 865 → 195 872 ; marge 162 539).
Environnement : `npm run test:bundle` local échoue sur `pairingBundle.test.ts` (2 cas) dès main, sans changement : les modules de `node_modules`
s'y écrivent `../../node_modules/…` parce que `node_modules` du worktree est une jonction vers le dépôt principal ; hors périmètre, la CI tranche.

**qa-test.** Rouge rejoué au commit `b8055511` (mêmes fichiers qu'à l'observation) : 20 vecteurs, 5 cas d'écran et la suite de validate-content
rouges comme annoncé. Cas ajoutés (verts) : poids de corps nul, négatif ou non fini (« — », noBodyweight) ; table des femmes à catégorie ouverte
seule ; moyenne pondérée par récence du moteur (pas le meilleur 1RM historique : 83,25 kg → 54) ; « < 10 » compté 10 dans le global ; carte montée
par Progrès (SectionNotice.test.tsx : région « Strength Score », sans profil aucun chiffre). Mutations prouvées puis annulées : catégorie
`<=` → `<` (5 cas rouges), meilleur mouvement du groupe inversé (1 cas rouge). Suites locales : src/domain/training, src/features/strength,
content de training, scripts/content, src/i18n, src/features/app : 1 088 verts ; strengthScore + SectionNotice : 31 verts après ajouts ;
startBundle.test.ts 154 verts ; contrôles documentaires 78 verts ; `npm run typecheck` et `npm run lint` verts. Constats sans défaut bloquant :
(a) « barre et haltères » du § 17.1 n'est tenu que pour la barre et le poids du corps (aucune norme d'haltères publiée et citable, D-311) ;
(b) Rowing à la barre noté sur la norme du Pendlay row (approximation, D-311) ; (c) charge totale des tractions et dips supposée (H-37) ;
(d) la catégorie affichée est celle du développé couché ; pour une femme de moins de 52 kg, push press et sumo n'ont pas de catégorie ≤ 47 kg
(la première sert, D-312 (3)). Budget : dépassement probable du budget M (≈ 150 k), consigné ici comme demandé par Ali ; travail poursuivi.

À constater par Ali (iPhone et PC) : Progrès › Strength Score visible entre Récupération et Corps ; avec sexe et pesée renseignés, chiffres
plausibles pour ses mouvements à la barre ; groupes sans mouvement de référence en « — » avec la raison ; score inchangé pendant la semaine
de décharge ; mention de la source lisible.

**code-reviewer.** Revue 1 (à froid, agent code-reviewer) : **à corriger**, aucun bloquant dans le code. Vérifié conforme : recopie exacte (4 réponses de l'API, 32 catégories identiques au pas de 0,1 kg), domaine pur, interpolation et bornes, décharge exclue (`analyzeHistory` saute `deload` : le score affiché en décharge est celui d'avant ; seule une pesée peut le faire bouger, D-312), « — » avec raison, groupe `prescribe` de vite.config.ts sûr (aucun module du départ déplacé, garde BUNDLE-01 intacte), écran à la demande, 12 clés justes, validate-content OK, 87 tests ciblés verts.

| # | Constat | Suite |
| --- | --- | --- |
| 1 (important) | Licence citée sur la mauvaise page (données structurées de la page de méthode = jeu « FVCP ») | Corrigé (orchestrateur) : preuve = page de l'API, « The data is free to use under CC BY 4.0. », vérifiée par curl le 16/11 ; licences.md et D-310 |
| 2 (important) | « Barre et haltères » du § 17.1 réduit à la barre et au poids du corps, Rowing barre noté sur le Pendlay row : écart au PRD | Consigné comme le prévoit le lot (D-311, choix prudent révisable) et ajouté à « À décider par Ali » dans docs/reprise.md |
| 3 (important) | Aucun contrôle CI sur la PR (conflit avec main) | Main fusionnée, CI relancée |
| 4 | Lien d'attribution demandé, texte non cliquable | Adresse complète écrite en clair (CC BY 4.0 § 3(a)(2)), noté dans licences.md |
| 5 | Date incohérente (affichée 09/06, docs 05/06) | Corrigé : « version des données du 09/06/2026 » (`data_version`), population du 05/06 ; rouge `2b16ee6a`, vert `532e5180` |
| 6 | Test d'écran retouché dans le commit vert (ordre alphabétique) | Consigné, rien d'affaibli |

Revue 2 (à froid) : **approuvé** ; corrections 1, 4 et 5 vérifiées, fusions de main sans perte (D-300 à D-305, section MEDIA-02 de licences.md intactes) ; constat 2 laissé à Ali (reprise, « À décider par Ali »).
