# Reprise — dépôt Spartiate

État au 2026-11-12 : I1 à I5 livrés ; I6-01 à I6-04 (0.12.0 à 0.16.0, schéma 13) ; **CLEAN-01 (0.17.0, sans migration) : suppression des résidus CircleTasks (ui, dépôts SQL hérités sans appelant, domaine, textes ; bundle de départ 209 328 → 193 544 octets), branche `CLEAN-01-residus`, PR ouverte (docs/CLEAN-01.md, D-116 à D-118 ; banc legacy de synchro, src/platform/ocr et textes scan/reminders conservés).** Historique : CHANGELOG.md. Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md. PRD v6.3 : docs/prd/README.md. Décisions D-22 à D-118 dans docs/decisions.md (DEP-01, SQLite >= 0.39, revue au 30 nov.).

## Fusionné (tout est dans main)

- Base : SPA-000 (#1 à #10), SPA-001a (#11), préparation et arbitrages (#12 à #14, D-65), 001b (front #15, périphérie #16 #18, base #20), FMT-01 (#17, D-66).
- Livraison : SPA-002 (Windows, updater signé), SPA-003 (IPA ad hoc, entitlements), ios-demarrage et ios-identite (journal visible, source SideStore propre).
- Produit I0 : SPA-005 (export / import), SPA-009 (écrans fidèles aux planches), SPA-006 (Apple Santé en lecture, diagnostic natif en 0.1.3), SPA-007 (Live Activity, minuteur de test).
- Versions publiées : 0.1.0 à 0.11.4, puis 0.12.0 et 0.13.0 (PC `vX.Y.Z`, iPhone `ios-vX.Y.Z`).

## Décisions récentes

- D-70 : l'agent fusionne (`gh pr merge --squash`) et publie (tags `vX.Y.Z` et `ios-vX.Y.Z` sur origin/main après contrôle d'absence), puis suit les builds jusqu'à spartiate-releases. Ali installe et fait les constats sur appareil.

## Prochaines étapes

1. Ali : installer 0.13.0 puis 0.14.0 (PC et iPhone le même jour, schémas 12 puis 13, avant toute saisie) ; constater le sélecteur de photo sur iPhone (H-27). Lot suivant : I3-07 (onboarding) ; D-94 à D-105 et D-110 à D-112 à confirmer.
2. Confirmer ou réviser D-73, D-74, D-79 à D-81 et D-88 à D-93 (échelle d'Exertion 20, journée rouge = maintien).

## Rappels

- Première utilisation réelle : 2026-11-09 (D-38), plus aucun accès aux données réelles ni à iCloud Drive/Spartiate. D-69 : HealthKit direct BLOCKED, import par Raccourcis. D-73 et D-74 (I3, I4) et H-21 UNVERIFIED : révisables par Ali (decisions.md).

- Données réelles interdites (voir CLAUDE.md) ; jamais `git fetch circletasks` ; pas de `push --force`, de `reset --hard`, de `rm -rf`, de push sur main ; aucun tag supprimé ou repoussé.
- Suite complète en CI seulement ; en local, des tests ciblés (`--maxWorkers=1`, pas de commandes lourdes en parallèle : le système a déjà tué des processus pour manque de mémoire). Une compilation iPhone (`build-ios.yml`, `-f publish=false`) par lot qui touche Swift ou l'extension.
- Preuve native : aucun `CONFIRMED` sans constat d'Ali (D-36) ; H-3a et H-3b BLOCKED, H-4 CONFIRMED avec deux défauts d'affichage (voir la matrice).
- Bundle de départ : 358 400 octets gzip, liste blanche `tests/bundle/start-modules.json`.
- Secrets : RELEASES_TOKEN, TAURI_SIGNING_PRIVATE_KEY et son mot de passe (noms seulement). Fournisseur IA et plafond : Ali avant I4 ; médias : décision prise (H-9, D-71).
- Écarts connus : méthodes SQL de l'ancien schéma encore dans `SyncRepository` (banc de test legacy, D-67) ; catalogues de textes hérités (`fr.ts` et autres) à purger avec le banc legacy, le test `src/i18n/noLegacyWords.test.ts` ne couvre que les textes vivants ; la copie de conflit iCloud `state 2.spx` est ignorée et signalée, sa cause reste une hypothèse.
