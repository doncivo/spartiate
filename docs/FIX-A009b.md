# FIX-A009b — Réintégration d'un champ gardé contre l'horloge de ce champ (lot 0.28.0)

Statut : **ADR avant code** (passe architect consignée ci-dessous), puis rouge, vert, qa-test. Lot 0.28.0, phase 1.5, bloquant de perte de
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
