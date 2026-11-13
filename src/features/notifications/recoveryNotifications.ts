import { bedtimeProposal, DEFAULT_RECOVERY_NOTIFICATION_PREFS, parseBedtimeProposalSetting, parseRecoveryNotificationPrefs, type NightRecord, type RecoveryNotificationPrefs } from '../../domain/recovery';
import { localDateTimeAt } from '../../domain/notificationInstant';
import { planRecoveryNotifications } from '../../domain/recoveryNotificationPlan';
import type { LocalDate } from '../../domain/types';
import type { SettingsRepository } from '../../db/repositories/settingsRepository';
import {
  NOTIFICATION_LIMIT,
  NotificationSchedulerError,
  type NotificationClock,
  type NotificationFailure,
  type NotificationRequest,
  type NotificationScheduler,
} from '../../platform/notifications';

/**
 * Notifications de récupération sur l'iPhone (I5-02 point 2.3, § 16.4, § 16.7) : coucher 30 min avant l'heure proposée, notification du matin
 * (une par jour au plus). DÉSACTIVÉES par défaut ; l'iPhone seul envoie (le planificateur vide du PC rend `unsupported`, rien n'est lu).
 *
 * - Le plan vient de `planRecoveryNotifications` (pur, sans texte) ; le texte est composé ici depuis le catalogue (neutre, sans valeur corporelle).
 * - `replace` remplace tout le plan : les notifications d'autres natures déjà en attente sont REPOSÉES telles quelles, et le plafond de 64
 *   (moins la fin de Focus et l'alerte de signature, `reservedCount`) est partagé : ce sont les nôtres qui se réduisent, jamais les autres.
 * - L'autorisation n'est jamais demandée ici, sauf `requestPermissionAndReplan` (geste de l'utilisateur) ; un refus ne relance rien.
 * - Les passages se suivent un à un ; aucune méthode ne rejette ; le journal ne reçoit que des codes et des nombres.
 */

export type RecoveryNotificationStatus = 'unsupported' | 'off' | 'permission' | 'no-zone' | 'planned' | 'failed';

export interface RecoveryNotificationResult {
  readonly status: RecoveryNotificationStatus;
  readonly planned: number;
  readonly reason?: NotificationFailure | 'unknown';
}

export interface RecoveryNotificationDeps {
  readonly scheduler: NotificationScheduler;
  readonly clock: NotificationClock;
  readonly settings: Pick<SettingsRepository, 'get' | 'set'>;
  /** Score du jour local (`recovery_day`) ; null = abstention ou jour non calculé. */
  readonly todayScore: (day: LocalDate) => Promise<number | null>;
  readonly log: (code: string, data?: Readonly<Record<string, number>>) => void;
  /** I6-05 : file partagée des passages de planification (défaut : file propre). */
  readonly serial?: <T>(task: () => Promise<T>) => Promise<T>;
}

export interface RecoveryNotificationService {
  /** Replanifie d'après les réglages (ouverture, reprise, synchro, arrière-plan, import). */
  replan(): Promise<RecoveryNotificationResult>;
  /** Enregistre les réglages puis replanifie. */
  setPrefs(prefs: RecoveryNotificationPrefs): Promise<RecoveryNotificationResult>;
  /** Même chose, mais demande d'abord l'autorisation à iOS si elle n'est pas décidée (geste de l'utilisateur seulement). */
  requestPermissionAndReplan(prefs: RecoveryNotificationPrefs): Promise<RecoveryNotificationResult>;
  /** Point d'extension de l'import Raccourcis : enregistre l'heure proposée du jour puis replanifie. */
  afterImport(input: { readonly today: string; readonly nights: readonly NightRecord[]; readonly exertionToday: number }): Promise<RecoveryNotificationResult>;
  readPrefs(): Promise<RecoveryNotificationPrefs>;
  /** Dernière proposition connue : `time` null = « pas encore » ; null = jamais calculée sur cet appareil. */
  readProposal(): Promise<{ readonly day: string; readonly time: string | null } | null>;
}

const isOurs = (request: Pick<NotificationRequest, 'kind'>): boolean => request.kind === 'bedtime' || request.kind === 'morning';
const FAILED: RecoveryNotificationResult = { status: 'failed', planned: 0, reason: 'unknown' };

export function createRecoveryNotificationService(deps: RecoveryNotificationDeps): RecoveryNotificationService {
  let queue: Promise<unknown> = Promise.resolve();
  function ownSerial<T>(task: () => Promise<T>): Promise<T> {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  }
  const serial = deps.serial ?? ownSerial;

  async function readPrefs(): Promise<RecoveryNotificationPrefs> {
    try {
      return parseRecoveryNotificationPrefs(await deps.settings.get('recovery.notificationPrefs'));
    } catch {
      return DEFAULT_RECOVERY_NOTIFICATION_PREFS;
    }
  }

  async function readProposal(): Promise<{ readonly day: string; readonly time: string | null } | null> {
    try {
      const value = parseBedtimeProposalSetting(await deps.settings.get('recovery.bedtimeProposal'));
      return value === null ? null : { day: value.day, time: value.time };
    } catch {
      return null;
    }
  }

  async function compose(items: ReturnType<typeof planRecoveryNotifications>['items']): Promise<NotificationRequest[]> {
    if (items.length === 0) return [];
    const { recoveryNotificationsFr: fr } = await import('../../i18n/fr.recoveryNotifications');
    return items.map((item) => ({
      id: item.id,
      fireAt: item.fireAt,
      kind: item.kind,
      title: item.kind === 'bedtime' ? fr.notifBedtimeTitle : fr.notifMorningTitle,
      body: item.kind === 'bedtime' ? fr.notifBedtimeBody : fr.notifMorningBody,
    }));
  }

  async function pass(askPermission: boolean): Promise<RecoveryNotificationResult> {
    try {
      const { scheduler, clock } = deps;
      // PC, navigateur, tests : rien n'est lu ni planifié, l'envoi est sur l'iPhone.
      if ((await scheduler.availability()) === 'unavailable') return { status: 'unsupported', planned: 0 };
      const prefs = await readPrefs();
      const pending = await scheduler.pending();
      const others = pending.filter((request) => !isOurs(request));
      const hasOurs = pending.length !== others.length;
      if (!prefs.bedtime && !prefs.morning && !hasOurs) return { status: 'off', planned: 0 };

      let permission = await scheduler.permission();
      if (permission === 'undetermined' && askPermission && (prefs.bedtime || prefs.morning)) permission = await scheduler.requestPermission();
      if (permission !== 'granted') {
        deps.log('recovery-notifications-permission', {});
        return { status: 'permission', planned: 0 };
      }

      const zone = clock.zone();
      if (zone === null) return { status: 'no-zone', planned: 0 };
      const now = localDateTimeAt(clock.nowMs(), zone);
      const today = now.slice(0, 10) as LocalDate;
      const proposal = prefs.bedtime ? await readProposal() : null;
      const score = prefs.morning ? await deps.todayScore(today).catch(() => null) : null;
      const room = NOTIFICATION_LIMIT - (await scheduler.reservedCount()) - others.length;
      const plan = planRecoveryNotifications({ now, bedtime: prefs.bedtime, morning: prefs.morning, bedtimeTime: proposal?.time ?? null, morningReady: score !== null, limit: room });
      const ours = await compose(plan.items);
      await scheduler.replace([...others, ...ours]);
      deps.log('recovery-notifications-planned', { planned: ours.length, kept: others.length });
      return { status: 'planned', planned: ours.length };
    } catch (error) {
      const reason = error instanceof NotificationSchedulerError ? error.reason : 'unknown';
      deps.log('recovery-notifications-failed', {});
      return { status: 'failed', planned: 0, reason };
    }
  }

  async function savePrefs(prefs: RecoveryNotificationPrefs): Promise<boolean> {
    try {
      await deps.settings.set('recovery.notificationPrefs', { v: 1, bedtime: prefs.bedtime, morning: prefs.morning });
      return true;
    } catch {
      return false;
    }
  }

  return {
    replan: () => serial(() => pass(false)),
    readPrefs,
    readProposal,
    setPrefs: (prefs) => serial(async () => ((await savePrefs(prefs)) ? pass(false) : FAILED)),
    requestPermissionAndReplan: (prefs) => serial(async () => ((await savePrefs(prefs)) ? pass(true) : FAILED)),
    afterImport: (input) =>
      serial(async () => {
        try {
          const proposal = bedtimeProposal({ nights: input.nights, today: input.today, exertionToday: input.exertionToday });
          await deps.settings.set('recovery.bedtimeProposal', { v: 1, day: input.today, time: proposal.time });
        } catch {
          deps.log('recovery-notifications-proposal-failed', {});
          return FAILED;
        }
        return pass(false);
      }),
  };
}
