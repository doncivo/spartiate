import { Check, ChevronRight } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { todayLocal } from '../../domain/clock';
import type { BodyWeight, Profile } from '../../domain/bodyProfile';
import { formatDetailDate, formatStamp } from '../../i18n/format';
import { formatKg, tBody, type BodyTextKey } from '../../i18n/bodyText';
import { formatTodayEyebrow, tToday, type TodayTextKey } from '../../i18n/todayText';
import { Button, useLayout } from '../../ui';
import { useSyncedData } from '../sync/remoteChanges';
import { statusLine } from '../sync/syncText';
import { useAppContainer } from './AppContainerContext';
import { NutritionRemainingCard, TodaySessionCard } from './lazyScreens';
import { useNavigationStore, type Route } from './navigation';
import './TodayScreen.css';

const GOAL_KEY = { gain: 'goalGain', loss: 'goalLoss', maintain: 'goalMaintain' } as const satisfies Record<string, BodyTextKey>;
const EXPERIENCE_KEY = { beginner: 'experienceBeginner', intermediate: 'experienceIntermediate', advanced: 'experienceAdvanced' } as const satisfies Record<string, BodyTextKey>;

const WEIGHTS_NEEDED = 14;
const CHART_POINTS = 6;
const subscribeNone = (): (() => void) => () => undefined;

interface Loaded {
  readonly profile: Profile | null;
  readonly weights: readonly BodyWeight[];
  /** Instant de la sauvegarde la plus récente ; null : aucune ; undefined : plateforme sans sauvegarde ou lecture impossible. */
  readonly backupMs: number | null | undefined;
}

/** Courbe des pesées récentes (du plus ancien au plus récent), tracée avec les jetons (bronze). */
function WeightChart({ weights }: { readonly weights: readonly BodyWeight[] }) {
  const series = weights
    .slice(0, CHART_POINTS)
    .map((w) => w.kg)
    .reverse();
  const width = 612;
  const height = 120;
  const pad = 20;
  const min = Math.min(...series);
  const span = Math.max(...series) - min;
  const x = (i: number): number => (series.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (series.length - 1));
  const y = (kg: number): number => (span === 0 ? height / 2 : height - pad - ((kg - min) * (height - 2 * pad)) / span);
  const points = series.map((kg, i) => `${String(x(i))},${String(y(kg))}`);
  return (
    <svg className="ct-today__chart" viewBox={`0 0 ${String(width)} ${String(height)}`} role="img" aria-label={tToday('chartLabel')}>
      <line className="ct-today__chart-base" x1={pad} x2={width - pad} y1={height - 4} y2={height - 4} />
      {series.length > 1 ? <polyline className="ct-today__chart-line" points={points.join(' ')} /> : null}
      {series.map((kg, i) => (
        <circle key={i} className="ct-today__chart-dot" cx={x(i)} cy={y(kg)} r={i === series.length - 1 ? 5 : 3} />
      ))}
    </svg>
  );
}

function WeightCard({ weights, nowMs, showActions }: { readonly weights: readonly BodyWeight[]; readonly nowMs: number; readonly showActions: boolean }) {
  const navigate = useNavigationStore((s) => s.navigate);
  const goBody = (): void => navigate({ tab: 'more', screen: 'body' });
  const last = weights[0];
  const count = weights.length;
  return (
    <section className="ct-today__card ct-today__weight" aria-labelledby="ct-today-weight">
      <div className="ct-today__weight-head">
        <div>
          <h2 id="ct-today-weight" className="ct-today__eyebrow">
            {tToday('weightEyebrow')}
          </h2>
          {last ? (
            <>
              <p className="ct-today__weight-value">
                <span className="ct-today__weight-num">{formatKg(last.kg)}</span>
                <span className="ct-today__weight-unit">{tToday('weightUnit')}</span>
              </p>
              <p className="ct-today__muted">
                {`${last.measuredAt ? formatStamp(last.measuredAt, nowMs) : formatDetailDate(last.date)} · ${tToday(last.source === 'health' ? 'weightSourceHealth' : 'weightSourceManual')}`}
              </p>
            </>
          ) : (
            <>
              <p className="ct-today__text">{tToday('weightEmpty')}</p>
              <p className="ct-today__muted">{tToday('weightEmptyHint')}</p>
            </>
          )}
        </div>
        {last ? (
          <div className="ct-today__trend">
            <p className="ct-today__muted">{tToday('trendLabel')}</p>
            <p className="ct-today__text">{tToday(count < WEIGHTS_NEEDED ? 'trendLearning' : 'trendNotComputed')}</p>
            {count < WEIGHTS_NEEDED ? <p className="ct-today__muted">{count === 1 ? tToday('weightsCountOne') : tToday('weightsCount', { n: count })}</p> : null}
          </div>
        ) : null}
      </div>
      {last ? <WeightChart weights={weights} /> : null}
      {showActions ? (
        <div className="ct-today__actions">
          <Button onClick={goBody}>{tToday('newWeight')}</Button>
          <Button variant="secondary" onClick={goBody}>
            {tToday('profileAndWeight')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function NextCard({ pc }: { readonly pc: boolean }) {
  const rows: readonly (readonly [TodayTextKey, TodayTextKey])[] = pc
    ? [
        ['nextSession', 'nextSessionTextPc'],
        ['nextNutrition', 'nextNutritionTextPc'],
        ['nextRecovery', 'nextRecoveryTextPc'],
      ]
    : [
        ['nextSession', 'nextSessionText'],
        ['nextNutrition', 'nextNutritionText'],
        ['nextRecovery', 'nextRecoveryText'],
      ];
  return (
    <section className="ct-today__card ct-today__next" aria-labelledby="ct-today-next">
      <h2 id="ct-today-next" className="ct-today__eyebrow">
        {tToday(pc ? 'nextEyebrowPc' : 'nextEyebrow')}
      </h2>
      <dl className="ct-today__rows">
        {rows.map(([name, text]) => (
          <div key={name} className="ct-today__row">
            <dt>{tToday(name)}</dt>
            <dd className="ct-today__muted">{tToday(text)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function KeyValueCard({ id, title, rows }: { readonly id: string; readonly title: string; readonly rows: readonly (readonly [string, ReactNode])[] }) {
  return (
    <section className="ct-today__card ct-today__kv" aria-labelledby={id}>
      <h2 id={id} className="ct-today__eyebrow">
        {title}
      </h2>
      <dl className="ct-today__rows">
        {rows.map(([label, value]) => (
          <div key={label} className="ct-today__row ct-today__row--kv">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

interface Step {
  readonly done: boolean;
  readonly title: TodayTextKey;
  readonly hint: TodayTextKey;
  readonly action: TodayTextKey;
  readonly route: Route;
}

/**
 * Écran Aujourd'hui (I0) : planches iPhone-I0-Aujourdhui (accueil et trois réglages) et PC-I0-Aujourdhui (poids, profil, iPhone, données).
 * Seules des valeurs réellement lues sont affichées (profil, pesées, état de synchro, sauvegardes) ; le reste : « — », « jamais » ou
 * « non configurée », jamais un faux zéro.
 */
export function TodayScreen() {
  const container = useAppContainer();
  const layout = useLayout();
  const navigate = useNavigationStore((s) => s.navigate);
  const { sync, backups } = container;
  const status = useSyncExternalStore(sync ? sync.subscribe : subscribeNone, () => (sync ? sync.status() : null));
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const { repos } = container.data;
  // 0.1.4 (2) : un lot reçu de l'autre appareil (profil, pesée) relit l'écran sans changer d'onglet.
  const synced = useSyncedData(['profile', 'body_weight']);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [profiles, bodyWeights] = await Promise.all([repos.profile(), repos.bodyWeights()]);
        const [profile, weights] = await Promise.all([profiles.get(), bodyWeights.listRecent(30)]);
        let backupMs: number | null | undefined;
        if (backups.available()) {
          try {
            const listing = await backups.list();
            backupMs = listing.versions.reduce<number | null>((best, v) => (best === null || v.modifiedMs > best ? v.modifiedMs : best), null);
          } catch {
            backupMs = undefined;
          }
        }
        if (live) setLoaded({ profile, weights, backupMs });
      } catch {
        // Base fermée avant la fin de la lecture (écran quitté) : rien à afficher ; sinon l'échec est dit, jamais une valeur inventée.
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [repos, backups, synced]);

  const nowMs = container.clock.nowMs();
  const today = todayLocal(container.clock);
  const configured = status !== null && status.phase !== 'not-configured';
  const syncText = status !== null && configured ? statusLine(status, nowMs) : null;
  const title = (
    <h1 id="ct-section-notice-title" className="ct-section-notice__title ct-today__title">
      {tToday('title')}
    </h1>
  );

  if (!loaded) {
    return (
      <section className="ct-section-notice ct-today" aria-labelledby="ct-section-notice-title">
        {title}
        {failed ? <p className="ct-today__muted">{tToday('loadFailed')}</p> : null}
      </section>
    );
  }

  const { profile, weights, backupMs } = loaded;
  const dash = tToday('unknown');

  if (layout === 'pc') {
    const goal = profile?.goal ? tBody(GOAL_KEY[profile.goal]) : dash;
    const experience = profile?.experience ? tBody(EXPERIENCE_KEY[profile.experience]) : dash;
    const backup = backupMs === undefined ? dash : backupMs === null ? tToday('never') : formatStamp(new Date(backupMs).toISOString(), nowMs);
    return (
      <section className="ct-section-notice ct-today ct-today--pc" aria-labelledby="ct-section-notice-title">
        {title}
        <div className="ct-today__cols">
          <div className="ct-today__col">
            <TodaySessionCard />
            <NutritionRemainingCard />
            <WeightCard weights={weights} nowMs={nowMs} showActions />
            <NextCard pc />
          </div>
          <aside className="ct-today__col">
            <KeyValueCard
              id="ct-today-profile"
              title={tToday('profileEyebrow')}
              rows={[
                [tToday('height'), profile?.heightCm != null ? tToday('heightValue', { n: formatKg(profile.heightCm) }) : dash],
                [tToday('birthYear'), profile?.birthYear != null ? String(profile.birthYear) : dash],
                [tToday('goal'), goal],
                [tToday('experience'), experience],
              ]}
            />
            <KeyValueCard
              id="ct-today-phone"
              title={tToday('phoneEyebrow')}
              rows={[
                [tToday('sync'), syncText ?? tToday('notConfigured')],
                [tToday('signature'), dash],
                [tToday('healthKit'), dash],
              ]}
            />
            <KeyValueCard
              id="ct-today-data"
              title={tToday('dataEyebrow')}
              rows={[
                [tToday('backup'), backup],
                [tToday('lastExport'), dash],
              ]}
            />
          </aside>
        </div>
      </section>
    );
  }

  const body: Route = { tab: 'more', screen: 'body' };
  const steps: readonly Step[] = [
    { done: profile !== null, title: 'stepProfile', hint: 'stepProfileHint', action: 'actionProfile', route: body },
    { done: weights.length > 0, title: 'stepWeight', hint: 'stepWeightHint', action: 'actionWeight', route: body },
    { done: configured, title: 'stepPc', hint: 'stepPcHint', action: 'actionPc', route: { tab: 'more', screen: 'sync' } },
  ];
  const next = steps.find((s) => !s.done);

  return (
    <section className="ct-section-notice ct-today ct-today--mobile" aria-labelledby="ct-section-notice-title">
      <div className="ct-today__head">
        <p className="ct-today__date">{formatTodayEyebrow(today)}</p>
        {title}
      </div>
      {next ? (
        <>
          <section className="ct-today__card ct-today__hero" aria-label={tToday('welcomeEyebrow')}>
            <p className="ct-today__eyebrow ct-today__eyebrow--bronze">{tToday('welcomeEyebrow')}</p>
            <p className="ct-today__hero-title">{tToday('welcomeTitle')}</p>
            <p className="ct-today__muted">{tToday('welcomeText')}</p>
          </section>
          <section className="ct-today__card ct-today__steps" aria-label={tToday('stepsLabel')}>
            <ol className="ct-today__step-list">
              {steps.map((step, index) => (
                <li key={step.title} className="ct-today__step">
                  <button type="button" className="ct-today__step-button" onClick={() => navigate(step.route)}>
                    <span className={step.done ? 'ct-today__step-mark ct-today__step-mark--done' : 'ct-today__step-mark'}>
                      {step.done ? <Check size={16} role="img" aria-label={tToday('stepDone')} /> : index + 1}
                    </span>
                    <span className="ct-today__step-text">
                      <span className="ct-today__step-title">{tToday(step.title)}</span>
                      <span className="ct-today__muted">{tToday(step.hint)}</span>
                    </span>
                    <ChevronRight size={20} aria-hidden="true" className="ct-today__chevron" />
                  </button>
                </li>
              ))}
            </ol>
            <div className="ct-today__step-action">
              <Button fullWidth onClick={() => navigate(next.route)}>
                {tToday(next.action)}
              </Button>
            </div>
          </section>
        </>
      ) : null}
      <TodaySessionCard />
      <NutritionRemainingCard />
      {weights.length > 0 ? <WeightCard weights={weights} nowMs={nowMs} showActions={false} /> : null}
      <NextCard pc={false} />
      <p className="ct-today__footer">{syncText ?? tToday('syncNotConfigured')}</p>
    </section>
  );
}
