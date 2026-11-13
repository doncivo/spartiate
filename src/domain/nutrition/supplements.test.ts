import { describe, expect, it } from 'vitest';
import type { LocalDate, LocalTime } from '../types';
import {
  ALL_DAYS,
  dueIntakes,
  isDueOn,
  parseSupplementTimes,
  supplementAdherence,
  supplementStreak,
  validateSupplementDraft,
  type Supplement,
  type SupplementIntake,
} from './supplements';

/** I6-05 (§ 15.3, D-210, D-211) : règles pures des compléments. */
const d = (s: string): LocalDate => s as LocalDate;
const t = (s: string): LocalTime => s as LocalTime;
const sup = (over: Partial<Supplement> = {}): Supplement => ({
  id: '30000000-0000-4000-8000-000000000001',
  name: 'Créatine',
  dose: 5,
  unit: 'g',
  times: [t('08:00')],
  days: ALL_DAYS,
  active: true,
  since: d('2026-11-01'),
  ...over,
});
const take = (s: Supplement, date: string, moment: string): SupplementIntake => ({ supplementId: s.id, date: d(date), moment: t(moment) });

describe('validateSupplementDraft', () => {
  it('normalise : nom rogné, unité vide = null, heures triées sans doublon', () => {
    expect(validateSupplementDraft({ name: '  Vitamine D ', dose: 1000, unit: ' ', times: ['20:00', '08:00', '08:00'], days: 31, active: true })).toEqual({
      ok: true,
      value: { name: 'Vitamine D', dose: 1000, unit: null, times: ['08:00', '20:00'], days: 31, active: true },
    });
  });
  it.each([
    ['name', { name: '  ' }],
    ['name', { name: 'x'.repeat(81) }],
    ['dose', { dose: 0 }],
    ['dose', { dose: -1 }],
    ['dose', { dose: Number.NaN }],
    ['dose', { dose: 100_001 }],
    ['unit', { unit: 'x'.repeat(17) }],
    ['times', { times: [] }],
    ['times', { times: ['8h'] }],
    ['times', { times: ['24:00'] }],
    ['times', { times: ['06:00', '08:00', '10:00', '12:00', '14:00'] }],
    ['days', { days: 0 }],
    ['days', { days: 128 }],
    ['days', { days: 1.5 }],
  ] as const)('refuse %s', (error, over) => {
    expect(validateSupplementDraft({ name: 'Zinc', dose: null, unit: null, times: ['08:00'], days: ALL_DAYS, active: true, ...over })).toEqual({ ok: false, error });
  });
  it('dose et unité facultatives', () => {
    expect(validateSupplementDraft({ name: 'Oméga 3', dose: null, unit: null, times: ['12:30'], days: 1, active: false })).toMatchObject({ ok: true, value: { dose: null, unit: null, active: false } });
  });
});

describe('parseSupplementTimes', () => {
  it('lit un tableau JSON d’heures, refuse le reste', () => {
    expect(parseSupplementTimes('["08:00","20:00"]')).toEqual(['08:00', '20:00']);
    expect(parseSupplementTimes('[]')).toBeNull();
    expect(parseSupplementTimes('["8:00"]')).toBeNull();
    expect(parseSupplementTimes('{')).toBeNull();
    expect(parseSupplementTimes('"08:00"')).toBeNull();
  });
});

describe('isDueOn et dueIntakes', () => {
  it('jours : lundi = bit 1 … dimanche = bit 64 ; pause : jamais dû ; avant la création : jamais dû', () => {
    const monday = d('2026-11-09');
    expect(isDueOn(sup({ days: 1 }), monday)).toBe(true);
    expect(isDueOn(sup({ days: 64 }), monday)).toBe(false);
    expect(isDueOn(sup({ days: 64 }), d('2026-11-15'))).toBe(true);
    expect(isDueOn(sup({ active: false }), monday)).toBe(false);
    expect(isDueOn(sup({ since: d('2026-11-10') }), monday)).toBe(false);
  });
  it('prises dues du jour triées par heure puis nom, cochées d’après les prises', () => {
    const a = sup({ name: 'Zinc', times: [t('20:00'), t('08:00')] });
    const b = sup({ id: '30000000-0000-4000-8000-000000000002', name: 'Créatine', times: [t('08:00')] });
    const due = dueIntakes([a, b], [take(a, '2026-11-09', '20:00'), take(a, '2026-11-08', '08:00')], d('2026-11-09'));
    expect(due.map((x) => [x.supplement.name, x.moment, x.taken])).toEqual([
      ['Créatine', '08:00', false],
      ['Zinc', '08:00', false],
      ['Zinc', '20:00', true],
    ]);
  });
});

describe('constance (D-211)', () => {
  const a = sup({ times: [t('08:00'), t('20:00')], since: d('2026-11-01') });
  it('prises cochées / prises dues sur la période, depuis la création ; une prise d’une heure non prévue ne compte pas', () => {
    const intakes = [take(a, '2026-11-08', '08:00'), take(a, '2026-11-08', '20:00'), take(a, '2026-11-09', '08:00'), take(a, '2026-11-09', '13:00')];
    expect(supplementAdherence([a], intakes, d('2026-11-08'), d('2026-11-09'))).toEqual({ due: 4, taken: 3, ratio: 0.75 });
  });
  it('aucune prise due : ratio null (jamais un faux zéro)', () => {
    expect(supplementAdherence([sup({ active: false })], [], d('2026-11-01'), d('2026-11-07'))).toEqual({ due: 0, taken: 0, ratio: null });
    expect(supplementAdherence([a], [], d('2026-10-20'), d('2026-10-31'))).toEqual({ due: 0, taken: 0, ratio: null });
  });
  it('série : jours complets consécutifs ; aujourd’hui incomplet ne casse pas la série ; un jour sans prise due est sauté', () => {
    const b = sup({ days: 1 + 2 + 4 + 8 + 16, since: d('2026-11-01') }); // lundi à vendredi
    const intakes = ['2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10'].map((day) => take(b, day, '08:00'));
    // 2026-11-11 mercredi (aujourd'hui, pas encore pris) ; 10 et 9 pris ; 8 et 7 week-end sautés ; 6 et 5 pris ; 4 manqué.
    expect(supplementStreak([b], intakes, d('2026-11-11'))).toBe(4);
    expect(supplementStreak([b], [...intakes, take(b, '2026-11-11', '08:00')], d('2026-11-11'))).toBe(5);
    expect(supplementStreak([b], [], d('2026-11-11'))).toBe(0);
    expect(supplementStreak([], [], d('2026-11-11'))).toBe(0);
  });
});
