import { SETTINGS_DEFINITIONS, type SettingKey } from '../../../src/domain/model/settings';
import { createCatalogue, kit, type SettingKeyScope, type SyncCatalogue, type SyncTable, type TitleSource } from '../../../src/domain/sync/syncTables';
import { createSqlRepositoriesFor, type SyncStorage } from '../../../src/db/repositories';
import type { SyncDeps } from '../../../src/sync/deps';
import { legacyRepairs } from './repairs';
import { isNaturalId, expectedNaturalId, type NaturalIdTable } from './naturalIds';

/**
 * Ancien catalogue de synchro (dix-neuf migrations CircleTasks), pour le banc de test uniquement (D-67) : le moteur le reçoit par
 * injection, comme le catalogue I0 en production. Aucun fichier de src/ (hors tests) n'importe ce module.
 */

const { c, hidden, bool, createdAt, deletedAt } = kit;
const baseTable = kit.table;

const NATURAL: Readonly<Record<string, NaturalIdTable>> = { routine_log: 'routine_log', holiday: 'holiday' };
const table = (name: string, columns: SyncTable['columns'], options: Parameters<typeof baseTable>[2] = {}): SyncTable => {
  const kind = NATURAL[name];
  const base = baseTable(name, columns, options);
  return kind ? { ...base, natural: { is: (id) => isNaturalId(kind, id), expected: (row) => expectedNaturalId(kind, row), uuidFallback: true } } : base;
};

const LONG_TEXT = 200 * 1_024;

/** Catalogue, dans l'ordre topologique des tables (section 3.3). */
const BASE_TABLES: readonly SyncTable[] = [
  table('space', [c('name', 'text', false), c('color', 'text', false, { max: 16 }), c('sort_order', 'real', false, hidden), c('quiet_hours', 'json', false), createdAt, deletedAt]),
  table(
    'project',
    [c('space_id', 'id', false), c('name', 'text', false), c('color', 'text', false, { max: 16 }), bool('archived'), c('sort_order', 'real', false, hidden), createdAt, deletedAt],
    { parents: [{ column: 'space_id', table: 'space' }] },
  ),
  table('recurrence', [
    c('freq', 'enum', false, { values: ['daily', 'weekly', 'monthly', 'yearly'] }),
    c('interval', 'int', false),
    c('weekdays', 'json', false),
    c('month_day', 'int', true),
    c('nth_weekday', 'text', true, { max: 64 }),
    c('until', 'text', true, { max: 64 }),
    c('count', 'int', true),
    createdAt,
    deletedAt,
  ]),
  table(
    'goal',
    [
      c('space_id', 'id', false),
      c('week_start', 'date', false),
      c('title', 'text', false),
      c('icon', 'text', true, { max: 256 }),
      bool('pinned'),
      c('status', 'enum', false, { values: ['open', 'achieved', 'closed'] }),
      c('carried_from_id', 'id', true),
      createdAt,
      deletedAt,
    ],
    {
      parents: [
        { column: 'space_id', table: 'space' },
        { column: 'carried_from_id', table: 'goal' },
      ],
    },
  ),
  table(
    'task',
    [
      c('space_id', 'id', false),
      c('project_id', 'id', true),
      c('title', 'text', false),
      c('note', 'text', false, { max: LONG_TEXT }),
      c('date', 'date', true),
      c('time', 'time', true),
      c('status', 'enum', false, { values: ['todo', 'done'] }),
      c('done_at', 'datetime', true, hidden),
      c('sort_order', 'real', false, hidden),
      bool('carried_over'),
      c('recurrence_id', 'id', true),
      c('series_index', 'int', true),
      c('goal_id', 'id', true),
      c('icon', 'text', true, { max: 256 }),
      bool('someday'),
      c('source', 'enum', false, { values: ['local', 'apple_reminders'] }),
      c('external_id', 'text', true, { max: 512 }),
      c('series_template', 'json', true, hidden),
      c('external_event_id', 'text', true, { max: 512 }),
      c('apple_list_id', 'text', true, { max: 512, ...hidden }),
      bool('apple_recurring', hidden),
      createdAt,
      deletedAt,
    ],
    {
      local: ['discarded'],
      parents: [
        { column: 'space_id', table: 'space' },
        { column: 'project_id', table: 'project' },
        { column: 'recurrence_id', table: 'recurrence' },
        { column: 'goal_id', table: 'goal' },
      ],
    },
  ),
  table(
    'routine',
    [
      c('space_id', 'id', false),
      c('title', 'text', false),
      c('icon', 'text', true, { max: 256 }),
      c('schedule_type', 'enum', false, { values: ['daily', 'weekdays', 'x_per_week', 'every_n_days', 'every_n_weeks'] }),
      c('weekdays', 'json', false),
      c('times_per_week', 'int', true),
      c('interval', 'int', true),
      c('start_date', 'date', false),
      c('time', 'time', true),
      bool('archived'),
      createdAt,
      deletedAt,
    ],
    { local: ['paused'], parents: [{ column: 'space_id', table: 'space' }] },
  ),
  table('routine_log', [c('routine_id', 'id', false), c('date', 'date', false), c('done_at', 'datetime', false, hidden), createdAt, deletedAt], {
    idKind: 'natural',
    parents: [{ column: 'routine_id', table: 'routine' }],
  }),
  table('routine_pause', [c('routine_id', 'id', false), c('from_date', 'date', false), c('to_date', 'date', true), createdAt, deletedAt], {
    parents: [{ column: 'routine_id', table: 'routine' }],
  }),
  table('reminder', [
    c('target_type', 'enum', false, { values: ['task', 'routine', 'event'] }),
    c('target_id', 'id', false),
    c('offset_min', 'int', false, { values: [0, 5, 15, 30, 60, 1440, 10080] }),
    c('fire_at', 'localdatetime', false, hidden),
    c('delivered', 'bool', false, hidden),
    createdAt,
    deletedAt,
  ]),
  table(
    'event',
    [
      c('space_id', 'id', false),
      c('title', 'text', false),
      c('start_date', 'date', false),
      c('start_time', 'time', true),
      c('end_date', 'date', false),
      c('end_time', 'time', true),
      bool('all_day'),
      c('kind', 'enum', false, { values: ['event', 'birthday', 'important'] }),
      c('repeat', 'enum', false, { values: ['once', 'monthly', 'yearly'] }),
      bool('important'),
      c('icon', 'text', true, { max: 256 }),
      c('birth_year', 'int', true),
      createdAt,
      deletedAt,
    ],
    { parents: [{ column: 'space_id', table: 'space' }] },
  ),
  table(
    'checklist',
    [c('space_id', 'id', false), c('title', 'text', false), c('date', 'date', true), bool('is_template'), c('icon', 'text', true, { max: 256 }), createdAt, deletedAt],
    { parents: [{ column: 'space_id', table: 'space' }] },
  ),
  table('checklist_item', [c('checklist_id', 'id', false), c('text', 'text', false), bool('checked'), c('sort_order', 'real', false, hidden), createdAt, deletedAt], {
    parents: [{ column: 'checklist_id', table: 'checklist' }],
  }),
  table(
    'focus_session',
    [
      c('task_id', 'id', true),
      c('space_id', 'id', false),
      c('planned_min', 'int', true),
      c('started_at', 'datetime', false),
      c('ended_at', 'datetime', true),
      c('paused_sec', 'int', false, hidden),
      c('paused_at', 'datetime', true, hidden),
      c('project_id', 'id', true),
      createdAt,
      deletedAt,
    ],
    { parents: [{ column: 'space_id', table: 'space' }] },
  ),
  table('calendar_account', [c('provider', 'enum', false, { values: ['google', 'icloud'] }), c('label', 'text', false, { max: 512 }), c('calendars', 'json', false), createdAt, deletedAt], {
    local: ['token_ref', 'username'],
  }),
  table(
    'holiday',
    [
      c('country', 'enum', false, { values: ['FR', 'TN'] }),
      c('year', 'int', false),
      c('key', 'text', false, { max: 64 }),
      c('date', 'date', false),
      c('name', 'text', false, { max: 256 }),
      c('kind', 'enum', false, { values: ['fixed', 'computed', 'lunar'] }),
      c('source', 'enum', false, { values: ['table', 'manual'] }),
      bool('overridden'),
      createdAt,
      deletedAt,
    ],
    { idKind: 'natural' },
  ),
  table('settings', [c('value', 'json', false)], { key: 'key', idKind: 'setting', purgeable: false }),
];


const TITLE_SOURCES: Readonly<Record<string, TitleSource>> = {
  space: { kind: 'own', column: 'name' },
  project: { kind: 'own', column: 'name' },
  recurrence: { kind: 'none' },
  goal: { kind: 'own', column: 'title' },
  task: { kind: 'own', column: 'title' },
  routine: { kind: 'own', column: 'title' },
  routine_log: { kind: 'parent', column: 'routine_id', table: 'routine' },
  routine_pause: { kind: 'parent', column: 'routine_id', table: 'routine' },
  reminder: { kind: 'reminder' },
  event: { kind: 'own', column: 'title' },
  checklist: { kind: 'own', column: 'title' },
  checklist_item: { kind: 'own', column: 'text' },
  focus_session: { kind: 'parent', column: 'task_id', table: 'task' },
  calendar_account: { kind: 'own', column: 'label' },
  holiday: { kind: 'own', column: 'name' },
  settings: { kind: 'none' },
};

const LEGACY_TABLES: readonly SyncTable[] = BASE_TABLES.map((t) => ({ ...t, titleSource: TITLE_SOURCES[t.name] ?? { kind: 'none' } }));

/** Clés de réglage de portée `shared`, triées : les seules publiées dans l'ancien schéma. */
/** `general.locale` n'est plus un réglage de l'app (français seul) mais reste partagé dans l'ancien schéma : le banc le garde. */
const LEGACY_ONLY_SHARED: readonly string[] = ['general.locale'];
export const SHARED_SETTING_KEYS: readonly string[] = [...(Object.keys(SETTINGS_DEFINITIONS) as SettingKey[]).filter((key) => SETTINGS_DEFINITIONS[key].scope === 'shared'), ...LEGACY_ONLY_SHARED].sort();

export function settingKeyScope(key: string): SettingKeyScope {
  if (LEGACY_ONLY_SHARED.includes(key)) return 'shared';
  if (!Object.prototype.hasOwnProperty.call(SETTINGS_DEFINITIONS, key)) return 'unknown';
  return SETTINGS_DEFINITIONS[key as SettingKey].scope;
}

/** Identifiants fixes des espaces Pro et Perso (gravés dans l'ancienne migration 0001). */
export const FIXED_SPACE_IDS: ReadonlySet<string> = new Set(['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']);

export const LEGACY_SYNC_CATALOGUE: SyncCatalogue = createCatalogue({
  tables: LEGACY_TABLES,
  order: LEGACY_TABLES.map((t) => t.name),
  fixedIds: { space: FIXED_SPACE_IDS },
  settingScope: settingKeyScope,
  rules: { repairs: (deps, touched) => legacyRepairs(deps as SyncDeps, touched), dropExternalEventsOn: ['calendar_account'], reattachOnPurge: ['project'], companion: { table: 'reminder', typeColumn: 'target_type', idColumn: 'target_id', targets: ['task', 'routine', 'event'] } },
  extraId: (value) => isNaturalId('routine_log', value) || isNaturalId('holiday', value),
});

/** Repositories SQL branchés sur l'ancien catalogue (banc de synchro). */
export const createLegacyRepositories = createSqlRepositoriesFor(LEGACY_SYNC_CATALOGUE);

// ---------------------------------------------------------------------------------------------------------------------------------
// Fonctions de recherche sur l'ancien catalogue (reprise des anciennes exportations de syncTables.ts, pour les tests du banc)
// ---------------------------------------------------------------------------------------------------------------------------------

export const SYNC_TABLES: readonly SyncTable[] = LEGACY_SYNC_CATALOGUE.tables;
export const syncTable = LEGACY_SYNC_CATALOGUE.table;
export const syncColumn = LEGACY_SYNC_CATALOGUE.column;
export const childRelations = LEGACY_SYNC_CATALOGUE.childRelations;
export const tableRank = LEGACY_SYNC_CATALOGUE.rank;
export const isPurgeable = LEGACY_SYNC_CATALOGUE.isPurgeable;
export const isValidRowId = LEGACY_SYNC_CATALOGUE.isValidRowId;

/** Stockage du banc : l'ancien catalogue et ses repositories, ensemble (`bootstrapApp({ storage })`). */
export const LEGACY_STORAGE: SyncStorage = { catalogue: LEGACY_SYNC_CATALOGUE, repositories: createLegacyRepositories };
