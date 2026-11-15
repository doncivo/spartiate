# ADR 0018 — Lignes créées par un appareil resté au schéma précédent

- Statut : **proposé, à valider par Ali** (auteur `sync-icloud`, SYNC-01 ; passe `architect` à faire avant de le marquer accepté).
- Date : 2026-11-15
- Ticket : SYNC-01 (lot 0.25.0), d'après D-275 et le constat D-275 de la relecture Codex (`git show 5d80c1eb:docs/relecture-codex-2026-11-13.md`, § 6).
- Complète : ADR 0011 §3.1, §3.2, §7.2 (aucun changement du format des journaux, des instantanés, de l'état publié ni de `sm`).

## Contexte

Une migration additive (0019 : `mesocycle.next_weeks`, `ramp_up` ; `nutrition_target.rest_kcal`, `rest_carb_g`, `training_days`) ajoute des
colonnes publiées à des tables déjà publiées. Un appareil resté au schéma 18 publie ses créations **sans** ces colonnes. L'appareil à jour
(19) ne crée une ligne absente que complète (ADR 0011 §3.1 : « toutes à la création » ; §7.2 : une ligne absente n'est insérée que complète) :
il met l'opération de côté (`sync_parked`, `missing-row`, `src/sync/apply.ts`). Avant SYNC-01, rien ne la reprenait jamais :

- l'ancien appareil, une fois mis à jour, ne republie pas la ligne (sa migration passe sous `sync_guard`, rien n'entre dans la file) ;
- la reprise depuis l'instantané, demandée par le moteur pour une ligne manquante, relit les mêmes opérations incomplètes ;
- l'avertissement affiché (`received-unapplied`, « reprise complète ») ne nommait pas la cause et ne menait à rien.

Le sens inverse (19 → 18 : champs inconnus dans `sync_unknown`, réintégrés après la migration) est couvert depuis Y-07.

## Décision livrée par SYNC-01 (format inchangé)

1. **Conservation.** L'opération incomplète reste dans `sync_parked` (durable, redémarrage compris), avec le schéma de l'écrivain (`sv`, JSON
   local de `sync_parked.op`, jamais publié). Une partie déjà gardée au même hlc ou plus récent n'est pas gardée deux fois (rejeu, reprise),
   hors report d'époque (marque de report gardée).
2. **Détection.** Tant que l'écrivain publie encore un `sv` inférieur au schéma local, ces opérations lèvent l'avertissement
   `older-device` (bandeau A-09 « synchro », « Un appareil utilise une version plus ancienne. Mets-le à jour. », catalogue chargé à la
   demande) au lieu de `received-unapplied`, sans reprise depuis l'instantané. L'écrivain mis à jour, une ligne restée de côté redevient une
   ligne manquante ordinaire (`received-unapplied`, reprise) : jamais muette.
3. **Reprise par l'écrivain (nouvelle cause d'entrée `'+'`, ADR 0011 §3.2).** Une fois par migration additive listée dans
   `SCHEMA_REPUBLISH` (`src/domain/sync/schemaRepublish.ts`), chaque appareil remet **entière** dans sa file chaque ligne des tables
   concernées (`'+'` : toutes les colonnes publiées, chaque champ avec sa propre horloge, mécanisme existant du report d'époque). Marque
   `sync_meta.schemaRepublished` posée dans la même transaction. L'appareil à jour reçoit la ligne complète et l'applique par la règle
   ordinaire ; ses parties de côté deviennent sans effet et sortent de `sync_parked`. Un appareil passé en 19 avec la 0.24.0 (sans marque)
   republie aussi une fois : les lignes perdues avant SYNC-01 reviennent. Fusion inchangée : un champ republié de même hlc ne change rien,
   un plus ancien perd sans conflit quand la base correspond (`merge.ts`).
4. **Garde des migrations futures.** `src/db/migrations/schemaRepublish.test.ts` échoue si une migration ajoute une colonne publiée à une
   table déjà publiée sans ligne dans `SCHEMA_REPUBLISH` (ou `SCHEMA_REPUBLISH_EXEMPT`, historique : 0006 et 0013 `workout_set`, 0014
   `routine_exercise`, D-290).

## Proposition à valider (non implémentée)

A. **Accepter le point 3 comme avenant 37 de l'ADR 0011 (§3.2, causes de `'+'`).** Il ne change ni le format ni la fusion, mais il ajoute une
   publication décidée par l'écrivain après sa migration ; D-26 demande qu'Ali le valide.

B. **Règle de complétion côté lecteur (option écartée par SYNC-01).** À l'application d'une création reçue d'un `sv` inférieur, compléter les
   colonnes ajoutées après ce `sv` par leur valeur par défaut de migration (nulle aujourd'hui), au hlc de la ligne. Elle reprendrait la ligne
   sans attendre la mise à jour de l'autre appareil, mais :
   - elle change une règle d'application du protocole (ADR 0011 §3.1, §7.2 : création complète seulement), donc la passe `architect` ;
   - elle demande au catalogue de savoir à quel `sv` chaque colonne est apparue, et suppose que chaque migration n'écrit que la valeur par
     défaut (une migration qui recalcule une valeur ferait diverger les appareils) ;
   - elle n'apporte rien quand l'ancien appareil est mis à jour (le point 3 suffit).
   À reconsidérer seulement si un appareil doit rester durablement à un schéma plus ancien tout en créant des lignes.

C. **Historique exempté (D-290).** Republier aussi `workout_set` (0006, 0013) et `routine_exercise` (0014) : tout l'historique des séries
   partirait une fois dans les journaux. Écarté par prudence (volume, schémas antérieurs à la 0.24.0) ; à rouvrir si une ligne de ces
   tables reste signalée.

## Conséquences

- Aucune donnée créée sur un appareil en retard n'est perdue en silence : gardée, signalée, reprise après sa mise à jour.
- Chaque migration additive sur une table publiée ajoute une ligne à `SCHEMA_REPUBLISH` (garde de test) ; coût : une republication des
  lignes de ces tables, une fois par appareil.
- Tests : `tests/unit/sync/versions/olderWriter.test.ts` (deux SQLite migrées en 18 et 19), `src/features/sync/olderDeviceBanner.test.tsx`,
  `src/db/migrations/schemaRepublish.test.ts` ; non-régression `twoVersions`, `reintegrate`, suites de synchro existantes.
