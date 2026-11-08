import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  at,
  deepFreeze,
  GEN_LIBRARY,
  GYM,
  GYM_NO_CABLE,
  HOME,
  HOME_A,
  input,
  LOWER_A,
  MIXED,
  PPL_DAYS,
  UPPER_A,
} from '../../../tests/fixtures/training/generation';
import { DEFAULT_GENERATION_CONFIG as C, GENERATION_VERSION } from './config';
import { isExerciseCompatible } from './equipment';
import { estimateExerciseSec, estimateSessionSec, generateSession, orderSetsForStyle } from './generateSession';
import type { GeneratedSession, GenerationEquipment } from './generationTypes';
import { primaryMuscle } from './prescribe';
import type { RoutineDaySpec } from './types';

/**
 * I3-01 : `generateSession` (§ 12.1, § 12.3, § 12.4 ; D-73). Vecteurs synthétiques (tests/fixtures/training/generation.ts) : splits, matériel
 * manquant, doublons, douleur et substitution, priorités, variété, modes, budget exact / limite / 35 min, styles, déterminisme, < 1 s.
 */

const ids = (s: GeneratedSession): string[] => s.exercises.map((e) => e.exerciseId);
const byId = new Map(GEN_LIBRARY.map((e) => [e.id, e]));
const keyOf = (id: string): string => {
  const e = byId.get(id);
  if (!e) throw new Error(id);
  return `${e.pattern}|${primaryMuscle(e.muscles) ?? ''}`;
};
const oneDay = (d: RoutineDaySpec): readonly RoutineDaySpec[] => [{ ...d, dayOrder: 1 }];
const NO_BARBELL: GenerationEquipment = { kind: 'salle', inventory: { ...GYM.inventory, available: GYM.inventory.available.filter((i) => i !== 'barbell') } };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('critère 1 : muscles du split en vigueur, aucun exercice incompatible', () => {
  it('Haut / Bas, jour 1 (Haut A) : groupes du haut, exercices de la routine, 2 175 s (36 min 15 s, vecteur P-10)', () => {
    const s = generateSession(input());
    expect(s.status).toBe('ready');
    expect(s.issues).toEqual([]);
    expect(s.dayName).toBe('Haut A');
    expect(s.dayKind).toBe('upper');
    expect(s.groups).toEqual(C.splitGroups.upper);
    expect(ids(s)).toEqual(['bench-barbell', 'row-barbell', 'incline-dumbbell', 'lat-pulldown', 'lateral-raise-dumbbell', 'curl-barbell', 'pushdown-cable']);
    expect(s.exercises.every((e) => e.origin === 'routine')).toBe(true);
    expect(s.estimatedSec).toBe(2175);
    expect(s.budgetSec).toBeNull();
    expect(s.uncoveredGroups).toEqual(['forearms']);
    expect(s.generationVersion).toBe(GENERATION_VERSION);
  });

  it('jour 2 (Bas A) : groupes du bas ; PPL jour 2 : Pull, deltoïdes postérieurs admis sans alerte', () => {
    const lower = generateSession(input({ day: 1 }));
    expect(lower.dayKind).toBe('lower');
    expect(lower.groups).toEqual(C.splitGroups.lower);
    expect(ids(lower)).toEqual(['squat-barbell', 'rdl-barbell', 'leg-curl', 'calf-raise-standing', 'plank']);
    expect(lower.uncoveredGroups).toEqual(['glutes']);
    const pull = generateSession(input({ day: 1 }, { split: 'ppl', days: PPL_DAYS }));
    expect(pull.dayKind).toBe('pull');
    expect(pull.warnings).toEqual([]);
    expect(ids(pull)).toEqual(['row-barbell', 'lat-pulldown', 'reverse-fly-dumbbell', 'curl-barbell']);
  });

  it('salle sans poulie : tirage vertical → machine (alternative du contenu, même métrique), extension poulie → extension haltère', () => {
    const s = generateSession(input({ equipment: GYM_NO_CABLE }));
    expect(ids(s)).toEqual(['bench-barbell', 'row-barbell', 'incline-dumbbell', 'pulldown-machine', 'lateral-raise-dumbbell', 'curl-barbell', 'overhead-ext-dumbbell']);
    const pulldown = s.exercises[3];
    expect(pulldown).toMatchObject({ origin: 'substitution', substitutionReason: 'equipment', sourceExerciseId: 'lat-pulldown', repMin: 8, repMax: 12, restSec: 120, sets: 3, exerciseName: 'Tirage vertical machine' });
    expect(s.omitted).toEqual([]);
  });

  it('aucun exercice proposé n’est incompatible, pour tout profil, jour, mode et variété', () => {
    const profiles = [GYM, GYM_NO_CABLE, HOME, NO_BARBELL];
    for (const equipment of profiles)
      for (const mode of ['guide', 'libre', 'maison'] as const)
        for (const variety of ['consistent', 'balanced', 'varied'] as const)
          for (let day = 0; day < 4; day++)
            for (const week of [0, 4, 5, 13]) {
              const s = generateSession(input({ day, equipment, now: at(week) }, { mode, variety }));
              for (const e of s.exercises) expect(isExerciseCompatible(byId.get(e.exerciseId) ?? { equipment: ['absent'] }, equipment), `${e.exerciseId} ${mode}`).toBe(true);
            }
  });

  it('Custom : groupes affectés par Ali ; une ligne hors de ces groupes reste (signalée), un candidat hors groupes n’est jamais proposé', () => {
    const s = generateSession(input({ equipment: NO_BARBELL }, { split: 'custom', customDays: [['chest', 'back']], days: oneDay(MIXED) }));
    expect(s.status).toBe('ready');
    expect(s.dayKind).toBe('custom');
    expect(s.groups).toEqual(['chest', 'back']);
    expect(ids(s)).toEqual(['bench-dumbbell', 'row-dumbbell', 'lateral-raise-dumbbell']);
    expect(s.exercises.find((e) => e.exerciseId === 'lateral-raise-dumbbell')?.warnings).toEqual(['off-split-in-routine']);
    expect(s.warnings).toContain('off-split-in-routine');
    // Curl barre sans barre : les remplaçants (biceps) sont hors des groupes du jour : omis.
    expect(s.omitted).toEqual([{ exerciseId: 'curl-barbell', exerciseName: 'Curl barre', sourcePosition: 1, reason: 'equipment', suggestionId: null }]);
  });

  it('refus : jours hors des bornes du split, Custom sans groupes, jour inexistant ; aucune séance', () => {
    const full4 = generateSession(input({}, { split: 'full-body' }));
    expect(full4).toMatchObject({ status: 'invalid', issues: ['split-days'], exercises: [] });
    expect(generateSession(input({}, { split: 'ppl' })).issues).toEqual(['split-days']);
    expect(generateSession(input({ day: 2 }, { split: 'custom', customDays: [['chest'], ['back'], [], ['abs']] })).issues).toEqual(['custom-day-groups']);
    expect(generateSession(input({ day: 3 }, { split: 'custom', customDays: [['chest']] })).issues).toEqual(['custom-day-groups']);
    // Seuls les groupes du jour demandé sont exigés (Ali répartit jour par jour).
    expect(generateSession(input({ day: 0 }, { split: 'custom', customDays: [['chest', 'back', 'shoulders', 'biceps', 'triceps']] })).status).toBe('ready');
    expect(generateSession(input({ day: 4 })).issues).toEqual(['day-out-of-range']);
    expect(generateSession(input({ day: -1 })).issues).toEqual(['day-out-of-range']);
  });

  it('exercice inconnu de la bibliothèque (personnalisé supprimé) : omis, nom figé conservé', () => {
    const day: RoutineDaySpec = { name: 'X', dayOrder: 1, exercises: [{ ...UPPER_A.exercises[0]!, exerciseId: 'disparu', exerciseName: 'Mon exercice', position: 0 }, { ...UPPER_A.exercises[1]!, position: 1 }] };
    const s = generateSession(input({}, { split: 'full-body', days: [day] }));
    expect(ids(s)).toEqual(['row-barbell']);
    expect(s.omitted).toEqual([{ exerciseId: 'disparu', exerciseName: 'Mon exercice', sourcePosition: 0, reason: 'unknown-exercise', suggestionId: null }]);
  });
});

describe('critère 2 : composés puis isolations, priorités, un exercice par pattern et muscle principal, douleur', () => {
  it('Guidé : composés avant isolations, puis position ; Libre : ordre d’Ali', () => {
    expect(ids(generateSession(input({}, { split: 'full-body', days: oneDay(MIXED) })))).toEqual(['bench-barbell', 'row-barbell', 'lateral-raise-dumbbell', 'curl-barbell']);
    expect(ids(generateSession(input({}, { mode: 'libre', split: 'full-body', days: oneDay(MIXED) })))).toEqual(['lateral-raise-dumbbell', 'curl-barbell', 'bench-barbell', 'row-barbell']);
  });

  it('priorités en tête, à type égal : dos avant pectoraux, biceps avant épaules ; jamais une isolation devant un composé', () => {
    expect(ids(generateSession(input({}, { split: 'full-body', days: oneDay(MIXED), priorities: ['back'] })))).toEqual(['row-barbell', 'bench-barbell', 'lateral-raise-dumbbell', 'curl-barbell']);
    expect(ids(generateSession(input({}, { split: 'full-body', days: oneDay(MIXED), priorities: ['biceps'] })))).toEqual(['bench-barbell', 'row-barbell', 'curl-barbell', 'lateral-raise-dumbbell']);
  });

  it('doublon de la routine (couché barre + incliné haltères, § 12.5) : gardé et signalé, jamais retiré', () => {
    const s = generateSession(input());
    expect(s.exercises.find((e) => e.exerciseId === 'incline-dumbbell')?.warnings).toEqual(['duplicate-in-routine']);
    expect(s.exercises.find((e) => e.exerciseId === 'bench-barbell')?.warnings).toEqual([]);
    expect(s.warnings).toEqual(['duplicate-in-routine']);
  });

  it('pattern douloureux : exclu ; substitution même muscle principal, autre pattern, plage d’isolation ; sans substitut : omis', () => {
    const s = generateSession(input({}, { painfulPatterns: ['push-horizontal'] }));
    expect(ids(s)).toEqual(['row-barbell', 'lat-pulldown', 'chest-fly-cable', 'lateral-raise-dumbbell', 'curl-barbell', 'pushdown-cable']);
    expect(s.exercises[2]).toMatchObject({ origin: 'substitution', substitutionReason: 'pain', sourceExerciseId: 'bench-barbell', kind: 'isolation', repMin: 8, repMax: 15, sets: 3, restSec: 150 });
    expect(s.omitted).toEqual([{ exerciseId: 'incline-dumbbell', exerciseName: 'Développé incliné haltères', sourcePosition: 2, reason: 'pain', suggestionId: null }]);
    expect(s.exercises.some((e) => e.pattern === 'push-horizontal')).toBe(false);
  });

  it('une substitution ne crée jamais de doublon de pattern et muscle principal ni d’exercice répété', () => {
    const day: RoutineDaySpec = {
      name: 'Épaules',
      dayOrder: 1,
      exercises: [
        { exerciseId: 'ohp-barbell', exerciseName: 'Développé militaire barre', sets: 3, repMin: 6, repMax: 10, rir: null, restSec: 150, position: 0 },
        { exerciseId: 'front-raise-dumbbell', exerciseName: 'Élévations frontales', sets: 3, repMin: 12, repMax: 15, rir: null, restSec: 60, position: 1 },
      ],
    };
    const s = generateSession(input({}, { split: 'full-body', days: [day], painfulPatterns: ['push-vertical'] }));
    expect(ids(s)).toEqual(['front-raise-dumbbell']);
    expect(s.omitted.map((o) => [o.exerciseId, o.reason])).toEqual([['ohp-barbell', 'pain']]);
    // Propriété : sur tous les jours, profils et douleurs, les choix du générateur n'ajoutent aucun doublon.
    for (const equipment of [GYM, GYM_NO_CABLE, HOME, NO_BARBELL])
      for (const pain of [[], ['push-horizontal'], ['pull-vertical', 'squat'], ['isolation']] as const)
        for (let d = 0; d < 4; d++) {
          const out = generateSession(input({ day: d, equipment }, { painfulPatterns: pain }));
          const generated = out.exercises.filter((e) => e.origin !== 'routine');
          const keys = out.exercises.map((e) => keyOf(e.exerciseId));
          for (const g of generated) expect(keys.filter((k) => k === keyOf(g.exerciseId))).toHaveLength(1);
          expect(new Set(ids(out)).size).toBe(out.exercises.length);
          for (const e of out.exercises) expect(pain as readonly string[]).not.toContain(e.pattern);
        }
  });

  it('Libre : rien n’est remplacé ; la ligne incompatible ou douloureuse est omise avec un remplaçant suggéré', () => {
    const s = generateSession(input({ equipment: GYM_NO_CABLE }, { mode: 'libre', painfulPatterns: ['push-horizontal'] }));
    expect(ids(s)).toEqual(['row-barbell', 'lateral-raise-dumbbell', 'curl-barbell']);
    expect(s.exercises.every((e) => e.origin === 'routine')).toBe(true);
    expect(s.omitted.map((o) => [o.exerciseId, o.reason, o.suggestionId])).toEqual([
      ['bench-barbell', 'pain', 'chest-fly-dumbbell'],
      ['incline-dumbbell', 'pain', 'chest-fly-dumbbell'],
      ['lat-pulldown', 'equipment', 'pulldown-machine'],
      ['pushdown-cable', 'equipment', 'overhead-ext-dumbbell'],
    ]);
  });
});

describe('critère 3 : variété Consistent / Balanced / Varied', () => {
  const ROUTINE_IDS = ['bench-barbell', 'row-barbell', 'incline-dumbbell', 'lat-pulldown', 'lateral-raise-dumbbell', 'curl-barbell', 'pushdown-cable'];

  it('Consistent : mêmes exercices à toutes les semaines', () => {
    for (const w of [0, 4, 8, 20, 52]) expect(ids(generateSession(input({ now: at(w) }, { variety: 'consistent' })))).toEqual(ROUTINE_IDS);
  });

  it('Balanced : 5 emplacements récurrents sur 7 (70 % arrondi au-dessus), les 2 derniers tournent toutes les 4 semaines', () => {
    const week = (w: number) => generateSession(input({ now: at(w) }, { variety: 'balanced' }));
    for (const w of [0, 1, 2, 3]) expect(ids(week(w))).toEqual(ROUTINE_IDS);
    const w4 = week(4);
    expect(w4.rotationPeriod).toBe(1);
    expect(ids(w4)).toEqual([...ROUTINE_IDS.slice(0, 5), 'curl-cable', 'overhead-ext-dumbbell']);
    expect(w4.exercises.slice(5).map((e) => [e.origin, e.sourceExerciseId, e.repMin, e.repMax, e.sets])).toEqual([
      ['rotation', 'curl-barbell', 8, 12, 2],
      ['rotation', 'pushdown-cable', 8, 12, 2],
    ]);
    for (const w of [5, 6, 7]) expect(ids(week(w))).toEqual(ids(w4));
    expect(ids(week(8))).toEqual([...ROUTINE_IDS.slice(0, 5), 'curl-dumbbell', 'pushdown-cable']);
    for (const w of [0, 4, 8, 12, 16, 40]) expect(week(w).exercises.filter((e) => e.exerciseId === e.sourceExerciseId).length).toBeGreaterThanOrEqual(5);
  });

  it('Varied : rotation par mésocycle (index fourni par I3-02, sinon semaines ÷ 5) ; patterns et muscles conservés', () => {
    const meso = (m: number | null, w = 0) => generateSession(input({ now: at(w), mesocycleIndex: m }, { variety: 'varied' }));
    expect(ids(meso(0))).toEqual(ROUTINE_IDS);
    const m1 = meso(1);
    expect(m1.exercises.every((e) => e.origin === 'rotation')).toBe(true);
    expect(m1.exercises.map((e) => keyOf(e.exerciseId))).toEqual(ROUTINE_IDS.map(keyOf));
    expect(ids(meso(null, 4))).toEqual(ROUTINE_IDS);
    expect(ids(meso(null, 5))).toEqual(ids(m1));
    expect(ids(meso(null, 9))).toEqual(ids(m1));
  });

  it('Libre : aucune rotation, même en Balanced ou Varied', () => {
    expect(ids(generateSession(input({ now: at(4), mesocycleIndex: 1 }, { mode: 'libre', variety: 'balanced' })))).toEqual(ROUTINE_IDS);
    expect(ids(generateSession(input({ now: at(4), mesocycleIndex: 1 }, { mode: 'libre', variety: 'varied' })))).toEqual(ROUTINE_IDS);
  });
});

describe('critère 4 : modes Guidé, Libre, Maison ; Importé indisponible', () => {
  it('Importé : indisponible avant I6, aucune séance', () => {
    expect(generateSession(input({}, { mode: 'importe' }))).toMatchObject({ status: 'unavailable', issues: ['imported-unavailable'], exercises: [], omitted: [] });
  });

  it('Maison : refusé sans profil maison ; avec le profil maison, Guidé limité aux haltères, au banc et au poids du corps', () => {
    expect(generateSession(input({}, { mode: 'maison' }))).toMatchObject({ status: 'invalid', issues: ['home-profile-required'] });
    const home = generateSession(input({ equipment: HOME }, { mode: 'maison', split: 'full-body', days: oneDay(HOME_A) }));
    expect(home.status).toBe('ready');
    expect(ids(home)).toEqual(['goblet-squat', 'bench-dumbbell', 'row-dumbbell', 'curl-dumbbell']);
    const upper = generateSession(input({ equipment: HOME }, { mode: 'maison' }));
    expect(ids(upper)).toEqual(['bench-dumbbell', 'row-dumbbell', 'chest-fly-dumbbell', 'lateral-raise-dumbbell', 'curl-dumbbell', 'overhead-ext-dumbbell']);
    expect(upper.omitted.map((o) => [o.exerciseId, o.reason])).toEqual([['lat-pulldown', 'equipment']]);
  });

  it('Libre : variantes Variable, Fixe et Statique sans effet distinct (D-73) ; le split n’est pas exigé', () => {
    const out = (['variable', 'fixe', 'statique'] as const).map((libreVariant) => generateSession(input({}, { mode: 'libre', libreVariant, split: 'full-body' })));
    expect(out[0]?.status).toBe('ready');
    expect(out[0]?.groups).toEqual([]);
    expect(out[0]?.dayKind).toBeNull();
    expect(out[1]?.exercises).toEqual(out[0]?.exercises);
    expect(out[2]?.exercises).toEqual(out[0]?.exercises);
  });
});

describe('critère 5 : budget temps (45 s par série + repos entre séries), ± 10 %, « J’ai 35 min »', () => {
  it('durée : 45 s × séries + repos × (séries − 1), sans repos final ni transition', () => {
    expect(estimateExerciseSec(3, 150, C)).toBe(435);
    expect(estimateExerciseSec(1, 150, C)).toBe(45);
    expect(estimateExerciseSec(0, 150, C)).toBe(0);
    expect(estimateSessionSec(UPPER_A.exercises, C)).toBe(2175);
    expect(estimateSessionSec(LOWER_A.exercises, C)).toBe(1755);
  });

  it('35 min : 36 min 15 s ≤ 38 min 30 s (35 × 1,10) : plan intact', () => {
    const s = generateSession(input({ timeBudgetMin: 35 }));
    expect(s.budgetSec).toBe(2100);
    expect(s.estimatedSec).toBe(2175);
    expect(s.exercises).toHaveLength(7);
    expect(s.omitted).toEqual([]);
    expect(s.warnings).not.toContain('over-budget');
  });

  it('30 min : isolations retirées de la fin d’abord (extension, curl), composés et séries intacts', () => {
    const s = generateSession(input({ timeBudgetMin: 30 }));
    expect(ids(s)).toEqual(['bench-barbell', 'row-barbell', 'incline-dumbbell', 'lat-pulldown', 'lateral-raise-dumbbell']);
    expect(s.omitted.map((o) => [o.exerciseId, o.reason])).toEqual([
      ['curl-barbell', 'time-budget'],
      ['pushdown-cable', 'time-budget'],
    ]);
    expect(s.estimatedSec).toBe(1875);
    expect(s.exercises.every((e) => e.setsRemoved === 0)).toBe(true);
  });

  it('20 min : toutes les isolations retirées, puis une série de moins aux exercices qui en ont le plus (le dernier d’abord), aucun composé retiré', () => {
    const s = generateSession(input({ timeBudgetMin: 20 }));
    expect(s.exercises.map((e) => [e.exerciseId, e.sets, e.setsRemoved])).toEqual([
      ['bench-barbell', 3, 0],
      ['row-barbell', 3, 0],
      ['incline-dumbbell', 2, 1],
      ['lat-pulldown', 2, 1],
    ]);
    expect(s.estimatedSec).toBe(1290);
  });

  it('priorité : une isolation prioritaire est retirée après les autres', () => {
    const s = generateSession(input({ timeBudgetMin: 30 }, { priorities: ['biceps'] }));
    expect(ids(s)).toContain('curl-barbell');
    expect(s.omitted.map((o) => o.exerciseId)).toEqual(['lateral-raise-dumbbell', 'pushdown-cable']);
  });

  it('isolation dont le retrait passerait sous budget × 0,9 : une série de moins au lieu du retrait', () => {
    const day: RoutineDaySpec = {
      name: 'Court',
      dayOrder: 1,
      exercises: [
        { exerciseId: 'bench-barbell', exerciseName: 'Développé couché barre', sets: 3, repMin: 6, repMax: 10, rir: null, restSec: 150, position: 0 },
        { exerciseId: 'lateral-raise-dumbbell', exerciseName: 'Élévations latérales haltères', sets: 4, repMin: 12, repMax: 15, rir: null, restSec: 60, position: 1 },
      ],
    };
    const s = generateSession(input({ timeBudgetMin: 12 }, { split: 'full-body', days: [day] }));
    expect(s.exercises.map((e) => [e.exerciseId, e.sets, e.setsRemoved])).toEqual([
      ['bench-barbell', 3, 0],
      ['lateral-raise-dumbbell', 3, 1],
    ]);
    expect(s.estimatedSec).toBe(690);
  });

  it('dans ± 10 % du budget pour 20 à 40 min (Haut A) et 15 à 35 min (Bas A), sauf séance déjà plus courte (signalée, jamais allongée)', () => {
    const check = (day: number, from: number, to: number, full: number) => {
      for (let b = from; b <= to; b++) {
        const s = generateSession(input({ day, timeBudgetMin: b }));
        if (full < b * 60 * 0.9) {
          expect(s.warnings, `${b} min`).toContain('under-budget');
          expect(s.estimatedSec).toBe(full);
        } else {
          expect(s.estimatedSec, `${b} min`).toBeGreaterThanOrEqual(b * 60 * 0.9);
          expect(s.estimatedSec, `${b} min`).toBeLessThanOrEqual(b * 60 * 1.1);
        }
        expect(s.exercises.filter((e) => e.kind === 'compound').length).toBe(day === 0 ? 4 : 2);
      }
    };
    check(0, 20, 40, 2175);
    check(1, 15, 35, 1755);
  });

  it('budget inatteignable : composés gardés à une série, « over-budget » signalé ; budget hors 10–240 min refusé', () => {
    const s = generateSession(input({ timeBudgetMin: 1, config: { ...C, budgetMinMinutes: 1 } }));
    expect(s.exercises.map((e) => [e.exerciseId, e.sets])).toEqual([
      ['bench-barbell', 1],
      ['row-barbell', 1],
      ['incline-dumbbell', 1],
      ['lat-pulldown', 1],
    ]);
    expect(s.warnings).toContain('over-budget');
    for (const b of [5, 0, -10, 241, Number.NaN, 30.5]) expect(generateSession(input({ timeBudgetMin: b })).issues, String(b)).toEqual(['budget-invalid']);
  });

  it('semaine du mésocycle (interface I3-02) : séries et RIR de la semaine remplacent ceux de la routine, bornés à 1–20 séries', () => {
    const s = generateSession(input({ week: { workingSets: 2, rir: 3 } }));
    expect(s.exercises.every((e) => e.sets === 2 && e.rir === 3)).toBe(true);
    expect(s.estimatedSec).toBe(1350);
    expect(generateSession(input({ week: { workingSets: 30, rir: null } })).exercises[0]).toMatchObject({ sets: 20, rir: 2 });
    expect(generateSession(input({ week: { workingSets: 0, rir: null } })).exercises[0]?.sets).toBe(1);
    expect(generateSession(input({ week: { workingSets: null, rir: 1 } })).exercises[0]).toMatchObject({ sets: 3, rir: 1 });
  });
});

describe('critère 6 : styles droites / pyramide / inversée, aucune donnée modifiée', () => {
  it('mêmes exercices, séries, plages et repos quel que soit le style ; seul le style rendu change', () => {
    const [straight, pyramid, reverse] = (['straight', 'pyramid', 'reverse'] as const).map((style) => generateSession(input({}, { style })));
    expect(pyramid?.exercises).toEqual(straight?.exercises);
    expect(reverse?.exercises).toEqual(straight?.exercises);
    expect([straight?.style, pyramid?.style, reverse?.style]).toEqual(['straight', 'pyramid', 'reverse']);
  });

  it('ordre des séries : droites inchangé, pyramide charges croissantes, inversée décroissantes ; à charge égale, répétitions décroissantes / croissantes', () => {
    const sets = deepFreeze([
      { reps: 8, loadKg: 80, id: 'a' },
      { reps: 6, loadKg: 90, id: 'b' },
      { reps: 10, loadKg: 70, id: 'c' },
    ]);
    expect(orderSetsForStyle(sets, 'straight').map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(orderSetsForStyle(sets, 'pyramid').map((s) => s.id)).toEqual(['c', 'a', 'b']);
    expect(orderSetsForStyle(sets, 'reverse').map((s) => s.id)).toEqual(['b', 'a', 'c']);
    const ladder = [
      { reps: 8, loadKg: 60 },
      { reps: 9, loadKg: 60 },
      { reps: 8, loadKg: 60 },
    ];
    expect(orderSetsForStyle(ladder, 'pyramid').map((s) => s.reps)).toEqual([9, 8, 8]);
    expect(orderSetsForStyle(ladder, 'reverse').map((s) => s.reps)).toEqual([8, 8, 9]);
    const toEnter = [
      { reps: 8, loadKg: null },
      { reps: 10, loadKg: 50 },
    ];
    expect(orderSetsForStyle(toEnter, 'pyramid').map((s) => s.reps)).toEqual([10, 8]);
    for (const style of ['straight', 'pyramid', 'reverse'] as const) expect([...orderSetsForStyle(sets, style)].sort((x, y) => x.id.localeCompare(y.id))).toEqual([...sets]);
  });

  it('entrée gelée (routine source comprise) : jamais modifiée', () => {
    const frozen = deepFreeze(input({ equipment: GYM_NO_CABLE, timeBudgetMin: 20, now: at(8) }, { variety: 'balanced', painfulPatterns: ['push-horizontal'], priorities: ['back'] }));
    const before = JSON.stringify(frozen);
    expect(() => generateSession(frozen)).not.toThrow();
    expect(JSON.stringify(frozen)).toBe(before);
  });
});

describe('critère 7 : déterministe, horloge injectée, moins d’une seconde', () => {
  it('même entrée, même horloge : même résultat ; Date.now et Math.random jamais lus', () => {
    const now = vi.spyOn(Date, 'now');
    const random = vi.spyOn(Math, 'random');
    const a = generateSession(input({ now: at(9), timeBudgetMin: 25 }, { variety: 'balanced', priorities: ['biceps'] }));
    const b = generateSession(input({ now: at(9), timeBudgetMin: 25 }, { variety: 'balanced', priorities: ['biceps'] }));
    expect(b).toEqual(a);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(now).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });

  it('bibliothèque de 150 exercices : une génération < 1 s, et 200 générations < 1 s', () => {
    const library = [...GEN_LIBRARY];
    for (let i = library.length; i < 150; i++) {
      const base = GEN_LIBRARY[i % GEN_LIBRARY.length]!;
      library.push({ ...base, id: `${base.id}-v${String(i)}`, nameFr: `${base.nameFr} ${String(i)}`, alternatives: [] });
    }
    const big = { exercises: library, groupOfMuscle: input().library.groupOfMuscle };
    const t0 = performance.now();
    generateSession(input({ library: big, now: at(5), timeBudgetMin: 25 }, { variety: 'varied', painfulPatterns: ['squat'] }));
    expect(performance.now() - t0).toBeLessThan(1000);
    const t1 = performance.now();
    for (let i = 0; i < 200; i++) generateSession(input({ library: big, day: i % 4, now: at(i % 30), timeBudgetMin: 20 + (i % 30) }, { variety: 'balanced' }));
    expect(performance.now() - t1).toBeLessThan(1000);
  });
});
