import { isLocalDate, isLocalTime } from '../types';

/**
 * Réglages LOCAUX des notifications de récupération (I5-02 point 2.3) : valeurs BRUTES du réglage, relues strictement (jamais d'exception).
 * Désactivées par défaut ; jamais publiées par la synchro (portée locale).
 */
export interface RecoveryNotificationPrefs {
  readonly v: 1;
  /** Rappel de coucher 30 min avant l'heure proposée. */
  readonly bedtime: boolean;
  /** Notification du matin (au plus une par jour). */
  readonly morning: boolean;
}

export const DEFAULT_RECOVERY_NOTIFICATION_PREFS: RecoveryNotificationPrefs = { v: 1, bedtime: false, morning: false };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseRecoveryNotificationPrefs(raw: unknown): RecoveryNotificationPrefs {
  if (!isRecord(raw) || raw['v'] !== 1) return DEFAULT_RECOVERY_NOTIFICATION_PREFS;
  return { v: 1, bedtime: raw['bedtime'] === true, morning: raw['morning'] === true };
}

/** Dernière heure de coucher proposée, calculée à chaque import (`bedtimeProposal`) ; `time` null = « pas encore de proposition ». */
export interface BedtimeProposalSetting {
  readonly v: 1;
  readonly day: string;
  readonly time: string | null;
}

export function parseBedtimeProposalSetting(raw: unknown): BedtimeProposalSetting | null {
  if (!isRecord(raw) || raw['v'] !== 1) return null;
  const { day, time } = raw;
  if (typeof day !== 'string' || !isLocalDate(day)) return null;
  if (time === null) return { v: 1, day, time: null };
  if (typeof time !== 'string' || !isLocalTime(time)) return null;
  return { v: 1, day, time };
}
