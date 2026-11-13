# Reprise — dépôt Spartiate

État au 2026-11-13 matin : versions 0.17.1 à 0.22.0 publiées cette nuit (PC et iPhone, schéma 18), fiches docs/<ticket>.md. Historique : CHANGELOG.md. Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md. PRD v6.3 : docs/prd/README.md. Décisions D-22 à D-238 et D-250 à D-253 (FIX-0221) dans docs/decisions.md.

## Rapport du matin (13/11)

- Publiées : 0.17.1 FIX-0171, 0.17.2 FIX-0172, 0.17.3 FIX-0173, 0.18.0 I6-03b (schéma 14), 0.18.1 DEP-01 (SQLite 3.54.1) et FIX-0182 (e2e Y-IOS-02), 0.18.2 FIX-0181 (schéma 15), 0.18.3 RESET-01 (schéma 16), 0.19.0 ERGO-01, 0.19.1 CLEAN-02, 0.20.0 I6-05 compléments (schéma 17), 0.21.0 I6-06 cardio et GPS (schéma 18), 0.22.0 I6-07 médias (87 exercices sur 196).
- Bloqué ou partiel : CLEAN-02 sans la migration des tests de synchro hérités (CLEAN-03, L, D-201) ni le retrait du plugin vision (gardé pour l'import de programme, D-200)  ; action « Pris » des compléments livrée en 0.22.2 (FIX-0221, D-250 à D-253), à constater sur l’iPhone (H-36).
- Installer : PC et iPhone le même jour, avant toute saisie (schéma 18). Le jour J : docs/RESET-01.md.
- Constats iPhone : GPS (demande en français, parcours de distance connue ± 5 %, séance sur le PC sans tracé, refus affiché ; H-35) ; rappels de compléments (texte sans nom sur l'écran verrouillé, prise cochée avant l'heure = pas de rappel ; H-34) ; journée rouge (charges × 0,95 au cran du matériel, bouton « Accepter l'allègement ») ; favoris (ajout sur un appareil, présent sur l'autre après synchro) ; besoin de sommeil (7 h 30 à ~8 h 45 sur tes nuits, relecture dans Plus › Journaux) ; images d'exercice en thème sombre (H-9) ; bouclier de Corps (H-32) ; « Repartir de zéro » (H-33).

## Prochaines étapes

1. En cours : ERGO-01b (0.22.1 : règles visuelles de tous les écrans et P1 à P5, D-238), puis FIX-0221 (0.22.2, PR ouverte, mode arrière-plan sans Swift, D-251 ; constat d’Ali : « Pris » app en arrière-plan et app tuée, H-36). Ali : constats ci-dessus. Import de programme : I6-08 (docs/I6-08.md, non exécuté).
2. CLEAN-03 (L, sync-icloud) ; DEP-01 : retirer src-tauri/vendor/sqlx-sqlite dès qu'un sqlx publié accepte libsqlite3-sys >= 0.39 (D-160).
3. À recaler sur demande d'Ali : D-73 (4), Exertion (D-88, D-220).

## À décider par Ali

- Archive `archive/agent-a0528c3a67af21a44` (origin) : supprimable sur décision d'Ali (D-144).
- Worktrees d'agents verrouillés par le pid 16360 (tout poussé) : agent-a9d451df1eba848d1, agent-a895df175f43a280d, agent-a7c1af61eb1c76410, agent-a393a3030e58910ef ; à retirer par `git worktree remove` après redémarrage du PC.

## Rappels

- Première utilisation réelle : 2026-11-09 (D-38), plus aucun accès aux données réelles ni à iCloud Drive/Spartiate. D-69 : HealthKit direct BLOCKED, import par Raccourcis. H-21 UNVERIFIED.
- Données réelles interdites (voir CLAUDE.md) ; jamais `git fetch circletasks` ; pas de `push --force`, de `reset --hard`, de `rm -rf`, de push sur main ; aucun tag supprimé ou repoussé.
- Suite complète en CI seulement ; en local, des tests ciblés (`--maxWorkers=1`, pas de commandes lourdes en parallèle : le système a déjà tué des processus pour manque de mémoire). Une compilation iPhone (`build-ios.yml`, `-f publish=false`) par lot qui touche Swift, l'extension ou un plugin iOS.
- Preuve native : aucun `CONFIRMED` sans constat d'Ali (D-36) ; H-3a et H-3b BLOCKED, H-4 CONFIRMED avec deux défauts d'affichage (voir la matrice).
- Bundle de départ : 358 400 octets gzip, liste blanche `tests/bundle/start-modules.json`.
- Secrets : RELEASES_TOKEN, TAURI_SIGNING_PRIVATE_KEY et son mot de passe (noms seulement). Fournisseur IA et plafond : Ali avant I4 ; médias : décision prise (H-9, D-71).
- Écarts connus : méthodes SQL de l'ancien schéma encore dans `SyncRepository` (banc legacy, D-67) ; catalogues de textes hérités à purger avec le banc legacy ; la copie de conflit iCloud `state 2.spx` est ignorée et signalée, sa cause reste une hypothèse.
