# SHELL-0294f — documents, outillage de publication, icônes, données (lot 0.29.4)

Lot 0.29.4 (docs/LOT-0.29.2.md, docs/LOT-0.29.2-audit.md), registre « coquille, iOS et qualité » et « données et synchro », sixième PR (après SHELL-0294a #216, SHELL-0294b #217, SHELL-0294c, SHELL-0294d #219, SHELL-0294e #220).
Chapitres : 12.1, 18.1, 18.4, 19.2, 21.2, 24, 25.2, 27, annexes A et B ; ADR 0014. Choix prudents : D-618 à D-628, « Claude (choix prudent) ; révisable par Ali ». Questions : Q-37, Q-38.
Aucune migration, aucun Swift ni Rust touché ; `src/sync/**` touché (BL-166) : relecture sync-icloud demandée (périmètre plus bas, D-26).

## Passe product-owner (critères Étant donné / quand / alors)

1. BL-149 (D-490) : étant donné docs/decisions.md, quand on lance `node scripts/release/prudent-review.mjs --write`, alors docs/decisions-a-prendre.md porte une section par thème (six thèmes de D-490), une ligne par D- (poids, ID, résumé, ce qu'Ali tranche ou « à confirmer seulement »), les plus lourdes en tête ; un test échoue si une D- « choix prudent » manque.
2. BL-150 : chaque contradiction citée (D-16 / § 21.2, mésocycle 4–6 / 4–7, `platform.kind` / D-47, v0.0.x / D-58, renvois à docs/PRD.md) a une D- et son chapitre corrigé ; `prd-split.test.ts` reste vert.
3. BL-148 : la ligne « Fork, renommage… » et H-12 ne sont promues que sur des constats d'Ali déjà consignés ; H-15 sans Recharts ; ADR 0014 sans l'ancien nom du journal.
4. BL-158 : une date de réévaluation de D-412 est proposée (Q-37).
5. BL-165 : une étape du job de publication réécrit par l'API les six corps anciens, jamais à la main ; tests sur chaînes synthétiques ; aucun appel réel.
6. § 18.4 b : un script génère les icônes depuis `content/brand/spartiate.svg` avec les outils déjà installés.
7. § 18.1 c : fait seulement si propre et sans grossir le départ ; sinon raison écrite.
8. BL-166 : une intention d'ajout d'une autre époque n'est jamais publiée comme tête. BL-030 : la réintégration en échec au démarrage est vérifiée par test.

## Passe agent du module

- Documents et outillage : `scripts/release/prudent-review.mjs`, `scripts/release/generate-icons.mjs`, `scripts/ios/redact-release-bodies.mjs`, `.github/workflows/build-ios.yml` (une étape en fin du job `publish`), `scripts/release/fixtures/prd-v6.3-changes.json` (9 corrections), chapitres 19, 21, 24, 25, 27, 28, 29, `docs/capability-matrix.md`, `docs/adr/0014-journal-technique-persistant.md` (avenant), `docs/decisions-a-prendre.md`.
- Synchro (sync-icloud) : `src/sync/orphanEpoch.ts` seul (`resolveInflight` lit l'époque courante dans `META.epoch` ; un argument facultatif sert aux tests). `src/sync/engine.ts`, dans le départ, n'est pas touché.
- Test existant modifié avec écart consigné : `prd-split.test.ts`, liste fermée des décisions étendue à D-619 à D-623 (mises en cohérence sans changement de fond, une D- chacune). `matrixCoherence.test.ts` : marqueurs `ancien-ok` ajoutés au vert (garde d'identité), assertions inchangées.
- Relevé BL-149 : 356 décisions au 25/11 après fusion de main (l'« environ 229 » de l'audit date de f5a1b88). Le tri est mécanique (mots-clés) : D-618 le dit, Ali corrige.

## Passe qa-test (rouge → vert)

| Ligne | SHA rouge | SHA vert |
|---|---|---|
| BL-149 | 71abc11a (module absent) | 0130daa9 |
| BL-150 | 21da1a99 (5 rouges) | 032b41db |
| BL-148 | 04d35f66 (4 rouges) | f7c37663 |
| BL-158 | aucun (texte de question, Q-37) | e457fe8d |
| BL-165 | 08e3cbd7 (module absent) | ee22aff8 |
| § 18.4 b | 0a1ccf9a (module absent) | 3169e82b |
| BL-166 | 36c348be (1 rouge sur 2 ; rouge au typage : 4e argument absent) | 20a16006 (plus un cas : époque lue dans `sync_meta`, sans argument) |
| BL-030 | aucun : test de constat, sans code changé (D-628) | 0a2b438a |

Fusion de origin/main (SHELL-0294e) : 1c4616c2 (conflits de decisions.md et decisions-a-prendre.md résolus, relevé régénéré).
Vérification réelle des icônes : `node scripts/release/generate-icons.mjs --check` : 35 icônes identiques octet à octet, `icon.icns` (macOS, non déterministe d'une génération à l'autre) comparé par présence.

## Périmètre de la relecture sync-icloud (D-26, BL-166)

- Fichiers : `src/sync/orphanEpoch.ts` (`resolveInflight`, une dizaine de lignes), `tests/unit/sync/data0294f/inflightEpoch.test.ts`.
- Changement : époque courante = argument facultatif, sinon `readJson(META.epoch)` ; si elle est connue et `inflight.epoch` différente → transaction qui remet `META.inflight` à nul, aucun `writeOwnState`, aucun `clearPublished`, aucun `META.head`, journal `inflight-resolved { appended: false, staleEpoch: true }`. Même époque : inchangé.
- À juger : (1) l'abandon garde la file, donc les entrées de l'ancienne époque repartent dans la nouvelle : doublon admis (même HLC, même valeur, pas de conflit) plutôt que perte ; (2) l'appel n'a lieu que si la règle actuelle permet ou si la borne vient de cette intention (`first.source === 'inflight'`, déjà de l'époque courante) ; (3) `META.epoch` est-elle toujours l'époque du cycle à ce point (écrite par `engine.ts` à l'ouverture, `epochSwitch.ts`, `reset.ts`, `restoreChoice.ts`) ; époque inconnue (nulle) : ancien comportement ; (4) interaction avec `publishRotation` (non lue dans le cas abandonné) et avec `epochSwitch` / `queueOwnRowsForRepublish`, qui ne remettent pas `inflight` à nul.
- Non-régression lancée : `tests/unit/sync/data0293`, `crashPoints`, `firstPublicationCrashPoints`, `largeQueueResume`, `evictedHeadRotation`, `publishDeferred` verts ; voir « Vérifications » pour la suite de synchro complète. Non couvert : scénario de bout en bout avec deux appareils et changement d'époque réel entre deux cycles (le banc `tests/sim/syncDevice` n'a pas d'aide pour forcer une nouvelle époque entre l'ajout et le cycle suivant).

## Ce qui reste (et pourquoi)

- BL-149 : recommandation et conséquences rédigées décision par décision pour les « à trancher » (le script ne pose qu'« A garder · B réviser » avec les effets repérés).
- BL-165 : l'étape tourne à la prochaine publication iPhone ; vérifier ensuite que les six corps sont propres.
- § 18.1 c : non fait. L'action de chaque geste n'est pas spécifiée (§ 18.1, § 13), un geste sur une ligne entre en concurrence avec le défilement et ne se prouve que par un e2e iPhone et un constat d'Ali ; Q-38.
- BL-030 : double panne (écriture de l'échec impossible) seulement au journal ; le correctif ajoute des octets à deux modules du départ (`syncUnknown.ts`, `service.ts`), à compenser dans un ticket dédié (D-628).
- BL-166 : relecture sync-icloud.

## Mesure du bundle de départ

**180 702 octets normalisés (brut 180 692), soit ±0 contre main** (repère de SHELL-0294e sur ce poste : 180 702) ; 174 tests de `startBundle.test.ts` verts, aucun module ajouté à `tests/bundle/start-modules.json`. Seul `src/sync/orphanEpoch.ts` (bloc à la demande, absent de `tests/bundle/start-modules.json`) touche `src` hors tests ; mesure plus bas.

## Vérifications

`npm run typecheck` propre ; eslint propre sur les fichiers touchés ; Vitest ciblés verts (`prudentReview`, `prd-split`, `matrixCoherence`, `generateIcons`, `redactReleases`, `ios`, `inflightEpoch`, `bl030Reintegration`, `ciPub`, `ciTrigger`, `release`) ; gardes `docs-paths`, `agents`, `backlogCount`, `privacy`, `identity` vertes ; contrôle des noms de lieux à 0 sur chaque fichier touché.
Suite de synchro (`tests/unit/sync`, `src/sync`, deux processus) : 2 035 réussis sur 2 036 ; l'échec, `forgetSecondReview.test.ts` (5) à 5 097 ms, est le délai de 5 s dépassé sous charge : le fichier relancé seul passe (8 sur 8). Non lancés ici : e2e, visual, perf Playwright, Rust (aucun fichier Rust touché).

## Passe code-reviewer

Non faite dans cette session : relecture à froid et relecture sync-icloud (BL-166) à lancer par le coordinateur.
