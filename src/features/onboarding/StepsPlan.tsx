import { useState } from 'react';
import { cycleMuscle, startingExpenditure } from '../../domain/onboarding';
import { NUTRITION_CONFIG } from '../../domain/nutrition/config';
import { EXERCISE_PATTERNS, type ExercisePattern, type SplitKind, type VarietyLevel } from '../../domain/training';
import { tGeneration, type TrainingGenerationTextKey } from '../../i18n/trainingGenerationText';
import { tTraining } from '../../i18n/trainingText';
import { formatInt, tOnboarding, type OnboardingTextKey } from '../../i18n/onboardingText';
import { Button, SegmentedControl, Switch } from '../../ui';
import { groupLabel, PATTERN_KEY } from '../training/labels';
import { BodyMap } from './BodyMap';
import { OptionCards } from './OptionCards';
import { FieldError, TextInput, ExpenditureEstimate, type StepProps } from './StepsBasics';
import { buildFirstSession, proposalFor } from './firstSession';

const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'forearms'] as const;

const EQUIPMENT_HINT = { salle: 'equipmentSalleHint', maison: 'equipmentMaisonHint', voyage: 'equipmentVoyageHint' } as const satisfies Record<string, OnboardingTextKey>;

export function StepEquipment({ draft, patch, content }: StepProps) {
  if (content === null) return <p className="ct-onb__muted" role="status">{tOnboarding('equipmentLoading')}</p>;
  if (content === 'error') return <p className="ct-onb__error" role="alert">{tOnboarding('contentError')}</p>;
  return (
    <div className="ct-onb__group">
      <span className="ct-onb__label">{tOnboarding('equipmentLabel')}</span>
      <OptionCards<string>
        label={tOnboarding('equipmentLabel')}
        columns={1}
        value={draft.equipmentProfileId !== null && content.profiles.some((p) => p.id === draft.equipmentProfileId) ? draft.equipmentProfileId : ''}
        options={[{ value: '', label: tOnboarding('keepEquipment') }, ...content.profiles.map((p) => ({ value: p.id, label: p.name, hint: tOnboarding(EQUIPMENT_HINT[p.kind]) }))]}
        onChange={(value) => patch({ equipmentProfileId: value === '' ? null : value })}
      />
    </div>
  );
}

const STATE_KEY = { normal: 'stateNormal', priority: 'statePriority', avoided: 'stateAvoided' } as const;

export function StepPriorities({ draft, patch, issues }: StepProps) {
  const [limit, setLimit] = useState(false);
  const stateOf = (group: string): keyof typeof STATE_KEY => (draft.priorities.includes(group) ? 'priority' : draft.avoided.includes(group) ? 'avoided' : 'normal');
  const touch = (group: string): void => {
    const current = { priorities: draft.priorities, avoided: draft.avoided };
    const next = cycleMuscle(current, group);
    setLimit(next === current);
    if (next !== current) patch({ priorities: [...next.priorities], avoided: [...next.avoided] });
  };
  const togglePain = (pattern: ExercisePattern): void => patch({ painfulPatterns: draft.painfulPatterns.includes(pattern) ? draft.painfulPatterns.filter((p) => p !== pattern) : [...draft.painfulPatterns, pattern] });
  const names = (list: readonly string[]): string => (list.length === 0 ? tOnboarding('noneChosen') : list.map(groupLabel).join(', '));
  return (
    <div className="ct-onb__duo">
      <div className="ct-onb__duoMap">
      <BodyMap states={Object.fromEntries(MUSCLES.map((g) => [g, stateOf(g)]))} onTouch={touch} />
      <div className="ct-onb__legend" aria-hidden="true">
        <span data-kind="priority">{tOnboarding('legendPriority')}</span>
        <span data-kind="avoided">{tOnboarding('legendAvoided')}</span>
        <span data-kind="normal">{tOnboarding('legendNormal')}</span>
      </div>
      </div>
      <div className="ct-onb__duoList">
      <div className="ct-onb__group">
        <span className="ct-onb__label">{tOnboarding('musclesLabel')}</span>
        <div className="ct-onb__muscles">
          {MUSCLES.map((group) => {
            const state = stateOf(group);
            return (
              <button key={group} type="button" className="ct-onb__muscle" data-state={state} aria-label={tOnboarding('muscleState', { muscle: groupLabel(group), state: tOnboarding(STATE_KEY[state]) })} onClick={() => touch(group)}>
                <span>{groupLabel(group)}</span>
                {state !== 'normal' && <span className="ct-onb__muscleState">{tOnboarding(STATE_KEY[state])}</span>}
              </button>
            );
          })}
        </div>
        {limit && (
          <p className="ct-onb__muted" role="status">
            {tOnboarding('limitReached')}
          </p>
        )}
      </div>
      <div className="ct-onb__card">
        <div className="ct-onb__row">
          <span className="ct-onb__eyebrow">{tOnboarding('priorityCount', { n: draft.priorities.length })}</span>
          <span className="ct-onb__muted">{tOnboarding('priorityHint')}</span>
        </div>
        <p className="ct-onb__chosen">{names(draft.priorities)}</p>
        <div className="ct-onb__row">
          <span className="ct-onb__eyebrow">{tOnboarding('avoidedCount', { n: draft.avoided.length })}</span>
          <span className="ct-onb__muted">{tOnboarding('avoidedHint')}</span>
        </div>
        <p className="ct-onb__chosen">{names(draft.avoided)}</p>
      </div>
      <FieldError show={issues.some((i) => i === 'priorities-max' || i === 'avoided-max' || i === 'priority-avoided-overlap')}>{tOnboarding('errorPriorities')}</FieldError>
      <fieldset className="ct-onb__group ct-onb__pain">
        <legend className="ct-onb__label">{tOnboarding('painfulLabel')}</legend>
        {EXERCISE_PATTERNS.map((pattern) => (
          <label key={pattern} className="ct-onb__check">
            <input type="checkbox" checked={draft.painfulPatterns.includes(pattern)} onChange={() => togglePain(pattern)} />
            <span>{tTraining(PATTERN_KEY[pattern])}</span>
          </label>
        ))}
        <span className="ct-onb__hint">{tOnboarding('painfulHint')}</span>
      </fieldset>
      </div>
    </div>
  );
}

const SPLIT_KEY = { 'full-body': 'splitFullBody', 'upper-lower': 'splitUpperLower', ppl: 'splitPpl', custom: 'splitCustom' } as const satisfies Record<SplitKind, TrainingGenerationTextKey>;
const VARIETY_KEY = { consistent: 'varietyConsistent', balanced: 'varietyBalanced', varied: 'varietyVaried' } as const satisfies Record<VarietyLevel, TrainingGenerationTextKey>;

export function StepSplit({ draft, patch, content }: StepProps) {
  if (content === null) return <p className="ct-onb__muted" role="status">{tOnboarding('equipmentLoading')}</p>;
  if (content === 'error') return <p className="ct-onb__error" role="alert">{tOnboarding('contentError')}</p>;
  const { proposal, program } = proposalFor(draft, content);
  return (
    <>
      <div className="ct-onb__card">
        <p className="ct-onb__big">{tOnboarding('splitProposal', { split: tGeneration(SPLIT_KEY[proposal.split]) })}</p>
        {program ? <p>{tOnboarding('splitProgram', { name: program.name, days: proposal.programDays })}</p> : <p className="ct-onb__muted">{tOnboarding('splitNoContent')}</p>}
        {program && (
          <ul className="ct-onb__days">
            {program.days.map((day) => (
              <li key={day.dayOrder}>{tOnboarding('splitDayLine', { name: day.name, n: day.exercises.length, sets: day.exercises.reduce((sum, line) => sum + line.sets, 0) })}</li>
            ))}
          </ul>
        )}
        {draft.sessionsPerWeek === null && draft.equipmentProfileId === null && <p className="ct-onb__muted">{tOnboarding('splitDefaults')}</p>}
        {draft.sessionsPerWeek !== null && !proposal.matchesFrequency && <p className="ct-onb__muted">{tOnboarding('splitMismatch', { days: proposal.programDays, sessions: draft.sessionsPerWeek })}</p>}
      </div>
      <div className="ct-onb__group">
        <span className="ct-onb__label">{tOnboarding('varietyLabel')}</span>
        <SegmentedControl<VarietyLevel>
          label={tOnboarding('varietyLabel')}
          value={draft.variety}
          options={(['consistent', 'balanced', 'varied'] as const).map((v) => ({ value: v, label: tGeneration(VARIETY_KEY[v]) }))}
          onChange={(variety) => patch({ variety })}
        />
        <span className="ct-onb__hint">{tOnboarding('varietyHint')}</span>
      </div>
      <div className="ct-onb__switchRow">
        <div>
          <span className="ct-onb__label">{tOnboarding('acceptLabel')}</span>
          <span className="ct-onb__hint">{tOnboarding('acceptHint')}</span>
        </div>
        <Switch checked={draft.acceptProposal} label={tOnboarding('acceptLabel')} onChange={(acceptProposal) => patch({ acceptProposal })} />
      </div>
    </>
  );
}

export function StepResult({ draft, issues, today, texts, setText, content, layout }: StepProps) {
  const estimate = startingExpenditure({ sex: draft.sex, birthYear: draft.birthYear, heightCm: draft.heightCm, weightKg: draft.weightKg, activity: draft.activity, onDate: today });
  const edited = draft.expenditureKcal !== null || texts.expenditureKcal !== '';
  const shown = edited ? texts.expenditureKcal : estimate.kcal === null ? '' : String(estimate.kcal);
  const first = content !== null && content !== 'error' ? buildFirstSession(draft, content) : null;
  const protein = draft.weightKg === null ? null : { min: Math.round(draft.weightKg * NUTRITION_CONFIG.proteinMinPerKg), max: Math.round(draft.weightKg * NUTRITION_CONFIG.proteinMaxPerKg) };
  return (
    <>
      <section className="ct-onb__card" aria-label={tOnboarding('firstSession')}>
        <h2 className="ct-onb__h2">{tOnboarding('firstSession')}</h2>
        {content === null && <p className="ct-onb__muted" role="status">{tOnboarding('equipmentLoading')}</p>}
        {content === 'error' && <p className="ct-onb__error" role="alert">{tOnboarding('contentError')}</p>}
        {content !== null && content !== 'error' && first === null && <p className="ct-onb__muted">{tOnboarding('firstSessionNone')}</p>}
        {first !== null && (
          <>
            <p className="ct-onb__big">{tOnboarding('splitFirstDay', { name: first.dayName })}</p>
            <table className="ct-onb__table" aria-label={tOnboarding('firstSession')}>
              <thead>
                <tr>
                  <th scope="col">{tOnboarding('colExercise')}</th>
                  <th scope="col">{tOnboarding('colTarget')}</th>
                </tr>
              </thead>
              <tbody>
                {first.items.map((item) => (
                  <tr key={item.name}>
                    <td>{item.name}</td>
                    <td>{tOnboarding('firstSessionTarget', { sets: item.sets, reps: item.reps })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="ct-onb__muted">{tOnboarding('firstSessionDuration', { min: first.estimatedMin })}</p>
            {first.droppedCount > 0 && draft.durationMin !== null && <p className="ct-onb__muted">{tOnboarding('firstSessionCapped', { n: first.droppedCount, min: draft.durationMin })}</p>}
          </>
        )}
      </section>
      <section className="ct-onb__card" aria-label={tOnboarding('targetsTitle')}>
        <h2 className="ct-onb__h2">{tOnboarding('targetsTitle')}</h2>
        {estimate.kcal === null && !edited && <ExpenditureEstimate draft={draft} today={today} />}
        <TextInput label={tOnboarding('expenditureField')} value={shown} inputMode="numeric" errorId="ct-onb-err-kcal" error={issues.includes('expenditure-range')} onChange={(value) => setText('expenditureKcal', value)} />
        <FieldError id="ct-onb-err-kcal" show={issues.includes('expenditure-range')}>{tOnboarding('errorExpenditure')}</FieldError>
        {estimate.kcal !== null && !edited && <p className="ct-onb__big">{tOnboarding('expenditureValue', { kcal: formatInt(estimate.kcal) })}</p>}
        {estimate.kcal !== null && <p className="ct-onb__note">{tOnboarding('resultExpenditureNote', { kcal: formatInt(estimate.kcal) })}</p>}
        {edited && estimate.kcal !== null && <p className="ct-onb__muted">{tOnboarding('expenditureEdited', { kcal: formatInt(estimate.kcal) })}</p>}
        {edited && (
          <Button variant="secondary" onClick={() => setText('expenditureKcal', '')}>
            {tOnboarding('expenditureReset')}
          </Button>
        )}
        {protein !== null ? (
          <>
            <p>{tOnboarding('proteinRange', protein)}</p>
            <p className="ct-onb__muted">{tOnboarding('proteinNote')}</p>
          </>
        ) : (
          <p className="ct-onb__muted">{tOnboarding('targetsMissing')}</p>
        )}
        <p className="ct-onb__muted">{tOnboarding('targetsNote')}</p>
        {layout === 'pc' && <p className="ct-onb__muted">{tOnboarding('resultNextStep')}</p>}
      </section>
    </>
  );
}
