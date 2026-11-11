import { describe, expect, it } from 'vitest';
import { FACTOR_CODES, FACTOR_MIN_DAYS, FACTOR_MIN_OCCURRENCES, FACTOR_MIN_WITHOUT, factorAnalysis, shiftFactorDay, type FactorDay } from './factors';

/**
 * I6-01 point B (§ 16.7, D-95) : écart moyen de Recovery avec et sans facteur. Le facteur du jour J est rapproché de la Recovery du jour J+1.
 * Seuls les jours avec un score comptent ; « rien de particulier » compte comme un jour sans facteur ; un jour non renseigné est exclu.
 */
const START = '2026-09-01';
const at = (n: number): string => shiftFactorDay(START, n);

/** `n` jours consécutifs renseignés ; `pick(i)` donne les facteurs du jour i (`none` si vide). */
function journal(n: number, pick: (i: number) => readonly (typeof FACTOR_CODES)[number][]): FactorDay[] {
  return Array.from({ length: n }, (_, i) => {
    const factors = pick(i);
    return { day: at(i), factors, none: factors.length === 0 };
  });
}
/** Recovery du jour J+1 de chaque jour renseigné : `score(i)` pour le jour i du journal. */
const recoveries = (n: number, score: (i: number) => number | null) => Array.from({ length: n }, (_, i) => ({ day: at(i + 1), recovery: score(i) }));

describe('constantes nommées (D-95)', () => {
  it('30 jours, 5 occurrences avec, 5 jours sans', () => {
    expect(FACTOR_MIN_DAYS).toBe(30);
    expect(FACTOR_MIN_OCCURRENCES).toBe(5);
    expect(FACTOR_MIN_WITHOUT).toBe(5);
  });
  it('huit codes fixes', () => {
    expect([...FACTOR_CODES]).toEqual(['alcohol', 'caffeine_late', 'late_meal', 'stress', 'soreness', 'illness', 'travel', 'late_training']);
  });
});

describe('factorAnalysis', () => {
  it('moins de 5 occurrences : rien à afficher pour ce facteur', () => {
    const j = journal(40, (i) => (i % 10 === 0 && i < 40 && i / 10 < 4 ? ['alcohol'] : [])); // 4 occurrences
    const result = factorAnalysis(j, recoveries(40, (i) => (j[i]?.factors.length ? 50 : 70)));
    expect(result.pairedDays).toBe(40);
    expect(result.enough).toBe(true);
    expect(result.associations).toEqual([]);
  });

  it('30 jours, un effet net : écart moyen (avec - sans), n avec et sans, arrondi à 0,1', () => {
    const j = journal(30, (i) => (i % 5 === 0 ? ['alcohol'] : [])); // 6 avec, 24 sans
    const result = factorAnalysis(j, recoveries(30, (i) => (i % 5 === 0 ? 52 : 70)));
    expect(result.enough).toBe(true);
    expect(result.associations).toEqual([{ factor: 'alcohol', withDays: 6, withoutDays: 24, withMean: 52, withoutMean: 70, difference: -18 }]);
  });

  it('aucun effet : écart nul, association tout de même affichée', () => {
    const j = journal(30, (i) => (i % 5 === 0 ? ['stress'] : []));
    const result = factorAnalysis(j, recoveries(30, () => 60));
    expect(result.associations).toEqual([{ factor: 'stress', withDays: 6, withoutDays: 24, withMean: 60, withoutMean: 60, difference: 0 }]);
  });

  it('moins de 30 jours exploitables : pas encore assez de données', () => {
    const j = journal(29, (i) => (i % 5 === 0 ? ['alcohol'] : []));
    const result = factorAnalysis(j, recoveries(29, (i) => (i % 5 === 0 ? 50 : 70)));
    expect(result).toEqual({ pairedDays: 29, enough: false, associations: [] });
  });

  it('un jour sans score le lendemain, ou jamais renseigné, ne compte pas', () => {
    const j = journal(40, (i) => (i % 5 === 0 ? ['alcohol'] : []));
    const unscored = recoveries(40, (i) => (i < 10 ? null : i % 5 === 0 ? 50 : 70)); // 10 jours sans score : 30 restent
    expect(factorAnalysis(j, unscored).pairedDays).toBe(30);
    const holes = j.filter((_, i) => i % 4 !== 3); // jours non renseignés : absents du journal
    expect(factorAnalysis(holes, recoveries(40, () => 60)).pairedDays).toBe(30);
  });

  it('« rien de particulier » compte comme jour sans facteur ; une ligne vide non marquée est exclue', () => {
    const j: FactorDay[] = [...journal(30, (i) => (i % 5 === 0 ? ['alcohol'] : [])), { day: at(30), factors: [], none: false }];
    const r = recoveries(31, (i) => (i % 5 === 0 ? 52 : 70));
    const result = factorAnalysis(j, r);
    expect(result.pairedDays).toBe(30);
    expect(result.associations[0]).toMatchObject({ factor: 'alcohol', withDays: 6, withoutDays: 24 });
  });

  it('le facteur du jour J se compare à la Recovery de J+1, pas de J', () => {
    const j = journal(30, (i) => (i % 5 === 0 ? ['alcohol'] : []));
    // La Recovery du jour J (même jour) est mauvaise, celle de J+1 est bonne : aucun écart attendu.
    const sameDay = Array.from({ length: 30 }, (_, i) => ({ day: at(i), recovery: i % 5 === 0 ? 30 : 70 }));
    const nextDay = Array.from({ length: 30 }, (_, i) => ({ day: at(i + 1), recovery: 70 }));
    expect(factorAnalysis(j, nextDay).associations[0]?.difference).toBe(0);
    expect(factorAnalysis(j, sameDay).associations[0]?.difference).toBeGreaterThan(0);
  });

  it('plusieurs facteurs le même jour comptent pour chacun ; tri par écart absolu décroissant ; moins de 5 jours sans : rien', () => {
    const j = journal(30, (i) => (i % 5 === 0 ? ['alcohol', 'travel'] : i % 5 === 1 ? ['travel'] : []));
    const result = factorAnalysis(j, recoveries(30, (i) => (i % 5 === 0 ? 40 : i % 5 === 1 ? 60 : 70)));
    expect(result.associations.map((a) => a.factor)).toEqual(['alcohol', 'travel']);
    const mostly = journal(30, (i) => (i < 27 ? ['stress'] : []));
    expect(factorAnalysis(mostly, recoveries(30, () => 60)).associations).toEqual([]); // 3 jours sans seulement
  });

  it('un facteur ignoré (jamais coché) n’apparaît pas ; aucune donnée : vide', () => {
    expect(factorAnalysis([], [])).toEqual({ pairedDays: 0, enough: false, associations: [] });
  });
});
