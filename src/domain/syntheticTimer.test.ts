import { describe, expect, it } from 'vitest';
import { formatTimerRemaining, parseSyntheticTimer, SYNTHETIC_TIMER_MS, TIMER_NOTIFICATION_ID, timerPhase, timerRemainingMs } from './syntheticTimer';

/** SPA-007 lot D : minuteur synthétique de 60 s. Le temps restant se recalcule TOUJOURS depuis la date de fin persistée. */
describe('minuteur synthétique (domaine)', () => {
  const state = { endMs: 1_000_000 + SYNTHETIC_TIMER_MS, label: 'Minuteur de test' };

  it('dure 60 s ; identifiant de notification réservé (hors plan : 1 à 65 535), distinct de la fin de Focus (1)', () => {
    expect(SYNTHETIC_TIMER_MS).toBe(60_000);
    expect(TIMER_NOTIFICATION_ID).toBeGreaterThan(1);
    expect(TIMER_NOTIFICATION_ID).toBeLessThanOrEqual(65_535);
  });

  it('temps restant = fin - maintenant, jamais négatif, quel que soit le temps passé en arrière-plan', () => {
    expect(timerRemainingMs(state, 1_000_000)).toBe(60_000);
    expect(timerRemainingMs(state, 1_030_000)).toBe(30_000);
    expect(timerRemainingMs(state, 1_060_000)).toBe(0);
    expect(timerRemainingMs(state, 5_000_000)).toBe(0);
    expect(timerRemainingMs(state, 0)).toBe(1_060_000);
  });

  it('phase : idle sans date, running avant l’échéance, finished à l’échéance et après', () => {
    expect(timerPhase(null, 1)).toBe('idle');
    expect(timerPhase(state, 1_059_999)).toBe('running');
    expect(timerPhase(state, 1_060_000)).toBe('finished');
    expect(timerPhase(state, 9_999_999)).toBe('finished');
  });

  it('lecture d’une valeur persistée : valide ou null, jamais une exception ni une date inventée', () => {
    expect(parseSyntheticTimer(state)).toEqual(state);
    for (const bad of [null, undefined, 'x', 3, {}, { endMs: 'x', label: 'a' }, { endMs: -1, label: 'a' }, { endMs: Number.NaN, label: 'a' }, { endMs: 5, label: '' }, { endMs: 5, label: 7 }, { endMs: 5e15, label: 'a' }]) {
      expect(parseSyntheticTimer(bad)).toBeNull();
    }
    expect(parseSyntheticTimer({ endMs: 5, label: 'a'.repeat(300) })?.label.length).toBe(80);
  });

  it('affichage mm:ss, arrondi vers le haut (0:01 tant qu’il reste du temps)', () => {
    expect(formatTimerRemaining(60_000)).toBe('1:00');
    expect(formatTimerRemaining(59_001)).toBe('1:00');
    expect(formatTimerRemaining(59_000)).toBe('0:59');
    expect(formatTimerRemaining(1)).toBe('0:01');
    expect(formatTimerRemaining(0)).toBe('0:00');
    expect(formatTimerRemaining(-5)).toBe('0:00');
  });
});
