# Reprise — dépôt Spartiate

État au 2026-11-13 : I1 à I5, I6-01 à I6-04, CLEAN-01, FIX-0171 à 0173, I6-03b, DEP-01, FIX-0182, FIX-0181, RESET-01 (schéma 16, docs/RESET-01.md : marche à suivre du jour J), ERGO-01, CLEAN-02 (D-200 ; CLEAN-03 en file, D-201), I6-05 (0.20.0, compléments, schéma 17, H-34) et I6-06 (0.21.0, cardio et GPS iPhone, schéma 18, D-220, H-35) publiés. **I6-07 (0.22.0, sans migration) : 87 illustrations Everkinetic (CC BY-SA 4.0) dans la fiche d’exercice, à la demande, attribution sous l’image, validateur des médias (D-230 à D-237, docs/I6-07.md) ; H-9 UNVERIFIED.** Historique : CHANGELOG.md. Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md. PRD v6.3 : docs/prd/README.md. Décisions D-22 à D-237 dans docs/decisions.md.

## Fusionné (tout est dans main)

- Base, livraison et produit I0 (SPA-000 à SPA-009, FMT-01) : voir CHANGELOG.md et docs/SPA-*.md.
- Versions publiées : 0.1.0 à 0.19.0 (PC `vX.Y.Z`, iPhone `ios-vX.Y.Z`).

## Décisions récentes

- D-70 : l'agent fusionne (`gh pr merge --squash`) et publie (tags `vX.Y.Z` et `ios-vX.Y.Z` sur origin/main après contrôle d'absence), puis suit les builds jusqu'à spartiate-releases. Ali installe et fait les constats sur appareil.

## Prochaines étapes

1. I6-06 : CI verte (bundle, e2e pc et iphone, Rust), puis compilation iOS `build-ios.yml` de la branche (plugin geolocation, lancée par Ali), fusion et tags 0.21.0. Ali : installer 0.21.0 sur PC et iPhone le même jour, avant toute saisie (schéma 18) ; constats « À vérifier par Ali » de docs/I6-06.md (H-35).
2. I6-05 : tags 0.20.0 si pas encore posés ; constats de docs/I6-05.md (H-34).
3. Ali : constats en attente de RESET-01 (H-33), ERGO-01, FIX-0172, FIX-0173, FIX-0181 ; H-27, H-32.
4. DEP-01 : retirer `src-tauri/vendor/sqlx-sqlite` dès qu’un sqlx publié accepte libsqlite3-sys >= 0.39 (D-160).
5. D-73 à D-118 validées par Ali (D-119). CLEAN-03 (L, sync-icloud) en file (D-201). À recaler sur demande d'Ali : D-73 (4) et l'Exertion (D-88 musculation, D-220 cardio). Numéro de l'import de programme (ancien I6-06) à donner (D-225).

## À décider par Ali

- ERGO-01, propositions structurelles (`docs/maquettes/propositions/ergo-01-structure/`, rien d'implémenté) : P1 séance du jour en un tap ; P2 « Ajouter un repas » ouvre la recherche ; P3 « − / + » au cran du matériel ; P4 PC Aujourd'hui, Récupération en tête ; P5 retirer le doublon « Journal des séances ». Suite du message coupé à fournir (D-195).
- Archive `archive/agent-a0528c3a67af21a44` (origin) : supprimable sur décision d'Ali (D-144).
- Worktree `agent-a9d451df1eba848d1` (CLEAN-01-residus, tout poussé) : verrouillé par le pid 16360, laissé sans `--force`.

## Rappels

- Première utilisation réelle : 2026-11-09 (D-38), plus aucun accès aux données réelles ni à iCloud Drive/Spartiate. D-69 : HealthKit direct BLOCKED, import par Raccourcis. H-21 UNVERIFIED.
- Données réelles interdites (voir CLAUDE.md) ; jamais `git fetch circletasks` ; pas de `push --force`, de `reset --hard`, de `rm -rf`, de push sur main ; aucun tag supprimé ou repoussé.
- Suite complète en CI seulement ; en local, des tests ciblés (`--maxWorkers=1`, pas de commandes lourdes en parallèle : le système a déjà tué des processus pour manque de mémoire). Une compilation iPhone (`build-ios.yml`, `-f publish=false`) par lot qui touche Swift, l'extension ou un plugin iOS.
- Preuve native : aucun `CONFIRMED` sans constat d'Ali (D-36) ; H-3a et H-3b BLOCKED, H-4 CONFIRMED avec deux défauts d'affichage (voir la matrice).
- Bundle de départ : 358 400 octets gzip, liste blanche `tests/bundle/start-modules.json`.
- Secrets : RELEASES_TOKEN, TAURI_SIGNING_PRIVATE_KEY et son mot de passe (noms seulement). Fournisseur IA et plafond : Ali avant I4 ; médias : décision prise (H-9, D-71).
- Écarts connus : méthodes SQL de l'ancien schéma encore dans `SyncRepository` (banc legacy, D-67) ; catalogues de textes hérités à purger avec le banc legacy ; la copie de conflit iCloud `state 2.spx` est ignorée et signalée, sa cause reste une hypothèse.
