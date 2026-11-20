# FIX-A009 — Colonnes nouvelles d'une table connue gardées à la réception d'un instantané (lot 0.28.0)

Statut : **code et tests faits sur la branche, non poussés (revue de l'appelant et CI à suivre).** Budget M. Branche `FIX-A009` depuis
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
