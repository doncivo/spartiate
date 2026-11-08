import { describe, expect, it } from 'vitest';

import type { LocalDate, LocalTime } from '../types';
import { aggregateDay, aggregateDays } from './dayTotals';
import type { MealEntryInput } from './types';

const day = '2026-09-07' as LocalDate;
const e = (time: string, kcal: number | null, over: Partial<MealEntryInput> = {}): MealEntryInput => ({
  date: day,
  time: time as LocalTime,
  kcal,
  proteinG: 10,
  fatG: 5,
  carbG: 20,
  ...over,
});

describe('aggregateDay : complétude (§ 15.2)', () => {
  it('3 entrées sur 9 h : jour complet inféré, 1 800 kcal', () => {
    const t = aggregateDay(day, [e('08:00', 500), e('12:00', 700), e('17:00', 600)]);
    expect(t.state).toBe('complete');
    expect(t.origin).toBe('inferred');
    expect(t.kcal).toBe(1800);
    expect(t.spanHours).toBe(9);
    expect(t.usableForTdee).toBe(true);
    expect(t.reasons).toContain('inferred-complete');
  });

  it('aucune entrée : unknown, jamais 0', () => {
    const t = aggregateDay(day, []);
    expect(t.state).toBe('unknown');
    expect(t.origin).toBe('none');
    expect(t.kcal).toBeNull();
    expect(t.proteinG).toBeNull();
    expect(t.fatG).toBeNull();
    expect(t.carbG).toBeNull();
    expect(t.spanHours).toBeNull();
    expect(t.usableForTdee).toBe(false);
    expect(t.reasons).toContain('no-entries');
  });

  it('3 entrées de 08:00 à 15:00 : partial (7 h), le total loggé reste exposé', () => {
    const t = aggregateDay(day, [e('08:00', 500), e('12:00', 700), e('15:00', 600)]);
    expect(t.state).toBe('partial');
    expect(t.kcal).toBe(1800);
    expect(t.usableForTdee).toBe(false);
    expect(t.reasons).toContain('span-too-short');
  });

  it('borne exacte de 8 h : complet ; 7 h 59 : partiel', () => {
    expect(aggregateDay(day, [e('08:00', 1), e('10:00', 1), e('16:00', 1)]).state).toBe('complete');
    expect(aggregateDay(day, [e('08:00', 1), e('10:00', 1), e('15:59', 1)]).state).toBe('partial');
  });

  it('2 entrées sur 10 h : partiel (moins de 3 entrées)', () => {
    const t = aggregateDay(day, [e('08:00', 500), e('18:00', 700)]);
    expect(t.state).toBe('partial');
    expect(t.reasons).toContain('too-few-entries');
  });

  it("l'ordre des entrées n'importe pas", () => {
    const t = aggregateDay(day, [e('17:00', 600), e('08:00', 500), e('12:00', 700)]);
    expect(t.state).toBe('complete');
    expect(t.spanHours).toBe(9);
  });

  it('les entrées d\'une autre date sont ignorées', () => {
    const other = e('09:00', 999, { date: '2026-09-08' as LocalDate });
    expect(aggregateDay(day, [other]).state).toBe('unknown');
  });
});

describe('aggregateDay : déclaration prioritaire (D-74)', () => {
  it('déclaré complet avec une seule entrée : complete, origine declared', () => {
    const t = aggregateDay(day, [e('08:00', 800)], 'complete');
    expect(t.state).toBe('complete');
    expect(t.origin).toBe('declared');
    expect(t.kcal).toBe(800);
    expect(t.usableForTdee).toBe(true);
  });

  it('déclaré incomplet l\'emporte sur une inférence complète', () => {
    const t = aggregateDay(day, [e('08:00', 500), e('12:00', 700), e('17:00', 600)], 'incomplete');
    expect(t.state).toBe('partial');
    expect(t.origin).toBe('declared');
    expect(t.usableForTdee).toBe(false);
    expect(t.reasons).toContain('declared-incomplete');
  });

  it('déclaré complet sans entrée : unknown (jamais zéro consommé)', () => {
    const t = aggregateDay(day, [], 'complete');
    expect(t.state).toBe('unknown');
    expect(t.kcal).toBeNull();
    expect(t.reasons).toContain('declared-without-entries');
  });

  it('déclaré incomplet sans entrée : unknown', () => {
    expect(aggregateDay(day, [], 'incomplete').state).toBe('unknown');
  });
});

describe('aggregateDay : valeurs inconnues', () => {
  it('une entrée sans énergie rend le total inconnu et le jour inutilisable pour le TDEE', () => {
    const t = aggregateDay(day, [e('08:00', 500), e('12:00', null), e('17:00', 600)]);
    expect(t.state).toBe('complete');
    expect(t.kcal).toBeNull();
    expect(t.usableForTdee).toBe(false);
    expect(t.reasons).toContain('unknown-values');
  });

  it('les macros se somment indépendamment : une macro inconnue ne contamine pas les autres', () => {
    const t = aggregateDay(day, [e('08:00', 500), e('12:00', 700, { proteinG: null }), e('17:00', 600)]);
    expect(t.proteinG).toBeNull();
    expect(t.fatG).toBe(15);
    expect(t.carbG).toBe(60);
  });

  it('une valeur négative ou non finie compte comme inconnue', () => {
    expect(aggregateDay(day, [e('08:00', -5)]).kcal).toBeNull();
    expect(aggregateDay(day, [e('08:00', Number.NaN)]).kcal).toBeNull();
  });

  it('0 kcal saisi explicitement reste 0 (valeur connue)', () => {
    expect(aggregateDay(day, [e('08:00', 0)]).kcal).toBe(0);
  });
});

describe('aggregateDays', () => {
  it('produit un jour par date de la plage, inclusive, y compris les jours sans entrée', () => {
    const entries = [e('08:00', 500)];
    const list = aggregateDays('2026-09-07' as LocalDate, '2026-09-09' as LocalDate, entries, {
      '2026-09-08': 'complete',
    });
    expect(list.map((d) => d.date)).toEqual(['2026-09-07', '2026-09-08', '2026-09-09']);
    expect(list.map((d) => d.state)).toEqual(['partial', 'unknown', 'unknown']);
    expect(list[1]?.kcal).toBeNull();
  });
});
