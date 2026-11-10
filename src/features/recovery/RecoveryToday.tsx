import { useEffect, useState, type ReactElement } from 'react';
import { todayLocal } from '../../domain/clock';
import type { RecoveryExplanationKey } from '../../domain/recovery';
import type { LocalDate } from '../../domain/types';
import type { RecoveryDayRecord } from '../../db/repositories';
import { formatDetailDate } from '../../i18n/format';
import { tRecovery, type RecoveryTextKey } from '../../i18n/recoveryText';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import type { AppContainer } from '../app/container';
import { useNavigationStore } from '../app/navigation';
import { useSyncedData } from '../sync/remoteChanges';
import { contributorTone, exertionDial, formatDuration, formatScore, recoveryDial, ringFraction, sleepDial, stalenessOf, stepsSummary, type StepsSummary } from './display';
import './RecoveryToday.css';

/**
 * Cadrans de récupération d'Aujourd'hui (I5-02 point 2.1, § 16.4 et § 16.5) : Recovery, Exertion, Sommeil (valeur ou raison, qualité,
 * contributeurs, « estimation, pas un avis médical ») et tuile Pas. Lecture seule des résumés `recovery_day` (iPhone : calculés ici ;
 * PC : reçus par la synchro, jamais recalculés). Les pas ne sont PAS publiés (`recovery_day` n'a pas de colonne de pas) : ils viennent de
 * `recovery_sample`, local à l'iPhone ; le PC le dit. Bloc chargé à la demande avec son catalogue de textes.
 */
type Ready = {
  readonly status: 'ready';
  readonly record: RecoveryDayRecord | null;
  readonly phone: boolean;
  readonly importedAt: string | null;
  /** Pas des 7 derniers jours (iPhone seulement) ; `null` sur le PC. */
  readonly steps: StepsSummary | null;
  readonly hasImport: boolean;
};
type Load = { readonly status: 'loading' } | { readonly status: 'failed' } | Ready;

const DAY_MS = 86_400_000;
const shift = (day: string, delta: number): LocalDate => new Date(Date.parse(`${day}T00:00:00.000Z`) + delta * DAY_MS).toISOString().slice(0, 10) as LocalDate;

async function read(container: AppContainer, today: LocalDate): Promise<Ready> {
  const { repos } = container.data;
  const phone = container.platform.os === 'ios';
  // Dernier résumé sans borne basse : un résumé ancien reste affiché, avec son avis périmé.
  const record = await (await repos.recovery()).latestDay();
  if (!phone) return { status: 'ready', record, phone, importedAt: null, steps: null, hasImport: false };
  const samples = await repos.recoverySamples();
  const states = await samples.listImportStates();
  const importedAt = states.reduce<string | null>((best, s) => (best === null || s.importedAt > best ? s.importedAt : best), null);
  const window = await samples.listWindow('pas', `${shift(today, -6)}T00:00:00.000Z`, `${today}T23:59:59.999Z`);
  return { status: 'ready', record, phone, importedAt, steps: stepsSummary(window, today), hasImport: states.length > 0 };
}

function Dial({ fraction, children, label }: { readonly fraction: number | null; readonly children: ReactElement | string; readonly label: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="ct-recovery__dial">
      <svg viewBox="0 0 100 100" role="img" aria-label={label} className="ct-recovery__ring">
        <circle className="ct-recovery__track" cx="50" cy="50" r={r} />
        {fraction !== null && fraction > 0 ? <circle className="ct-recovery__arc" cx="50" cy="50" r={r} strokeDasharray={`${String(fraction * c)} ${String(c)}`} transform="rotate(-90 50 50)" /> : null}
      </svg>
      <span className="ct-recovery__center" aria-hidden="true">
        {children}
      </span>
    </div>
  );
}

const TONE_MARK = { up: '▲', flat: '▬', down: '▼' } as const;
const TONE_TEXT = { up: 'toneUp', flat: 'toneFlat', down: 'toneDown' } as const satisfies Record<string, RecoveryTextKey>;

function Cards({ load, today, nowMs }: { readonly load: Ready; readonly today: string; readonly nowMs: number }) {
  const { record, phone } = load;
  const s = record?.summary ?? null;
  const navigate = useNavigationStore((st) => st.navigate);
  const goHealth = (): void => navigate({ tab: 'more', screen: 'health' });

  if (s === null) {
    const never = phone ? !load.hasImport : true;
    return (
      <section className="ct-today__card ct-recovery" aria-labelledby="ct-recovery-title">
        <h2 id="ct-recovery-title" className="ct-today__eyebrow">
          {tRecovery('title')}
        </h2>
        <p className="ct-today__text">{tRecovery(phone ? (never ? 'neverImportedPhone' : 'noSummaryPhone') : 'neverReceivedPc')}</p>
        <p className="ct-today__muted">{tRecovery(phone ? (never ? 'neverImportedPhoneHint' : 'noSummaryPhoneHint') : 'neverReceivedPcHint')}</p>
        {phone ? (
          <Button variant="secondary" fullWidth onClick={goHealth}>
            {tRecovery('neverImportedAction')}
          </Button>
        ) : null}
      </section>
    );
  }

  const stale = stalenessOf(phone ? (load.importedAt ?? s.computedAt) : s.computedAt, nowMs);
  const recovery = recoveryDial(s);
  const exertion = exertionDial(s);
  const sleep = sleepDial(s);
  const quality = tRecovery(`quality_${s.quality}`);
  const staleKey = stale.days === 1 ? (phone ? 'staleImportOne' : 'staleSummaryOne') : phone ? 'staleImport' : 'staleSummary';

  const recoveryLabel =
    recovery.kind === 'value'
      ? `${tRecovery('recoveryLabel')} : ${String(recovery.value)} ${tRecovery('outOf100')}. ${quality}.`
      : recovery.kind === 'learning'
        ? `${tRecovery('recoveryLabel')} : ${tRecovery('learning').toLowerCase()} ${tRecovery('learningProgress', { x: recovery.nights })}. ${quality}.`
        : `${tRecovery('recoveryLabel')} : ${tRecovery('noScore')}. ${tRecovery(`abstain_${recovery.reason}`)} ${quality}.`;
  const exertionLabel =
    exertion.kind === 'value'
      ? `${tRecovery('exertionLabel')} : ${formatScore(exertion.value)} ${tRecovery('outOf10')}. ${tRecovery('exertionScope')}.`
      : `${tRecovery('exertionLabel')} : ${tRecovery('exertionNone').toLowerCase()}.`;
  const need = tRecovery('sleepNeed', { d: formatDuration(sleep.needMinutes) });
  const sleepLabel =
    sleep.kind === 'value'
      ? `${tRecovery('sleepLabel')} : ${formatDuration(sleep.minutes)}${sleep.scorePct === null ? '' : `, ${tRecovery('sleepShare', { n: sleep.scorePct })}`}. ${need}.`
      : `${tRecovery('sleepLabel')} : ${tRecovery('sleepUnmeasured').toLowerCase()}. ${need}.`;

  return (
    <>
      <section className="ct-today__card ct-recovery" aria-labelledby="ct-recovery-title">
        <h2 id="ct-recovery-title" className="ct-today__eyebrow">
          {tRecovery('title')}
        </h2>
        {stale.stale ? <p className="ct-recovery__notice">{tRecovery(staleKey, { n: stale.days })}</p> : null}
        {s.day !== today ? <p className="ct-today__muted">{tRecovery('summaryOfDay', { date: formatDetailDate(s.day) })}</p> : null}
        <div className="ct-recovery__dials">
          <section className="ct-recovery__cell" aria-label={tRecovery('recoveryLabel')}>
            <Dial fraction={recovery.kind === 'value' ? ringFraction(recovery.value, 100) : recovery.kind === 'learning' ? ringFraction(recovery.nights, recovery.of) : null} label={recoveryLabel}>
              {recovery.kind === 'value' ? String(recovery.value) : recovery.kind === 'learning' ? tRecovery('learningProgress', { x: recovery.nights }) : '—'}
            </Dial>
            <p className="ct-recovery__name">{tRecovery('recoveryLabel')}</p>
            {recovery.kind === 'learning' ? <p className="ct-today__text">{tRecovery('learning')}</p> : null}
            {recovery.kind === 'learning' ? <p className="ct-today__muted">{tRecovery('learningHint')}</p> : null}
            {recovery.kind === 'abstained' ? <p className="ct-today__muted">{tRecovery(`abstain_${recovery.reason}`)}</p> : null}
            {recovery.kind === 'value' && s.learningNights < 14 ? <p className="ct-today__muted">{tRecovery('learningCaption', { x: s.learningNights })}</p> : null}
            <p className="ct-today__muted">{quality}</p>
          </section>
          <section className="ct-recovery__cell" aria-label={tRecovery('exertionLabel')}>
            <Dial fraction={exertion.kind === 'value' ? ringFraction(exertion.value, 10) : null} label={exertionLabel}>
              {exertion.kind === 'value' ? formatScore(exertion.value) : '—'}
            </Dial>
            <p className="ct-recovery__name">{tRecovery('exertionLabel')}</p>
            <p className="ct-today__muted">{exertion.kind === 'value' ? tRecovery('exertionScope') : tRecovery('exertionNone')}</p>
          </section>
          <section className="ct-recovery__cell" aria-label={tRecovery('sleepLabel')}>
            <Dial fraction={sleep.kind === 'value' && sleep.scorePct !== null ? ringFraction(sleep.scorePct, 100) : null} label={sleepLabel}>
              {sleep.kind === 'value' ? formatDuration(sleep.minutes) : '—'}
            </Dial>
            <p className="ct-recovery__name">{tRecovery('sleepLabel')}</p>
            {sleep.kind === 'value' && sleep.scorePct !== null ? <p className="ct-today__muted">{tRecovery('sleepShare', { n: sleep.scorePct })}</p> : null}
            {sleep.kind === 'unmeasured' ? <p className="ct-today__muted">{tRecovery('sleepUnmeasured')}</p> : null}
            <p className="ct-today__muted">{need}</p>
          </section>
        </div>
        {s.contributors.length > 0 ? (
          <>
            <h3 className="ct-today__eyebrow">{tRecovery('contributors')}</h3>
            <ul className="ct-recovery__list">
              {s.contributors.map((c) => {
                const tone = contributorTone(c);
                return (
                  <li key={c.key} className="ct-today__text">
                    <span aria-hidden="true" className="ct-recovery__mark">
                      {TONE_MARK[tone]}
                    </span>
                    {tRecovery(`${c.key}_${tone}` as RecoveryTextKey)}
                    <span className="ct-recovery__sr"> ({tRecovery(TONE_TEXT[tone])})</span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
        {s.explanationKeys.length > 0 ? (
          <ul className="ct-recovery__list">
            {s.explanationKeys.map((k: RecoveryExplanationKey) => (
              <li key={k} className="ct-today__muted">
                {tRecovery(`explain_${k}`)}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="ct-today__muted ct-recovery__disclaimer">{tRecovery('disclaimer')}</p>
      </section>
      <section className="ct-today__card ct-recovery" aria-label={tRecovery('stepsTitle')}>
        <h2 className="ct-today__eyebrow">{tRecovery('stepsTitle')}</h2>
        {!phone ? (
          <p className="ct-today__muted">{tRecovery('stepsOnPhone')}</p>
        ) : load.steps === null || load.steps.average === null ? (
          <p className="ct-today__muted">{tRecovery('stepsNone')}</p>
        ) : (
          <dl className="ct-today__rows">
            <div className="ct-today__row ct-today__row--kv">
              <dt>{tRecovery('stepsToday')}</dt>
              <dd>{load.steps.today === null ? tRecovery('stepsTodayUnknown') : `${load.steps.today.toLocaleString('fr-FR')} ${tRecovery('stepsUnit')}`}</dd>
            </div>
            <div className="ct-today__row ct-today__row--kv">
              <dt>{load.steps.knownDays < 7 ? tRecovery('stepsAveragePartial', { n: load.steps.knownDays }) : tRecovery('stepsAverage')}</dt>
              <dd>{`${load.steps.average.toLocaleString('fr-FR')} ${tRecovery('stepsUnit')}`}</dd>
            </div>
          </dl>
        )}
      </section>
    </>
  );
}

export function RecoveryToday() {
  const container = useAppContainer();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const synced = useSyncedData(['recovery_day']);
  const today = todayLocal(container.clock);

  useEffect(() => {
    let live = true;
    read(container, today).then(
      (result) => {
        if (live) setLoad(result);
      },
      () => {
        if (live) setLoad({ status: 'failed' });
      },
    );
    return () => {
      live = false;
    };
  }, [container, today, synced, attempt]);

  if (load.status === 'loading') {
    return (
      <p role="status" className="ct-today__muted">
        {tRecovery('loading')}
      </p>
    );
  }
  if (load.status === 'failed') {
    return (
      <section className="ct-today__card ct-recovery" role="alert">
        <p className="ct-today__text">{tRecovery('loadFailed')}</p>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            setLoad({ status: 'loading' });
            setAttempt((n) => n + 1);
          }}
        >
          {tRecovery('retry')}
        </Button>
      </section>
    );
  }
  return <Cards load={load} today={today} nowMs={container.clock.nowMs()} />;
}
