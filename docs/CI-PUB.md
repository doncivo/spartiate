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
