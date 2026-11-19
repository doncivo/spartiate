# Reprise — dépôt Spartiate

État au 2026-11-19 : **0.27.0** en publication (lot 0.27.0 terminé, docs/LOT-0.27.0.md ; **schéma 20**). Fiches docs/<ticket>.md. Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md. PRD v6.3 : docs/prd/README.md. Décisions D-22 à D-247, D-250 à D-253 et D-260 à D-317 dans docs/decisions.md.

## Rappel du 13/11

- Bloqué ou partiel : CLEAN-02 sans la migration des tests de synchro hérités (CLEAN-03, L, D-201) ni le retrait du plugin vision (gardé pour l'import de programme, D-200)  ; action « Pris » des compléments livrée en 0.22.2 (FIX-0221, D-250 à D-253), à constater sur l’iPhone (H-36).
- Constats iPhone encore ouverts du 13/11 : voir docs/capability-matrix.md (H-9, H-32 à H-36).

## Prochaines étapes

0. **Lot 0.27.0 terminé** (docs/LOT-0.27.0.md, schéma 20) : AUDIT-USAGE (#149, docs/AUDIT-USAGE.md, 13 constats, 7 écarts tous traités), FIX-0271 (#150, D-314 : prise d'effet d'une cible), PROG-05 (#151, D-315 : durée du cycle), PROG-04 (#152, D-316, D-317 : jour de la semaine, migration 0020), FIX-0272 (#153 : audit Codex partie 0, licences, couleurs, A-006, démontage des rappels, façade du thème, test instable syncedData). REL-0.27.0 : tag v0.27.0, build-ios (publish=false), ios-v0.27.0. Pièges : aucun `prettier --write` (le dépôt n'a pas de configuration Prettier) ; panne d'installation de Chromium sur les runners (apt, code 100) : une relance des jobs ; ID d'ajout au départ au format `LOT-27-…`. À trancher par Ali : D-314 (9) (relecture rétroactive d'une semaine, fuseau de lecture), D-317 (rattachement par le nom à l'import seulement).
1. **Lots 0.25.0 et 0.26.0 terminés** (docs/LOT-0.25.0.md, docs/LOT-0.26.0.md ; D-276 à D-313). Worktree `.codex-tmp/wt-STR-01` verrouillé : à supprimer plus tard. Limites M2 à M4 de l'ADR 0018 ouvertes.
3. Constat d'Ali : « Pris » app en arrière-plan et tuée (H-36). Import de programme : I6-08 (docs/I6-08.md, non exécuté).
4. CLEAN-03 (L, sync-icloud) ; DEP-01 : retirer src-tauri/vendor/sqlx-sqlite dès qu'un sqlx publié accepte libsqlite3-sys >= 0.39 (D-160).
5. À recaler sur demande d'Ali : D-73 (4), Exertion (D-88, D-220).

## À décider par Ali

- Lot 0.26.0, révisables : Strength Score tenu pour la barre et le poids du corps seulement, Rowing barre noté sur le Pendlay row (D-311, écart au § 17.1 « barre et haltères ») ; normes FitnessVolt (D-310) ; nutrition facultative dans le guide (D-293) ; cible future montrée et confirmation (D-295, D-296).
- ERGO-01b, révisables : jour du programme (D-243), cran de 2,5 kg sans profil de matériel (D-244), action rouge choisie par écran (D-246).
- Archive `archive/agent-a0528c3a67af21a44` (origin) : supprimable sur décision d'Ali (D-144).

## Rappels

- **Usage réel commencé le 16/11/2026 (D-292)** : données réelles d’Ali sur le PC, l’iPhone et iCloud Drive/Spartiate ; aucun accès des agents, fixtures synthétiques uniquement. D-69 : HealthKit direct BLOCKED, import par Raccourcis ; H-21 à H-24, H-28, H-29 CONFIRMED, H-25 UNVERIFIED (D-293).
- Données réelles interdites (voir CLAUDE.md) ; jamais `git fetch circletasks` ; pas de `push --force`, de `reset --hard`, de `rm -rf`, de push sur main ; aucun tag supprimé ou repoussé.
- Suite complète en CI seulement ; en local, des tests ciblés (`--maxWorkers=1`, pas de commandes lourdes en parallèle : le système a déjà tué des processus pour manque de mémoire). Une compilation iPhone (`build-ios.yml`, `-f publish=false`) par lot qui touche Swift, l'extension ou un plugin iOS.
- Preuve native : aucun `CONFIRMED` sans constat d'Ali (D-36) ; H-3a et H-3b BLOCKED, H-4 CONFIRMED avec deux défauts d'affichage (voir la matrice).
- Bundle de départ : 358 400 octets gzip, liste blanche `tests/bundle/start-modules.json`.
- Secrets : RELEASES_TOKEN, TAURI_SIGNING_PRIVATE_KEY et son mot de passe (noms seulement). Fournisseur IA : aucun (D-294, fonctions IA grisées avec leur cause) ; médias : décision prise (H-9, D-71).
- Écarts connus : méthodes SQL de l'ancien schéma encore dans `SyncRepository` (banc legacy, D-67) ; catalogues de textes hérités à purger avec le banc legacy ; la copie de conflit iCloud `state 2.spx` est ignorée et signalée, sa cause reste une hypothèse.
