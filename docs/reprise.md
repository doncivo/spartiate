# Reprise — dépôt Spartiate

État au 2026-11-06 (clôture I0, version 0.1.6). Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md. PRD v6.3 en chapitres : docs/prd/README.md. Décisions D-22 à D-70 dans docs/decisions.md ; les décisions approuvées priment sur les textes historiques. Dossier de sortie I0 : docs/gate-i0.md.

## Fusionné (tout est dans main)

- Base : SPA-000 (#1 à #10), SPA-001a (#11), préparation et arbitrages (#12 à #14, D-65), 001b (front #15, périphérie #16 #18, base #20), FMT-01 (#17, D-66).
- Livraison : SPA-002 (Windows, updater signé), SPA-003 (IPA ad hoc, entitlements), ios-demarrage et ios-identite (journal visible, source SideStore propre).
- Produit I0 : SPA-005 (export / import), SPA-009 (écrans fidèles aux planches), SPA-006 (Apple Santé en lecture, diagnostic natif en 0.1.3), SPA-007 (Live Activity, minuteur de test).
- Versions publiées : 0.1.0 à 0.1.5 (PC `vX.Y.Z`, iPhone `ios-vX.Y.Z`). #44 à #50 : finitions 0.1.2, diagnostic 0.1.3, correctifs d'essai 0.1.4 (zoom iOS, écrans relus après synchro, conflits en français, « Jamais lu », copies iCloud, icône), SPA-007 0.1.5.
- Cette PR (cloture-i0, 0.1.6) : finitions Apple Santé et textes sans reste de l'ancien projet, Live Activity « Terminé » à l'échéance, notification à la seconde, preuves d'Ali dans la matrice, gate-i0.md.

## Décisions récentes

- D-69 : accès direct HealthKit BLOCKED (compte Apple gratuit, SideStore retire l'entitlement) ; l'import passera par l'app Raccourcis, ticket séparé.
- D-70 : l'agent fusionne (`gh pr merge --squash`) et publie (tags `vX.Y.Z` et `ios-vX.Y.Z` sur origin/main après contrôle d'absence), puis suit les builds jusqu'à spartiate-releases. Ali installe et fait les constats sur appareil.

## Prochaines étapes

1. **Go I0** : décision écrite d'Ali après les trois preuves restantes (export puis import ; journaux exportés sur les deux appareils ; Dynamic Island et heure de la notification). Aucun travail I1 avant.
2. **I1-01** (docs/I1-01.md), puis la suite de l'itération I1.
3. **Ticket Raccourcis** (D-69) : import du poids et des pas par l'app Raccourcis.

## Rappels

- Données réelles interdites (voir CLAUDE.md) ; jamais `git fetch circletasks` ; pas de `push --force`, de `reset --hard`, de `rm -rf`, de push sur main ; aucun tag supprimé ou repoussé.
- Suite complète en CI seulement ; en local, des tests ciblés (`--maxWorkers=1`, pas de commandes lourdes en parallèle : le système a déjà tué des processus pour manque de mémoire). Une compilation iPhone (`build-ios.yml`, `-f publish=false`) par lot qui touche Swift ou l'extension.
- Preuve native : aucun `CONFIRMED` sans constat d'Ali (D-36) ; H-3a et H-3b BLOCKED, H-4 partiel (voir la matrice).
- Bundle de départ : 358 400 octets gzip, liste blanche `tests/bundle/start-modules.json`.
- Secrets : RELEASES_TOKEN, TAURI_SIGNING_PRIVATE_KEY et son mot de passe (noms seulement). Fournisseur IA et plafond : Ali avant I4 ; médias : Ali avant I1.
- Écarts connus : méthodes SQL de l'ancien schéma encore dans `SyncRepository` (banc de test legacy, D-67) ; catalogues de textes hérités (`fr.ts` et autres) à purger avec le banc legacy, le test `src/i18n/noLegacyWords.test.ts` ne couvre que les textes vivants ; la copie de conflit iCloud `state 2.spx` est ignorée et signalée, sa cause reste une hypothèse.
