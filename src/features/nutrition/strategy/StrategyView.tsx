import { useState } from 'react';
import { ACTIVITY_LEVELS, GOAL_RATE_MAX_KG, type ActivityLevel, type CheckInStyle, type NutritionPrefs, type Target } from '../../../domain/nutrition';
import type { NutritionTargetRecord } from '../../../db/repositories/nutritionTargetRepository';
import { formatDayMonth, formatInt, tNutrition, weekdayNames, type NutritionTextKey } from '../../../i18n/nutritionText';
import { Button, HeroFigure, SegmentedControl } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { useNavigationStore } from '../../app/navigation';
import { NumberField, parseNumber } from '../shared';
import { saveManualTarget, saveNutritionPrefs, type NutritionSnapshot } from '../useCases';
import { RestTargetForm } from './RestTargetForm';
import { TargetForm, type TargetSaveResult } from './TargetForm';
import { restTargetFromGap, type RestPlan } from '../../../domain/nutrition';

const STYLE_HINT: Readonly<Record<CheckInStyle, NutritionTextKey>> = { guided: 'styleGuidedHint', collaborative: 'styleCollaborativeHint', manual: 'styleManualHint' };
const ACTIVITY_KEY: Readonly<Record<ActivityLevel, NutritionTextKey>> = { sedentary: 'activitySedentary', light: 'activityLight', moderate: 'activityModerate', active: 'activityActive' };
/** Vitesse proposée au choix de « Perte » ou « Prise » : visible et modifiable, le moteur la borne encore à 1 % du poids par semaine. */
const DEFAULT_RATE_KG = 0.25;
const MIN_RATE_KG = 0.05;

type GoalKind = NutritionPrefs['goal']['kind'];

export function describeDecision(record: NutritionTargetRecord): string {
  if (record.source === 'manual') return tNutrition('historyManual');
  return tNutrition(record.accepted ? 'historyAuto' : 'historyAutoRefused');
}

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

export interface StrategyViewProps {
  readonly snapshot: NutritionSnapshot;
  readonly onChanged: () => Promise<void>;
}

/**
 * Stratégie (I4-03, § 15.2 ; D-74) : style du check-in (Guidé / Collaboratif / Manuel), objectif (maintien par défaut), niveau d'activité
 * DÉCLARÉ, jour du check-in (lundi par défaut), cible actuelle et historique de chaque décision. Ali a le dernier mot : sa cible est
 * enregistrée telle quelle (source « manuelle ») et tracée ; rien ne change sans son geste.
 */
export function StrategyView({ snapshot, onChanged }: StrategyViewProps) {
  const { data } = useAppContainer();
  const navigate = useNavigationStore((s) => s.navigate);
  const [prefs, setPrefs] = useState<NutritionPrefs>(snapshot.prefs);
  const [rate, setRate] = useState(snapshot.prefs.goal.kind === 'maintain' ? '' : String(snapshot.prefs.goal.weeklyRateKg));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { profile, target, targets } = snapshot;
  const profileComplete = profile !== null && profile.sex !== null && profile.birthYear !== null && profile.heightCm !== null;

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
      const result = await saveManualTarget(data, { weekStart: snapshot.today, target: target.target, lowFloorConfirmed: true, restPlan });
      if (typeof result === 'string') return false;
      await onChanged();
      return true;
    } catch {
      return false;
    }
  }

  async function saveTarget(next: Target, lowFloorConfirmed: boolean): Promise<TargetSaveResult> {
    try {
      // PROG-01 (D-271) : une nouvelle cible d'entraînement garde l'écart de la cible de repos en vigueur.
      const plan = target?.restPlan ?? null;
      const restPlan = plan === null || target === null ? null : { rest: restTargetFromGap(next, plan.rest.kcal - target.target.kcal), trainingDays: plan.trainingDays };
      const result = await saveManualTarget(data, { weekStart: snapshot.today, target: next, lowFloorConfirmed, restPlan });
      if (typeof result === 'string') return result;
      setSaved(true);
      await onChanged();
      return 'saved';
    } catch {
      return 'error';
    }
  }

  return (
    <div className="ct-nutrition__strategy">
      {error ? (
        <p role="alert" className="ct-nutrition__warning">
          {error}
        </p>
      ) : null}

      <section className="ct-nutrition__card ct-flat" aria-labelledby="ct-nutrition-style">
        <h2 id="ct-nutrition-style" className="ct-nutrition__eyebrow ct-section-title">
          {tNutrition('styleTitle')}
        </h2>
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
      </section>

      <section className="ct-nutrition__card ct-flat" aria-labelledby="ct-nutrition-goal">
        <h2 id="ct-nutrition-goal" className="ct-nutrition__eyebrow ct-section-title">
          {tNutrition('goalTitle')}
        </h2>
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
      </section>

      <section className="ct-nutrition__card ct-flat" aria-labelledby="ct-nutrition-activity">
        <h2 id="ct-nutrition-activity" className="ct-nutrition__eyebrow ct-section-title">
          {tNutrition('activityTitle')}
        </h2>
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

      <section className="ct-nutrition__card ct-flat" aria-labelledby="ct-nutrition-weekday">
        <h2 id="ct-nutrition-weekday" className="ct-nutrition__eyebrow ct-section-title">
          {tNutrition('sectionCheckIn')}
        </h2>
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
      </section>

      <section className="ct-nutrition__card ct-flat" aria-labelledby="ct-nutrition-current">
        <h2 id="ct-nutrition-current" className="ct-nutrition__eyebrow ct-section-title">
          {tNutrition('currentTarget')}
        </h2>
        {target === null ? (
          <p>{tNutrition('noTarget')}</p>
        ) : (
          <>
            <TargetSummary target={target.target} />
            <p className="ct-nutrition__muted">{tNutrition('currentTargetSince', { date: formatDayMonth(target.weekStart) })}</p>
          </>
        )}
        {target !== null ? <RestTargetForm key={`rest-${target.id}`} target={target.target} plan={target.restPlan ?? null} onSave={saveRest} /> : null}
        <TargetForm key={target?.id ?? 'none'} title={tNutrition('targetFormTitle')} initial={target?.target ?? null} submitLabel={tNutrition('saveTarget')} onSave={saveTarget} />
        {saved ? <p role="status">{tNutrition('targetSaved')}</p> : null}
      </section>

      <section className="ct-nutrition__card ct-flat" aria-labelledby="ct-nutrition-history">
        <h2 id="ct-nutrition-history" className="ct-nutrition__eyebrow ct-section-title">
          {tNutrition('historyTitle')}
        </h2>
        {targets.length === 0 ? (
          <p className="ct-nutrition__muted">{tNutrition('historyEmpty')}</p>
        ) : (
          <ul className="ct-nutrition__list">
            {targets.map((record) => (
              <li key={record.id} className="ct-nutrition__history">
                <p className="ct-nutrition__num">
                  {formatDayMonth(record.weekStart)} · {tNutrition('kcalValue', { n: formatInt(record.target.kcal) })} · {tNutrition('macroShortP')} {formatInt(record.target.proteinG)} · {tNutrition('macroShortC')} {formatInt(record.target.carbG)} · {tNutrition('macroShortF')} {formatInt(record.target.fatG)}
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
