# AUDIT-0.26.0 — rapport en cours

**SHA audité : `8686a8fc2860f7a94eb193426cbcc640a33bac80`.** Version publiée 0.26.0, schéma à vérifier par les contrôles. Début : 16 novembre 2026.
Couverture de relecture : **50 / 2 047 fichiers (2,44 %)**, dont 50 / 1 046 de production/outillage, 81 fichiers vendored exclus. Inventaire réconcilié en partie 1 : 389 omissions ajoutées, dont 356 tests/supports ; le banc complet en compte 1 001. Une lecture mécanique n'est pas une relecture sémantique ; une lecture dans une passe ne valide pas tous les scénarios.
Partie 0 terminée : typecheck/lint/contenu/docs/bundle/fmt/clippy verts ; 24 échecs unitaires et 12 erreurs non interceptées ; Rust desktop 846 verts, SQL 30 + 1 verts après préparation du dossier de fixtures. Audits des dépendances détaillés dans `partie-00.md`. **Audit global incomplet : aucune conclusion de conformité ni de sécurité.**

## Constats

Chaque constat sera identifié A-001, A-002… avec gravité, partie, fichier et ligne, entrée → résultat, preuve et correction proposée. Sans preuve : « à vérifier », jamais bloquant.

| ID | Gravité | Partie | Fichier:ligne | Description et scénario | Preuve | Correction suggérée |
| --- | --- | --- | --- | --- | --- | --- |
| A-001 | important (outillage ; exploitation dans Spartiate à vérifier) | 0 | `package-lock.json:4386`, `package-lock.json:4776`, `package-lock.json:3663` | Installer exactement le lock de la 0.26.0 puis lancer l'audit complet → code 1, 11 paquets signalés (2 élevés, 9 modérés). Undici et Zod portent les alertes élevées ; minimatch affecte la chaîne ESLint. Les entrées réseau ou collections malformées décrites par les avis peuvent toucher ces versions, mais aucun scénario d'exploitation par une entrée de l'app n'est prouvé ici. L'audit production donne zéro alerte : ne pas présenter ceci comme une fuite de l'app. | `preuves/resultats/npm-ci.json`, `preuves/resultats/npm-audit-complet.log`, `preuves/resultats/npm-audit-prod.log` ; avis et plages conservés dans la sortie npm. | Mettre à jour les seules dépendances de développement concernées avec lockfile et contrôles complets, sans `audit fix --force`. |

## Limites

### A-002 — mineur — partie 0 — couleurs hors tokens

- Fichiers : `src/ui/Sheet.css:5`, `src/ui/ConfirmDialog.css:9`, `src/features/sync/IosPairingScreen.css:3` (autres candidats dans `preuves/candidats-statiques.json`).
- Scénario : modifier les couleurs centrales de `tokens.css` → le fond de la feuille conserve `#6e6687` et le voile de confirmation conserve sa valeur RGBA. Écart au contrat de centralisation de CLAUDE.md ; aucun défaut de contraste ni perte de données démontré.
- Preuve : assertion rouge A-002 dans `preuves/partie0-rouges.test.mjs`, sortie `preuves/resultats/partie0-rouges-exec.log` ; les valeurs sont directement utilisées dans les règles CSS.
- Correction suggérée : centraliser les couleurs de ces composants dans des tokens nommés, en conservant le rendu validé.

### A-003 — mineur — partie 0 — inventaire des licences incomplet

- Fichiers : `package.json:45`, `package.json:47`, `docs/licences.md:1` (document entier).
- Scénario : rapprocher les dépendances de production du manifeste du document des licences → `react-dom` et `zustand` n'y figurent pas, contrairement au critère d'inventaire demandé pour l'audit.
- Preuve : assertion rouge A-003 dans `preuves/partie0-rouges.test.mjs`, sortie `preuves/resultats/partie0-rouges-exec.log` ; inventaire des licences déclarées dans `preuves/dependances-npm.json`.
- Limite : ceci prouve une omission documentaire, pas une incompatibilité juridique ni l'absence d'avis dans les binaires. Les mentions livrées restent à vérifier.
- Correction suggérée : produire un inventaire des dépendances résolues et de leurs avis, puis le référencer depuis `docs/licences.md`.

## Périmètre des preuves

### A-004 — important (validation ; causes fonctionnelles à vérifier) — partie 0

- Fichiers : `src/features/training/session/SessionScreen.test.tsx:113`, `tests/unit/sync/epochCarryReplacedParentResume.test.ts:97`, `tests/unit/sync/epochCarryReplacedParentResume.test.ts:115`, `src/features/nutrition/supplements/SupplementsView.tsx:127` ; liste exhaustive des positions dans `preuves/unitaires-resume.json`.
- Scénario : exécuter le SHA figé avec couverture et un worker → 24 tests échouent et 12 rejets d'import sont observés après démontage, alors que les 9 167 tests du même SHA passent en CI. Les trois assertions sur `reference` nulle sont expliquées par la dépendance entre tests : la référence est initialisée uniquement par le test précédent, qui dépasse 5 000 ms.
- Preuve : `preuves/resultats/unitaires.log`, `preuves/unitaires-echecs.json`. La mesure de durée est isolée en A-006. Les rejets post-démontage correspondent à un effet qui lance `void import(...).then(...)` sans attente ni traitement du rejet ; le nettoyage ne fait que mettre `live` à false.
- Limite : un échec d'attente n'établit pas une mauvaise prescription ou une divergence. La charge du poste, les causes des attentes DOM et l'impact de l'effet en production restent à vérifier en parties 7 et 11.
- Correction suggérée : rendre indépendantes les références des tests, maîtriser la fin des travaux asynchrones et établir les causes des attentes sans relance automatique ni délai allongé.

### A-005 — amélioration (exposition à vérifier) — partie 0 — avertissements Rust

- Fichiers : `src-tauri/Cargo.lock:5421` (tokio), `src-tauri/Cargo.lock:3714` (rustix), `src-tauri/Cargo.lock:3628` (rsa), `.github/workflows/tests.yml:250`.
- Scénario : auditer le lock de la version → huit avertissements restent autorisés dans le job vert, dont `tokio 1.53.1` et `rustix 1.1.5` signalés pour sûreté mémoire ; correctifs déclarés par les avis pour ces versions.
- Preuve : `preuves/cargo-alertes.json`, sorties locales et CI. L'alerte RSA est distincte et son absence du graphe normal/build est vérifiée pour toutes les cibles dans `resultats/cargo-rsa-graphe.log`.
- Limite : aucune entrée de Spartiate atteignant les fonctions vulnérables n'est démontrée. Ne pas qualifier cela de fuite ni de corruption de données.
- Correction suggérée : vérifier les chemins compilés Windows/iOS et actualiser les dépendances concernées en conservant les preuves de non-exposition et les contrôles.

### A-006 — mineur — partie 0 — mesure de performance dans la suite unitaire

- Fichier : `src/db/repositories/sql/checklistRepository.test.ts:144`, assertion ligne 152 ; `vitest.config.ts:23`.
- Scénario : lancer `npm run test` sans demander de performance → la création de 200 items est chronométrée, 331,98 ms fait échouer la borne de 300 ms. Le test ne porte pas le suffixe `.perf.test.ts`, donc l'exclusion de la suite unitaire ne l'isole pas.
- Preuve : première exécution conservée dans `resultats/unitaires.log` et `unitaires-echecs.json`. Aucun script de performance n'a été lancé par l'audit.
- Correction suggérée : conserver les assertions transactionnelles en unitaire et déplacer la borne chronométrée dans la suite perf exécutée uniquement en CI.

Les résultats natifs et les performances sur appareil ne peuvent être établis localement. Les seules données autorisées sont synthétiques. Les constats des relectures précédentes sont des pistes, pas des preuves pour ce SHA.

## Corrections prioritaires et traçabilité

### A-007 — mineur — partie 1 — import Tauri hors façade

`src/features/settings/theme.ts:42` importe dynamiquement `@tauri-apps/api/window` hors de `platform`. La garde `eslint.config.js` refuse la forme statique mais laisse passer cette forme dynamique. Preuves : `preuves/partie1.json`, deux assertions rouges dans `preuves/resultats/partie1-rouges.log` ; analyse et correction proposée dans `partie-01.md`. Impact établi : frontière d'architecture et garde incomplète ; aucune perte de données ni mauvaise prescription démontrée. Partie 1 terminée, autres parties ouvertes. Aucun correctif applicatif réalisé.

À établir après les douze parties de relecture. Aucun ticket présenté comme prêt avant preuve et définition de son périmètre.
