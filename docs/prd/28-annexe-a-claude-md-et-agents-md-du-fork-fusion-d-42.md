## Annexe A — `CLAUDE.md` et `AGENTS.md` du fork (fusion, D-42)

Les deux fichiers de CircleTasks ne sont **pas remplacés** : leurs règles permanentes sont conservées, le métier CircleTasks est retiré, le périmètre devient `C:\Dev\spartiate`. Le texte ci-dessous est la cible après SPA-001a / 001b.

### A.1 `CLAUDE.md` (racine du dépôt `doncivo/spartiate`)

```md
# Spartiate — mémoire projet

App personnelle d'entraînement, nutrition et récupération, pour un seul utilisateur. PC Windows (Tauri 2) et iPhone 16 Pro Max
(Tauri 2 iOS), même code React, livraison unique. Fork de CircleTasks (Tauri 2, React 18, TypeScript strict, Zustand, SQLite, Rust).
Spécification : docs/PRD.md (source de vérité, v6.2+). Décisions : docs/decisions.md et docs/adr/. Capacités : docs/capability-matrix.md.
Référence visuelle : docs/maquettes/ (24 planches du 31 octobre 2026, ouvrir index.html) ; charte en § 18.4 du PRD.
Règles de travail (passes, git, périmètre, tri des défauts, A-09) : AGENTS.md, qui vaut pour tout agent, Claude Code compris.
Archive CircleTasks : docs/archive/circletasks/ (lecture seule, liens de preuve).

## Stack
React 18, Vite, TypeScript strict, Zustand, SQLite (plugin Tauri SQL vendored dans src-tauri/vendor/tauri-plugin-sql), Rust (Tauri 2),
plugins Swift pour iOS (haptics, notification-actions, files, folder-bookmark, privacy-shield, speech, vision ; healthkit et
live-activity à venir), plugin officiel barcode-scanner. Tests : Vitest, Testing Library, Playwright, cargo test.

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
Rust (dans src-tauri) : cargo test --locked --features test-hooks --test desktop | cargo test --locked -p tauri-plugin-sql --features sqlite
| cargo clippy --locked -- -D warnings
En CI seulement : e2e (pc, iphone, iphone-webkit), visual, test:smoke, test:nsis, test:perf — jamais en local sur ce PC.

## Règles
- Un ticket SPA-xxx = une branche = une PR ; ID dans chaque commit.
- Interface en français, heures en 24 h, textes dans src/i18n, jamais en dur ; locale fr seule.
- Tokens de couleur dans src/ui/theme/tokens.css, aucune couleur en dur ; les maquettes sont la référence visuelle.
- Pas de Mac : aucune commande iOS locale ; builds iOS via .github/workflows/build-ios.yml, installation par SideStore.
- Mise à jour PC par plugin updater et dépôt public spartiate-releases ; non configuré avant SPA-002.
- Synchro par journaux chiffrés dans iCloud Drive (hlc, schema_version) ; téléchargement forcé des fichiers avant lecture.
- Notifications émises sur l'iPhone uniquement ; le PC n'envoie aucune notification.
- Pas de secret en clair ; jetons dans le coffre système ; secrets GitHub nommés RELEASES_TOKEN, TAURI_SIGNING_PRIVATE_KEY,
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD (noms seulement).
- Bundle de départ : plafond 358 400 octets gzip (tests/bundle/startBundle.test.ts), toujours écrit en octets, jamais relevé. Tout écran,
  fenêtre, bandeau ou catalogue de textes qui ne sert pas au premier affichage d'Aujourd'hui est en chargement à la demande dès sa
  création (import dynamique, catalogue i18n chargé avec lui, assertion « hors du départ »), jamais après coup. Garde par liste blanche
  tests/bundle/start-modules.json : tout module nouveau dans le départ est refusé, la liste ne s'étend que par un commit qui le justifie ;
  mesure normalisée insensible aux hachages ; le plafond reste le dernier juge.
- Toute hypothèse non prouvée = H-n dans docs/PRD.md § 26.2 + ligne UNVERIFIED dans capability-matrix.md ; aucun CONFIRMED depuis une
  lecture de code. Toute décision structurante = ligne dans docs/decisions.md ou ADR numéroté.
- Budget tokens annoncé par ticket (S 50k / M 150k / L 400k) ; dépassement = arrêt et point d'étape.

## Délégation
Tout agent (Codex, Claude Code ou autre) assure lui-même product-owner, agent du module, qa-test puis code-reviewer en passes distinctes,
dans cet ordre, et consigne chaque résultat (détails dans AGENTS.md).

## Méthode
- Suite complète dans la CI, plus en local : unitaires, Rust, e2e pc et iphone, perf et bundle, smoke Windows sur des runners parallèles
  (.github/workflows/tests.yml, seul workflow de tests), à chaque push de branche. En local : seulement les tests du module en cours.
- Une fusion dans main attend la CI verte sur la branche (statut « suite verte », branche à jour), jamais une suite locale.
- Une seule compilation iPhone (build-ios.yml) par lot terminé, pas une par essai ; exception SideStore N → N+1 dans AGENTS.md.
- Pas de « fait » sans test rouge avant et vert après, tests verts, lint, typage et revue approuvée ; jamais de test désactivé,
  retardé ou test.fixme de commodité ; aucun échec silencieux.

## Interdits
- Lire ou écrire les données réelles de CircleTasks : %APPDATA%\fr.circletasks.planner, iCloud Drive/CircleTasks — toujours.
- Lire ou écrire les données réelles de Spartiate : %APPDATA%\fr.spartiate.app, iCloud Drive/Spartiate, conteneur iPhone — dès la
  première utilisation réelle annoncée par Ali dans docs/decisions.md (avant : conteneur de laboratoire, D-38).
- Écrire hors de C:\Dev\spartiate et de ses worktrees ; fichiers temporaires sous .codex-tmp/ (ignoré par git).
- Secrets dans le dépôt, les logs, les artefacts CI, les prompts.
- git push --force, git reset --hard, rm -rf ; boucle de surveillance de la CI (une lecture à la fois).
- Demander à Ali d'exécuter un installeur ; supprimer l'app sideloadée (perte de données).
- Envoyer des données corporelles (HRV, FC, sommeil, poids, photos) à une API.
```

### A.2 `AGENTS.md` — sections adaptées (le reste des règles permanentes CircleTasks est conservé mot pour mot)

```md
## Périmètre d'écriture et de lecture
- Interdiction d'écrire, de modifier ou de supprimer quoi que ce soit hors de C:\Dev\spartiate et de ses worktrees.
- Données réelles de CircleTasks (%APPDATA%\fr.circletasks.planner, iCloud CircleTasks) : interdites en permanence, lecture comme écriture.
- Données réelles de Spartiate : conteneur de laboratoire jusqu'à la première utilisation réelle annoncée par Ali (docs/decisions.md) ;
  ensuite interdites comme celles de CircleTasks. Fixtures synthétiques uniquement ; smoke, Rust et e2e en CI.
- Lire un fichier qu'Ali désigne explicitement (export, journal iPhone déposé dans iCloud Drive) est permis.

## Référence visuelle
docs/maquettes/ (24 planches Spartiate du 31 octobre 2026, D-21) pour tous les écrans ; écran sans maquette → motifs de Plus / Réglages,
consigné dans docs/decisions.md. Les maquettes CircleTasks sont archivées (docs/archive/circletasks/) et ne font plus référence.

## iOS
La chaîne est : CI macOS (tauri ios build --ci --no-sign) → codesign ad-hoc + entitlements → IPA → spartiate-releases/source.json
→ SideStore. Aucun agent ne possède de Mac ni de compte développeur ; toute preuve iPhone vient d'Ali (capture) ou de la CI (log).
Une seule compilation iPhone par lot ; exception N → N+1 : l'IPA installée sert de N, une compilation fournit N+1 (SPA-010).

## Synchro
Toute PR touchant src/sync/**, src/domain/sync/** ou src-tauri/src/sync/** porte un périmètre écrit, est relue par l'agent sync-icloud
et ajoute des tests de non-régression (deux bases, conflit, instantané, reset, oubli, reprise). Invariants intouchables : protocole
chiffré, HLC par champ, tombstones, reprise, reset, oubli d'appareil.

## Passes de travail
L'agent assure lui-même product-owner → agent du module → qa-test → code-reviewer en passes séparées, dans cet ordre, et consigne
chaque résultat dans la fiche. Test rouge avant, vert après, pour toute story sans exception (deux commits identifiés). Pas de
test.fixme de commodité : on adapte le test ou on supprime celui d'une fonction effectivement supprimée. Mesure du bundle
(npm run test:bundle) avant tout push. Codex relit chaque PR ; code-reviewer vérifie couches, sécurité § 22, tests, DoD § 24.4.
```
