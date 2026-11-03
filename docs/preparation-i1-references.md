# Préparation I1 — références d’exercices

Document de préparation P-09. Il relie les identifiants de la bibliothèque
embarquée et des exercices personnalisés aux colonnes SQL qui les référencent,
sans créer de ligne SQL fictive pour un exercice embarqué.

Références : [§ 9.1 — Tables publiées](./prd/09-synchronisation-pc-iphone.md),
[§ 14 — Bibliothèque et profils de matériel](./prd/14-bibliotheque-d-exercices-et-profils-de-materiel.md),
[§ 20.2 — Tables](./prd/20-modele-de-donnees-sqlite.md),
[préparation des exercices](./preparation-i1-exercices.md) et
[catalogues I1](./preparation-i1-catalogues.md). La publication des séances
closes relève aussi de D-27.

## Points d’intégration vérifiés après #20

Sur la base fusionnée, la production utilise `SYNC_CATALOGUE` de
[`src/domain/sync/syncTables.ts`](../src/domain/sync/syncTables.ts), injecté
avec ses repositories par
[`src/db/repositories/storage.ts`](../src/db/repositories/storage.ts) dans
`SYNC_STORAGE`. Le moteur reçoit ce catalogue dans
[`src/sync/service.ts`](../src/sync/service.ts) ; la publication du journal et
les instantanés le reçoivent respectivement dans
[`src/sync/publisher.ts`](../src/sync/publisher.ts) et
[`src/sync/snapshot.ts`](../src/sync/snapshot.ts). Le catalogue de production
ne contient actuellement que `profile` et `body_weight`.

La migration publiée est
[`src/db/migrations/0001_spartiate_init.ts`](../src/db/migrations/0001_spartiate_init.ts),
enregistrée dans [`src/db/migrations/index.ts`](../src/db/migrations/index.ts).
Elle fige `CAPTURE_TABLES_V1` et un helper local `captureTriggers` pour les
tables I0 ; ne pas modifier cette migration. I1 ajoute ses DDL et déclencheurs
dans la migration suivante planifiée
`src/db/migrations/0002_training.ts`, à enregistrer dans `index.ts`. La
production doit alors étendre `SYNC_CATALOGUE` aux tables I1 publiables
(`exercise` personnalisé, `equipment_profile`, `routine`, `routine_day`,
`routine_exercise`, `workout`, `workout_set`), et `naturalIds.ts` uniquement
aux identités naturelles dont la forme est décidée. Aucun de ces changements
I1 n’est déjà présent sur #20.

D-27 exige une seule règle de publication pour les séances closes, dans les
journaux et les instantanés : les triggers SQL capturent les mutations, puis
les parcours pilotés par le catalogue ne publient le `workout` et ses
`workout_set` qu’après clôture et ensemble complet. Le catalogue hérité ne
fournissait ni filtre de ligne ni publication atomique d’agrégat ; cette
adaptation reste à réaliser et à tester en I1-03.

## Correspondance des identifiants

| Origine de l’exercice | Identité connue | Ligne dans `exercise` | Références SQL |
|---|---|---|---|
| Bibliothèque embarquée | `id` stable du JSON, en kebab-case | Aucune : le contenu est lu depuis le catalogue embarqué et n’est pas publié | Conserver exactement cet `id` dans `routine_exercise.exercise_id`, `workout_set.exercise_id` et, à partir d’I2, les références de progression |
| Exercice personnalisé | `id` de la ligne personnalisée | Ligne locale dans `exercise`, avec `is_custom = 1` ; la ligne personnalisée est publiée | Conserver exactement le même `id` dans les références SQL |
| Référence non résolue | Identifiant reçu ou conservé, sans entrée présente dans le JSON courant ni ligne personnalisée active | Aucune ligne à fabriquer | Conserver la valeur opaque et laisser la référence non résolue |

L’identifiant métier d’un exercice est distinct de `strength_standard_key` :
ce dernier désigne un standard de force, pas une ligne d’exercice. `schemaVersion`
est présent dans l’objet JSON d’exercice (§ 14.1) ; le PRD ne définit pas ici un
numéro de version globale du catalogue ni une règle de conversion entre
versions.

Le PRD établit l’identité naturelle de la ligne personnalisée par son `id` et
les identifiants stables de la bibliothèque par le `id` du JSON. Il ne précise
pas si l’espace des identifiants personnalisés est celui des UUID, ni comment
un conflit d’identifiant entre catalogue et ligne personnalisée est arbitré :
**à décider par Ali**. Un UUID inconnu ne prouve donc pas à lui seul qu’une
ligne personnalisée existe.

## Suppression et historique

La suppression d’un exercice personnalisé suit la suppression logique et le
tombstone définis par les règles de synchronisation (§ 9.2). Elle ne supprime
ni ne réécrit les séances et séries qui le référencent. Une séance close et ses
séries restent publiables ensemble selon § 9.1 et D-27 ; les références
historiques gardent leur identifiant original.

Une référence n’est résolue que si son `id` est présent dans le catalogue
embarqué courant ou dans une ligne personnalisée active. Si l’exercice a été
supprimé ou n’existe plus dans une version ultérieure du catalogue, ne pas
réattribuer silencieusement l’identifiant à un autre exercice. Le PRD ne fixe
ni la conservation d’un instantané descriptif, ni les modalités d’affichage
d’une référence historique sans définition courante : **à décider par Ali**.

## Réception par synchronisation

Une référence entrante peut précéder la ligne personnalisée correspondante,
viser un exercice supprimé ou être inconnue de la bibliothèque de cette
version. L’import conserve l’identifiant reçu sans créer un exercice
personnalisé, sans le remplacer par un autre identifiant et sans supprimer la
ligne métier reçue. Cette tolérance est nécessaire puisque les exercices
embarqués n’ont pas de ligne SQL et que les références personnalisées peuvent
arriver séparément.

La présence des clés étrangères SQLite (§ 20.3) ne justifie donc pas une clé
étrangère d’exercice vers une ligne `exercise` qui peut être absente. La
référence doit rester valide même lorsque sa cible n’est pas matérialisée ;
aucune suppression en cascade ne doit effacer l’historique.

## Vecteurs de vérification à préparer pour I1

| Cas | Données synthétiques | Résultat attendu |
|---|---|---|
| Exercice embarqué | Une série référence `bench-press-barbell`, présent dans le JSON mais absent de `exercise` | La série est enregistrée et lue avec le même identifiant ; aucune ligne personnalisée n’est créée et aucune FK vers une ligne absente n’échoue |
| Exercice personnalisé | Un exercice `is_custom = 1` et une série utilisent le même identifiant | La référence se résout sur la ligne personnalisée ; sa publication conserve l’identifiant |
| Suppression | Une série historique référence un exercice personnalisé ensuite supprimé logiquement | Le tombstone est synchronisé ; la série et son identifiant restent présents |
| Ancienne bibliothèque | Une séance référence un exercice absent du catalogue courant | La référence historique n’est ni effacée ni remappée ; les données métier de la séance restent lisibles |
| Référence inconnue reçue | Une ligne synchronisée référence un identifiant absent du catalogue et de `exercise` | L’import conserve la ligne et l’identifiant sans fabriquer de cible ; la référence reste non résolue |
| Cible reçue plus tard | Une référence inconnue est suivie de la réception d’une ligne personnalisée de même identifiant | La référence peut être résolue sans réécriture de la séance |

Les vecteurs sont des contrats de test à implémenter, pas des preuves déjà
acquises. Restent **à décider par Ali** : la représentation physique des
références (ligne locale non publiée ou références logiques validées contre
l’union JSON/personnalisé), la forme des identifiants personnalisés et la
préservation des libellés historiques. Le choix ne peut introduire de clé
étrangère vers une ligne absente.
