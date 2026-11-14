import { useState } from 'react';
import { DEFAULT_REST_GAP_KCAL, DEFAULT_TRAINING_DAYS, restTargetFromGap, restTargetFromKcal, weeklyAverageTarget, type RestPlan, type Target } from '../../../domain/nutrition';
import type { Weekday } from '../../../domain/types';
import { formatInt, tNutrition } from '../../../i18n/nutritionText';
import { Button, SegmentedControl, Switch, WeekdayToggles } from '../../../ui';
import { NumberField, parseNumber } from '../shared';

/**
 * PROG-01 (D-270, D-271) : cible des jours de repos, sous la cible en vigueur (celle des jours d'entraînement). Absente par défaut ; saisie par
 * un écart (−200 kcal par défaut, porté par les glucides) ou en kcal ; jours d'entraînement (lundi, mardi, jeudi, vendredi, samedi par défaut) ;
 * moyenne de la semaine. Enregistrer écrit une nouvelle décision (D-74), protéines et lipides inchangés.
 */
type Mode = 'gap' | 'kcal';

export function RestTargetForm({ target, plan, onSave }: { readonly target: Target; readonly plan: RestPlan | null; readonly onSave: (plan: RestPlan | null) => Promise<boolean> }) {
  const [enabled, setEnabled] = useState(plan !== null);
  const [mode, setMode] = useState<Mode>('gap');
  const [gap, setGap] = useState(String(plan === null ? -DEFAULT_REST_GAP_KCAL : Math.max(0, target.kcal - plan.rest.kcal)));
  const [kcal, setKcal] = useState(String(plan?.rest.kcal ?? target.kcal + DEFAULT_REST_GAP_KCAL));
  const [days, setDays] = useState<readonly Weekday[]>(plan?.trainingDays ?? DEFAULT_TRAINING_DAYS);
  const [status, setStatus] = useState<'idle' | 'saved' | 'invalid' | 'error'>('idle');

  const value = parseNumber(mode === 'gap' ? gap : kcal);
  const rest: Target | null =
    typeof value !== 'number' || !(value >= 0) ? null : mode === 'gap' ? restTargetFromGap(target, -value) : value > 0 ? restTargetFromKcal(target, value) : null;
  const valid = rest !== null && rest.kcal > 0 && days.length > 0 && days.length < 7;
  const toggleDay = (day: Weekday): void => setDays((list) => (list.includes(day) ? list.filter((d) => d !== day) : [...list, day].sort((a, b) => a - b)));

  async function save(next: RestPlan | null): Promise<void> {
    setStatus((await onSave(next)) ? 'saved' : 'error');
  }

  return (
    <div className="ct-nutrition__rest">
      <Switch
        checked={enabled}
        label={tNutrition('restTargetToggle')}
        onChange={(on) => {
          setEnabled(on);
          setStatus('idle');
          if (!on && plan !== null) void save(null);
        }}
      />
      {plan !== null ? (
        <>
          <p className="ct-nutrition__muted">{tNutrition('restTargetCurrent', { kcal: formatInt(plan.rest.kcal), carbs: formatInt(plan.rest.carbG) })}</p>
          <p className="ct-nutrition__muted">{tNutrition('weeklyAverage', { kcal: formatInt(weeklyAverageTarget(target, plan).kcal) })}</p>
        </>
      ) : null}
      {enabled ? (
        <>
          <SegmentedControl<Mode>
            label={tNutrition('restTargetMode')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'gap', label: tNutrition('restTargetByGap') },
              { value: 'kcal', label: tNutrition('restTargetByKcal') },
            ]}
          />
          {mode === 'gap' ? (
            <NumberField label={tNutrition('restTargetGap')} value={gap} onChange={setGap} step="1" invalid={rest === null} />
          ) : (
            <NumberField label={tNutrition('restTargetKcal')} value={kcal} onChange={setKcal} step="1" invalid={rest === null} />
          )}
          <WeekdayToggles label={tNutrition('trainingDays')} value={days} onToggle={toggleDay} />
          {rest !== null ? <p className="ct-nutrition__muted">{tNutrition('restTargetPreview', { kcal: formatInt(rest.kcal), carbs: formatInt(rest.carbG) })}</p> : null}
          <Button variant="secondary" disabled={!valid} onClick={() => (valid && rest !== null ? void save({ rest, trainingDays: days }) : setStatus('invalid'))}>
            {tNutrition('restTargetSave')}
          </Button>
        </>
      ) : null}
      {status === 'saved' ? <p role="status">{tNutrition('restTargetSaved')}</p> : null}
      {status === 'error' ? <p role="alert">{tNutrition('restTargetError')}</p> : null}
    </div>
  );
}
