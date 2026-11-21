import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import {
  INJURY_CHECKIN_DAYS,
  INJURY_NOTE_MAX,
  activeInjuries,
  checkinDueOn,
  declareInjury,
  dueCheckins,
  injuryAvoidance,
  markHealed,
  parseInjuries,
  recordCheckin,
  type InjuriesValue,
} from './injuries';

const d = (s: string): LocalDate => s as LocalDate;
const EMPTY: InjuriesValue = { v: 1, items: [] };
const declare = (value: InjuriesValue, over: Partial<Parameters<typeof declareInjury>[1]> = {}): InjuriesValue => {
  const result = declareInjury(value, { id: 'g1', muscleId: 'shoulders', patterns: [], startedOn: d('2026-11-01'), note: null, ...over }, d('2026-11-05'));
  if (!result.ok) throw new Error(result.issue);
  return result.value;
};

describe('parseInjuries (lecture prudente)', () => {
  it('illisible ou mal formé : aucune gêne', () => {
    expect(parseInjuries(null)).toEqual(EMPTY);
    expect(parseInjuries({ v: 2, items: [] })).toEqual(EMPTY);
    expect(parseInjuries({ v: 1, items: 'x' })).toEqual(EMPTY);
  });
  it('écarte les lignes invalides et garde les valides', () => {
    const good = declare(EMPTY);
    const raw = { v: 1, items: [...good.items, { id: 3 }, null, { ...good.items[0], id: 'g2', startedOn: 'hier' }] };
    expect(parseInjuries(raw).items.map((i) => i.id)).toEqual(['g1']);
  });
  it('aller-retour sans perte', () => {
    const value = recordCheckin(declare(EMPTY, { patterns: ['push-vertical'], note: 'épaule droite' }), 'g1', 'same', d('2026-11-15'));
    expect(parseInjuries(JSON.parse(JSON.stringify(value)))).toEqual(value);
  });
});

describe('declareInjury', () => {
  it('exige un muscle ou un pattern', () => {
    const r = declareInjury(EMPTY, { id: 'g1', muscleId: null, patterns: [], startedOn: d('2026-11-01'), note: null }, d('2026-11-05'));
    expect(r).toEqual({ ok: false, issue: 'target' });
  });
  it('refuse une date future, une date illisible et une note trop longue', () => {
    const base = { id: 'g1', muscleId: 'chest', patterns: [], note: null } as const;
    expect(declareInjury(EMPTY, { ...base, startedOn: d('2026-11-06') }, d('2026-11-05'))).toEqual({ ok: false, issue: 'date' });
    expect(declareInjury(EMPTY, { ...base, startedOn: d('2026-13-40') }, d('2026-11-05'))).toEqual({ ok: false, issue: 'date' });
    expect(declareInjury(EMPTY, { ...base, startedOn: d('2026-11-05'), note: 'x'.repeat(INJURY_NOTE_MAX + 1) }, d('2026-11-05'))).toEqual({ ok: false, issue: 'note' });
  });
  it('refuse un identifiant déjà présent ; note vide = null', () => {
    const once = declare(EMPTY, { note: '  ' });
    expect(once.items[0]?.note).toBeNull();
    expect(declareInjury(once, { id: 'g1', muscleId: 'chest', patterns: [], startedOn: d('2026-11-01'), note: null }, d('2026-11-05'))).toEqual({ ok: false, issue: 'id' });
  });
});

describe('guérison et check-in', () => {
  it('marquer guérie : passée, date de guérison, plus active', () => {
    const value = markHealed(declare(EMPTY), 'g1', d('2026-11-20'));
    expect(activeInjuries(value)).toEqual([]);
    expect(value.items[0]).toMatchObject({ status: 'healed', healedOn: '2026-11-20' });
  });
  it('échéance à 14 jours du début, puis de la dernière réponse', () => {
    expect(INJURY_CHECKIN_DAYS).toBe(14);
    const value = declare(EMPTY);
    const injury = value.items[0];
    expect(injury && checkinDueOn(injury)).toBe('2026-11-15');
    expect(dueCheckins(value, d('2026-11-14'))).toEqual([]);
    expect(dueCheckins(value, d('2026-11-15')).map((i) => i.id)).toEqual(['g1']);
    const answered = recordCheckin(value, 'g1', 'same', d('2026-11-16'));
    expect(dueCheckins(answered, d('2026-11-29'))).toEqual([]);
    expect(dueCheckins(answered, d('2026-11-30')).map((i) => i.id)).toEqual(['g1']);
    expect(answered.items[0]?.checkins).toEqual([{ on: '2026-11-16', answer: 'same' }]);
  });
  it('« Guérie » clôt la gêne ; « Pire » et « Mieux » la laissent active', () => {
    const base = declare(EMPTY);
    expect(recordCheckin(base, 'g1', 'healed', d('2026-11-15')).items[0]).toMatchObject({ status: 'healed', healedOn: '2026-11-15' });
    expect(recordCheckin(base, 'g1', 'worse', d('2026-11-15')).items[0]?.status).toBe('active');
    expect(recordCheckin(base, 'g1', 'better', d('2026-11-15')).items[0]?.status).toBe('active');
  });
  it('gêne inconnue ou déjà guérie : rien ne change', () => {
    const base = declare(EMPTY);
    expect(recordCheckin(base, 'absente', 'same', d('2026-11-15'))).toBe(base);
    const healed = markHealed(base, 'g1', d('2026-11-10'));
    expect(recordCheckin(healed, 'g1', 'worse', d('2026-11-15'))).toBe(healed);
    expect(dueCheckins(healed, d('2026-12-31'))).toEqual([]);
  });
});

describe('injuryAvoidance (jamais une incitation, seulement un évitement)', () => {
  const exercises = [
    { id: 'ohp', pattern: 'push-vertical' as const, muscles: [{ id: 'shoulders', weight: 1 }, { id: 'triceps', weight: 0.4 }] },
    { id: 'bench', pattern: 'push-horizontal' as const, muscles: [{ id: 'chest', weight: 1 }, { id: 'shoulders', weight: 0.3 }] },
    { id: 'curl', pattern: 'isolation' as const, muscles: [{ id: 'biceps', weight: 1 }, { id: 'shoulders', weight: 0.1 }] },
  ];
  it('muscle déclaré : exercices où il contribue pour au moins 0,3', () => {
    expect(injuryAvoidance(declare(EMPTY), exercises)).toEqual({ patterns: [], exerciseIds: ['bench', 'ohp'] });
  });
  it('patterns déclarés : repris tels quels, sans doublon', () => {
    const value = declare(declare(EMPTY, { muscleId: null, patterns: ['hinge', 'squat'] }), { id: 'g2', muscleId: null, patterns: ['hinge'] });
    expect(injuryAvoidance(value, exercises)).toEqual({ patterns: ['hinge', 'squat'], exerciseIds: [] });
  });
  it('gêne guérie : aucun effet ; aucune gêne : rien', () => {
    expect(injuryAvoidance(markHealed(declare(EMPTY), 'g1', d('2026-11-10')), exercises)).toEqual({ patterns: [], exerciseIds: [] });
    expect(injuryAvoidance(EMPTY, exercises)).toEqual({ patterns: [], exerciseIds: [] });
  });
});
