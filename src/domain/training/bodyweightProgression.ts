import { ENGINE_VERSION, REASON_ORDER, type ProgressionConfig } from './config';
import { confidenceOf } from './confidence';
import { daysBetween, deloadSetCount, inactivityCut, isLowRecovery } from './constraints';
import { usableEquipment } from './equipment';
import type { SessionEstimate } from './estimate1rm';
import { loadGrid, nextLoadAbove, roundKg } from './loadGrid';
import type { HistorySet, PrescribeInput, Prescription, PrescriptionHeadline, ReasonCode } from './types';

/**
 * Progression des exercices sans charge (PRD § 11.3 « Sans charge » ; MOTEUR-0281a, C-189). Module pur, appelé par `prescribe` pour les
 * métriques `bodyweight-reps` (hors traction assistée du catalogue) et `time`. Même ordre que la double progression (§ 11.2) :
 *
 * 1. valider : séries de travail faites (chronométré : séries `timed` ou `work` avec une durée), répétitions ou secondes entières ≥ 1, lest
 *    fini ≥ 0 (absent : 0) ; séance à moins de 50 % de séries faites ignorée, deload exclu ; 2. référence : décision d'Ali postérieure à la
 *    dernière séance, sinon dernière séance valide (lest le plus fréquent, valeurs à ce lest) ; 3. progression :
 *    - poids du corps : haut de plage partout → lest du plus petit cran disponible (`ballastLoads`) et retour au bas de la plage ; aucun lest
 *      possible → une répétition de plus ; sinon +1 répétition sur une série (échelle 8-7-6 → 8-8-6) ;
 *    - chronométré : toutes les séries à la cible et égales → +pas sur chaque série (`timeStepSec`) ; sinon la première série en retard gagne
 *      un pas, sans dépasser la meilleure série ni la cible ;
 *    Dur ou RIR ≤ 1 au haut de plage : mêmes valeurs ; 4. contraintes : deload (moitié des séries, lest × 0,8 arrondi vers le bas) ; pause de
 *    3 semaines ou récupération basse : mêmes valeurs que la référence, aucune hausse. Fatigue, stagnation et position ne s'appliquent pas
 *    (aucune charge à réduire). Aucun 1RM (`estimated1rmKg` null).
 */

const EPS = 1e-9;
const MAX_BALLAST_LOADS = 2000;
/** Ceinture (ou dispositif) de lest du catalogue du matériel. */
export const LOADING_BELT_ID = 'loading-belt';

/** Pas d'un chronométré : `maxGainPerSession` du temps tenu arrondi en dessous, au moins 1 s, au plus `timeStepMaxSec`. */
export function timeStepSec(seconds: number, config: ProgressionConfig): number {
  return Math.min(config.timeStepMaxSec, Math.max(1, Math.floor(seconds * config.maxGainPerSession + EPS)));
}

/** Sommes atteignables avec les disques (tous, ceinture non latéralisée : `count` par côté × 2), sans 0, croissantes. */
function plateSums(plates: readonly { readonly weightKg: number; readonly count: number }[]): number[] {
  let sums = new Set<number>([0]);
  for (const p of plates) {
    if (!(p.weightKg > 0) || !(p.count > 0)) continue;
    for (let i = 0; i < 2 * Math.floor(p.count); i += 1) {
      const next = new Set(sums);
      for (const s of sums) if (next.size < MAX_BALLAST_LOADS) next.add(roundKg(s + p.weightKg));
      sums = next;
    }
  }
  sums.delete(0);
  return [...sums];
}

/**
 * Lests disponibles avec ce profil (kg, croissants, sans doublon) : ceinture de lest utilisable → disques, kettlebells vérifiées et haltères ;
 * haltères utilisables seuls → grille des haltères. Ni ceinture ni haltère (ni profil) : aucun lest, rien n'est proposé.
 */
export function ballastLoads(profile: PrescribeInput['equipment']): number[] {
  if (profile === null) return [];
  const usable = usableEquipment(profile);
  const loads = new Set<number>();
  const dumbbells = usable.has('dumbbell') ? (loadGrid(['dumbbell'], profile)?.loads ?? []) : [];
  for (const kg of dumbbells) loads.add(kg);
  if (usable.has(LOADING_BELT_ID)) {
    for (const kg of plateSums(profile.inventory.platesPerSideKg)) loads.add(kg);
    for (const kg of usable.has('kettlebell') ? (loadGrid(['kettlebell'], profile)?.loads ?? []) : []) loads.add(kg);
    for (const kg of profile.inventory.dumbbells === null ? [] : (loadGrid(['dumbbell'], profile)?.loads ?? [])) loads.add(kg);
  }
  return [...loads].filter((kg) => Number.isFinite(kg) && kg > 0).sort((a, b) => a - b);
}

type Valued = HistorySet & { readonly loadKg: number; readonly reps: number };

/** Série validée de l'exercice : valeur (répétitions ou secondes) mise dans `reps`, lest dans `loadKg` (absent : 0) ; null si inéligible. */
function valued(set: HistorySet, timed: boolean): Valued | null {
  const value = timed ? (set.durationSec ?? null) : set.reps;
  const lest = set.loadKg ?? 0;
  if (!set.done || value === null || !Number.isInteger(value) || value < 1 || !Number.isFinite(lest) || lest < 0) return null;
  return { ...set, loadKg: lest, reps: value };
}

const isWork = (set: HistorySet, timed: boolean): boolean => set.setKind === 'work' || (timed && set.setKind === 'timed');

/** Échelle : première série sous `goal`, sinon la première sous la meilleure, sinon la première. */
function ladderIndex(values: readonly number[], goal: number): number {
  const below = values.findIndex((v) => v < goal);
  if (below >= 0) return below;
  const top = Math.max(...values);
  const under = values.findIndex((v) => v < top);
  return under >= 0 ? under : 0;
}

export function prescribeUnloaded(input: PrescribeInput): Prescription {
  const { config, target } = input;
  const timed = input.exercise.metric === 'time';
  const metric: 'bodyweight-reps' | 'time' = timed ? 'time' : 'bodyweight-reps';
  const reasons = new Set<ReasonCode>();
  type Core = Omit<Prescription, 'reasons' | 'engineVersion' | 'activeConfig' | 'metric' | 'options' | 'deload' | 'rirTarget' | 'inactivityCut'> &
    Partial<Pick<Prescription, 'deload' | 'rirTarget'>>;
  const finish = (p: Core): Prescription => ({
    options: [],
    deload: false,
    rirTarget: target.rir,
    inactivityCut: 0,
    ...p,
    metric,
    reasons: REASON_ORDER.filter((code) => reasons.has(code)),
    engineVersion: ENGINE_VERSION,
    activeConfig: config,
  });
  const empty = { deltaKg: null, reference: null, ladderSetIndex: null, estimated1rmKg: null, recalibration: null } as const;

  // 1. Validation (ordre chronologique stable : fin, puis identifiant).
  const ordered = [...input.history].sort((a, b) => (a.endedAt < b.endedAt ? -1 : a.endedAt > b.endedAt ? 1 : a.workoutId < b.workoutId ? -1 : a.workoutId > b.workoutId ? 1 : 0));
  const valid: SessionEstimate[] = [];
  let latestPartial = false;
  for (const session of ordered) {
    const work = session.sets.filter((s) => isWork(s, timed));
    if (work.length === 0 || session.deload === true) continue;
    const eligible = work.map((s) => valued(s, timed)).filter((s): s is Valued => s !== null);
    if (eligible.length < config.minCompletedFraction * work.length) {
      latestPartial = true;
      continue;
    }
    latestPartial = false;
    const sets = [...eligible].sort((a, b) => a.position - b.position);
    // « e1rmKg » porte ici la meilleure valeur (répétitions ou secondes) : seule la dispersion de la confiance la lit, jamais un 1RM.
    valid.unshift({ workoutId: session.workoutId, endedAt: session.endedAt, difficulty: session.difficulty, e1rmKg: Math.max(...sets.map((s) => s.reps)), quality: 1, validSets: sets.length, sets });
  }
  if (latestPartial) reasons.add('partial-session-ignored');
  const confidence = confidenceOf(valid, input.now, config);
  const latestEnd = input.history.reduce<string | null>((max, s) => (max === null || s.endedAt > max ? s.endedAt : max), null);

  // 2. Référence : la décision d'Ali postérieure à la dernière séance l'emporte.
  const decision = input.lastDecision;
  if (decision !== null && (latestEnd === null || decision.decidedAt > latestEnd)) {
    reasons.add('decision-reference');
    const decided = decision.reps.length > 0 ? decision.reps : Array.from({ length: target.sets }, () => target.repMin);
    return finish({ ...empty, status: decision.loadKg === null ? 'to-enter' : 'prescribed', headline: 'decision', sets: decided.map((reps) => ({ reps, loadKg: decision.loadKg })), loadKg: decision.loadKg, confidence });
  }
  const last = valid[0];
  if (last === undefined) {
    reasons.add('no-history');
    return finish({ ...empty, status: 'to-enter', headline: 'to-enter', sets: Array.from({ length: target.sets }, () => ({ reps: target.repMin, loadKg: null })), loadKg: null, confidence });
  }
  reasons.add('history-reference');
  if (confidence < config.provisionalBelow) reasons.add('provisional');
  const counts = new Map<number, number>();
  for (const s of last.sets) counts.set(s.loadKg, (counts.get(s.loadKg) ?? 0) + 1);
  const lest = [...counts.entries()].reduce((best, [kg, n]) => (n > best[1] || (n === best[1] && kg > best[0]) ? [kg, n] : best), [-Infinity, 0])[0];
  const atLest = last.sets.filter((s) => s.loadKg === lest).map((s) => s.reps);
  const fill = Math.min(atLest[atLest.length - 1] ?? target.repMin, target.repMin);
  const refValues = Array.from({ length: target.sets }, (_, i) => atLest[i] ?? fill);
  const complete = atLest.length >= target.sets;
  // `e1rmKg` 0 : aucun 1RM pour un exercice sans charge.
  const reference = { loadKg: lest, reps: refValues, e1rmKg: 0 };
  const rirs = last.sets.map((s) => s.rir).filter((r): r is number => r !== null);
  const minRir = rirs.length > 0 ? Math.min(...rirs) : null;
  const hard = last.difficulty === 'hard' || (minRir !== null && minRir <= config.hardRirAtMost);
  const easy = last.difficulty === 'easy' || (minRir !== null && minRir >= config.easyRirAtLeast);
  const grid = ballastLoads(input.equipment);

  const result = (headline: PrescriptionHeadline, loadKg: number, values: readonly number[], ladder: number | null, extra: Partial<Pick<Prescription, 'deload' | 'rirTarget'>> = {}): Prescription =>
    finish({ ...empty, status: 'prescribed', headline, sets: values.map((reps) => ({ reps, loadKg })), loadKg, deltaKg: roundKg(loadKg - lest), reference, ladderSetIndex: ladder, confidence, ...extra });

  // 4. Contraintes (avant la progression, qu'elles suspendent) : deload, puis pause, puis récupération basse.
  const muscle = input.muscleLastWorkedAt ?? null;
  const worked = input.history.reduce<string | null>((max, s) => (s.sets.some((x) => x.done) && (max === null || s.endedAt > max) ? s.endedAt : max), null);
  const lastWorked = muscle !== null && (worked === null || muscle > worked) ? muscle : worked;
  const paused = lastWorked !== null && inactivityCut(daysBetween(lastWorked, input.now), config) > 0;
  const low = isLowRecovery(input.recovery, config);
  if (paused) reasons.add('inactivity-discount');
  if (low) reasons.add('recovery-low');
  if (low && input.recovery?.redDay === true) reasons.add('recovery-red-day');
  if (input.deload === true) {
    reasons.add('deload');
    const sets = input.deloadSets ?? deloadSetCount(target.sets);
    const wanted = lest * (input.deloadLoad ?? config.deloadLoad);
    const lighter = lest > 0 ? Math.max(0, ...[...grid, lest].filter((kg) => kg <= wanted + EPS)) : 0;
    const loadKg = lighter > 0 || grid.length > 0 ? roundKg(lighter) : roundKg(Math.floor(wanted / config.unknownGridRoundingKg + EPS) * config.unknownGridRoundingKg);
    return result('deload', loadKg, refValues.slice(0, Math.max(1, sets)), null, { deload: true, rirTarget: Math.max(target.rir ?? 0, config.deloadRirAtLeast) });
  }
  if (paused) return result('inactivity', lest, refValues, null);
  if (low) return result('recovery-low', lest, refValues, null);

  // 3. Progression.
  const extraValue = (index: number, value: number): number[] => refValues.map((v, i) => (i === index ? value : v));
  if (timed) {
    const best = Math.max(...refValues);
    const allTop = complete && Math.min(...refValues) >= target.repMax;
    if (allTop && Math.min(...refValues) === best) {
      reasons.add('top-reached');
      if (hard) {
        reasons.add('hard-blocks-increase');
        return result('hold-hard', lest, refValues, null);
      }
      if (easy) reasons.add('easy-confirms');
      reasons.add('time-step');
      return result('time-increase', lest, refValues.map((v) => v + timeStepSec(v, config)), null);
    }
    reasons.add('rep-ladder');
    reasons.add('time-step');
    const goal = allTop ? best : target.repMax;
    const index = ladderIndex(refValues, goal);
    const from = refValues[index] ?? goal;
    return result('time-ladder', lest, extraValue(index, Math.min(goal, from + timeStepSec(from, config))), index);
  }
  const plusOne = (): Prescription => {
    const index = ladderIndex(refValues, target.repMax);
    return result('extra-rep', lest, extraValue(index, (refValues[index] ?? target.repMin) + 1), index);
  };
  if (complete && refValues.every((r) => r >= target.repMax)) {
    reasons.add('top-reached');
    if (hard) {
      reasons.add('hard-blocks-increase');
      return result('hold-hard', lest, refValues, null);
    }
    if (easy) reasons.add('easy-confirms');
    if (grid.length === 0) {
      reasons.add('ballast-unavailable');
      return plusOne();
    }
    const next = nextLoadAbove(lest, grid);
    if (next === null) {
      reasons.add('equipment-max');
      return plusOne();
    }
    reasons.add('ballast-added');
    return result('ballast-add', roundKg(next), Array.from({ length: target.sets }, () => target.repMin), null);
  }
  reasons.add('rep-ladder');
  const index = ladderIndex(refValues, target.repMax);
  return result('rep-ladder', lest, extraValue(index, (refValues[index] ?? target.repMin) + 1), index);
}

