# CI-PUB — CI de publication (lot 0.28.0, phase 2)

Budget M (150 k). Rôle : ci-release. Chapitre 23 (qualité, CI), AGENTS.md (procédure de publication), D-47. Constats : C-166, C-172, C-174, C-175
(audit Claude 0.27.0, partie 11, `partie11-tests.json` clé `actionsNonFigees`). Contrainte : v0.28.0 est publiée juste après ; les deux
workflows de publication ne doivent pas casser, donc changements minimaux et vérifiables par un test statique.

## Passe product-owner : critères

1. C-166. Given les trois workflows, When on lit chaque `uses:` distant, Then il est figé par un SHA de 40 caractères suivi de `# vX`, et une
   même action porte le même SHA partout (celui de `tests.yml`).
2. C-172a. Given un tag `vX.Y.Z` ou `ios-vX.Y.Z`, When le workflow démarre, Then un job `garde` lit le check « suite verte » du SHA du tag
   (`gh api`, `GITHUB_TOKEN`, `checks: read`) et échoue avec un message clair s'il est absent, en cours ou non vert ; le job de compilation
   (qui signe sur PC) en dépend. Sur lancement manuel, le job `garde` réussit sans contrôle.
3. C-172b. Given le job PC qui reçoit la clé de signature, When on lit `npm ci`, Then c'est `npm ci --ignore-scripts` (seul `fsevents`, macOS,
   a un script d'installation : inutile sur Windows).
4. C-172c. Given une republication (`--clobber`), When l'actif existe déjà, Then son SHA-256 est comparé à celui du fichier à publier et un
   avertissement le dit si différent.
5. C-174. Given `build-ios.yml`, When on lit l'étape « Plugins iOS » et le contrôle des entitlements de l'extension, Then aucun `|| true`
   ne précède un `grep` d'absence : l'arbre des dépendances est calculé une fois par cible (échec si la commande échoue), et
   `codesign -d` échoue le job s'il échoue. `suite-verte` : `needs` contient tous les jobs de `tests.yml` sauf `visual` (voulu), gardé par test.
   `pipefail` ajouté dans les étapes qui manquaient (dont la clé de cache des paquets WebKit).
6. C-175. Given un tag iOS, Then le cache cargo est en lecture seule (comme PC) ; `persist-credentials: false` sur tous les checkouts ;
   artefact de journaux avec `retention-days` ; `cargo-audit` installé en version fixée ; `npm audit --omit=dev --audit-level=high` dans `tests.yml`.

Hors périmètre, reporté : signature dans un job distinct (non testable sans tag et sans clé : décision proposée).

## Passes agent du module et qa-test

- Rouge : 55562609 (`scripts/release/ciPub.test.ts`, import de `check-suite-verte.mjs` absent). Vert : voir le commit suivant.
- Fichiers : `build-windows.yml`, `build-ios.yml`, `tests.yml`, `scripts/release/check-suite-verte.mjs`, `scripts/release/ciPub.test.ts`,
  `scripts/ios/geolocation.test.ts` (attente de texte adaptée à `grep <<<`), `docs/release-pc.md`. Ni `src/sync/**` ni code applicatif.
- SHA : ceux de `tests.yml` pour checkout, setup-node, cache (et `cache/restore`), upload-artifact, download-artifact ; `rust-toolchain`
  était déjà figé. Aucune action nouvelle, aucune lecture d'API nécessaire.
- `npm ci --ignore-scripts` : seul `fsevents` (macOS, optionnel) a `hasInstallScript` dans `package-lock.json` ; sans effet sur Windows.
  Le build iOS garde `npm ci` (il ne reçoit aucune clé de signature : signature ad hoc).
- `npm audit --omit=dev --audit-level=high` : 0 vulnérabilité sur le graphe livré au 2026-11-20 ; DEP-01 du lot 0.29.0 n'a rien à ajouter.
- Cas limites qa-test : check absent, en cours, en échec, relance (le plus récent gagne), entrée invalide, sortie 1 du script ; `needs` de
  « suite verte » comparé aux jobs réels (tout sauf `visual`) ; `persist-credentials` et `retention-days` comptés sur chaque étape.
- Limites : les workflows ne sont pas exécutés ici ; `build-ios.yml` se vérifie par une compilation `publish=false` (étape « Plugins iOS »
  réécrite, `codesign -d` sans `|| true`, cache en lecture seule seulement sur tag) ; le job `garde` sur tag et les deux comparaisons
  SHA-256 avant `--clobber` ne se vérifient qu'au tag. `build-windows.yml` accepte `workflow_dispatch` sans publier ni signer : un
  lancement à blanc couvre `garde` (branche du notice), `npm ci --ignore-scripts`, la compilation et la collecte.

## Passe code-reviewer (à froid, agent distinct) : à corriger, puis corrigé

Avant la revue, l'appelant a trouvé que build-ios.yml et build-windows.yml n'étaient plus du YAML valide (`run: echo "…Hors tag : …"`, « : »
dans un scalaire simple) : GitHub refusait le lancement manuel (« does not have workflow_dispatch trigger ») et un tag n'aurait rien publié. Rouge
`087bde29` (test qui analyse les trois workflows avec `yaml`), vert suivant (bloc littéral). Revue : SHA identiques aux trois fichiers, `garde`
correct (absent, en cours, non vert, rejoué, ignoré), chaîne `needs` jusqu'à la publication sans `always()`, `--ignore-scripts` sans risque (seul
`fsevents` a un script), cache iOS en lecture seule sur tag, 382 tests verts. À corriger : (1) AGENTS.md : taguer seulement quand « suite verte » est
verte sur le commit de main (corrigé) ; (2) D-358 à D-361 inscrites dans docs/decisions.md (fait) ; (3) lancements à blanc Windows et iOS à terminer
en succès (consignés ci-dessous). Suggestions : (4) afficher le stderr de `codesign -d` en cas d'échec, (5) annulation de « Tests » par
`concurrency` sur deux commits rapprochés de main (écrite dans AGENTS.md) : (4) au registre (BL-104).

## Décisions : D-358, D-359, D-360, D-361 (docs/decisions.md)

- **D-358** : les workflows de publication figent toutes leurs actions par SHA (les mêmes que `tests.yml`) ; un test statique (`scripts/release/ciPub.test.ts`) refuse tout `uses:` distant non figé dans les trois workflows. Monter une action est un commit qui change le SHA partout (révisable par Ali).
- **D-359** : un job `garde` (permission `checks: read`, `GITHUB_TOKEN` seul) précède toute compilation ou signature sur tag, PC comme iPhone : le check « suite verte » du SHA du tag doit être terminé et vert (`scripts/release/check-suite-verte.mjs`). Conséquence : le tag se pose après la fin de la suite sur le commit de `main`, jamais sur un commit sans suite. Hors tag, le job réussit sans contrôle.
- **D-360** : la signature de l'installeur dans un job distinct (checkout sans cache, `npm ci --ignore-scripts`, seul à recevoir la clé) est reportée en 0.28.1 : elle n'est testable ni sans tag ni sans clé. En attendant, le job PC installe sans scripts et la clé n'est reçue que par l'étape de signature. `--clobber` laisse une trace (SHA-256 ancien et nouveau, avertissement) sans bloquer la relance d'une publication interrompue.
- **D-361** : `cargo-audit` est installé en version fixée (`CARGO_AUDIT_VERSION`, 0.23.0), portée par la clé de cache ; `npm audit --omit=dev --audit-level=high` s'exécute dans le job `cargo audit` ; le cache cargo de `build-ios.yml` est en lecture seule sur tag (clé exacte, comme PC : monter la version avant la compilation à blanc pour qu'il soit chaud) ; contrôles d'absence de `build-ios.yml` sans `|| true`.
