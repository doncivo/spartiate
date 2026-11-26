# Reprise — dépôt Spartiate

État au 2026-11-26 : **v0.29.7 publiée** (lot 0.29.7 : CLEAN-0297 #228, puis REL-0.29.7 ; fiche du lot : docs/CLEAN-0297.md ; lot précédent : docs/CLEAN-0296.md ; schéma 23, aucune migration ; décisions jusqu'à D-646 ; questions Q-11 à Q-39 dans docs/decisions-a-prendre.md, avec la revue par thème des choix prudents). **Étape suivante exacte :** plus aucune ligne « à faire » ; restent les « fait en partie » faisables sans Ali (CLEAN-03 : restes de BL-003 et code mort hérité ; signaux des e2e ; 2 traducteurs encore non typés, `tDynamic` et `tProgression`, liste figée `tests/untyped-translators.json`), puis les constats d'Ali (docs/constats-ali.md, sections 0.29.x) et ses décisions. Cadre : docs/LOT-0.29.2.md et docs/LOT-0.29.2-audit.md, D-494 (un seul `gh run watch` par run). iPhone d'Ali bloqué par SideStore depuis le 20/11 : publier reste permis. Fiches docs/<ticket>.md. Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md. PRD v6.3 : docs/prd/README.md. Compte (seul décompte, `node scripts/release/backlog-count.mjs`, BL-147) : Registre : 0 lignes « à faire » (), 97 « fait en partie », 8 « à trancher par Ali », 27 constats d'Ali. Points ouverts : **docs/backlog.md** (D-320, seule liste de « ce qui reste ») ; questions : docs/decisions-a-prendre.md.

## Lot 0.28.0 — où on en est

- Phase 0 : DOC-PRIV fusionné (#156, D-318 à D-321). **HIST-01 fait le 20/11** (docs/HIST-01.md : historique réécrit et poussé en force, PR #127 fermée, D-319, D-324) ; **tous les SHA antérieurs au 20/11 ont changé** (table dans docs/HIST-01.md) ; reste à Ali : recloner `C:\Dev\spartiate-codex`, envoyer la demande de purge à GitHub Support. Les worktrees locaux créés avant le 20/11 12:39 UTC portent l'ancien historique : n'en repousser aucun, recréer depuis origin.
- Lots 0.28.0 à 0.29.1 : PR #157 à #203, détail dans docs/LOT-0.28.0.md, docs/LOT-0.29.0.md, docs/LOT-0.29.1.md et les fiches docs/<ticket>.md.
- **D-333 (Ali, 20/11 19 h 30) : jamais d'arrêt** (ni budget ni compactage ; dépassement consigné) ; ticket bloqué après 3 tentatives : PR en brouillon, cause ici et dans docs/backlog.md, ticket suivant. **D-374 (Ali, 21/11)** : une PR par module, un commit rouge/vert par ticket, une seule mise à jour avec main juste avant la fusion.
- Méthode du lot : un worktree par ticket `C:\Dev\spartiate\.codex-tmp\wt-<ticket>` depuis origin/main, `node_modules` par jonction (`mklink /J`) vers celui de `C:\Dev\spartiate` ; scripts de travail dans `C:\Dev\spartiate\.codex-tmp\lot028\`. `npm run test:bundle` passe aussi depuis un worktree (NETTOYAGE). Le main local de `C:\Dev\spartiate` est ancien et divergent : ne jamais s'y fier, toujours origin/main.
- Pièges : le chapitre du PRD est figé par `prd-split.test.ts` (liste fermée de décisions) : une mise en cohérence passe par une D- ; `scripts/release/privacy.test.ts` refuse toute valeur attribuée à Ali et tout conseil de réinstaller l'app ; aucun `prettier --write`.

## Rappels

- SideStore renouvelé par Ali le 19/11 : prochaine échéance vers le 26/11 (signature de 7 jours ; date exacte affichée dans Plus › À propos et diagnostic).
- **Usage réel commencé le 16/11/2026 (D-292)** : données réelles d’Ali sur le PC, l’iPhone et iCloud Drive/Spartiate ; aucun accès des agents, fixtures synthétiques uniquement ; dépôt public (D-318 (5)). D-69 : HealthKit direct BLOCKED, import par Raccourcis.
- Décisions d'Ali du 20/11 (D-318) : D-243, D-244, D-246, D-291, D-311, D-314 à D-317 validées ; Recovery Split 50 % ; écarts au PRD traités en phase 3 sauf lot 0.29.0 (bilans, import de programme, objectif de pas, zone 2, notes sur 10, VISBODY, pictogrammes).
- Données réelles interdites (voir CLAUDE.md) ; jamais `git fetch circletasks` ; pas de `push --force` (seule exception : HIST-01, D-319), de `reset --hard`, de `rm -rf`, de push sur main ; aucun tag supprimé ou repoussé.
- Suite complète en CI seulement ; en local, des tests ciblés (`--maxWorkers=1`). Une compilation iPhone (`build-ios.yml`, `-f publish=false`) en fin de lot.
- Preuve native : aucun `CONFIRMED` sans constat d'Ali (D-36).
- Bundle de départ : 358 400 octets gzip, liste blanche `tests/bundle/start-modules.json`.
- Secrets : RELEASES_TOKEN, TAURI_SIGNING_PRIVATE_KEY et son mot de passe (noms seulement). Fournisseur IA : aucun (D-294).
