import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { DEFAULT_GENERATION_CONFIG as CONFIG } from './config';
import { canApplyWeeksNow, createMesocycleSpec, defaultCycleWeeks, mesocycleState, weeksNowSpec, type MesocycleSpec } from './mesocycle';

/** PROG-05 (D-315) : durée proposée au lancement et changement de durée en semaine 1. */
const spec = (weeks: number | 'unlimited', over: Partial<MesocycleSpec> = {}): MesocycleSpec => {
  const s = createMesocycleSpec({ routineId: 'r1', startDate: '2026-11-16' as LocalDate, weeks }, CONFIG);
  if (s === null) throw new Error('spec');
  return { ...s, ...over };
};

describe('defaultCycleWeeks', () => {
  it('le dernier réglage d’Ali passe d’abord, même devant un cycle importé plus récent', () => {
    expect(defaultCycleWeeks({ lastChoice: 4, cycles: [spec(5, { status: 'completed' })], onboardingWeeks: 6 }, CONFIG)).toBe(4);
    expect(defaultCycleWeeks({ lastChoice: 'unlimited', cycles: [], onboardingWeeks: null }, CONFIG)).toBe('unlimited');
  });
  it('sans réglage : la durée du cycle le plus récent (durée du suivant d’abord), puis l’onboarding, puis 5', () => {
    const old = spec(6, { startDate: '2026-09-01' as LocalDate, status: 'completed' });
    const recent = spec(5, { startDate: '2026-10-05' as LocalDate, status: 'completed', nextWeeks: 4 });
    expect(defaultCycleWeeks({ lastChoice: null, cycles: [recent, old], onboardingWeeks: 6 }, CONFIG)).toBe(4);
    expect(defaultCycleWeeks({ lastChoice: null, cycles: [old], onboardingWeeks: 4 }, CONFIG)).toBe(6);
    expect(defaultCycleWeeks({ lastChoice: null, cycles: [spec('unlimited')], onboardingWeeks: 4 }, CONFIG)).toBe('unlimited');
    expect(defaultCycleWeeks({ lastChoice: null, cycles: [], onboardingWeeks: 4 }, CONFIG)).toBe(4);
    expect(defaultCycleWeeks({ lastChoice: null, cycles: [], onboardingWeeks: null }, CONFIG)).toBe(5);
  });
  it('un réglage hors des choix (illisible) est ignoré', () => {
    expect(defaultCycleWeeks({ lastChoice: 9, cycles: [], onboardingWeeks: 3 }, CONFIG)).toBe(5);
  });
});

describe('changement de durée en semaine 1', () => {
  it('semaine 1, aucune séance close depuis le début : applicable tout de suite ; sinon, non', () => {
    const s = spec(5);
    expect(canApplyWeeksNow(s, mesocycleState(s, '2026-11-18' as LocalDate, CONFIG), 0)).toBe(true);
    expect(canApplyWeeksNow(s, mesocycleState(s, '2026-11-18' as LocalDate, CONFIG), 1)).toBe(false);
    expect(canApplyWeeksNow(s, mesocycleState(s, '2026-11-24' as LocalDate, CONFIG), 0)).toBe(false);
    const u = spec('unlimited');
    expect(canApplyWeeksNow(u, mesocycleState(u, '2026-11-18' as LocalDate, CONFIG), 0)).toBe(false);
  });
  it('appliquée au cycle en cours : nouvelle durée, plus de durée du suivant, semaine de reprise gardée seulement sur 4 ou 6', () => {
    const s = spec(5, { nextWeeks: 6, rampUp: false });
    expect(weeksNowSpec(s, 4, CONFIG)).toMatchObject({ weeks: 4, nextWeeks: null, startDate: '2026-11-16', status: 'active' });
    expect(weeksNowSpec({ ...spec(4), rampUp: true }, 5, CONFIG)).toMatchObject({ weeks: 5, rampUp: false });
    expect(weeksNowSpec({ ...spec(4), rampUp: true }, 6, CONFIG)).toMatchObject({ weeks: 6, rampUp: true });
    expect(weeksNowSpec(s, 9, CONFIG)).toBeNull();
  });
});
