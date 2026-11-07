import { ENGINE_VERSION, REASON_ORDER, type ProgressionConfig } from './config';
import { confidenceOf } from './confidence';
import { analyzeHistory, current1rmFromSessions, epley, type SessionEstimate } from './estimate1rm';
import { loadGrid, nextLoadAbove, roundKg, snapToEquipment } from './loadGrid';
import type { MuscleWeight, PrescribeInput, PrescribedSet, Prescription, PrescriptionHeadline, PrescriptionReference, ReasonCode } from './types';

/**
 * Prescription d'un exercice (PRD § 11.1–11.2 ; I2-01 ; D-72). Module pur : même entrée → même sortie ; aucune horloge (`now` est un
 * argument), aucune I/O, aucun hasard. Ordre normatif :
 *
 * 1. valider l'historique (estimate1rm.ts) ; 2. cible (`target`, `equipment`) ; 3. référence : décision d'Ali postérieure à la dernière
 * séance (rendue telle quelle : son entrée l'emporte), sinon dernière séance valide, sinon « à saisir » (aucune table de standards,
 * D-72 point 1) ; 4. double progression : haut de plage partout → un cran, sinon +1 rep sur une seule série (8-7-6 → 8-8-6 → 8-8-7 →
 * 8-8-8) ; 5. difficulté : Dur / RIR ≤ 1 bloque la hausse de charge, Facile / RIR ≥ 4 confirme le cran, Facile avec confiance < 60 %
 * recalibre de +5 % (30 jours glissants) à la place du cran ; 6. contraintes (I2-02, point d'extension `applyConstraints`) ; 7. arrondi
 * au matériel puis plafond +10 % du 1RM implicite (`max(1RM courant, 1RM de la dernière séance)`) ; 8. raisons dans l'ordre
 * `REASON_ORDER` et raison principale unique (`headline`) ; 9. rien n'est imposé : l'appelant présente, Ali accepte ou modifie.
 */

const DAY_MS = 86_400_000;

/** Premier muscle de poids maximal dans l'ordre des données (D-72 point 5) ; null sans muscle. */
export function primaryMuscle(muscles: readonly MuscleWeight[]): string | null {
  let best: MuscleWeight | null = null;
  for (const m of muscles) if (best === null || m.weight > best.weight) best = m;
  return best?.id ?? null;
}

/** Multiplicateur de la n-ième position (1 = premier exercice du muscle principal), dernier palier au-delà ; appliqué en I3. */
export function positionMultiplier(rank: number, config: ProgressionConfig): number {
  const table = config.positionDiscount;
  if (!(rank >= 1)) return table[0] ?? 1;
  return table[Math.min(Math.floor(rank), table.length) - 1] ?? 1;
}

/** Brouillon passé d'étape en étape. */
interface Draft {
  readonly headline: PrescriptionHeadline;
  readonly loadKg: number;
  readonly reps: readonly number[];
  readonly ladderSetIndex: number | null;
  readonly recalibration: Prescription['recalibration'];
}

/** Série qui gagne une répétition : la première sous le haut de plage, sinon la première sous le maximum, sinon la première. */
function ladderIndex(reps: readonly number[], repMax: number): number {
  const below = reps.findIndex((r) => r < repMax);
  if (below >= 0) return below;
  const top = Math.max(...reps);
  const under = reps.findIndex((r) => r < top);
  return under >= 0 ? under : 0;
}

const plusOne = (reps: readonly number[], index: number): number[] => reps.map((r, i) => (i === index ? r + 1 : r));

/**
 * Référence : charge la plus fréquente des séries de la dernière séance (à égalité, la plus lourde), reps des séries faites à cette charge,
 * complétées à `sets`. Relecture de la PR #60 (I1) : un top set isolé ou une faute de frappe sur une série ne fixe plus la charge de toutes
 * les séries.
 */
function referenceOf(last: SessionEstimate, sets: number, repMin: number): { reference: PrescriptionReference; complete: boolean } {
  const counts = new Map<number, number>();
  for (const s of last.sets) counts.set(s.loadKg, (counts.get(s.loadKg) ?? 0) + 1);
  const loadKg = [...counts.entries()].reduce((best, [load, count]) => (count > best[1] || (count === best[1] && load > best[0]) ? [load, count] : best), [-Infinity, 0])[0];
  const atLoad = last.sets.filter((s) => s.loadKg === loadKg).map((s) => s.reps);
  const fill = Math.min(atLoad[atLoad.length - 1] ?? repMin, repMin);
  const reps = Array.from({ length: sets }, (_, i) => atLoad[i] ?? fill);
  return { reference: { loadKg, reps, e1rmKg: last.e1rmKg }, complete: atLoad.length >= sets };
}

/** Étape 6 (I2-02 : fatigue, inactivité, stagnation, deload, Recovery) : maintien ou réduction seulement. Aucune règle en I2-01. */
function applyConstraints(draft: Draft, _input: PrescribeInput): Draft {
  return draft;
}

export function prescribe(input: PrescribeInput): Prescription {
  const { config, target } = input;
  const reasons = new Set<ReasonCode>();
  const base = { engineVersion: ENGINE_VERSION, activeConfig: config };
  const finish = (p: Omit<Prescription, 'reasons' | 'engineVersion' | 'activeConfig'>): Prescription => ({
    ...p,
    reasons: REASON_ORDER.filter((code) => reasons.has(code)),
    ...base,
  });

  if (input.exercise.metric !== 'load-reps') {
    reasons.add('unsupported-metric');
    return finish({ status: 'unsupported', headline: 'unsupported', sets: [], loadKg: null, deltaKg: null, reference: null, ladderSetIndex: null, estimated1rmKg: null, confidence: 0, recalibration: null });
  }

  // 1. Validation.
  const analysis = analyzeHistory(input.history, config);
  if (analysis.latest?.partial === true) reasons.add('partial-session-ignored');
  if ((analysis.latest?.outliers ?? 0) > 0) reasons.add('outlier-excluded');
  const estimates = analysis.estimates;
  const current = current1rmFromSessions(estimates.slice(0, config.recencyWeights.length), config);
  const confidence = confidenceOf(estimates, input.now, config);
  const latestEnd = input.history.reduce<string | null>((max, s) => (max === null || s.endedAt > max ? s.endedAt : max), null);

  // 3. Référence : la décision d'Ali postérieure à la dernière séance l'emporte.
  const decision = input.lastDecision;
  if (decision !== null && (latestEnd === null || decision.decidedAt > latestEnd)) {
    reasons.add('decision-reference');
    const decided = decision.reps.length > 0 ? decision.reps : Array.from({ length: target.sets }, () => target.repMin);
    return finish({
      status: decision.loadKg === null ? 'to-enter' : 'prescribed',
      headline: 'decision',
      sets: decided.map((reps) => ({ reps, loadKg: decision.loadKg })),
      loadKg: decision.loadKg,
      deltaKg: null,
      reference: null,
      ladderSetIndex: null,
      estimated1rmKg: current,
      confidence,
      recalibration: null,
    });
  }
  // B1 : si les séries de la dernière séance ont été écartées comme aberrantes (non encore confirmées), elle reste la référence de charge
  // (c'est ce qu'Ali a réellement soulevé) ; le 1RM courant, lui, attend la confirmation par une séance suivante.
  const raw = analysis.latestRaw;
  const outlierReference = raw !== null && analysis.latest?.partial !== true && (analysis.latest?.outliers ?? 0) > 0 && raw.workoutId !== estimates[0]?.workoutId;
  const last = outlierReference ? raw : estimates[0];
  if (last === undefined || current === null) {
    reasons.add('no-history');
    return finish({
      status: 'to-enter',
      headline: 'to-enter',
      sets: Array.from({ length: target.sets }, (): PrescribedSet => ({ reps: target.repMin, loadKg: null })),
      loadKg: null,
      deltaKg: null,
      reference: null,
      ladderSetIndex: null,
      estimated1rmKg: null,
      confidence,
      recalibration: null,
    });
  }
  reasons.add('history-reference');
  if (confidence < config.provisionalBelow) reasons.add('provisional');
  const { reference, complete } = referenceOf(last, target.sets, target.repMin);
  const refLoad = reference.loadKg;

  // 4–5. Double progression et difficulté.
  const rirs = last.sets.map((s) => s.rir).filter((r): r is number => r !== null);
  const minRir = rirs.length > 0 ? Math.min(...rirs) : null;
  const hard = last.difficulty === 'hard' || (minRir !== null && minRir <= config.hardRirAtMost);
  const easy = last.difficulty === 'easy' || (minRir !== null && minRir >= config.easyRirAtLeast);
  const lastRecal = input.profile?.lastEasyRecalibrationAt ?? null;
  // Relecture de la PR #60 (I2) : au haut de la fourchette, le cran l'emporte sur le recalibrage « Facile » (sinon +0 kg et +1 rep hors
  // fourchette, moins ambitieux que sans « Facile »).
  const topReached = complete && reference.reps.every((r) => r >= target.repMax);
  const recalAllowed =
    !topReached && !hard && last.difficulty === 'easy' && confidence < config.easyRecalibrationBelow && (lastRecal === null || (Date.parse(input.now) - Date.parse(lastRecal)) / DAY_MS >= config.easyRecalibrationCooldownDays);

  const grid = loadGrid(input.exercise.equipment, input.equipment);
  // La charge de la référence est disponible par définition (Ali l'a soulevée), même hors grille (paire d'haltères en plus).
  const available = grid === null ? null : [...new Set([...grid.loads, refLoad])].sort((a, b) => a - b);
  const hold = (headline: PrescriptionHeadline, reps: readonly number[], ladder: number | null): Draft => ({ headline, loadKg: refLoad, reps, ladderSetIndex: ladder, recalibration: null });
  const extraRep = (): Draft => {
    const index = ladderIndex(reference.reps, target.repMax);
    return hold('extra-rep', plusOne(reference.reps, index), index);
  };

  let draft: Draft;
  /** Hausse à arrondir et plafonner (étape 7). */
  let increase: { readonly targetKg: number; readonly reps: readonly number[] } | null = null;
  if (outlierReference) {
    // B1 : charge très au-dessus de l'historique, pas encore confirmée par une seconde séance : même charge, une répétition de plus,
    // jamais de hausse (une faute de frappe ne s'amplifie pas) ; l'explication le dit et invite à vérifier.
    reasons.add('rep-ladder');
    const index = ladderIndex(reference.reps, target.repMax);
    draft = hold('rep-ladder', plusOne(reference.reps, index), index);
  } else if (recalAllowed) {
    reasons.add('easy-recalibration');
    increase = { targetKg: refLoad * (1 + config.easyRecalibrationGain), reps: reference.reps };
    draft = { headline: 'recalibration', loadKg: refLoad, reps: reference.reps, ladderSetIndex: null, recalibration: { at: input.now, estimated1rmKg: current * (1 + config.easyRecalibrationGain) } };
  } else if (topReached) {
    reasons.add('top-reached');
    if (hard) {
      reasons.add('hard-blocks-increase');
      draft = hold('hold-hard', reference.reps, null);
    } else {
      if (easy) reasons.add('easy-confirms');
      let next: number | null;
      if (available === null) {
        reasons.add('increment-unknown');
        next = refLoad + config.unknownIncrementKg;
      } else next = nextLoadAbove(refLoad, available);
      if (next === null) {
        reasons.add('equipment-max');
        draft = extraRep();
      } else {
        increase = { targetKg: next, reps: Array.from({ length: target.sets }, () => target.repMin) };
        draft = { headline: 'increase', loadKg: refLoad, reps: reference.reps, ladderSetIndex: null, recalibration: null };
      }
    }
  } else {
    reasons.add('rep-ladder');
    const index = ladderIndex(reference.reps, target.repMax);
    draft = hold('rep-ladder', plusOne(reference.reps, index), index);
  }

  // 6. Contraintes (I2-02), qui ne peuvent que maintenir ou réduire.
  draft = applyConstraints(draft, input);

  // 7. Arrondi au matériel, puis plafond du 1RM implicite.
  if (increase !== null) {
    const cap = Math.max(current, reference.e1rmKg) * (1 + config.maxGainPerSession);
    const fits = (loadKg: number, reps: readonly number[]): boolean => epley(loadKg, Math.max(...reps)) <= cap + 1e-9;
    const snapped = snapToEquipment(increase.targetKg, increase.reps, available, config);
    const snappedLoad = Math.max(snapped.loadKg, refLoad);
    // Aucune charge de la grille n'existe entre la référence et le cran suivant ; +5 % tombé sur la référence (sous le cran suivant)
    // garde la charge, avec une répétition de plus par série si l'écart dépasse 3 %.
    if (fits(snappedLoad, snapped.reps)) {
      if (snapped.extraRep) reasons.add('snap-extra-rep');
      draft = { ...draft, loadKg: snappedLoad, reps: snapped.reps };
    } else {
      // Au-delà du garde-fou : la charge inférieure (la référence), et l'échelle de répétitions continue au-delà du haut de plage.
      reasons.add('gain-capped');
      draft = extraRep();
    }
  }

  const loadKg = roundKg(draft.loadKg);
  return finish({
    status: 'prescribed',
    headline: draft.headline,
    sets: draft.reps.map((reps) => ({ reps, loadKg })),
    loadKg,
    deltaKg: roundKg(loadKg - refLoad),
    reference,
    ladderSetIndex: draft.ladderSetIndex,
    estimated1rmKg: current,
    confidence,
    recalibration: draft.recalibration,
  });
}
