import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../types';
import { goTos, type GoToEntry } from './goTos';

/** BL-117 (§ 15.3) : « go-tos » = aliments pris souvent (au moins 3 fois sur 90 jours), du plus fréquent au moins ; ni Quick Add, ni jour futur. */
const e = (foodId: string | null, date: string, over: Partial<GoToEntry> = {}): GoToEntry => ({ foodId, foodName: foodId ?? 'Rapide', source: 'ciqual', grams: 100, date: date as LocalDate, time: '12:00', ...over });
const TODAY = '2026-11-20' as LocalDate;

describe('goTos', () => {
  it('au moins 3 prises : classés par nombre de prises, puis par dernière prise', () => {
    const entries = [e('a', '2026-11-01'), e('a', '2026-11-05'), e('a', '2026-11-09'), e('b', '2026-11-02'), e('b', '2026-11-03'), e('b', '2026-11-04'), e('b', '2026-11-10'), e('c', '2026-11-10'), e('c', '2026-11-11')];
    expect(goTos(entries, TODAY).map((g) => [g.foodId, g.count])).toEqual([['b', 4], ['a', 3]]);
  });
  it('Quick Add (sans aliment) jamais compté ; au-delà de 90 jours et jours futurs ignorés', () => {
    const entries = [e(null, '2026-11-01'), e(null, '2026-11-02'), e(null, '2026-11-03'), e('a', '2026-07-01'), e('a', '2026-07-02'), e('a', '2026-07-03'), e('b', '2026-11-25'), e('b', '2026-11-26'), e('b', '2026-11-27')];
    expect(goTos(entries, TODAY)).toEqual([]);
  });
  it('quantité habituelle : la dernière ; limite de 6', () => {
    const entries = [e('a', '2026-11-01', { grams: 80 }), e('a', '2026-11-02', { grams: 120 }), e('a', '2026-11-03', { grams: 150 })];
    expect(goTos(entries, TODAY)[0]).toMatchObject({ foodId: 'a', lastGrams: 150 });
    const many = 'abcdefgh'.split('').flatMap((id) => [e(id, '2026-11-01'), e(id, '2026-11-02'), e(id, '2026-11-03')]);
    expect(goTos(many, TODAY)).toHaveLength(6);
  });
});
