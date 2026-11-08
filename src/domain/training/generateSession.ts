import { GENERATION_VERSION, type GenerationConfig } from './config';
import { isExerciseCompatible } from './equipment';
import type {
  GeneratedExercise,
  GeneratedOrigin,
  GeneratedSession,
  GenerateSessionInput,
  GenerationIssueCode,
  GenerationWarning,
  OmissionReason,
  OmittedExercise,
  SetStyle,
} from './generationTypes';
import { primaryMuscle } from './prescribe';
import { dayGroups, modeRules, recurringSlotCount, rotationPeriod, splitDayKind, validateSplit } from './programModes';
import { SETS_MAX } from './routineRules';
import type { Exercise, RoutineDaySpec, RoutineExerciseSpec } from './types';

/**
 * Génération de séance (PRD § 12.1, § 12.3, § 12.4 ; I3-01 ; D-73). Fonction pure et déterministe : seule l'horloge injectée (`now`) date la
 * rotation ; aucune écriture, aucune lecture de `Date.now` ni de hasard. La routine source n'est jamais modifiée (lecture seule).
 *
 * Étapes : 1. validation (mode, jour, split, profil Maison, budget) ; 2. résolution des lignes du jour ; filtre dur matériel et douleur ;
 * 3. substitution (Guidé, Maison) ou omission avec remplaçant suggéré (Libre) ; 4. ordre : composés, priorités, position (Guidé, Maison) ;
 * 5. variété (rotation déterministe qui garde pattern, muscle principal, type et métrique) ; 6. volume (séries de la semaine I3-02 sinon de la
 * routine, plages) ; 7. budget temps ± 10 % : isolations retirées de la fin, puis séries réduites, jamais un composé retiré.
 * Les lignes de la routine ne sont jamais retirées pour un doublon de pattern ou un groupe hors split : elles sont signalées (D-73, I3-01).
 */

interface Slot {
  readonly line: RoutineExerciseSpec;
  readonly source: Exercise;
  chosen: Exercise;
  origin: GeneratedOrigin;
  readonly substitutionReason: 'equipment' | 'pain' | null;
  sets: number;
  setsRemoved: number;
  readonly warnings: ('duplicate-in-routine' | 'off-split-in-routine')[];
}

const WARNING_ORDER: readonly GenerationWarning[] = ['duplicate-in-routine', 'off-split-in-routine', 'over-budget', 'under-budget'];

/** Durée estimée d'un exercice : 45 s par série + repos entre séries consécutives (D-73 point 4). */
export function estimateExerciseSec(sets: number, restSec: number, config: GenerationConfig): number {
  if (!(sets > 0)) return 0;
  return sets * config.secondsPerSet + (sets - 1) * Math.max(0, restSec);
}

/** Durée estimée de lignes de routine telles qu'écrites. */
export function estimateSessionSec(lines: readonly Pick<RoutineExerciseSpec, 'sets' | 'restSec'>[], config: GenerationConfig): number {
  return lines.reduce((sum, l) => sum + estimateExerciseSec(l.sets, l.restSec, config), 0);
}

/**
 * Ordre d'exécution des séries selon le style (D-73 point 7 : mêmes séries, seul l'ordre change). Droites : inchangé. Pyramide : charges
 * croissantes, à charge égale répétitions décroissantes. Inversée : charges décroissantes, à charge égale répétitions croissantes. Une
 * charge absente (à saisir) : tri sur les seules répétitions. Tri stable, entrée jamais modifiée.
 */
export function orderSetsForStyle<T extends { readonly reps: number; readonly loadKg: number | null }>(sets: readonly T[], style: SetStyle): T[] {
  if (style === 'straight') return [...sets];
  const sign = style === 'pyramid' ? 1 : -1;
  const byLoad = sets.every((s) => s.loadKg !== null);
  return sets
    .map((set, index) => ({ set, index }))
    .sort((a, b) => {
      const load = byLoad ? ((a.set.loadKg ?? 0) - (b.set.loadKg ?? 0)) * sign : 0;
      if (load !== 0) return load;
      const reps = (b.set.reps - a.set.reps) * sign;
      return reps !== 0 ? reps : a.index - b.index;
    })
    .map((x) => x.set);
}

const keyOf = (e: Exercise): string => `${e.pattern}|${primaryMuscle(e.muscles) ?? ''}`;

export function generateSession(input: GenerateSessionInput): GeneratedSession {
  const { program, config, equipment } = input;
  const rules = modeRules(program.mode);
  const days: RoutineDaySpec[] = [...program.days].sort((a, b) => a.dayOrder - b.dayOrder);
  const day = Number.isInteger(input.day) ? days[input.day] : undefined;

  const empty = (status: GeneratedSession['status'], issues: GenerationIssueCode[]): GeneratedSession => ({
    status,
    issues,
    mode: program.mode,
    dayIndex: input.day,
    dayName: day?.name ?? '',
    dayKind: null,
    groups: [],
    uncoveredGroups: [],
    exercises: [],
    omitted: [],
    warnings: [],
    style: program.style,
    variety: program.variety,
    rotationPeriod: 0,
    estimatedSec: 0,
    budgetSec: null,
    generationVersion: GENERATION_VERSION,
  });

  // 1. Validation.
  if (!rules.available) return empty('unavailable', ['imported-unavailable']);
  const issues: GenerationIssueCode[] = [];
  if (day === undefined) issues.push('day-out-of-range');
  if (rules.usesSplit) {
    issues.push(...validateSplit(program.split, days.length, config));
    if (day !== undefined && program.split === 'custom' && dayGroups('custom', input.day, program.customDays, config).length === 0) issues.push('custom-day-groups');
  }
  if (rules.requiresHomeProfile && equipment.kind !== 'maison') issues.push('home-profile-required');
  const budget = input.timeBudgetMin;
  if (budget !== null && !(Number.isInteger(budget) && budget >= config.budgetMinMinutes && budget <= config.budgetMaxMinutes)) issues.push('budget-invalid');
  if (issues.length > 0 || day === undefined) return empty('invalid', issues);

  const groups = rules.usesSplit ? dayGroups(program.split, input.day, program.customDays, config) : [];
  const groupSet = new Set(groups);
  const pain = new Set<string>(program.painfulPatterns);
  const priorities = new Set(program.priorities);
  const byId = new Map(input.library.exercises.map((e) => [e.id, e]));
  const sortedLibrary = [...input.library.exercises].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const groupOf = (e: Exercise): string | null =>
    e.origin === 'embedded' && e.group !== undefined ? e.group : (input.library.groupOfMuscle.get(primaryMuscle(e.muscles) ?? '') ?? null);
  const usable = (e: Exercise): boolean => !pain.has(e.pattern) && isExerciseCompatible(e, equipment);
  const inDay = (e: Exercise): boolean => !rules.usesSplit || groupSet.has(groupOf(e) ?? '');

  /** Candidats dans l'ordre : alternatives du contenu, puis même pattern, puis même type, puis le reste (identifiant croissant). */
  const candidates = (of: Exercise, accept: (c: Exercise) => boolean): Exercise[] => {
    const alternatives = of.origin === 'embedded' ? (of.alternatives ?? []) : [];
    const rank = (c: Exercise): number => {
      const alt = alternatives.indexOf(c.id);
      if (alt >= 0) return alt;
      return alternatives.length + (c.pattern === of.pattern ? 0 : c.kind === of.kind ? 1 : 2);
    };
    return sortedLibrary
      .filter((c) => c.id !== of.id && c.metric === of.metric && primaryMuscle(c.muscles) === primaryMuscle(of.muscles) && usable(c) && inDay(c) && accept(c))
      .map((c, index) => ({ c, index, rank: rank(c) }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map((x) => x.c);
  };

  // 2. Résolution et filtres durs.
  const lines = [...day.exercises].sort((a, b) => a.position - b.position);
  const slots: Slot[] = [];
  const omitted: OmittedExercise[] = [];
  const pending: { line: RoutineExerciseSpec; exercise: Exercise; reason: 'equipment' | 'pain' }[] = [];
  const omit = (line: RoutineExerciseSpec, reason: OmissionReason, suggestionId: string | null, exercise: Exercise | null): void => {
    omitted.push({ exerciseId: exercise?.id ?? line.exerciseId, exerciseName: exercise?.nameFr ?? line.exerciseName, sourcePosition: line.position, reason, suggestionId });
  };
  const routineKeys = new Set<string>();
  for (const line of lines) {
    const exercise = byId.get(line.exerciseId);
    if (exercise === undefined) {
      omit(line, 'unknown-exercise', null, null);
      continue;
    }
    if (!usable(exercise)) {
      pending.push({ line, exercise, reason: pain.has(exercise.pattern) ? 'pain' : 'equipment' });
      continue;
    }
    const warnings: Slot['warnings'] = [];
    if (rules.reorders && routineKeys.has(keyOf(exercise))) warnings.push('duplicate-in-routine');
    routineKeys.add(keyOf(exercise));
    if (rules.usesSplit && !inDay(exercise)) warnings.push('off-split-in-routine');
    slots.push({ line, source: exercise, chosen: exercise, origin: 'routine', substitutionReason: null, sets: line.sets, setsRemoved: 0, warnings });
  }

  // 3. Substitution (Guidé, Maison) ou suggestion (Libre). Jamais d'exercice ni de couple pattern / muscle principal déjà présent.
  const usedIds = new Set(slots.map((s) => s.chosen.id));
  const usedKeys = new Set(slots.map((s) => keyOf(s.chosen)));
  for (const { line, exercise, reason } of pending) {
    const [substitute] = candidates(exercise, (c) => !usedIds.has(c.id) && !usedKeys.has(keyOf(c)));
    if (rules.substitutes && substitute !== undefined) {
      slots.push({ line, source: exercise, chosen: substitute, origin: 'substitution', substitutionReason: reason, sets: line.sets, setsRemoved: 0, warnings: [] });
      usedIds.add(substitute.id);
      usedKeys.add(keyOf(substitute));
    } else {
      omit(line, reason, rules.substitutes ? null : (substitute?.id ?? null), exercise);
    }
  }

  // 4. Ordre.
  const kindRank = (s: Slot): number => (s.chosen.kind === 'compound' ? 0 : 1);
  const priorityRank = (s: Slot): number => (priorities.has(groupOf(s.chosen) ?? '') ? 0 : 1);
  slots.sort((a, b) => (rules.reorders ? kindRank(a) - kindRank(b) || priorityRank(a) - priorityRank(b) : 0) || a.line.position - b.line.position);

  // 5. Variété : les premiers emplacements restent, les suivants tournent.
  const period = rules.rotates ? rotationPeriod(program.variety, program.startedAt, input.now, input.mesocycleIndex, config) : 0;
  if (period > 0) {
    const recurring = recurringSlotCount(slots.length, program.variety, config);
    for (const slot of slots.slice(recurring)) {
      const own = slot.chosen;
      const pool = [own, ...candidates(own, (c) => !usedIds.has(c.id) && c.pattern === own.pattern && c.kind === own.kind)];
      const pick = pool[period % pool.length] ?? own;
      if (pick.id === own.id) continue;
      usedIds.delete(own.id);
      usedIds.add(pick.id);
      slot.chosen = pick;
      slot.origin = 'rotation';
    }
  }

  // 6. Volume de la semaine (I3-02) ou de la routine.
  const weekSets = input.week?.workingSets ?? null;
  for (const slot of slots) slot.sets = Math.min(SETS_MAX, Math.max(1, Math.round(weekSets ?? slot.line.sets)));
  const rirOf = (slot: Slot): number | null => input.week?.rir ?? slot.line.rir;
  const estimate = (slot: Slot): number => estimateExerciseSec(slot.sets, slot.line.restSec, config);
  const total = (): number => slots.reduce((sum, s) => sum + estimate(s), 0);

  // 7. Budget temps.
  const warnings = new Set<GenerationWarning>();
  const budgetSec = budget === null ? null : budget * 60;
  if (budgetSec !== null) {
    const upper = budgetSec * (1 + config.budgetTolerance);
    const lower = budgetSec * (1 - config.budgetTolerance);
    while (total() > upper) {
      const isolationIndex = slots.map((s) => s.chosen.kind).lastIndexOf('isolation');
      const isolation = slots[isolationIndex];
      if (isolation !== undefined) {
        if (total() - estimate(isolation) < lower && isolation.sets > 1) {
          isolation.sets -= 1;
          isolation.setsRemoved += 1;
        } else {
          slots.splice(isolationIndex, 1);
          omit(isolation.line, 'time-budget', null, isolation.chosen);
        }
        continue;
      }
      let target: Slot | undefined;
      for (const s of slots) if (s.sets > 1 && (target === undefined || s.sets >= target.sets)) target = s;
      if (target === undefined) {
        warnings.add('over-budget');
        break;
      }
      target.sets -= 1;
      target.setsRemoved += 1;
    }
    if (total() < lower) warnings.add('under-budget');
  }

  // Rendu.
  const repRange = (slot: Slot): readonly [number, number] => {
    if (slot.chosen.kind === slot.source.kind) return [slot.line.repMin, slot.line.repMax];
    return slot.chosen.kind === 'compound' ? config.compoundRepRange : config.isolationRepRange;
  };
  const exercises: GeneratedExercise[] = slots.map((slot) => {
    for (const w of slot.warnings) warnings.add(w);
    const [repMin, repMax] = repRange(slot);
    return {
      exerciseId: slot.chosen.id,
      exerciseName: slot.origin === 'routine' ? slot.line.exerciseName : slot.chosen.nameFr,
      sourceExerciseId: slot.line.exerciseId,
      sourcePosition: slot.line.position,
      origin: slot.origin,
      substitutionReason: slot.substitutionReason,
      kind: slot.chosen.kind,
      metric: slot.chosen.metric,
      pattern: slot.chosen.pattern,
      primaryMuscle: primaryMuscle(slot.chosen.muscles),
      group: groupOf(slot.chosen),
      sets: slot.sets,
      setsRemoved: slot.setsRemoved,
      repMin,
      repMax,
      rir: rirOf(slot),
      restSec: slot.line.restSec,
      estimatedSec: estimate(slot),
      warnings: [...slot.warnings],
    };
  });
  const covered = new Set(exercises.map((e) => e.group));
  return {
    status: 'ready',
    issues: [],
    mode: program.mode,
    dayIndex: input.day,
    dayName: day.name,
    dayKind: rules.usesSplit ? splitDayKind(program.split, input.day) : null,
    groups,
    uncoveredGroups: groups.filter((g) => !covered.has(g)),
    exercises,
    omitted: omitted.sort((a, b) => a.sourcePosition - b.sourcePosition),
    warnings: WARNING_ORDER.filter((w) => warnings.has(w)),
    style: program.style,
    variety: program.variety,
    rotationPeriod: period,
    estimatedSec: exercises.reduce((sum, e) => sum + e.estimatedSec, 0),
    budgetSec,
    generationVersion: GENERATION_VERSION,
  };
}
