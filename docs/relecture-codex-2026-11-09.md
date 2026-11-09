# Relecture Codex de jalon I1–I4 hors IA — 9 novembre 2026

**Conclusion : à corriger d'abord.** L'export omet les séances ouvertes ; deux autres défauts d'import empêchent de retrouver l'état métier attendu.
**10 constats nouveaux : 1 bloquant, 9 importants, 0 mineur.** Cette conclusion porte sur le jalon ; le rapport seul peut être fusionné après sa CI.

Relecture seule, D-53 : `origin/main` à `903bef9a` (0.9.1), puis diff de la PR #89 encore ouverte, branche `fix-092-onglets-catalogue` à `f4cc7a32`. PR #63 fermée sans fusion : remplacée par #66, exclue du bilan des fusions. Références : AGENTS.md, CLAUDE.md, ADR 0001, PRD en chapitres, décisions D-53 à D-84, reprise et rapport du 31 octobre. Les lignes ci-dessous sont celles de cette base, sauf mention #89. Aucun code, test, PRD ou ticket modifié ; aucune donnée réelle consultée.

Gravité : **bloquant** = perte/corruption de données, divergence de synchro, démarrage ou sécurité ; **important** = comportement faux ou preuve manquante ; **mineur** = le reste. Les tests proposés sont à écrire lors des corrections, pas réalisés dans cette relecture.

## 1. Synchro et intégrité

| # | PR et fichier:ligne | Constat | Gravité | Test qui le détecterait | Proposition |
| --- | --- | --- | --- | --- | --- |
| 1 | #56 — `src/db/repositories/sql/exportImportRepository.ts:106` ; `src/domain/exportImport/archive.ts:321` | L'export réutilise `publishWhen` : une séance ouverte et ses séries sont exclues ; le parseur refuse aussi une séance sans `ended_at`. D-57 exige explicitement les séances ouvertes dans la sauvegarde complète, distincte de la publication D-27. Si Ali reprend depuis cette archive après perte/reset, ses séries déjà saisies dans la séance ouverte sont irrécupérables depuis l'archive. L'export ne détruit pas la base source. | **bloquant** | Séance ouverte avec séries validées et séance close : export → nouvelle base → import ; retrouver les deux, avec statut ouvert conservé et sans publication prématurée. | Séparer exportabilité et publication ; inclure et marquer les séances ouvertes, adapter validation et reprise. |
| 2 | #56, #87 — `src/domain/exportImport/archive.ts:178` ; `src/domain/exportImport/plan.ts:128` | Une archive de schéma 9 dont toutes les tables entraînement/nutrition sont vides omet `training`. « Remplacer » prend cette absence pour une archive ancienne et ne supprime aucune ligne locale de ces tables. La protection par `archiveSv` de #87 n'est jamais atteinte. Sonde synthétique : une déclaration locale survit au remplacement par cette archive vide. | **important** | Archive réellement produite par `buildExportArchive`, sv 9, toutes ces tables vides ; remplacement d'une base avec recette, séance et déclaration. Vérifier suppressions logiques et réception sur un second appareil ; conserver le cas archive ancienne. | Distinguer table non représentable dans l'ancien schéma et table vide dans le schéma courant, même sans clé `training`. |
| 3 | #88 avec #56/#87 — `src/domain/nutrition/targetRecord.ts:72` ; `src/domain/exportImport/plan.ts:132` ; `src/db/repositories/sql/exportImportRepository.ts:68` | La cible en vigueur dépend désormais du dernier HLC. L'archive ne conserve pas cet ordre métier ; l'import réattribue des HLC croissants dans l'ordre des identifiants. Deux cibles acceptées dont ordre des IDs et ordre causal diffèrent changent donc de gagnante après reprise, même si le hash canonique est identique. En fusion, réintroduire une ancienne cible absente peut aussi lui donner la priorité. | **important** | Deux cibles acceptées applicables, IDs et HLC en ordre inverse : export/import sur base vide puis comparaison de la cible active ; ajouter fusion avec une cible récente déjà présente. | Conserver un ordre de décision métier stable dans l'archive et le modèle ; ne pas confondre cet ordre avec l'horloge technique réattribuée à l'import. |

Les migrations 0007–0009, le catalogue, la capture et le correctif `reset_triggers` de #86 ont été confrontés aux tests disponibles. Aucun nouveau défaut de restauration établi ici. La preuve native toutes versions citée par I4-08 reste celle de ce ticket : aucun essai natif de restauration réalisé pendant cette revue. Les tests ciblés de #87 couvrent notamment le passage des tables nouvelles par un lecteur en schéma 8. Les limites déjà consignées dans I4-06/I4-07/I4-08 ne sont pas répétées ; cette relecture n'apporte pas de preuve nouvelle justifiant d'en rehausser la gravité.

## 2. Moteurs

| # | PR et fichier:ligne | Constat | Gravité | Test qui le détecterait | Proposition |
| --- | --- | --- | --- | --- | --- |
| 4 | #79, #81 — `src/features/nutrition/useNutritionData.ts:20` et `:32` | Après un premier chargement réussi, l'échec d'une relecture conserve silencieusement l'état `ready` et l'ancien instantané. Après écriture ou synchro, Ali peut lire des totaux/cibles périmés sans signal d'erreur. Les deux chemins d'erreur font ce choix ; aucune trace d'état dégradé n'y est conservée. | **important** | Charger, modifier une donnée, faire échouer la lecture suivante : conserver éventuellement les anciennes valeurs, mais afficher leur caractère périmé et une erreur durable, puis l'effacer au succès. | Porter l'erreur et la fraîcheur séparément des données ; exposer et persister l'état dégradé selon la règle « aucune défaillance silencieuse ». |
| 5 | #60, #61, #72 — `src/db/repositories/sql/progressionRepository.ts:177` et `:253` | Historique et profil de progression sont indexés par exercice, sans profil de salle. Le même exercice machine pratiqué dans deux salles réutilise donc les charges et estimations de l'autre machine. PRD § 11.3 et § 14.3 imposent les 1RM machine par profil, poids libres partagés. Le filtre matériel du générateur ne sépare pas ces historiques. | **important** | Même exercice machine, deux profils avec historiques très différents : prescription fondée sur le profil actif ; contrôle que les poids libres restent partagés. | Enregistrer le profil matériel pertinent avec la séance et distinguer les références machine dans le domaine et les repositories. |
| 6 | #60, #72 — `src/domain/training/prescribe.ts:35` ; `docs/I2-01.md:143` | Le multiplicateur de position existe, mais ses seuls appels sont dans son test unitaire. L'application différée à I3 n'a pas été branchée : passer un exercice en deuxième/troisième position d'un même muscle ne déclenche pas le traitement prévu au § 11.3. | **important** | Prescriptions intégrées pour un même exercice déplacé du premier au deuxième/troisième rang musculaire ; autre muscle inchangé ; ne pas compter deux fois une décote déjà reflétée dans l'historique. | Porter le rang musculaire et le contexte historique jusqu'au moteur ; appliquer la règle, ou faire arbitrer explicitement son retrait par Ali. |
| 7 | #87 — `src/domain/nutrition/recipe.ts:146` ; `src/db/repositories/sql/recipeRepository.ts:80` | `ingredientFromFood` conserve jusqu'à 200 caractères du nom ; la validation du brouillon accepte un ingrédient de 150 caractères, mais le repository refuse au-delà de 120. Un aliment valide au nom long peut donc rendre une recette impossible à enregistrer, sans moyen de raccourcir ce nom dans l'éditeur d'ingrédient. | **important** | Aliment Ciqual/OFF au nom de 150 caractères → ajout à une recette → validation → enregistrement SQL réussi ; couvrir la limite exacte. | Aligner la borne de l'instantané d'ingrédient, sa validation de domaine et le stockage ; éviter un refus tardif après saisie. |
| 8 | #72 — `src/domain/training/generateSession.ts:162` ; `docs/decisions.md:119` | D-73 dit explicitement ne pas valoir décision d'Ali. Pourtant, en Guidé, les doublons de pattern/muscle et les lignes hors split de la routine sont conservés avec avertissement. L'absence de doublon du PRD § 12.1/12.5 et du critère I3-01 n'est donc pas respectée. La contradiction entre cette règle et les routines de référence est réelle, mais l'agent l'a tranchée sans validation d'Ali. | **important** | Routine avec deux mouvements de même pattern/muscle : assertion sur la séance finale, pas seulement sur les substitutions créées par le générateur ; décision attendue explicitement approuvée. | Faire arbitrer par Ali le contrat des routines et du générateur ; porter ensuite cette décision dans le PRD et les tests, sans présenter D-73 comme approbation acquise. |

Les correctifs de progression/fatigue/inactivité de #88 et les cas ciblés d'échauffement, dépense et cible passent les tests relancés. Le constat 3 est une interaction avec l'archive, absente du test isolé de la cible. Les limites de moteur déjà décrites dans I4-06 à I4-08 restent hors de ce tableau. L'examen des couches ADR 0001 n'a pas établi de nouvel import React/Tauri dans les moteurs purs ; le constat 7 révèle en revanche une divergence de contrat entre domaine et repository.

## 3. Réseau et sécurité

| # | PR et fichier:ligne | Constat | Gravité | Test qui le détecterait | Proposition |
| --- | --- | --- | --- | --- | --- |
| 9 | #65 — `src/domain/health/shortcutWeights.ts:48` et `:60` ; `src/features/settings/AppleHealthScreen.tsx:189` | Les pesées sont dédoublonnées sur le jour écrit dans chaque timestamp, puis enregistrées sur le jour recalculé dans le fuseau de l'appareil. Avec des offsets différents, deux pesées de jours locaux distincts peuvent être réduites à une seule, sans rejet signalé. Exemple synthétique : `2026-11-08T00:30:00+09:00` et `2026-11-08T23:30:00-08:00` correspondent aux 7 et 9 novembre à Paris ; le parseur ne garde que la seconde (`rejected = 0`). | **important** | Importer ces deux lignes sur un appareil Europe/Paris : deux jours enregistrés ; ajouter changement de fuseau et doublon réellement le même jour. | Définir une seule notion de jour pour sélection et persistance ; transmettre le fuseau au domaine ou différer le dédoublonnage jusqu'à cette conversion. |

OFF #85 : client Rust avec rustls, User-Agent applicatif, redirections bornées à la même origine HTTPS, réponse et délai bornés ; les requêtes inspectées portent le code-barres ou le texte recherché, pas le profil corporel. Les erreurs exposées ne recopient pas la réponse ni la recherche dans les journaux. Scan/permission : lecture des chemins refus/annulation et de leur nettoyage ; aucune preuve caméra sur iPhone produite ici. Journaux Windows #62 : pas de nouvelle fuite établie dans le diff.

Exception #89/D-84 : le changement de `.github/workflows/tests.yml:253` ajoute uniquement l'identifiant `RUSTSEC-2026-0459` à l'exception préexistante ; justification locale écrite, retrait et mise à jour suivis dans `docs/DEP-01.md:3`, revue au 30 novembre. Cela vérifie la portée et la traçabilité de l'exception, pas l'absence de vulnérabilité ni une correction de SQLite. L'avis amont n'a pas pu être vérifié indépendamment dans cette revue ; aucun nouvel avis de sécurité n'est déduit de cette seule documentation.

## 4. Interface, contenu et preuves

| # | PR et fichier:ligne | Constat | Gravité | Test qui le détecterait | Proposition |
| --- | --- | --- | --- | --- | --- |
| 10 | #84 — `docs/V0.7.1.md:19` ; #56 — `src/features/training/RoutinesView.tsx:263`, `src/features/training/session/SetRow.tsx:157` | La preuve rouge séparée manque pour les correctifs #84 : code et tests arrivent ensemble (`7ad292a1`), écart reconnu dans la fiche. Le retour à la liste après enregistrement et le choix des types de série de #56 (`8cee6024`, `2b4e6e30`) n'ont pas non plus de commit de test rouge préalable identifié. Une CI verte après changement ne reconstitue pas cette preuve exigée par AGENTS.md. | **important** | Sur les parents des corrections : enregistrement de routine puis retour à la liste avec confirmation ; choix Dégressive/Partielle depuis une série normale ; scénarios de régression listés dans V0.7.1. Vérifier l'échec sur l'ancien code et le succès sur le correctif. | Conserver l'écart historique explicite ; fournir une reproduction rouge/verte traçable sans réécrire l'historique. Toute nouvelle correction issue du présent rapport commence par un commit rouge. |

#89 : 196 exercices lus, 171 compatibles avec le profil Fitness Park Antony par le prédicat du domaine ; les IDs et noms des 150 exercices précédents sont conservés. Ces nombres ne prouvent pas l'inventaire réel de la salle. Le diff CSS traite le rétrécissement flex des onglets ; les contrôles visuels restent ceux de la CI et d'Ali. Les textes hors premier affichage et catalogues sont examinés avec leurs chemins de chargement à la demande ; pas de nouveau constat distinct des libellés déjà signalés dans I4-06.

## Traçabilité des PR et de la preuve rouge/verte

Diffs confrontés aux critères des fiches correspondantes et aux couches ADR 0001. Les couples ci-dessous sont des repères de commits de tests puis de réalisation dans les branches des PR, pas une affirmation d'avoir rejoué toutes les révisions historiques. Les PR de version/documentation sont distinguées ; #63 n'est pas une fusion. Les constats décrivent les écarts nouveaux retenus, pas un certificat d'absence de défaut ailleurs.

| PR | Critères / périmètre confronté | Repère tests → réalisation ; résultat de revue |
| --- | --- | --- |
| #53 | I1-01 : catalogue, routines, matériel | `51ea6c27` → `5d3ab33f` ; pas de nouveau constat distinct. |
| #54 | I1-02 : séances, capture, reprise | `8129bb00` → `ca6de60e`, `57b0cbd5` → `09607bf4` ; interaction salle : constat 5. |
| #55 | I1-03 : historique | `f1e756f2` → `e4eeffe5`, `26503b81` → `201c62af` ; pas de nouveau constat distinct. |
| #56 | Correctifs I1, export entraînement | `f79f6a15` → `493320a3` ; constats 1–3 et 10. |
| #57 | Traces synchro et finitions de séance | `231222a4` → `9b6f2cd2`, `1dec7818` → `bd81b3a1` ; pas de nouveau constat distinct. |
| #58, #59 | Arbitrages D-72, documentation de préparation I2 | Pas de nouvelle réalisation moteur à valider dans ces PR ; décisions confrontées à I2/I3. |
| #60 | I2-01 : progression, schéma et décisions | `8f52bde5` → `6fe8dd15`, `729165b9` → `ad4b9bbf` ; constats 5–6. |
| #61 | I2-01 : intégration des prescriptions | `d0052355` → `8555b6d8`, `523caed7` → `aea12dc1` ; constat 5. |
| #62 | Journaux Windows | `5817531e` → `19b5e5ca` ; pas de nouveau constat distinct. |
| #64 | I2-02 : contraintes | `a3e785ea` → `2bdcca5b`, `81a2bd07` → `aa497420` ; pas de nouveau constat distinct. |
| #65 | Pesées Raccourcis | `48c42b64` → `d1db5e1f` ; constat 9 ; preuve appareil toujours distincte. |
| #66 | Reprise du correctif de #63 | `b6da93b4` → `a49c29a5` ; #63 fermée, non comptée deux fois. |
| #68 | Garde-fous et intégration | `0fc25ed9` → `89451270`, `0d438b76` → `f29f021f` ; pas de nouveau constat distinct. |
| #70 | I2-03 : échauffement | `768b3519` → `96b711c8`, `84d886fc` → `65e4b5d3` ; tests ciblés verts. |
| #72 | I3-01 : générateur | `67599019` → `edd88e9f` ; constats 6 et 8 ; D-73 ne vaut pas accord d'Ali. |
| #74 | PURGE-I18N : catalogues de textes orphelins | `975598bb` → `fb9d10fa` ; pas de nouveau constat distinct. |
| #75 | I3-02 : mésocycle | `e9853992` → `1dff09b1`, `2dccdf13` → `8f7ae5fc` ; limites déjà consignées non répétées. |
| #77 | I4-01 : moteurs nutrition | `a29168b5` → `7f95896c`, `48972312` → `42bdf998` ; relu avec #87/#88. |
| #79 | I4-02 : journal et cibles | `08a54985` → `bec3beec`, `3f183ba4` → `b043e086` ; constat 4. |
| #81 | I4-03 : dashboard/check-in | `263b3d3a` → `f797ac58`, `f8ceec41` → `30335e1e` ; constat 4 ; limites connues non répétées. |
| #84 | V0.7.1 : mise en page et correctifs | `7ad292a1` contient code et tests ; constat 10. |
| #85 | I4-05 : OFF et scan | `924a56b9` → `259a6e76`, `fe96555e` → `487c3098`, `dfcd298c` → `6432bd94` ; examen sécurité ci-dessus. |
| #86 | I4-06 : favoris, restauration | `4b031972` / `93acde22` → `deab6006`, `88ff8f15` → `a6af8194` ; défauts déjà consignés exclus. |
| #87 | I4-07 : recettes, déclaration, schéma 8/9 | `5de372b7` → `db98afe7`, `39a85e8a` → `94dd8ca6`, `2204ac24` → `4e7dda7a` ; constats 2 et 7. |
| #88 | I4-08 : corrections moteurs | `e84c213b` → `ece16d5e`, `d4e42272` → `58e727e7`, `accb59ff` → `c400847f`, `b75d9cd8` → `9ed2d72f` ; constat 3. |
| #89 | FIX-092, CONTENT-02, DEP-01 | `0357af71` → `ca901071`, `b168f335` → `b2ce1185` ; suite verte lue sur la PR, pas de nouvelle preuve appareil. |
| #67, #69, #71, #73, #76, #80, #82 | Versions | Diff de livraison/version ; pas de preuve fonctionnelle autonome déduite d'un numéro de version. |
| #78, #83 | Documentation de relecture | Confrontée aux réalisations suivantes ; ne remplace pas une preuve rouge. |

## Vérifications effectuées et limites

- **176 tests verts, 11 fichiers**, Vitest avec `--coverage.enabled=false --maxWorkers=1` : export/import (`planSince`, `exportImportRecipes`, `recipeSync` : 50) ; migrations 0007–0009 et `spartiateSchemaFixture` (41) ; `prescribe.i408`, `tdee`, `targetRecord`, `warmup` (85). Aucun test ajouté au dépôt.
- Sondes jetables sur données synthétiques dans `.codex-tmp/` : archive sv 9 vide, noms d'ingrédients, ordre des cibles après plan d'import, timestamps avec offsets différents et comptage du catalogue #89. La sonde des cibles simule les nouvelles horloges selon l'ordre du plan ; elle ne remplace pas le test SQL de bout en bout proposé au constat 3.
- Aucun e2e, visual, smoke, perf, build iOS ni accès aux conteneurs réels. Pas de relance de suite complète ; les validations natives restent celles de la CI. Les échecs historiques de chaque commit rouge n'ont pas été rejoués.
- `npm run test:bundle` : **95 tests verts, 4 fichiers**, garde de taille sous **358 400 octets gzip** et liste des modules du départ validées sur la base 0.9.1 du rapport. La PR #89 a sa propre CI verte ; son bundle n'a pas été reconstruit localement. Seul ce rapport est destiné au commit et à la PR ; aucune fusion demandée.
