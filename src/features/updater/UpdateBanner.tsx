import { useState } from 'react';
import { t } from '../../i18n';
import { Button } from '../../ui';
import { useFeatureStore } from '../app/AppContainerContext';
import { updaterStore } from './updaterStore';
import './UpdateBanner.css';

/**
 * Bandeau discret de mise à jour (D-03, critères 2, 4 et 5) : version, « Voir les notes »,
 * « Installer et redémarrer » et « Plus tard », et rien d'autre (QB-16 : pas d'« Ignorer cette
 * version »). Pendant l'installation : progression ; après un refus de signature : message,
 * l'app actuelle continue. Invisible tant qu'aucune version plus récente n'est annoncée.
 */
export function UpdateBanner() {
  const status = useFeatureStore(updaterStore, (s) => s.status);
  const visible = useFeatureStore(updaterStore, (s) => s.bannerVisible);
  const version = useFeatureStore(updaterStore, (s) => s.version);
  const notes = useFeatureStore(updaterStore, (s) => s.notes);
  const notesOpen = useFeatureStore(updaterStore, (s) => s.notesOpen);
  const progress = useFeatureStore(updaterStore, (s) => s.progress);
  const failure = useFeatureStore(updaterStore, (s) => s.failure);
  const failures = useFeatureStore(updaterStore, (s) => s.checkFailures);
  const install = useFeatureStore(updaterStore, (s) => s.install);
  const later = useFeatureStore(updaterStore, (s) => s.later);
  const toggleNotes = useFeatureStore(updaterStore, (s) => s.toggleNotes);

  const [dismissed, setDismissed] = useState<string | null>(null);
  const close = (key: string) => () => setDismissed(key);
  // Échec durable sans version à proposer (vérification en échec, ou échec d'installation relu après redémarrage) : visible seul.
  // C-126 : l'alerte se ferme (pour cette session) ; un autre échec la réaffiche.
  if (visible && !version && (status === 'installFailed' || status === 'checkFailed')) {
    const key = `${status}:${String(failure)}:${String(failures)}`;
    return dismissed === key ? null : <FailureNotice failure={status === 'installFailed' ? failure : null} onClose={close(key)} />;
  }
  if (status === 'checkFailed') return dismissed === `checkFailed:${String(failures)}` ? null : <FailureNotice failure={null} onClose={close(`checkFailed:${String(failures)}`)} />;

  const offered = status === 'available' || status === 'downloading' || status === 'installFailed';
  if (!visible || !offered || !version) return null;

  const downloading = status === 'downloading';
  const percent =
    progress && progress.totalBytes ? Math.min(100, Math.floor((progress.downloadedBytes / progress.totalBytes) * 100)) : null;

  return (
    <section className="ct-update" role="region" aria-label={t('updater.bannerLabel')}>
      <div className="ct-update__row">
        <p className="ct-update__message" role="status">
          {t('updater.available', { version })}
        </p>
        <div className="ct-update__actions">
          <Button variant="secondary" onClick={toggleNotes} expanded={notesOpen} className="ct-update__button">
            {notesOpen ? t('updater.hideNotes') : t('updater.viewNotes')}
          </Button>
          <Button onClick={() => void install()} disabled={downloading} className="ct-update__button">
            {t('updater.installRestart')}
          </Button>
          <Button variant="secondary" onClick={later} disabled={downloading} className="ct-update__button">
            {t('updater.later')}
          </Button>
        </div>
      </div>
      {downloading && (
        <div className="ct-update__progress">
          <p className="ct-update__state" role="status">
            {percent === null ? t('updater.downloadingUnknown') : t('updater.downloading', { percent })}
          </p>
          <progress className="ct-update__bar" max={100} value={percent ?? undefined} aria-label={t('updater.downloadingUnknown')} />
        </div>
      )}
      {status === 'installFailed' && (
        <p className="ct-update__error" role="alert">
          {failure === 'signature' ? t('updater.signatureRefused') : t('updater.installFailed')}
        </p>
      )}
      {notesOpen && (
        <div className="ct-update__notes">
          <h2 className="ct-update__notesTitle">{t('updater.notesTitle', { version })}</h2>
          <p className="ct-update__notesBody">{notes ?? t('updater.noNotes')}</p>
        </div>
      )}
    </section>
  );
}

function FailureNotice({ failure, onClose }: { failure: 'signature' | 'other' | null; onClose: () => void }) {
  const text = failure === 'signature' ? t('updater.signatureRefused') : failure === 'other' ? t('updater.installFailed') : t('updater.checkFailed');
  return (
    <section className="ct-update" role="region" aria-label={t('updater.bannerLabel')}>
      <p className="ct-update__error" role="alert">
        {text}
      </p>
      <Button variant="secondary" onClick={onClose} className="ct-update__button">
        {t('common.close')}
      </Button>
    </section>
  );
}
