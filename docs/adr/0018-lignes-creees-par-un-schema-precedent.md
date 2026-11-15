# ADR 0018 — Lignes créées par un appareil resté au schéma précédent

- Statut : **accepté** (décision d'Ali du 2026-11-15 : option A avec C ; B écartée ; passe architect faite). Auteur `sync-icloud`, SYNC-01.
- Date : 2026-11-15
- Ticket : SYNC-01 (lot 0.25.0), d'après D-275 et le constat D-275 de la relecture Codex (`git show 5d80c1eb:docs/relecture-codex-2026-11-13.md`, § 6).
- Complète : ADR 0011 §3.1, §3.2, §7.2 (aucun changement du format des journaux, des instantanés, de l'état publié ni de `sm`) ; porté par l'avenant 37 de l'ADR 0011 (§37).

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

## Options soumises à Ali (tranchées le 2026-11-15)

A. **Retenue.** **Accepter le point 3 comme avenant 37 de l'ADR 0011 (§3.2, causes de `'+'`).** Il ne change ni le format ni la fusion, mais il ajoute une
   publication décidée par l'écrivain après sa migration ; D-26 demande qu'Ali le valide.

B. **Écartée par Ali.** **Règle de complétion côté lecteur.** À l'application d'une création reçue d'un `sv` inférieur, compléter les
   colonnes ajoutées après ce `sv` par leur valeur par défaut de migration (nulle aujourd'hui), au hlc de la ligne. Elle reprendrait la ligne
   sans attendre la mise à jour de l'autre appareil, mais :
   - elle change une règle d'application du protocole (ADR 0011 §3.1, §7.2 : création complète seulement), donc la passe `architect` ;
   - elle demande au catalogue de savoir à quel `sv` chaque colonne est apparue, et suppose que chaque migration n'écrit que la valeur par
     défaut (une migration qui recalcule une valeur ferait diverger les appareils) ;
   - elle n'apporte rien quand l'ancien appareil est mis à jour (le point 3 suffit).
   À reconsidérer seulement si un appareil doit rester durablement à un schéma plus ancien tout en créant des lignes.

C. **Retenue (exemption maintenue).** **Historique exempté (D-290).** Republier aussi `workout_set` (0006, 0013) et `routine_exercise` (0014) : tout l'historique des séries
   partirait une fois dans les journaux. Écarté par prudence (volume, schémas antérieurs à la 0.24.0) ; à rouvrir si une ligne de ces
   tables reste signalée.

## Conséquences

- Aucune donnée créée sur un appareil en retard n'est perdue en silence : gardée, signalée, reprise après sa mise à jour.
- Chaque migration additive sur une table publiée ajoute une ligne à `SCHEMA_REPUBLISH` (garde de test) ; coût : une republication des
  lignes de ces tables, une fois par appareil.
- Tests : `tests/unit/sync/versions/olderWriter.test.ts` (deux SQLite migrées en 18 et 19), `src/features/sync/olderDeviceBanner.test.tsx`,
  `src/db/migrations/schemaRepublish.test.ts` ; non-régression `twoVersions`, `reintegrate`, suites de synchro existantes.

## Passe architect (2026-11-15)

Verdict : **approuvé**, aucun point bloquant. Relu : ce fichier, D-290, `docs/SYNC-01.md`, `git diff origin/main...HEAD` (24 fichiers).

- **Couches (ADR 0001).** `src/domain/sync/schemaRepublish.ts` est pur (aucun import) ; `src/domain/syncBanners.ts` n'ajoute qu'un code.
  `src/sync/olderWriter.ts` n'importe que `src/domain` et le type `SyncDeps` ; accès base par `repos.sync` (`exportRows`, `addOutbox`,
  `setMeta`, `parked`, `getStates`). `src/features/sync/startSync.ts` charge le texte par `import()` depuis `src/i18n`. Sens respecté.
- **Format.** Journaux, instantanés, état publié et `sm` inchangés : `sv` n'est écrit que dans le JSON local de `sync_parked.op` ; la
  republication passe par l'entrée `'+'` existante (`publisher.ts` : ligne entière, une opération à un rang réservé, chaque champ avec sa
  propre horloge, champs d'autres appareils compris, comme le report d'époque §9.1 c). `older-device` est un avertissement local.
- **Tables techniques.** Aucune publiée : `SCHEMA_REPUBLISH` ne cite que des tables du catalogue (test), `republishAfterUpgrade` passe par
  `deps.catalogue.table`, la marque est une clé de `sync_meta` (locale).
- **Idempotence et atomicité.** File et marque `schemaRepublished` dans une seule transaction : un arrêt avant la validation rejoue tout,
  après ne rejoue rien ; `sync_outbox` porte `UNIQUE (table_name, row_id, field)` ; un champ republié de même hlc ne change rien. Une base
  qui perdrait la marque (restauration) republie une fois de plus, sans effet.
- **Cohérence avec l'ADR 0011.** Nouvelle cause d'entrée `'+'` (§3.2) décidée par l'écrivain après sa migration ; §3.1 et §7.2 (création
  complète seulement) intacts, l'option B qui les aurait changés est écartée. Avenant 37 ajouté à l'ADR 0011 avec renvoi ici.
- **Garde des migrations futures.** `schemaRepublish.test.ts` rejoue les migrations une à une et compare, pour chaque table déjà capturée
  (`sync_<table>_ai`), les colonnes publiées du catalogue apparues, à `SCHEMA_REPUBLISH` ∪ `SCHEMA_REPUBLISH_EXEMPT` (égalité stricte :
  une ligne superflue échoue aussi). Couvre l'ajout de colonne comme la reconstruction de table ; une colonne absente du catalogue n'est pas
  publiée, donc hors sujet. Suffisante.
- **Constante `'+'` recopiée dans `olderWriter.ts`.** Acceptable : elle évite d'attacher le bloc à la demande au publieur ; l'égalité avec
  `ROW_REPUBLISH_FIELD` est testée (`olderWriter.test.ts`, « entrée ligne entière identique à celle du publieur ») et la valeur est figée
  par le format (§3.2). Garde suffisante.
- **Bundle de départ.** `olderWriter` et `schemaRepublish` derrière un seul site `import()` dans `engine.ts` ; texte `fr.syncOlderDevice.ts`
  chargé au premier `older-device` ; `tests/bundle/start-modules.json` inchangé ; départ -296 octets (D-290 point 6).

Points mineurs (non bloquants, à suivre) :

1. `republishAfterUpgrade` tient une transaction sur toutes les lignes des tables listées : sans coût pour `mesocycle` et
   `nutrition_target`, mais une entrée future sur une table volumineuse devra paginer en transactions courtes (marque posée dans la
   dernière) et réservera autant de rangs `'+'` à la publication (ADR 0011 §3.2, « publication sans transaction tenue ») ; à revoir dans le
   ticket qui l'ajoute. C'est aussi la raison de l'exemption C.
2. Contrairement à `queueOwnRowsForRepublish` (`epochSwitch.ts`), toutes les lignes partent, celles des autres appareils et d'une amorce
   comprises : sans effet (même hlc), choix volontaire pour couvrir les lignes reçues avant la mise à jour ; aucune amorce dans ces deux
   tables aujourd'hui.
3. Pas de test d'arrêt brutal propre à la republication : l'atomicité tient à la transaction unique (le point 1 l'imposera si elle est
   découpée).
4. Les commentaires de `src/domain/sync/schemaRepublish.ts` et `src/sync/olderWriter.ts` disent encore « ADR 0018 proposé » : à corriger
   par l'agent du module (hors périmètre architect).
