/**
 * Export complet (I6-03, § 21) : archive zip CSV + JSON de toutes les tables de DONNÉES de l'utilisateur, ouvrable sans l'app. Décrite fichier par
 * fichier dans `docs/export-complet.md` (un test garde l'accord entre le document et ce module). Pur : aucune lecture de base, aucun fichier.
 *
 * Contenu : `manifest.json` et `data.json` (mêmes octets et même forme que l'export habituel : l'archive complète est aussi une archive importable),
 * `contenu.json` (format, fichiers, colonnes, types, unités, exclusions) et un CSV par table sous `csv/`. Exclus : le fichier des photos de progression
 * (elles ne quittent jamais l'appareil, D-99), les tables techniques de synchro, le journal des conflits, les échantillons importés, les réglages hors
 * thème. Aucune clé, aucun jeton, aucun identifiant d'appareil : ils ne sont dans aucune des tables exportées.
 *
 * CSV (choix prudent, D-103) : UTF-8 AVEC marque d'ordre des octets (Excel affiche les accents), séparateur « ; » (comme l'export de l'historique, Excel en
 * français), fin de ligne CRLF, guillemets doublés, cellule vide = NULL, dates ISO 8601, nombres avec point décimal et sans notation scientifique.
 */

import { canonicalDataJson, ARCHIVE_EXTRA_COLUMNS, TRAINING_EXPORT_TABLES, trainingRows, trainingTable, trainingColumns, type ExportData, type TrainingTable, type TrainingValue, type Manifest, EXPORT_APP } from './archive';
import { sha256Hex } from './sha256';
import { buildZip, type ZipEntry } from './zip';

/** Version du format de l'archive complète (distincte de la version du schéma). */
export const FULL_EXPORT_FORMAT = 1;
export const CSV_BOM = '﻿';
export const CSV_SEPARATOR = ';';
const CSV_EOL = '\r\n';

export type FullExportTableName = 'profile' | 'body_weight' | 'settings' | TrainingTable;
export const FULL_EXPORT_TABLES: readonly FullExportTableName[] = ['profile', 'body_weight', 'settings', ...TRAINING_EXPORT_TABLES];

/** Tables et lignes jamais exportées (noms de tables, pas de contenu) : fichiers de photos, technique de synchro, conflits, échantillons importés. */
export const FULL_EXPORT_EXCLUDED = [
  'progress_photo_file',
  'sync_outbox',
  'sync_field_clock',
  'sync_tombstone',
  'sync_guard',
  'sync_meta',
  'sync_state',
  'sync_unknown',
  'sync_parked',
  'conflict_log',
  'epoch_carry_report',
  'recovery_sample',
  'recovery_import_state',
  'schema_migrations',
] as const;

// --- cellules et fichiers CSV -----------------------------------------------------------------------------------------------------

function numberText(n: number): string {
  const plain = String(n);
  if (!/e/i.test(plain)) return plain;
  if (Number.isInteger(n)) return BigInt(n).toString();
  const fixed = n.toFixed(20);
  return fixed.replace(/0+$/, '').replace(/\.$/, '');
}

/** Un texte qui commencerait une formule dans un tableur (= + - @ % tabulation, retour chariot) est précédé d'une apostrophe. */
const neutralize = (text: string): string => (/^[=+\-@%\t\r]/.test(text) ? `'${text}` : text);

/** Cellule : vide pour NULL, point décimal pour un nombre, guillemets (doublés) si le texte contient « ; » « " » ou un retour à la ligne. */
export function csvCell(value: string | number | null): string {
  if (value === null) return '';
  if (typeof value === 'number') return numberText(value);
  const text = neutralize(value);
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Fichier CSV : marque d'ordre des octets, en-tête, une ligne par ligne de données, chaque ligne terminée par CRLF. */
export function csvText(columns: readonly string[], rows: readonly (readonly (string | number | null)[])[]): string {
  return `${CSV_BOM}${[columns, ...rows].map((row) => row.map((cell) => csvCell(cell)).join(CSV_SEPARATOR)).join(CSV_EOL)}${CSV_EOL}`;
}

/** Relecture d'un CSV produit par `csvText` (guillemets, retours à la ligne dans une cellule) : sert aux tests et à toute relecture sans l'app. */
export function parseCsvText(text: string): string[][] {
  const source = text.startsWith(CSV_BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i] as string;
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === CSV_SEPARATOR) {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// --- colonnes documentées ----------------------------------------------------------------------------------------------------------

export interface FullExportColumn {
  readonly name: string;
  /** `text`, `int`, `real`, `bool` (0 ou 1), `json` (texte JSON), `date` (AAAA-MM-JJ), `time` (HH:MM), `datetime` (ISO 8601 UTC), `enum` (liste fermée). */
  readonly type: string;
  /** Unité de la valeur ; null : sans unité. */
  readonly unit: string | null;
  readonly nullable: boolean;
}

const col = (name: string, type: string, nullable = true, unit: string | null = null): FullExportColumn => ({ name, type, unit, nullable });

const STATIC_TABLES: Readonly<Record<'profile' | 'body_weight' | 'settings', readonly FullExportColumn[]>> = {
  profile: [col('id', 'text', false), col('sex', 'enum'), col('birth_year', 'int'), col('height_cm', 'real', true, 'cm'), col('goal', 'enum'), col('experience', 'enum'), col('units', 'enum')],
  body_weight: [col('id', 'text', false), col('date', 'date', false), col('kg', 'real', false, 'kg'), col('source', 'enum', false), col('timezone', 'text', false), col('health_uuid', 'text'), col('measured_at', 'datetime')],
  settings: [col('key', 'text', false), col('value', 'text', false)],
};

/** Unités qui ne se lisent pas au suffixe du nom (par table et colonne). */
const UNIT_OVERRIDES: Readonly<Record<string, string>> = {
  'measurement.value': 'cm',
  'food.kcal': 'kcal pour 100 g',
  'food.protein_g': 'g pour 100 g',
  'food.fat_g': 'g pour 100 g',
  'food.carb_g': 'g pour 100 g',
  'food.fiber_g': 'g pour 100 g',
  'meal_entry.kcal': 'kcal',
  'nutrition_target.kcal': 'kcal par jour',
  'nutrition_target.protein_g': 'g par jour',
  'nutrition_target.fat_g': 'g par jour',
  'nutrition_target.carb_g': 'g par jour',
  'recipe_ingredient.kcal_100g': 'kcal pour 100 g',
  'recipe_ingredient.protein_100g': 'g pour 100 g',
  'recipe_ingredient.fat_100g': 'g pour 100 g',
  'recipe_ingredient.carb_100g': 'g pour 100 g',
  'recipe_ingredient.fiber_100g': 'g pour 100 g',
  'food_portion.grams': 'g',
  'meal_entry.grams': 'g',
  'recipe_ingredient.grams': 'g',
  'recovery_day.sleep_minutes': 'min',
  'recovery_day.sleep_need_minutes': 'min',
  'recovery_day.bedtime_sigma_minutes': 'min',
  'recovery_day.hrv_ms': 'ms',
  'recovery_day.resting_hr': 'bpm',
  'muscle_recovery.percent': '%',
  'muscle_recovery.hours': 'h',
};

function unitOf(table: string, column: string): string | null {
  const override = UNIT_OVERRIDES[`${table}.${column}`];
  if (override !== undefined) return override;
  if (column.endsWith('_kg')) return 'kg';
  if (column.endsWith('_cm')) return 'cm';
  if (column.endsWith('_sec')) return 's';
  if (column.endsWith('_g')) return 'g';
  return null;
}

/** Colonnes d'un fichier, dans l'ordre d'écriture : identifiant d'abord, puis l'ordre du catalogue de synchro, puis les clés propres à l'archive. */
export function fullExportColumns(table: string): readonly FullExportColumn[] {
  if (table === 'profile' || table === 'body_weight' || table === 'settings') return STATIC_TABLES[table];
  const t = table as TrainingTable;
  const catalogue = trainingTable(t);
  const columns = trainingColumns(t).map((name) => {
    const c = catalogue.columns.find((x) => x.name === name);
    return col(name, c?.type === 'id' ? 'text' : (c?.type ?? 'text'), c?.nullable ?? true, unitOf(table, name));
  });
  const extras = (ARCHIVE_EXTRA_COLUMNS[t] ?? []).map((name) => col(name, 'datetime'));
  return [col('id', 'text', false), ...columns, ...extras];
}

// --- construction ------------------------------------------------------------------------------------------------------------------

const byKey = (a: readonly (string | number | null)[], b: readonly (string | number | null)[]): number => {
  const x = String(a[0]);
  const y = String(b[0]);
  return x < y ? -1 : x > y ? 1 : 0;
};

function rowsOf(table: FullExportTableName, data: ExportData): (string | number | null)[][] {
  let rows: (string | number | null)[][];
  if (table === 'profile') {
    const p = data.profile;
    rows = p ? [[p.id, p.sex, p.birthYear, p.heightCm, p.goal, p.experience, p.units]] : [];
  } else if (table === 'body_weight') {
    rows = data.weights.map((w) => [w.id, w.date, w.kg, w.source, w.timezone, w.healthUuid, w.measuredAt]);
  } else if (table === 'settings') {
    const theme = data.settings['ui.theme'];
    rows = theme === undefined ? [] : [['ui.theme', theme]];
  } else {
    const columns = fullExportColumns(table).map((c) => c.name);
    rows = trainingRows(data, table).map((r) => columns.map((name): string | number | null => (name === 'id' ? r.id : ((r.values[name] ?? null) as TrainingValue))));
  }
  return rows.sort(byKey);
}

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

export interface FullExportFile {
  readonly file: string;
  readonly table: FullExportTableName;
  readonly rows: number;
}

export interface BuiltFullExport {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly files: readonly FullExportFile[];
}

/** Archive complète : même `data.json` et même manifeste que l'export habituel, plus `contenu.json` et un CSV par table. */
export function buildFullExport(data: ExportData, options: { readonly date: string; readonly sv: number; readonly appVersion: string }): Promise<BuiltFullExport> {
  const dataBytes = encode(canonicalDataJson(data));
  const manifest: Manifest = { app: EXPORT_APP, sv: options.sv, date: options.date, sha256: sha256Hex(dataBytes) };
  const csv: ZipEntry[] = [];
  const files: FullExportFile[] = [];
  const described: { file: string; table: string; rows: number; columns: { name: string; type: string; unit: string | null }[] }[] = [];
  for (const table of FULL_EXPORT_TABLES) {
    const columns = fullExportColumns(table);
    const rows = rowsOf(table, data);
    const file = `csv/${table}.csv`;
    csv.push({ name: file, data: encode(csvText(columns.map((c) => c.name), rows)) });
    files.push({ file, table, rows: rows.length });
    described.push({ file, table, rows: rows.length, columns: columns.map((c) => ({ name: c.name, type: c.type, unit: c.unit })) });
  }
  const content = {
    format: FULL_EXPORT_FORMAT,
    app: EXPORT_APP,
    sv: options.sv,
    appVersion: options.appVersion,
    date: options.date,
    csv: { encoding: 'utf-8', bom: true, separator: CSV_SEPARATOR, eol: 'CRLF', quote: '"', nullCell: '' },
    files: described,
    excluded: [...FULL_EXPORT_EXCLUDED],
  };
  const entries: ZipEntry[] = [
    { name: 'manifest.json', data: encode(JSON.stringify(manifest)) },
    { name: 'contenu.json', data: encode(JSON.stringify(content)) },
    { name: 'data.json', data: dataBytes },
    ...csv,
  ];
  return Promise.resolve({ bytes: buildZip(entries), fileName: `spartiate-export-complet-${options.date.slice(0, 10)}.zip`, files });
}
