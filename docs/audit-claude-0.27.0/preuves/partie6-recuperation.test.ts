// AUDIT-CLAUDE-0.27.0, partie 6 : récupération et dossier Santé. Jamais branché sur la CI. Données synthétiques (D-38).
// « ROUGE C-xxx » : assertion attendue, l'échec est la preuve. « VECTEUR » : valeur recalculée à la main, attendue verte.
import { describe, expect, it } from 'vitest';
import { buildBaseline } from '../../../src/domain/recovery/baseline';
import { recoveryScore } from '../../../src/domain/recovery/recoveryScore';
import { bedtimeProposal } from '../../../src/domain/recovery/bedtimeProposal';
import { dayExertion } from '../../../src/domain/recovery/exertion';
import { sleepNeed } from '../../../src/domain/recovery/sleepNeed';
import { muscleRecovery } from '../../../src/domain/recovery/muscleRecovery';
import { buildSleepNights, parseShortcutHrv, parseShortcutRestingHr, parseShortcutSleep, parseShortcutSteps } from '../../../src/domain/recovery/shortcutFiles';
import { parseShortcutWeights } from '../../../src/domain/health/shortcutWeights';
import { parseBodyFile } from '../../../src/domain/health/bodyShortcutFiles';

const night = (day: string, hrvMs: number | null, restingHr: number | null = 60, asleepMinutes: number | null = 450, wakeMinutes: number | null = 420) => ({ day, hrvMs, restingHr, asleepMinutes, bedtimeMinutes: null, wakeMinutes });
const dd = (m: number, d: number) => `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

describe('C-049 baseline : exclusion > 2,5 σ sans effet sur un petit échantillon', () => {
  it('ROUGE 7 nuits HRV [48, 50, 52, 50, 48, 52, 200] : 200 exclu', () => {
    const nights = [48, 50, 52, 50, 48, 52, 200].map((v, i) => night(dd(3, i + 1), v));
    expect(buildBaseline(nights, '2026-03-10', 'hrvMs').stats.excluded).toBe(1);
  });
  it('ROUGE conséquence : nuit à HRV 30 (≈ −11 σ de la baseline sans l’aberrante), FC repos dans sa moyenne → z HRV borné à −2', () => {
    const nights = [...[48, 50, 52, 50, 48, 52, 200].map((v, i) => night(dd(3, i + 1), v, i % 2 ? 62 : 58)), night('2026-03-10', 30, 60)];
    const r = recoveryScore({ today: '2026-03-10', nights, sleepRatio: 1 } as never);
    expect(r.score).not.toBeNull();
    expect(r.zHrv as number).toBeLessThanOrEqual(-2);
  });
});

describe('C-050 proposition d’heure de coucher : nuit courte non valide comptée dans la dette', () => {
  it('ROUGE 14 nuits de 450 min, dernière de 120 min (< 180, non valide) : besoin 450, coucher 23:30', () => {
    const nights = Array.from({ length: 14 }, (_, i) => (i === 13 ? night(dd(3, 20), null, null, 120, null) : night(dd(3, 7 + i), 50)));
    const p = bedtimeProposal({ nights, today: '2026-03-20', exertionToday: 0 } as never);
    expect([p.needMinutes, p.time]).toEqual([450, '23:30']);
  });
});

describe('C-051 Exertion : séance à date illisible', () => {
  it('ROUGE une séance sans `endedAt` lisible ne fait pas planter le résumé', () => {
    expect(() => dayExertion([{ endedAt: '', sets: [] }] as never, '2026-03-29', 'Europe/Paris')).not.toThrow();
  });
});

describe('C-052 pas.csv tronqué à 10 000 lignes en gardant les plus anciennes', () => {
  it('ROUGE 10 000 lignes du 01/11 puis une du 02/11 : le jour le plus récent est conservé', () => {
    const lines: string[] = [];
    for (let i = 0; i < 10_000; i += 1) {
      const s = i % 60, m = Math.floor(i / 60) % 60, h = Math.floor(i / 3600);
      lines.push(`2026-11-01T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}+01:00;1;count`);
    }
    lines.push('2026-11-02T08:00:00+01:00;500;count');
    const r = parseShortcutSteps(lines.join('\n'), '2026-11-02', 'Europe/Paris');
    expect(r.days.map((d) => d.day)).toContain('2026-11-02');
  });
});

describe('C-053 fuseau invalide', () => {
  it('ROUGE « jamais d’exception » : fuseau inconnu → rejet, pas d’exception', () => {
    expect(() => parseShortcutHrv('2026-11-19T06:10:00+01:00;48;ms', '2026-11-19', 'Mars/Olympus')).not.toThrow();
  });
});

describe('C-054 poids.csv avec 3e colonne vide (sélecteur)', () => {
  it('ROUGE `…;81.4;` accepté comme le lecteur du dossier', () => {
    expect(parseShortcutWeights('2026-11-08T06:50:00+01:00;81.4;', '2026-11-08', 'Europe/Paris').weights.length).toBe(1);
  });
});

describe('VECTEURS récupération recalculés à la main', () => {
  const base14 = Array.from({ length: 14 }, (_, i) => night(dd(3, i + 1), i % 2 ? 55 : 45, i % 2 ? 62 : 58));
  it('baseline 14 nuits HRV 45/55 : moyenne 50, σ √(350/13)', () => {
    const b = buildBaseline(base14, '2026-03-15', 'hrvMs');
    expect([b.validNights, b.stats.mean, b.stats.excluded]).toEqual([14, 50, 0]);
    expect(b.stats.sd).toBeCloseTo(Math.sqrt(350 / 13), 3);
  });
  it('Recovery : z ≈ 0,9636 → round((50 + 24,09) × 0,9) = 67 ; ratio 1 → 74', () => {
    const nights = [...base14, night('2026-03-15', 55, 58)];
    expect(recoveryScore({ today: '2026-03-15', nights, sleepRatio: 0.9 } as never).score).toBe(67);
    expect(recoveryScore({ today: '2026-03-15', nights, sleepRatio: 1 } as never).score).toBe(74);
  });
  it('besoin de sommeil : base 450, Exertion 6 → +12, dette nette 120', () => {
    expect(sleepNeed({ exertionPrevDay: 6, previousAsleepMinutes: [360, 420, 480, 540, 300, 450, 600] })).toMatchObject({ baseMinutes: 450, exertionMinutes: 12, debtMinutes: 120, needMinutes: 582 });
  });
  it('nuit à cheval sur le passage à l’heure d’hiver (25/10) : 540 min, rattachée au réveil', () => {
    const n = buildSleepNights([{ start: '2026-10-24T21:00:00.000Z', end: '2026-10-25T06:00:00.000Z', stage: 'core' }] as never, 'Europe/Paris');
    expect(n.nights[0]).toMatchObject({ day: '2026-10-25', asleepMinutes: 540 });
  });
  it('fichier sommeil avec stades et « Éveillé » le 25/10 : 520 min endormi, 565 au lit', () => {
    const text = ['2026-10-24T23:00:00+02:00;2026-10-25T02:00:00+01:00;Principal', '2026-10-25T02:00:00+01:00;2026-10-25T03:00:00+01:00;Profond', '2026-10-25T03:00:00+01:00;2026-10-25T03:20:00+01:00;Éveillé', '2026-10-25T03:20:00+01:00;2026-10-25T07:00:00+01:00;Paradoxal', '2026-10-24T22:45:00+02:00;2026-10-25T07:10:00+01:00;Au lit'].join('\n');
    const r = buildSleepNights(parseShortcutSleep(text, '2026-10-25', 'Europe/Paris').segments, 'Europe/Paris');
    expect(r.nights[0]).toMatchObject({ day: '2026-10-25', asleepMinutes: 520, inBedMinutes: 565 });
  });
  it('muscle : 6 séries de quadriceps, 96 h de récupération → 25 % à 24 h (au travers du changement d’heure)', () => {
    const sets = Array.from({ length: 6 }, () => ({ kg: 100, reps: 5, difficulty: 'ok', isWarmup: false, completed: true, muscles: [{ id: 'quads', weight: 1 }] }));
    const rows = muscleRecovery({ workouts: [{ endedAt: '2026-03-28T18:00:00.000Z', sets }] as never, now: '2026-03-29T18:00:00.000Z' });
    expect(rows.find((r) => (r as { muscleId?: string }).muscleId === 'quads' || (r as { id?: string }).id === 'quads')).toMatchObject({ percent: 25 });
  });
  it('fichiers Santé : HRV à virgule, BOM, CRLF, doublon, sans fuseau ; FC ; pesées au changement d’heure ; livres ; masse grasse en fraction', () => {
    const hrv = parseShortcutHrv('﻿date;valeur;unité\r\n2026-11-19T06:10:00+01:00;48,56;ms\r\n2026-11-19T06:10:00+01:00;48,56;ms\r\n2026-11-19T06:10:00;50;ms', '2026-11-19', 'Europe/Paris');
    expect(hrv.samples).toEqual([{ measuredAt: '2026-11-19T05:10:00.000Z', day: '2026-11-19', value: 48.6 }]);
    expect(parseShortcutRestingHr('2026-11-19T08:00:00+01:00;52,46;bpm\n2026-11-19T20:00:00+01:00;54;count/min', '2026-11-19', 'Europe/Paris').latestByDay).toEqual([{ day: '2026-11-19', value: 54 }]);
    expect(parseShortcutWeights('2026-10-25T02:30:00+02:00;81,4 kg\n2026-10-25T02:30:00+01:00;81.2;kg', '2026-10-25', 'Europe/Paris').weights).toEqual([{ measuredAt: '2026-10-25T01:30:00.000Z', kg: 81.2 }]);
    expect(parseBodyFile('poids.csv', '2026-11-08T06:50:00+01:00 ;180;lb', '2026-11-08', 'Europe/Paris').days).toEqual([{ day: '2026-11-08', value: 81.65, measuredAt: '2026-11-08T05:50:00.000Z' }]);
    expect(parseBodyFile('masse-grasse.csv', '2026-11-08T06:50:12+01:00;0,269', '2026-11-08', 'Europe/Paris').days[0]).toMatchObject({ value: 26.9 });
  });
});
