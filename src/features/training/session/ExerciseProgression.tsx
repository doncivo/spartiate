import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { DEFAULT_PROGRESSION_CONFIG } from '../../../domain/training/config';
import { confidenceBand, confidencePercent, constraintAlerts, explainOption, explainPrescription, explanationNotes, type ExplanationKey, type OptionKey } from '../../../domain/training/explain';
import { prescribe } from '../../../domain/training/prescribe';
import { positionRanks } from '../../../domain/training/positionRank';
import { warmupForExercise, type WarmupSet } from '../../../domain/training/warmup';
import { DIFFICULTIES, type Difficulty, type Exercise, type ExerciseSession, type MuscleWeight, type Prescription, type ProgressionEquipment, type RepTarget } from '../../../domain/training/types';
import type { WorkoutSet, WorkoutWithSets } from '../../../domain/training/session';
import type { IsoDateTime } from '../../../domain/types';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import type { DecisionReadEvent, ProgressionProfileRecord, RecommendationDecisionRecord } from '../../../db/repositories/progressionRepository';
import { logFailure } from '../../../platform/desktop/log';
import { tProgression, type ProgressionTextKey } from '../../../i18n/progressionText';
import { Button } from '../../../ui';
import { loadCurrentCycle, localDayOf } from '../cycle/currentCycle';
import { linkedRir, parseSessionLink, sessionRoutineId } from '../cycle/sessionLink';
import './Progression.css';

/**
 * Prescription et ressenti d'un exercice dans la séance active (I2-01 PR 2/2 ; § 11.2 point 9, § 11.4, § 11.5, § 13.2 ; D-72). Bloc à la
 * demande, chargé par `ActiveSession` (import dynamique) avec son catalogue de textes, le moteur et le repository.
 *
 * - La proposition (charge, répétitions, une phrase, confiance) se calcule sur les séances CLOSES de l'exercice : elle ne bouge pas pendant
 *   la séance. Sans historique : « À saisir », aucune charge (D-72 point 1).
 * - Rien n'est rempli sans geste d'Ali : « Accepter » remplit les séries de travail à faire encore vides (modifiables avant validation),
 *   « Modifier » applique ses valeurs, « Refuser » ne remplit rien ; chaque choix est tracé dans `recommendation_decision` (une décision
 *   pour cette séance remplace les boutons par son état). La décision d'une séance précédente, postérieure à sa dernière séance close, est
 *   la référence du moteur (critère 8) ; un refus n'en est pas une.
 * - Contraintes (I2-02) : alertes en texte et choix facultatifs (fatigue : −5 % ou −2 reps ; stagnation : variante, autre plage, mini-deload).
 *   Un choix ne remplit les séries qu'au geste d'Ali, tracé comme une modification ; « Accepter » garde la proposition, « Refuser » ne
 *   remplit rien. Deload manuel demandé par Ali (bascule) : la proposition allégée, une fois retenue, sort la séance des statistiques.
 *   I3-02 : séance commencée en semaine de deload du cycle suivi : la bascule est activée par défaut (dit en texte), désactivable ;
 *   I4-08 : seulement si la séance est issue de la routine du cycle (démarrée ou proposée depuis elle), jamais libre ni d'une autre routine.
 * - Échauffement (I2-03, § 13.8) : pour le premier exercice composé de son pattern (`warmup`), la rampe est annoncée sous la proposition
 *   et insérée avant la première série de travail dans la même transaction que la décision, sur la charge retenue (Accepter, Modifier ou
 *   un choix) ; jamais après un refus, jamais si l'exercice a déjà une série d'échauffement, jamais sans grille de charges connue.
 * - Ressenti Facile / Juste / Dur : écrit sur les séries de l'exercice (`setDifficulty`), un second appui l'efface ; état dit en texte et par
 *   `aria-pressed`, jamais par la couleur seule.
 */

export interface ExerciseProgressionProps {
  readonly access: DataAccess;
  readonly workout: WorkoutWithSets;
  readonly exerciseId: string;
  /** Séries de l'exercice dans la séance (ordre de position). */
  readonly sets: readonly WorkoutSet[];
  readonly exercise: Exercise | undefined;
  /** Profil de matériel actif de cet appareil. */
  readonly equipment: ProgressionEquipment | null;
  /** I2-03 : premier exercice composé de son pattern dans la séance (rampe d'échauffement prévue). */
  readonly warmup?: boolean;
  /** REV-01 constat 6 : rang de l'exercice parmi ceux du même muscle principal dans cette séance (1 = premier). */
  readonly positionRank?: number;
  /** Muscles d'un exercice du catalogue, pour retrouver le rang qu'il avait dans la séance de référence. */
  readonly musclesOf?: (exerciseId: string) => readonly MuscleWeight[];
  readonly clock: { nowMs(): number };
  /** Séance relue après une écriture (la base fait foi). */
  readonly onChanged: () => Promise<void>;
}

interface Loaded {
  readonly history: readonly ExerciseSession[];
  /** Référence du moteur : dernière décision d'une séance CLOSE (jamais d'une séance ouverte ou abandonnée, D-27). */
  readonly reference: RecommendationDecisionRecord | null;
  /** Décision prise dans cette séance (état affiché à la place des boutons). */
  readonly own: RecommendationDecisionRecord | null;
  readonly profile: ProgressionProfileRecord | null;
  /** I3-02 : la séance a commencé en semaine de deload du cycle suivi. */
  readonly cycleDeload: boolean;
  /** I4-08 point 4 : RIR cible de la séance proposée pour cet exercice (semaine du cycle) ; null : aucun. */
  readonly targetRir: number | null;
  /** Rang de l'exercice dans la séance de référence (celle dont vient la charge) ; null : inconnu, aucune décote de position. */
  readonly lastPositionRank: number | null;
}

type Load = { readonly status: 'loading' } | { readonly status: 'error' } | ({ readonly status: 'ready' } & Loaded);

const EXPLAIN_KEYS: Readonly<Record<ExplanationKey, ProgressionTextKey>> = {
  toEnter: 'explainToEnter',
  unsupported: 'explainUnsupported',
  decision: 'explainDecision',
  increase: 'explainIncrease',
  increaseUnknownStep: 'explainIncreaseUnknownStep',
  repLadder: 'explainRepLadder',
  recalibration: 'explainRecalibration',
  holdHard: 'explainHoldHard',
  extraRep: 'explainExtraRep',
  extraRepCapped: 'explainExtraRepCapped',
  extraRepMax: 'explainExtraRepMax',
  fatigue: 'explainFatigue',
  inactivity: 'explainInactivity',
  inactivityHeld: 'explainInactivityHeld',
  deload: 'explainDeload',
  recoveryLow: 'explainRecoveryLow',
  recoveryLowSet: 'explainRecoveryLowSet',
  outlierHold: 'explainOutlierHold',
  position: 'explainPosition',
};
const OPTION_KEYS: Readonly<Record<OptionKey, ProgressionTextKey>> = {
  optionFatigueLoad: 'optionFatigueLoad',
  optionFatigueReps: 'optionFatigueReps',
  optionStallVariant: 'optionStallVariant',
  optionStallRange: 'optionStallRange',
  optionStallMiniDeload: 'optionStallMiniDeload',
};
const BAND_KEYS = { low: 'bandLow', medium: 'bandMedium', high: 'bandHigh' } as const;
const DIFFICULTY_KEYS: Readonly<Record<Difficulty, ProgressionTextKey>> = { easy: 'easy', ok: 'ok', hard: 'hard' };

const reportUnreadable = (event: DecisionReadEvent): void => logFailure('training', event);

/** Nombre à la française : 62.5 → « 62,5 ». */
const kg = (n: number): string => String(n).replace('.', ',');
const parse = (text: string): number | null => {
  const t = text.trim().replace(',', '.');
  return t === '' || !/^\d+(\.\d+)?$/.test(t) ? null : Number(t);
};
/** Répétitions par série : « 8 · 8 · 7 ». */
const repsText = (reps: readonly number[]): string => reps.join(tProgression('repsJoin'));
/** Répétitions retenues : « 9 » si toutes égales, sinon par série. */
const chosenRepsText = (reps: readonly number[]): string => (reps.length > 0 && reps.every((r) => r === reps[0]) ? String(reps[0]) : repsText(reps));

/** Cible de la séance : nombre de séries de travail, plage de la première (sinon celle de l'exercice). */
function targetOf(sets: readonly WorkoutSet[], exercise: Exercise | undefined, rir: number | null): RepTarget {
  const work = sets.filter((s) => s.setKind !== 'warmup');
  const first = work[0];
  const [defMin, defMax] = exercise?.defaultRepRange ?? [8, 12];
  const repMin = first?.targetRepsMin ?? defMin;
  const repMax = first?.targetRepsMax ?? Math.max(repMin, defMax);
  return { sets: Math.max(1, work.length), repMin, repMax: Math.max(repMin, repMax), rir };
}

/**
 * Rang qu'avait l'exercice dans sa dernière séance close (celle qui fixe la charge de référence), parmi les exercices du même muscle
 * principal. Null si la séance ou le catalogue des muscles est illisible : aucune décote (jamais de double compte, jamais de faux rang).
 */
async function referencePositionRank(access: DataAccess, history: readonly { readonly workoutId: string; readonly endedAt: string }[], exerciseId: string, musclesOf: ((id: string) => readonly MuscleWeight[]) | undefined): Promise<number | null> {
  if (musclesOf === undefined) return null;
  const latest = history.reduce<{ readonly workoutId: string; readonly endedAt: string } | null>((best, s) => (best === null || s.endedAt > best.endedAt ? s : best), null);
  if (latest === null) return null;
  try {
    const closed = await (await access.repos.workouts()).getClosed(latest.workoutId);
    if (closed === null) return null;
    return positionRanks(closed.sets.map((s) => ({ exerciseId: s.exerciseId, muscles: musclesOf(s.exerciseId) }))).get(exerciseId) ?? null;
  } catch {
    return null;
  }
}

/** Rampe : « 25 kg × 8 · 37,5 kg × 5 · 50 kg × 2 ». */
const rampText = (ramp: readonly WarmupSet[]): string => ramp.map((s) => tProgression('warmupStep', { load: kg(s.loadKg), reps: s.reps })).join(tProgression('warmupJoin'));

export function ExerciseProgression({ access, workout, exerciseId, sets, exercise, equipment, clock, onChanged, warmup = false, positionRank = 1, musclesOf }: ExerciseProgressionProps) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ readonly load: string; readonly reps: string } | null>(null);
  /** Deload manuel demandé pour cette séance (I2-02) : rien n'est écrit avant une décision. */
  const [deload, setDeload] = useState(false);
  /** I3-02 : deload du cycle déjà proposé (le choix d'Ali n'est plus écrasé aux rechargements). */
  const cyclePreset = useRef(false);
  const live = useRef(true);
  const editLoad = useRef<HTMLInputElement>(null);
  const stateLine = useRef<HTMLParagraphElement>(null);
  /** Vrai après un choix fait ici : le focus passe à l'état de la décision (les boutons disparaissent, le clavier n'est pas perdu). */
  const decided = useRef(false);

  useEffect(() => {
    live.current = true;
    void (async () => {
      try {
        const repo = await access.repos.progression();
        const [history, reference, own, profile, cycle, rawLink] = await Promise.all([
          repo.history(exerciseId),
          // I4-08 : décision illisible ignorée par le repository, journalisée par son nom d'événement fixe (jamais son contenu).
          repo.lastDecision(exerciseId, reportUnreadable),
          repo.decisionFor(workout.id, exerciseId, reportUnreadable),
          repo.getProfile(exerciseId),
          loadCurrentCycle(access, localDayOf(Date.parse(workout.startedAt))),
          // Lien local d'une séance proposée (I4-08) : illisible ou d'une autre séance, il ne vaut rien.
          access.repos.settings.get('training.cycleSession').catch(() => null),
        ]);
        const link = parseSessionLink(rawLink);
        // I4-08 point 5 : le deload du cycle ne vaut que pour une séance issue de la routine du cycle (démarrée ou proposée depuis elle).
        const ofCycle = cycle !== null && sessionRoutineId({ id: workout.id, routineId: workout.routineId }, link) === cycle.record.routineId;
        const cycleDeload = ofCycle && cycle.state.phase === 'active' && cycle.state.kind === 'deload';
        if (!live.current) return;
        // I3-02 : en semaine de deload du cycle, le deload est proposé par défaut (une fois, au premier chargement ; désactivable).
        if (cycleDeload && !cyclePreset.current) {
          cyclePreset.current = true;
          setDeload(true);
        }
        const lastPositionRank = await referencePositionRank(access, history, exerciseId, musclesOf);
        if (!live.current) return;
        setLoad({ status: 'ready', history, reference, own, profile, cycleDeload, targetRir: linkedRir({ id: workout.id }, link, exerciseId), lastPositionRank });
      } catch {
        if (live.current) setLoad({ status: 'error' });
      }
    })();
    return () => {
      live.current = false;
    };
  }, [access, exerciseId, workout.id, workout.routineId, workout.startedAt, attempt]);

  useEffect(() => {
    if (editing !== null) editLoad.current?.focus();
  }, [editing !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // La séance se redessine chaque seconde (chrono) : la cible n'est recalculée, et le moteur rappelé, que si ses valeurs changent.
  const computed = targetOf(sets, exercise, load.status === 'ready' ? load.targetRir : null);
  const target = useMemo(() => computed, [computed.sets, computed.repMin, computed.repMax, computed.rir]); // eslint-disable-line react-hooks/exhaustive-deps
  const ownDecision = load.status === 'ready' ? load.own : null;

  const prescription = useMemo((): Prescription | null => {
    if (load.status !== 'ready') return null;
    const d = load.reference;
    // Référence du moteur : décision d'une séance close avec une valeur retenue (un refus ne fixe rien) ; en pratique antérieure à la fin de
    // cette séance, l'historique l'emporte (critère 8 : la séance faite fait foi).
    const reference = d !== null && d.loadKg !== null ? { decidedAt: d.decidedAt, accepted: d.accepted, loadKg: d.loadKg, reps: d.reps } : null;
    return prescribe({
      exercise: { id: exerciseId, metric: exercise?.metric ?? 'load-reps', equipment: exercise?.equipment ?? [], ...(exercise === undefined ? {} : { kind: exercise.kind }) },
      history: load.history,
      lastDecision: reference,
      profile: load.profile,
      equipment,
      target,
      config: DEFAULT_PROGRESSION_CONFIG,
      now: new Date(clock.nowMs()).toISOString() as IsoDateTime,
      // I2 : aucune source Recovery (I5) ; le snapshot reste nul, aucune modulation.
      recovery: null,
      deload,
      // REV-01 constat 6 : décote de position (§ 11.3) ; inconnue → aucun effet.
      positionRank,
      ...(load.lastPositionRank === null ? {} : { lastPositionRank: load.lastPositionRank }),
    });
    // L'instant de calcul est celui du chargement : la proposition ne change pas pendant la séance.
  }, [load, exerciseId, exercise, equipment, target, deload, positionRank]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ownDecision !== null && decided.current) {
      decided.current = false;
      stateLine.current?.focus();
    }
  }, [ownDecision]);

  const difficulty = sets.map((s) => s.difficulty ?? null).find((d): d is Difficulty => d !== null) ?? null;
  /**
   * Rampe d'échauffement pour une charge retenue ; vide hors premier composé du pattern, si l'exercice en a déjà une, ou si une de ses séries
   * est déjà validée (jamais d'échauffement inséré avant du travail fait).
   */
  const hasWarmup = sets.some((s) => s.setKind === 'warmup' || s.done);
  const rampFor = useCallback(
    (loadKg: number): WarmupSet[] => (warmup && !hasWarmup && exercise !== undefined ? warmupForExercise(exercise, loadKg, equipment) : []),
    [warmup, hasWarmup, exercise, equipment],
  );

  /**
   * Décision tracée puis séries à faire encore vides remplies (même transaction). Rien n'est publié ni consigné au profil avant la clôture :
   * la décision suit la séance (D-27), le recalibrage est consigné par `applyClosedWorkout` à la clôture.
   */
  const decide = useCallback(
    async (accepted: boolean, chosen: { readonly loadKg: number; readonly reps: readonly number[] } | null): Promise<void> => {
      if (prescription === null || load.status !== 'ready') return;
      setError(null);
      setBusy(true);
      try {
        await access.transaction(async (repos) => {
          const progression = await repos.progression();
          await progression.recordDecision({
            exerciseId,
            workoutId: workout.id,
            prescription,
            accepted,
            chosenLoadKg: chosen?.loadKg ?? null,
            chosenReps: chosen?.reps ?? [],
          });
          if (chosen === null) return;
          const workouts = await repos.workouts();
          const work = sets.filter((s) => s.setKind !== 'warmup');
          // Autant de séries que proposées (deload, Recovery bas : moins de séries) ; les autres restent vides, à Ali de décider.
          for (const [i, s] of work.slice(0, chosen.reps.length).entries()) {
            if (s.done || s.reps !== null || s.loadKg !== null) continue;
            await workouts.updateSet(s.id, { loadKg: chosen.loadKg, reps: chosen.reps[i] ?? null });
          }
          // I2-03 : rampe sur la charge retenue, avant la première série de travail (rien si l'exercice en a déjà une).
          const ramp = rampFor(chosen.loadKg);
          if (ramp.length > 0) await workouts.addWarmupSets(workout.id, exerciseId, ramp);
        });
        setEditing(null);
        decided.current = true;
        await onChanged();
        if (live.current) setAttempt((n) => n + 1);
      } catch {
        if (live.current) setError(tProgression('writeError'));
      } finally {
        if (live.current) setBusy(false);
      }
    },
    [access, exerciseId, workout.id, prescription, load.status, sets, onChanged, rampFor],
  );

  async function chooseDifficulty(value: Difficulty): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      await access.transaction(async (repos) => (await repos.workouts()).setDifficulty(workout.id, exerciseId, value === difficulty ? null : value));
      await onChanged();
    } catch {
      if (live.current) setError(tProgression('difficultyError'));
    } finally {
      if (live.current) setBusy(false);
    }
  }

  function saveEdit(): void {
    if (editing === null) return;
    const loadKg = parse(editing.load);
    const reps = parse(editing.reps);
    if (loadKg === null || loadKg > 1000 || reps === null || !Number.isInteger(reps) || reps < 1 || reps > 999) {
      setError(tProgression('editInvalid'));
      return;
    }
    void decide(false, { loadKg, reps: Array.from({ length: Math.max(1, prescription?.sets.length ?? target.sets) }, () => reps) });
  }
  const onEditKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!busy) saveEdit();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      setEditing(null);
      setError(null);
    }
  };

  const proposalBody = (() => {
    if (load.status === 'loading') return <p className="ct-progression__muted" role="status">{tProgression('loading')}</p>;
    if (load.status === 'error' || prescription === null) return <p className="ct-progression__muted">{tProgression('loadError')}</p>;
    const p = prescription;
    const explanation = explainPrescription(p);
    const params: Record<string, string | number> = { ...explanation.params };
    for (const key of ['load', 'delta', 'cut'] as const) if (typeof params[key] === 'number') params[key] = kg(params[key]);
    // I2-04 : précisions (séance partielle ignorée, matériel à vérifier) dans la même phrase, lues d'un trait.
    const notes = explanationNotes(p).map((n) => tProgression(n.key, n.params));
    const sentence = [tProgression(EXPLAIN_KEYS[explanation.key], params), ...notes].join(' ');
    const value = p.status === 'unsupported' ? tProgression('noProposal') : p.loadKg === null ? tProgression('toEnter') : tProgression('value', { load: kg(p.loadKg), reps: repsText(p.sets.map((s) => s.reps)) });
    const proposed = p.status === 'prescribed' && p.loadKg !== null;
    const alerts = constraintAlerts(p);
    const ramp = proposed && ownDecision === null && p.loadKg !== null ? rampFor(p.loadKg) : [];
    const options = p.options ?? [];
    return (
      <>
        <p className="ct-progression__value ct-session__num">{value}</p>
        <p className="ct-progression__sentence">{sentence}</p>
        {p.status !== 'unsupported' && p.deload !== true && typeof p.rirTarget === 'number' ? (
          <p className="ct-progression__muted">{p.rirTarget === 1 ? tProgression('rirTargetOne') : tProgression('rirTargetMany', { rir: p.rirTarget })}</p>
        ) : null}
        {proposed ? <p className="ct-progression__muted">{tProgression('confidence', { percent: confidencePercent(p.confidence), band: tProgression(BAND_KEYS[confidenceBand(p.confidence)]) })}</p> : null}
        {proposed && alerts.length > 0 ? (
          <ul className="ct-progression__alerts" aria-label={tProgression('alertsLabel')}>
            {alerts.map((a) => (
              <li key={a.key}>{tProgression(a.key, a.params)}</li>
            ))}
          </ul>
        ) : null}
        {ownDecision !== null ? (
          <p ref={stateLine} tabIndex={-1} className="ct-progression__state" role="status">
            {ownDecision.loadKg === null
              ? tProgression('refused')
              : ownDecision.accepted
                ? tProgression('accepted')
                : tProgression('modified', { load: kg(ownDecision.loadKg), reps: chosenRepsText(ownDecision.reps) })}
          </p>
        ) : proposed && p.loadKg !== null && editing === null ? (
          <>
            <div className="ct-progression__actions">
              <Button disabled={busy} onClick={() => void decide(true, { loadKg: p.loadKg ?? 0, reps: p.sets.map((s) => s.reps) })}>
                {tProgression('accept')}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setEditing({ load: kg(p.loadKg ?? 0), reps: String(p.sets[0]?.reps ?? target.repMin) })}>
                {tProgression('modify')}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void decide(false, null)}>
                {tProgression('refuse')}
              </Button>
            </div>
            {ramp.length > 0 ? (
              <div className="ct-progression__warmup">
                <p className="ct-progression__sentence ct-session__num">{tProgression('warmupPreview', { ramp: rampText(ramp) })}</p>
                <p className="ct-progression__hint">{tProgression('warmupHint')}</p>
              </div>
            ) : null}
            <p className="ct-progression__muted">{tProgression('decisionHint')}</p>
            {options.length > 0 ? (
              <div className="ct-progression__options" role="group" aria-label={tProgression('optionsTitle')}>
                <span className="ct-training__label">{tProgression('optionsTitle')}</span>
                {options.map((o) => {
                  const e = explainOption(o, p.activeConfig);
                  const chosen = o.loadKg !== null && o.reps !== null ? { loadKg: o.loadKg, reps: o.reps } : null;
                  const text = tProgression(OPTION_KEYS[e.key], { ...e.params, value: chosen === null ? '' : tProgression('value', { load: kg(chosen.loadKg), reps: repsText(chosen.reps) }) });
                  return (
                    <div key={o.kind} className="ct-progression__option">
                      <p className="ct-progression__sentence">{text}</p>
                      {chosen !== null ? (
                        <Button variant="secondary" disabled={busy} ariaLabel={tProgression('chooseLabel', { option: text })} onClick={() => void decide(false, chosen)}>
                          {tProgression('choose')}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
                <p className="ct-progression__hint">{tProgression('optionsHint')}</p>
              </div>
            ) : null}
          </>
        ) : null}
        {ownDecision === null && editing === null && p.status === 'prescribed' && p.reference !== null ? (
          <div className="ct-progression__deload">
            <Button variant="secondary" pressed={deload} disabled={busy} onClick={() => setDeload((on) => !on)}>
              {tProgression('deloadToggle')}
            </Button>
            <p className="ct-progression__muted" aria-live="polite">
              {tProgression(deload ? 'deloadOn' : 'deloadOff')}
            </p>
            {load.status === 'ready' && load.cycleDeload ? <p className="ct-progression__muted">{tProgression('cycleDeloadNote')}</p> : null}
          </div>
        ) : null}
        {editing !== null && ownDecision === null ? (
          <div className="ct-progression__edit">
            <label className="ct-progression__field">
              <span className="ct-training__label">{tProgression('editLoad')}</span>
              <input
                ref={editLoad}
                className="ct-session__input"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                value={editing.load}
                onChange={(e) => setEditing((now) => (now === null ? now : { ...now, load: e.target.value }))}
                onKeyDown={onEditKey}
              />
            </label>
            <label className="ct-progression__field">
              <span className="ct-training__label">{tProgression('editReps')}</span>
              <input
                className="ct-session__input"
                inputMode="numeric"
                enterKeyHint="done"
                autoComplete="off"
                value={editing.reps}
                onChange={(e) => setEditing((now) => (now === null ? now : { ...now, reps: e.target.value }))}
                onKeyDown={onEditKey}
              />
            </label>
            <div className="ct-progression__actions">
              <Button disabled={busy} onClick={saveEdit}>
                {tProgression('save')}
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setError(null);
                }}
              >
                {tProgression('cancel')}
              </Button>
            </div>
          </div>
        ) : null}
      </>
    );
  })();

  return (
    <div className="ct-progression">
      <div className="ct-progression__proposal" role="group" aria-label={tProgression('title')}>
        <span className="ct-training__eyebrow">{tProgression('title')}</span>
        {proposalBody}
        {error && (
          <p className="ct-training__error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="ct-progression__difficulty" role="group" aria-label={tProgression('difficultyTitle')}>
        <span className="ct-training__label">{tProgression('difficultyTitle')}</span>
        <div className="ct-progression__choices">
          {DIFFICULTIES.map((value) => (
            <button key={value} type="button" className="ct-progression__choice" aria-pressed={difficulty === value} disabled={busy} onClick={() => void chooseDifficulty(value)}>
              {tProgression(DIFFICULTY_KEYS[value])}
            </button>
          ))}
        </div>
        <p className="ct-progression__muted" aria-live="polite">
          {difficulty === null ? tProgression('difficultyNone') : tProgression('difficultyChosen', { value: tProgression(DIFFICULTY_KEYS[difficulty]) })}
        </p>
        <p className="ct-progression__hint">{tProgression('difficultyHint')}</p>
      </div>
    </div>
  );
}
