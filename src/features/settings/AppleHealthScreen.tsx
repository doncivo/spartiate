import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { todayLocal } from '../../domain/clock';
import type { IsoDateTime } from '../../domain/types';
import { formatKg } from '../../i18n/bodyText';
import { formatHealthTime, tHealth } from '../../i18n/healthText';
import { healthKit as platformHealthKit, type HealthKit, type HealthKitAvailability, type HealthKitBodyMass, type HealthKitDiagnostic, type HealthKitRead, type HealthKitStepCount, isMissingHealthKitEntitlement } from '../../platform/healthkit';
import { logFailure } from '../../platform/desktop/log';
import { parseShortcutWeights } from '../../domain/health/shortcutWeights';
import { detectTimeZone } from '../../platform/timeZone';
import type { ShortcutFilesReader } from '../../platform/shortcutFiles';
import { Button, Icon, useLayout } from '../../ui';
import { RecoveryImportSection } from './RecoveryImportSection';
import { RecoveryNotificationsSection } from './RecoveryNotificationsSection';
import { useAppContainer } from '../app/AppContainerContext';
import { RepositoryError } from '../../db/repositories/common';
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
export function AppleHealthScreen({
  healthKit = platformHealthKit,
  shortcutReader,
  shortcutFallback,
}: {
  readonly healthKit?: HealthKit;
  readonly shortcutReader?: ShortcutFilesReader;
  readonly shortcutFallback?: ShortcutFilesReader;
}) {
  const container = useAppContainer();
  const layout = useLayout();
  const navigate = useNavigationStore((s) => s.navigate);
  const [availability, setAvailability] = useState<HealthKitAvailability | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [reads, setReads] = useState<Reads | null>(null);
  const [diagnostic, setDiagnostic] = useState<HealthKitDiagnostic | null>(null);
  const [saved, setSaved] = useState<'ok' | 'error' | null>(null);
  const [knownBlocked, setKnownBlocked] = useState(false);
  const live = useRef(true);
  const settings = container.data.repos.settings;

  useEffect(() => {
    live.current = true;
    // État gardé d'une demande passée : l'écran ne contredit pas le message SideStore à la réouverture.
    void settings.get('healthkit.entitlementMissing').then(
      (value) => {
        if (live.current) setKnownBlocked(value === true);
      },
      () => undefined,
    );
    void healthKit.availability().then((value) => {
      if (live.current) setAvailability(value);
    });
    return () => {
      live.current = false;
    };
  }, [healthKit, settings]);

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
    setDiagnostic(null);
    const permission = await healthKit.requestAuthorization();
    if (!live.current) return;
    if (permission === 'denied') return setPhase('denied');
    if (permission === 'unavailable') return setAvailability('unavailable');
    if (permission === 'unsupported') return setAvailability('unsupported');
    if (permission === 'error') {
      const detail = await healthKit.diagnostic();
      if (!live.current) return;
      logFailure('healthkit', { code: 'healthkit-authorization-failed', message: diagnosticLog(detail) });
      if (isMissingHealthKitEntitlement(detail.error)) {
        setKnownBlocked(true);
        void settings.set('healthkit.entitlementMissing', true).catch(() => undefined);
      }
      setDiagnostic(detail);
      return setPhase('requestError');
    }
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
  // 0.1.4 (6) : entitlement absent (compte Apple gratuit) : définitif, le bouton n'a plus d'objet.
  const blocked = knownBlocked || (phase === 'requestError' && diagnostic !== null && isMissingHealthKitEntitlement(diagnostic.error));
  const canAsk = availability === 'available' && phase !== 'asking' && !blocked;

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
          {!blocked && <p className="ct-body__hint">{tHealth('intro')}</p>}
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
          {(phase === 'requestError' || blocked) && (
            <p className="ct-body__message" role="alert">
              {tHealth(blocked ? 'sideStoreBlocked' : 'requestError')}
            </p>
          )}
          {phase === 'requestError' && diagnostic && <TechnicalDetail diagnostic={diagnostic} />}
          {phase === 'read' && <p className="ct-body__hint">{tHealth('askedNote')}</p>}
        </section>

        {blocked && <ShortcutImport />}

        <RecoveryImportSection {...(shortcutReader ? { reader: shortcutReader } : {})} {...(shortcutFallback ? { fallback: shortcutFallback } : {})} />

        <RecoveryNotificationsSection />

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

/**
 * D-69 : import du fichier écrit par le raccourci « Spartiate — poids » (Santé → Raccourcis → iCloud Drive). Une pesée par jour, la plus
 * récente, enregistrée par `saveHealth` (identité `health`, idempotente) : un même fichier réimporté ne change rien, la saisie manuelle du
 * jour est conservée. Rien n'est envoyé ailleurs.
 */
function ShortcutImport() {
  const container = useAppContainer();
  const [state, setState] = useState<{ readonly kind: 'idle' | 'busy' } | { readonly kind: 'done' | 'empty' | 'error'; readonly text: string }>({ kind: 'idle' });

  async function importFile(): Promise<void> {
    setState({ kind: 'busy' });
    try {
      const picked = await container.files.pickText({ accept: ['.csv', '.txt', 'text/csv', 'text/plain'], maxBytes: 512 * 1024 });
      if (picked === null) return setState({ kind: 'idle' });
      const today = todayLocal(container.clock);
      const timezone = detectTimeZone() ?? 'Europe/Paris';
      const parsed = parseShortcutWeights(picked.text, today, timezone);
      if (parsed.weights.length === 0) return setState({ kind: 'empty', text: tHealth('shortcutEmpty', { count: parsed.rejected }) });
      // Une ligne refusée par le dépôt (jour recalculé dans le fuseau de l'appareil, donc futur) ne fait pas échouer le fichier : comptée.
      let refused = 0;
      await container.data.transaction(async (repos) => {
        const weights = await repos.bodyWeights();
        for (const w of parsed.weights) {
          try {
            await weights.saveHealth({ kg: w.kg, measuredAt: w.measuredAt as IsoDateTime, timezone, healthUuid: `raccourcis:${w.measuredAt}` }, today, { fromImport: true });
          } catch (error) {
            if (!(error instanceof RepositoryError)) throw error;
            refused += 1;
          }
        }
      });
      const imported = parsed.weights.length - refused;
      const totalRejected = parsed.rejected + refused;
      const rejected = totalRejected > 0 ? tHealth('shortcutRejected', { count: totalRejected }) : '';
      if (imported === 0) return setState({ kind: 'empty', text: tHealth('shortcutEmpty', { count: totalRejected }) });
      const done = imported === 1 ? tHealth('shortcutDoneOne', { rejected }) : tHealth('shortcutDoneMany', { count: imported, rejected });
      setState({ kind: 'done', text: done + (parsed.truncated ? tHealth('shortcutTruncated') : '') });
    } catch (error) {
      logFailure('healthkit', { code: 'shortcut-import-failed', message: error instanceof Error ? error.name : 'inconnu' });
      setState({ kind: 'error', text: tHealth('shortcutFailed') });
    }
  }

  return (
    <section className="ct-body__card" aria-label={tHealth('shortcutTitle')}>
      <h2 className="ct-body__section">{tHealth('shortcutTitle')}</h2>
      <p className="ct-body__hint">{tHealth('shortcutHint')}</p>
      <Button className="ct-body__save" disabled={state.kind === 'busy'} onClick={() => void importFile()}>
        {state.kind === 'busy' ? tHealth('shortcutImporting') : tHealth('shortcutImport')}
      </Button>
      {'text' in state && (
        <p className="ct-body__message" role={state.kind === 'done' ? 'status' : 'alert'}>
          {state.text}
        </p>
      )}
    </section>
  );
}

const yesNo = (value: boolean | null): string => (value === null ? tHealth('technicalUnknown') : value ? tHealth('technicalYes') : tHealth('technicalNo'));

/** Ligne du journal technique : domaine, code, description de l'NSError, texte d'usage et disponibilité. Aucune donnée de santé. */
function diagnosticLog(diagnostic: HealthKitDiagnostic): string {
  const usage = diagnostic.usageDescription === null ? 'inconnu' : diagnostic.usageDescription ? 'oui' : 'non';
  const available = diagnostic.available === null ? 'inconnu' : diagnostic.available ? 'oui' : 'non';
  const error = diagnostic.error ? `domaine ${diagnostic.error.domain} code ${diagnostic.error.code} ${diagnostic.error.description}` : 'aucune erreur native';
  return `${error} ; usage=${usage} ; disponible=${available}`;
}

/** « Détail technique » repliable : de quoi partager l'échec de la demande sans rien révéler de la santé. */
function TechnicalDetail({ diagnostic }: { readonly diagnostic: HealthKitDiagnostic }) {
  const usage = diagnostic.usageDescription === null ? tHealth('technicalUnknown') : diagnostic.usageDescription ? tHealth('technicalPresent') : tHealth('technicalAbsent');
  return (
    <details className="ct-body__hint">
      <summary>{tHealth('technicalDetail')}</summary>
      <p>{tHealth('technicalAvailable', { value: yesNo(diagnostic.available) })}</p>
      <p>{tHealth('technicalUsage', { value: usage })}</p>
      {diagnostic.error ? (
        <>
          <p>{tHealth('technicalDomain', { value: diagnostic.error.domain })}</p>
          <p>{tHealth('technicalCode', { value: diagnostic.error.code })}</p>
          <p>{tHealth('technicalDescription', { value: diagnostic.error.description })}</p>
        </>
      ) : (
        <p>{tHealth('technicalError', { value: tHealth('technicalNone') })}</p>
      )}
      <p>{tHealth('technicalShare')}</p>
    </details>
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
