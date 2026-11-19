import { useEffect, useId, useState, type ReactNode } from 'react';
import { ACTIVITY_LEVELS, GOAL_RATE_MAX_KG, type ActivityLevel, type CheckInStyle, type NutritionPrefs, type Target } from '../../../domain/nutrition';
import type { NutritionTargetRecord } from '../../../db/repositories/nutritionTargetRepository';
import { formatDayMonth, formatInt, formatKgDelta, formatWeekdayDate, tNutrition, weekdayNames, type NutritionTextKey } from '../../../i18n/nutritionText';
import { Button, HeroFigure, SegmentedControl } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { useNavigationStore } from '../../app/navigation';
import { NumberField, parseNumber } from '../shared';
import { activeRoutineDayCount, saveManualTarget, saveRestPlan, saveNutritionPrefs, type NutritionSnapshot } from '../useCases';
import { RestTargetForm } from './RestTargetForm';
import { TargetForm, type TargetSaveResult } from './TargetForm';
import { collapseRecopies, defaultTrainingDays, restTargetFromGap, targetDecidedOn, targetInForceSince, upcomingTargets, type RestPlan } from '../../../domain/nutrition';

const STYLE_HINT: Readonly<Record<CheckInStyle, NutritionTextKey>> = { guided: 'styleGuidedHint', collaborative: 'styleCollaborativeHint', manual: 'styleManualHint' };
const STYLE_KEY: Readonly<Record<CheckInStyle, NutritionTextKey>> = { guided: 'styleGuided', collaborative: 'styleCollaborative', manual: 'styleManual' };
const GOAL_KEY: Readonly<Record<NutritionPrefs['goal']['kind'], NutritionTextKey>> = { maintain: 'goalMaintain', loss: 'goalLoss', gain: 'goalGain' };
const ACTIVITY_KEY: Readonly<Record<ActivityLevel, NutritionTextKey>> = { sedentary: 'activitySedentary', light: 'activityLight', moderate: 'activityModerate', active: 'activityActive' };
/** Vitesse proposée au choix de « Perte » ou « Prise » : visible et modifiable, le moteur la borne encore à 1 % du poids par semaine. */
const DEFAULT_RATE_KG = 0.25;
const MIN_RATE_KG = 0.05;

type GoalKind = NutritionPrefs['goal']['kind'];
type RowId = 'style' | 'weekday' | 'goal' | 'activity';

export function describeDecision(record: NutritionTargetRecord): string {
  if (record.source === 'manual') return tNutrition('historyManual');
  return tNutrition(record.accepted ? 'historyAuto' : 'historyAutoRefused');
}

/** « 2 450 kcal · P 190 · G 250 · L 75 » (historique, cible à venir). */
const targetValues = (t: Target): string =>
  `${tNutrition('kcalValue', { n: formatInt(t.kcal) })} · ${tNutrition('macroShortP')} ${formatInt(t.proteinG)} · ${tNutrition('macroShortC')} ${formatInt(t.carbG)} · ${tNutrition('macroShortF')} ${formatInt(t.fatG)}`;

/** Cible actuelle : les calories en chiffre héros du bloc (ERGO-01b), les macros en dessous. */
export function TargetSummary({ target }: { readonly target: Target }) {
  return (
    <>
      <HeroFigure value={formatInt(target.kcal)} unit={tNutrition('targetKcalUnit')} />
      <p className="ct-nutrition__num">
        {tNutrition('macroShortP')} {formatInt(target.proteinG)} · {tNutrition('macroShortC')} {formatInt(target.carbG)} · {tNutrition('macroShortF')} {formatInt(target.fatG)}
      </p>
    </>
  );
}

/**
 * ERGO-03 : ligne « étiquette · valeur » de Stratégie, comme Plus ; elle déplie son réglage (`aria-expanded`). Nom accessible
 * « étiquette : valeur ». Une seule ligne ouverte à la fois.
 */
function StrategyRow({ label, value, open, onToggle, children }: { readonly label: string; readonly value: string; readonly open: boolean; readonly onToggle: () => void; readonly children: ReactNode }) {
  const id = useId();
  return (
    <div className="ct-strategy__item">
      <button type="button" className="ct-strategy__row" aria-expanded={open} aria-controls={open ? id : undefined} aria-label={`${label} : ${value}`} onClick={onToggle}>
        <span className="ct-strategy__label">{label}</span>
        <span className="ct-strategy__value">{value}</span>
      </button>
      {open ? (
        <div id={id} className="ct-strategy__editor">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export interface StrategyViewProps {
  readonly snapshot: NutritionSnapshot;
  readonly onChanged: () => Promise<void>;
}

/**
 * Stratégie (I4-03, § 15.2 ; D-74) : style du check-in (Guidé / Collaboratif / Manuel), objectif (maintien par défaut), niveau d'activité
 * DÉCLARÉ, jour du check-in (lundi par défaut), cible actuelle et historique de chaque décision. Ali a le dernier mot : sa cible est
 * enregistrée telle quelle (source « manuelle ») et tracée ; rien ne change sans son geste.
 *
 * ERGO-03 : groupes Style / Objectif / Cible / Jours de repos / Historique, une ligne par réglage avec sa valeur ; cible en vigueur et, à
 * côté, la plus proche des cibles à venir (D-295) ; formulaire de cible replié et vide ; une cible du jour ne masque plus une cible
 * prévue plus tard, aucune confirmation (FIX-0271, D-314, remplace D-296 (2) et (4)).
 */
export function StrategyView({ snapshot, onChanged }: StrategyViewProps) {
  const { data } = useAppContainer();
  const navigate = useNavigationStore((s) => s.navigate);
  const [prefs, setPrefs] = useState<NutritionPrefs>(snapshot.prefs);
  const [rate, setRate] = useState(snapshot.prefs.goal.kind === 'maintain' ? '' : String(snapshot.prefs.goal.weeklyRateKg));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [restPartial, setRestPartial] = useState(false);
  const [routineDays, setRoutineDays] = useState<number | null>(null);
  const [openRow, setOpenRow] = useState<RowId | null>(null);
  const [editing, setEditing] = useState(false);
  const { profile, target, targets } = snapshot;
  // D-295 : la plus proche des cibles à venir (acceptée, datée après aujourd'hui, en vigueur à sa date).
  const upcoming = upcomingTargets(targets, snapshot.today)[0] ?? null;
  const profileComplete = profile !== null && profile.sex !== null && profile.birthYear !== null && profile.heightCm !== null;
  const toggle = (row: RowId) => () => setOpenRow((current) => (current === row ? null : row));

  useEffect(() => {
    let live = true;
    void activeRoutineDayCount(data).then((n) => {
      if (live) setRoutineDays(n);
    });
    return () => {
      live = false;
    };
  }, [data]);

  async function update(next: NutritionPrefs): Promise<void> {
    setPrefs(next);
    setError(null);
    try {
      await saveNutritionPrefs(data, next);
      await onChanged();
    } catch {
      setError(tNutrition('writeError'));
    }
  }

  function chooseGoal(kind: GoalKind): void {
    if (kind === 'maintain') {
      setRate('');
      void update({ ...prefs, goal: { kind } });
    } else {
      setRate(String(DEFAULT_RATE_KG));
      void update({ ...prefs, goal: { kind, weeklyRateKg: DEFAULT_RATE_KG } });
    }
  }

  function changeRate(value: string): void {
    setRate(value);
    const n = parseNumber(value);
    if (prefs.goal.kind !== 'maintain' && typeof n === 'number' && n >= MIN_RATE_KG && n <= GOAL_RATE_MAX_KG) void update({ ...prefs, goal: { kind: prefs.goal.kind, weeklyRateKg: n } });
  }
  const rateParsed = parseNumber(rate);
  const rateInvalid = prefs.goal.kind !== 'maintain' && !(typeof rateParsed === 'number' && rateParsed >= MIN_RATE_KG && rateParsed <= GOAL_RATE_MAX_KG);

  async function saveRest(restPlan: RestPlan | null): Promise<boolean> {
    if (target === null) return false;
    try {
      const result = await saveRestPlan(data, { today: snapshot.today, current: target, restPlan });
      if (result !== 'saved' && result !== 'saved-partial') return false;
      // Le formulaire est recréé à chaque nouvelle décision : le signalement vit ici, pas dans le formulaire.
      setRestPartial(result === 'saved-partial');
      await onChanged();
      return true;
    } catch {
      return false;
    }
  }

  async function saveTarget(next: Target, lowFloorConfirmed: boolean): Promise<TargetSaveResult> {
    // FIX-0271 (D-314) : une cible du jour ne masque plus une cible prévue plus tard (elle prend effet à sa date) : aucune confirmation.
    try {
      // PROG-01 (D-271) : une nouvelle cible d'entraînement garde l'écart de la cible de repos en vigueur.
      const plan = target?.restPlan ?? null;
      const restPlan = plan === null || target === null ? null : { rest: restTargetFromGap(next, plan.rest.kcal - target.target.kcal), trainingDays: plan.trainingDays };
      const result = await saveManualTarget(data, { weekStart: snapshot.today, target: next, lowFloorConfirmed, restPlan });
      if (typeof result === 'string') return result;
      setRestPartial(false);
      setSaved(true);
      setEditing(false);
      await onChanged();
      return 'saved';
    } catch {
      return 'error';
    }
  }

  const goalName = tNutrition(GOAL_KEY[prefs.goal.kind]);
  const goalValue = prefs.goal.kind === 'maintain' ? goalName : tNutrition('goalValueRate', { goal: goalName, rate: formatKgDelta(prefs.goal.weeklyRateKg).replace(/^[+−]/, '') });
  const targetButton = tNutrition(target === null ? 'targetFormTitle' : 'editTarget');

  return (
    <div className="ct-nutrition__strategy">
      {error ? (
        <p role="alert" className="ct-nutrition__warning">
          {error}
        </p>
      ) : null}

      <section className="ct-nutrition__card ct-flat" aria-labelledby="ct-nutrition-style">
        <h2 id="ct-nutrition-style" className="ct-nutrition__eyebrow ct-section-title">
          {tNutrition('groupStyle')}
        </h2>
        <StrategyRow label={tNutrition('styleTitle')} value={tNutrition(STYLE_KEY[prefs.style])} open={openRow === 'style'} onToggle={toggle('style')}>
          <SegmentedControl
            label={tNutrition('styleTitle')}
            value={prefs.style}
            onChange={(style) => void update({ ...prefs, style })}
            options={[
              { value: 'guided', label: tNutrition('styleGuided') },
              { value: 'collaborative', label: tNutrition('styleCollaborative') },
              { value: 'manual', label: tNutrition('styleManual') },
            ]}
          />
          <p className="ct-nutrition__muted">{tNutrition(STYLE_HINT[prefs.style])}</p>
          <p className="ct-nutrition__muted">{tNutrition('styleHelp')}</p>
        </StrategyRow>
        <StrategyRow label={tNutrition('weekdayLabel')} value={weekdayNames()[prefs.checkInWeekday - 1] ?? ''} open={openRow === 'weekday'} onToggle={toggle('weekday')}>
          <label className="ct-nutrition__field">
            <span className="ct-nutrition__field-label">{tNutrition('weekdayLabel')}</span>
            <select
              className="ct-nutrition__input"
              value={String(prefs.checkInWeekday)}
              onChange={(event) => void update({ ...prefs, checkInWeekday: Number(event.target.value) as NutritionPrefs['checkInWeekday'] })}
            >
              {weekdayNames().map((name, index) => (
                <option key={name} value={String(index + 1)}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <p className="ct-nutrition__muted">{tNutrition('weekdayHelp')}</p>
        </StrategyRow>
      </section>

      <section className="ct-nutrition__card ct-flat" aria-labelledby="ct-nutrition-goal">
        <h2 id="ct-nutrition-goal" className="ct-nutrition__eyebrow ct-section-title">
          {tNutrition('goalTitle')}
        </h2>
        <StrategyRow label={tNutrition('goalTitle')} value={goalValue} open={openRow === 'goal'} onToggle={toggle('goal')}>
          <SegmentedControl
            label={tNutrition('goalTitle')}
            value={prefs.goal.kind}
            onChange={chooseGoal}
            options={[
              { value: 'maintain', label: tNutrition('goalMaintain') },
              { value: 'loss', label: tNutrition('goalLoss') },
              { value: 'gain', label: tNutrition('goalGain') },
            ]}
          />
          {prefs.goal.kind === 'maintain' ? (
            <p className="ct-nutrition__muted">{tNutrition('goalDefaultHint')}</p>
          ) : (
            <>
              <NumberField label={tNutrition('goalRate')} value={rate} onChange={changeRate} step="0.05" invalid={rateInvalid} />
              {rateInvalid ? (
                <p role="alert" className="ct-nutrition__warning">
                  {tNutrition('goalRateInvalid')}
                </p>
              ) : null}
            </>
          )}
        </StrategyRow>
        <StrategyRow
          label={tNutrition('activityTitle')}
          value={tNutrition(prefs.activity === null ? 'activityNone' : ACTIVITY_KEY[prefs.activity])}
          open={openRow === 'activity'}
          onToggle={toggle('activity')}
        >
          <SegmentedControl
            label={tNutrition('activityTitle')}
            columns={2}
            value={prefs.activity ?? 'none'}
            onChange={(value) => void update({ ...prefs, activity: value === 'none' ? null : value })}
            options={[
              { value: 'none', label: tNutrition('activityNone') },
              ...ACTIVITY_LEVELS.map((level) => ({ value: level, label: tNutrition(ACTIVITY_KEY[level]) })),
            ]}
          />
          <p className="ct-nutrition__muted">{tNutrition('activityHelp')}</p>
        </StrategyRow>
        {profileComplete ? null : (
          <>
            <p role="status" className="ct-nutrition__warning">
              {tNutrition('profileIncomplete')}
            </p>
            <Button variant="secondary" onClick={() => navigate({ tab: 'more', screen: 'body' })}>
              {tNutrition('profileOpen')}
            </Button>
          </>
        )}
      </section>

      <section className="ct-nutrition__card ct-flat" aria-labelledby="ct-nutrition-current">
        <h2 id="ct-nutrition-current" className="ct-nutrition__eyebrow ct-section-title">
          {tNutrition('groupTarget')}
        </h2>
        {target === null ? (
          <p>{tNutrition('noTarget')}</p>
        ) : (
          <>
            <TargetSummary target={target.target} />
            <p className="ct-nutrition__muted">{tNutrition('currentTargetSince', { date: formatDayMonth(targetInForceSince(target)), decided: formatDayMonth(targetDecidedOn(target) ?? target.weekStart) })}</p>
          </>
        )}
        {upcoming !== null ? <p className="ct-nutrition__num ct-strategy__upcoming">{tNutrition('upcomingTarget', { date: formatWeekdayDate(upcoming.weekStart), values: targetValues(upcoming.target) })}</p> : null}
        {/* ERGO-03 : formulaire replié derrière ce bouton, champs vides : aucune valeur prête à écraser la cible. */}
        <Button variant="secondary" expanded={editing} onClick={() => setEditing((v) => !v)}>
          {targetButton}
        </Button>
        {editing ? <TargetForm key={target?.id ?? 'none'} title={targetButton} initial={null} submitLabel={tNutrition('saveTarget')} onSave={saveTarget} onCancel={() => setEditing(false)} /> : null}
        {saved ? <p role="status">{tNutrition('targetSaved')}</p> : null}
      </section>

      <section className="ct-nutrition__card ct-flat" aria-labelledby="ct-nutrition-rest">
        <h2 id="ct-nutrition-rest" className="ct-nutrition__eyebrow ct-section-title">
          {tNutrition('groupRest')}
        </h2>
        {target === null ? (
          <p className="ct-nutrition__muted">{tNutrition('restNeedsTarget')}</p>
        ) : (
          <RestTargetForm key={`rest-${target.id}`} target={target.target} plan={target.restPlan ?? null} defaultDays={defaultTrainingDays(routineDays)} onSave={saveRest} />
        )}
        {restPartial ? <p role="status">{tNutrition('restTargetPartial')}</p> : null}
      </section>

      <section className="ct-nutrition__card ct-flat" aria-labelledby="ct-nutrition-history">
        <h2 id="ct-nutrition-history" className="ct-nutrition__eyebrow ct-section-title">
          {tNutrition('groupHistory')}
        </h2>
        {targets.length === 0 ? (
          <p className="ct-nutrition__muted">{tNutrition('historyEmpty')}</p>
        ) : (
          <ul className="ct-nutrition__list">
            {collapseRecopies(targets).map((record) => (
              <li key={record.id} className="ct-nutrition__history">
                <p className="ct-nutrition__num">
                  {formatDayMonth(record.weekStart)} · {targetValues(record.target)}
                </p>
                <p className="ct-nutrition__muted">
                  {describeDecision(record)}
                  {record.engineVersion === null ? '' : ` · ${tNutrition('historyVersion', { n: record.engineVersion })}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
