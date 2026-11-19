# Reprise — dépôt Spartiate

État au 2026-11-19 : **lot 0.27.0 en cours** (docs/LOT-0.27.0.md) sur 0.26.0 publiée (schéma 19). Fiches docs/<ticket>.md. Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md. PRD v6.3 : docs/prd/README.md. Décisions D-22 à D-247, D-250 à D-253 et D-260 à D-315 dans docs/decisions.md.

## Rappel du 13/11

- Bloqué ou partiel : CLEAN-02 sans la migration des tests de synchro hérités (CLEAN-03, L, D-201) ni le retrait du plugin vision (gardé pour l'import de programme, D-200)  ; action « Pris » des compléments livrée en 0.22.2 (FIX-0221, D-250 à D-253), à constater sur l’iPhone (H-36).
- Constats iPhone encore ouverts du 13/11 : voir docs/capability-matrix.md (H-9, H-32 à H-36).

## Prochaines étapes

00. **Lot 0.27.0** : AUDIT-USAGE fusionné (#149, docs/AUDIT-USAGE.md, 13 constats dont 7 écarts) ; FIX-0271 (#150, D-314) en revue ; PROG-05 (D-315) ; restent PROG-04 (schéma 20), FIX-0272, REL-0.27.0. Piège : aucun `prettier --write` (pas de configuration Prettier, le dépôt n'est pas au format Prettier). Worktrees sous `.codex-tmp/wt-<ticket>`.
0. **Lot 0.26.0 terminé** (Ali, 16/11 : poursuivre même en cas de dépassement de budget) : fusionnés DOC-H21 (#141, D-292 à D-294), note GPS FIX-0242 (#144), MEDIA-02 (#142, D-300 à D-304, 101/196 images, 4 des 12 de la routine), ERGO-03 (#143, D-295 à D-298), PROG-03 (#145, D-305), STR-01 (#146, D-310 à D-313, H-37). REL-0.26.0 : tag v0.26.0, build-ios (publish=false), ios-v0.26.0. Le CHANGELOG 0.25.0 disait à tort que le GPS continue hors de l’écran Cardio : corrigé en 0.26.0. Worktree `.codex-tmp/wt-STR-01` verrouillé au retrait : à supprimer plus tard. Suivi : une décision reçue par la synchro peut masquer une cible future sans le dire (revue ERGO-03, pour sync-icloud).
1. **Lot 0.25.0 terminé** (docs/LOT-0.25.0.md) : FIX-0242 (#134, D-276 à D-279), FIX-0241 (#135, D-280 à D-283), FIX-0243 (#136, D-284 à D-286), ERGO-02b (#137, D-287 à D-289), SYNC-01 (#138, D-290 validée, ADR 0018 accepté, avenant 37 de l'ADR 0011), FIX-0244 (#139, D-291 révisable). Départ 199 211 → 195 860 octets. Publication : REL-0.25.0, tag v0.25.0, build-ios (publish=false), ios-v0.25.0. Suivi : test instable `src/features/sync/syncedData.test.tsx` (« la pesée reçue remplace l'ancienne », délai de 1 s dépassé après `forgetBanner.test.tsx`, aussi sur main) ; limites M2 à M4 de l'ADR 0018 ; lecture des cibles futures hors transaction (FIX-0244, mineur).
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
