// AUDIT-CLAUDE-0.27.0, partie 10 : mesures indicatives sur 3 ans de données synthétiques (D-38). Jamais branché sur la CI.
// Machine locale limitée et non représentative de l'iPhone : on rapporte les durées, le seuil est celui du PRD (§ 12.4 : < 1 s ; § 23.1).
import { describe, expect, it } from 'vitest';
import { input, session } from '../../../tests/fixtures/training/progression';
import { prescribe } from '../../../src/domain/training/prescribe';
import { generateSession } from '../../../src/domain/training/generateSession';
import { computeTrend } from '../../../src/domain/nutrition/weightTrend';
import { measuredTdee } from '../../../src/domain/nutrition/tdee';

const time = (f: () => void, n = 5): number => { const t: number[] = []; for (let i = 0; i < n; i += 1) { const s = performance.now(); f(); t.push(performance.now() - s); } return t.sort((a, b) => a - b)[Math.floor(n / 2)]!; };
const out: Record<string, number> = {};

describe('mesures (médiane de 5)', () => {
  it('prescription de 10 exercices, 156 séances (3 ans, 1 par semaine) de 4 séries chacun : < 1 s', () => {
    const history = Array.from({ length: 156 }, (_, i) => session(1 + i * 7, 60 + (i % 20) * 2.5, [8, 8, 8, 8]));
    out.prescribe10x156 = time(() => { for (let e = 0; e < 10; e += 1) prescribe(input({ history })); });
    expect(out.prescribe10x156).toBeLessThan(1000);
  });
  it('génération d’une séance (montage de test) : < 1 s', async () => {
    const { input: genInput } = await import('../../../tests/fixtures/training/generation');
    out.generate = time(() => { generateSession(genInput({ timeBudgetMin: 45 })); });
    expect(out.generate).toBeLessThan(1000);
  });
  it('tendance et dépense mesurée sur 3 ans de pesées et de journées : < 300 ms', () => {
    const weigh = Array.from({ length: 1095 }, (_, i) => ({ date: new Date(Date.UTC(2023, 10, 20) + i * 86_400_000).toISOString().slice(0, 10), kg: 80 + Math.sin(i / 30) }));
    const days = weigh.map((w) => ({ date: w.date, state: 'complete', origin: 'declared', entryCount: 4, spanHours: 10, kcal: 2500, proteinG: 150, fatG: 70, carbG: 300, usableForTdee: true, reasons: [] }));
    out.trend3y = time(() => { const t = computeTrend(weigh as never); measuredTdee({ days, trend: t, endDate: weigh[weigh.length - 1]!.date } as never); });
    expect(out.trend3y).toBeLessThan(300);
  });
  it('rapport', () => { console.log(`[audit-perf] ${JSON.stringify(out)}`); });
});
