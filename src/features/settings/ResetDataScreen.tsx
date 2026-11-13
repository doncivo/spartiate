import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { isResetConfirmed } from '../../domain/dataReset';
import { SYNC_CATALOGUE } from '../../domain/sync/syncTables';
import { tDataReset, type DataResetTextKey } from '../../i18n/dataResetText';
import { logFailure } from '../../platform/desktop/log';
import { defaultSyncLogger } from '../../sync/log';
import { Button, Icon, useLayout } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useNavigationStore } from '../app/navigation';
import './BodyScreen.css';

const WIPED: readonly DataResetTextKey[] = ['wipedProfile', 'wipedTraining', 'wipedNutrition', 'wipedBody', 'wipedRecovery'];
const KEPT: readonly DataResetTextKey[] = ['keptSettings', 'keptSync', 'keptContent', 'keptHealth'];

type Message = { readonly kind: 'ok' | 'error'; readonly key: DataResetTextKey };

/** Rechargement complet (même procédé que la restauration sur iPhone) : l'app redémarre comme une installation neuve, onboarding ouvert. */
const reloadApp = (): void => globalThis.location.reload();

/**
 * Plus › Données › « Repartir de zéro » (RESET-01, D-180 à D-186), iPhone et PC, chargé à la demande avec ses textes. Dit ce qui est effacé, ce qui est
 * gardé, que c'est irréversible et que cela vaut pour les deux appareils ; le bouton ne s'active qu'avec le mot EFFACER tapé (D-182). Refus visible si
 * une séance est en cours (D-184). Après l'effacement : synchro demandée (la remise à zéro part vers l'autre appareil), puis rechargement.
 */
export function ResetDataScreen({ onDone = reloadApp }: { readonly onDone?: () => void } = {}) {
  const container = useAppContainer();
  const layout = useLayout();
  const navigate = useNavigationStore((s) => s.navigate);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const confirmed = isResetConfirmed(typed);

  async function submit(): Promise<void> {
    if (!confirmed || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const { resetAllData } = await import('../../sync/dataReset');
      const outcome = await resetAllData(container.data, SYNC_CATALOGUE, defaultSyncLogger);
      if (outcome.kind === 'refused') {
        setMessage({ kind: 'error', key: outcome.reason === 'session-open' ? 'refusedSession' : 'refusedUnsupported' });
        return;
      }
      setMessage({ kind: 'ok', key: 'done' });
      try {
        await container.sync?.syncNow('manual');
      } catch (error) {
        // La remise à zéro est en file d'envoi : elle partira au prochain cycle (démarrage). Journalisé, jamais bloquant.
        logFailure('data-reset-sync', error);
      }
      onDone();
    } catch (error) {
      logFailure('data-reset', error);
      setMessage({ kind: 'error', key: 'failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ct-body-shell" data-layout={layout}>
      <div className="ct-body">
        <div className="ct-body__topRow">
          <button type="button" className="ct-body__back" aria-label={tDataReset('back')} onClick={() => navigate({ tab: 'more', screen: 'home' })}>
            <Icon icon={ArrowLeft} size="lg" />
          </button>
        </div>
        <h1 className="ct-body__title">{tDataReset('title')}</h1>
        <p className="ct-body__hint">{tDataReset('intro')}</p>

        <h2 className="ct-body__section ct-section-title">{tDataReset('wipedTitle')}</h2>
        <ul className="ct-body__list">
          {WIPED.map((key) => (
            <li key={key}>{tDataReset(key)}</li>
          ))}
        </ul>
        <h2 className="ct-body__section ct-section-title">{tDataReset('keptTitle')}</h2>
        <ul className="ct-body__list">
          {KEPT.map((key) => (
            <li key={key}>{tDataReset(key)}</li>
          ))}
        </ul>
        <p className="ct-body__hint">{tDataReset('bothDevices')}</p>
        <p className="ct-body__hint">
          <strong>{tDataReset('irreversible')}</strong>
        </p>

        <label className="ct-body__field">
          <span className="ct-body__label">{tDataReset('confirmLabel')}</span>
          <input
            className="ct-body__input"
            value={typed}
            placeholder={tDataReset('confirmPlaceholder')}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={busy}
            onChange={(event) => setTyped(event.target.value)}
          />
        </label>
        <Button variant="danger" disabled={!confirmed || busy} onClick={() => void submit()}>
          {tDataReset(busy ? 'busy' : 'submit')}
        </Button>
        {message && (
          <p className="ct-body__message" role={message.kind === 'error' ? 'alert' : 'status'}>
            {tDataReset(message.key)}
          </p>
        )}
      </div>
    </div>
  );
}
