import { afterEach, describe, expect, it } from 'vitest';
import { parseConfigOverrides } from '../../parse/configOverridesJson';
import type { DeviceId } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/** DATA-0293 (§ 11, D-510, D-566) : surcharges par exercice, stockées dans `progression_profile.config_overrides` (JSON validé à l'écriture et à la lecture). */
const DEVICE = '60000000-0000-4000-8000-000000000293' as DeviceId;
let db: TestDb;
afterEach(async () => db.close());
const repo = () => db.data.repos.progression();

describe('parseConfigOverrides (écrit à la main, ADR 0008)', () => {
  it('garde les clés connues dans leurs bornes ; ignore le reste sans erreur', () => {
    expect(parseConfigOverrides('{"deloadLoad":0.9,"stallSessions":4}')).toEqual({ deloadLoad: 0.9, stallSessions: 4 });
    expect(parseConfigOverrides('{"deloadLoad":0.2,"stallSessions":2.5,"inconnue":1,"fatigueDrop":"x"}')).toEqual({});
    for (const bad of [null, '', 'pas du json', '[1]', '"x"', '3', 'null']) expect(parseConfigOverrides(bad)).toEqual({});
  });
});

describe('ProgressionRepository : surcharges par exercice', () => {
  it('sans ligne ni surcharge : objet vide ; écriture puis relecture ; effacement', async () => {
    db = await openBaseDb(DEVICE);
    expect(await repo().configOverrides('squat')).toEqual({});
    await db.data.transaction(async (r) => (await r.progression()).saveConfigOverrides('squat', { deloadLoad: 0.9, maxGainPerSession: 0.05 }));
    expect(await repo().configOverrides('squat')).toEqual({ deloadLoad: 0.9, maxGainPerSession: 0.05 });
    await db.data.transaction(async (r) => (await r.progression()).saveConfigOverrides('squat', {}));
    expect(await repo().configOverrides('squat')).toEqual({});
    expect(await db.driver.select('SELECT config_overrides FROM progression_profile')).toEqual([{ config_overrides: null }]);
  });

  it('une valeur hors bornes, non entière ou une clé inconnue est refusée (rien n’est écrit)', async () => {
    db = await openBaseDb(DEVICE);
    for (const bad of [{ deloadLoad: 0.2 }, { stallSessions: 2.5 }, { maxGainPerSession: 0.5 }, { inconnue: 1 }, { deloadLoad: Number.NaN }]) {
      await expect(db.data.transaction(async (r) => (await r.progression()).saveConfigOverrides('squat', bad as never)), JSON.stringify(bad)).rejects.toMatchObject({ code: 'invalid' });
    }
    expect(await db.driver.select('SELECT 1 FROM progression_profile')).toEqual([]);
  });

  it('un recalcul du profil (saveProfile) ne touche pas aux surcharges', async () => {
    db = await openBaseDb(DEVICE);
    await db.data.transaction(async (r) => (await r.progression()).saveConfigOverrides('squat', { deloadLoad: 0.9 }));
    await db.data.transaction(async (r) => (await r.progression()).saveProfile({ exerciseId: 'squat', estimated1rmKg: 120, confidence: 0.8, lastEasyRecalibrationAt: null, engineVersion: 3 }));
    expect(await repo().configOverrides('squat')).toEqual({ deloadLoad: 0.9 });
  });

  it('texte illisible stocké (autre appareil) : lu comme vide, jamais d’exception', async () => {
    db = await openBaseDb(DEVICE);
    await db.data.transaction(async (r) => (await r.progression()).saveConfigOverrides('squat', { deloadLoad: 0.9 }));
    await db.driver.execute("UPDATE progression_profile SET config_overrides = '{oups'");
    expect(await repo().configOverrides('squat')).toEqual({});
  });

  it('la modification est capturée pour la synchro (champ config_overrides)', async () => {
    db = await openBaseDb(DEVICE);
    await db.data.transaction(async (r) => (await r.progression()).saveProfile({ exerciseId: 'squat', estimated1rmKg: 100, confidence: 0.5, lastEasyRecalibrationAt: null, engineVersion: 3 }));
    await db.driver.execute("DELETE FROM sync_outbox WHERE table_name = 'progression_profile'");
    await db.data.transaction(async (r) => (await r.progression()).saveConfigOverrides('squat', { deloadLoad: 0.9 }));
    expect(await db.driver.select("SELECT field FROM sync_outbox WHERE table_name = 'progression_profile'")).toEqual([{ field: 'config_overrides' }]);
  });
});
