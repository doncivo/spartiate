import { useEffect, useMemo, useRef, useState } from 'react';
import { tAppleIntelligence, type AppleIntelligencePlainKey } from '../../i18n/appleIntelligenceText';
import { openAppleIntelligence, type AppleIntelligence, type AppleIntelligenceResult, type AppleIntelligenceUnavailableReason } from '../../platform/appleIntelligence';
import { Button } from '../../ui';

interface Props {
  /** Surcharge de test ; par défaut l'adaptateur de la plateforme (iPhone : réel, ailleurs : `unsupported`). */
  readonly appleIntelligence?: AppleIntelligence;
}

const REASON_KEYS: Readonly<Record<AppleIntelligenceUnavailableReason, AppleIntelligencePlainKey>> = {
  'sdk-absent': 'reasonSdkAbsent',
  'os-too-old': 'reasonOsTooOld',
  'device-not-eligible': 'reasonDeviceNotEligible',
  'not-enabled': 'reasonNotEnabled',
  'model-not-ready': 'reasonModelNotReady',
  unknown: 'reasonUnknown',
};

const seconds = (ms: number): string => (Math.round(ms / 100) / 10).toFixed(1).replace('.', ',');

/** Résultat rendu tel quel : texte envoyé, puis réponse, motif ou erreur native. Rien n'est enregistré ni journalisé. */
function Outcome({ result }: { readonly result: AppleIntelligenceResult }) {
  const prompt = result.kind === 'answered' || result.kind === 'unavailable' || result.kind === 'error' ? result.prompt : null;
  return (
    <>
      {prompt !== null && <span className="ct-settings__hint">{tAppleIntelligence('prompt', { prompt })}</span>}
      {result.kind === 'answered' && (
        <>
          <span className="ct-settings__hint">{result.elapsedMs === null ? tAppleIntelligence('answeredNoTime') : tAppleIntelligence('answered', { seconds: seconds(result.elapsedMs) })}</span>
          <span>{result.response}</span>
        </>
      )}
      {result.kind === 'unavailable' && (
        <>
          <span>{tAppleIntelligence(REASON_KEYS[result.reason])}</span>
          {result.detail !== null && <span className="ct-settings__hint">{tAppleIntelligence('detail', { detail: result.detail })}</span>}
        </>
      )}
      {result.kind === 'error' && (
        <>
          <span className="ct-settings__hint ct-settings__hint--danger">{tAppleIntelligence('error')}</span>
          <span className="ct-settings__hint">{tAppleIntelligence('nativeError', { domain: result.error.domain, code: result.error.code, description: result.error.description })}</span>
        </>
      )}
      {result.kind === 'failed' && <span className="ct-settings__hint ct-settings__hint--danger">{tAppleIntelligence('failed', { code: result.code })}</span>}
      {result.kind === 'unsupported' && <span>{tAppleIntelligence('unsupported')}</span>}
    </>
  );
}

/**
 * Ligne « Essai Apple Intelligence » des outils de test de Plus › Logs (IOS-029b, spike sans engagement, H-41 proposée). Montée à la
 * demande avec l'écran des Logs ; l'essai ne part qu'au bouton. Le texte envoyé est fixe dans le Swift (aucune donnée de l'app).
 */
export function AppleIntelligenceTestRow({ appleIntelligence }: Props) {
  const ai = useMemo(() => appleIntelligence ?? openAppleIntelligence(), [appleIntelligence]);
  const [launched, setLaunched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AppleIntelligenceResult | null>(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  async function run(): Promise<void> {
    setLaunched(true);
    setBusy(true);
    setResult(null);
    const outcome = await ai.probe();
    if (!live.current) return;
    setResult(outcome);
    setBusy(false);
  }

  return (
    <div className="ct-settings__row">
      <span className="ct-settings__stack">
        <span>{tAppleIntelligence('row')}</span>
        {!launched && <span className="ct-settings__hint">{tAppleIntelligence('rowHint')}</span>}
        {launched && (
          <span className="ct-settings__stack" role="status" aria-live="polite">
            {busy || result === null ? <span className="ct-settings__hint">{tAppleIntelligence('running')}</span> : <Outcome result={result} />}
          </span>
        )}
      </span>
      <span className="ct-settings__actions">
        <Button variant="secondary" className="ct-settings__link" disabled={busy} onClick={() => void run()}>
          {tAppleIntelligence('start')}
        </Button>
      </span>
    </div>
  );
}
