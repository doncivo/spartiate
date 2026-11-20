# Reprise — dépôt Spartiate

État au 2026-11-20 : **lot 0.28.0 en cours** (docs/LOT-0.28.0.md, prompt d'Ali ; schéma 20, version 0.27.0 publiée). Fiches docs/<ticket>.md. Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md. PRD v6.3 : docs/prd/README.md. Décisions D-22 à D-247, D-250 à D-253 et D-260 à D-322 dans docs/decisions.md. Points ouverts : **docs/backlog.md** (D-320, seule liste de « ce qui reste »).

## Lot 0.28.0 — où on en est

- Phase 0 : DOC-PRIV fusionné (#156, D-318 à D-321). **HIST-01 reporté en fin de lot** : condition non remplie (PR #127 « Relecture Codex 13/11 » encore ouverte ; conditions et étapes : docs/LOT-0.28.0.md 0.2). Motifs hors dépôt : `C:\Dev\spartiate\.codex-tmp\hist01-motifs.txt` (jamais commité).
- Phase 1 : FIX-ASSIST (D-322) en PR ; **suivant : FIX-ABERR** (C-005, C-028, C-168), puis FIX-A008, FIX-A009 (audit Codex, `git show origin/audit-0.26.0:docs/audit-0.26.0/bloquants.md`, à relire au début de chaque phase).
- Phase 2 puis 3 : ordre dans docs/LOT-0.28.0.md.
- Méthode du lot : un worktree par ticket `C:\Dev\spartiate\.codex-tmp\wt-<ticket>` depuis origin/main, `node_modules` par jonction (`mklink /J`) vers celui de `C:\Dev\spartiate` ; scripts de travail dans `C:\Dev\spartiate\.codex-tmp\lot028\`. `pairingBundle.test` échoue seulement depuis un worktree (point 3.4) ; le reste de `npm run test:bundle` doit être vert. Le main local de `C:\Dev\spartiate` est ancien et divergent : ne jamais s'y fier, toujours origin/main.
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
