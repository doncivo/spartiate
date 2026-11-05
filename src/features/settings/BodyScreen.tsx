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
import { formatDayLabel } from '../../i18n/format';
import { formatKg, tBody, type BodyTextKey } from '../../i18n/bodyText';
import { Button, Icon, SegmentedControl, useLayout } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useAppStore } from '../app/appStore';
import { useNavigationStore } from '../app/navigation';
import './BodyScreen.css';

const SEX_KEY = { male: 'sexMale', female: 'sexFemale' } as const satisfies Record<Sex, BodyTextKey>;
const GOAL_KEY = { gain: 'goalGain', loss: 'goalLoss', maintain: 'goalMaintain' } as const satisfies Record<BodyGoal, BodyTextKey>;
const EXPERIENCE_KEY = { beginner: 'experienceBeginner', intermediate: 'experienceIntermediate', advanced: 'experienceAdvanced' } as const satisfies Record<Experience, BodyTextKey>;

/** Jour local de l'appareil (pas le jour UTC) : une pesée du soir reste à la date du jour de l'utilisateur. */
/** Option vide des groupes facultatifs : enregistrée en NULL (jamais un faux zéro). */
const UNSET = { value: '' as const, label: tBody('unset') };

const todayOf = (nowMs: number): LocalDate => {
  const d = new Date(nowMs);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` as LocalDate;
};

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
  const { repos } = container.data;
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
      try {
        const [profiles, bodyWeights] = await Promise.all([repos.profile(), repos.bodyWeights()]);
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
      } catch {
        // Base fermée avant la fin de la lecture (écran quitté) : rien à afficher ; sinon le message d'échec reste visible.
        if (live) setProfileMessage({ kind: 'error', text: tBody('errorSave') });
      }
    })();
    return () => {
      live = false;
    };
  }, [repos]);

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
      await (await repos.profile()).save(input, year);
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
      const bodyWeights = await repos.bodyWeights();
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
      const bodyWeights = await repos.bodyWeights();
      await bodyWeights.softDelete(weight.date, weight.source);
      setWeights(await bodyWeights.listRecent(30));
    } catch {
      setWeightMessage({ kind: 'error', text: tBody('errorSave') });
    }
  }

  const latest = weights[0];
  const WEIGHTS_FOR_TREND = 14;
  const trendText = weights.length < WEIGHTS_FOR_TREND ? tBody('weightTrendLearning', { n: weights.length, need: WEIGHTS_FOR_TREND }) : tBody('weightTrendCount', { n: weights.length });

  return (
    <div className="ct-body-shell" data-layout={layout}>
      <div className="ct-body">
        <div className="ct-body__topRow">
          <button type="button" className="ct-body__back" aria-label={tBody('back')} onClick={() => navigate({ tab: 'more', screen: 'home' })}>
            <Icon icon={ArrowLeft} size={26} />
          </button>
        </div>
        <h1 className="ct-body__title">{tBody('title')}</h1>

        <div className="ct-body__grid">
          <section className="ct-body__card ct-body__card--weight" aria-label={tBody('sectionWeight')}>
            <h2 className="ct-body__section">{tBody('sectionWeight')}</h2>
            <div className="ct-body__latest">
              <div className="ct-body__latestValue">
                {latest ? (
                  <>
                    <span className="ct-body__big">{formatKg(latest.kg)}</span>
                    <span className="ct-body__unit">{tBody('weightUnit')}</span>
                  </>
                ) : (
                  <span className="ct-body__hint">{tBody('weightLatestNone')}</span>
                )}
              </div>
              <div className="ct-body__trend">
                <span className="ct-body__hint">{trendText}</span>
                <WeightSparkline weights={weights} label={tBody('weightChart')} />
              </div>
            </div>
            <div className="ct-body__entry">
              <label className="ct-body__field">
                <span className="ct-body__label">{tBody('weightKg')}</span>
                <input className="ct-body__input" inputMode="decimal" value={weightText} onChange={(e) => setWeightText(e.target.value)} />
              </label>
              <label className="ct-body__field">
                <span className="ct-body__label">{tBody('weightDate')}</span>
                <input className="ct-body__input" type="date" value={weightDate} onChange={(e) => setWeightDate(e.target.value as LocalDate)} />
              </label>
              <Button className="ct-body__save" onClick={() => void saveWeight()}>
                {tBody('saveWeight')}
              </Button>
            </div>
            {weightMessage && (
              <p className="ct-body__message" role={weightMessage.kind === 'error' ? 'alert' : 'status'}>
                {weightMessage.text}
              </p>
            )}
            {weights.length === 0 ? (
              <p className="ct-body__hint">{tBody('weightEmpty')}</p>
            ) : (
              <ul className="ct-body__list">
                {weights.map((weight) => (
                  <li key={weight.id} className="ct-body__item">
                    <span className="ct-body__itemDate">{formatDayLabel(weight.date)}</span>
                    <span className="ct-body__itemKg">{tBody('weightLine', { kg: formatKg(weight.kg) })}</span>
                    <span className="ct-body__badge">{tBody(weight.source === 'health' ? 'weightSourceHealth' : 'weightSourceManual')}</span>
                    <button type="button" className="ct-body__delete" aria-label={tBody('weightDelete', { date: weight.date })} onClick={() => void removeWeight(weight)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ct-body__card ct-body__card--profile" aria-label={tBody('sectionProfile')}>
            <h2 className="ct-body__section">{tBody('sectionProfile')}</h2>
            {waiting && (
              <p className="ct-body__hint" role="note">
                <strong>{tBody('waitingFirstSync')}</strong> {tBody('waitingHint')}
              </p>
            )}
            <div className="ct-body__field">
              <span className="ct-body__label">{tBody('sex')}</span>
              <SegmentedControl label={tBody('sex')} value={sex} disabled={waiting} onChange={setSex} options={[...SEXES.map((value) => ({ value, label: tBody(SEX_KEY[value]) })), UNSET]} />
            </div>
            <label className="ct-body__field ct-body__field--row">
              <span className="ct-body__label">{tBody('birthYear')}</span>
              <input className="ct-body__input ct-body__input--short" inputMode="numeric" value={birthYear} disabled={waiting} onChange={(e) => setBirthYear(e.target.value)} />
            </label>
            <div className="ct-body__field">
              <label className="ct-body__field ct-body__field--row">
                <span className="ct-body__label">{tBody('heightCm')}</span>
                <input className="ct-body__input ct-body__input--short" inputMode="numeric" aria-describedby="ct-body-height-help" placeholder={`${HEIGHT_MIN_CM} – ${HEIGHT_MAX_CM}`} value={height} disabled={waiting} onChange={(e) => setHeight(e.target.value)} />
              </label>
              <span id="ct-body-height-help" className="ct-body__hint">
                {tBody('heightHelp')}
              </span>
            </div>
            <div className="ct-body__field">
              <span className="ct-body__label">{tBody('goal')}</span>
              <SegmentedControl label={tBody('goal')} value={goal} disabled={waiting} onChange={setGoal} columns={2} options={[...GOALS.map((value) => ({ value, label: tBody(GOAL_KEY[value]) })), UNSET]} />
            </div>
            <div className="ct-body__field">
              <span className="ct-body__label">{tBody('experience')}</span>
              <SegmentedControl label={tBody('experience')} value={experience} disabled={waiting} onChange={setExperience} columns={2} options={[...EXPERIENCES.map((value) => ({ value, label: tBody(EXPERIENCE_KEY[value]) })), UNSET]} />
            </div>
            <p className="ct-body__hint">{tBody('profileHint')}</p>
            {profileMessage && (
              <p className="ct-body__message" role={profileMessage.kind === 'error' ? 'alert' : 'status'}>
                {profileMessage.text}
              </p>
            )}
            <Button className="ct-body__save" disabled={waiting} onClick={() => void saveProfile()}>
              {tBody('saveProfile')}
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Courbe des pesées les plus récentes (au plus 14), tracée avec les jetons de la charte ; absente sous deux pesées. */
function WeightSparkline({ weights, label }: { readonly weights: readonly BodyWeight[]; readonly label: string }) {
  const points = weights.slice(0, 14).reverse();
  if (points.length < 2) return null;
  const width = 160;
  const height = 40;
  const values = points.map((p) => p.kg);
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const coords = points.map((p, i) => [(i / (points.length - 1)) * (width - 8) + 4, height - 6 - ((p.kg - min) / span) * (height - 12)] as const);
  const last = coords[coords.length - 1];
  return (
    <svg className="ct-body__spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <polyline fill="none" stroke="var(--ct-color-bronze)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} />
      {last ? <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--ct-color-bronze)" /> : null}
    </svg>
  );
}
