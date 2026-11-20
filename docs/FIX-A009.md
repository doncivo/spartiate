# FIX-A009 — Colonnes nouvelles d'une table connue gardées à la réception d'un instantané (lot 0.28.0)

Statut : **code et tests faits sur la branche, non poussés (revue de l'appelant et CI à suivre).** Commits : rouge `07a94c57`, vert `6e648f3d`, qa-test (ce commit). Tests locaux : `tests/unit/sync` (176 fichiers, 1 915 tests ; seul échec : hygiène `new Date()` du fichier qa, corrigé et revérifié), `src/sync` et `src/domain/sync` (29 fichiers, 390 tests) verts ; `tsc` et `eslint` propres. Budget M. Branche `FIX-A009` depuis
`origin/main` (`5f0b68a7`, après HIST-01). Aucune migration (schéma 20 inchangé), format sur disque inchangé. Lot 0.28.0, phase 1.4. Rôle : sync-icloud.
Origine : audit Codex 0.26.0 (`origin/audit-0.26.0`, `docs/audit-0.26.0/bloquants.md`, A-009 et complément PROG-04) ; preuves
`preuves/partie3-snapshot-colonnes.test.mjs` et `preuves/partie3-weekday-main.test.mjs` (reprises en Vitest dans `tests/unit/sync/versions/`,
jamais branchées depuis docs/). Chapitres PRD : 9 (synchronisation, § 9.1 catalogue, versions `sv`). ADR lus : 0011 (§ 5.1 instantané, § 7.2
champs inconnus et réintégration), 0018 (republication après montée de schéma, limites M2 à M4). Décisions lues : D-26, D-290, D-316 (5).
Fixtures synthétiques uniquement (D-292).

## Constat

`src/sync/snapshot.ts` : `rowToOp` ne parcourt que les colonnes du catalogue du lecteur et `keepUnknownTableRows` écartait les tables connues.
Une colonne nouvelle d'une table CONNUE (`nutrition_target.rest_kcal`, `rest_carb_g`, `training_days` de la 0019 ; `routine_day.weekday` de
la 0020) reçue par instantané d'un écrivain de schéma supérieur n'atteignait jamais `sync_unknown` (le journal, lui, la garde : `apply.ts`,
`keepUnknown`). La reprise avance ensuite le curseur couvert : la valeur n'était pas réintégrée à la mise à jour du lecteur. Même perte au
remplacement d'époque (`replaceFromSnapshot` vide `sync_unknown` puis ne garde que `snap-unknown`).

## Règle appliquée (choix prudents, révisables par Ali)

- Instantané de `snap-end.sv` > schéma local (même majeure) : pour chaque ligne d'une table connue, chaque champ que le catalogue local ne
  connaît pas est gardé dans `sync_unknown` (valeur, hlc propre du champ sinon `'*'`, base inconnue, `sv` de l'instantané), sous les validations
  du journal : nom valide (`isUnknownName`), jamais une colonne technique (`updated_at`, `device_id`, `hlc`), locale, `id` ou `key`, identifiant
  de ligne valide, jamais un réglage local. `putUnknown` garde le hlc le plus récent (rejeu, deux instantanés successifs).
- Fusion (reprise, association) : comme le journal, pour toute ligne valide de l'instantané. Remplacement : seulement pour les lignes que le
  remplacement garde ou met de côté (parent manquant) ; une ligne écartée (horizon de remise à zéro) ne laisse aucun champ gardé.
- Schéma égal ou inférieur : rien n'est gardé (inchangé). Réintégration : mécanisme existant (`reintegrateUnknownFields`, `compat.ts`), inchangé.

## Passe product-owner : critères

| # | Critère (Given / When / Then) | Test |
| --- | --- | --- |
| 1 | Given un lecteur 18, When il fusionne un instantané 19 portant `nutrition_target.rest_kcal` = 2200, Then le champ est dans `sync_unknown` (sv 19) alors que la reprise avance au curseur couvert ; témoin journal identique. | `fixA009Proofs.test.ts` (preuve Codex 1) |
| 2 | Given un lecteur 19, When il fusionne un instantané 20 portant `routine_day.weekday` = 4, Then jeudi est dans `sync_unknown` (sv 20) ; témoin journal. | `fixA009Proofs.test.ts` (preuve Codex 2) |
| 3 | Given A (20) avec un jour au jeudi et une cible avec les colonnes de la 0019, When B (19) rejoint par l'instantané de A puis passe en 20, Then B a `weekday` = 4, A inchangé, `sync_unknown` vide, aucun conflit. | `fixA009TwoDevices.test.ts` « schéma 19 » |
| 4 | Given le même A, When B (18) rejoint par l'instantané puis passe en 20, Then jeudi et les trois colonnes nutritionnelles sont sur B, aucun conflit. | `fixA009TwoDevices.test.ts` « schéma 18 » |
| 5 | Témoin : B (19) associé avant les écritures reçoit par le journal, puis passe en 20 : jeudi présent. | `fixA009TwoDevices.test.ts` « témoin journal » |
| 6 | Given B (19) synchronisé, When A (20) restaure et choisit « Appliquer partout », Then après le remplacement par l'instantané jeudi est dans `sync_unknown` de B, puis réintégré en 20, aucun conflit. | `fixA009TwoDevices.test.ts` « remplacement d'époque » |
| 7 | Non-régression : suites `tests/unit/sync`, `src/sync`, `src/domain/sync` vertes. | CI et local |

Périmètre : `src/sync/snapshot.ts` (seul fichier de production), tests `tests/unit/sync/versions/fixA009*.test.ts`, cette fiche.
Hors périmètre : protocole chiffré, format, fusion par champ, tombstones, reprise, reset, oubli, migrations, réintégration (`compat.ts`).

## Passe sync-icloud (agent du module) : correction

- `src/sync/snapshot.ts` : `keepUnknownColumns` (nouveau) et `keepUnknownTableRows` étendu aux tables connues ; `replaceFromSnapshot` note
  les lignes gardées ou mises de côté (`retained`) et ne garde que leurs colonnes inconnues. Rien d'autre : `rowToOp`, fusion, horloges,
  traces, reprise (`join.ts`, `finishResumeTx`), changement d'époque, reset, oubli, format et réintégration inchangés. Aucune migration.
- Invariants conservés et preuves : HLC par champ (horloge propre du champ gardée, `putUnknown` garde la plus récente : qa « horloge plus
  ancienne », « deux instantanés ») ; reprise (curseur couvert inchangé, preuves 1 et 2) ; remplacement d'époque (critère 6) ; schéma égal
  sans effet (qa « même schéma ») ; colonnes techniques jamais gardées (qa « validations ») ; tombstones, reset, oubli : suites existantes vertes.
- Republication : un lecteur ancien republie ses champs gardés dans ses instantanés (`snap-unknown`, Y-07, inchangé) ; après sa mise à jour, la
  republication `SCHEMA_REPUBLISH` (ADR 0018) porte la valeur réintégrée (critères 3, 4 et 6 : A et B identiques après trois allers-retours).

## Passe qa-test : cas limites

| Cas | Résultat | Test |
| --- | --- | --- |
| Lecteur déjà au même schéma (instantané 18 sur 18) | rien gardé, ligne identique | `fixA009Qa.test.ts` |
| Horloge plus ancienne que la valeur déjà gardée | la plus récente reste (hlc, valeur, sv) | `fixA009Qa.test.ts` |
| Deux instantanés successifs (rejeu, puis plus récent) | aucun double ; le plus récent remplace | `fixA009Qa.test.ts` |
| Colonnes techniques (`hlc`, `device_id`, `updated_at`) et nom invalide dans la ligne | jamais gardés ; `rest_kcal` réintégré, sans conflit | `fixA009Qa.test.ts` |
| Colonne inconnue d'une ligne supprimée (`deleted_at`), journal et instantané | gardée à l'identique par les deux chemins (valeur, hlc de création, sv 20) ; ligne jamais ressuscitée | `fixA009Qa.test.ts` |

**Défaut antérieur trouvé (hors A-009, non corrigé, arbitrage architect).** Réintégration (`src/domain/sync/compat.ts`, `decideReintegration`) :
un champ gardé sans horloge propre locale est comparé au repli `'*'` de la ligne locale. Si la ligne a été modifiée après l'écriture du champ
(autre champ, suppression), `'*'` est plus récent : la valeur gardée est écartée (`superseded`) et un conflit est inscrit, **par le journal
comme par l'instantané**. Reproduit : jeudi posé puis jour renommé sur A (20) avant la lecture de B (19) → B en 20 a `weekday` nul
(`.codex-tmp/lot028/FIX-A009-repro-reintegration-star.test.ts.txt`, à brancher par le ticket de correction) ; cible supprimée sur A → 3 conflits
et valeurs nulles sur B. Correction pressentie : pour une colonne que le schéma local n'avait pas (`sv` gardé > version de la colonne
locale), absence d'horloge propre = jamais écrite localement, la valeur gardée s'applique sans conflit ; c'est une règle de réintégration
(ADR 0011 §7.2, Y-07 D3), donc ADR avant code.

## Avis sur les limites M2 à M4 de l'ADR 0018

Non traitées par ce correctif, et non concernées : M2 (écrivain déduit du plus grand hlc d'une partie gardée), M3 (reprise depuis l'instantané
gaspillée pendant la republication) et M4 (parties gardées sans `sv` par la 0.24.0) portent sur le sens **ancien écrivain → lecteur à jour**
(`sync_parked`, `missing-row`). A-009 est le sens inverse (écrivain récent → lecteur ancien, `sync_unknown`). Le correctif ne change ni
`olderWriter.ts` ni `sync_parked` ; il ferme en revanche le chemin « instantané » que l'ADR 0018 supposait couvert « depuis Y-07 ».

## Décision proposée (à inscrire par l'appelant, pas écrite ici)

D-xxx (FIX-A009, A-009) : à la réception d'un instantané de `sv` supérieur (même majeure), les colonnes qu'une table connue n'a pas encore
sont gardées dans `sync_unknown` comme celles d'un journal (mêmes validations, horloge propre sinon `'*'`, base inconnue, `sv` de
l'instantané) ; en remplacement, seulement pour les lignes gardées ou mises de côté. Format, fusion et réintégration inchangés ; aucune migration.

Avenant proposé à l'ADR 0011 § 7.2 : « Un champ inconnu est gardé quel que soit son chemin d'arrivée (journal, instantané en fusion ou en
remplacement), qu'il appartienne à une table inconnue ou à une table connue du lecteur. »

## Reste

- Défaut de réintégration ci-dessus (architect, puis ticket sync-icloud) : impact PROG-04 critère 8 dès qu'un jour est modifié après son
  rattachement, avant la lecture par l'appareil resté en 19.
- Remplacement : une clé de réglage inconnue (`settings`, portée `unknown`) n'est pas gardée par `replaceFromSnapshot` (la fusion la garde par
  `applyOps`) ; aucun réglage publié dans le catalogue Spartiate à ce jour, sans effet visible.
