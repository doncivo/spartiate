# Reprise — dépôt Spartiate

État au 2026-11-12 : I1 à I5 livrés ; version publiée 0.13.0 (schéma 12). I6-01 (0.12.0, schéma 11) : docs/I6-01.md, D-95 à D-98. I6-02 (0.13.0, schéma 12) : docs/I6-02.md, D-99 à D-101, H-27 UNVERIFIED. **I6-03 (0.14.0, schéma 13, migration 0013 : `workout_set.circuit_id` et `circuit_rest_sec`, publiées, sans déclencheur) : branche `I6-03-circuits`, PR ouverte, fusion et tags par l'agent principal après CI verte (docs/I6-03.md, D-102 à D-104 : circuits, rejeu depuis le Journal, export complet CSV + JSON décrit dans docs/export-complet.md ; groupes absents des routines et de la génération).** **I3-07 (0.15.0, sans migration, schéma 13 inchangé) : onboarding en 8 écrans, branche `I3-07-onboarding`, PR #103, fusion par l'agent principal (docs/I3-07.md, D-110 à D-112).** Historique des versions : CHANGELOG.md. Mémoire inter-sessions (D-52, ≤ 5 Ko). Règles : AGENTS.md et CLAUDE.md. PRD v6.3 en chapitres : docs/prd/README.md. Décisions D-22 à D-104 dans docs/decisions.md (DEP-01, SQLite >= 0.39, revue au 30 nov.) ; les décisions approuvées priment sur les textes historiques.

## Fusionné (tout est dans main)

- Base : SPA-000 (#1 à #10), SPA-001a (#11), préparation et arbitrages (#12 à #14, D-65), 001b (front #15, périphérie #16 #18, base #20), FMT-01 (#17, D-66).
- Livraison : SPA-002 (Windows, updater signé), SPA-003 (IPA ad hoc, entitlements), ios-demarrage et ios-identite (journal visible, source SideStore propre).
- Produit I0 : SPA-005 (export / import), SPA-009 (écrans fidèles aux planches), SPA-006 (Apple Santé en lecture, diagnostic natif en 0.1.3), SPA-007 (Live Activity, minuteur de test).
- Versions publiées : 0.1.0 à 0.11.4, puis 0.12.0 et 0.13.0 (PC `vX.Y.Z`, iPhone `ios-vX.Y.Z`).

## Décisions récentes

- D-69 : accès direct HealthKit BLOCKED (compte Apple gratuit, SideStore retire l'entitlement) ; l'import passera par l'app Raccourcis, ticket séparé.
- D-70 : l'agent fusionne (`gh pr merge --squash`) et publie (tags `vX.Y.Z` et `ios-vX.Y.Z` sur origin/main après contrôle d'absence), puis suit les builds jusqu'à spartiate-releases. Ali installe et fait les constats sur appareil.

## Où on en est (2026-11-08)

- Publiées les nuits du 7 au 9 nov. : 0.3.2 à 0.7.0 (I2, I3, I4-01 à I4-03), 0.7.1 (correctifs iPhone), 0.8.0, 0.8.1, 0.9.0 (PC `vX.Y.Z` et iPhone `ios-vX.Y.Z`).
- D-73 (I3) et D-74 (I4) : décisions par défaut, **révisables par Ali** (à confirmer). H-21 (format du fichier Raccourcis) UNVERIFIED, noté dans decisions.md (le chapitre 26 du PRD est figé par prd-split.test.ts).
- I4 sans IA livré (D-74, D-76 par défaut, révisables) : moteur, catalogue Ciqual, journal, dashboard, stratégie, check-in. 0.8.0 (I4-05, D-77, D-78) : Open Food Facts et scan iPhone, H-12 et le scan restent UNVERIFIED (check-list dans la matrice). 0.8.1 (I4-06, D-79) : favoris locaux (non synchronisés), correctif de la restauration des déclencheurs de synchro, relectures de la nuit consignées dans docs/I4-06.md. 0.9.0 (I4-07, D-80, D-81, migration 0009) : recettes et journée complète déclarée, synchronisées. Exclus : photo IA (I4-04), I5. Le test de perf de démarrage est proche du seuil (1592 ms contre 1500 une fois, vert au second passage) : à surveiller.
- **Première utilisation réelle : lundi 2026-11-09** (D-38) : plus aucun accès aux données réelles ni à iCloud Drive/Spartiate.

## Prochaines étapes

1. Ali : installer 0.13.0 puis 0.14.0 (PC et iPhone le même jour, schémas 12 puis 13, avant toute saisie) ; constater le sélecteur de photo sur iPhone (H-27). Lot suivant : I3-07 (onboarding) ; D-94 à D-105 et D-110 à D-112 à confirmer.
2. Confirmer ou réviser D-73, D-74, D-79 à D-81 et D-88 à D-93 (échelle d'Exertion 20, journée rouge = maintien).

## Rappels

- Données réelles interdites (voir CLAUDE.md) ; jamais `git fetch circletasks` ; pas de `push --force`, de `reset --hard`, de `rm -rf`, de push sur main ; aucun tag supprimé ou repoussé.
- Suite complète en CI seulement ; en local, des tests ciblés (`--maxWorkers=1`, pas de commandes lourdes en parallèle : le système a déjà tué des processus pour manque de mémoire). Une compilation iPhone (`build-ios.yml`, `-f publish=false`) par lot qui touche Swift ou l'extension.
- Preuve native : aucun `CONFIRMED` sans constat d'Ali (D-36) ; H-3a et H-3b BLOCKED, H-4 CONFIRMED avec deux défauts d'affichage (voir la matrice).
- Bundle de départ : 358 400 octets gzip, liste blanche `tests/bundle/start-modules.json`.
- Secrets : RELEASES_TOKEN, TAURI_SIGNING_PRIVATE_KEY et son mot de passe (noms seulement). Fournisseur IA et plafond : Ali avant I4 ; médias : décision prise (H-9, D-71).
- Écarts connus : méthodes SQL de l'ancien schéma encore dans `SyncRepository` (banc de test legacy, D-67) ; catalogues de textes hérités (`fr.ts` et autres) à purger avec le banc legacy, le test `src/i18n/noLegacyWords.test.ts` ne couvre que les textes vivants ; la copie de conflit iCloud `state 2.spx` est ignorée et signalée, sa cause reste une hypothèse.
