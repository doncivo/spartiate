# NETTOYAGE (lot 0.28.1, point 3.4 de docs/LOT-0.28.0.md)

Module : outillage du dépôt (tests du bundle, branches, worktrees). Budget S. PR groupée selon D-374.

## Passe product-owner : critères

1. Given la branche distante `archive/agent-a0528c3a67af21a44`, When chacun de ses commits absents de main est examiné, Then son contenu est prouvé présent dans main (ou volontairement abandonné) avant toute suppression ; sinon rien n'est supprimé.
2. Given `tests/bundle/pairingBundle.test.ts` lancé depuis un worktree dont `node_modules` est une jonction, When Vite rend le chemin réel (`../../node_modules/…`), Then le test passe comme depuis le dépôt principal, sans élargir la liste blanche : seul un chemin hors du dépôt qui passe par un `node_modules` est ramené à `node_modules/…`.
3. Given les worktrees `.codex-tmp/wt-STR-01` et `.codex-tmp/wt-audit-claude` (et `wt-COQ-BASE`, `wt-confid-replay` du lot), When on les retire, Then aucun fichier du dépôt principal n'est touché.

## Branche d'archive : preuve (critère 1)

- Pointe : `8a1ffd6c` (« I4-07 revue : carte d'Aujourd'hui avec la journée déclarée… »), 25 commits absents de main, base commune `580b2196` (I4-06, #86).
- Tous appartiennent au ticket I4-07, fusionné par squash dans main : `fb3bdfb6` (« I4-07 : recettes et journée complète déclarée (0.9.0, schéma 9) (#87) »).
- `git diff --stat 8a1ffd6c fb3bdfb6` : 10 fichiers seulement, tous de la PR de version ou de la fiche : CHANGELOG.md, docs/reprise.md, package.json, package-lock.json, Cargo.toml, Cargo.lock, tauri.conf.json, scripts/release/identity.test.ts, tests/bundle/start-modules.json (entrée justifiée de la migration 0009), et `docs/I4-07-donnees.md` renommé en `docs/I4-07.md` (le fichier disait « Fichier à fusionner dans docs/I4-07.md »). **Aucun fichier de code ni de test ne diffère** : tout le contenu de la branche est dans main.
- Conclusion : branche distante supprimée le 21/11 (`git push origin --delete`, après cette preuve). SHA consigné ici pour la retrouver (`git fetch origin 8a1ffd6c` tant que GitHub le garde).

## pairingBundle.test depuis un worktree (critère 2)

- Rouge : lancé depuis `.codex-tmp/wt-NETTOYAGE` sur origin/main (585d7336), le test échoue : les modules de React, react-dom, scheduler, qrcode-generator et `@tauri-apps/api/core.js` sortent en `../../node_modules/…`, hors liste blanche.
- Vert : `normalize` ramène un chemin hors du dépôt passant par un `node_modules` à `node_modules/…` ; un autre chemin hors du dépôt garde ses `../` et reste refusé. 7 tests sur 7 depuis le worktree.

## Worktrees (critère 3) : reporté, à faire par Ali

La vérification que `node_modules` de ces worktrees est une jonction (et non une copie) a été refusée par le mode automatique ; sans elle, `git worktree remove` pourrait vider le `node_modules` du dépôt principal à travers une jonction. Rien n'est supprimé. À faire par Ali : dans chaque dossier `.codex-tmp\wt-STR-01`, `wt-audit-claude`, `wt-COQ-BASE`, `wt-confid-replay`, retirer d'abord la jonction `node_modules` par `rmdir node_modules` (cmd, retire le lien seulement), puis `git -C C:\Dev\spartiate worktree remove <dossier>` et `git worktree prune`. La branche locale `audit-claude-0.27.0` (#155) n'est pas touchée.

## Passes

- product-owner : critères ci-dessus.
- agent du module (ci-release, outillage) : correctif de `normalize`.
- qa-test : cas limite, un chemin hors du dépôt sans `node_modules` reste refusé (lecture de l'expression : le remplacement n'opère que sur `../…/node_modules/`).
- code-reviewer : voir la fin de la fiche.

## BL-011 : sources d'images réduites (point 3.3)

- Rouge : 3581fedd (3 tests rouges : provenance incomplète, champs de réduction sur une source non réduite, PNG invalide ou trop haut). Vert : commit suivant, `validateReduction` dans scripts/content/validate-content.mjs ; contenu réel validé (14 médias réduits). D-375.
