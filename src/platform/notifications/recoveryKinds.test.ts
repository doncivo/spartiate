import { describe, expect, it } from 'vitest';
import { parseNotificationLedger } from '../../domain/notificationLedger';
import type { LocalDateTime } from '../../domain/types';
import { createFakeNotificationScheduler } from './fake';
import { NOTIFICATION_KINDS } from './types';
import { validateRequests } from './validate';

/** I5-02 point 2.3 : natures « coucher » et « matin » dans le contrat, la validation, le faux et le registre. */
const req = (kind: 'bedtime' | 'morning', id: string, fireAt: string) => ({ id, fireAt: fireAt as LocalDateTime, title: 'Spartiate', body: 'texte', kind });

describe('natures bedtime et morning', () => {
  it('sont déclarées et acceptées par la validation commune', () => {
    expect(NOTIFICATION_KINDS).toContain('bedtime');
    expect(NOTIFICATION_KINDS).toContain('morning');
    expect(() => validateRequests([req('bedtime', 'bedtime:2026-11-10', '2026-11-10T22:30'), req('morning', 'morning:2026-11-10', '2026-11-10T08:00')])).not.toThrow();
  });
  it('le faux les planifie une fois (replace idempotent) et le registre les relit', async () => {
    const fake = createFakeNotificationScheduler();
    const plan = [req('morning', 'morning:2026-11-10', '2026-11-10T08:00'), req('bedtime', 'bedtime:2026-11-10', '2026-11-10T22:30')];
    expect(await fake.replace(plan)).toMatchObject({ scheduled: 2 });
    expect(await fake.replace(plan)).toMatchObject({ scheduled: 0, kept: 2 });
    const ledger = { v: 1, zone: null, focusEnd: null, entries: [{ n: 70000, sid: 'bedtime:2026-11-10', at: 1, h: 'ab', kind: 'bedtime' }, { n: 70001, sid: 'morning:2026-11-10', at: 2, h: 'cd', kind: 'morning' }] };
    expect(parseNotificationLedger(ledger).state).toBe('valid');
  });
});
