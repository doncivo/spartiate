import { describe, expect, it } from 'vitest';
import { DEFAULT_GOAL_RATE_KG, effectiveGoal } from './prefs';

/** NUTRI-0299 (BL-173, D-669, C-106) : Stratégie et le check-in lisent l'objectif du profil ; le rythme reste dans les préférences nutrition. */
describe('effectiveGoal : sorte du profil, rythme des préférences', () => {
  it('le profil fixe la sorte : « perte » au profil, maintien aux préférences → perte au rythme par défaut (0,25 kg / semaine)', () => {
    expect(DEFAULT_GOAL_RATE_KG).toBe(0.25);
    expect(effectiveGoal('loss', { kind: 'maintain' })).toEqual({ kind: 'loss', weeklyRateKg: 0.25 });
    expect(effectiveGoal('gain', { kind: 'maintain' })).toEqual({ kind: 'gain', weeklyRateKg: 0.25 });
  });
  it('même sorte au profil et aux préférences : le rythme des préférences est gardé', () => {
    expect(effectiveGoal('loss', { kind: 'loss', weeklyRateKg: 0.5 })).toEqual({ kind: 'loss', weeklyRateKg: 0.5 });
    expect(effectiveGoal('gain', { kind: 'gain', weeklyRateKg: 0.15 })).toEqual({ kind: 'gain', weeklyRateKg: 0.15 });
  });
  it('sorte différente (profil changé, par exemple sur l’autre appareil) : jamais le rythme d’une autre sorte, le défaut', () => {
    expect(effectiveGoal('gain', { kind: 'loss', weeklyRateKg: 0.5 })).toEqual({ kind: 'gain', weeklyRateKg: 0.25 });
  });
  it('maintien au profil : maintien, quel que soit le rythme gardé', () => {
    expect(effectiveGoal('maintain', { kind: 'loss', weeklyRateKg: 0.4 })).toEqual({ kind: 'maintain' });
  });
  it('profil sans objectif : l’ancien choix des préférences est gardé (rien de perdu), maintien par défaut', () => {
    expect(effectiveGoal(null, { kind: 'loss', weeklyRateKg: 0.5 })).toEqual({ kind: 'loss', weeklyRateKg: 0.5 });
    expect(effectiveGoal(null, { kind: 'maintain' })).toEqual({ kind: 'maintain' });
  });
});
