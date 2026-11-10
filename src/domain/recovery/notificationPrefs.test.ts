import { describe, expect, it } from 'vitest';
import { SETTINGS_DEFINITIONS } from '../model/settings';
import { DEFAULT_RECOVERY_NOTIFICATION_PREFS, parseBedtimeProposalSetting, parseRecoveryNotificationPrefs } from './notificationPrefs';

/** Réglages locaux des notifications de récupération (I5-02 point 2.3) : désactivés par défaut, lecture stricte, jamais publiés. */
describe('parseRecoveryNotificationPrefs', () => {
  it('absent, illisible ou d’une autre version : tout désactivé', () => {
    for (const raw of [null, undefined, 42, 'x', [], { v: 2, bedtime: true }, { bedtime: true }]) expect(parseRecoveryNotificationPrefs(raw)).toEqual({ v: 1, bedtime: false, morning: false });
    expect(DEFAULT_RECOVERY_NOTIFICATION_PREFS).toEqual({ v: 1, bedtime: false, morning: false });
  });
  it('relit les deux interrupteurs ; un champ non booléen reste désactivé', () => {
    expect(parseRecoveryNotificationPrefs({ v: 1, bedtime: true, morning: true })).toEqual({ v: 1, bedtime: true, morning: true });
    expect(parseRecoveryNotificationPrefs({ v: 1, bedtime: 'oui', morning: true })).toEqual({ v: 1, bedtime: false, morning: true });
  });
});

describe('parseBedtimeProposalSetting', () => {
  it('relit un jour et une heure, ou « pas encore » (heure null)', () => {
    expect(parseBedtimeProposalSetting({ v: 1, day: '2026-11-10', time: '23:00' })).toEqual({ v: 1, day: '2026-11-10', time: '23:00' });
    expect(parseBedtimeProposalSetting({ v: 1, day: '2026-11-10', time: null })).toEqual({ v: 1, day: '2026-11-10', time: null });
  });
  it('valeur illisible : null (aucune proposition connue), jamais une heure inventée', () => {
    for (const raw of [null, {}, { v: 1, day: 'x', time: '23:00' }, { v: 1, day: '2026-11-10', time: '25:99' }, { v: 3, day: '2026-11-10', time: '23:00' }]) expect(parseBedtimeProposalSetting(raw)).toBeNull();
  });
});

describe('déclaration des réglages', () => {
  it('deux réglages LOCAUX (jamais publiés par la synchro), sans migration', () => {
    expect(SETTINGS_DEFINITIONS['recovery.notificationPrefs']).toEqual({ scope: 'local', defaultValue: null });
    expect(SETTINGS_DEFINITIONS['recovery.bedtimeProposal']).toEqual({ scope: 'local', defaultValue: null });
  });
});
