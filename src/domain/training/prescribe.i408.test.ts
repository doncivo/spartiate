import { describe, expect, it } from 'vitest';
import { prescribe } from './prescribe';
import { explainPrescription } from './explain';
import { progressionFr } from '../../i18n/fr.progression';
import { CURL, input, session, target } from '../../../tests/fixtures/training/progression';

/** I4-08 (0.9.1) : défauts du moteur relevés par relecture à froid avant la première séance réelle (docs/I4-06.md § 1.5). */

describe('I4-08 point 1 : un choix de fatigue retenu ne re-déclenche pas la fatigue', () => {
  const t = target(8, 12);
  const base = [session(6, 60, [10, 10, 10]), session(4, 60, [7, 7, 7])];

  it('7-7-7 après 10-10-10 : fatigue et choix « −2 reps » (5-5-5) proposés', () => {
    const p = prescribe(input({ history: base, target: t }));
    expect(p.reasons).toContain('fatigue-drop');
    expect(p.options?.find((o) => o.kind === 'fatigue-reps')).toEqual({ kind: 'fatigue-reps', loadKg: 60, reps: [5, 5, 5] });
  });

  it('« −2 reps » retenu puis 5-5-5 réalisé : la séance suivante reprend la double progression (pas de fatigue)', () => {
    const history = [...base, session(2, 60, [5, 5, 5], { fatigueChoice: true })];
    const p = prescribe(input({ history, target: t }));
    expect(p.reasons).not.toContain('fatigue-drop');
    expect(p.headline).toBe('rep-ladder');
    expect(p.loadKg).toBe(60);
    expect(p.sets.map((s) => s.reps)).toEqual([6, 5, 5]);
  });

  it('la séance du choix n’est jamais la base de comparaison d’une séance ultérieure : 4-4-4 comparée à 7-7-7 (−43 %), pas à 5-5-5 (−20 %)', () => {
    const history = [...base, session(3, 60, [5, 5, 5], { fatigueChoice: true }), session(1, 60, [4, 4, 4])];
    expect(prescribe(input({ history, target: t })).reasons).toContain('fatigue-drop');
  });

  it('sans marqueur (5-5-5 sans choix retenu) : la fatigue reste détectée', () => {
    const history = [...base, session(2, 60, [5, 5, 5])];
    expect(prescribe(input({ history, target: t })).reasons).toContain('fatigue-drop');
  });
});

describe('I4-08 point 2 : décote d’inactivité arrondie au cran du matériel, écart réel annoncé', () => {
  // Haltères 2 à 50 kg par pas de 2 (cran 2 kg, demi-cran 1 kg) ; barre olympique et disques de 1,25 kg par côté (cran 2,5 kg, demi-cran 1,25 kg).
  const curl = (daysOff: number) => prescribe(input({ exercise: CURL, history: [session(daysOff, 20, [11, 10, 10])], target: target(8, 12) }));
  const bench = (daysOff: number) => prescribe(input({ history: [session(daysOff, 60, [8, 8, 8])], target: target(8, 10) }));

  it('haltères, 20 kg, J21 (−1 % = 0,2 kg < demi-cran) : charge maintenue à 20 kg, jamais 18 kg annoncés « −1 % »', () => {
    const p = curl(21);
    expect(p.headline).toBe('inactivity');
    expect(p.reasons).toContain('inactivity-discount');
    expect(p.loadKg).toBe(20);
    expect(p.deltaKg).toBe(0);
    expect(p.sets.map((s) => s.reps)).toEqual([11, 10, 10]);
    expect(explainPrescription(p)).toEqual({ key: 'inactivityHeld', params: { cut: 1 } });
  });

  it('haltères, 20 kg, J49 (−5 % = 1 kg ≥ demi-cran) : un cran (18 kg), phrase « −2 kg (−10 %) » calculée sur la charge appliquée', () => {
    const p = curl(49);
    expect(p.inactivityCut).toBeCloseTo(0.05, 12);
    expect(p.loadKg).toBe(18);
    expect(p.deltaKg).toBe(-2);
    expect(explainPrescription(p)).toEqual({ key: 'inactivity', params: { delta: 2, cut: 10 } });
  });

  it('barre, 60 kg, J21 (−1 % = 0,6 kg < 1,25 kg) : charge maintenue', () => {
    const p = bench(21);
    expect(p.loadKg).toBe(60);
    expect(explainPrescription(p)).toEqual({ key: 'inactivityHeld', params: { cut: 1 } });
  });

  it('barre, 60 kg, J35 (−3 % = 1,8 kg ≥ 1,25 kg) : un cran (57,5 kg), écart réel −2,5 kg (−4,2 %)', () => {
    const p = bench(35);
    expect(p.loadKg).toBe(57.5);
    expect(explainPrescription(p)).toEqual({ key: 'inactivity', params: { delta: 2.5, cut: 4.2 } });
  });

  it('texte : « charge maintenue » dit en clair ; l’écart réel en kg et en %', () => {
    const texts: Readonly<Record<string, string>> = progressionFr;
    expect(texts.explainInactivityHeld).toMatch(/^Charge maintenue/);
    expect(texts.explainInactivity).toContain('{delta} kg');
    expect(texts.explainInactivity).toContain('{cut} %');
  });
});
