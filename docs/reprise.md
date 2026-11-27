# Reprise — dépôt Spartiate

État au 2026-11-27 : **v0.30.2 en publication** (lot 0.30.2, D-765 à D-796 : FIX-0302b #246, FIX-0302a #247, DEC-0302 #248, NOTIF-0302 #249, SYNC-0302 #250, SESS-0302 #251 (schéma 24), FIX-0302c #252, EQUIP-0302 #253 (schéma 25), puis REL-0.30.2) ; v0.30.1 publiée ; plus aucune question ouverte ; plan des lots : D-696 et D-769. **Étape suivante exacte :** lot 0.30.3 : IMPORT-0303 (BL-126, worktree `.codex-tmp/wt-IMPORT-0303`, relectures de code et de sécurité approuvées ; à mettre à jour avec main, décisions D-786 à D-790, ligne H-45 et correction de la ligne IMPORT-029b de docs/capability-matrix.md à porter, puis PR ; `npm install` dans `C:\Dev\spartiate` après sa fusion : pdfjs-dist), puis BL-169 (gestes iPhone), puis REL-0.30.3 ; ensuite BL-187 (parade complète des listes de matériel longues) et BL-188. Restent les « fait en partie » faisables sans Ali (CLEAN-03 : `curveGeometry`, restes de BL-003 et code mort hérité ; signaux des e2e ; `tDynamic` et `tProgression` non typés), puis les constats d'Ali (docs/constats-ali.md) et ses décisions. Fiches docs/<ticket>.md. Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md. PRD v6.3 : docs/prd/README.md. Compte (seul décompte, `node scripts/release/backlog-count.mjs`, BL-147) : Registre : 3 lignes « à faire » (séance et moteur 1, données et synchro 1, coquille, iOS et qualité 1), 96 « fait en partie », 0 « à trancher par Ali », 29 constats d'Ali. Points ouverts : **docs/backlog.md** (D-320) ; questions : docs/decisions-a-prendre.md.

## Lot 0.28.0 — où on en est

- Phase 0 : DOC-PRIV fusionné (#156, D-318 à D-321). **HIST-01 fait le 20/11** (docs/HIST-01.md : historique réécrit et poussé en force, PR #127 fermée, D-319, D-324) ; **tous les SHA antérieurs au 20/11 ont changé** (table dans docs/HIST-01.md) ; reste à Ali : recloner `C:\Dev\spartiate-codex`, envoyer la demande de purge à GitHub Support. Les worktrees locaux créés avant le 20/11 12:39 UTC portent l'ancien historique : n'en repousser aucun, recréer depuis origin.
- Lots 0.28.0 à 0.29.1 : PR #157 à #203, détail dans docs/LOT-0.28.0.md, docs/LOT-0.29.0.md, docs/LOT-0.29.1.md et les fiches docs/<ticket>.md.
- **D-333 (Ali, 20/11 19 h 30) : jamais d'arrêt** (ni budget ni compactage ; dépassement consigné) ; ticket bloqué après 3 tentatives : PR en brouillon, cause ici et dans docs/backlog.md, ticket suivant. **D-374 (Ali, 21/11)** : une PR par module, un commit rouge/vert par ticket, une seule mise à jour avec main juste avant la fusion.
- Méthode du lot : un worktree par ticket `C:\Dev\spartiate\.codex-tmp\wt-<ticket>` depuis origin/main, `node_modules` par jonction (`mklink /J`) vers celui de `C:\Dev\spartiate` ; scripts de travail dans `C:\Dev\spartiate\.codex-tmp\lot028\`. `npm run test:bundle` passe aussi depuis un worktree (NETTOYAGE). Le main local de `C:\Dev\spartiate` est ancien et divergent : ne jamais s'y fier, toujours origin/main.
- Pièges : le chapitre du PRD est figé par `prd-split.test.ts` (liste fermée de décisions) : une mise en cohérence passe par une D- ; `scripts/release/privacy.test.ts` refuse toute valeur attribuée à Ali et tout conseil de réinstaller l'app ; aucun `prettier --write`.

## Rappels

- **Lundi 4 janvier 2027 (D-652, BL-170)** : réévaluer Siri / App Intents, Camera Control et micronutriments (D-412), une question fermée par sujet.

- SideStore renouvelé par Ali le 27/11 (D-767) : prochaine échéance vers le 04/12 (signature de 7 jours) ; date exacte dans Plus › À propos et diagnostic, à relever par Ali (constat BL-185).
- **Usage réel commencé le 16/11/2026 (D-292)** : données réelles d’Ali sur le PC, l’iPhone et iCloud Drive/Spartiate ; aucun accès des agents, fixtures synthétiques uniquement ; dépôt public (D-318 (5)). D-69 : HealthKit direct BLOCKED, import par Raccourcis.
- Décisions d'Ali du 20/11 (D-318) : D-243, D-244, D-246, D-291, D-311, D-314 à D-317 validées ; Recovery Split 50 % ; écarts au PRD traités en phase 3 sauf lot 0.29.0 (bilans, import de programme, objectif de pas, zone 2, notes sur 10, VISBODY, pictogrammes).
- Données réelles interdites (voir CLAUDE.md) ; jamais `git fetch circletasks` ; pas de `push --force` (seule exception : HIST-01, D-319), de `reset --hard`, de `rm -rf`, de push sur main ; aucun tag supprimé ou repoussé.
- Suite complète en CI seulement ; en local, des tests ciblés (`--maxWorkers=1`). Une compilation iPhone (`build-ios.yml`, `-f publish=false`) en fin de lot.
- Preuve native : aucun `CONFIRMED` sans constat d'Ali (D-36).
- Bundle de départ : 358 400 octets gzip, liste blanche `tests/bundle/start-modules.json`.
- Secrets : RELEASES_TOKEN, TAURI_SIGNING_PRIVATE_KEY et son mot de passe (noms seulement). Fournisseur IA : aucun (D-294).
