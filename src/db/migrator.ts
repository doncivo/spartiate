import { nowIso, systemClock, type Clock } from '../domain/clock';
import type { SqlDriver, SqlExecutor } from './driver';

/**
 * Migration versionnée (un fichier par version dans src/db/migrations, ADR 0002).
 *
 * Règles :
 * - `version` entier strictement croissant, jamais réutilisé ; nom de fichier
 *   `NNNN_titre.ts` avec NNNN = version ;
 * - `statements` : une instruction SQL par élément, sans paramètre ;
 * - une migration publiée ne se modifie plus (somme de contrôle vérifiée) :
 *   on corrige par une nouvelle migration ;
 * - chaque migration s'exécute dans sa propre transaction : tout ou rien.
 */
export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly statements: readonly string[];
}

/** Identité d'une migration sans ses instructions : de quoi savoir ce qui est appliqué et détecter une migration modifiée. */
export interface MigrationEntry {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
}

/**
 * DATA-0292 : plan de migration. `entries` (version, nom, somme de contrôle) suffit à savoir s'il y a du travail ; `load` rend les migrations
 * complètes (instructions) et n'est appelé QUE s'il y en a à appliquer. L'app ne garde au départ que le manifeste ; le SQL est chargé à la demande.
 */
export interface MigrationPlan {
  readonly entries: readonly MigrationEntry[];
  readonly load: () => Promise<readonly Migration[]>;
}

/** Dernière version d'un tableau de migrations ou d'un plan (0 si vide). */
export function latestVersion(source: readonly Migration[] | MigrationPlan): number {
  const list: readonly { readonly version: number }[] = isPlan(source) ? source.entries : source;
  return list.at(-1)?.version ?? 0;
}

const isPlan = (source: readonly Migration[] | MigrationPlan): source is MigrationPlan => !Array.isArray(source);

export type AppliedMigration = {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
  readonly applied_at: string;
};

/** Contexte du crochet : `fromVersion` = dernière version appliquée (0 = base neuve). */
export interface BeforeApplyInfo {
  readonly fromVersion: number;
}

export interface MigrateOptions {
  /** Horloge injectée (applied_at) ; par défaut l'horloge système. */
  readonly clock?: Clock;
  /**
   * Appelé une fois avant d'appliquer des migrations en attente (jamais si la base
   * est à jour) : point d'accroche de la sauvegarde automatique (PRD section 7).
   */
  readonly beforeApply?: (pending: readonly Migration[], info: BeforeApplyInfo) => Promise<void>;
  /**
   * Appelé à la fin de chaque `migrate()` réussi, **même si aucune migration n'était en attente** (Y-07, décision D3) : réintégration
   * des champs de synchro devenus connus (`reintegrateUnknownFields`). Une erreur du crochet fait échouer `migrate()` ; les migrations
   * déjà appliquées le restent (chacune dans sa transaction).
   */
  readonly afterApply?: (db: SqlDriver, report: MigrateReport) => Promise<void>;
  /** Étape en cours (diagnostic d'ouverture affiché sous app.dbError) : appelé avant chaque étape. */
  readonly onStep?: (step: MigrateStep) => void;
  /**
   * I-06 : appelé une fois après la lecture de `schema_migrations`, avant tout contrôle et toute écriture : `current` = dernière migration
   * appliquée à la base (0 = base neuve), `known` = dernière migration connue du code (diagnostic de l'écran d'échec).
   */
  readonly onSchemaRead?: (info: { readonly current: number; readonly known: number }) => void;
}

/** Étapes de `migrate()`, dans l'ordre : lecture du schéma, sauvegarde, chaque migration, crochet final. */
export type MigrateStep =
  | { readonly kind: 'schema' }
  | { readonly kind: 'backup' }
  | { readonly kind: 'migration'; readonly version: number }
  | { readonly kind: 'afterApply' };

export interface MigrateReport {
  readonly applied: readonly number[];
  readonly currentVersion: number;
}

export class MigrationError extends Error {
  override readonly name: string = 'MigrationError';
}

/**
 * I-06 (ADR 0002 renvoi, ADR 0007 avenant I-06 point 4) : la base porte une migration plus récente que la dernière connue du code (app plus
 * ancienne que les données, par exemple une IPA plus ancienne réinstallée). Levée AVANT toute écriture : ni sauvegarde, ni migration, ni
 * crochet de fin. Le message reste technique (diagnostic copiable) ; l'écran affiche son propre texte.
 */
export class SchemaNewerThanApp extends MigrationError {
  override readonly name: string = 'SchemaNewerThanApp';
  constructor(
    readonly databaseVersion: number,
    readonly appSchemaVersion: number,
  ) {
    super(`schéma de la base ${String(databaseVersion)} > schéma de l'app ${String(appSchemaVersion)}`);
  }
}

export const MIGRATIONS_TABLE = 'schema_migrations';

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
  version    INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL,
  checksum   TEXT    NOT NULL,
  applied_at TEXT    NOT NULL
)`;

/** Somme de contrôle FNV-1a 32 bits du contenu SQL (détection de migration modifiée). */
export function migrationChecksum(migration: Migration): string {
  let hash = 0x811c9dc5;
  const text = migration.statements.join('\n;\n');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Vérifie l'ordre et l'unicité des versions déclarées. */
export function validateMigrations(migrations: readonly Migration[]): void {
  let previous = 0;
  for (const m of migrations) {
    if (!Number.isInteger(m.version) || m.version < 1) {
      throw new MigrationError(`Version de migration invalide : ${String(m.version)}`);
    }
    if (m.version <= previous) {
      throw new MigrationError(`Migrations non strictement croissantes : ${String(m.version)} après ${String(previous)}`);
    }
    if (m.statements.length === 0) {
      throw new MigrationError(`Migration ${String(m.version)} vide`);
    }
    previous = m.version;
  }
}

/** Crée la table de suivi si besoin (idempotent). */
export async function ensureMigrationsTable(db: SqlExecutor): Promise<void> {
  await db.execute(CREATE_TABLE);
}

/** Lit les migrations appliquées ; suppose la table créée par ensureMigrationsTable. */
export async function readAppliedMigrations(db: SqlExecutor): Promise<AppliedMigration[]> {
  return db.select<AppliedMigration>(
    `SELECT version, name, checksum, applied_at FROM ${MIGRATIONS_TABLE} ORDER BY version`,
  );
}

/**
 * Applique les migrations en attente. Rejouable : un second appel ne fait rien.
 * Échoue sans rien appliquer si une migration déjà passée a changé, ou si la base
 * contient une version inconnue de ce code (app plus ancienne que la base).
 */
export async function migrate(
  db: SqlDriver,
  source: readonly Migration[] | MigrationPlan,
  options: MigrateOptions = {},
): Promise<MigrateReport> {
  const plan: MigrationPlan = isPlan(source)
    ? source
    : (validateMigrations(source), { entries: source.map((m) => ({ version: m.version, name: m.name, checksum: migrationChecksum(m) })), load: () => Promise.resolve(source) });
  validateMigrations(plan.entries.map((e) => ({ ...e, statements: [''] })));
  const clock = options.clock ?? systemClock;
  const onStep = options.onStep ?? (() => undefined);

  onStep({ kind: 'schema' });
  await ensureMigrationsTable(db);
  const applied = await readAppliedMigrations(db);
  const known = new Map(plan.entries.map((e) => [e.version, e]));
  const lastKnown = latestVersion(plan);
  const lastApplied = applied.reduce((max, row) => Math.max(max, row.version), 0);
  options.onSchemaRead?.({ current: lastApplied, known: lastKnown });
  if (lastApplied > lastKnown) throw new SchemaNewerThanApp(lastApplied, lastKnown);

  for (const row of applied) {
    const migration = known.get(row.version);
    if (!migration) {
      throw new MigrationError(`Base en version ${String(row.version)}, inconnue de cette version de l'app`);
    }
    if (migration.checksum !== row.checksum) {
      throw new MigrationError(`Migration ${String(row.version)} modifiée après application`);
    }
  }

  const done = new Set(applied.map((row) => row.version));
  const pendingEntries = plan.entries.filter((e) => !done.has(e.version));
  // Instructions chargées seulement s'il y a du travail ; chacune doit correspondre à la somme de contrôle du plan (manifeste périmé : refus avant toute écriture).
  const pending = pendingEntries.length === 0 ? [] : await loadPending(plan, pendingEntries);
  if (pending.length > 0 && options.beforeApply) {
    onStep({ kind: 'backup' });
    await options.beforeApply(pending, { fromVersion: applied.at(-1)?.version ?? 0 });
  }

  for (const migration of pending) {
    onStep({ kind: 'migration', version: migration.version });
    await db.transaction(async (tx) => {
      for (const statement of migration.statements) await tx.execute(statement);
      await tx.execute(
        `INSERT INTO ${MIGRATIONS_TABLE} (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)`,
        [migration.version, migration.name, migrationChecksum(migration), nowIso(clock)],
      );
    });
  }

  const report: MigrateReport = {
    applied: pending.map((m) => m.version),
    currentVersion: latestVersion(plan),
  };
  if (options.afterApply) {
    onStep({ kind: 'afterApply' });
    await options.afterApply(db, report);
  }
  return report;
}

async function loadPending(plan: MigrationPlan, entries: readonly MigrationEntry[]): Promise<Migration[]> {
  const loaded = new Map((await plan.load()).map((m) => [m.version, m]));
  return entries.map((entry) => {
    const migration = loaded.get(entry.version);
    if (!migration || migrationChecksum(migration) !== entry.checksum) {
      throw new MigrationError(`Migration ${String(entry.version)} absente ou différente du manifeste`);
    }
    return migration;
  });
}
