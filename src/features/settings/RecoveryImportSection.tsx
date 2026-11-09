import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MAX_LINES, SHORTCUT_REJECT_REASONS, type ShortcutRejectReason } from '../../domain/recovery';
import { utcToLocal } from '../../domain/timeZone';
import type { RecoveryImportState, RecoverySampleType } from '../../db/repositories/recoverySampleRepository';
import { tHealth, type HealthTextKey } from '../../i18n/healthText';
import type { ShortcutFilesReader } from '../../platform/shortcutFiles';
import { detectTimeZone } from '../../platform/timeZone';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { shortcutImportFor, type FileOutcome, type ImportRunResult } from './recoveryImport';

const TYPES: readonly { readonly type: RecoverySampleType; readonly label: HealthTextKey }[] = [
  { type: 'hrv', label: 'recTypeHrv' },
  { type: 'fc-repos', label: 'recTypeRestingHr' },
  { type: 'sommeil', label: 'recTypeSleep' },
  { type: 'pas', label: 'recTypeSteps' },
];

const reasonLabel = (reason: ShortcutRejectReason): string => tHealth(`recReason_${reason}` as HealthTextKey);

function lastImportText(state: RecoveryImportState): string {
  const local = utcToLocal(state.importedAt, detectTimeZone() ?? 'Europe/Paris');
  const [y = '', m = '', d = ''] = local.date.split('-');
  return tHealth('recLast', { date: `${d}/${m}/${y}`, time: local.time });
}

/**
 * Section « Raccourcis » de l'écran Apple Santé (récupération, I5-01 point 1.7, D-69). iPhone : dernier import par type, lignes lues et refusées
 * (par raison pour le dernier import de la session ; le total seul est gardé en base), « Importer maintenant ». PC : une phrase. Aucune valeur de
 * santé n'est affichée, seulement des comptes.
 */
export function RecoveryImportSection({ reader }: { readonly reader?: ShortcutFilesReader }) {
  const container = useAppContainer();
  const service = useMemo(() => shortcutImportFor(container, reader), [container, reader]);
  const [states, setStates] = useState<readonly RecoveryImportState[]>([]);
  const [run, setRun] = useState<ImportRunResult | null>(service.lastRun());
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  const pc = container.platform.os !== 'ios' || container.platform.runtime !== 'tauri';

  const refresh = useCallback(async () => {
    try {
      const list = await (await container.data.repos.recoverySamples()).listImportStates();
      if (live.current) setStates(list);
    } catch {
      /* l'état affiché reste « jamais importé » : l'import réessaie */
    }
  }, [container]);

  useEffect(() => {
    live.current = true;
    if (!pc) {
      void container.data.repos.recoverySamples().then((repo) => repo.listImportStates()).then(
        (list) => {
          if (live.current) setStates(list);
        },
        () => undefined,
      );
    }
    return () => {
      live.current = false;
    };
  }, [pc, container]);

  async function importNow(): Promise<void> {
    setBusy(true);
    setMessage(null);
    const result = await service.run('manual').catch(() => null);
    if (!live.current) return;
    setBusy(false);
    if (result === null) return setMessage(tHealth('shortcutFailed'));
    if (result.status === 'busy') return setMessage(tHealth('recBusy'));
    if (result.status === 'cancelled') return setMessage(tHealth('recCancelled'));
    if (result.status === 'done') {
      setRun(result);
      setMessage(result.recomputeFailed ? tHealth('recRecomputeFailed') : result.recomputedDays > 0 ? tHealth('recRecomputed', { days: result.recomputedDays }) : null);
      await refresh();
    }
  }

  return (
    <section className="ct-body__card" aria-label={tHealth('recTitle')}>
      <h2 className="ct-body__section">{tHealth('recTitle')}</h2>
      {pc ? (
        <p className="ct-body__hint">{tHealth('recPcOnly')}</p>
      ) : (
        <>
          <p className="ct-body__hint">{tHealth('recHint')}</p>
          <p className="ct-body__hint">{tHealth('recPickHint')}</p>
          {TYPES.map(({ type, label }) => (
            <TypeRow key={type} label={tHealth(label)} state={states.find((s) => s.type === type) ?? null} outcome={run?.files.find((f) => f.type === type) ?? null} />
          ))}
          <Button className="ct-body__save" disabled={busy} onClick={() => void importNow()}>
            {busy ? tHealth('recImporting') : tHealth('recImportNow')}
          </Button>
          {message !== null && (
            <p className="ct-body__message" role="status">
              {message}
            </p>
          )}
          <p className="ct-body__hint">{tHealth('recGuide')}</p>
        </>
      )}
    </section>
  );
}

function TypeRow({ label, state, outcome }: { readonly label: string; readonly state: RecoveryImportState | null; readonly outcome: FileOutcome | null }) {
  const imported = outcome?.state === 'imported' ? outcome : null;
  const counts = imported ?? state;
  const rejectedTotal = imported ? imported.rejectedTotal : (state?.rejected ?? 0);
  const reasons = imported?.rejected ? SHORTCUT_REJECT_REASONS.filter((r) => (imported.rejected?.[r] ?? 0) > 0) : [];
  return (
    <div className="ct-body__hint">
      <strong>{label}</strong>
      <p>{state === null ? tHealth('recNever') : lastImportText(state)}</p>
      {outcome?.state === 'absent' && <p>{tHealth('recAbsent')}</p>}
      {outcome?.state === 'unreadable' && <p>{tHealth('recUnreadable')}</p>}
      {outcome?.state === 'failed' && (
        <p role="alert">{tHealth('recFailed')}</p>
      )}
      {counts !== null && <p>{tHealth('recCounts', { added: counts.added, duplicates: counts.duplicates, rejected: rejectedTotal })}</p>}
      {imported?.truncated && <p>{tHealth('recTruncated', { max: MAX_LINES.toLocaleString('fr-FR') })}</p>}
      {reasons.length > 0 && (
        <ul aria-label={tHealth('recRejectedBy')}>
          {reasons.map((r) => (
            <li key={r}>{tHealth('recRejectedReason', { label: reasonLabel(r), count: imported?.rejected?.[r] ?? 0 })}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
