import { ENGINE_VERSION, REASON_ORDER, type ProgressionConfig } from './config';
import { confidenceOf } from './confidence';
import { analyzeHistory, current1rmFromSessions, epley, totalLoad, type BodyLoad, type SessionEstimate } from './estimate1rm';
import { activeConstraints, daysBetween, deloadSetCount, inactivityCut, isLowRecovery, proposalOptions, reducedTarget, reduces, type ActiveConstraints } from './constraints';
import { gridToVerify, loadGrid, nextLoadAbove, nextLoadBelow, roundKg, snapDiscount, snapDownAtLeastMin, snapToEquipment } from './loadGrid';
import type { HistorySet, MuscleWeight, PrescribeInput, PrescribedSet, Prescription, PrescriptionHeadline, PrescriptionReference, ReasonCode } from './types';

/**
 * Prescription d'un exercice (PRD § 11.1–11.2 ; I2-01 ; D-72). Module pur : même entrée → même sortie ; aucune horloge (`now` est un
 * argument), aucune I/O, aucun hasard. Ordre normatif :
 *
 * 1. valider l'historique (estimate1rm.ts) ; 2. cible (`target`, `equipment`) ; 3. référence : décision d'Ali postérieure à la dernière
 * séance (rendue telle quelle : son entrée l'emporte), sinon dernière séance valide, sinon « à saisir » (aucune table de standards,
 * D-72 point 1) ; 4. double progression : haut de plage partout → un cran, sinon +1 rep sur une seule série (8-7-6 → 8-8-6 → 8-8-7 →
 * 8-8-8) ; 5. difficulté : Dur / RIR ≤ 1 bloque la hausse de charge, Facile / RIR ≥ 4 confirme le cran, Facile avec confiance < 60 %
 * recalibre de +5 % (30 jours glissants) à la place du cran, seulement si la charge arrondie monte (I4-08 : sinon échelle de répétitions) ; 6. contraintes (I2-02, constraints.ts) : fatigue, inactivité, deload ou
 * Recovery bas suspendent la progression (maintien de la référence) et réduisent dans cet ordre (facteurs multipliés, un seul arrondi) ;
 * fatigue et stagnation ajoutent des choix facultatifs, jamais appliqués ; une décision d'Ali, « à saisir » et une métrique hors moteur
 * ne sont pas modulées ; 7. arrondi
 * au matériel puis plafond +10 % du 1RM implicite (`max(1RM courant, 1RM de la dernière séance)`) ; 8. raisons dans l'ordre
 * `REASON_ORDER` et raison principale unique (`headline`) ; 9. rien n'est imposé : l'appelant présente, Ali accepte ou modifie.
 */

const DAY_MS = 86_400_000;
const EPS = 1e-9;

/** Premier muscle de poids maximal dans l'ordre des données (D-72 point 5) ; null sans muscle. */
export function primaryMuscle(muscles: readonly MuscleWeight[]): string | null {
  let best: MuscleWeight | null = null;
  for (const m of muscles) if (best === null || m.weight > best.weight) best = m;
  return best?.id ?? null;
}

/** Multiplicateur de la n-ième position (1 = premier exercice du muscle principal), dernier palier au-delà ; appliqué par `prescribe` (REV-01 constat 6). */
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

/** Raisons des contraintes actives, dans l'ordre de `REASON_ORDER`. */
function addConstraintReasons(c: ActiveConstraints, reasons: Set<ReasonCode>): void {
  if (c.fatigue) reasons.add('fatigue-drop');
  if (c.stall) reasons.add('stall');
  if (c.inactivityCut > 0) reasons.add('inactivity-discount');
  if (c.deload) reasons.add('deload');
  if (c.lowRecovery) reasons.add('recovery-low');
}

/** Raison principale d'une proposition réduite : deload, puis inactivité, puis Recovery, puis fatigue (les autres sont des alertes). */
const reducedHeadline = (c: ActiveConstraints): PrescriptionHeadline => (c.deload ? 'deload' : c.inactivityCut > 0 ? 'inactivity' : c.lowRecovery ? 'recovery-low' : 'fatigue');

type Defaulted = 'options' | 'deload' | 'rirTarget' | 'inactivityCut';

export function prescribe(input: PrescribeInput): Prescription {
  const { config, target } = input;
  const reasons = new Set<ReasonCode>();
  const base = { engineVersion: ENGINE_VERSION, activeConfig: config };
  const finish = (p: Omit<Prescription, 'reasons' | 'engineVersion' | 'activeConfig' | Defaulted> & Partial<Pick<Prescription, Defaulted>>): Prescription => ({
    options: [],
    deload: false,
    rirTarget: target.rir,
    inactivityCut: 0,
    ...p,
    reasons: REASON_ORDER.filter((code) => reasons.has(code)),
    ...base,
  });

  const metric = input.exercise.metric;
  // MOTEUR-0281a (§ 11.3, C-189) : poids du corps (reps puis lest) et chronométrés (secondes) ; la distance et la traction assistée du
  // catalogue en `bodyweight-reps` (la charge saisie y est une assistance, FIX-ASSIST) restent hors moteur. Identifiant écrit ici comme dans
  // `prescriptionInputOf` (`ASSISTED_EQUIPMENT_ID`) : importer `assisted.ts` scindait un bloc partagé référencé par le départ.
  const assistedUnloaded = metric !== 'load-reps' && (input.exercise.assisted === true || input.exercise.equipment.includes('assisted-pull-up-machine'));
  if ((metric === 'bodyweight-reps' || metric === 'time') && !assistedUnloaded) return prescribeUnloaded(input);
  if (metric !== 'load-reps') {
    reasons.add('unsupported-metric');
    return finish({ status: 'unsupported', headline: 'unsupported', sets: [], loadKg: null, deltaKg: null, reference: null, ladderSetIndex: null, estimated1rmKg: null, confidence: 0, recalibration: null });
  }

  // 1. Validation.
  // REV-01 : exercice au poids du corps lesté ou assisté → 1RM et plafond sur la charge totale ; poids de corps inconnu → comportement d'avant.
  const fraction = input.exercise.bodyweightFraction ?? null;
  const bodyKg = input.bodyweightKg ?? null;
  // FIX-ASSIST (audit C-001) : exercice assisté, la charge saisie est l'assistance, une charge NÉGATIVE (moins d'assistance = plus dur).
  const assisted = input.exercise.assisted === true;
  const body: BodyLoad | null = fraction !== null && fraction > 0 && bodyKg !== null && bodyKg > 0 ? { baseKg: bodyKg * fraction, sign: assisted ? -1 : 1 } : null;
  if (fraction !== null && fraction > 0 && body === null && input.history.length > 0) reasons.add('bodyweight-unknown');
  // FIX-ABERR : assisté au poids de corps inconnu, aucune aberrante (une assistance n'est pas une charge, une valeur haute allège l'exercice).
  const analysis = analyzeHistory(input.history, config, body, { outliers: !(input.exercise.assisted === true && body === null) });
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
    if (decision.revert === true) reasons.add('revert-previous');
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
  // FIX-ABERR (C-005, § 11.5) : une séance aberrante non confirmée n'est jamais la référence (fin du choix B1 de la PR #60) ; la référence est
  // la dernière séance non aberrante, jusqu'à ce qu'une seconde séance complète hors décharge confirme la charge (`analyzeHistory`).
  const last = estimates[0];
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
  // FIX-ASSIST : aucun recalibrage « Facile » +5 % pour un assisté (il hausserait l'assistance) ; double progression ordinaire.
  const recalAllowed =
    !assisted && !topReached && !hard && last.difficulty === 'easy' && confidence < config.easyRecalibrationBelow && (lastRecal === null || (Date.parse(input.now) - Date.parse(lastRecal)) / DAY_MS >= config.easyRecalibrationCooldownDays);

  const grid = loadGrid(input.exercise.equipment, input.equipment);
  // I2-04 : grille tirée d'un matériel « à vérifier » du profil : dit dans la phrase, la proposition est inchangée.
  if (gridToVerify(input.exercise.equipment, input.equipment)) reasons.add('grid-to-verify');
  // La charge de la référence est disponible par définition (Ali l'a soulevée), même hors grille (paire d'haltères en plus).
  const available = grid === null ? null : [...new Set([...grid.loads, refLoad])].sort((a, b) => a - b);
  // 6. Contraintes (I2-02) : évaluées sur l'historique validé. Dernier travail du muscle : le plus récent entre la donnée de l'appelant
  // (tous exercices) et la dernière séance de cet exercice avec au moins une série faite (deload ou séance ignorée compris : le muscle a
  // travaillé ; une séance sans aucune série faite ne compte pas).
  const muscle = input.muscleLastWorkedAt ?? null;
  const worked = input.history.reduce<string | null>((max, s) => (s.sets.some((x) => x.done) && (max === null || s.endedAt > max) ? s.endedAt : max), null);
  const evaluated = activeConstraints({
    estimates,
    lastWorkedAt: muscle !== null && (worked === null || muscle > worked) ? muscle : worked,
    now: input.now,
    deload: input.deload === true,
    recovery: input.recovery,
    config,
    ...(input.deload === true && input.deloadSets !== undefined ? { deloadSets: input.deloadSets } : {}),
    ...(input.deload === true && input.deloadLoad !== undefined ? { deloadLoad: input.deloadLoad } : {}),
  });
  // FIX-0243 (D-273, § 11.5) : exercice assisté en décharge, l'assistance n'est touchée ni par l'inactivité ni par la Recovery (journée rouge
  // comprise) ; ces contraintes sont écartées ici pour qu'aucune raison ni alerte ne dise une baisse qui n'a pas lieu.
  const constraints = evaluated.deload && assisted ? { ...evaluated, inactivityCut: 0, lowRecovery: false, redDay: false } : evaluated;
  addConstraintReasons(constraints, reasons);
  // I5-02 point 2.2 : Recovery basse issue d'une journée rouge acceptée par Ali (§ 16.7) ; même contrainte, la phrase le dit.
  if (constraints.lowRecovery && input.recovery?.redDay === true) reasons.add('recovery-red-day');
  const refPerformance = { loadKg: refLoad, reps: reference.reps };
  // REV-01 constat 6 (§ 11.3) : décote de position, jamais une hausse ; le rang de la séance de référence est déjà dans sa charge.
  const rank = Math.max(1, Math.floor(input.positionRank ?? 1));
  const lastRank = Math.max(1, Math.floor(input.lastPositionRank ?? rank));
  const positionFactor = Math.min(1, positionMultiplier(rank, config) / positionMultiplier(lastRank, config));
  const positioned = (loadKg: number, repsList: readonly number[]): { readonly loadKg: number; readonly reps: readonly number[]; readonly cut: number } => {
    if (positionFactor >= 1 - EPS) return { loadKg, reps: repsList, cut: 0 };
    if (body !== null) {
      // DEP-01 : exercice lesté ou assisté, poids de corps connu : décote sur la charge TOTALE (corps × fraction ± charge saisie), comme le 1RM ;
      // la charge saisie est ensuite déduite de ce total (lest : arrondi vers le bas, jamais négatif ; assistance : arrondi vers le haut).
      const total = body.baseKg + body.sign * loadKg;
      if (!(total > 0) || (body.sign > 0 && !(loadKg > 0))) return { loadKg, reps: repsList, cut: 0 };
      const wanted = Math.max(0, (total * positionFactor - body.baseKg) / body.sign);
      let next: number;
      let nextReps: readonly number[] = repsList;
      if (body.sign > 0) {
        if (wanted <= EPS) next = 0;
        else {
          const snapped = snapToEquipment(wanted, repsList, available, config);
          next = roundKg(Math.min(snapped.loadKg, loadKg));
          nextReps = snapped.reps;
        }
        if (next >= loadKg - EPS) return { loadKg, reps: repsList, cut: 0 };
      } else {
        const unit = config.unknownGridRoundingKg;
        const up = available === null ? Math.ceil(wanted / unit - EPS) * unit : Math.min(...available.filter((kg) => kg >= wanted - EPS), ...(available.length > 0 ? [Math.max(...available)] : [wanted]));
        next = roundKg(Math.max(up, loadKg));
        if (next <= loadKg + EPS) return { loadKg, reps: repsList, cut: 0 };
      }
      reasons.add('position-discount');
      return { loadKg: next, reps: nextReps, cut: 1 - positionFactor };
    }
    // FIX-ASSIST (audit C-001) : assisté sans poids de corps exploitable : baisser l'assistance alourdirait l'exercice ; maintenue et dite.
    if (assisted) {
      reasons.add('assistance-held');
      return { loadKg, reps: repsList, cut: 0 };
    }
    if (!(loadKg > 0)) return { loadKg, reps: repsList, cut: 0 };
    const snapped = snapToEquipment(loadKg * positionFactor, repsList, available, config);
    const lowered = roundKg(Math.min(snapped.loadKg, loadKg));
    if (lowered >= loadKg - EPS) return { loadKg, reps: repsList, cut: 0 };
    reasons.add('position-discount');
    return { loadKg: lowered, reps: snapped.reps, cut: 1 - positionFactor };
  };
  const positionFields = (cut: number): { readonly positionRank: number; readonly positionCut: number; readonly positionBasisKg: number } => ({ positionRank: rank, positionCut: cut, positionBasisKg: body === null ? refLoad : body.baseKg + body.sign * refLoad });
  if (reduces(constraints)) {
    // Maintien de la référence (aucun cran, échelle ni recalibrage), puis réductions ; arrondi au matériel, jamais au-dessus de la référence.
    const reduced = reducedTarget(constraints, refPerformance, input.exercise.kind, config, assisted);
    // FIX-ASSIST : hors décharge (D-284 en décharge), l'inactivité ou la Recovery basse n'ont pas baissé l'assistance : la phrase le dit.
    if (assisted && !constraints.deload && (constraints.inactivityCut > 0 || constraints.lowRecovery)) reasons.add('assistance-held');
    if (reduced.recoverySetRemoved) reasons.add('recovery-set-removed');
    // I4-08 : décote d'inactivité seule sur une grille connue : arrondie au cran (maintien sous le demi-cran), jamais un cran entier dit « −1 % ».
    const discountOnly = constraints.inactivityCut > 0 && !constraints.deload && !constraints.lowRecovery;
    // Journée rouge acceptée (D-170) : arrondi vers le bas, jamais sous la charge minimale, sans répétition ajoutée.
    const snapped =
      reduced.targetKg >= refLoad - EPS
        ? { loadKg: refLoad, reps: reduced.reps, extraRep: false }
        : discountOnly && available !== null
          ? snapDiscount(refLoad, reduced.targetKg, reduced.reps, available, config)
          : constraints.redDay
            ? snapDownAtLeastMin(reduced.targetKg, reduced.reps, available, refLoad, config)
            : snapToEquipment(reduced.targetKg, reduced.reps, available, config);
    if (snapped.extraRep) reasons.add('snap-extra-rep');
    const keptKg = roundKg(Math.min(snapped.loadKg, refLoad));
    const pos = positioned(keptKg, snapped.reps);
    const loadKg = pos.loadKg;
    return finish({
      ...(pos.cut > 0 ? positionFields(pos.cut) : {}),
      status: 'prescribed',
      headline: reducedHeadline(constraints),
      sets: pos.reps.map((reps) => ({ reps, loadKg })),
      loadKg,
      deltaKg: roundKg(loadKg - refLoad),
      reference,
      ladderSetIndex: null,
      estimated1rmKg: current,
      confidence,
      recalibration: null,
      options: proposalOptions(constraints, { loadKg, reps: pos.reps }, available, config, assisted),
      deload: constraints.deload,
      rirTarget: constraints.deload ? Math.max(target.rir ?? 0, config.deloadRirAtLeast) : target.rir,
      inactivityCut: constraints.inactivityCut,
    });
  }

  const hold = (headline: PrescriptionHeadline, reps: readonly number[], ladder: number | null): Draft => ({ headline, loadKg: refLoad, reps, ladderSetIndex: ladder, recalibration: null });
  const extraRep = (): Draft => {
    const index = ladderIndex(reference.reps, target.repMax);
    return hold('extra-rep', plusOne(reference.reps, index), index);
  };

  let draft: Draft;
  /** Hausse à arrondir et plafonner (étape 7). */
  let increase: { readonly targetKg: number; readonly reps: readonly number[] } | null = null;
  if (recalAllowed) {
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
        // FIX-ASSIST : assisté, le cran BAISSE l'assistance (cran supposé de 2,5 kg sans grille), jamais sous le demi-kilo d'arrondi.
        next = assisted ? (refLoad - config.unknownIncrementKg >= config.unknownGridRoundingKg - EPS ? roundKg(refLoad - config.unknownIncrementKg) : null) : refLoad + config.unknownIncrementKg;
      } else next = assisted ? nextLoadBelow(refLoad, available) : nextLoadAbove(refLoad, available);
      if (next === null && assisted) {
        // Assistance minimale du matériel : aucun cran possible, une répétition de plus (comme au maximum du matériel).
        reasons.delete('increment-unknown');
        reasons.add('assistance-min');
        draft = extraRep();
      } else if (next === null) {
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

  // 7. Arrondi au matériel, puis plafond du 1RM implicite.
  if (increase !== null) {
    const cap = Math.max(current, reference.e1rmKg) * (1 + config.maxGainPerSession);
    const fits = (loadKg: number, reps: readonly number[]): boolean => epley(totalLoad(loadKg, body), Math.max(...reps)) <= cap + 1e-9;
    const snapped = snapToEquipment(increase.targetKg, increase.reps, available, config);
    // Assisté (FIX-ASSIST) : la « hausse » est une assistance plus faible, jamais au-dessus de la référence.
    const snappedLoad = assisted ? Math.min(snapped.loadKg, refLoad) : Math.max(snapped.loadKg, refLoad);
    if (draft.recalibration !== null && snappedLoad <= refLoad + EPS) {
      // I4-08 : +5 % retombé sur la référence (aucune charge de la grille entre la référence et +5 %, ou maximum du matériel) : aucun
      // recalibrage (ni « +0 kg », ni 1RM relevé, ni délai de 30 jours consommé) ; la double progression ordinaire s'applique.
      reasons.delete('easy-recalibration');
      reasons.add('rep-ladder');
      const index = ladderIndex(reference.reps, target.repMax);
      draft = hold('rep-ladder', plusOne(reference.reps, index), index);
    } else if (fits(snappedLoad, snapped.reps)) {
      if (snapped.extraRep) reasons.add('snap-extra-rep');
      draft = { ...draft, loadKg: snappedLoad, reps: snapped.reps };
    } else {
      // Au-delà du garde-fou : la charge inférieure (la référence), et l'échelle de répétitions continue au-delà du haut de plage.
      reasons.add('gain-capped');
      draft = extraRep();
    }
  }

  const pos = positioned(roundKg(draft.loadKg), draft.reps);
  const loadKg = pos.loadKg;
  // Au plus la référence à cause de la position (la hausse est absorbée) : la raison principale est la position (la phrase ne dit pas « +x kg »).
  // Assistée : la décote fait MONTER l'assistance (la charge totale baisse) ; la position est alors la raison dès qu'elle s'applique.
  const absorbed = body !== null && body.sign < 0 ? loadKg >= refLoad - EPS : loadKg <= refLoad + EPS;
  const headline: PrescriptionHeadline = pos.cut > 0 && absorbed ? 'position' : draft.headline;
  return finish({
    ...(pos.cut > 0 ? positionFields(pos.cut) : {}),
    status: 'prescribed',
    headline,
    sets: pos.reps.map((reps) => ({ reps, loadKg })),
    loadKg,
    deltaKg: roundKg(loadKg - refLoad),
    reference,
    ladderSetIndex: headline === 'position' ? null : draft.ladderSetIndex,
    estimated1rmKg: current,
    confidence,
    recalibration: headline === 'position' ? null : draft.recalibration,
    // Stagnation seule : la proposition reste celle de la double progression, les trois choix partent de la référence.
    options: proposalOptions(constraints, pos.cut > 0 ? { loadKg, reps: pos.reps } : refPerformance, available, config, assisted),
  });
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Exercices sans charge (MOTEUR-0281a). Dans ce module plutôt qu'à part : un module séparé devenait un bloc partagé de plus, référencé par
// le départ (+51 octets normalisés).
// -----------------------------------------------------------------------------------------------------------------------------------

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
 * Matériel de lest utilisable : disponible ou forcé, jamais interdit — même règle que `usableEquipment` (equipment.ts) pour ces identifiants,
 * gardée égale par un test ; écrite ici parce qu'importer equipment.ts dans le moteur réordonnait les dépendances du départ.
 */
function ballastUsable(profile: NonNullable<PrescribeInput['equipment']>): { has(id: string): boolean } {
  const inv = profile.inventory;
  return { has: (id) => (inv.available.includes(id) || inv.forced.includes(id)) && !inv.forbidden.includes(id) };
}

/**
 * Lests disponibles avec ce profil (kg, croissants, sans doublon) : haltères utilisables → grille des haltères ;
 * ceinture de lest utilisable → en plus, sommes des disques et kettlebells vérifiées utilisables. Ni ceinture ni haltère (ni profil) : aucun lest, rien n'est proposé.
 */
export function ballastLoads(profile: PrescribeInput['equipment']): number[] {
  if (profile === null) return [];
  const usable = ballastUsable(profile);
  const loads = new Set<number>();
  const dumbbells = usable.has('dumbbell') ? (loadGrid(['dumbbell'], profile)?.loads ?? []) : [];
  for (const kg of dumbbells) loads.add(kg);
  if (usable.has(LOADING_BELT_ID)) {
    for (const kg of plateSums(profile.inventory.platesPerSideKg)) loads.add(kg);
    for (const kg of usable.has('kettlebell') ? (loadGrid(['kettlebell'], profile)?.loads ?? []) : []) loads.add(kg);
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
function unloadedLadderIndex(values: readonly number[], goal: number): number {
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
    if (decision.revert === true) reasons.add('revert-previous');
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
    const index = unloadedLadderIndex(refValues, goal);
    const from = refValues[index] ?? goal;
    return result('time-ladder', lest, extraValue(index, Math.min(goal, from + timeStepSec(from, config))), index);
  }
  const onePlus = (): Prescription => {
    const index = unloadedLadderIndex(refValues, target.repMax);
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
      return onePlus();
    }
    const next = nextLoadAbove(lest, grid);
    if (next === null) {
      reasons.add('equipment-max');
      return onePlus();
    }
    reasons.add('ballast-added');
    return result('ballast-add', roundKg(next), Array.from({ length: target.sets }, () => target.repMin), null);
  }
  reasons.add('rep-ladder');
  const index = unloadedLadderIndex(refValues, target.repMax);
  return result('rep-ladder', lest, extraValue(index, (refValues[index] ?? target.repMin) + 1), index);
}

