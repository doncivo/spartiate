import { describe, expect, it } from 'vitest';
import type { IsoDateTime, LocalDate } from '../types';
import { effectiveTarget, validateTargetRecord, type TargetRecord, type TargetRecordDraft } from './targetRecord';

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

describe('effectiveTarget : dernière cible acceptée dont la semaine a commencé', () => {
  const rec = (id: string, weekStart: string, kcal: number, accepted: boolean, createdAt: string): TargetRecord => ({
    id,
    weekStart: weekStart as LocalDate,
    target: { kcal, proteinG: 150, fatG: 70, carbG: 250 },
    source: 'auto',
    accepted,
    createdAt: createdAt as IsoDateTime,
  });
  const records = [
    rec('a', '2026-10-26', 2300, true, '2026-10-26T08:00:00.000Z'),
    rec('b', '2026-11-02', 2400, true, '2026-11-02T08:00:00.000Z'),
    rec('c', '2026-11-02', 2200, false, '2026-11-02T09:00:00.000Z'), // refusée : ignorée
    rec('d', '2026-11-16', 2500, true, '2026-11-09T08:00:00.000Z'), // future
  ];
  it('ignore les refusées et les semaines à venir', () => {
    expect(effectiveTarget(records, '2026-11-08' as LocalDate)?.id).toBe('b');
    expect(effectiveTarget(records, '2026-11-16' as LocalDate)?.id).toBe('d');
  });
  it('aucune cible avant la première : null', () => {
    expect(effectiveTarget(records, '2026-10-01' as LocalDate)).toBeNull();
    expect(effectiveTarget([], '2026-11-08' as LocalDate)).toBeNull();
  });
  it('même semaine : la décision la plus récente (modification d’Ali) l’emporte, puis l’identifiant', () => {
    const later = [...records, rec('e', '2026-11-02', 2350, true, '2026-11-03T08:00:00.000Z')];
    expect(effectiveTarget(later, '2026-11-08' as LocalDate)?.id).toBe('e');
    const tie = [rec('x', '2026-11-02', 1, true, '2026-11-03T08:00:00.000Z'), rec('y', '2026-11-02', 2, true, '2026-11-03T08:00:00.000Z')];
    expect(effectiveTarget(tie, '2026-11-08' as LocalDate)?.id).toBe('y');
  });
});
