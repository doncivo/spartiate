import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  EXPERIENCES,
  GOALS,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  BIRTH_YEAR_MIN,
  MIN_AGE_YEARS,
  SEXES,
  parseDecimal,
  validateManualWeight,
  validateProfile,
  type BodyGoal,
  type BodyWeight,
  type Experience,
  type Sex,
} from '../../domain/bodyProfile';
import type { LocalDate } from '../../domain/types';
import { formatKg, tBody, type BodyTextKey } from '../../i18n/bodyText';
import { Button, Icon, SegmentedControl, useLayout } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useAppStore } from '../app/appStore';
import { useNavigationStore } from '../app/navigation';
import './BodyScreen.css';

const SEX_KEY = { male: 'sexMale', female: 'sexFemale' } as const satisfies Record<Sex, BodyTextKey>;
const GOAL_KEY = { gain: 'goalGain', loss: 'goalLoss', maintain: 'goalMaintain' } as const satisfies Record<BodyGoal, BodyTextKey>;
const EXPERIENCE_KEY = { beginner: 'experienceBeginner', intermediate: 'experienceIntermediate', advanced: 'experienceAdvanced' } as const satisfies Record<Experience, BodyTextKey>;

const todayOf = (nowMs: number): LocalDate => new Date(nowMs).toISOString().slice(0, 10) as LocalDate;

/** Lecture seule du texte d'un champ entier : vide ou illisible → null, jamais zéro. */
const parseInteger = (text: string): number | null => {
  const value = parseDecimal(text);
  return value !== null && Number.isInteger(value) ? value : null;
};

/**
 * Écran « Profil et poids » (Plus). La ligne `profile` n'est créée qu'à l'enregistrement du formulaire, jamais vide au démarrage ; sur un
 * appareil appairé qui n'a pas encore fait sa première synchro, le formulaire attend (le profil existe peut-être déjà ailleurs). Tout est
 * facultatif : champ vide = NULL, jamais zéro.
 */
export function BodyScreen() {
  const container = useAppContainer();
  const layout = useLayout();
  const navigate = useNavigationStore((s) => s.navigate);
  const { profile: profiles, bodyWeights } = container.data.repos;
  const timeZone = useAppStore((s) => s.timeZone) ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const year = new Date(container.clock.nowMs()).getUTCFullYear();

  const [sex, setSex] = useState<Sex | ''>('');
  const [goal, setGoal] = useState<BodyGoal | ''>('');
  const [experience, setExperience] = useState<Experience | ''>('');
  const [birthYear, setBirthYear] = useState('');
  const [height, setHeight] = useState('');
  const [hasProfile, setHasProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [weightText, setWeightText] = useState('');
  const [weightDate, setWeightDate] = useState<LocalDate>(todayOf(container.clock.nowMs()));
  const [weightMessage, setWeightMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [weights, setWeights] = useState<BodyWeight[]>([]);
  const [firstSyncDone, setFirstSyncDone] = useState(() => {
    const status = container.sync?.status();
    return !status || status.phase === 'not-configured' || status.lastSyncAt !== null;
  });

  useEffect(() => {
    let live = true;
    void (async () => {
      const [profile, recent] = await Promise.all([profiles.get(), bodyWeights.listRecent(30)]);
      if (!live) return;
      setWeights(recent);
      if (profile) {
        setHasProfile(true);
        setSex(profile.sex ?? '');
        setGoal(profile.goal ?? '');
        setExperience(profile.experience ?? '');
        setBirthYear(profile.birthYear === null ? '' : String(profile.birthYear));
        setHeight(profile.heightCm === null ? '' : formatKg(profile.heightCm));
      }
    })();
    return () => {
      live = false;
    };
  }, [profiles, bodyWeights]);

  useEffect(() => {
    const sync = container.sync;
    if (!sync) return undefined;
    const update = (): void => {
      const status = sync.status();
      setFirstSyncDone(status.phase === 'not-configured' || status.lastSyncAt !== null);
    };
    update();
    return sync.subscribe(update);
  }, [container.sync]);

  const waiting = !firstSyncDone && !hasProfile;

  async function saveProfile(): Promise<void> {
    const birth = birthYear.trim() === '' ? null : parseInteger(birthYear);
    const cm = height.trim() === '' ? null : parseDecimal(height);
    const input = { sex: sex === '' ? null : sex, goal: goal === '' ? null : goal, experience: experience === '' ? null : experience, birthYear: birth, heightCm: cm };
    const issues = validateProfile(input, year);
    if (birthYear.trim() !== '' && birth === null) issues.push({ field: 'birthYear', code: 'range' });
    if (height.trim() !== '' && cm === null) issues.push({ field: 'heightCm', code: 'range' });
    const first = issues[0];
    if (first) {
      setProfileMessage({ kind: 'error', text: first.field === 'birthYear' ? tBody('errorBirthYear', { min: BIRTH_YEAR_MIN, max: year - MIN_AGE_YEARS }) : first.field === 'heightCm' ? tBody('errorHeight') : tBody('errorSave') });
      return;
    }
    try {
      await profiles.save(input, year);
      setHasProfile(true);
      setProfileMessage({ kind: 'ok', text: tBody('profileSaved') });
    } catch {
      setProfileMessage({ kind: 'error', text: tBody('errorSave') });
    }
  }

  async function saveWeight(): Promise<void> {
    const kg = parseDecimal(weightText);
    if (kg === null) {
      setWeightMessage({ kind: 'error', text: weightText.trim() === '' ? tBody('errorKgRange') : tBody('errorKgFormat') });
      return;
    }
    const today = todayOf(container.clock.nowMs());
    const issue = validateManualWeight({ date: weightDate, kg }, today)[0];
    if (issue) {
      setWeightMessage({ kind: 'error', text: issue.field === 'kg' ? tBody('errorKgRange') : issue.code === 'future' ? tBody('errorDateFuture') : tBody('errorDateFormat') });
      return;
    }
    try {
      await bodyWeights.saveManual({ date: weightDate, kg, timezone: timeZone }, today);
      setWeights(await bodyWeights.listRecent(30));
      setWeightText('');
      setWeightMessage({ kind: 'ok', text: tBody('weightSaved') });
    } catch {
      setWeightMessage({ kind: 'error', text: tBody('errorSave') });
    }
  }

  async function removeWeight(weight: BodyWeight): Promise<void> {
    try {
      await bodyWeights.softDelete(weight.date, weight.source);
      setWeights(await bodyWeights.listRecent(30));
    } catch {
      setWeightMessage({ kind: 'error', text: tBody('errorSave') });
    }
  }

  return (
    <div className="ct-body-shell" data-layout={layout}>
      <div className="ct-body">
        <div className="ct-body__topRow">
          <button type="button" className="ct-body__back" aria-label={tBody('back')} onClick={() => navigate({ tab: 'more', screen: 'home' })}>
            <Icon icon={ArrowLeft} size={26} />
          </button>
        </div>
        <h1 className="ct-body__title">{tBody('title')}</h1>

        <h2 className="ct-body__section">{tBody('sectionProfile')}</h2>
        {waiting && (
          <p className="ct-body__hint" role="note">
            <strong>{tBody('waitingFirstSync')}</strong> {tBody('waitingHint')}
          </p>
        )}
        <div className="ct-body__field">
          <span className="ct-body__label">{tBody('sex')}</span>
          <SegmentedControl label={tBody('sex')} value={sex as Sex} disabled={waiting} onChange={setSex} options={SEXES.map((value) => ({ value, label: tBody(SEX_KEY[value]) }))} />
        </div>
        <label className="ct-body__field">
          <span className="ct-body__label">{tBody('birthYear')}</span>
          <input className="ct-body__input" inputMode="numeric" value={birthYear} disabled={waiting} onChange={(e) => setBirthYear(e.target.value)} />
        </label>
        <label className="ct-body__field">
          <span className="ct-body__label">{tBody('heightCm')}</span>
          <input className="ct-body__input" inputMode="decimal" placeholder={`${HEIGHT_MIN_CM} – ${HEIGHT_MAX_CM}`} value={height} disabled={waiting} onChange={(e) => setHeight(e.target.value)} />
        </label>
        <div className="ct-body__field">
          <span className="ct-body__label">{tBody('goal')}</span>
          <SegmentedControl label={tBody('goal')} value={goal as BodyGoal} disabled={waiting} onChange={setGoal} options={GOALS.map((value) => ({ value, label: tBody(GOAL_KEY[value]) }))} />
        </div>
        <div className="ct-body__field">
          <span className="ct-body__label">{tBody('experience')}</span>
          <SegmentedControl label={tBody('experience')} value={experience as Experience} disabled={waiting} onChange={setExperience} options={EXPERIENCES.map((value) => ({ value, label: tBody(EXPERIENCE_KEY[value]) }))} />
        </div>
        <p className="ct-body__hint">{tBody('profileHint')}</p>
        {profileMessage && (
          <p className="ct-body__message" role={profileMessage.kind === 'error' ? 'alert' : 'status'}>
            {profileMessage.text}
          </p>
        )}
        <Button disabled={waiting} onClick={() => void saveProfile()}>
          {tBody('saveProfile')}
        </Button>

        <h2 className="ct-body__section">{tBody('sectionWeight')}</h2>
        <label className="ct-body__field">
          <span className="ct-body__label">{tBody('weightKg')}</span>
          <input className="ct-body__input" inputMode="decimal" value={weightText} onChange={(e) => setWeightText(e.target.value)} />
        </label>
        <label className="ct-body__field">
          <span className="ct-body__label">{tBody('weightDate')}</span>
          <input className="ct-body__input" type="date" value={weightDate} onChange={(e) => setWeightDate(e.target.value as LocalDate)} />
        </label>
        {weightMessage && (
          <p className="ct-body__message" role={weightMessage.kind === 'error' ? 'alert' : 'status'}>
            {weightMessage.text}
          </p>
        )}
        <Button onClick={() => void saveWeight()}>{tBody('saveWeight')}</Button>
        {weights.length === 0 ? (
          <p className="ct-body__hint">{tBody('weightEmpty')}</p>
        ) : (
          <ul className="ct-body__list">
            {weights.map((weight) => (
              <li key={weight.id} className="ct-body__item">
                <span>{weight.date}</span>
                <span>{tBody('weightLine', { kg: formatKg(weight.kg) })}</span>
                <button type="button" className="ct-body__delete" aria-label={tBody('weightDelete', { date: weight.date })} onClick={() => void removeWeight(weight)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
