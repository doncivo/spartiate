import type { SyncValue } from '../../domain/sync/format';
import { MODIFIED_MARKER } from '../../domain/sync/merge';
import type { SyncColumn, SyncTable } from '../../domain/sync/syncTables';
import type { DeviceId } from '../../domain/types';
import { t, tDynamic, type MessageKey } from '../../i18n';
import { tBody } from '../../i18n/bodyText';
import { formatDayMonth, formatTime } from '../../i18n/format';
import type { SyncStatus } from '../../platform/sync/types';
import type { ConflictSideView, ConflictView, RestoreRefusal, RestoreResult } from './syncConflictUseCases';
import { APPLE_REMINDERS_DEVICE } from '../../domain/appleReminders';
import { deviceName, formatSyncTime } from './syncText';

/**
 * Textes du journal des conflits (Y-04 critères 1 à 4 ; ADR 0011 §4.3 ; decisions.md Y-04 D1) : champ par sa clé
 * `sync.field.<table>.<colonne>`, valeurs formatées par le type de colonne du catalogue, appareils nommés comme dans APPAREILS,
 * heure locale de chaque valeur tirée de son hlc, dates « 22 sept. ».
 */

/** Longueur maximale d'un texte affiché (D1) ; au-delà, « … ». */
export const CONFLICT_TEXT_MAX = 80;

/** Clé i18n du nom d'un champ (le test de parité vérifie chaque colonne `conflictVisible`). */
export const fieldKey = (table: Pick<SyncTable, 'name'>, column: Pick<SyncColumn, 'name'>): string => `sync.field.${table.name}.${column.name}`;

export function fieldLabel(table: Pick<SyncTable, 'name'>, column: Pick<SyncColumn, 'name'>): string {
  return tDynamic(fieldKey(table, column) as MessageKey);
}

/** Texte entre les guillemets de la langue (`sync.conflicts.quoted`), tronqué à 80 caractères (points de code, jamais une moitié d'emoji). */
export function quoted(text: string): string {
  const chars = Array.from(text);
  const shown = chars.length > CONFLICT_TEXT_MAX ? `${chars.slice(0, CONFLICT_TEXT_MAX).join('')}…` : text;
  return t('sync.conflicts.quoted', { text: shown });
}

/** Libellés d'énumération déjà présents dans `src/i18n` ; sinon la valeur brute (D1). */
const ENUM_LABELS: Readonly<Record<string, Readonly<Record<string, MessageKey>>>> = {
  'task.status': { todo: 'sync.conflicts.values.todo', done: 'sync.conflicts.values.done' },
  'event.kind': { event: 'events.sheet.kindEvent', birthday: 'events.sheet.kindBirthday', important: 'events.sheet.kindImportant' },
  'event.repeat': { once: 'events.sheet.repeatOnce', monthly: 'events.sheet.repeatMonthly', yearly: 'events.sheet.repeatYearly' },
  'reminder.target_type': { task: 'events.segments.task', routine: 'events.segments.routine', event: 'events.segments.event' },
  'holiday.country': { FR: 'events.holidayCountry.FR', TN: 'events.holidayCountry.TN' },
};

/** Profil (0.1.4) : mêmes libellés que l'écran Profil et poids. */
const BODY_ENUMS: Readonly<Record<string, Readonly<Record<string, Parameters<typeof tBody>[0]>>>> = {
  'profile.sex': { male: 'sexMale', female: 'sexFemale' },
  'profile.goal': { gain: 'goalGain', loss: 'goalLoss', maintain: 'goalMaintain' },
  'profile.experience': { beginner: 'experienceBeginner', intermediate: 'experienceIntermediate', advanced: 'experienceAdvanced' },
};

const has = (record: object, key: string): boolean => Object.prototype.hasOwnProperty.call(record, key);

function enumLabel(table: SyncTable, column: SyncColumn, value: string): string {
  const id = `${table.name}.${column.name}`;
  if (id === 'profile.units') return value === 'metric' ? t('sync.conflicts.values.unitsMetric') : value;
  if (id === 'body_weight.source') return value === 'health' ? t('sync.conflicts.values.sourceHealth') : value === 'manual' ? t('sync.conflicts.values.sourceManual') : value;
  const body = has(BODY_ENUMS, id) ? BODY_ENUMS[id] : undefined;
  if (body && has(body, value)) return tBody(body[value] as Parameters<typeof tBody>[0]);
  const labels = has(ENUM_LABELS, id) ? ENUM_LABELS[id] : undefined;
  const key = labels && has(labels, value) ? labels[value] : undefined;
  return key ? tDynamic(key) : value;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Date civile locale d'un instant (« 2026-09-22 »). */
function localDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getFullYear())}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Valeur d'un côté du conflit, formatée selon le type de la colonne (critère 3). */
export function conflictValueText(table: SyncTable, column: SyncColumn, side: Pick<ConflictSideView, 'value' | 'ref'>, nowMs: number): string {
  const value: SyncValue = side.value;
  if (column.name === 'deleted_at') {
    if (value === null) return t('sync.conflicts.values.present');
    return value === MODIFIED_MARKER ? t('sync.conflicts.values.modified') : t('sync.conflicts.values.deleted');
  }
  if (value === null) return column.name === 'project_id' ? t('sync.conflicts.values.noProject') : t('sync.conflicts.values.empty');
  const own = `${table.name}.${column.name}`;
  if (typeof value === 'string' && (has(BODY_ENUMS, own) || own === 'profile.units')) return enumLabel(table, column, value);
  if (typeof value === 'number') {
    if (own === 'body_weight.kg') return t('sync.conflicts.values.kg', { value: new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value) });
    if (own === 'profile.height_cm') return t('sync.conflicts.values.cm', { value: new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value) });
    if (own === 'profile.birth_year') return String(value);
  }
  switch (column.type) {
    case 'text':
    case 'json':
      return quoted(String(value));
    case 'id':
      return side.ref !== null ? quoted(side.ref) : String(value);
    case 'date':
      return typeof value === 'string' ? formatDayMonth(value) : String(value);
    case 'time':
      return typeof value === 'string' ? formatTime(value.slice(0, 5)) : String(value);
    case 'datetime':
      return typeof value === 'string' ? formatSyncTime(value, nowMs) : String(value);
    case 'localdatetime':
      return typeof value === 'string' ? `${formatDayMonth(value.slice(0, 10))} ${formatTime(value.slice(11, 16))}` : String(value);
    case 'bool':
      return value === 1 ? t('sync.conflicts.values.yes') : t('sync.conflicts.values.no');
    case 'int':
    case 'real':
      return typeof value === 'number' ? new Intl.NumberFormat('fr-FR').format(value) : String(value);
    case 'enum':
      return enumLabel(table, column, String(value));
  }
}

/** Nom d'un appareil comme dans APPAREILS ; un appareil devenu inconnu : « Autre appareil » (critère 3). */
export function conflictDeviceName(device: DeviceId | string, devices: SyncStatus['devices']): string {
  // K-06 (ADR 0008 §10.5) : la valeur perdue ou gardée côté Rappels Apple porte l'appareil fictif `apple-reminders`.
  if (device === APPLE_REMINDERS_DEVICE) return t('sync.conflicts.appleReminders');
  const known = devices.find((d) => d.deviceId === device);
  return known ? deviceName(known, devices) : t('sync.conflicts.otherDevice');
}

/** « iPhone · 18:04 » : appareil et heure locale de la valeur (son hlc). */
export function conflictSideMeta(side: Pick<ConflictSideView, 'device' | 'at'>, devices: SyncStatus['devices'], nowMs: number): string {
  return t('sync.conflicts.side', { device: conflictDeviceName(side.device, devices), time: formatSyncTime(side.at, nowMs) });
}

/** Titre de l'élément lu au moment de l'affichage ; supprimé ou purgé : « Élément supprimé » ; sans titre propre : type d'élément. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function conflictTitle(view: Pick<ConflictView, 'title' | 'itemState' | 'table'>): string {
  if (view.itemState !== 'live') return t('sync.conflicts.deletedItem');
  if (view.table.name === 'body_weight' && view.title !== null && DAY.test(view.title)) return t('sync.conflicts.weightHeading', { date: formatDayMonth(view.title) });
  if (view.title !== null) return view.title;
  if (view.table.name === 'profile') return t('sync.conflicts.kinds.profile');
  if (view.table.name === 'body_weight') return t('sync.conflicts.weightGone');
  if (view.table.name === 'recurrence') return t('sync.conflicts.kinds.recurrence');
  if (view.table.name === 'settings') return t('sync.conflicts.kinds.settings');
  return t('sync.conflicts.kinds.other');
}

/**
 * Titre d'un conflit (UI-REFONTE-04, Synchro-v4.html) : « Heure prévue de « Envoyer la facture » » : champ (initiale en capitale) puis titre
 * entre guillemets, tronqué à 80 caractères ; élément disparu : « Date de « Élément supprimé » ».
 */
export function conflictHeading(view: Pick<ConflictView, 'title' | 'itemState' | 'table'>, names: { readonly title: string; readonly field: string }): string {
  if (view.table.name === 'profile') return t('sync.conflicts.profileHeading', { field: names.field });
  if (view.table.name === 'body_weight') {
    if (view.itemState !== 'live' || view.title === null || !DAY.test(view.title)) return t('sync.conflicts.weightGone');
    const date = formatDayMonth(view.title);
    return names.field === fieldLabel(view.table, { name: 'kg' }) ? t('sync.conflicts.weightHeading', { date }) : t('sync.conflicts.weightHeadingField', { date, field: names.field });
  }
  const field = names.field.charAt(0).toLocaleUpperCase('fr-FR') + names.field.slice(1);
  const title = view.itemState === 'live' && view.title !== null ? quoted(names.title) : names.title;
  return t('sync.conflicts.heading', { field, title });
}

/** Date de détection (« 22 sept. »). */
export const conflictDate = (iso: string): string => formatDayMonth(localDate(iso));

/** « Restaurée le 22 sept. » (D2). */
export const restoredOnText = (iso: string): string => t('sync.conflicts.restoredOn', { date: formatDayMonth(localDate(iso)) });

/** Texte d'un refus (critère 8, exigence d'Ali : montré à l'endroit de l'action). */
export function refusalText(reason: RestoreRefusal): string {
  switch (reason) {
    case 'row-gone':
      return t('sync.conflicts.result.rowGone');
    case 'parent-gone':
      return t('sync.conflicts.result.parentGone');
    case 'invalid':
      return t('sync.conflicts.result.invalid');
  }
}

/** Texte annoncé après « Restaurer » (`role="status"`, critère 14). */
export function restoreResultText(result: RestoreResult, names: { readonly title: string; readonly field: string }): string {
  switch (result.status) {
    case 'restored':
      return t('sync.conflicts.result.restored', names);
    case 'already':
      return t('sync.conflicts.result.already');
    case 'refused':
      return refusalText(result.reason);
    case 'failed':
      return t('sync.conflicts.result.failed');
  }
}
