# Partie 0 — vérifications automatiques terminées, résultats non tous verts

SHA : `8686a8fc2860f7a94eb193426cbcc640a33bac80`. Les commandes locales et leurs codes figurent dans `preuves/resultats/`. Aucun résultat CI ne vaut preuve sur un appareil réel.

## CI de la version figée

Tests est déclenché sur main au SHA du tag, pas par le tag. Les deux builds de publication utilisent les tags ; le prébuild iOS est un workflow_dispatch au même SHA. Le publish ignoré du prébuild est attendu, ce n’est pas un test désactivé.

| Run | Workflow | Job | Conclusion | Durée (s) |
| --- | --- | --- | --- | --- |
| 43801990156 | Tests | Lint et typecheck | success | 101 |
| 43801990156 | Tests | e2e pc (1/4) | success | 65 |
| 43801990156 | Tests | Vitest node (5/5) | success | 123 |
| 43801990156 | Tests | Captures app et maquettes | success | 241 |
| 43801990156 | Tests | cargo test (Windows) | success | 826 |
| 43801990156 | Tests | cargo audit | success | 19 |
| 43801990156 | Tests | Vitest node (1/5) | success | 117 |
| 43801990156 | Tests | e2e pc (4/4) | success | 93 |
| 43801990156 | Tests | Vitest dom (3/3) | success | 144 |
| 43801990156 | Tests | e2e iphone (4/4) | success | 133 |
| 43801990156 | Tests | Vitest node (3/5) | success | 97 |
| 43801990156 | Tests | Vitest dom (1/3) | success | 132 |
| 43801990156 | Tests | Vitest node (2/5) | success | 106 |
| 43801990156 | Tests | Vitest dom (2/3) | success | 134 |
| 43801990156 | Tests | smoke Windows (binaire réel) | success | 383 |
| 43801990156 | Tests | e2e pc (3/4) | success | 101 |
| 43801990156 | Tests | e2e pc (2/4) | success | 100 |
| 43801990156 | Tests | e2e iphone (1/4) | success | 111 |
| 43801990156 | Tests | e2e iphone-webkit | success | 92 |
| 43801990156 | Tests | Vitest node (4/5) | success | 76 |
| 43801990156 | Tests | e2e iphone (2/4) | success | 103 |
| 43801990156 | Tests | Performance et bundle | success | 104 |
| 43801990156 | Tests | e2e iphone (3/4) | success | 69 |
| 43801990156 | Tests | Couverture fusionnée | success | 28 |
| 43801990156 | Tests | suite verte | success | 12 |
| 43803496770 | Build Windows | windows | success | 596 |
| 43803496770 | Build Windows | publish | success | 14 |
| 43803497678 | Build iOS | ios | success | 571 |
| 43803497678 | Build iOS | publish | skipped | 0 |
| 43804621262 | Build iOS | ios | success | 480 |
| 43804621262 | Build iOS | publish | success | 12 |

## Comptes et limites

CI fusionnée : 829 fichiers / 9 167 tests Vitest verts. Couverture globale : lignes 94,16 %, instructions 92,06 %, branches 86,44 %, fonctions 91,27 %. Ces taux ne décrivent pas chaque module ; le détail par module reste à établir en partie 11.
Les tests e2e, visual, smoke et perf ne sont pas exécutés localement. Les résultats et compteurs extraits, dont les tests ignorés, sont dans `preuves/ci-resume-tests.json`. Les appels skip conditionnels sont inventoriés dans `preuves/tests-ignores-candidats.json` ; leur pertinence sera relue en partie 11.

## Analyses statiques

Atteignabilité depuis les racines : 31 fichiers src candidats non atteints. Analyse par symboles : 48 fichiers src candidats morts, 1 172 exports candidats inutilisés répartis dans 353 fichiers. Ces deux outils ne constituent pas une preuve de suppression sûre (racines natives, chargements dynamiques et tests à vérifier).
Le scanner i18n historique signale 644 clés candidates sur 1 714 clés du catalogue fr.ts ; il ne couvre pas seul tous les catalogues à la demande. Le typage vérifie les clés statiquement typées ; les accès dynamiques restent à lire.
Complément indépendant `preuves/i18n-ast.mjs` : 68 objets de textes, 39 fonctions de traduction reconnues, zéro clé littérale manquante sur ces appels, 221 appels dynamiques à examiner et zéro texte JSX/attribut statique détecté. Les alias, agrégats et tables restent une limite explicite ; ce n'est pas une preuve d'absence globale de clés inutilisées.
Scanner complémentaire : 47 candidats couleur, 7 candidats texte JSX, 149 occurrences de marqueurs ou délais de tests, aucun doublon de fichier exact (> 100 caractères), aucune requête SQL candidate hors src/db, aucun import de couche interdit détecté par le motif domain. Les trois occurrences Date.now incluent deux commentaires et la fabrique d’horloge injectable : aucun défaut prouvé par ce scan.

## Dépendances

npm audit --omit=dev : 0 alerte. Audit complet : 11 paquets signalés, dont 2 élevés (undici, zod), exclusivement dans le graphe de développement ; les autres alertes proviennent notamment de minimatch via ESLint. Exposition exploitable dans cette application non démontrée.
Les versions des manifestes peuvent être des plages, alors que package-lock.json et Cargo.lock figent les résolutions ; ces deux notions sont distinguées dans l’inventaire. Les identifiants de licences npm sont inventoriés, sans conclusion juridique automatique.
Le document `docs/licences.md` ne liste pas `react-dom` et `zustand` (A-003) ; leurs licences sont néanmoins indiquées dans l'ADR 0001. Il s'agit d'un inventaire dispersé, pas d'une incompatibilité démontrée.

## Preuves isolées

`partie0-rouges.test.mjs` : deux assertions attendues rouges (couleur hors tokens, dépendances absentes du document des licences), vérifiées dans `resultats/partie0-rouges-exec.log`. Le premier lancement `partie0-rouges.log` a échoué avant les assertions à cause du bac à sable (`spawn EPERM`) ; il n'est pas une preuve rouge du code. La seconde exécution autorisée a réellement exécuté les deux assertions.
Gardes documentaires : 5 fichiers, 78 tests verts. Lint, typecheck et validation du contenu : codes 0.

## Résultats locaux et limites de validation

Commandes exactes, codes et durées : `commandes.md`, `preuves/commandes.json` et journaux individuels.

- `npm ci`, typecheck, lint, validation du contenu et 78 gardes documentaires : réussis.
- Suite Vitest complète, couverture active, un worker : **829 fichiers, 9 167 tests ; 9 143 réussis, 24 échoués dans 20 fichiers, 12 erreurs non interceptées**. Durée 6 239,78 s. Aucun second lancement. Détail de chaque échec et position : `preuves/unitaires-resume.json`, messages complets `preuves/unitaires-echecs.json`.
- Classification des 24 échecs : 7 attentes DOM, 13 délais de 5 000 ms dépassés, 3 assertions dépendant d'une référence restée nulle après l'échec précédent, 1 mesure de durée (331,98 ms pour une borne de 300 ms). Les 12 rejets non interceptés concernent un import asynchrone poursuivi après destruction de l'environnement (11 dans `SupplementsViewErgo02.test.tsx`, 1 dans `SupplementsFix0242.test.tsx`). Aucune conclusion de perte de données à partir de ces échecs.
- Bundle : **173 tests réussis**. Mesure précise conservée par la CI du même SHA : **195 861 octets normalisés**, 195 871 bruts, plafond **358 400 octets**, marge 162 539 octets. Le rapporteur local n'a pas conservé le détail console de la mesure ; sa garde a réussi.
- `cargo fmt --check` et `cargo clippy --locked -- -D warnings` : réussis. Desktop : **846 réussis, 2 ignorés** ; les deux ignorés sont le générateur ponctuel de vecteurs et l'essai exigeant un vrai dossier iCloud (`CT_SYNC_TEST_DIR`), interdit dans cet audit.
- Plugin SQL : premier résultat **6 réussis, 24 échoués**, car les fixtures exigent `src-tauri/target/` alors que `CARGO_TARGET_DIR` était déporté. Après création de ce dossier dans la seule copie isolée : **30 tests et 1 doctest réussis**. Ni code ni délai modifié ; première preuve conservée. Ce n'est pas une correction de l'application ni une relance d'un test instable.
- Cargo audit installé dans le dossier isolé. Sans exception : code 1, **RUSTSEC-2023-0071 / rsa 0.9.10**, plus 8 avertissements. Le graphe `cargo tree --locked -i rsa --target all -e normal,build` est vide, comme en CI : cette vulnérabilité du lock n'est pas une preuve d'exposition du binaire. Les avertissements et versions corrigées sont dans `preuves/cargo-alertes.json`.
- Licences : 336 entrées npm et 634 paquets Cargo inventoriés. Les dix paquets Cargo sans licence déclarée sont Spartiate et ses plugins locaux. Pas de licence GPL imposée repérée dans les expressions déclarées ; MPL-2.0 et les avis composites demandent conservation des obligations. **Compatibilité finale et présence des avis dans les binaires : à vérifier**, l'inventaire du lock ne les prouve pas. A-003 documente l'inventaire dispersé.
- Marqueurs syntaxiques : `preuves/marqueurs-tests.json` recense **16 appels conditionnels skip et 106 délais/configurations explicites** sur 873 fichiers ; pas d'appel only/fixme identifié par ce scan. Les 33 cas e2e ignorés en CI sont ventilés dans `ci-resume-tests.json`. Les évolutions historiques des délais restent à traiter en partie 11.

La demande d'absence de perf locale rencontre une limite du dépôt : `npm run test` inclut un test chronométré de checklist, qui n'est pas nommé `.perf.test.ts` (A-006). Aucun script e2e, visual, smoke ou perf n'a été lancé localement.

Les inventaires de code mort, doublons et clés inutilisées restent des candidats à confronter aux usages. La partie 0 est close comme collecte et examen des contrôles ; les incertitudes ci-dessus ne sont pas déclarées résolues.

## Conservation des preuves

Les journaux originaux sont conservés byte pour byte dans `resultats/*.log.gz`, avec SHA-256 dans `journaux-originaux.json`. Les copies `.log` retirent les codes de couleur et les espaces de fin de ligne ; les citations de l'ancienne identité reçoivent le marqueur documentaire prévu par la garde de renommage. Aucun résultat ni assertion n'est changé. Le contrôle après indexation du rapport a initialement échoué sur une citation historique dans le journal unitaire ; cette erreur documentaire, sans rapport avec l'application auditée, est conservée dans `gardes-docs-apres-rapport.log.gz`.
