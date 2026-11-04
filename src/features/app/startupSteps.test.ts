import { describe, expect, it } from 'vitest';
import { createStartupTracker, STARTUP_STEP_DEADLINE_MS, stepCode } from './startupSteps';

/** Étapes nommées et chronométrées du démarrage : durée journalisée à la fermeture, étape bloquée au-delà de 8 s. */
function setup() {
  let clock = 0;
  const lines: string[] = [];
  const tracker = createStartupTracker(() => clock, (line) => lines.push(line));
  return { tracker, lines, advance: (ms: number) => (clock += ms) };
}

describe('suivi des étapes de démarrage', () => {
  it('le délai est de 8 secondes', () => {
    expect(STARTUP_STEP_DEADLINE_MS).toBe(8000);
  });

  it('ouvrir une étape ferme la précédente et écrit sa durée au journal', () => {
    const { tracker, lines, advance } = setup();
    tracker.begin('db.load');
    advance(120);
    tracker.begin('db.migration');
    expect(lines).toEqual(['step db.load 120 ms']);
    expect(tracker.current()?.name).toBe('db.migration');
    advance(30);
    tracker.done();
    expect(lines).toEqual(['step db.load 120 ms', 'step db.migration 30 ms']);
    expect(tracker.current()).toBeNull();
    expect(tracker.history()).toEqual([
      { name: 'db.load', ms: 120 },
      { name: 'db.migration', ms: 30 },
    ]);
  });

  it('une étape n’est bloquée qu’au-delà de 8 secondes, pas à 8 secondes pile', () => {
    const { tracker, advance } = setup();
    tracker.begin('openSyncPlatform');
    advance(8000);
    expect(tracker.stalled()).toBeNull();
    advance(1);
    expect(tracker.stalled()?.name).toBe('openSyncPlatform');
  });

  it('une fois le démarrage terminé, rien n’est bloqué', () => {
    const { tracker, advance } = setup();
    tracker.begin('readLaunch');
    advance(20_000);
    tracker.done();
    expect(tracker.stalled()).toBeNull();
  });

  it('notifie les abonnés à chaque changement ; reset repart de zéro', () => {
    const { tracker } = setup();
    let calls = 0;
    const off = tracker.subscribe(() => calls++);
    tracker.begin('a');
    tracker.begin('b');
    expect(calls).toBe(2);
    off();
    tracker.begin('c');
    expect(calls).toBe(2);
    tracker.reset();
    expect(tracker.current()).toBeNull();
    expect(tracker.history()).toEqual([]);
  });

  it('le journal technique ne reçoit que les étapes d’au moins 500 ms (minLoggedMs)', () => {
    let clock = 0;
    const lines: string[] = [];
    const tracker = createStartupTracker(() => clock, (line) => lines.push(line), 500);
    tracker.begin('rapide');
    clock += 499;
    tracker.begin('lente');
    clock += 500;
    tracker.done();
    expect(lines).toEqual(['step lente 500 ms']);
    expect(tracker.history()).toHaveLength(2);
  });

  it('le nom écrit au journal ne contient que des caractères sûrs', () => {
    expect(stepCode('settings.get(device.id)')).toBe('settings.get-device.id-');
    expect(stepCode('/Users/ali/x y')).not.toMatch(/[/ ]/);
    expect(stepCode('')).toBe('etape');
  });
});
