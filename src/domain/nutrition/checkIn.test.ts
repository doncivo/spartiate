import { describe, expect, it } from 'vitest';

import { completeDay, partialDay } from '../../../tests/fixtures/nutrition/dayKit';
import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import { proposeCheckIn, resolveCheckIn, type CheckInInput } from './checkIn';
import type { DayTotals, Target, WeighIn } from './types';

const d0 = '2026-09-07' as LocalDate;
const at = (i: number) => addDays(d0, i);
const end = at(13);

const fullDays = (): DayTotals[] => Array.from({ length: 14 }, (_, i) => completeDay(at(i), 2400));
const fullWeighIns = (): WeighIn[] => [1, 5, 8, 12].map((i) => ({ date: at(i), kg: 80 }));

const target = (kcal: number, proteinG: number, fatG: number): Target => ({
  kcal,
  proteinG,
  fatG,
  carbG: (kcal - 4 * proteinG - 9 * fatG) / 4,
});

function input(over: Partial<CheckInInput> = {}): CheckInInput {
  return {
    style: 'guided',
    weekEnd: end,
    days: fullDays(),
    weighIns: fullWeighIns(),
    tdee: 2600,
    weightKg: 80,
    goal: { kind: 'maintain' },
    currentTarget: target(2500, 140, 70),
    lowFloorConfirmed: false,
    ...over,
  };
}

describe('I4-01 : proposeCheckIn : fiabilité (§ 15.2)', () => {
  it('couverture insuffisante : suspendu, aucune proposition', () => {
    const days = fullDays().map((d, i) => (i % 7 < 4 ? partialDay(d.date, 900) : d));
    const r = proposeCheckIn(input({ days }));
    expect(r.status).toBe('suspended');
    expect(r.proposal).toBeNull();
    expect(r.reasons).toContain('insufficient-coverage');
    expect(r.coverage?.sufficient).toBe(false);
  });

  it('aucune donnée : suspendu', () => {
    const r = proposeCheckIn(input({ days: [], weighIns: [] }));
    expect(r.status).toBe('suspended');
    expect(r.proposal).toBeNull();
  });

  it('une semaine sans 2 pesées : suspendu', () => {
    const r = proposeCheckIn(input({ weighIns: [1, 5, 8].map((i) => ({ date: at(i), kg: 80 })) }));
    expect(r.status).toBe('suspended');
  });

  it('dépense inconnue : suspendu', () => {
    const r = proposeCheckIn(input({ tdee: null }));
    expect(r.status).toBe('suspended');
    expect(r.reasons).toContain('no-tdee');
  });

  it('poids inconnu : suspendu', () => {
    expect(proposeCheckIn(input({ weightKg: null })).reasons).toContain('no-weight');
  });
});

describe('I4-01 : proposeCheckIn : amplitude et objectif', () => {
  it('maintien : la cible rejoint la dépense dans la borne', () => {
    const r = proposeCheckIn(input({ currentTarget: target(2500, 140, 70), tdee: 2600 }));
    expect(r.status).toBe('proposal');
    expect(r.proposal?.target.kcal).toBe(2600);
    expect(r.proposal?.deltaKcal).toBe(100);
    expect(r.proposal?.clampedBy).toEqual([]);
    expect(r.proposal?.applied).toBe(false);
  });

  it('borne de ±150 kcal par semaine, à la hausse', () => {
    const r = proposeCheckIn(input({ currentTarget: target(2200, 140, 70), tdee: 2600 }));
    expect(r.proposal?.target.kcal).toBe(2350);
    expect(r.proposal?.deltaKcal).toBe(150);
    expect(r.proposal?.clampedBy).toContain('max-weekly-delta');
  });

  it('borne de ±150 kcal par semaine, à la baisse', () => {
    const r = proposeCheckIn(input({ currentTarget: target(2800, 140, 70), tdee: 2600 }));
    expect(r.proposal?.target.kcal).toBe(2650);
    expect(r.proposal?.deltaKcal).toBe(-150);
  });

  it('perte de 0,5 kg/semaine : déficit de 550 kcal/j', () => {
    const r = proposeCheckIn(input({ goal: { kind: 'loss', weeklyRateKg: 0.5 }, currentTarget: target(2000, 140, 70) }));
    expect(r.proposal?.target.kcal).toBe(2050);
    expect(r.proposal?.trace.desiredKcal).toBe(2050);
  });

  it('prise de 0,25 kg/semaine : surplus de 275 kcal/j', () => {
    const r = proposeCheckIn(input({ goal: { kind: 'gain', weeklyRateKg: 0.25 }, currentTarget: target(2800, 140, 70) }));
    expect(r.proposal?.trace.desiredKcal).toBe(2875);
    expect(r.proposal?.target.kcal).toBe(2875);
  });

  it('perte plafonnée à 1 % du poids par semaine', () => {
    const r = proposeCheckIn(
      input({ tdee: 3600, goal: { kind: 'loss', weeklyRateKg: 1.5 }, currentTarget: target(2800, 140, 70) }),
    );
    expect(r.proposal?.trace.weeklyRateKg).toBeCloseTo(0.8, 10);
    expect(r.proposal?.trace.desiredKcal).toBe(2720);
    expect(r.proposal?.target.kcal).toBe(2720);
    expect(r.proposal?.clampedBy).toContain('max-loss-rate');
  });

  it('semaines indépendantes : la proposition ne dépend que de la cible courante et des données de la semaine', () => {
    const a = proposeCheckIn(input());
    const b = proposeCheckIn(input());
    expect(a).toEqual(b);
  });
});

describe('I4-01 : proposeCheckIn : plancher et alertes', () => {
  const floorInput = (over: Partial<CheckInInput> = {}) =>
    input({
      tdee: 1500,
      weightKg: 60,
      goal: { kind: 'loss', weeklyRateKg: 0.5 },
      currentTarget: target(1250, 100, 40),
      ...over,
    });

  it('plancher 1 200 kcal', () => {
    const r = proposeCheckIn(floorInput());
    expect(r.status).toBe('proposal');
    expect(r.proposal?.target.kcal).toBe(1200);
    expect(r.proposal?.clampedBy).toContain('floor');
    expect(r.proposal?.belowStandardFloor).toBe(false);
  });

  it('cible courante sous 1 200 sans confirmation : alerte, révision manuelle, aucune proposition', () => {
    const r = proposeCheckIn(floorInput({ tdee: 1100, currentTarget: target(1000, 100, 38) }));
    expect(r.status).toBe('alert');
    expect(r.alert?.kind).toBe('below-floor');
    expect(r.proposal).toBeNull();
  });

  it('800 kcal seulement sur confirmation explicite, signalé comme sous le plancher standard', () => {
    const r = proposeCheckIn(floorInput({ tdee: 1100, currentTarget: target(1000, 100, 38), lowFloorConfirmed: true }));
    expect(r.status).toBe('proposal');
    expect(r.proposal?.target.kcal).toBe(850);
    expect(r.proposal?.belowStandardFloor).toBe(true);
  });

  it('jamais sous 800 même confirmé', () => {
    const r = proposeCheckIn(floorInput({ tdee: 900, currentTarget: target(820, 100, 38), lowFloorConfirmed: true }));
    expect(r.proposal?.target.kcal).toBeGreaterThanOrEqual(800);
  });

  it('cible hors de ±25 % de la dépense : alerte et révision manuelle', () => {
    const r = proposeCheckIn(input({ currentTarget: target(3500, 150, 80), tdee: 2600 }));
    expect(r.status).toBe('alert');
    expect(r.alert?.kind).toBe('target-vs-tdee');
    expect(r.proposal).toBeNull();
  });

  it('macros incompatibles avec l\'énergie : alerte, aucune proposition', () => {
    const r = proposeCheckIn(
      input({
        tdee: 1100,
        weightKg: 100,
        goal: { kind: 'loss', weeklyRateKg: 0.5 },
        currentTarget: target(1000, 160, 60),
        lowFloorConfirmed: true,
      }),
    );
    expect(r.status).toBe('alert');
    expect(r.alert?.kind).toBe('macros-infeasible');
    expect(r.proposal).toBeNull();
  });
});

describe('I4-01 : proposeCheckIn : macros', () => {
  it('protéines dans 1,6–2,2 g/kg : inchangées, glucides = reste', () => {
    const t = proposeCheckIn(input({ currentTarget: target(2500, 140, 72) })).proposal?.target;
    expect(t?.proteinG).toBe(140);
    expect(t?.fatG).toBe(72);
    expect(t?.carbG).toBe(348);
  });

  it('protéines sous le minimum : +2 g par check-in au plus', () => {
    expect(proposeCheckIn(input({ currentTarget: target(2500, 100, 70) })).proposal?.target.proteinG).toBe(102);
  });

  it('protéines au-dessus du maximum : -2 g par check-in au plus', () => {
    expect(proposeCheckIn(input({ currentTarget: target(2500, 200, 70) })).proposal?.target.proteinG).toBe(198);
  });

  it('protéines à 1 g du minimum : rejoint la borne sans la dépasser', () => {
    expect(proposeCheckIn(input({ currentTarget: target(2500, 127, 70) })).proposal?.target.proteinG).toBe(128);
  });

  it('lipides sous 0,6 g/kg : ramenés au minimum', () => {
    expect(proposeCheckIn(input({ currentTarget: target(2500, 140, 30) })).proposal?.target.fatG).toBe(48);
  });

  it('l\'ajustement d\'énergie passe par les glucides seuls', () => {
    const a = proposeCheckIn(input({ currentTarget: target(2400, 140, 70), tdee: 2500 })).proposal?.target;
    const b = proposeCheckIn(input({ currentTarget: target(2400, 140, 70), tdee: 2400 })).proposal?.target;
    expect(a?.proteinG).toBe(b?.proteinG);
    expect(a?.fatG).toBe(b?.fatG);
    expect((a?.carbG ?? 0) - (b?.carbG ?? 0)).toBe(25);
  });
});

describe('I4-01 : proposeCheckIn : première cible', () => {
  it('sans cible : proposition initiale depuis la dépense, sans couverture exigée', () => {
    const r = proposeCheckIn(input({ currentTarget: null, days: [], weighIns: [], weightKg: 70 }));
    expect(r.status).toBe('proposal');
    expect(r.proposal?.initial).toBe(true);
    expect(r.proposal?.deltaKcal).toBeNull();
    expect(r.proposal?.target).toEqual({ kcal: 2600, proteinG: 133, fatG: 56, carbG: 391 });
  });

  it('sans cible ni dépense : suspendu', () => {
    expect(proposeCheckIn(input({ currentTarget: null, tdee: null })).status).toBe('suspended');
  });
});

describe('I4-01 : proposeCheckIn : styles (§ 15.2)', () => {
  it('Guidé : accepter / personnaliser / refuser, sans alternative', () => {
    const p = proposeCheckIn(input({ style: 'guided' })).proposal;
    expect(p?.options).toEqual(['accept', 'customize', 'refuse']);
    expect(p?.alternatives).toEqual([]);
  });

  it('Collaboratif : même proposition et alternative « garder la cible »', () => {
    const r = proposeCheckIn(input({ style: 'collaborative' }));
    expect(r.proposal?.options).toEqual(['accept', 'customize', 'refuse']);
    expect(r.proposal?.alternatives).toEqual([{ kind: 'hold', target: target(2500, 140, 70) }]);
    expect(r.proposal?.target.kcal).toBe(2600);
  });

  it('Manuel : aucune proposition chiffrée', () => {
    const r = proposeCheckIn(input({ style: 'manual' }));
    expect(r.status).toBe('manual');
    expect(r.proposal).toBeNull();
  });

  it('jamais appliqué silencieusement', () => {
    for (const style of ['guided', 'collaborative'] as const) {
      expect(proposeCheckIn(input({ style })).proposal?.applied).toBe(false);
    }
  });
});

describe('I4-01 : resolveCheckIn : accepter / personnaliser / refuser (Ali a le dernier mot)', () => {
  const proposal = () => {
    const p = proposeCheckIn(input()).proposal;
    if (!p) throw new Error('proposition attendue');
    return p;
  };
  const base = { weightKg: 80, currentTarget: target(2500, 140, 70), lowFloorConfirmed: false };

  it('accepter : cible proposée, source accepted', () => {
    const p = proposal();
    const o = resolveCheckIn({ ...base, proposal: p, decision: { action: 'accept' } });
    expect(o).toMatchObject({ action: 'accept', source: 'accepted', retryable: false });
    expect(o.target).toEqual(p.target);
  });

  it('personnaliser : cible d\'Ali conservée, source manual, proposition tracée', () => {
    const p = proposal();
    const mine = target(2550, 150, 70);
    const o = resolveCheckIn({ ...base, proposal: p, decision: { action: 'customize', target: mine } });
    expect(o).toMatchObject({ action: 'customize', source: 'manual', retryable: false });
    expect(o.target).toEqual(mine);
    expect(o.proposedTarget).toEqual(p.target);
  });

  it('personnaliser hors règles mais au-dessus de 1 200 : appliqué, avec avertissements', () => {
    const o = resolveCheckIn({
      ...base,
      proposal: proposal(),
      decision: { action: 'customize', target: target(1300, 100, 30) },
    });
    expect(o.action).toBe('customize');
    expect(o.target?.kcal).toBe(1300);
    expect(o.warnings).toEqual(expect.arrayContaining(['protein-out-of-range', 'fat-below-min', 'beyond-weekly-delta']));
  });

  it('personnaliser sous 1 200 sans confirmation : confirmation requise, rien d\'appliqué', () => {
    const o = resolveCheckIn({ ...base, proposal: proposal(), decision: { action: 'customize', target: target(1000, 140, 40) } });
    expect(o.action).toBe('confirmation-required');
    expect(o.target).toBeNull();
    expect(o.source).toBeNull();
    expect(o.retryable).toBe(true);
  });

  it('personnaliser sous 1 200 avec confirmation : appliqué, signalé', () => {
    const o = resolveCheckIn({
      ...base,
      lowFloorConfirmed: true,
      proposal: proposal(),
      decision: { action: 'customize', target: target(1000, 140, 40) },
    });
    expect(o).toMatchObject({ action: 'customize', source: 'manual' });
    expect(o.target?.kcal).toBe(1000);
    expect(o.warnings).toContain('below-floor');
  });

  it('personnaliser sous 800 kcal : rejeté même confirmé', () => {
    const o = resolveCheckIn({
      ...base,
      lowFloorConfirmed: true,
      proposal: proposal(),
      decision: { action: 'customize', target: target(799, 100, 20) },
    });
    expect(o.action).toBe('rejected');
    expect(o.target).toBeNull();
  });

  it('personnaliser avec une valeur invalide : rejeté, rien d\'appliqué', () => {
    for (const bad of [target(0, 140, 70), { ...target(2500, 140, 70), proteinG: Number.NaN }, { ...target(2500, 140, 70), carbG: -1 }]) {
      const o = resolveCheckIn({ ...base, proposal: proposal(), decision: { action: 'customize', target: bad } });
      expect(o.action).toBe('rejected');
      expect(o.target).toBeNull();
      expect(o.source).toBeNull();
    }
  });

  it('refuser : cible actuelle inchangée, relançable', () => {
    const o = resolveCheckIn({ ...base, proposal: proposal(), decision: { action: 'refuse' } });
    expect(o).toMatchObject({ action: 'refuse', source: null, retryable: true });
    expect(o.target).toEqual(base.currentTarget);
  });
});
