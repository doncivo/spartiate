import { useState } from 'react';
import { tStartupBlocked } from '../../i18n/fr.startupBlocked';
import { Button } from '../../ui';
import './DbFailureDetails.css';

export type ShareOutcome = 'shared' | 'cancelled' | 'failed';

export interface StartupBlockedProps {
  /** Étape qui dépasse le délai (code technique). */
  readonly step: string;
  readonly seconds: number;
  readonly onRetry: () => void;
  readonly onShare: () => Promise<ShareOutcome>;
}

/**
 * « Démarrage bloqué : <étape> » (ios-demarrage) : remplace l'écran blanc. « Réessayer » relance l'app ; « Partager le journal » ouvre la
 * feuille de partage avec le journal technique, qui ne contient que des codes, des durées et des versions (aucune donnée personnelle).
 */
export function StartupBlocked({ step, seconds, onRetry, onShare }: StartupBlockedProps) {
  const [note, setNote] = useState<string | null>(null);
  const share = async (): Promise<void> => {
    const outcome = await onShare().catch((): ShareOutcome => 'failed');
    setNote(outcome === 'shared' ? tStartupBlocked('shared') : outcome === 'failed' ? tStartupBlocked('shareFailed') : null);
  };
  return (
    <section className="ct-db-failure">
      <p role="alert">{tStartupBlocked('title', { step })}</p>
      <p>{tStartupBlocked('detail', { seconds })}</p>
      <div className="ct-db-failure__actions">
        <Button onClick={onRetry}>{tStartupBlocked('retry')}</Button>
        <Button variant="secondary" onClick={() => void share()}>
          {tStartupBlocked('share')}
        </Button>
        {note && (
          <p role="status" className="ct-db-failure__note">
            {note}
          </p>
        )}
      </div>
    </section>
  );
}
