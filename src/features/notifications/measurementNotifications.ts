import { DEFAULT_MEASUREMENT_RHYTHM_DAYS, parseMeasurementRhythm, type MeasurementRhythmDays } from '../../domain/bodyProgress/measurementSchedule';
import type { BodySample } from '../../domain/bodyProgress/period';
import { parseMeasurementReminder, planMeasurementNotifications } from '../../domain/measurementNotificationPlan';
import { localDateTimeAt } from '../../domain/notificationInstant';
import type { SettingsRepository } from '../../db/repositories/settingsRepository';
import { NOTIFICATION_LIMIT, NotificationSchedulerError, type NotificationClock, type NotificationFailure, type NotificationRequest, type NotificationScheduler } from '../../platform/notifications';
import { createSerialQueue } from './supplementNotifications';

/**
 * Rappel des mesures sur l'iPhone (CORPS-0301d, BL-180, D-713, D-714, ADR 0012) : une notification neutre à 09:00 le jour prévu. Réglages LOCAUX
 * (`bodyProgress.measurementRhythm`, `bodyProgress.measurementReminder`, jamais synchronisés) : rythme 7 jours et rappel actif par défaut. Le PC
 * n'émet rien (planificateur vide : `unsupported`), mais enregistre le rythme. Les notifications d'autres familles sont REPOSÉES telles quelles ;
 * l'autorisation n'est demandée qu'au geste qui allume le rappel (D-763) ; aucune méthode ne rejette ; le journal ne reçoit que des codes.
 */
export type MeasurementNotificationStatus = 'unsupported' | 'off' | 'permission' | 'no-zone' | 'planned' | 'failed';

export interface MeasurementNotificationResult {
  readonly status: MeasurementNotificationStatus;
  readonly planned: number;
  readonly reason?: NotificationFailure | 'unknown';
  /** Le réglage n'a pas pu être écrit (rien n'a été replanifié). */
  readonly saveFailed?: true;
}

export interface MeasurementPrefs {
  readonly rhythm: MeasurementRhythmDays;
  readonly reminder: boolean;
}

export interface MeasurementNotificationDeps {
  readonly scheduler: NotificationScheduler;
  readonly clock: NotificationClock;
  readonly settings: Pick<SettingsRepository, 'get' | 'set'>;
  /** Lignes vivantes de `measurement` (genre et jour) ; le plan n'en retient que les 11 zones saisies. */
  readonly samples: () => Promise<readonly Pick<BodySample, 'kind' | 'date'>[]>;
  readonly log: (code: string) => void;
  /** File partagée des passages de planification (défaut : file propre). */
  readonly serial?: <T>(task: () => Promise<T>) => Promise<T>;
}

export interface MeasurementNotificationService {
  replan(): Promise<MeasurementNotificationResult>;
  readPrefs(): Promise<MeasurementPrefs>;
  /** Écrit les deux réglages puis replanifie ; `askPermission` : geste de l'utilisateur qui allume le rappel. */
  savePrefs(prefs: MeasurementPrefs, options?: { readonly askPermission?: boolean }): Promise<MeasurementNotificationResult>;
}

const isOurs = (request: Pick<NotificationRequest, 'kind'>): boolean => request.kind === 'measurement';
const DEFAULT_PREFS: MeasurementPrefs = { rhythm: DEFAULT_MEASUREMENT_RHYTHM_DAYS, reminder: true };
const SAVE_FAILED: MeasurementNotificationResult = { status: 'failed', planned: 0, reason: 'unknown', saveFailed: true };

export function createMeasurementNotificationService(deps: MeasurementNotificationDeps): MeasurementNotificationService {
  const serial = deps.serial ?? createSerialQueue();

  async function readPrefs(): Promise<MeasurementPrefs> {
    try {
      const [rhythm, reminder] = await Promise.all([deps.settings.get('bodyProgress.measurementRhythm'), deps.settings.get('bodyProgress.measurementReminder')]);
      return { rhythm: parseMeasurementRhythm(rhythm), reminder: parseMeasurementReminder(reminder) };
    } catch {
      return DEFAULT_PREFS;
    }
  }

  async function pass(askPermission: boolean): Promise<MeasurementNotificationResult> {
    try {
      const { scheduler, clock } = deps;
      if ((await scheduler.availability()) === 'unavailable') return { status: 'unsupported', planned: 0 };
      const prefs = await readPrefs();
      const pending = await scheduler.pending();
      const others = pending.filter((request) => !isOurs(request));
      const hasOurs = pending.length !== others.length;
      if (!prefs.reminder && !hasOurs) return { status: 'off', planned: 0 };
      let permission = await scheduler.permission();
      if (permission === 'undetermined' && askPermission && prefs.reminder) permission = await scheduler.requestPermission();
      if (permission !== 'granted') {
        deps.log('measurement-notifications-permission');
        return { status: 'permission', planned: 0 };
      }
      const zone = clock.zone();
      if (zone === null) return { status: 'no-zone', planned: 0 };
      const now = localDateTimeAt(clock.nowMs(), zone);
      const samples = prefs.reminder ? await deps.samples() : [];
      const room = NOTIFICATION_LIMIT - (await scheduler.reservedCount()) - others.length;
      const plan = planMeasurementNotifications({ now, enabled: prefs.reminder, rhythm: prefs.rhythm, samples, limit: room });
      let ours: NotificationRequest[] = [];
      if (plan.items.length > 0) {
        const { measurementNotificationsFr: fr } = await import('../../i18n/fr.measurementNotifications');
        ours = plan.items.map((item) => ({ id: item.id, fireAt: item.fireAt, kind: 'measurement', title: fr.title, body: fr.body }));
      }
      await scheduler.replace([...others, ...ours]);
      return { status: 'planned', planned: ours.length };
    } catch (error) {
      deps.log('measurement-notifications-failed');
      return { status: 'failed', planned: 0, reason: error instanceof NotificationSchedulerError ? error.reason : 'unknown' };
    }
  }

  async function save(prefs: MeasurementPrefs): Promise<boolean> {
    try {
      await deps.settings.set('bodyProgress.measurementRhythm', parseMeasurementRhythm(prefs.rhythm));
      await deps.settings.set('bodyProgress.measurementReminder', prefs.reminder);
      return true;
    } catch {
      deps.log('measurement-prefs-save-failed');
      return false;
    }
  }

  return {
    replan: () => serial(() => pass(false)),
    readPrefs,
    savePrefs: (prefs, options) => serial(async () => ((await save(prefs)) ? pass(options?.askPermission === true) : SAVE_FAILED)),
  };
}
