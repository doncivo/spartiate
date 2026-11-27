import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { injuryNotificationId } from '../../domain/injuryNotificationPlan';
import { measurementNotificationId } from '../../domain/measurementNotificationPlan';
import { snoozeNotificationId, type RawOpenAction } from '../../domain/notificationActions';
import { eventNotificationId, recapNotificationId, routineNotificationId, taskNotificationId } from '../../domain/notificationId';
import { NOTIFICATION_FAMILIES, NOTIFICATION_SCREEN_OF, OPEN_FRESH_MS, notificationFamilyOf, notificationScreenOf, type NotificationFamily, type NotificationScreen } from '../../domain/notificationTargets';
import { bedtimeNotificationId, morningNotificationId } from '../../domain/recoveryNotificationPlan';
import { supplementNotificationId } from '../../domain/supplementNotificationPlan';
import type { LocalDate, LocalTime, ReminderId } from '../../domain/types';
import { NOTIFICATION_KINDS } from '../../platform/notifications';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { createNotificationOpener } from './notificationOpen';

/**
 * NOTIF-0302 (BL-184, D-765, D-762 révisée) : chaque notification de Spartiate ouvre directement l'écran qu'elle concerne. Inventaire fermé de
 * toutes les notifications émises (familles du planificateur, minuteurs, alerte de signature) et de leur écran ; un émetteur nouveau
 * (`extra: { sid … }`) rend ce test rouge tant qu'il n'est pas inscrit. Valeurs inventées.
 */
const DAY = '2026-11-27' as LocalDate;
const R = 'r1' as ReminderId;

/** Famille, identifiant de notification tel qu'émis (`extra.sid`), écran ouvert par l'appui. */
const INVENTORY: readonly (readonly [NotificationFamily, string, NotificationScreen])[] = [
  ['measurement', measurementNotificationId(DAY), 'progress-body-measures'],
  ['supplement', supplementNotificationId(DAY, '08:00' as LocalTime), 'nutrition-supplements'],
  ['injury', injuryNotificationId(DAY), 'today'],
  ['morning', morningNotificationId(DAY), 'today'],
  ['bedtime', bedtimeNotificationId(DAY), 'today'],
  ['rest', 'timer:rest', 'training-session'],
  ['test-timer', 'timer:test', 'more-logs'],
  ['signing', 'signing', 'more-sidestore'],
  ['task', taskNotificationId(R), 'today'],
  ['routine', routineNotificationId(R, DAY), 'today'],
  ['event', eventNotificationId(R, DAY), 'today'],
  ['recap', recapNotificationId('evening', DAY), 'today'],
  ['snooze', snoozeNotificationId(taskNotificationId(R)), 'today'],
];

/** Fichiers de `src` (hors tests) qui posent une notification (`bridge.show(`, commande `plugin:notification|`, `extra` avec `sid`). */
const EMITTERS = ['src/platform/notifications/tauriNotifications.ts', 'src/platform/notifications/timerNotification.ts', 'src/platform/signing/tauriSigningAlert.ts'];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path.replace(/\\/g, '/')] : [];
  });
}

describe('NOTIF-0302 : inventaire des notifications et de leur écran', () => {
  it('chaque famille du planificateur (NOTIFICATION_KINDS) a une cible', () => {
    for (const kind of NOTIFICATION_KINDS) expect(NOTIFICATION_SCREEN_OF[kind as NotificationFamily], kind).toBeDefined();
  });

  it('inventaire fermé : chaque famille une fois, chaque identifiant émis mène à son écran', () => {
    expect(INVENTORY.map(([family]) => family).sort()).toEqual([...NOTIFICATION_FAMILIES].sort());
    for (const [family, sid, screen] of INVENTORY) {
      expect(notificationFamilyOf(sid), sid).toBe(family);
      expect(notificationScreenOf(sid), sid).toBe(screen);
    }
  });

  it('aucun émetteur hors de l’inventaire : seuls les fichiers connus posent une notification', () => {
    const emits = (text: string): boolean => /\bbridge\.show\(|'plugin:notification\|'|extra:\s*\{[^}]*\bsid\b/.test(text);
    const found = sources('src').filter((file) => emits(readFileSync(file, 'utf8')));
    expect(found.sort()).toEqual([...EMITTERS].sort());
  });

  it('identifiant inconnu, vide ou absent : aucune cible', () => {
    expect(notificationScreenOf(null)).toBeNull();
    expect(notificationScreenOf('')).toBeNull();
    expect(notificationScreenOf('inconnu:2026-11-27')).toBeNull();
    expect(notificationScreenOf('timer:autre')).toBeNull();
  });
});

const NOW = 1_764_230_400_000;
const open = (sid: string | null, receivedAtMs = NOW - 2_000): RawOpenAction => ({ numericId: 70001, actionId: 'open', receivedAtMs, sid, deliveredAt: null });

describe('NOTIF-0302 : l’appui ouvre l’écran', () => {
  beforeEach(() => useNavigationStore.setState(INITIAL_NAVIGATION));
  const opener = () => createNotificationOpener({ nowMs: () => NOW, log: () => undefined });

  it('rappel des mesures : Progrès › Corps › Mesures', () => {
    useNavigationStore.getState().setProgressView({ tab: 'activity', body: 'photos' });
    expect(opener()([open(measurementNotificationId(DAY))])).toBe('progress-body-measures');
    const state = useNavigationStore.getState();
    expect(state.route).toEqual({ tab: 'progress' });
    expect(state.progressView).toEqual({ tab: 'body', body: 'measures' });
  });

  it.each([
    ['supplement', supplementNotificationId(DAY, '08:00' as LocalTime), { tab: 'nutrition', screen: 'supplements' }],
    ['rest', 'timer:rest', { tab: 'training', screen: 'session' }],
    ['test-timer', 'timer:test', { tab: 'more', screen: 'logs' }],
    ['signing', 'signing', { tab: 'more', screen: 'sidestore' }],
    ['morning', morningNotificationId(DAY), { tab: 'today' }],
  ] as const)('%s : route ouverte', (_family, sid, route) => {
    useNavigationStore.getState().navigate({ tab: 'progress' });
    opener()([open(sid)]);
    expect(useNavigationStore.getState().route).toEqual(route);
  });

  it('plusieurs appuis tirés ensemble : le plus récent seulement ; un appui déjà suivi n’est pas rejoué', () => {
    const go = opener();
    const older = open('timer:rest', NOW - 60_000);
    const newer = open(measurementNotificationId(DAY), NOW - 1_000);
    expect(go([newer, older])).toBe('progress-body-measures');
    useNavigationStore.getState().navigate({ tab: 'today' });
    expect(go([newer, older])).toBeNull();
    expect(useNavigationStore.getState().route).toEqual({ tab: 'today' });
  });

  it('appui ancien (fichier rejoué) ou sans cible : rien ne bouge, c’est journalisé', () => {
    const codes: string[] = [];
    const go = createNotificationOpener({ nowMs: () => NOW, log: (code) => codes.push(code) });
    expect(go([open('timer:rest', NOW - OPEN_FRESH_MS - 1)])).toBeNull();
    expect(go([open('inconnu:x')])).toBeNull();
    expect(useNavigationStore.getState().route).toEqual(INITIAL_NAVIGATION.route);
    expect(codes).toEqual(['notification-open-stale', 'notification-open-unknown']);
  });
});
