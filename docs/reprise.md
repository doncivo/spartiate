# Reprise — dépôt Spartiate

État au 2026-11-07 (I1 clos, version publiée 0.2.4, I2 en cours). Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md. PRD v6.3 en chapitres : docs/prd/README.md. Décisions D-22 à D-72 dans docs/decisions.md ; les décisions approuvées priment sur les textes historiques. Dossier de sortie I0 : docs/gate-i0.md.

## Fusionné (tout est dans main)

- Base : SPA-000 (#1 à #10), SPA-001a (#11), préparation et arbitrages (#12 à #14, D-65), 001b (front #15, périphérie #16 #18, base #20), FMT-01 (#17, D-66).
- Livraison : SPA-002 (Windows, updater signé), SPA-003 (IPA ad hoc, entitlements), ios-demarrage et ios-identite (journal visible, source SideStore propre).
- Produit I0 : SPA-005 (export / import), SPA-009 (écrans fidèles aux planches), SPA-006 (Apple Santé en lecture, diagnostic natif en 0.1.3), SPA-007 (Live Activity, minuteur de test).
- Versions publiées : 0.1.0 à 0.1.6 (PC `vX.Y.Z`, iPhone `ios-vX.Y.Z`). #44 à #50 : finitions 0.1.2, diagnostic 0.1.3, correctifs d'essai 0.1.4 (zoom iOS, écrans relus après synchro, conflits en français, « Jamais lu », copies iCloud, icône), SPA-007 0.1.5.
- #51 (0.1.6) : finitions Apple Santé, textes sans reste de l'ancien projet, Live Activity « Terminé » à l'échéance, notification à la seconde, preuves d'Ali dans la matrice, gate-i0.md. Puis le report du go (D-71).

## Décisions récentes

- D-69 : accès direct HealthKit BLOCKED (compte Apple gratuit, SideStore retire l'entitlement) ; l'import passera par l'app Raccourcis, ticket séparé.
- D-70 : l'agent fusionne (`gh pr merge --squash`) et publie (tags `vX.Y.Z` et `ios-vX.Y.Z` sur origin/main après contrôle d'absence), puis suit les builds jusqu'à spartiate-releases. Ali installe et fait les constats sur appareil.

## Où on en est (2026-11-07)

- I1 livré : 0.2.0 à 0.2.2 (I1-01/02/03), 0.2.3 (retours d'essai), 0.2.4 (#57 : journaux enrichis received/published/cloud-pending, étape des échecs, io-* Rust, relance rapide des fichiers iCloud en attente, marqueur de mise à jour de routine). PC et iPhone publiés.
- D-72 : « I2 : OK » d'Ali. Pas de table de standards ; 1RM Epley sur la meilleure série puis moyenne pondérée des 3 dernières séances ; confiance 100 % jusqu'à 14 j, nulle à 60 j ; progression à double palier ; snap au matériel ; baisse de reps = deux propositions refusables ; 3 séances sans progrès = trois choix ; deload, reprise après arrêt, échauffement : voir D-72.
- **Première utilisation réelle : lundi 2026-11-09** (D-38) : plus aucun accès aux données réelles ni à iCloud Drive/Spartiate.

## Prochaines étapes

1. **I2-01** (docs/I2-01.md, migration 0005), puis I2-02 (contraintes), I2-03 (échauffement). Versions 0.3.x selon le découpage.
2. **Ticket Raccourcis** (D-69).
3. Après le lundi 9 : journal exporté d'Ali (Plus → Logs → Exporter) pour mesurer le délai iCloud.

## Rappels

- Données réelles interdites (voir CLAUDE.md) ; jamais `git fetch circletasks` ; pas de `push --force`, de `reset --hard`, de `rm -rf`, de push sur main ; aucun tag supprimé ou repoussé.
- Suite complète en CI seulement ; en local, des tests ciblés (`--maxWorkers=1`, pas de commandes lourdes en parallèle : le système a déjà tué des processus pour manque de mémoire). Une compilation iPhone (`build-ios.yml`, `-f publish=false`) par lot qui touche Swift ou l'extension.
- Preuve native : aucun `CONFIRMED` sans constat d'Ali (D-36) ; H-3a et H-3b BLOCKED, H-4 CONFIRMED avec deux défauts d'affichage (voir la matrice).
- Bundle de départ : 358 400 octets gzip, liste blanche `tests/bundle/start-modules.json`.
- Secrets : RELEASES_TOKEN, TAURI_SIGNING_PRIVATE_KEY et son mot de passe (noms seulement). Fournisseur IA et plafond : Ali avant I4 ; médias : décision prise (H-9, D-71).
- Écarts connus : méthodes SQL de l'ancien schéma encore dans `SyncRepository` (banc de test legacy, D-67) ; catalogues de textes hérités (`fr.ts` et autres) à purger avec le banc legacy, le test `src/i18n/noLegacyWords.test.ts` ne couvre que les textes vivants ; la copie de conflit iCloud `state 2.spx` est ignorée et signalée, sa cause reste une hypothèse.
