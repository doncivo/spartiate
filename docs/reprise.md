# Reprise — dépôt Spartiate

État au 2026-11-09 (nuit) : I1, I2 et I3 livrés, version publiée 0.8.0, I4 hors IA livré, OFF et scan inclus. Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md. PRD v6.3 en chapitres : docs/prd/README.md. Décisions D-22 à D-78 dans docs/decisions.md ; les décisions approuvées priment sur les textes historiques. Dossier de sortie I0 : docs/gate-i0.md.

## Fusionné (tout est dans main)

- Base : SPA-000 (#1 à #10), SPA-001a (#11), préparation et arbitrages (#12 à #14, D-65), 001b (front #15, périphérie #16 #18, base #20), FMT-01 (#17, D-66).
- Livraison : SPA-002 (Windows, updater signé), SPA-003 (IPA ad hoc, entitlements), ios-demarrage et ios-identite (journal visible, source SideStore propre).
- Produit I0 : SPA-005 (export / import), SPA-009 (écrans fidèles aux planches), SPA-006 (Apple Santé en lecture, diagnostic natif en 0.1.3), SPA-007 (Live Activity, minuteur de test).
- Versions publiées : 0.1.0 à 0.1.6 (PC `vX.Y.Z`, iPhone `ios-vX.Y.Z`). #44 à #50 : finitions 0.1.2, diagnostic 0.1.3, correctifs d'essai 0.1.4 (zoom iOS, écrans relus après synchro, conflits en français, « Jamais lu », copies iCloud, icône), SPA-007 0.1.5.
- #51 (0.1.6) : finitions Apple Santé, textes sans reste de l'ancien projet, Live Activity « Terminé » à l'échéance, notification à la seconde, preuves d'Ali dans la matrice, gate-i0.md. Puis le report du go (D-71).

## Décisions récentes

- D-69 : accès direct HealthKit BLOCKED (compte Apple gratuit, SideStore retire l'entitlement) ; l'import passera par l'app Raccourcis, ticket séparé.
- D-70 : l'agent fusionne (`gh pr merge --squash`) et publie (tags `vX.Y.Z` et `ios-vX.Y.Z` sur origin/main après contrôle d'absence), puis suit les builds jusqu'à spartiate-releases. Ali installe et fait les constats sur appareil.

## Où on en est (2026-11-08)

- Publiées cette nuit (PC `vX.Y.Z` et iPhone `ios-vX.Y.Z`) : 0.3.2 (I2-02 garde-fous, correctifs du moteur #66, pesées Raccourcis D-69 #65, cause des erreurs d’E/S Windows #62), 0.3.3 (I2-04 : paire de 9 kg rattrapée à la lecture, phrases), 0.3.4 (I2-03 échauffement), 0.4.0 (I3-01 séance proposée), 0.5.0 (I3-02 cycle, migration 0007 `mesocycle`, schéma 7), 0.6.0 (I4-01 moteur nutrition, I4-02 catalogue Ciqual et journal, migration 0008, schéma 8), 0.7.0 (I4-03 onglet Nutrition).
- D-73 (I3) et D-74 (I4) : décisions par défaut, **révisables par Ali** (à confirmer). H-21 (format du fichier Raccourcis) UNVERIFIED, noté dans decisions.md (le chapitre 26 du PRD est figé par prd-split.test.ts).
- I4 sans IA livré (D-74, D-76 par défaut, révisables) : moteur, catalogue Ciqual, journal, dashboard, stratégie, check-in. 0.8.0 (I4-05, D-77, D-78) : Open Food Facts (client Rust, HTTPS rustls, cache 90 jours, sans migration) et scan iPhone ; H-12 et le scan restent UNVERIFIED, check-list de constat dans la matrice. Exclus : recettes, favoris, photo IA (I4-04). Le test de perf de démarrage est proche du seuil (1592 ms contre 1500 une fois, vert au second passage) : à surveiller.
- PURGE-I18N (#74) : modules de textes orphelins supprimés ; clés mortes à l’intérieur de fr.ts gardées (tDynamic).
- **Première utilisation réelle : lundi 2026-11-09** (D-38) : plus aucun accès aux données réelles ni à iCloud Drive/Spartiate.

## Prochaines étapes

1. Ali : constats sur l’iPhone (échauffement, Séance proposée, Cycle, import des pesées), confirmer ou réviser D-73 et D-74.
2. Constats OFF et scan (matrice : produit de marque, « skyr » en ligne, mode avion, code inconnu) ; relectures Codex (D-53) des PR de la nuit.
3. Après le lundi 9 : journal exporté d’Ali (Plus → Logs → Exporter) pour mesurer le délai iCloud.

## Rappels

- Données réelles interdites (voir CLAUDE.md) ; jamais `git fetch circletasks` ; pas de `push --force`, de `reset --hard`, de `rm -rf`, de push sur main ; aucun tag supprimé ou repoussé.
- Suite complète en CI seulement ; en local, des tests ciblés (`--maxWorkers=1`, pas de commandes lourdes en parallèle : le système a déjà tué des processus pour manque de mémoire). Une compilation iPhone (`build-ios.yml`, `-f publish=false`) par lot qui touche Swift ou l'extension.
- Preuve native : aucun `CONFIRMED` sans constat d'Ali (D-36) ; H-3a et H-3b BLOCKED, H-4 CONFIRMED avec deux défauts d'affichage (voir la matrice).
- Bundle de départ : 358 400 octets gzip, liste blanche `tests/bundle/start-modules.json`.
- Secrets : RELEASES_TOKEN, TAURI_SIGNING_PRIVATE_KEY et son mot de passe (noms seulement). Fournisseur IA et plafond : Ali avant I4 ; médias : décision prise (H-9, D-71).
- Écarts connus : méthodes SQL de l'ancien schéma encore dans `SyncRepository` (banc de test legacy, D-67) ; catalogues de textes hérités (`fr.ts` et autres) à purger avec le banc legacy, le test `src/i18n/noLegacyWords.test.ts` ne couvre que les textes vivants ; la copie de conflit iCloud `state 2.spx` est ignorée et signalée, sa cause reste une hypothèse.
