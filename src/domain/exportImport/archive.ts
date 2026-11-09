/**
 * Export / import de Spartiate (SPA-005, D-57) : format de l'archive, forme canonique de `data.json`, validation complète avant écriture.
 * Pur : aucune lecture de base, aucun fichier. L'export est une sauvegarde de contenu, distincte du filtre de publication de la synchro.
 *
 * Contenu : `profile`, `body_weight` (lignes non supprimées), la liste blanche de `settings` (`EXPORT_SETTING_KEYS`) et, depuis la 0.2.3,
 * les tables d'entraînement (`TRAINING_EXPORT_TABLES`, séances closes seulement). Exclus :
 * identité d'appareil, clés, bookmarks, tables `sync_*`, `conflict_log`, `epoch_carry_report`, journaux, `hlc`, `device_id`, `updated_at`.
 */

import { SETTINGS_DEFINITIONS } from '../model/settings';
import {
  PROFILE_ID,
  WEIGHT_MAX_KG,
  validateProfile,
  weightId,
  type BodyGoal,
  type Experience,
  type Sex,
  type Units,
  type WeightSource,
} from '../bodyProfile';
import type { ThemeChoice } from '../model/settings';
import { isIsoDateTime, isLocalDate } from '../types';
import { SYNC_CATALOGUE, type SyncTable } from '../../domain/sync/syncTables';
import { sha256Hex } from './sha256';
import { RECIPE_COOKED_WEIGHT_MAX_G, RECIPE_INGREDIENT_GRAMS_MAX, RECIPE_NAME_MAX, RECIPE_SERVINGS_MAX } from '../nutrition/recipeTypes';
import { buildZip, readZip, ZipError, type ZipEntry } from './zip';


export const EXPORT_APP = 'spartiate';
/** Version de schéma écrite au manifeste et maximale acceptée à l'import : celle de la dernière migration (vérifiée par un test). */
export const EXPORT_SV = 9;
/** Réglages exportés (D-57 : unités, jour de check-in, thème). Les unités sont dans `profile` ; le jour de check-in n'existe pas encore (nutrition). */
export const EXPORT_SETTING_KEYS = ['ui.theme'] as const;
export type ExportSettingKey = (typeof EXPORT_SETTING_KEYS)[number];
const THEMES: readonly ThemeChoice[] = ['system', 'light', 'dark'];
/** Thème par défaut : lu dans le registre des réglages (SPA-009 l'a fait passer de « system » à « dark »), jamais recopié ici. */
export const DEFAULT_THEME: ThemeChoice = SETTINGS_DEFINITIONS['ui.theme'].defaultValue;

export interface ExportProfile {
  readonly id: typeof PROFILE_ID;
  readonly sex: Sex | null;
  readonly birthYear: number | null;
  readonly heightCm: number | null;
  readonly goal: BodyGoal | null;
  readonly experience: Experience | null;
  readonly units: Units | null;
}

export interface ExportWeight {
  readonly id: string;
  readonly date: string;
  readonly kg: number;
  readonly source: WeightSource;
  readonly timezone: string;
  readonly healthUuid: string | null;
  readonly measuredAt: string | null;
}

/**
 * Tables d'entraînement exportées (0.2.3, point 4) : exercices personnalisés, profils de matériel, routines, séances CLOSES et leurs
 * séries, dans l'ordre du catalogue (parents d'abord). Les colonnes sont celles publiées par la synchro, sans `created_at` ni
 * `deleted_at` ; la validation est celle du catalogue (type et longueur). Une séance ouverte n'est jamais exportée (D-27). I2-01 (0.3.1) :
 * profil de progression et décisions d'Ali, difficulté des séries. I3-02 (schéma 7) : cycles d'entraînement. I4-02 (schéma 8) : fiches alimentaires, portions, journal et cibles de nutrition (valeurs inconnues conservées nulles). I4-07 (schéma 9) : journée déclarée, recettes et ingrédients (une archive plus ancienne, sans ces clés, n'en supprime jamais, même en « remplacer »).
 */
export const TRAINING_EXPORT_TABLES = ['exercise', 'equipment_profile', 'routine', 'routine_day', 'routine_exercise', 'workout', 'workout_set', 'progression_profile', 'recommendation_decision', 'mesocycle', 'food', 'food_portion', 'meal_entry', 'nutrition_target', 'day_completeness', 'recipe', 'recipe_ingredient'] as const;
/**
 * Colonnes ajoutées après la première version exportée de leur table : absentes d'une archive plus ancienne (0.3.0 : `workout_set` sans
 * `difficulty`), lues comme nulles. Toute autre colonne manquante reste refusée.
 */
const LATER_COLUMNS: Readonly<Partial<Record<string, readonly string[]>>> = { workout_set: ['difficulty'] };
export type TrainingTable = (typeof TRAINING_EXPORT_TABLES)[number];
/**
 * Version de schéma à partir de laquelle une table existe dans une archive (I4-07) : une archive plus ancienne, sans ses clés, n'a pas vu ces
 * tables ; l'importer en « remplacer » ne doit donc jamais en supprimer les lignes locales. Une archive récente sans ligne de la table, elle,
 * dit que la table est vide : « remplacer » la vide.
 */
export const TABLE_SINCE_SV: Readonly<Partial<Record<TrainingTable, number>>> = {
  progression_profile: 6,
  recommendation_decision: 6,
  mesocycle: 7,
  food: 8,
  food_portion: 8,
  meal_entry: 8,
  nutrition_target: 8,
  day_completeness: 9,
  recipe: 9,
  recipe_ingredient: 9,
};
export type TrainingValue = string | number | null;

export interface TrainingRow {
  readonly id: string;
  /** Colonnes publiées hors `created_at` / `deleted_at`, nom SQL → valeur stockée. */
  readonly values: Readonly<Record<string, TrainingValue>>;
}

export type TrainingExport = Readonly<Partial<Record<TrainingTable, readonly TrainingRow[]>>>;

export interface ExportData {
  readonly profile: ExportProfile | null;
  readonly weights: readonly ExportWeight[];
  readonly settings: { readonly 'ui.theme'?: ThemeChoice };
  /** Absent ou vide : archive sans données d'entraînement (archives antérieures à la 0.2.3 comprises). */
  readonly training?: TrainingExport;
  /** Version de schéma du manifeste d'une archive LUE (absente d'une lecture de la base) : voir `TABLE_SINCE_SV`. Hors de la forme canonique. */
  readonly archiveSv?: number;
}

/** Table du catalogue d'une table exportée (toujours présente : vérifié par un test). */
export function trainingTable(name: TrainingTable): SyncTable {
  const t = SYNC_CATALOGUE.table(name);
  if (!t) throw new Error(`table d'export inconnue du catalogue : ${name}`);
  return t;
}

/** Colonnes exportées d'une table d'entraînement : colonnes publiées sans `created_at` ni `deleted_at`. */
export function trainingColumns(name: TrainingTable): string[] {
  return trainingTable(name)
    .columns.map((c) => c.name)
    .filter((n) => n !== 'created_at' && n !== 'deleted_at');
}

/** Lignes d'une table dans l'archive (vide si absente). */
export const trainingRows = (data: ExportData, name: TrainingTable): readonly TrainingRow[] => data.training?.[name] ?? [];

export interface Manifest {
  readonly app: string;
  readonly sv: number;
  readonly date: string;
  readonly sha256: string;
}

export type ArchiveErrorCode = 'not-zip' | 'corrupt' | 'missing-file' | 'bad-manifest' | 'wrong-app' | 'future-version' | 'hash-mismatch' | 'invalid-data';

export class ArchiveError extends Error {
  override readonly name = 'ArchiveError';
  readonly code: ArchiveErrorCode;
  constructor(code: ArchiveErrorCode) {
    super(`archive d'export : ${code}`);
    this.code = code;
  }
}

// --- forme canonique -------------------------------------------------------------------------------------------------------------

const byId = (a: { readonly id: string }, b: { readonly id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** JSON canonique : clés triées, aucun espace, lignes triées par identifiant. Mêmes données → mêmes octets. */
export function canonicalDataJson(data: ExportData): string {
  const weights = [...data.weights].sort(byId).map((x) => ({
    date: x.date,
    health_uuid: x.healthUuid,
    id: x.id,
    kg: x.kg,
    measured_at: x.measuredAt,
    source: x.source,
    timezone: x.timezone,
  }));
  const p = data.profile;
  const profile = p
    ? { birth_year: p.birthYear, experience: p.experience, goal: p.goal, height_cm: p.heightCm, id: p.id, sex: p.sex, units: p.units }
    : null;
  const settings: Record<string, ThemeChoice> = {};
  for (const key of EXPORT_SETTING_KEYS) {
    const value = data.settings[key];
    // Le thème par défaut (`DEFAULT_THEME`) est absent de la forme canonique (un réglage jamais touché et un réglage remis au défaut exportent pareil).
    if (value !== undefined && value !== DEFAULT_THEME) settings[key] = value;
  }
  const training: Record<string, Record<string, TrainingValue>[]> = {};
  for (const name of TRAINING_EXPORT_TABLES) {
    const rows = [...trainingRows(data, name)].sort(byId);
    if (rows.length === 0) continue;
    const columns = [...trainingColumns(name), 'id'].sort();
    training[name] = rows.map((r) => Object.fromEntries(columns.map((col) => [col, col === 'id' ? r.id : (r.values[col] ?? null)])));
  }
  // Sans données d'entraînement, la clé est absente : mêmes octets qu'une archive 0.2.2 (équivalence et hash inchangés).
  return Object.keys(training).length === 0 ? JSON.stringify({ body_weight: weights, profile, settings }) : JSON.stringify({ body_weight: weights, profile, settings, training });
}

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

/** Hash de l'équivalence métier : SHA-256 du `data.json` canonique (sans hlc, device_id, updated_at). */
export function canonicalHash(data: ExportData): Promise<string> {
  return Promise.resolve(sha256Hex(encode(canonicalDataJson(data))));
}

export function weightCsv(weights: readonly ExportWeight[]): string {
  const lines = ['date;kg;source;fuseau;health_uuid;mesure_a'];
  for (const x of [...weights].sort(byId)) lines.push([x.date, String(x.kg), x.source, x.timezone, x.healthUuid ?? '', x.measuredAt ?? ''].join(';'));
  return `${lines.join('\n')}\n`;
}

export function buildExportArchive(data: ExportData, options: { readonly date: string; readonly sv: number }): Promise<{ bytes: Uint8Array; fileName: string; dataSha256: string }> {
  const dataBytes = encode(canonicalDataJson(data));
  const dataSha256 = sha256Hex(dataBytes);
  const manifest: Manifest = { app: EXPORT_APP, sv: options.sv, date: options.date, sha256: dataSha256 };
  const entries: ZipEntry[] = [
    { name: 'data.json', data: dataBytes },
    { name: 'manifest.json', data: encode(JSON.stringify(manifest)) },
    { name: 'weight.csv', data: encode(weightCsv(data.weights)) },
  ];
  return Promise.resolve({ bytes: buildZip(entries), fileName: `spartiate-export-${options.date.slice(0, 10)}.zip`, dataSha256 });
}

// --- lecture et validation -------------------------------------------------------------------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const exactKeys = (o: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(o);
  return own.length === keys.length && keys.every((k) => k in o);
};
const nullableString = (v: unknown): v is string | null => v === null || typeof v === 'string';
const nullableNumber = (v: unknown): v is number | null => v === null || (typeof v === 'number' && Number.isFinite(v));

function parseProfile(raw: unknown, currentYear: number): ExportProfile | null {
  if (raw === null) return null;
  if (!isObject(raw) || !exactKeys(raw, ['birth_year', 'experience', 'goal', 'height_cm', 'id', 'sex', 'units'])) throw new ArchiveError('invalid-data');
  const { birth_year, experience, goal, height_cm, id, sex, units } = raw;
  if (id !== PROFILE_ID || !nullableNumber(birth_year) || !nullableNumber(height_cm) || !nullableString(sex) || !nullableString(goal) || !nullableString(experience) || !nullableString(units)) {
    throw new ArchiveError('invalid-data');
  }
  const profile: ExportProfile = { id: PROFILE_ID, sex: sex as Sex | null, birthYear: birth_year, heightCm: height_cm, goal: goal as BodyGoal | null, experience: experience as Experience | null, units: units as Units | null };
  const issues = validateProfile({ sex: profile.sex, birthYear: profile.birthYear, heightCm: profile.heightCm, goal: profile.goal, experience: profile.experience, units: profile.units }, currentYear);
  if (issues.length > 0) throw new ArchiveError('invalid-data');
  return profile;
}

function parseWeights(raw: unknown): ExportWeight[] {
  if (!Array.isArray(raw)) throw new ArchiveError('invalid-data');
  const seen = new Set<string>();
  return raw.map((item): ExportWeight => {
    if (!isObject(item) || !exactKeys(item, ['date', 'health_uuid', 'id', 'kg', 'measured_at', 'source', 'timezone'])) throw new ArchiveError('invalid-data');
    const { date, health_uuid, id, kg, measured_at, source, timezone } = item;
    if (typeof date !== 'string' || !isLocalDate(date) || typeof id !== 'string' || (source !== 'manual' && source !== 'health')) throw new ArchiveError('invalid-data');
    if (id !== weightId(date, source) || seen.has(id)) throw new ArchiveError('invalid-data');
    if (typeof kg !== 'number' || !Number.isFinite(kg) || kg <= 0 || kg > WEIGHT_MAX_KG) throw new ArchiveError('invalid-data');
    if (typeof timezone !== 'string' || timezone.length === 0 || timezone.length > 64 || !nullableString(health_uuid) || (health_uuid !== null && health_uuid.length > 128) || !nullableString(measured_at)) throw new ArchiveError('invalid-data');
    if (measured_at !== null && !isIsoDateTime(measured_at)) throw new ArchiveError('invalid-data');
    if (source === 'manual' ? health_uuid !== null || measured_at !== null : health_uuid === null || measured_at === null || measured_at.length === 0) throw new ArchiveError('invalid-data');
    seen.add(id);
    return { id, date, kg, source, timezone, healthUuid: health_uuid, measuredAt: measured_at };
  });
}

function parseSettings(raw: unknown): ExportData['settings'] {
  if (!isObject(raw)) throw new ArchiveError('invalid-data');
  const out: { 'ui.theme'?: ThemeChoice } = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key !== 'ui.theme' || typeof value !== 'string' || !THEMES.includes(value as ThemeChoice)) throw new ArchiveError('invalid-data');
    if (value !== DEFAULT_THEME) out['ui.theme'] = value as ThemeChoice;
  }
  return out;
}

const numberIn = (v: TrainingValue | undefined, min: number, max: number, minOpen = false): boolean => typeof v === 'number' && Number.isFinite(v) && (minOpen ? v > min : v >= min) && v <= max;
const nullableIn = (v: TrainingValue | undefined, min: number, max: number): boolean => v === null || numberIn(v, min, max);
const textLength = (v: TrainingValue | undefined, min: number, max: number): boolean => typeof v === 'string' && v.length >= min && v.length <= max;

/** Bornes propres aux tables de recettes et de journée déclarée (celles des CHECK de la migration 0009) ; les autres tables : catalogue seul. */
function rowBoundsOk(table: TrainingTable, id: string, v: Readonly<Record<string, TrainingValue>>): boolean {
  switch (table) {
    case 'day_completeness':
      return id === `day|${String(v['date'])}`;
    case 'recipe':
      return textLength(v['name'], 1, RECIPE_NAME_MAX) && Number.isInteger(v['servings']) && numberIn(v['servings'], 1, RECIPE_SERVINGS_MAX) && (v['cooked_weight_g'] === null || numberIn(v['cooked_weight_g'], 0, RECIPE_COOKED_WEIGHT_MAX_G, true));
    case 'recipe_ingredient':
      return (
        Number.isInteger(v['position']) &&
        numberIn(v['position'], 0, Number.MAX_SAFE_INTEGER) &&
        textLength(v['name'], 1, RECIPE_NAME_MAX) &&
        (v['food_ref'] === null || textLength(v['food_ref'], 1, 128)) &&
        numberIn(v['grams'], 0, RECIPE_INGREDIENT_GRAMS_MAX, true) &&
        nullableIn(v['kcal_100g'], 0, 900) &&
        ['protein_100g', 'fat_100g', 'carb_100g', 'fiber_100g'].every((c) => nullableIn(v[c], 0, 100))
      );
    default:
      return true;
  }
}

/**
 * Données d'entraînement de l'archive : tables connues seulement, lignes uniques, colonnes exactes, valeurs conformes au catalogue,
 * et chaque ligne enfant rattachée à un parent présent dans l'archive (une archive est toujours produite entière).
 */
function parseTraining(raw: unknown): TrainingExport {
  if (!isObject(raw)) throw new ArchiveError('invalid-data');
  const out: Partial<Record<TrainingTable, TrainingRow[]>> = {};
  const idsByTable = new Map<string, Set<string>>();
  for (const key of Object.keys(raw)) if (!(TRAINING_EXPORT_TABLES as readonly string[]).includes(key)) throw new ArchiveError('invalid-data');
  for (const name of TRAINING_EXPORT_TABLES) {
    const list = raw[name];
    if (list === undefined) continue;
    if (!Array.isArray(list)) throw new ArchiveError('invalid-data');
    const t = trainingTable(name);
    const columns = trainingColumns(name);
    const seen = new Set<string>();
    const rows = list.map((item): TrainingRow => {
      if (!isObject(item)) throw new ArchiveError('invalid-data');
      const later = (LATER_COLUMNS[name] ?? []).filter((col) => !Object.prototype.hasOwnProperty.call(item, col));
      if (!exactKeys(item, [...columns.filter((col) => !later.includes(col)), 'id'])) throw new ArchiveError('invalid-data');
      const id = item['id'];
      if (!SYNC_CATALOGUE.isValidRowId(t, id) || seen.has(id)) throw new ArchiveError('invalid-data');
      const values: Record<string, TrainingValue> = {};
      for (const col of t.columns) {
        if (!columns.includes(col.name)) continue;
        const value = later.includes(col.name) ? null : item[col.name];
        if (!SYNC_CATALOGUE.isValidValue(col, value)) throw new ArchiveError('invalid-data');
        values[col.name] = value as TrainingValue;
      }
      // Bornes des CHECK de la migration 0009 : une valeur hors bornes est refusée à l'aperçu, jamais par un échec SQL à l'application (I4-07).
      if (!rowBoundsOk(name, id, values)) throw new ArchiveError('invalid-data');
      for (const parent of t.parents) {
        const parentId = values[parent.column];
        if (parentId !== null && !idsByTable.get(parent.table)?.has(String(parentId))) throw new ArchiveError('invalid-data');
      }
      seen.add(id);
      return { id, values };
    });
    // REV-01 constat 1 (D-57) : une séance ouverte (ended_at nul) est une donnée de la sauvegarde ; elle n'est jamais publiée avant sa clôture (D-27).
    idsByTable.set(name, seen);
    out[name] = rows;
  }
  return out;
}

export interface ParsedArchive {
  readonly manifest: Manifest;
  readonly data: ExportData;
  /** SHA-256 des octets archivés de `data.json` (celui du manifeste). */
  readonly dataSha256: string;
}

/**
 * Valide toute l'archive (zip, présence des fichiers, manifeste, application, version de schéma, hash, valeurs, identités) et rend les
 * données. Aucune écriture : un refus laisse la base intacte. `currentSv` : version de schéma de cette app (un `sv` supérieur est refusé).
 */
export function parseExportArchive(bytes: Uint8Array, options: { readonly currentSv: number; readonly currentYear: number }): Promise<ParsedArchive> {
  return Promise.resolve().then(() => {
    let entries: ZipEntry[];
    try {
      entries = readZip(bytes);
    } catch (e) {
      throw new ArchiveError(e instanceof ZipError && e.code === 'not-zip' ? 'not-zip' : 'corrupt');
    }
    const files = new Map(entries.map((e) => [e.name, e.data] as const));
    const dataBytes = files.get('data.json');
    const manifestBytes = files.get('manifest.json');
    if (!dataBytes || !manifestBytes) throw new ArchiveError('missing-file');
    let manifest: Manifest;
    try {
      const raw: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes));
      if (!isObject(raw) || typeof raw['app'] !== 'string' || typeof raw['sv'] !== 'number' || !Number.isInteger(raw['sv']) || typeof raw['date'] !== 'string' || typeof raw['sha256'] !== 'string') {
        throw new ArchiveError('bad-manifest');
      }
      manifest = { app: raw['app'], sv: raw['sv'], date: raw['date'], sha256: raw['sha256'] };
    } catch (e) {
      throw e instanceof ArchiveError ? e : new ArchiveError('bad-manifest');
    }
    if (manifest.app !== EXPORT_APP) throw new ArchiveError('wrong-app');
    if (manifest.sv > options.currentSv) throw new ArchiveError('future-version');
    const dataSha256 = sha256Hex(dataBytes);
    if (dataSha256 !== manifest.sha256) throw new ArchiveError('hash-mismatch');
    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(dataBytes));
    } catch {
      throw new ArchiveError('invalid-data');
    }
    if (!isObject(raw) || !(exactKeys(raw, ['body_weight', 'profile', 'settings']) || exactKeys(raw, ['body_weight', 'profile', 'settings', 'training']))) throw new ArchiveError('invalid-data');
    const base = { profile: parseProfile(raw['profile'], options.currentYear), weights: parseWeights(raw['body_weight']), settings: parseSettings(raw['settings']) };
    const read: ExportData = 'training' in raw ? { ...base, training: parseTraining(raw['training']) } : base;
    const data: ExportData = { ...read, archiveSv: manifest.sv };
    return { manifest, data, dataSha256 };
  });
}
