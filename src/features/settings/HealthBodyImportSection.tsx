import { useEffect, useMemo, useRef, useState } from 'react';
import { BODY_FILE_NAMES, BODY_METRIC_OF } from '../../domain/health/bodyShortcutFiles';
import { MAX_LINES, SHORTCUT_REJECT_REASONS, type ShortcutRejectReason } from '../../domain/recovery/shortcutFiles';
import { utcToLocal } from '../../domain/timeZone';
import { tHealth, type HealthTextKey } from '../../i18n/healthText';
import type { ShortcutFilesReader } from '../../platform/shortcutFiles';
import { detectTimeZone } from '../../platform/timeZone';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { bodyImportLog, healthBodyImportFor, parseBodyImportSummary, type BodyFileOutcome, type BodyImportResult, type BodyImportSummary } from './healthBodyImport';

const reasonLabel = (reason: ShortcutRejectReason): string => tHealth(`recReason_${reason}` as HealthTextKey);

function dateText(iso: string): string {
  const local = utcToLocal(iso, detectTimeZone() ?? 'Europe/Paris');
  const [y = '', m = '', d = ''] = local.date.split('-');
  return tHealth('bodyLast', { date: `${d}/${m}/${y}`, time: local.time });
}

/** Phrase française de l'issue d'un lancement : aucun statut n'est silencieux, aucune valeur, seulement des comptes. */
export function bodyImportStatusMessage(result: BodyImportResult): string {
  switch (result.status) {
    case 'unsupported':
      return tHealth('bodyUnsupported');
    case 'needs-pick':
      return tHealth('bodyNeedsPick');
    case 'busy':
      return tHealth('bodyBusy');
    case 'throttled':
      return tHealth('bodyThrottled');
    case 'folder-unavailable':
      return tHealth('bodyFolderUnavailable');
    case 'cancelled':
      return tHealth('bodyCancelled');
    case 'failed':
      return tHealth('bodyFailed');
    case 'done': {
      const imported = result.files.filter((f) => f.state === 'imported').length;
      if (imported === 0) return result.files.some((f) => f.state === 'unreadable') ? tHealth('bodyDoneUnreadable') : tHealth('bodyDoneNone');
      return imported === 1 ? tHealth('bodyDoneRead1') : tHealth('bodyDoneReadN', { files: imported });
    }
  }
}

/**
 * Section « Corps et nutrition depuis Raccourcis » de l'écran Apple Santé (I6-04, D-113). iPhone : dernier import, comptes et refus PAR RAISON par fichier,
 * résumé de la nutrition, « Importer maintenant » et « Choisir les fichiers » (secours). PC : une phrase. Aucune valeur de santé n'est affichée.
 */
export function HealthBodyImportSection({ reader, fallback }: { readonly reader?: ShortcutFilesReader; readonly fallback?: ShortcutFilesReader }) {
  const container = useAppContainer();
  const service = useMemo(() => healthBodyImportFor(container, reader, fallback), [container, reader, fallback]);
  const [summary, setSummary] = useState<BodyImportSummary | null>(null);
  const [run, setRun] = useState<BodyImportResult | null>(service.lastRun());
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  const pc = container.platform.os !== 'ios' || container.platform.runtime !== 'tauri';

  const refresh = async (): Promise<void> => {
    try {
      const value = parseBodyImportSummary(await container.data.repos.settings.get('healthBody.lastImport'));
      if (live.current) setSummary(value);
    } catch {
      /* l'état affiché reste « jamais importé » : l'import réessaie */
    }
  };

  useEffect(() => {
    live.current = true;
    if (!pc) {
      void container.data.repos.settings.get('healthBody.lastImport').then(
        (value) => {
          if (live.current) setSummary(parseBodyImportSummary(value));
        },
        () => undefined,
      );
    }
    return () => {
      live.current = false;
    };
  }, [pc, container]);

  async function importNow(trigger: 'manual' | 'pick'): Promise<void> {
    setBusy(true);
    setMessage(null);
    const result = await service.run(trigger).catch(() => null);
    if (!live.current) return;
    setBusy(false);
    if (result === null) {
      bodyImportLog('body-import-failed', {});
      return setMessage(tHealth('bodyFailed'));
    }
    if (result.status === 'done' || result.status === 'failed') {
      setRun(result.status === 'done' ? result : null);
      await refresh();
    }
    setMessage(bodyImportStatusMessage(result));
  }

  const failedLast = summary?.failed === true && run === null;

  return (
    <section className="ct-body__card" aria-label={tHealth('bodyTitle')}>
      <h2 className="ct-body__section">{tHealth('bodyTitle')}</h2>
      {pc ? (
        <p className="ct-body__hint">{tHealth('bodyPcOnly')}</p>
      ) : (
        <>
          <p className="ct-body__hint">{tHealth('bodyHint')}</p>
          <p className="ct-body__hint">{tHealth('bodyRule')}</p>
          {failedLast && (
            <p className="ct-body__message" role="alert">
              {tHealth('bodyFailedLast')}
            </p>
          )}
          {BODY_FILE_NAMES.map((name) => (
            <FileRow key={name} name={name} outcome={run?.files.find((f) => f.name === name) ?? null} summary={summary} at={run?.at ?? summary?.at ?? null} />
          ))}
          {(run?.status === 'done' || (summary !== null && summary.failed !== true)) && <NutritionRow run={run} summary={summary} />}
          <Button className="ct-body__save" disabled={busy} onClick={() => void importNow('manual')}>
            {busy ? tHealth('bodyImporting') : tHealth('bodyImportNow')}
          </Button>
          <Button className="ct-body__save" disabled={busy} onClick={() => void importNow('pick')}>
            {tHealth('bodyPickFiles')}
          </Button>
          {message !== null && (
            <p className="ct-body__message" role="status">
              {message}
            </p>
          )}
          <p className="ct-body__hint">{tHealth('bodyGuide')}</p>
        </>
      )}
    </section>
  );
}

function FileRow({ name, outcome, summary, at }: { readonly name: (typeof BODY_FILE_NAMES)[number]; readonly outcome: BodyFileOutcome | null; readonly summary: BodyImportSummary | null; readonly at: string | null }) {
  const stored = summary?.files.find((f) => f.name === name && f.state === 'imported') ?? null;
  const imported = outcome?.state === 'imported' ? outcome : null;
  const isDays = ['energy', 'protein', 'carb', 'fat', 'fiber'].includes(BODY_METRIC_OF[name]);
  const reasons = imported?.rejected ? SHORTCUT_REJECT_REASONS.filter((r) => (imported.rejected?.[r] ?? 0) > 0) : [];
  return (
    <div className="ct-body__hint">
      <strong>{tHealth(`bodyType_${BODY_METRIC_OF[name]}` as HealthTextKey)}</strong>
      <p>{at === null || (stored === null && imported === null) ? tHealth('bodyNever') : dateText(at)}</p>
      {outcome?.state === 'absent' && <p>{tHealth('bodyFileAbsent')}</p>}
      {outcome?.state === 'unreadable' && <p>{tHealth('bodyFileUnreadable')}</p>}
      {imported !== null && (
        <p>
          {isDays
            ? tHealth('bodyFileCountsDays', { read: imported.read, rejected: imported.rejectedTotal })
            : tHealth('bodyFileCounts', { read: imported.read, added: imported.added, updated: imported.updated, unchanged: imported.unchanged, rejected: imported.rejectedTotal })}
        </p>
      )}
      {imported === null && stored !== null && (
        <p>{isDays ? tHealth('bodyFileCountsDays', { read: stored.read, rejected: stored.rejected }) : tHealth('bodyFileCounts', { read: stored.read, added: stored.added, updated: stored.updated, unchanged: Math.max(0, stored.read - stored.added - stored.updated), rejected: stored.rejected })}</p>
      )}
      {imported !== null && imported.skippedDeleted > 0 && <p>{tHealth('bodyFileDeleted', { count: imported.skippedDeleted })}</p>}
      {imported?.truncated && <p>{tHealth('bodyFileTruncated', { max: MAX_LINES.toLocaleString('fr-FR') })}</p>}
      {reasons.length > 0 && (
        <ul aria-label={tHealth('bodyRejectedBy')}>
          {reasons.map((r) => (
            <li key={r}>{tHealth('recRejectedReason', { label: reasonLabel(r), count: imported?.rejected?.[r] ?? 0 })}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NutritionRow({ run, summary }: { readonly run: BodyImportResult | null; readonly summary: BodyImportSummary | null }) {
  const n = run?.status === 'done' ? run.nutrition : summary?.nutrition;
  if (n === undefined) return null;
  return (
    <div className="ct-body__hint">
      <strong>{tHealth('bodyNutritionTitle')}</strong>
      <p>{tHealth('bodyNutritionCounts', { created: n.created, updated: n.updated, unchanged: n.unchanged, superseded: n.superseded, journal: n.skippedJournal, deleted: n.skippedDeleted, noEnergy: n.skippedNoEnergy })}</p>
    </div>
  );
}
