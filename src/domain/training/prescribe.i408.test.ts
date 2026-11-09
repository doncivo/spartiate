import { describe, expect, it } from 'vitest';
import { prescribe } from './prescribe';
import { input, session, target } from '../../../tests/fixtures/training/progression';

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
