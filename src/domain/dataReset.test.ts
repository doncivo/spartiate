import { describe, expect, it } from 'vitest';
import { DATA_RESET_TABLE, RESET_CONFIRMATION_WORD, RESET_SETTINGS, RESET_TABLES, isArchiveBeforeReset, isBeforeReset, isResetConfirmed, laterHorizon, wipedSettingKeys } from './dataReset';
import { TRAINING_EXPORT_TABLES } from './exportImport/archive';
import { FULL_EXPORT_EXCLUDED } from './exportImport/fullExport';
import { SETTINGS_DEFINITIONS, type SettingKey } from './model/settings';
import { SYNC_CATALOGUE } from './sync/syncTables';
import type { Hlc } from './types';

/** RESET-01 (D-180 à D-186) : règles pures de « Repartir de zéro ». */
const DEV = '0f8fad5b-d9cb-469f-a165-70867728950e';
const h = (ms: number): Hlc => `${String(ms).padStart(15, '0')}-0000-${DEV}` as Hlc;

describe('confirmation : le mot EFFACER, rien d’autre (D-182)', () => {
  it('accepte EFFACER (espaces autour tolérés), refuse tout le reste', () => {
    expect(RESET_CONFIRMATION_WORD).toBe('EFFACER');
    for (const ok of ['EFFACER', ' EFFACER ', 'EFFACER\n']) expect(isResetConfirmed(ok), JSON.stringify(ok)).toBe(true);
    for (const bad of ['', ' ', 'effacer', 'Effacer', 'EFFACE', 'EFFACER !', 'EFFACERR', 'OUI', 'E F F A C E R']) expect(isResetConfirmed(bad), JSON.stringify(bad)).toBe(false);
  });
});

describe('sort des tables et des réglages (D-181)', () => {
  it('toute table publiée est effacée, sauf data_reset (gardée : c’est l’horizon)', () => {
    for (const t of SYNC_CATALOGUE.tables) expect(RESET_TABLES[t.name], t.name).toBe(t.name === DATA_RESET_TABLE ? 'kept' : 'wiped');
  });

  it('réglages, technique de synchro et registre des migrations gardés ; données locales effacées', () => {
    for (const kept of ['settings', 'schema_migrations', 'sync_state', 'sync_meta', 'sync_outbox', 'sync_field_clock', 'sync_guard', 'sync_tombstone', 'sync_unknown', 'sync_parked']) expect(RESET_TABLES[kept], kept).toBe('kept');
    for (const wiped of ['progress_photo_file', 'recovery_sample', 'recovery_import_state', 'conflict_log', 'epoch_carry_report']) expect(RESET_TABLES[wiped], wiped).toBe('wiped');
  });

  it('chaque réglage connu est classé ; aucune clé inconnue', () => {
    expect(Object.keys(RESET_SETTINGS).sort()).toEqual(Object.keys(SETTINGS_DEFINITIONS).sort());
  });

  it('gardés : apparence, notifications, identité, verrou, raccourcis ; effacés : onboarding, objectifs, séance, matériel actif, imports Santé', () => {
    const kept: SettingKey[] = ['ui.theme', 'general.theme', 'general.firstWeekday', 'general.timeFormat', 'device.id', 'security.appLock', 'notifications.ledger', 'notifications.status', 'recovery.notificationPrefs', 'shortcut.quickCapture', 'training.restSeconds'];
    for (const key of kept) expect(RESET_SETTINGS[key], key).toBe('kept');
    const wiped: SettingKey[] = ['onboarding.completed', 'onboarding.draft', 'onboarding.answers', 'nutrition.prefs', 'training.activeEquipmentProfile', 'training.cycleSession', 'training.redDay', 'healthBody.lastImport', 'bodyProgress.hiddenPhotos', 'recovery.bedtimeProposal'];
    for (const key of wiped) expect(RESET_SETTINGS[key], key).toBe('wiped');
    expect(wipedSettingKeys()).toEqual((Object.keys(RESET_SETTINGS) as SettingKey[]).filter((k) => RESET_SETTINGS[k] === 'wiped'));
  });
});

describe('export et import (D-187)', () => {
  it('data_reset n’est jamais exportée (ni archive, ni export complet)', () => {
    expect(TRAINING_EXPORT_TABLES as readonly string[]).not.toContain(DATA_RESET_TABLE);
    expect(FULL_EXPORT_EXCLUDED as readonly string[]).toContain(DATA_RESET_TABLE);
  });

  it('archive datée avant ou à l’instant de l’effacement : refusée ; après, ou aucun effacement : admise ; date illisible : refusée', () => {
    const at = Date.parse('2026-11-20T08:00:00.000Z');
    expect(isArchiveBeforeReset('2026-11-20T07:59:59.999Z', at)).toBe(true);
    expect(isArchiveBeforeReset('2026-11-20T08:00:00.000Z', at)).toBe(true);
    expect(isArchiveBeforeReset('2026-11-20T08:00:00.001Z', at)).toBe(false);
    expect(isArchiveBeforeReset('2026-10-05T08:00:00.000Z', null)).toBe(false);
    expect(isArchiveBeforeReset('pas une date', at)).toBe(true);
  });
});

describe('horizon (ADR 0011 avenant 36)', () => {
  it('un champ écrit avant, ou fondé sur une valeur d’avant, est antérieur ; écrit après sur une base d’après : non', () => {
    const H = h(1_000);
    expect(isBeforeReset([1, h(999), null], H)).toBe(true);
    expect(isBeforeReset([1, H, null], H)).toBe(true);
    expect(isBeforeReset([1, h(2_000), h(500)], H)).toBe(true);
    expect(isBeforeReset([1, h(2_000), H], H)).toBe(true);
    expect(isBeforeReset([1, h(2_000), null], H)).toBe(false);
    expect(isBeforeReset([1, h(2_000), h(1_500)], H)).toBe(false);
  });

  it('le plus grand des horizons, null ignoré', () => {
    expect(laterHorizon(null, null)).toBeNull();
    expect(laterHorizon(h(1), null)).toBe(h(1));
    expect(laterHorizon(null, h(2))).toBe(h(2));
    expect(laterHorizon(h(3), h(2))).toBe(h(3));
  });
});
