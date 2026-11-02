# SPA-001b — Préparation technique de la base neuve

Base de lecture : a2a8e80655510191bf303f8f7b16c0cae3725a19, branche prep-base-neuve depuis origin/main. Préparation seulement : aucun code modifié, aucune migration exécutée, aucun travail I1. Le DDL technique est recopié du code ; le DDL métier et ses représentations restent proposés, à vérifier et valider par data-model, sync-icloud et Ali avant implémentation.

Références : D-23, D-24, D-31, D-54, D-55, D-57 ; PRD § 20.0–20.4 ; section « Base neuve et capture » de docs/spa-001b-inventaire-brouillon.md. L’inventaire final docs/spa-001b-inventaire.md est absent de cette base : à vérifier après livraison de 001b, sans accéder à son worktree.

## 1. DDL technique exact et provenance

Chaque bloc ci-dessous reprend une chaîne SQL du code. Les contraintes inline ont la source de leur table ; les liens sont figés sur le commit de lecture.

Source : [src/db/migrations/0015_sync_tables.ts:140](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0015_sync_tables.ts#L140).

```sql
CREATE TABLE sync_guard (id INTEGER PRIMARY KEY)
```

Source : [src/db/migrations/0015_sync_tables.ts:141](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0015_sync_tables.ts#L141).

```sql
CREATE TABLE sync_field_clock (
      table_name TEXT NOT NULL,
      row_id     TEXT NOT NULL,
      field      TEXT NOT NULL,
      hlc        TEXT NOT NULL,
      base_hlc   TEXT,
      PRIMARY KEY (table_name, row_id, field)
    )
```

Source : [src/db/migrations/0015_sync_tables.ts:149](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0015_sync_tables.ts#L149).

```sql
CREATE INDEX idx_sync_field_clock_hlc ON sync_field_clock(hlc)
```

Source : [src/db/migrations/0015_sync_tables.ts:150](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0015_sync_tables.ts#L150).

```sql
CREATE TABLE sync_outbox (
      seq        INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      row_id     TEXT NOT NULL,
      field      TEXT NOT NULL,
      UNIQUE (table_name, row_id, field)
    )
```

Source : [src/db/migrations/0015_sync_tables.ts:157](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0015_sync_tables.ts#L157).

```sql
CREATE TABLE sync_state (
      device_id      TEXT PRIMARY KEY,
      is_self        INTEGER NOT NULL DEFAULT 0 CHECK (is_self IN (0, 1)),
      platform       TEXT,
      app_version    TEXT,
      epoch          TEXT,
      cursor_segment INTEGER NOT NULL DEFAULT 0,
      cursor_record  INTEGER NOT NULL DEFAULT 0,
      ack_hlc        TEXT,
      head_segment   INTEGER NOT NULL DEFAULT 0,
      head_record    INTEGER NOT NULL DEFAULT 0,
      head_hlc       TEXT,
      state_epoch    TEXT,
      state_seq      INTEGER NOT NULL DEFAULT 0,
      state_digest   TEXT,
      last_acks      TEXT NOT NULL DEFAULT '{}',
      last_seen_hlc  TEXT,
      last_sync_at   TEXT,
      schema_version INTEGER,
      format_major   INTEGER,
      kid            TEXT,
      purge_horizon  TEXT,
      snapshot_seq   INTEGER,
      snapshot_hlc   TEXT,
      status         TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'newer-major', 'clock-ahead', 'corrupt', 'foreign', 'rollback', 'forgotten'))
    )
```

Source : [src/db/migrations/0015_sync_tables.ts:184](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0015_sync_tables.ts#L184).

```sql
CREATE TABLE sync_tombstone (
      table_name  TEXT NOT NULL,
      row_id      TEXT NOT NULL,
      deleted_hlc TEXT NOT NULL,
      purged_at   TEXT NOT NULL,
      PRIMARY KEY (table_name, row_id)
    )
```

Source : [src/db/migrations/0015_sync_tables.ts:191](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0015_sync_tables.ts#L191).

```sql
CREATE INDEX idx_sync_tombstone_hlc ON sync_tombstone(deleted_hlc)
```

Source : [src/db/migrations/0015_sync_tables.ts:192](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0015_sync_tables.ts#L192).

```sql
CREATE TABLE sync_unknown (
      table_name TEXT NOT NULL,
      row_id     TEXT NOT NULL,
      field      TEXT NOT NULL,
      value      TEXT,
      hlc        TEXT NOT NULL,
      base_hlc   TEXT,
      sv         INTEGER NOT NULL,
      PRIMARY KEY (table_name, row_id, field)
    )
```

Source : [src/db/migrations/0015_sync_tables.ts:202](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0015_sync_tables.ts#L202).

```sql
CREATE TABLE sync_parked (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      reason     TEXT NOT NULL CHECK (reason IN ('missing-parent', 'missing-row', 'epoch-carry')),
      table_name TEXT NOT NULL,
      row_id     TEXT NOT NULL,
      hlc        TEXT NOT NULL,
      op         TEXT NOT NULL,
      parked_at  TEXT NOT NULL
    )
```

Source : [src/db/migrations/0015_sync_tables.ts:211](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0015_sync_tables.ts#L211).

```sql
CREATE INDEX idx_sync_parked_reason ON sync_parked(reason, id)
```

Source : [src/db/migrations/0015_sync_tables.ts:212](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0015_sync_tables.ts#L212).

```sql
CREATE INDEX idx_sync_parked_row ON sync_parked(reason, table_name, row_id)
```

Source : [src/db/migrations/0015_sync_tables.ts:213](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0015_sync_tables.ts#L213).

```sql
CREATE TABLE conflict_log (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name       TEXT NOT NULL,
      row_id           TEXT NOT NULL,
      field            TEXT NOT NULL,
      kept_value       TEXT,
      discarded_value  TEXT,
      kept_device      TEXT,
      discarded_device TEXT,
      kept_hlc         TEXT,
      discarded_hlc    TEXT,
      detected_at      TEXT NOT NULL,
      resolved_at      TEXT,
      restored         INTEGER NOT NULL DEFAULT 0 CHECK (restored IN (0, 1))
    )
```

Source : [src/db/migrations/0015_sync_tables.ts:228](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0015_sync_tables.ts#L228).

```sql
CREATE INDEX idx_conflict_log_detected_at ON conflict_log(detected_at)
```

Source : [src/db/migrations/0015_sync_tables.ts:229](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0015_sync_tables.ts#L229).

```sql
CREATE INDEX idx_conflict_log_row ON conflict_log(table_name, row_id, field)
```

Source : [src/db/migrations/0015_sync_tables.ts:230](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0015_sync_tables.ts#L230).

```sql
CREATE TABLE sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)
```

Source : [src/db/migrations/0019_epoch_carry_report.ts:18](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0019_epoch_carry_report.ts#L18).

```sql
CREATE TABLE epoch_carry_report (id INTEGER PRIMARY KEY, epoch TEXT NOT NULL, cause TEXT NOT NULL CHECK (cause IN ('restore', 'concurrent', 'reset')), reporter TEXT NOT NULL, opener TEXT NOT NULL, mode TEXT NOT NULL CHECK (mode IN ('replace', 'merge')), authors TEXT NOT NULL, restored TEXT NOT NULL, recreated TEXT NOT NULL, parent_replaced TEXT NOT NULL, overflow INTEGER NOT NULL, overflow_by TEXT NOT NULL, banner INTEGER NOT NULL CHECK (banner IN (0, 1)), created_at TEXT NOT NULL, acknowledged_at TEXT)
```

Source : [src/db/migrations/0001_core_tables.ts:270](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0001_core_tables.ts#L270).

```sql
CREATE TABLE settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      device_id  TEXT NOT NULL,
      hlc        TEXT NOT NULL
    )
```

Source : [src/db/migrations/0001_core_tables.ts:277](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0001_core_tables.ts#L277).

```sql
CREATE INDEX idx_settings_hlc ON settings(hlc)
```

### Historique créé par le migrateur, pas par 0001

Source : [src/db/migrator.ts:87](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrator.ts#L87), constante SQL lignes 89–95, exécution ligne 126. Seule substitution ci-dessous : MIGRATIONS_TABLE = schema_migrations. Ne pas doubler cette création dans les statements de 0001.

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL,
  checksum   TEXT    NOT NULL,
  applied_at TEXT    NOT NULL
)
```

0015 apporte neuf tables et six index explicites ; 0019 ajoute epoch_carry_report, sans index explicite ni AUTOINCREMENT. Avec settings et schema_migrations : douze tables techniques D-24. Les PRIMARY KEY et UNIQUE ont leurs index SQLite implicites : ne pas les recréer. sqlite_sequence est interne aux trois tables AUTOINCREMENT. Aucun FK, STRICT ou WITHOUT ROWID dans ces blocs ; ne pas ajouter artificiellement NOT NULL aux TEXT PRIMARY KEY, ni CHECK sur les textes JSON ou sur overflow.

Source [0016_sync_natural_ids.ts:12](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0016_sync_natural_ids.ts#L12) : uniquement du DML sous sync_guard, réécriture des identifiants routine_log/holiday et row_id associés, puis retrait de la garde. **Aucun DDL à ajouter**. Ne pas reprendre ces UPDATE métier dans la base neuve. 0017/0018 concernent calendrier/rappels et ne modifient pas ce DDL technique. settings garde sa structure et son index ; aucun déclencheur de publication settings en I0 (D-55).

## 2. DDL proposé pour les deux tables métier I0

Ce SQL n’existe pas encore dans la base lue. Les noms du § 20.2 et colonnes communes du § 20.1 sont repris. D-55 remplace ici l’UUID v7 générique par des identités naturelles. **À vérifier / valider** : chaînes canoniques proposées `profile|singleton` et `weight|AAAA-MM-JJ|source`, nom `timezone`, nullabilité du profil incomplet, validations des valeurs et ajout `measured_at` décrit ci-dessous. Aucun choix d’enum sex/goal/experience/units n’est inventé : TEXT nullable en attendant le contrat de saisie I0. Une valeur absente reste NULL, pas zéro. Aucun FK profile → body_weight : poids identifié indépendamment, pas de colonne profile_id dans le PRD.

```sql
CREATE TABLE profile (
  id TEXT PRIMARY KEY NOT NULL CHECK (id = 'profile|singleton'),
  sex TEXT,
  birth_year INTEGER,
  height_cm REAL,
  goal TEXT,
  experience TEXT,
  units TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL,
  hlc TEXT NOT NULL
);
CREATE TABLE body_weight (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  kg REAL NOT NULL CHECK (kg > 0),
  source TEXT NOT NULL CHECK (source IN ('manual', 'health')),
  timezone TEXT NOT NULL,
  health_uuid TEXT,
  measured_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL,
  hlc TEXT NOT NULL,
  UNIQUE (date, source),
  CHECK (id = 'weight|' || date || '|' || source)
);
CREATE INDEX idx_body_weight_date ON body_weight(date);
```

Le singleton inclut une éventuelle ligne supprimée logiquement ; la recréation restaure cette même identité. UNIQUE(date, source) n’est pas partiel : une ligne supprimée garde son identité jusqu’à purge, puis peut être recréée sous le même id. L’index explicite date suit § 20.3, même si le préfixe de l’index UNIQUE peut déjà servir la recherche ; sa nécessité de performance est **à vérifier**, pas un gain revendiqué.

La date est locale et validée par isLocalDate, le fuseau est stocké au moment de la pesée (proposition : identifiant IANA, validateur **à vérifier**). SQL ne valide pas ici la réalité du jour ni les timestamps, la finitude des nombres ou les enums profil ; ils doivent être contrôlés au domaine/repository **et à la réception**. Les CHECK proposés ajoutent une défense SQL, pas la validation complète. Les colonnes d’identité date/source/id restent immuables ; corriger la date signifie supprimer logiquement l’ancienne identité et écrire la nouvelle, dans une transaction.

`health_uuid` est conservé pour la provenance health, sans UNIQUE global ajouté. **À vérifier** : nullabilité lors de données incomplètes et cohérence source/UUID. D-55 demande l’échantillon health le plus récent du jour ; updated_at/hlc est l’instant d’écriture locale, pas celui de l’échantillon. Proposition `measured_at` (instant UTC, nullable pour manual), absent du § 20.2 et du code actuel, à valider avant gel. Sans cet instant ou une information équivalente, la règle « plus récent » n’est pas démontrable. Le départage de deux échantillons au même instant et la conservation cohérente du triplet kg/health_uuid/measured_at sous fusion HLC par champ sont **à vérifier avec sync-icloud** ; ne pas déclarer le seul DDL conforme à cette règle. Aucun plugin Santé ni table de cache I5 à écrire en 001b.

## 3. Capture à générer dans la nouvelle migration

Source : [0015_sync_tables.ts:86](https://github.com/doncivo/spartiate/blob/a2a8e80655510191bf303f8f7b16c0cae3725a19/src/db/migrations/0015_sync_tables.ts#L86), UNGUARDED et captureTriggers jusqu’à la ligne 133. Copier la logique dans 0001 sous forme figée, sans importer le catalogue vivant : la somme de contrôle dépend du SQL produit (migrator.ts:98). Ne modifier ni 0015 publiée ni les fichiers existants dans cette préparation.

Proposition de générateur pour **quatre triggers exactement** : sync_profile_ai, sync_profile_au, sync_body_weight_ai, sync_body_weight_au. Liste figée proposée (measured_at à confirmer avec le § 2) :

```ts
const CAPTURE_TABLES_V1 = [
  ['profile', ['sex', 'birth_year', 'height_cm', 'goal', 'experience', 'units', 'created_at', 'deleted_at']],
  ['body_weight', ['date', 'kg', 'source', 'timezone', 'health_uuid', 'measured_at', 'created_at', 'deleted_at']],
] as const;

function captureTriggers(table: string, columns: readonly string[]): string[] {
  const row = `table_name = '${table}' AND row_id = NEW.id`;
  const clock = (field: string) =>
    `(SELECT hlc FROM sync_field_clock WHERE ${row} AND field = '${field}')`;
  const changes = columns.flatMap((column) => [
    `INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT '${table}', NEW.id, '${column}', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE ${row} AND field IN ('${column}', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE ${row} AND field = '${column}')
           ELSE COALESCE(${clock(column)}, ${clock('*')}, OLD.hlc) END
       WHERE OLD.${column} IS NOT NEW.${column}
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;`,
    `DELETE FROM sync_outbox WHERE ${row} AND field = '${column}' AND OLD.${column} IS NOT NEW.${column};`,
    `INSERT INTO sync_outbox (table_name, row_id, field) SELECT '${table}', NEW.id, '${column}' WHERE OLD.${column} IS NOT NEW.${column};`,
  ]);
  return [
    `CREATE TRIGGER sync_${table}_ai AFTER INSERT ON ${table}
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       DELETE FROM sync_tombstone WHERE ${row};
       DELETE FROM sync_outbox WHERE ${row} AND field = '*';
       INSERT INTO sync_outbox (table_name, row_id, field) VALUES ('${table}', NEW.id, '*');
     END`,
    `CREATE TRIGGER sync_${table}_au AFTER UPDATE ON ${table}
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT '${table}', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE ${row} AND field = '*');
       ${changes.join('\n')}
       DELETE FROM sync_outbox WHERE ${row} AND field = '+' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
       INSERT INTO sync_outbox (table_name, row_id, field) SELECT '${table}', NEW.id, '+' WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;
     END`,
  ];
}
// Après le DDL des tables, dans statements :
// ...CAPTURE_TABLES_V1.flatMap(([table, columns]) => captureTriggers(table, columns))
```

Le SQL est généré uniquement depuis des noms constants internes. Suppressions du générateur hérité : filtre SHARED_SETTING_KEYS et republication des reminders d’une cible restaurée ; aucune de ces branches ne concerne les deux tables I0. Les colonnes techniques updated_at/device_id/hlc ne sont pas des champs publiés. L’insertion produit `'*'`, sans écrire immédiatement d’horloge de champ ; l’UPDATE crée le repli `'*'` à OLD.hlc s’il manque puis horloge chaque champ réellement changé (comparaison NULL-safe IS NOT). La suppression/réinsertion outbox donne un nouveau seq : ne pas la remplacer par un UPDATE ou INSERT OR IGNORE. Préserver base_hlc pendant les modifications encore en file et l’entrée `'+'` de restauration.

Pas de trigger DELETE : suppression métier = UPDATE deleted_at ; purge physique et sync_tombstone restent gérés par le moteur après rétention. Tout repository doit utiliser le WriteStamper et une transaction, avec HLC neuf ; l’UPDATE d’id n’est pas capturé comme un déplacement de ligne et doit être interdit. Application distante, migrations et purge posent/retirent sync_guard dans la même transaction.

**D-57 — ne pas confondre capture automatique et import.** Sous sync_guard, les triggers ne font rien. L’import SPA-005 doit donc écrire, dans la même transaction, les nouvelles horloges et les entrées outbox `'*'` de chaque ligne métier importée/modifiée ; remplacer supprime logiquement les lignes absentes avec horloge et outbox deleted_at. Aucun sync_tombstone, nouvel epoch ou restore-marker à l’import. Retrait de la garde avant commit ; settings importées restent locales. Vérifier la recréation d’une identité déjà purgée par ce chemin gardé : le nettoyage de trace fait par le trigger d’insertion ne s’exécute pas automatiquement. Reprendre le contrat du moteur, jamais l’effacer implicitement sans test.

## 4. Catalogue I0 et identités : modifications attendues

| Source actuelle | Modification proposée / invariant |
| --- | --- |
| src/domain/sync/naturalIds.ts:17–49 | NaturalIdTable = profile ou body_weight ; fonctions proposées profileId() et bodyWeightId(date, source), mêmes chaînes que les CHECK SQL. isNaturalId valide singleton exact ou date réelle + manual/health ; expectedNaturalId valide les types/valeurs et renvoie null si incomplet. Retirer routine_log/holiday et leurs regex uniquement avec les consommateurs métier. |
| src/domain/sync/syncTables.ts:52–86 | Conserver TECHNICAL_COLUMNS et helpers ; deux tables avec key id, idKind natural, local vide, parents vide. purgeable true proposé pour conserver suppression/purge/recréation, à vérifier avec la politique de suppression du singleton. |
| src/domain/sync/syncTables.ts:89 et suivantes | Remplacer le catalogue par les colonnes figées du § 3, même ordre. profile : text nullable pour les champs textuels, int nullable pour birth_year, real nullable pour height_cm ; poids : date non nulle, real kg, enum source, text timezone, text nullable health_uuid, datetime nullable measured_at. created_at datetime non nul (conflit masqué), deleted_at datetime nullable ; contraintes métier à aligner après arbitrage. |
| src/domain/sync/syncTables.ts, isValidRowId / isValidValue | La branche natural accepte actuellement aussi isId(id) : retirer ce repli UUID pour les deux tables I0 afin d’empêcher les doublons. Adapter les anciennes références naturelles dans le cas type id ; ne pas changer MAX_SYNC_ID_LENGTH = 128 (limits.ts:47). La validation d’un champ seul ne vérifie pas l’id contre date/source : vérifier la ligne reconstruite avant SQL, en conservant les protections des opérations partielles. |
| src/domain/sync/syncTables.ts, réglages et espaces fixes | Retirer settings du catalogue, SHARED_SETTING_KEYS, settingKeyScope et les branches de consommateurs devenues invalides ; supprimer FIXED_SPACE_IDS et la règle de purge space. Conserver le stockage settings local. |
| src/domain/sync/format.ts:665 | SYNC_TABLE_ORDER = ['profile', 'body_weight'] as const ; catalogue, ordre de snapshot et rang doivent coïncider. Aucun changement de SYNC_FORMAT_MAJOR ni des constantes Spartiate ADR 0017 (.spx/.spj/.sps). |

Constat de lecture : expectedNaturalId n’est référencé actuellement que par son test de catalogue, pas par les chemins de production. **À vérifier / implémenter** : point réel de contrôle de cohérence id/date/source dans application, réintégration d’inconnus, import et snapshot, avec fusion partielle préalable ; le simple ajout de cette fonction ne constitue pas une garde. Les chemins de restauration de src/sync/apply.ts:319 et snapshot.ts:273 utilisent isNaturalId pour la recréation contre une trace de purge : conserver leurs invariants.

Copie de capture, catalogue et schéma doivent avoir une égalité testée des colonnes publiées ; aucune table technique ni settings ne doit apparaître dans journaux **ou** instantanés. Les adaptations apply/purge/snapshot/epochSwitch et repositories de l’inventaire restent nécessaires : ce document ne les déclare pas effectuées.

## 5. Assemblage de 0001, limites et réception

Créer src/db/migrations/0001_spartiate_init.ts (**à créer — SPA-001b, data-model**, déjà au registre a-creer), version 1, name spartiate_init. Ordre proposé : settings, neuf tables 0015 et index, epoch_carry_report, profile/body_weight et index, quatre triggers ; aucun seed CircleTasks. schema_migrations est créée auparavant par migrate. Remplacer le registre par cette seule migration et APP_SCHEMA_VERSION 19 → 1 (src-tauri/src/backup.rs:45) dans le même lot compilable ; ne pas changer URL/garde spartiate.db. Ne pas importer les anciennes migrations métier pour réutiliser leur DDL.

D-54 : une base 19 doit être refusée sans altération par le nouveau registre ; pas de migration 19 → 1, de réparation, ni purge de données CircleTasks. Avant premier lancement 001b, Ali seul supprime, après vérification de la cible exacte sans joker, le conteneur laboratoire prévu par D-54 ; si usage réel commencé, procédure annulée. Ici aucune lecture ou suppression de conteneur : fixtures Wasm en mémoire ou répertoires synthétiques isolés seulement. Gardes du migrateur, checksums et sauvegarde avant migration inchangés. H-18 reste **à vérifier** sur SQLite natif : l’exécution des seuls tests du plugin n’est pas une preuve de parité complète.

### Tests à écrire : commit rouge avant code, puis commit vert

| Lot | Cas et preuve exigée |
| --- | --- |
| Schéma | Base vide → une migration version 1, douze tables techniques + deux métier, aucun métier ancien ; PRAGMA table_info/index_list/index_info/foreign_key_list, sqlite_master, valeurs par défaut, UNIQUE/PK/CHECK et nullabilités exactes ; index automatiques distingués des index explicites ; integrity_check. Relance sans effet. |
| Gardes | Base synthétique 19 refusée, checksum divergent refusé, version future refusée ; contenu identique avant/après refus. Sauvegarde avant migration et rollback si un statement échoue ; aucun accès conteneur. |
| Identités | Deux bases créent indépendamment le même singleton et la même pesée ; deux ordres, messages répétés, pas de doublon/UNIQUE. UUID arbitraire, id discordant, date invalide et source inconnue rejetés. Deux sources distinctes ; fuseau stocké, date immuable. |
| Profil et poids | NULL profil incomplet distinct de zéro ; manual même jour remplacé par HLC ; health échantillon le plus récent, métadonnées cohérentes et égalité d’instant arbitrée ; suppression puis recréation, ancienne opération sans résurrection. Les cas health non tranchés du § 2 bloquent la validation de ce contrat, pas de faux test vert. |
| Capture | INSERT → une entrée '*', suppression de sa trace locale ; UPDATE inchangé → aucune entrée ; changement NULL ↔ valeur ; repli horloge '*', base_hlc stable tant que file non vidée ; seq neuf si nouvelle écriture pendant publication ; restauration → '+' ; suppression logique → deleted_at ; aucun trigger DELETE. |
| Garde et atomicité | INSERT/UPDATE sous garde ne capturent rien ; rollback ne laisse ni garde, ni horloge, ni outbox partielle ; importer sous garde exige l’écriture explicite D-57, crash avant/après commit, remplacement/suppressions distantes et reprise. Recréation d’identité purgée incluse. |
| Catalogue et moteur | Égalité DDL/copie figée/catalogue, ordre exact deux tables, settings et technique absents des journaux/snapshots ; vecteurs crypto inchangés ; deux bases : conflit HLC, instantané, reset, oubli, reprise et inconnus. Réception rejette id incompatible après reconstruction d’une opération partielle. |
| D-57 | Export → reset de fixture → import → export : hash canonique stable (ordre stable, sans hlc/device_id/updated_at), liste blanche settings ; import répété idempotent métier, archive corrompue/version future/references invalides sans mutation, cycle sur autre appareil reçoit valeurs et suppressions. Exécution complète SPA-005, primitives conservées en 001b. |
| H-18 natif/Wasm | Même DDL et mêmes opérations sur deux moteurs : contraintes, triggers, transactions, foreign_keys, restauration/version ; relevés séparés. Sources natives de nouveaux tests **à vérifier** à l’exécution sous src-tauri/tests/desktop et plugin vendored ; ne pas attribuer cette preuve au seul cargo test vert. |

Tests à ajouter aux suites existantes : nouveau test colocalisé de 0001 (**à créer — SPA-001b, data-model/qa-test**), src/db/migrator.test.ts, src/domain/sync/catalogue.test.ts et tests de synchro existants. Le commentaire de 0015 cite syncCatalogue.test.ts, mais aucun fichier de ce nom n’est présent : **à vérifier**, créer la preuve d’égalité capture/catalogue dans le test de 0001 plutôt que supposer cette suite existante. Noms exacts des nouveaux tests natifs à arrêter dans l’inventaire validé. Aucun test supprimé simplement parce qu’il utilise une fixture métier : réécrire la fixture et préserver la preuve d’infrastructure.

Commandes depuis la racine, au lot d’implémentation (D-31) :

```powershell
npx vitest run --coverage.enabled=false src/db/migrator.test.ts src/db/migrations
npx vitest run --coverage.enabled=false src/domain/sync/catalogue.test.ts tests/unit/sync
npm run typecheck
npm run lint
npm run test:bundle
```

Depuis src-tauri, commandes D-28 ; D-60 autorise ici les tests Rust locaux si la modification synchro/garde/coffre le justifie, en incrémental avec -j 2 :

```powershell
cargo test --locked --features test-hooks --test desktop -j 2
cargo test --locked -p tauri-plugin-sql --features sqlite -j 2
```

CI : mêmes suites Rust, cargo clippy --locked -- -D warnings, cargo fmt --check ; suite Vitest complète avec couverture domaine ≥ 80 %, e2e et smoke uniquement en CI. Ces commandes sont des réceptions futures, pas des résultats acquis. Pour cette préparation documentaire : contrôle de transcription du SQL et des chemins, diff limité au document, bundle avant push ≤ 358 400 octets gzip ; aucune exécution de migration native ni de recette appareil.

### Relais et points restant à vérifier

| Auteur | Relecteur obligatoire | Livrable | Réception | Dépendance |
| --- | --- | --- | --- | --- |
| data-model | sync-icloud + architect | DDL 0001 et copie figée de capture | Schéma/contraintes/capture/rollback Wasm | Validation des identités et champs proposés |
| sync-icloud | data-model + qa-test | Catalogue, réception et recréation | Deux bases et invariants, preuve négative settings | DDL figé, choix health cohérent |
| desktop-tauri | data-model + qa-test | Version native et garde | Refus 19, sauvegarde/restauration, parité H-18 | Registre version 1 |
| qa-test | code-reviewer | Commits rouge/vert et résultats par moteur | Diff et CI verte, limites explicites | Lots précédents ; validation finale d’Ali |

À vérifier avant code : représentation des identités, contrats de saisie/nullabilité/enum profil, fuseau et measured_at, départage et cohérence health sous HLC, garde id/valeurs dans tous les chemins, comportement d’import après purge, politiques de purge singleton, chemins après la session 001b et preuve H-18. Aucune de ces questions n’autorise un changement du protocole ou un travail I1.

Validation de cette préparation : 18 chaînes SQL des migrations comparées à l’identique (hors fins de ligne) ; les quatre triggers générés sont équivalents à captureTriggers de 0015 pour les listes de colonnes proposées (espaces normalisés). Le DDL du document et ces quatre triggers compilent dans une base SQLite mémoire isolée via node:sqlite. Ce contrôle ponctuel ne remplace ni les futurs tests rouges, ni les opérations de capture, ni la parité Wasm/plugin natif H-18. Aucun fichier de base ni donnée utilisateur utilisé.
