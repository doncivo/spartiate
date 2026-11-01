# AGENTS.md — règles de travail sur Spartiate, pour tout agent

Ces règles valent pour tout agent qui travaille sur ce dépôt : Codex, Claude Code ou un autre. Elles ont été écrites pour Codex le 2026-10-19, étendues à tout agent par décision d'Ali du 2026-10-27, puis fusionnées avec celles de Spartiate en SPA-001a (D-42) : les règles permanentes sont conservées, le métier de l'ancien projet est retiré, le périmètre est `C:\Dev\spartiate`.

Lis d'abord `CLAUDE.md` (stack, commandes, couches, bundle de départ : il ne se répète pas ici), puis `docs/reprise.md` (état courant, ≤ 5 Ko, mis à jour à chaque jalon). La spécification est `docs/prd/README.md` (chapitres, D-49) ; `docs/PRD.md` n'est qu'une page de renvoi. Ne modifie le fond du PRD que par une décision D-n d'Ali ; `docs-writer` ne porte qu'une décision déjà inscrite, en commit dédié.

## Référence visuelle

- `docs/maquettes/` (D-21) est la référence pour tous les écrans ; la charte est le chapitre 18 du PRD (§ 18.4). Écran sans maquette : motifs de Plus / Réglages, consigné dans `docs/decisions.md`.
- Les maquettes de l'ancien projet sont archivées avec ses documents (`docs/archive/circletasks/`, lecture seule) et ne font plus référence.
- Quand une fiche cite un commit de maquette comme référence, elle cite un commit fusionné dans `main`.

## Règles permanentes

- Après chaque compaction du contexte, relis `AGENTS.md`, `CLAUDE.md` et `docs/reprise.md` avant de reprendre ; distingue les décisions déjà tranchées des états historiques.
- Ne désactive, ne saute et ne retarde jamais un test instable. Cherche la cause, corrige-la, note cause et correctif dans `docs/journal.md`. Aucun délai ajouté, aucun timeout allongé, aucune relance automatique. Pas de `test.fixme` de commodité : on adapte le test, ou on supprime celui d'une fonction effectivement supprimée.
- Ne relâche jamais un seuil de taille ni de couverture pour faire passer un test. Le plafond du bundle de départ (`tests/bundle/startBundle.test.ts`, **358 400 octets gzip**, toujours écrit en octets) et le seuil de couverture de `src/domain` (80 % ; 90 % pour `src/domain/training`) ne bougent pas.
- Aucune défaillance silencieuse. Toute erreur durable est visible dans l'app (ligne d'état dans Plus / Réglages, écran Détails, bandeau A-09), persistante après redémarrage, effacée seulement au succès. Un journal technique seul ne suffit jamais.
- Vingt minutes maximum sur une tâche de documentation. Au-delà, arrête-toi, sauve le travail en cours sur une branche et dis à Ali ce qui bloque.
- Si un remplacement exact dans un fichier échoue deux fois de suite, ne réessaie pas : relis la section une fois et réécris-la entière d'un bloc.
- Si une estimation dérape de plus de 50 %, arrête-toi à un point de commit et préviens Ali avant de continuer (budgets par ticket : S 50 k, M 150 k, L 400 k tokens).
- Mesure le bundle de départ (`npm run test:bundle`) avant tout push, même pour un texte déplacé.
- Interface en français, heures en 24 h, textes dans `src/i18n`, jamais en dur.
- Mécanique par script, jamais fichier par fichier (D-51) ; un agent ne lit un fichier que pour décider, pas pour « vérifier » ce qu'un test peut vérifier (D-50).
- **Aucune boucle de surveillance en arrière-plan sur ce PC (règle d'Ali du 2026-10-30).** Tu lis l'état d'une CI une fois, quand tu en as besoin, par une seule requête (`gh pr checks <n>`, `gh run view <id>`). Si elle n'est pas finie, tu fais autre chose et tu relis plus tard. Tu ne crées jamais de processus qui attend (boucle `until`/`while`, `sleep` répété, tâche de fond qui interroge GitHub) : chaque tour de boucle lance un processus, et la machine a déjà manqué de mémoire à cause de cela. GitHub exécute la CI de son côté, que tu la regardes ou non. Un travail arrêté par le système pour manque de mémoire n'est pas relancé sans demande, et `CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP` n'est jamais utilisé.

## Périmètre d'écriture et de lecture (décision d'Ali du 2026-10-27, adaptée en SPA-001a)

- Interdiction d'écrire, de modifier ou de supprimer quoi que ce soit hors de `C:\Dev\spartiate` et de ses worktrees. Fichiers temporaires dans le worktree, sous `.codex-tmp/` (ignoré par git), jamais commités.
- Interdiction absolue de toucher aux données réelles de CircleTasks, en lecture comme en écriture, y compris pour un diagnostic : `%APPDATA%\fr.circletasks.planner` et le dossier iCloud `iCloud Drive/CircleTasks` — toujours. Si une information s'y trouve, demande à Ali de l'extraire lui-même.
- Données réelles de Spartiate (`%APPDATA%\fr.spartiate.app`, `iCloud Drive/Spartiate`, conteneur iPhone) : conteneur de laboratoire jusqu'à la première utilisation réelle annoncée par Ali dans `docs/decisions.md` (D-38) ; ensuite interdites comme celles de CircleTasks. Fixtures synthétiques uniquement ; smoke, Rust et e2e en CI. Aucun agent ne supprime de conteneur (D-54).
- Lire un fichier qu'Ali désigne explicitement, par exemple un export de journal iPhone déposé dans iCloud Drive, est permis. Toute autre lecture hors dépôt se demande d'abord.

## Tri des défauts

- Un défaut qui perd des données, ou qui affiche un état faux sans le dire, passe avant la fin de l'itération en cours : ouvre le ticket à l'étape courante, consigne le constat dans `docs/journal.md`, informe Ali en une phrase disant ce que lui voit.
- Un défaut visible, qu'Ali peut signaler lui-même, passe après : ligne au backlog du ticket concerné.
- N'interroge Ali que si tu hésites entre les deux.

## Workflow git

- Une branche par ticket, ID du ticket dans chaque message de commit (ex. `SPA-001a : tests rouges`). Les commits de documentation transverse portent aussi un identifiant (`CADRAGE-01 : …`, `AGENTS : …`).
- Une PR par branche (`gh pr create --base main`). La protection de `main` impose la PR et le statut « suite verte » avec branche à jour : aucun push direct sur `main`, même pour la documentation.
- Fusion seulement quand `gh pr checks` montre « suite verte » vert et que la passe de revue est approuvée dans la fiche du ticket : `gh pr merge <n> --merge`. L'approbation GitHub n'est pas requise : GitHub interdit à l'auteur d'approuver sa propre PR, et l'agent assure lui-même la revue en passe distincte (décision d'Ali du 2026-10-19). Jamais `--auto`, jamais `--force`. Pour mettre à jour une branche publiée, fusionne `main` dedans ; ne réécris pas son historique, surtout quand une fiche cite un de ses commits.
- Relecture Codex bornée (D-53) : une par PR, après CI verte, sur le diff, avec les critères du ticket et un rapport ≤ 40 lignes ; toute correction qui en découle passe d'abord par un test qui la détecte.
- En local, lance seulement les tests du module en cours ; la suite complète tourne dans GitHub Actions à chaque push (`.github/workflows/tests.yml`, seul workflow de tests ; `build-windows.yml` et `build-ios.yml` compilent).
- **Sur le PC d'Ali, seuls les tests légers tournent : unitaires et DOM (Vitest). Les e2e Playwright (`pc`, `iphone`, `iphone-webkit`) tournent dans la CI, jamais en local** (décision d'Ali du 2026-10-28). Le poste n'a pas la mémoire pour, et un résultat obtenu en manquant de mémoire n'est pas un résultat. Quand la branche est prête (typage, lint, garde du bundle, suites Vitest du module), pousse et laisse la CI trancher ; un run de plus coûte moins qu'un résultat sans valeur. Si un e2e local est indispensable pour un diagnostic, préviens Ali avant de le lancer : il ferme ce qu'il faut. N'utilise jamais la variable `CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP` : elle masque le problème au lieu de le résoudre.
- Pour un test ciblé, coupe la couverture (`--coverage.enabled=false`) : le seuil de 80 % de `src/domain` s'applique à la suite complète. La validation d'un ticket exige la suite complète avec couverture active.
- **Test rouge avant, vert après, pour tout ticket sans exception**, correctif ou refonte : un commit qui n'ajoute que les tests et échoue, puis un commit de code qui les fait passer ; les deux identifiants (commit ou run) vont dans la fiche. Des tests écrits dans le même commit que le code ne valent pas preuve rouge. Une fixture invalide correctement rejetée ne constitue pas, à elle seule, une preuve rouge.
- Aucun ticket n'est « fait » sans tests verts, lint, typecheck et relecture approuvée. Une vérification native encore ouverte s'écrit dans le statut ; elle n'empêche pas « code fusionné », elle empêche « fait ». Aucun statut `CONFIRMED` depuis une lecture de code (D-36).
- Vérifie qu'aucun secret n'est suivi par git avant chaque push.

## iOS

La chaîne est : CI macOS (`tauri ios build --ci --no-sign`) → codesign ad-hoc + entitlements → IPA → `spartiate-releases/source.json` → SideStore. Aucun agent ne possède de Mac ni de compte développeur ; toute preuve iPhone vient d'Ali (capture) ou de la CI (log).

- Une seule compilation iPhone (`build-ios.yml`, lancement manuel ou tag `ios-v*`) par lot terminé, pas une par essai, et jamais pour un changement de documentation.
- Exception explicite : l'essai de mise à jour SideStore N → N+1 (SPA-010) utilise l'IPA déjà installée comme N ; une seule nouvelle compilation fournit N+1.
- Ne désinstalle jamais l'app sideloadée et ne conseille jamais la réinstallation : la perte de données est irréversible.

## Synchro

Toute PR touchant `src/sync/**`, `src/domain/sync/**` ou `src-tauri/src/sync/**` porte un périmètre écrit, est relue par l'agent `sync-icloud` et ajoute des tests de non-régression (deux bases, conflit, instantané, reset, oubli, reprise). Invariants intouchables : protocole chiffré, HLC par champ, tombstones, reprise, reset, oubli d'appareil (D-26).

## Interdit

- Ne demande jamais à Ali de lancer un installeur à la main sur le PC. La seule voie est la bannière de mise à jour dans l'app (plugin updater, SPA-002) ; l'installeur est éprouvé par le smoke CI (D-39). Le désinstalleur NSIS a déjà effacé des données une fois.
- N'ajoute aucune fonction de la liste « Hors périmètre » du PRD (§ 8).
- Aucun secret dans le dépôt, les logs, les artefacts CI ou les prompts ; aucune donnée corporelle envoyée à une API.

## Bundle de départ et écrans à la demande

Règle complète dans `CLAUDE.md`. Rappels : le plafond ne bouge pas ; tout écran, fenêtre, bandeau ou catalogue de textes hors du premier affichage d'« Aujourd'hui » est à la demande dès sa création ; la garde `tests/bundle/start-modules.json` refuse tout module nouveau dans le départ et ne s'étend que par un commit qui le justifie. Piège connu : un bloc à la demande qui importe un module du départ sort ce module du bloc principal et coûte des kilo-octets de compression ; donne aux écrans à la demande leur propre hôte et un module de vue séparé.

## Passes de travail (décision d'Ali du 2026-10-19, étendue à tout agent le 2026-10-27)

L'agent assure lui-même product-owner → agent du module → qa-test → code-reviewer en passes séparées, dans cet ordre, et consigne chaque résultat dans la fiche du ticket (`docs/SPA-0xx.md`). La revue relit le diff à froid et s'appuie sur les tests, sans se fier au souvenir de l'écriture. Un ticket non vérifié ne porte jamais le statut « fait ». Les contrats des rôles sont dans `.claude/agents/` ; un écart avec une fiche se tranche par le propriétaire de la zone (README du dossier).

## A9 — décision d'Ali du 21 octobre 2026 (héritée)

A9 n'est plus bloquant avant un changement de schéma ni pour l'usage personnel d'Ali. Il redevient bloquant si et seulement si l'app sort de l'usage personnel d'Ali ; sa vérification est alors obligatoire avant toute distribution à des tiers ou utilisation multi-utilisateur. Ce statut est un trou assumé, pas un ticket reporté ni un essai réussi.
Avant toute mise à jour changeant le schéma, vérifie qu'une sauvegarde iCloud récente existe. Ne jamais présenter cette vérification comme une restauration éprouvée ; la preuve de restauration et de mise à jour sans perte sur Spartiate relève de SPA-010 (D-36).
