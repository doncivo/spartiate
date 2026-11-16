import { describe, expect, it } from 'vitest';
import type { Hlc, IsoDateTime, LocalDate } from '../types';
import { collapseRecopies, effectiveTarget, upcomingTargets, validateTargetRecord, type TargetRecord, type TargetRecordDraft } from './targetRecord';

/** I4-02 : enregistrement d'une cible (une ligne par décision, jamais écrasée) ; valeurs synthétiques. */

const draft = (over: Partial<TargetRecordDraft> = {}): TargetRecordDraft => ({
  weekStart: '2026-11-09' as LocalDate,
  target: { kcal: 2400, proteinG: 150, fatG: 70, carbG: 290 },
  source: 'auto',
  accepted: true,
  engineVersion: 1,
  lowFloorConfirmed: false,
  ...over,
});

describe('validateTargetRecord', () => {
  it('cible valide : aucune erreur ; source manuelle sans version du moteur', () => {
    expect(validateTargetRecord(draft())).toEqual([]);
    expect(validateTargetRecord(draft({ source: 'manual', engineVersion: null }))).toEqual([]);
  });
  it('date de semaine, source et version invalides', () => {
    expect(validateTargetRecord(draft({ weekStart: '2026-02-30' as LocalDate }))).toContain('week-invalid');
    expect(validateTargetRecord(draft({ source: 'ia' as never }))).toContain('source-invalid');
    expect(validateTargetRecord(draft({ engineVersion: 0 }))).toContain('engine-version-invalid');
    expect(validateTargetRecord(draft({ engineVersion: 1.5 }))).toContain('engine-version-invalid');
  });
  it('valeurs nulles, négatives ou non finies refusées (jamais 0 par défaut)', () => {
    expect(validateTargetRecord(draft({ target: { kcal: 0, proteinG: 150, fatG: 70, carbG: 290 } }))).toContain('value-invalid');
    expect(validateTargetRecord(draft({ target: { kcal: 2400, proteinG: -1, fatG: 70, carbG: 290 } }))).toContain('value-invalid');
    expect(validateTargetRecord(draft({ target: { kcal: Number.NaN, proteinG: 1, fatG: 1, carbG: 1 } }))).toContain('value-invalid');
    expect(validateTargetRecord(draft({ target: { kcal: 2400, proteinG: 150, fatG: 70, carbG: 0 } }))).toEqual([]);
  });
  it('plancher (§ 15.2, D-74 point 7) : sous 800 kcal refusé, sous 1 200 kcal seulement avec confirmation explicite', () => {
    const at = (kcal: number, confirmed = false) => validateTargetRecord(draft({ target: { kcal, proteinG: 100, fatG: 50, carbG: 100 }, lowFloorConfirmed: confirmed }));
    expect(at(799, true)).toContain('kcal-below-minimum');
    expect(at(1100)).toContain('confirmation-required');
    expect(at(1100, true)).toEqual([]);
    expect(at(1200)).toEqual([]);
    expect(at(800, true)).toEqual([]);
  });
  it('plafond de plausibilité : au-delà de 10 000 kcal refusé', () => {
    expect(validateTargetRecord(draft({ target: { kcal: 10001, proteinG: 1, fatG: 1, carbG: 1 } }))).toContain('value-invalid');
  });
  it('proposition refusée (accepted = false) : conservée telle quelle, le plancher ne s’applique pas à la trace', () => {
    expect(validateTargetRecord(draft({ accepted: false, target: { kcal: 1100, proteinG: 100, fatG: 50, carbG: 100 } }))).toEqual([]);
  });
});

/** HLC synthétique : `<ms 15 chiffres>-<compteur>-<appareil>` ; l'ordre des chaînes est l'ordre causal. */
const hlcAt = (ms: number, counter = 0, device = '60000000-0000-4000-8000-0000000000a1'): Hlc =>
  `${String(ms).padStart(15, '0')}-${counter.toString(16).padStart(4, '0')}-${device}` as Hlc;

describe('effectiveTarget : parmi les lignes acceptées dont la semaine a commencé, la dernière décision (HLC) l’emporte', () => {
  const rec = (id: string, weekStart: string, kcal: number, accepted: boolean, createdAt: string, hlc: Hlc = hlcAt(Date.parse(createdAt))): TargetRecord => ({
    id,
    weekStart: weekStart as LocalDate,
    target: { kcal, proteinG: 150, fatG: 70, carbG: 250 },
    source: 'auto',
    accepted,
    createdAt: createdAt as IsoDateTime,
    hlc,
  });
  const records = [
    rec('a', '2026-10-26', 2300, true, '2026-10-26T08:00:00.000Z'),
    rec('b', '2026-11-02', 2400, true, '2026-11-02T08:00:00.000Z'),
    rec('c', '2026-11-02', 2200, false, '2026-11-02T09:00:00.000Z'), // refusée : ignorée
    rec('d', '2026-11-16', 2500, true, '2026-11-09T08:00:00.000Z'), // future
  ];

  it('I4-08 point 8 : check-in du lundi accepté le mercredi, cible fixée le mardi : l’acceptation (plus récente) s’applique', () => {
    const manualTuesday = { ...rec('m', '2026-11-03', 2500, true, '2026-11-03T09:00:00.000Z'), source: 'manual' as const };
    const acceptedWednesday = rec('w', '2026-11-02', 2300, true, '2026-11-04T09:00:00.000Z');
    const both = [manualTuesday, acceptedWednesday];
    expect(effectiveTarget(both, '2026-11-04' as LocalDate)?.id).toBe('w');
    expect(effectiveTarget(both, '2026-11-03' as LocalDate)?.id).toBe('w');
    expect(effectiveTarget(both, '2026-11-02' as LocalDate)?.id).toBe('w');
    expect(effectiveTarget([manualTuesday], '2026-11-02' as LocalDate)).toBeNull();
  });

  it('I4-08 point 8 : deux appareils, created_at trompeur (horloge en avance), HLC juste : la décision la plus récente gagne', () => {
    const early = rec('p', '2026-11-02', 2500, true, '2026-11-20T08:00:00.000Z', hlcAt(Date.parse('2026-11-03T09:00:00.000Z'), 0, '60000000-0000-4000-8000-0000000000b2'));
    const late = rec('q', '2026-11-02', 2300, true, '2026-11-01T08:00:00.000Z', hlcAt(Date.parse('2026-11-04T09:00:00.000Z'), 0, '60000000-0000-4000-8000-0000000000a1'));
    expect(effectiveTarget([early, late], '2026-11-08' as LocalDate)?.id).toBe('q');
    expect(effectiveTarget([late, early], '2026-11-08' as LocalDate)?.id).toBe('q');
  });

  it('I4-08 point 8 : à milliseconde égale, le compteur puis l’appareil départagent ; l’ordre d’entrée est sans effet', () => {
    const c1 = rec('x', '2026-11-02', 1, true, '2026-11-03T08:00:00.000Z', hlcAt(5, 1));
    const c2 = rec('y', '2026-11-02', 2, true, '2026-11-03T08:00:00.000Z', hlcAt(5, 2));
    expect(effectiveTarget([c1, c2], '2026-11-08' as LocalDate)?.id).toBe('y');
    expect(effectiveTarget([c2, c1], '2026-11-08' as LocalDate)?.id).toBe('y');
  });

  it('I4-08 point 8 : une cible dont la semaine est postérieure n’est jamais retenue, même la plus récente', () => {
    const future = rec('f', '2026-11-16', 2800, true, '2026-11-09T08:00:00.000Z', hlcAt(Date.parse('2027-01-01T00:00:00.000Z')));
    expect(effectiveTarget([...records, future], '2026-11-08' as LocalDate)?.id).toBe('b');
    expect(effectiveTarget([future], '2026-11-08' as LocalDate)).toBeNull();
  });

  it('I4-08 point 8 : manuelle du jour plus ancienne (HLC) qu’une acceptation d’une semaine antérieure : l’acceptation l’emporte', () => {
    const manualToday = { ...rec('m', '2026-11-04', 2500, true, '2026-11-04T08:00:00.000Z'), source: 'manual' as const };
    const acceptedBefore = rec('a2', '2026-11-02', 2300, true, '2026-11-04T09:00:00.000Z');
    expect(effectiveTarget([manualToday, acceptedBefore], '2026-11-04' as LocalDate)?.id).toBe('a2');
  });
  it('ignore les refusées et les semaines à venir', () => {
    expect(effectiveTarget(records, '2026-11-08' as LocalDate)?.id).toBe('b');
    expect(effectiveTarget(records, '2026-11-16' as LocalDate)?.id).toBe('d');
  });
  it('aucune cible avant la première : null', () => {
    expect(effectiveTarget(records, '2026-10-01' as LocalDate)).toBeNull();
    expect(effectiveTarget([], '2026-11-08' as LocalDate)).toBeNull();
  });
  it('même semaine : la décision la plus récente (modification d’Ali) l’emporte', () => {
    const later = [...records, rec('e', '2026-11-02', 2350, true, '2026-11-03T08:00:00.000Z')];
    expect(effectiveTarget(later, '2026-11-08' as LocalDate)?.id).toBe('e');
  });
});

describe('FIX-0244 (D-291) : collapseRecopies fusionne la recopie d’une cible avec la décision précédente de la même semaine', () => {
  const rec = (id: string, week: string, kcal: number, ms: number, over: Partial<TargetRecord & { engineVersion: number | null }> = {}) => ({
    id,
    weekStart: week as LocalDate,
    target: { kcal, proteinG: 170, fatG: 75, carbG: 340 },
    source: 'auto' as const,
    accepted: true,
    engineVersion: 1 as number | null,
    createdAt: '2026-11-15T08:00:00.000Z' as IsoDateTime,
    hlc: hlcAt(ms),
    ...over,
  });
  const plan = { rest: { kcal: 2250, proteinG: 170, fatG: 75, carbG: 290 }, trainingDays: [1, 2] as never };

  it('mêmes valeurs, même source, même semaine : une seule ligne (la plus récente), peu importe le plan', () => {
    const original = rec('o', '2026-11-16', 2450, 1);
    const copy = rec('c', '2026-11-16', 2450, 3, { restPlan: plan });
    expect(collapseRecopies([copy, original]).map((r) => r.id)).toEqual(['c']);
    expect(collapseRecopies([original, copy]).map((r) => r.id)).toEqual(['c']);
  });

  it('valeurs, source, acceptation ou version différentes : lignes conservées', () => {
    const base = rec('o', '2026-11-16', 2450, 1);
    expect(collapseRecopies([rec('k', '2026-11-16', 2500, 3), base]).length).toBe(2);
    expect(collapseRecopies([rec('k', '2026-11-16', 2450, 3, { source: 'manual', engineVersion: null }), base]).length).toBe(2);
    expect(collapseRecopies([rec('k', '2026-11-16', 2450, 3, { accepted: false }), base]).length).toBe(2);
    expect(collapseRecopies([rec('k', '2026-11-23', 2450, 3), base]).length).toBe(2);
  });

  it('une autre décision entre deux identiques de la même semaine : rien n’est fusionné', () => {
    const a = rec('a', '2026-11-16', 2450, 1);
    const b = rec('b', '2026-11-16', 2600, 2, { source: 'manual', engineVersion: null });
    const c = rec('c', '2026-11-16', 2450, 3);
    expect(collapseRecopies([c, b, a]).map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });

  it('plusieurs recopies d’affilée : une seule ligne ; l’ordre d’entrée est conservé', () => {
    const rows = [rec('z', '2026-11-09', 2600, 9), rec('c2', '2026-11-16', 2450, 5), rec('c1', '2026-11-16', 2450, 4), rec('o', '2026-11-16', 2450, 1)];
    expect(collapseRecopies(rows).map((r) => r.id)).toEqual(['z', 'c2']);
  });
});

describe('ERGO-03 (D-295) : upcomingTargets, cibles à venir après aujourd’hui', () => {
  const TODAY = '2026-11-12' as LocalDate;
  const rec = (id: string, week: string, kcal: number, ms: number, accepted = true) => ({ id, weekStart: week as LocalDate, target: { kcal, proteinG: 190, fatG: 75, carbG: 250 }, accepted, hlc: hlcAt(ms) });
  const current = rec('now', '2026-11-09', 2600, 1_000);

  it('aucune cible future : rien', () => {
    expect(upcomingTargets([current], TODAY)).toEqual([]);
  });

  it('une cible acceptée au lundi 16/11 : elle est à venir', () => {
    expect(upcomingTargets([current, rec('f', '2026-11-16', 2450, 500)], TODAY).map((r) => r.id)).toEqual(['f']);
  });

  it('plusieurs cibles futures : dans l’ordre des dates (la plus proche d’abord), chacune en vigueur à sa date', () => {
    const list = [rec('b', '2026-11-23', 2300, 600), current, rec('a', '2026-11-16', 2450, 500)];
    expect(upcomingTargets(list, TODAY).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('une décision plus récente d’aujourd’hui masque la cible future : elle n’est plus à venir', () => {
    const today = rec('t', '2026-11-12', 2700, 2_000);
    expect(upcomingTargets([current, rec('f', '2026-11-16', 2450, 500), today], TODAY)).toEqual([]);
  });

  it('une proposition refusée, ou datée d’aujourd’hui, n’est pas à venir', () => {
    expect(upcomingTargets([current, rec('r', '2026-11-16', 2450, 500, false), rec('t', '2026-11-12', 2500, 3_000)], TODAY)).toEqual([]);
  });

  it('deux décisions de la même date future : la plus récente seulement', () => {
    expect(upcomingTargets([current, rec('f1', '2026-11-16', 2450, 500), rec('f2', '2026-11-16', 2400, 700)], TODAY).map((r) => r.id)).toEqual(['f2']);
  });
});
