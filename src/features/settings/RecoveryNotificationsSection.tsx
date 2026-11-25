import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RecoveryNotificationPrefs } from '../../domain/recovery';
import { DEFAULT_RECOVERY_NOTIFICATION_PREFS } from '../../domain/recovery';
import { tRn, type RecoveryNotificationsTextKey } from '../../i18n/fr.recoveryNotifications';
import { logFailure } from '../../platform/desktop/log';
import { Switch } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { recoveryNotificationsFor, type RecoveryNotificationResult } from '../notifications';
import './RecoveryNotificationsSection.css';

type Proposal = { readonly day: string; readonly time: string | null } | null;

const MESSAGE: Readonly<Record<RecoveryNotificationResult['status'], RecoveryNotificationsTextKey | null>> = {
  unsupported: 'unavailable',
  off: null,
  permission: 'permissionDenied',
  'no-zone': 'failed',
  planned: null,
  failed: 'failed',
};

/**
 * Section « Sommeil et rappels » de l'écran Apple Santé (Plus, I5-02 point 2.3) : heure de coucher proposée (§ 16.7), deux interrupteurs
 * DÉSACTIVÉS par défaut (rappel de coucher 30 min avant, notification du matin), réglages locaux jamais publiés. iPhone seulement : sur le PC,
 * une phrase, aucun interrupteur. L'autorisation d'iOS n'est demandée que par un interrupteur allumé (geste), jamais à l'ouverture ni après un refus.
 * Textes dans un catalogue chargé avec l'écran (AppleHealthScreen est à la demande).
 */
export function RecoveryNotificationsSection() {
  const container = useAppContainer();
  const service = useMemo(() => recoveryNotificationsFor(container), [container]);
  const pc = container.platform.os !== 'ios' || container.platform.runtime !== 'tauri';
  const [prefs, setPrefs] = useState<RecoveryNotificationPrefs>(DEFAULT_RECOVERY_NOTIFICATION_PREFS);
  const [proposal, setProposal] = useState<Proposal>(null);
  const [message, setMessage] = useState<RecoveryNotificationsTextKey | null>(null);
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    live.current = true;
    if (pc) return () => undefined;
    // SHELL-0294d (C-129) : une lecture en échec est dite et journalisée (jamais un rejet non géré).
    void (async () => {
      try {
        const [p, q] = await Promise.all([service.readPrefs(), service.readProposal()]);
        if (!live.current) return;
        setPrefs(p);
        setProposal(q);
      } catch (error) {
        logFailure('recovery-notifications', error);
        if (live.current) setMessage('loadError');
      }
    })();
    return () => {
      live.current = false;
    };
  }, [pc, service]);

  const change = useCallback(
    async (next: RecoveryNotificationPrefs) => {
      const previous = prefsRef.current;
      setBusy(true);
      setMessage(null);
      try {
        const result = await service.requestPermissionAndReplan(next);
        if (!live.current) return;
        // C-129 : le nouvel état n'est annoncé qu'à la réponse du service, jamais avant (l'interrupteur ne ment pas pendant l'attente) ;
        // un refus ou un échec le laisse à son état d'avant.
        setPrefs(result.status === 'planned' || result.status === 'off' ? next : previous);
        setMessage(MESSAGE[result.status]);
      } catch (error) {
        logFailure('recovery-notifications', error);
        if (!live.current) return;
        setPrefs(previous);
        setMessage('failed');
      } finally {
        if (live.current) setBusy(false);
      }
    },
    [service],
  );

  if (pc) {
    return (
      <section className="ct-body__card ct-recnotif ct-flat" aria-label={tRn('title')}>
        <h2 className="ct-body__section ct-section-title">{tRn('title')}</h2>
        <p className="ct-body__hint">{tRn('pcInfo')}</p>
      </section>
    );
  }

  return (
    <section className="ct-body__card ct-recnotif ct-flat" aria-label={tRn('title')}>
      <h2 className="ct-body__section ct-section-title">{tRn('title')}</h2>
      <p className="ct-body__hint">{tRn('intro')}</p>
      <div className="ct-recnotif__proposal">
        <span className="ct-recnotif__label">{tRn('proposalTitle')}</span>
        {proposal?.time != null && <span className="ct-recnotif__time">{tRn('proposalValue', { time: proposal.time })}</span>}
      </div>
      <p className="ct-body__hint">{proposal === null ? tRn('proposalUnknown') : proposal.time === null ? tRn('proposalNone') : tRn('proposalHelp')}</p>
      <div className="ct-recnotif__row">
        <span className="ct-recnotif__stack">
          {tRn('bedtimeLabel')}
          <span className="ct-body__hint">{tRn('bedtimeHint')}</span>
        </span>
        <Switch checked={prefs.bedtime} label={tRn('bedtimeLabel')} disabled={busy} onChange={(value) => void change({ ...prefs, bedtime: value })} />
      </div>
      <div className="ct-recnotif__row">
        <span className="ct-recnotif__stack">
          {tRn('morningLabel')}
          <span className="ct-body__hint">{tRn('morningHint')}</span>
        </span>
        <Switch checked={prefs.morning} label={tRn('morningLabel')} disabled={busy} onChange={(value) => void change({ ...prefs, morning: value })} />
      </div>
      {message !== null && (
        <p className="ct-body__message ct-recnotif__message" role="alert">
          {tRn(message)}
        </p>
      )}
    </section>
  );
}
