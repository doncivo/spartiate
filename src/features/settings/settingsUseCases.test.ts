import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isSharedSetting } from '../../domain/model';
import { asEntityId, type DeviceId } from '../../domain/types';
import { openTestDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { createSettingsUseCases } from './settingsUseCases';

const DEVICE = asEntityId<DeviceId>('30000000-0000-4000-8000-0000000000c5');

describe('cas d’usage des réglages (apparence, formats, thème)', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await openTestDb(DEVICE);
  });
  afterEach(() => db.close());

  it('P-03 : premier jour et format d’heure, lundi et 24 h par défaut, écrits comme réglages partagés', async () => {
    const useCases = createSettingsUseCases(db);
    expect(await useCases.loadFormats()).toEqual({ firstWeekday: 'monday', timeFormat: '24h' });
    await useCases.setFirstWeekday('sunday');
    await useCases.setTimeFormat('12h');
    expect(await useCases.loadFormats()).toEqual({ firstWeekday: 'sunday', timeFormat: '12h' });
    expect(isSharedSetting('general.firstWeekday')).toBe(true);
    expect(isSharedSetting('general.timeFormat')).toBe(true);
  });

  it('P-02 : thème local, système par défaut, valeur inconnue retombant sur système', async () => {
    const useCases = createSettingsUseCases(db);
    expect(await useCases.loadTheme()).toBe('system');
    await useCases.setTheme('dark');
    expect(await useCases.loadTheme()).toBe('dark');
    expect(isSharedSetting('ui.theme')).toBe(false);
    await db.data.repos.settings.set('ui.theme', 'sepia' as never);
    expect(await useCases.loadTheme()).toBe('system');
  });

  it('P-03 : une valeur inconnue (version future) retombe sur le défaut', async () => {
    await db.data.repos.settings.set('general.firstWeekday', 'friday' as never);
    await db.data.repos.settings.set('general.timeFormat', '36h' as never);
    expect(await createSettingsUseCases(db).loadFormats()).toEqual({ firstWeekday: 'monday', timeFormat: '24h' });
  });
});
