import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { todayLocal } from '../../domain/clock';
import type { IsoDateTime } from '../../domain/types';
import { formatKg } from '../../i18n/bodyText';
import { formatHealthTime, tHealth } from '../../i18n/healthText';
import { healthKit as platformHealthKit, type HealthKit, type HealthKitAvailability, type HealthKitBodyMass, type HealthKitRead, type HealthKitStepCount } from '../../platform/healthkit';
import { Button, Icon, useLayout } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useNavigationStore } from '../app/navigation';
import './BodyScreen.css';

type Phase = 'idle' | 'asking' | 'denied' | 'requestError' | 'read';
type Reads = { readonly mass: HealthKitRead<HealthKitBodyMass>; readonly steps: HealthKitRead<HealthKitStepCount> };

const READ_FAILURE = (code: string | undefined): string => (code ? tHealth('readError', { code }) : tHealth('readErrorNoCode'));

/**
 * Écran « Apple Santé » (Plus, iPhone seulement, SPA-006, D-59). Lecture seule de bodyMass et stepCount du jour : aucune écriture dans
 * Santé. iOS ne dit jamais si la lecture est accordée : une demande terminée est « terminée », un résultat vide n'est ni un zéro ni la
 * preuve d'un refus. « Utiliser cette pesée » enregistre la lecture par `saveHealth` (identité `health`), sans toucher à la saisie manuelle.
 */
export function AppleHealthScreen({ healthKit = platformHealthKit }: { readonly healthKit?: HealthKit }) {
  const container = useAppContainer();
  const layout = useLayout();
  const navigate = useNavigationStore((s) => s.navigate);
  const [availability, setAvailability] = useState<HealthKitAvailability | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [reads, setReads] = useState<Reads | null>(null);
  const [saved, setSaved] = useState<'ok' | 'error' | null>(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    void healthKit.availability().then((value) => {
      if (live.current) setAvailability(value);
    });
    return () => {
      live.current = false;
    };
  }, [healthKit]);

  async function read(): Promise<void> {
    setSaved(null);
    const [mass, steps] = await Promise.all([healthKit.bodyMassToday(), healthKit.stepCountToday()]);
    if (!live.current) return;
    setReads({ mass, steps });
    setPhase('read');
  }

  async function authorize(): Promise<void> {
    setPhase('asking');
    setReads(null);
    const permission = await healthKit.requestAuthorization();
    if (!live.current) return;
    if (permission === 'denied') return setPhase('denied');
    if (permission === 'unavailable') return setAvailability('unavailable');
    if (permission === 'unsupported') return setAvailability('unsupported');
    if (permission === 'error') return setPhase('requestError');
    // 'unknown' ou 'granted' : la lecture tranche (une demande terminée ne prouve pas l'accès).
    await read();
  }

  async function saveWeight(mass: HealthKitBodyMass): Promise<void> {
    try {
      const repository = await container.data.repos.bodyWeights();
      await repository.saveHealth({ kg: mass.kg, measuredAt: new Date(mass.measuredAt).toISOString() as IsoDateTime, timezone: mass.timezone, healthUuid: mass.uuid }, todayLocal(container.clock));
      if (live.current) setSaved('ok');
    } catch {
      if (live.current) setSaved('error');
    }
  }

  const anyEmpty = reads !== null && (reads.mass.state === 'empty' || reads.steps.state === 'empty');
  const canAsk = availability === 'available' && phase !== 'asking';

  return (
    <div className="ct-body-shell" data-layout={layout}>
      <div className="ct-body">
        <div className="ct-body__topRow">
          <button type="button" className="ct-body__back" aria-label={tHealth('back')} onClick={() => navigate({ tab: 'more', screen: 'home' })}>
            <Icon icon={ArrowLeft} size={26} />
          </button>
        </div>
        <h1 className="ct-body__title">{tHealth('title')}</h1>
        <section className="ct-body__card" aria-label={tHealth('title')}>
          <p className="ct-body__hint">{tHealth('intro')}</p>
          {availability === null && <p className="ct-body__hint">{tHealth('checking')}</p>}
          {availability === 'unsupported' && <p className="ct-body__hint">{tHealth('unsupported')}</p>}
          {availability === 'unavailable' && <p className="ct-body__hint">{tHealth('unavailable')}</p>}
          {availability === 'error' && (
            <p className="ct-body__message" role="alert">
              {tHealth('availabilityError')}
            </p>
          )}
          {canAsk && (
            <Button className="ct-body__save" onClick={() => void authorize()}>
              {tHealth('authorize')}
            </Button>
          )}
          {phase === 'denied' && (
            <p className="ct-body__message" role="alert">
              {tHealth('denied')}
            </p>
          )}
          {phase === 'requestError' && (
            <p className="ct-body__message" role="alert">
              {tHealth('requestError')}
            </p>
          )}
          {phase === 'read' && <p className="ct-body__hint">{tHealth('askedNote')}</p>}
        </section>

        {reads && (
          <>
            <section className="ct-body__card" aria-label={tHealth('sectionWeight')}>
              <h2 className="ct-body__section">{tHealth('sectionWeight')}</h2>
              <WeightRead read={reads.mass} onRetry={() => void read()} onUse={(mass) => void saveWeight(mass)} />
              {saved === 'ok' && (
                <p className="ct-body__message" role="status">
                  {tHealth('weightUsed')}
                </p>
              )}
              {saved === 'error' && (
                <p className="ct-body__message" role="alert">
                  {tHealth('weightUsedFailed')}
                </p>
              )}
            </section>
            <section className="ct-body__card" aria-label={tHealth('sectionSteps')}>
              <h2 className="ct-body__section">{tHealth('sectionSteps')}</h2>
              <StepsRead read={reads.steps} onRetry={() => void read()} />
            </section>
            {anyEmpty && <p className="ct-body__hint">{tHealth('emptyNote')}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function Failure({ read, onRetry }: { readonly read: HealthKitRead<unknown>; readonly onRetry: () => void }) {
  if (read.state === 'denied') return <p className="ct-body__hint">{tHealth('readDenied')}</p>;
  if (read.state === 'unavailable' || read.state === 'unsupported') return <p className="ct-body__hint">{tHealth('readUnavailable')}</p>;
  if (read.state !== 'error') return null;
  return (
    <>
      <p className="ct-body__message" role="alert">
        {READ_FAILURE(read.code)}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        {tHealth('retry')}
      </Button>
    </>
  );
}

function WeightRead({ read, onRetry, onUse }: { readonly read: HealthKitRead<HealthKitBodyMass>; readonly onRetry: () => void; readonly onUse: (mass: HealthKitBodyMass) => void }) {
  if (read.state === 'granted') {
    const mass = read.value;
    return (
      <>
        <p className="ct-body__big">{tHealth('weightValue', { kg: formatKg(mass.kg) })}</p>
        <p className="ct-body__hint">{tHealth('weightMeta', { source: mass.source.name, time: formatHealthTime(mass.measuredAt, mass.timezone) })}</p>
        <Button className="ct-body__save" onClick={() => onUse(mass)}>
          {tHealth('useWeight')}
        </Button>
      </>
    );
  }
  if (read.state === 'empty') return <p className="ct-body__hint">{tHealth('weightEmpty')}</p>;
  return <Failure read={read} onRetry={onRetry} />;
}

function StepsRead({ read, onRetry }: { readonly read: HealthKitRead<HealthKitStepCount>; readonly onRetry: () => void }) {
  if (read.state === 'granted') {
    const steps = read.value;
    const sources = steps.sources.map((s) => s.name).join(', ');
    return (
      <>
        <p className="ct-body__big">{tHealth('stepsValue', { count: steps.count.toLocaleString('fr-FR') })}</p>
        <p className="ct-body__hint">{tHealth('stepsMeta', { sources, start: formatHealthTime(steps.start, steps.timezone), end: formatHealthTime(steps.end, steps.timezone) })}</p>
      </>
    );
  }
  if (read.state === 'empty') return <p className="ct-body__hint">{tHealth('stepsEmpty')}</p>;
  return <Failure read={read} onRetry={onRetry} />;
}
