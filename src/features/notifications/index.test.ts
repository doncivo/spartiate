import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Revue I5-02 : seuls les échecs passent par le journal des échecs ; un succès n'y est jamais rangé. */
const logFailure = vi.fn();
vi.mock('../../platform/desktop/log', () => ({ logFailure: (...args: unknown[]) => logFailure(...args) }));
const captured: { log?: (code: string, data?: Record<string, number>) => void } = {};
vi.mock('./recoveryNotifications', () => ({
  createRecoveryNotificationService: (deps: { log: (code: string, data?: Record<string, number>) => void }) => {
    captured.log = deps.log;
    return {};
  },
}));

describe('journal des notifications de récupération', () => {
  beforeEach(() => logFailure.mockClear());
  it('un succès n’entre pas dans le journal des échecs ; un échec y entre, sans valeur', async () => {
    const { recoveryNotificationsFor } = await import('./index');
    recoveryNotificationsFor({ notifications: {}, notificationClock: {}, data: { repos: {} } } as never);
    captured.log?.('recovery-notifications-planned', { planned: 3, kept: 1 });
    expect(logFailure).not.toHaveBeenCalled();
    captured.log?.('recovery-notifications-failed', {});
    expect(logFailure).toHaveBeenCalledTimes(1);
  });
});
