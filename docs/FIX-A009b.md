# FIX-A009b — Réintégration d'un champ gardé contre l'horloge de ce champ (lot 0.28.0)

Statut : **terminé en local, non poussé** (ADR avant code, rouge, vert, qa-test, code-reviewer consignés ci-dessous). Lot 0.28.0, phase 1.5, bloquant de perte de
données trouvé par la passe qa-test de FIX-A009. Budget M. Branche `FIX-A009b` depuis `origin/FIX-A009` (`42a22c94`, PR #161 pas encore
fusionnée). Rôle : sync-icloud (propriétaire de `src/domain/sync` et de l'ADR 0011). Chapitres PRD : 9 (synchronisation, versions `sv`).
ADR lus : 0011 (§ 7.2, avenants 37 et 38), 0018. Décisions lues : D-26, D-290, D-316 (5), D-327. Fixtures synthétiques uniquement.
Aucune migration, aucun changement de format ni de `sm`.

## Constat

`decideReintegration` (`src/domain/sync/compat.ts`) prend comme horloge locale d'un champ gardé son horloge propre, sinon le repli `'*'`,
sinon le hlc de la ligne. Une colonne absente du schéma du lecteur quand le champ a été gardé n'a jamais d'horloge propre : le repli date une
écriture de la ligne, pas ce champ. Si la ligne a été écrite après le champ (jour renommé, cible supprimée), la valeur gardée est écartée
(`superseded`) et un conflit parasite est inscrit, par le journal comme par l'instantané. Reproduit : jeudi posé puis jour renommé sur A (20)
avant la lecture par B (19) ; B monté en 20 : `weekday` nul (critère 8 de PROG-04). Cible supprimée sur A : 3 conflits et valeurs nulles sur B.

## Passe architect : avenant 39 de l'ADR 0011 (écrit avant le code)

Texte intégral : `docs/adr/0011-synchronisation-icloud.md`, section 39 (et renvoi dans § 7.2, lot Y3). Résumé :

1. Horloge de comparaison = horloge **de ce champ** sur le lecteur.
2. Sans horloge propre **et valeur locale nulle** : jamais écrit ici (une colonne ajoutée par migration additive naît nulle, garde de test ;
   toute écriture d'un champ hors création pose son horloge propre) : la valeur gardée s'applique, sans conflit.
3. Sans horloge propre et valeur locale non nulle : écrite avec la ligne (`'*'`), colonne déjà connue : règle ordinaire et « même écriture ».
4. `deleted_at` : toujours la règle ordinaire ; jamais de résurrection ; une ligne supprimée reçoit le champ et reste supprimée.
5. Ligne absente : inchangé (trace de purge, insertion complète seulement).
6. Inchangés : ordre total par HLC, égalité, valeur locale écrite après qui reste, attente d'un parent, idempotence, format, `sm`, fusion.

Écart assumé au brief : la règle « absente = jamais écrite » est bornée à une valeur locale nulle (point 2) et exclut `deleted_at` (point 4).
Raison : un champ peut aussi être gardé pour une valeur refusée par une contrainte d'une colonne déjà connue ; sa valeur locale, écrite avec la
ligne, a alors pour horloge vraie `'*'`. Limite résiduelle écrite dans l'avenant (colonne connue écrite nulle avec la ligne, valeur gardée
non nulle plus ancienne) ; aucune valeur non nulle perdue.

## Passe product-owner : critères

| # | Critère (Given / When / Then) | Test |
| --- | --- | --- |
| 1 | Given A (20) pose jeudi puis renomme le jour avant que B (19) ne lise, When B passe en 20, Then B a `Jeudi lourd` et `weekday` = 4, `sync_unknown` vide, aucun conflit des deux côtés, A inchangé. | `fixA009bReintegration.test.ts` « journal » |
| 2 | Même scénario reçu par l'instantané de A (B rejoint après le renommage) : même résultat. | `fixA009bReintegration.test.ts` « instantané » |
| 3 | Given A (20) pose une cible avec les colonnes de la 0019 puis la supprime avant que B (18) ne lise, When B passe en 20, Then la cible reste supprimée sur B (aucune résurrection), ses trois colonnes sont réintégrées, aucun conflit. | `fixA009bReintegration.test.ts` « suppression » |
| 4 | Given un champ gardé ancien et une écriture locale postérieure du même champ (horloge propre plus récente), When la réintégration passe, Then la valeur locale reste, le champ quitte `sync_unknown`. | `fixA009bReintegration.test.ts` « écrit localement après » |
| 5 | Garde : toute colonne publiée ajoutée par une migration à une table déjà publiée naît nulle (pas de défaut non nul). | `fixA009bReintegration.test.ts` « garde » |
| 6 | Non-régression : `tests/unit/sync`, `src/sync`, `src/domain/sync` verts. | local, CI |

Périmètre écrit : `src/domain/sync/compat.ts` (`decideReintegration` seule), `src/domain/sync/compat.reintegration.test.ts` (cas réécrits
selon l'avenant), tests `tests/unit/sync/versions/fixA009b*.test.ts`, ADR 0011 (avenant 39), cette fiche. Hors périmètre : `apply.ts`,
`snapshot.ts`, `syncUnknown.ts` (lecture et écriture inchangées), format, fusion, traces, reprise, époques, reset, oubli, migrations.

## Passe sync-icloud (agent du module) : correction

- `src/domain/sync/compat.ts`, `decideReintegration`, ligne présente : `neverWritten` = aucune horloge propre, champ autre que `deleted_at`,
  valeur locale nulle, champ absent de la file d'envoi ; alors la valeur gardée s'applique sans conflit (comme « même écriture »). Rien
  d'autre : ligne absente, trace, parent manquant, métadonnées, repli `'*'` figé, retrait de `sync_unknown`, `syncUnknown.ts`, `apply.ts`,
  `snapshot.ts`, format, `sm`, fusion des journaux et instantanés inchangés. Aucune migration.
- Ajout à l'avenant (point 2) : un champ en file d'envoi a été écrit ici, il suit la règle ordinaire (cas pur « écriture locale en attente »).
- Tests existants réécrits selon l'avenant (jamais désactivés) : `compat.reintegration.test.ts` (« plus ancien que le hlc de la ligne », « plus
  ancien que le repli », « perdant dont le parent manque » : valeur locale non nulle) ; `reintegrateQa.test.ts` (Y-07) : « valeur gardée plus
  ancienne que le repli : jamais réintégrée » encodait le défaut ; scindé en « colonne nulle : réintégrée » et « colonne écrite avec la ligne :
  écartée ».
- Invariants et preuves : ordre total HLC et égalité (pur « horloge propre égale », qa « horloge égale ») ; aucune résurrection (pur
  `deleted_at`, critère 3, qa « ligne purgée ») ; valeur locale écrite après qui reste (critère 4) ; idempotence (qa « rejouée deux fois ») ;
  convergence des deux appareils sans conflit (critères 1 à 3, A et B comparés après trois allers-retours).

## Passe qa-test : cas limites

| Cas | Résultat | Test |
| --- | --- | --- |
| Deux champs gardés de schémas différents (19 et 21), plus anciens que `'*'` | tous deux réintégrés, aucun conflit | `fixA009bQa.test.ts` |
| Réintégration rejouée deux fois | idempotente : rien au second passage, horloges identiques | `fixA009bQa.test.ts` |
| Horloge propre égale | rien écrit, champ retiré, aucun conflit | `fixA009bQa.test.ts` |
| Colonne écrite avec la ligne (non nulle, sans horloge propre) | règle ordinaire : gardée plus ancienne écartée | `fixA009bQa.test.ts` |
| Ligne purgée (trace) | champ antérieur retiré, rien recréé ; postérieur en attente | `fixA009bQa.test.ts` |
| Ligne recréée (présente de nouveau, `'*'` postérieur, colonne nulle) | valeur gardée appliquée, aucun conflit | `fixA009bQa.test.ts` |
| Test manquant de FIX-A009 : filtre `retained` de `replaceFromSnapshot` | ligne écartée par l'horizon `data_reset` : aucune ligne dans `sync_unknown` ; ligne reprise : sa colonne gardée. Mutation (filtre retiré) : test rouge | `fixA009bQa.test.ts` |

Non couvert : réglage local écarté au remplacement (aucun réglage publié dans le catalogue Spartiate, même remarque que FIX-A009).

Tests locaux : `tests/unit/sync` (178 fichiers, 1 928 tests ; seul échec au premier passage : le cas Y-07 réécrit ci-dessus, vert ensuite),
`src/sync` et `src/domain/sync` (29 fichiers, 394 tests), `fixA009bQa.test.ts` (7 tests) verts ; `tsc` et `eslint` propres.

## Passe code-reviewer

À froid sur le diff `origin/FIX-A009..FIX-A009b` : **approuvé**, sous réserve de la CI verte. Changement de production d'une ligne de
décision, dans le domaine pur, conforme à l'avenant écrit avant ; rouge prouvé par la repro (`weekday` nul, trois colonnes nulles), vert
ensuite ; les deux tests existants réécrits l'ont été parce qu'ils encodaient la règle abrogée, avec chacun un cas témoin de la règle
ordinaire conservée. Point important consigné : limite résiduelle (colonne connue écrite nulle avec la ligne, valeur gardée plus ancienne non
nulle) écrite dans l'avenant 39, non atteignable avec le catalogue actuel ; correction complète = migration de `sync_unknown` (data-model).

## Décision proposée (à inscrire par l'appelant, pas écrite ici)

D-328 (FIX-A009b, suite de D-327 ; avenant 39 de l'ADR 0011) : à la réintégration d'un champ gardé dans `sync_unknown`, l'horloge locale de
comparaison est celle de ce champ. Sans horloge propre, valeur locale nulle et hors file d'envoi, le champ n'a jamais été écrit sur le
lecteur : la valeur gardée s'applique sans conflit, même si la ligne a été modifiée ou supprimée après. `deleted_at` suit toujours la règle
ordinaire (aucune résurrection) ; ligne absente, trace, égalité, ordre HLC, format et `sm` inchangés. Garde : toute colonne publiée ajoutée à une
table déjà publiée naît nulle. Limite résiduelle écrite dans l'avenant ; révisable par Ali.

Commits : ADR `c7d76aca`, rouge `f717c3f0`, vert `1ff6c217`, qa-test et fiche (ce commit).

## Passe code-reviewer (architecte)

Revue 1 (à froid, architecte, ADR amendé) : **approuvé** ; écart retenu (valeur locale non nulle et `deleted_at` exclus : sinon perte d'une valeur légitime ou résurrection) ; limite résiduelle acceptable sans migration. Réserves : (2) la réécriture du cas Y-07 de `reintegrateQa.test.ts`, qui figeait le défaut (C-168), est dans le commit vert `1ff6c217` et non dans le rouge `f717c3f0` (consigné ici, historique non réécrit) ; (3) la garde « colonne ajoutée nulle » tourne sur base vide : un remplissage par `UPDATE` dans une migration lui échapperait (registre BL-098) ; (4) exclure aussi une ligne créée ici et non publiée (`pending` sur `*`) : proposé (registre BL-099). Revue 2 (orchestrateur) : **approuvé sous réserve de la CI verte** (PR #162).
