// FIX-RECUP (lot 0.28.0) : constats C-049, C-050, C-052 de l'audit Claude 0.27.0 (preuve partie6-recuperation.test.ts), vecteurs recalculés à la main.
// Données synthétiques (D-38).
import { describe, expect, it } from 'vitest';
import { buildBaseline } from './baseline';
import { bedtimeProposal } from './bedtimeProposal';
import { recoveryScore } from './recoveryScore';
import { parseShortcutSteps } from './shortcutFiles';
import type { NightRecord } from './types';

const night = (day: string, hrvMs: number | null, restingHr: number | null = 60, asleepMinutes: number | null = 450, wakeMinutes: number | null = 420): NightRecord => ({
  day, hrvMs, restingHr, asleepMinutes, bedtimeMinutes: null, wakeMinutes,
});
const dd = (m: number, d: number): string => `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

describe('C-049 baseline : une aberrante est jugée contre la moyenne et le σ des autres valeurs', () => {
  const seven = [48, 50, 52, 50, 48, 52, 200];
  it('7 nuits HRV [48, 50, 52, 50, 48, 52, 200] : 200 exclu, moyenne 50, σ √(16/5)', () => {
    const b = buildBaseline(seven.map((v, i) => night(dd(3, i + 1), v)), '2026-03-10', 'hrvMs');
    expect([b.validNights, b.stats.excluded, b.stats.used, b.stats.mean]).toEqual([7, 1, 6, 50]);
    expect(b.stats.sd).toBeCloseTo(Math.sqrt(16 / 5), 6);
  });
  it('nuit suivante HRV 30, FC 60 : score calculé (7 nuits valides), z HRV ≈ −11,18, brut borné à −2, score 0 (journée rouge)', () => {
    const nights = [...seven.map((v, i) => night(dd(3, i + 1), v, i % 2 ? 62 : 58)), night('2026-03-10', 30, 60)];
    const r = recoveryScore({ today: '2026-03-10', nights, sleepRatio: 1 });
    expect(r.reason).toBeNull();
    expect(r.zHrv as number).toBeCloseTo(-20 / Math.sqrt(16 / 5), 6);
    expect([r.raw, r.score, r.excludedOutliers, r.baselineNights]).toEqual([-2, 0, 1, 7]);
  });
  it('vecteur inchangé : 14 nuits HRV 45 / 55, rien d’exclu, moyenne 50, σ √(350/13) ; Recovery 67 (ratio 0,9) et 74 (ratio 1)', () => {
    const base14 = Array.from({ length: 14 }, (_, i) => night(dd(3, i + 1), i % 2 ? 55 : 45, i % 2 ? 62 : 58));
    const b = buildBaseline(base14, '2026-03-15', 'hrvMs');
    expect([b.validNights, b.stats.mean, b.stats.excluded]).toEqual([14, 50, 0]);
    expect(b.stats.sd).toBeCloseTo(Math.sqrt(350 / 13), 6);
    const nights = [...base14, night('2026-03-15', 55, 58)];
    expect(recoveryScore({ today: '2026-03-15', nights, sleepRatio: 0.9 }).score).toBe(67);
    expect(recoveryScore({ today: '2026-03-15', nights, sleepRatio: 1 }).score).toBe(74);
  });
  it('σ des autres valeurs nul (6 × 52 et un 53) : rien n’est exclu, jamais une baseline à σ = 0 fabriquée par l’exclusion', () => {
    const b = buildBaseline([52, 52, 52, 52, 52, 52, 53].map((v, i) => night(dd(3, i + 1), 50, v)), '2026-03-10', 'restingHr');
    expect([b.stats.excluded, b.stats.used]).toEqual([0, 7]);
    expect(b.stats.sd as number).toBeGreaterThan(0);
  });
  it('une aberrante haute et une basse : seule celle qui s’écarte des 6 autres est exclue ; deux aberrantes proches se masquent (limite connue)', () => {
    // 30 et 200, chacune jugée contre les 6 autres (vérifié à la main : 200 contre [30, 48, 50, 52, 50, 48] : σ ≈ 8,14, z ≈ 18,9 ; 30 contre [48, 50, 52, 50, 48, 200] : σ ≈ 61,4, z ≈ −0,73).
    const values = [48, 50, 52, 50, 48, 200, 30];
    const b = buildBaseline(values.map((v, i) => night(dd(3, i + 1), v)), '2026-03-10', 'hrvMs');
    expect(b.stats.excluded).toBe(1);
    const many = [49, 50, 51, 50, 49, 51, 50, 200, 210].map((v, i) => night(dd(3, i + 1), v, i % 2 ? 62 : 58));
    // 200 et 210 se masquent l'une l'autre (chacune jugée contre un σ qui contient l'autre) : limite connue, rien n'est exclu.
    expect(buildBaseline(many, '2026-03-12', 'hrvMs').stats.excluded).toBe(0);
  });
});

describe('C-050 proposition d’heure de coucher : seules les nuits valides (≥ 180 min) font la dette', () => {
  it('13 nuits de 450 min, nuit du jour de 120 min sans lever : besoin 450, coucher 23:30', () => {
    const nights = Array.from({ length: 14 }, (_, i) => (i === 13 ? night(dd(3, 20), null, null, 120, null) : night(dd(3, 7 + i), 50)));
    const p = bedtimeProposal({ nights, today: '2026-03-20', exertionToday: 0 });
    expect([p.needMinutes, p.time]).toEqual([450, '23:30']);
  });
  it('nuit du jour VALIDE de 400 min : comptée dans la dette de la nuit à venir (+50) → besoin 500, coucher 22:40', () => {
    const nights = Array.from({ length: 14 }, (_, i) => night(dd(3, 7 + i), 50, 60, i === 13 ? 400 : 450));
    const p = bedtimeProposal({ nights, today: '2026-03-20', exertionToday: 0 });
    expect([p.needMinutes, p.time]).toEqual([500, '22:40']);
  });
  it('nuit de 179 min dans la fenêtre : jamais une dette ; nuit de 180 min : comptée (+270, dette bornée à 180)', () => {
    const at = (m: number) => Array.from({ length: 14 }, (_, i) => night(dd(3, 7 + i), 50, 60, i === 10 ? m : 450));
    expect(bedtimeProposal({ nights: at(179), today: '2026-03-20', exertionToday: 0 }).needMinutes).toBe(450);
    expect(bedtimeProposal({ nights: at(180), today: '2026-03-20', exertionToday: 0 }).needMinutes).toBe(630);
  });
});

describe('C-052 pas.csv : les jours récents sont gardés, le jour le plus ancien est signalé partiel', () => {
  const minuteLines = (day: string, count: number): string[] =>
    Array.from({ length: count }, (_, i) => {
      const s = i % 60;
      const m = Math.floor(i / 60) % 60;
      const h = Math.floor(i / 3600);
      return `${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}+01:00;1;count`;
    });
  it('10 000 lignes du 01/11 puis une du 02/11 : le 02/11 est présent, le fichier est dit tronqué, le 01/11 est partiel', () => {
    const text = [...minuteLines('2026-11-01', 10_000), '2026-11-02T08:00:00+01:00;500;count'].join('\n');
    const r = parseShortcutSteps(text, '2026-11-02', 'Europe/Paris');
    expect(r.truncated).toBe(true);
    expect(r.days).toEqual([{ day: '2026-11-01', steps: 9_999 }, { day: '2026-11-02', steps: 500 }]);
    expect(r.partialDay).toBe('2026-11-01');
  });
  it('fenêtre de plusieurs jours : le jour le plus ancien est partiel ; un fichier d’un seul jour, non tronqué, n’a pas de jour partiel', () => {
    const multi = parseShortcutSteps('2026-11-06T18:00:00+01:00;1200\n2026-11-07T12:00:00+01:00;8000\n2026-11-08T09:00:00+01:00;900', '2026-11-08', 'Europe/Paris');
    expect(multi.partialDay).toBe('2026-11-06');
    expect(parseShortcutSteps('2026-11-08T09:00:00+01:00;900', '2026-11-08', 'Europe/Paris').partialDay).toBeNull();
    expect(parseShortcutSteps('', '2026-11-08', 'Europe/Paris').partialDay).toBeNull();
  });
  it('en-tête en première ligne d’un fichier tronqué : jamais lu comme une donnée', () => {
    const text = ['date;valeur;unité', ...minuteLines('2026-11-01', 10_000), '2026-11-02T08:00:00+01:00;500;count'].join('\n');
    const r = parseShortcutSteps(text, '2026-11-02', 'Europe/Paris');
    expect(r.rejectedTotal).toBe(0);
    expect(r.days.at(-1)).toEqual({ day: '2026-11-02', steps: 500 });
  });
});
