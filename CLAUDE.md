# Spartiate — mémoire projet

App personnelle d'entraînement, nutrition et récupération, pour un seul utilisateur. PC Windows (Tauri 2) et iPhone 16 Pro Max
(Tauri 2 iOS), même code React, livraison unique. Origine : fork de CircleTasks (Tauri 2, React 18, TypeScript strict, Zustand, SQLite, Rust).
Spécification : docs/prd/README.md (chapitres, source de vérité, v6.3 ; docs/PRD.md renvoie à l'index). Décisions : docs/decisions.md et docs/adr/.
Capacités : docs/capability-matrix.md (créée en SPA-001b). Tickets : docs/SPA-*.md ; état courant : docs/reprise.md (≤ 5 Ko, seule mémoire entre sessions).
Référence visuelle : docs/maquettes/ (D-21) ; charte en § 18.4 du PRD (docs/prd/18-navigation-ecrans-et-etats-degrades.md).
Règles de travail (passes, git, périmètre, tri des défauts, A9) : AGENTS.md, qui vaut pour tout agent, Claude Code compris.
Documents de l'ancien projet : docs/archive/circletasks/ (lecture seule, liens de preuve ; archivage complet en SPA-001b, D-40).

## Stack
React 18, Vite, TypeScript strict, Zustand, SQLite (plugin Tauri SQL vendored dans src-tauri/vendor/tauri-plugin-sql), Rust (Tauri 2),
plugins Swift pour iOS (haptics, notification-actions, files, folder-bookmark, privacy-shield, speech, vision ; healthkit et
live-activity à venir ; reminders et web-auth supprimés en SPA-001b), plugin officiel barcode-scanner. Tests : Vitest, Testing Library, Playwright, cargo test.

## Couches (ADR 0001) — dépendances dans ce sens uniquement
domain ← db ← sync, platform, features, ui, i18n
- Règles métier UNIQUEMENT dans src/domain (pur, sans import Tauri ni React).
- Accès DB UNIQUEMENT via src/db/repositories.
- Migrations TypeScript dans src/db/migrations (registre index.ts, migrateur src/db/migrator.ts, schema_migrations).
- Synchro : toute PR touchant src/sync/**, src/domain/sync/** ou src-tauri/src/sync/** est relue par l'agent sync-icloud
  avec périmètre écrit et tests de non-régression (D-26). Catalogue : src/domain/sync/syncTables.ts.
- Plugins Swift dans src-tauri/plugins/<nom>/ios, façade dans src/platform/<nom>, stub Windows obligatoire.

## Commandes
npm run dev | npm run tauri dev | npm run test | npm run lint | npm run typecheck | npm run test:bundle | npm run tauri build
Migrations : npx vitest run --coverage.enabled=false src/db/migrator.test.ts src/db/migrations
Contrôles documentaires et d'identité : npx vitest run --coverage.enabled=false --project node scripts/release/identity.test.ts scripts/release/agents.test.ts scripts/release/docs-paths.test.ts scripts/release/prd-split.test.ts scripts/release/rename.test.ts
Rust (dans src-tauri) : cargo test --locked --features test-hooks --test desktop | cargo test --locked -p tauri-plugin-sql --features sqlite
| cargo clippy --locked -- -D warnings
En CI seulement : e2e (pc, iphone, iphone-webkit), visual, test:smoke, test:nsis, test:perf — jamais en local sur ce PC.

## Règles
- Un ticket SPA-xxx = une branche = une PR ; ID dans chaque commit (ex. « SPA-001a : tests rouges »).
- Interface en français, heures en 24 h, textes dans src/i18n, jamais en dur ; locale fr seule (infrastructure i18n conservée).
- Tokens de couleur dans src/ui/theme/tokens.css, aucune couleur en dur ; les maquettes sont la référence visuelle.
- Pas de Mac : aucune commande iOS locale ; builds iOS via .github/workflows/build-ios.yml, installation par SideStore.
- Mise à jour PC par plugin updater et dépôt public spartiate-releases ; non configuré avant SPA-002 (D-30).
- Synchro par journaux chiffrés dans iCloud Drive (hlc, schema_version) ; téléchargement forcé des fichiers avant lecture.
- Notifications émises sur l'iPhone uniquement ; le PC n'envoie aucune notification.
- Pas de secret en clair ; jetons dans le coffre système ; secrets GitHub nommés RELEASES_TOKEN, TAURI_SIGNING_PRIVATE_KEY,
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD (noms seulement).
- Bundle de départ : plafond 358 400 octets gzip (tests/bundle/startBundle.test.ts), toujours écrit en octets, jamais relevé. Tout écran,
  fenêtre, bandeau ou catalogue de textes qui ne sert pas au premier affichage d'Aujourd'hui est en chargement à la demande dès sa
  création (import dynamique, catalogue i18n chargé avec lui, assertion « hors du départ »), jamais après coup (décision d'Ali du
  2026-10-18, docs/archive/circletasks/ pour l'audit d'origine). Garde par liste blanche tests/bundle/start-modules.json (BUNDLE-01) : tout
  module nouveau dans le départ est refusé, la liste ne s'étend que par un commit qui le justifie (`ajouts` : ID de ticket et raison) ;
  mesure normalisée insensible aux hachages (tests/bundle/bundleMeasure.ts, relevé par `node tests/bundle/measureStart.ts <dossier>`) ;
  le plafond reste le dernier juge.
- Toute hypothèse non prouvée = H-n dans le PRD § 26.2 + ligne UNVERIFIED dans capability-matrix.md ; aucun CONFIRMED depuis une
  lecture de code (D-36). Toute décision structurante = ligne dans docs/decisions.md ou ADR numéroté.
- Le PRD est lu par chapitre (docs/prd/NN-*.md, D-49) : un ticket cite des chapitres, jamais « le PRD ».
- Budget tokens annoncé par ticket (S 50k / M 150k / L 400k) ; dépassement = arrêt et point d'étape. Une session par ticket (D-52) ;
  rapport de fin ≤ 15 lignes.

## Délégation
Tout agent (Codex, Claude Code ou autre) assure lui-même product-owner, agent du module, qa-test puis code-reviewer en passes distinctes,
dans cet ordre, et consigne chaque résultat (décision d'Ali du 2026-10-19, étendue à tout agent le 2026-10-27 ; détails dans AGENTS.md).
Les 24 fiches de rôle sont dans .claude/agents/ (README : matrice de propriété des zones sensibles).

## Méthode
- Suite complète dans la CI, plus en local : unitaires, Rust, e2e pc et iphone, perf et bundle, smoke Windows sur des runners parallèles
  (.github/workflows/tests.yml, seul workflow de tests), à chaque push de branche. En local : seulement les tests du module en cours.
- Une fusion dans main attend la CI verte sur la branche (statut « suite verte », branche à jour), jamais une suite locale.
- Pendant qu'un lot est en QA ou en revue, le développement du lot suivant démarre s'il ne touche pas les mêmes dossiers.
- Une seule compilation iPhone (build-ios.yml) par lot terminé, pas une par essai ; exception SideStore N → N+1 dans AGENTS.md.
- Pas de « fait » sans test rouge avant et vert après, tests verts, lint, typage et revue approuvée ; jamais de test désactivé,
  allongé, retardé ni test.fixme de commodité ; aucun échec silencieux.
- Mécanique par script, jamais fichier par fichier par un agent (D-51) ; vérifications déterministes avant toute relecture (D-50).

## Interdits
- Lire ou écrire les données réelles de CircleTasks : %APPDATA%\fr.circletasks.planner, iCloud Drive/CircleTasks — toujours.
- Lire ou écrire les données réelles de Spartiate : %APPDATA%\fr.spartiate.app, iCloud Drive/Spartiate, conteneur iPhone — dès la
  première utilisation réelle annoncée par Ali dans docs/decisions.md (avant : conteneur de laboratoire, D-38).
- Écrire hors de C:\Dev\spartiate et de ses worktrees ; fichiers temporaires sous .codex-tmp/ (ignoré par git).
- Secrets dans le dépôt, les logs, les artefacts CI, les prompts.
- git push --force, git reset --hard, rm -rf ; boucle de surveillance de la CI (une lecture à la fois).
- Demander à Ali d'exécuter un installeur ; supprimer l'app sideloadée (perte de données).
- Envoyer des données corporelles (HRV, FC, sommeil, poids, photos) à une API.
- Ajouter une fonction de la liste « Hors périmètre » du PRD (§ 8).
