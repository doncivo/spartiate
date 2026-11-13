# Reprise — dépôt Spartiate

État au 2026-11-13 matin : versions 0.17.1 à 0.22.0 publiées cette nuit, puis 0.22.1 (ERGO-01b, PR #125) (PC et iPhone, schéma 18), fiches docs/<ticket>.md. Historique : CHANGELOG.md. Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md. PRD v6.3 : docs/prd/README.md. Décisions D-22 à D-247, D-250 à D-253 et D-260 à D-264 dans docs/decisions.md.

## Rapport du matin (13/11)

- Publiées : 0.17.1 FIX-0171, 0.17.2 FIX-0172, 0.17.3 FIX-0173, 0.18.0 I6-03b (schéma 14), 0.18.1 DEP-01 (SQLite 3.54.1) et FIX-0182 (e2e Y-IOS-02), 0.18.2 FIX-0181 (schéma 15), 0.18.3 RESET-01 (schéma 16), 0.19.0 ERGO-01, 0.19.1 CLEAN-02, 0.20.0 I6-05 compléments (schéma 17), 0.21.0 I6-06 cardio et GPS (schéma 18), 0.22.0 I6-07 médias (87 exercices sur 196).
- Bloqué ou partiel : CLEAN-02 sans la migration des tests de synchro hérités (CLEAN-03, L, D-201) ni le retrait du plugin vision (gardé pour l'import de programme, D-200)  ; action « Pris » des compléments livrée en 0.22.2 (FIX-0221, D-250 à D-253), à constater sur l’iPhone (H-36).
- Installer : PC et iPhone le même jour, avant toute saisie (schéma 18). Le jour J : docs/RESET-01.md.
- Constats iPhone : GPS (demande en français, parcours de distance connue ± 5 %, séance sur le PC sans tracé, refus affiché ; H-35) ; rappels de compléments (texte sans nom sur l'écran verrouillé, prise cochée avant l'heure = pas de rappel ; H-34) ; journée rouge (charges × 0,95 au cran du matériel, bouton « Accepter l'allègement ») ; favoris (ajout sur un appareil, présent sur l'autre après synchro) ; besoin de sommeil (7 h 30 à ~8 h 45 sur tes nuits, relecture dans Plus › Journaux) ; images d'exercice en thème sombre (H-9) ; bouclier de Corps (H-32) ; « Repartir de zéro » (H-33).

## Prochaines étapes

1. ERGO-02 (0.23.0, PR #128, docs/ERGO-02.md, D-261 à D-264) : écrans restants, onboarding 8 étapes, Aujourd'hui PC réaligné, « 2 × 26 kg » ; constats iPhone : onboarding complet (Plus › Profil et poids › « Revoir mes réglages »), très grand texte. Puis DOC-D38 (usage réel non commencé), puis PROG-01 (à publier avant le dimanche 15/11 au soir).
2. ERGO-02b (après PROG-01, décision d'Ali du 13/11) : règles de calcul à mettre dans src/domain (allure du dernier km, record de la fiche, rythme du check-in) ; test de la coche « pris » ; « par haltère » dans les écarts de fr.progression ; `heldFor` réemployé ; raison « aperçu illisible » ; semaine selon « Début de semaine » (Aujourd'hui PC) ; clés mortes `sessionTodayLoad`, `unknown` ; dates Renpho sur les 5 lignes (BodyProgress.test).
3. FIX-0221 et FIX-0223 publiés (0.22.2, 0.22.3) ; constat d'Ali : « Pris » app en arrière-plan et tuée (H-36). Import de programme : I6-08 (docs/I6-08.md, non exécuté).
4. CLEAN-03 (L, sync-icloud) ; DEP-01 : retirer src-tauri/vendor/sqlx-sqlite dès qu'un sqlx publié accepte libsqlite3-sys >= 0.39 (D-160).
5. À recaler sur demande d'Ali : D-73 (4), Exertion (D-88, D-220).

## À décider par Ali

- ERGO-01b, révisables : jour du programme (D-243), cran de 2,5 kg sans profil de matériel (D-244), action rouge choisie par écran (D-246).
- Archive `archive/agent-a0528c3a67af21a44` (origin) : supprimable sur décision d'Ali (D-144).

## Rappels

- Première utilisation réelle : 2026-11-09 (D-38), plus aucun accès aux données réelles ni à iCloud Drive/Spartiate. D-69 : HealthKit direct BLOCKED, import par Raccourcis. H-21 UNVERIFIED.
- Données réelles interdites (voir CLAUDE.md) ; jamais `git fetch circletasks` ; pas de `push --force`, de `reset --hard`, de `rm -rf`, de push sur main ; aucun tag supprimé ou repoussé.
- Suite complète en CI seulement ; en local, des tests ciblés (`--maxWorkers=1`, pas de commandes lourdes en parallèle : le système a déjà tué des processus pour manque de mémoire). Une compilation iPhone (`build-ios.yml`, `-f publish=false`) par lot qui touche Swift, l'extension ou un plugin iOS.
- Preuve native : aucun `CONFIRMED` sans constat d'Ali (D-36) ; H-3a et H-3b BLOCKED, H-4 CONFIRMED avec deux défauts d'affichage (voir la matrice).
- Bundle de départ : 358 400 octets gzip, liste blanche `tests/bundle/start-modules.json`.
- Secrets : RELEASES_TOKEN, TAURI_SIGNING_PRIVATE_KEY et son mot de passe (noms seulement). Fournisseur IA et plafond : Ali avant I4 ; médias : décision prise (H-9, D-71).
- Écarts connus : méthodes SQL de l'ancien schéma encore dans `SyncRepository` (banc legacy, D-67) ; catalogues de textes hérités à purger avec le banc legacy ; la copie de conflit iCloud `state 2.spx` est ignorée et signalée, sa cause reste une hypothèse.
