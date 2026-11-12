import type { ReactNode } from 'react';
import { BIRTH_YEAR_MIN, HEIGHT_MAX_CM, HEIGHT_MIN_CM, MIN_AGE_YEARS, WEIGHT_MAX_KG, type Experience, type Sex } from '../../domain/bodyProfile';
import { ACTIVITY_LEVELS, type ActivityLevel } from '../../domain/nutrition/config';
import {
  GOAL_RATE_MAX_PCT,
  GOAL_RATE_MIN_PCT,
  ONBOARDING_GOALS,
  RATE_GOALS,
  startingExpenditure,
  weeklyRateKg,
  type OnboardingDraft,
  type OnboardingGoal,
  type StepIssueCode,
} from '../../domain/onboarding';
import type { LocalDate, Weekday } from '../../domain/types';
import { formatDecimal, formatInt, tOnboarding, type OnboardingTextKey } from '../../i18n/onboardingText';
import { SegmentedControl, WeekdayToggles } from '../../ui';
import type { TrainingContent } from '../training/content';

export interface FieldTexts {
  birthYear: string;
  heightCm: string;
  weightKg: string;
  expenditureKcal: string;
}

export interface StepProps {
  readonly draft: OnboardingDraft;
  readonly patch: (partial: Partial<OnboardingDraft>) => void;
  /** Règles refusées à la dernière tentative de « Continuer » (messages sous les champs concernés). */
  readonly issues: readonly StepIssueCode[];
  readonly year: number;
  readonly today: LocalDate;
  readonly texts: FieldTexts;
  readonly setText: (key: keyof FieldTexts, value: string) => void;
  readonly content: TrainingContent | 'error' | null;
  /** Dernière pesée déjà enregistrée (préremplie), ou `null`. */
  readonly prefillWeightKg: number | null;
}

const UNSET = { value: '' as const, label: tOnboarding('unset') };

export function FieldError({ show, children, id }: { readonly show: boolean; readonly children: ReactNode; readonly id?: string }) {
  return show ? (
    <p className="ct-onb__error" role="alert" id={id}>
      {children}
    </p>
  ) : null;
}

function Group({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="ct-onb__group">
      <span className="ct-onb__label">{label}</span>
      {children}
    </div>
  );
}

export function TextInput({ label, value, onChange, inputMode, error, hint }: { readonly label: string; readonly value: string; readonly onChange: (value: string) => void; readonly inputMode: 'numeric' | 'decimal'; readonly error?: boolean; readonly hint?: string }) {
  return (
    <label className="ct-onb__field">
      <span className="ct-onb__label">{label}</span>
      <input className="ct-onb__input" type="text" inputMode={inputMode} autoComplete="off" value={value} aria-invalid={error === true ? true : undefined} onChange={(event) => onChange(event.target.value)} />
      {hint !== undefined && <span className="ct-onb__hint">{hint}</span>}
    </label>
  );
}

/** Dépense de départ estimée (Mifflin-St Jeor × activité déclarée) : texte ou raison de l'absence, jamais un zéro. */
export function ExpenditureEstimate({ draft, today }: Pick<StepProps, 'draft' | 'today'>) {
  const estimate = startingExpenditure({ sex: draft.sex, birthYear: draft.birthYear, heightCm: draft.heightCm, weightKg: draft.weightKg, activity: draft.activity, onDate: today });
  return (
    <div className="ct-onb__card" role="status">
      {estimate.kcal === null ? (
        <p className="ct-onb__muted">{tOnboarding('expenditureMissing')}</p>
      ) : (
        <>
          <p className="ct-onb__big">{tOnboarding('expenditureValue', { kcal: formatInt(estimate.kcal) })}</p>
          <p className="ct-onb__muted">{tOnboarding('expenditureNote')}</p>
        </>
      )}
    </div>
  );
}

export function StepYou(props: StepProps) {
  const { draft, patch, issues, year, texts, setText, prefillWeightKg } = props;
  return (
    <>
      <Group label={tOnboarding('sex')}>
        <SegmentedControl<Sex | ''>
          label={tOnboarding('sex')}
          value={draft.sex ?? ''}
          options={[UNSET, { value: 'male', label: tOnboarding('sexMale') }, { value: 'female', label: tOnboarding('sexFemale') }]}
          onChange={(value) => patch({ sex: value === '' ? null : value })}
        />
      </Group>
      <TextInput label={tOnboarding('birthYear')} value={texts.birthYear} inputMode="numeric" error={issues.includes('birth-year-range')} onChange={(value) => setText('birthYear', value)} />
      <FieldError show={issues.includes('birth-year-range')}>{tOnboarding('errorBirthYear', { min: BIRTH_YEAR_MIN, max: year - MIN_AGE_YEARS })}</FieldError>
      <TextInput label={tOnboarding('heightCm')} value={texts.heightCm} inputMode="numeric" error={issues.includes('height-range')} onChange={(value) => setText('heightCm', value)} />
      <FieldError show={issues.includes('height-range')}>{tOnboarding('errorHeight', { min: HEIGHT_MIN_CM, max: HEIGHT_MAX_CM })}</FieldError>
      <TextInput
        label={tOnboarding('weightKg')}
        value={texts.weightKg}
        inputMode="decimal"
        error={issues.includes('weight-range')}
        onChange={(value) => setText('weightKg', value)}
        {...(prefillWeightKg !== null ? { hint: tOnboarding('weightPrefill', { kg: formatDecimal(prefillWeightKg) }) } : {})}
      />
      <FieldError show={issues.includes('weight-range')}>{tOnboarding('errorWeight', { max: WEIGHT_MAX_KG })}</FieldError>
      <Group label={tOnboarding('activity')}>
        <SegmentedControl<ActivityLevel | ''>
          label={tOnboarding('activity')}
          columns={2}
          value={draft.activity ?? ''}
          options={[UNSET, ...ACTIVITY_LEVELS.map((level) => ({ value: level, label: tOnboarding(ACTIVITY_KEY[level]) }))]}
          onChange={(value) => patch({ activity: value === '' ? null : value })}
        />
        <span className="ct-onb__hint">{tOnboarding('activityHint')}</span>
      </Group>
      <ExpenditureEstimate draft={draft} today={props.today} />
    </>
  );
}

const ACTIVITY_KEY = { sedentary: 'activitySedentary', light: 'activityLight', moderate: 'activityModerate', active: 'activityActive' } as const satisfies Record<ActivityLevel, OnboardingTextKey>;
const GOAL_KEY = { muscle: 'goalMuscle', strength: 'goalStrength', recomposition: 'goalRecomposition', 'fat-loss': 'goalFatLoss', maintenance: 'goalMaintenance' } as const satisfies Record<OnboardingGoal, OnboardingTextKey>;

/** Rythmes proposés (% du poids par semaine), tous dans les bornes de −1 % à +0,5 %. */
const RATES: Readonly<Partial<Record<OnboardingGoal, readonly number[]>>> = { muscle: [0.25, 0.5], 'fat-loss': [-0.25, -0.5, -0.75, -1] };
const rateText = (pct: number): string => `${pct > 0 ? '+' : '−'}${formatDecimal(Math.abs(pct))}`;

export function StepGoal({ draft, patch, issues }: StepProps) {
  const rates = draft.goal !== null && RATE_GOALS.includes(draft.goal) ? (RATES[draft.goal] ?? []) : [];
  const kg = draft.weeklyRatePct === null ? null : weeklyRateKg(draft.weightKg, draft.weeklyRatePct);
  return (
    <>
      <Group label={tOnboarding('goalLabel')}>
        <SegmentedControl<OnboardingGoal | ''>
          label={tOnboarding('goalLabel')}
          columns={2}
          value={draft.goal ?? ''}
          options={[UNSET, ...ONBOARDING_GOALS.map((goal) => ({ value: goal, label: tOnboarding(GOAL_KEY[goal]) }))]}
          onChange={(value) => patch({ goal: value === '' ? null : value, weeklyRatePct: null })}
        />
      </Group>
      {rates.length > 0 && (
        <Group label={tOnboarding('rateLabel')}>
          <SegmentedControl<string>
            label={tOnboarding('rateLabel')}
            columns={2}
            value={draft.weeklyRatePct === null ? '' : String(draft.weeklyRatePct)}
            options={[UNSET, ...rates.filter((r) => r >= GOAL_RATE_MIN_PCT && r <= GOAL_RATE_MAX_PCT).map((r) => ({ value: String(r), label: tOnboarding('rateOption', { rate: rateText(r) }) }))]}
            onChange={(value) => patch({ weeklyRatePct: value === '' ? null : Number(value) })}
          />
          <span className="ct-onb__hint">{tOnboarding('rateHint')}</span>
          {draft.weeklyRatePct !== null && <span className="ct-onb__hint">{kg === null ? tOnboarding('rateNeedsWeight') : tOnboarding('rateKg', { kg: formatDecimal(Math.abs(kg)) })}</span>}
          <FieldError show={issues.includes('rate-range')}>{tOnboarding('errorRate')}</FieldError>
        </Group>
      )}
    </>
  );
}

const EXPERIENCE_KEY = { beginner: 'experienceBeginner', intermediate: 'experienceIntermediate', advanced: 'experienceAdvanced' } as const satisfies Record<Experience, OnboardingTextKey>;
const EXPERIENCE_HINT = { beginner: 'experienceBeginnerHint', intermediate: 'experienceIntermediateHint', advanced: 'experienceAdvancedHint' } as const satisfies Record<Experience, OnboardingTextKey>;

export function StepExperience({ draft, patch }: StepProps) {
  return (
    <Group label={tOnboarding('experienceLabel')}>
      <SegmentedControl<Experience | ''>
        label={tOnboarding('experienceLabel')}
        columns={2}
        value={draft.experience ?? ''}
        options={[UNSET, ...(['beginner', 'intermediate', 'advanced'] as const).map((level) => ({ value: level, label: tOnboarding(EXPERIENCE_KEY[level]) }))]}
        onChange={(value) => patch({ experience: value === '' ? null : value })}
      />
      {draft.experience !== null && <span className="ct-onb__hint">{tOnboarding(EXPERIENCE_HINT[draft.experience])}</span>}
    </Group>
  );
}

const SESSION_CHOICES = [1, 2, 3, 4, 5, 6, 7] as const;
const DURATION_CHOICES = [30, 45, 60, 75, 90] as const;

export function StepAvailability({ draft, patch, issues }: StepProps) {
  const toggleDay = (day: Weekday): void => patch({ days: (draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day]).sort((a, b) => a - b) });
  const sessionValue = draft.sessionsPerWeek !== null && (SESSION_CHOICES as readonly number[]).includes(draft.sessionsPerWeek) ? String(draft.sessionsPerWeek) : '';
  const durationValue = draft.durationMin !== null && (DURATION_CHOICES as readonly number[]).includes(draft.durationMin) ? String(draft.durationMin) : '';
  return (
    <>
      <Group label={tOnboarding('sessionsLabel')}>
        <SegmentedControl<string>
          label={tOnboarding('sessionsLabel')}
          scrollable
          value={sessionValue}
          options={[UNSET, ...SESSION_CHOICES.map((n) => ({ value: String(n), label: String(n) }))]}
          onChange={(value) => patch({ sessionsPerWeek: value === '' ? null : Number(value) })}
        />
        <FieldError show={issues.includes('sessions-range')}>{tOnboarding('errorSessions')}</FieldError>
      </Group>
      <Group label={tOnboarding('durationLabel')}>
        <SegmentedControl<string>
          label={tOnboarding('durationLabel')}
          scrollable
          value={durationValue}
          options={[UNSET, ...DURATION_CHOICES.map((n) => ({ value: String(n), label: tOnboarding('durationOption', { min: n }) }))]}
          onChange={(value) => patch({ durationMin: value === '' ? null : Number(value) })}
        />
        <FieldError show={issues.includes('duration-range')}>{tOnboarding('errorDuration')}</FieldError>
      </Group>
      <Group label={tOnboarding('daysLabel')}>
        <WeekdayToggles label={tOnboarding('daysLabel')} value={draft.days} onToggle={toggleDay} />
        <span className="ct-onb__hint">{tOnboarding('daysHint')}</span>
        <FieldError show={issues.includes('days-fewer-than-sessions')}>{tOnboarding('errorDays')}</FieldError>
      </Group>
    </>
  );
}
