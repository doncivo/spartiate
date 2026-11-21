import { describe, expect, it } from 'vitest';
import { createFakeNotificationScheduler } from '../platform/notifications/fake';
import { NOTIFICATION_KINDS } from '../platform/notifications/types';
import { validateRequests } from '../platform/notifications/validate';
import { parseNotificationLedger } from './notificationLedger';
import type { LocalDateTime } from './types';

/** BLESSURES-b : nature « injury » dans le contrat, la validation, le faux et le registre (modèle recoveryKinds.test.ts). */
const req = { id: 'injury:2026-11-15', fireAt: '2026-11-15T09:00' as LocalDateTime, title: 'Spartiate', body: 'texte', kind: 'injury' as const };

describe('nature injury', () => {
  it('est déclarée et acceptée par la validation commune', () => {
    expect(NOTIFICATION_KINDS).toContain('injury');
    expect(() => validateRequests([req])).not.toThrow();
  });
  it('le faux la planifie une fois et le registre la relit', async () => {
    const fake = createFakeNotificationScheduler();
    expect(await fake.replace([req])).toMatchObject({ scheduled: 1 });
    expect(await fake.replace([req])).toMatchObject({ scheduled: 0, kept: 1 });
    const ledger = { v: 1, zone: null, focusEnd: null, entries: [{ n: 70000, sid: 'injury:2026-11-15', at: 1, h: 'ab', kind: 'injury' }] };
    expect(parseNotificationLedger(ledger).state).toBe('valid');
  });
});
