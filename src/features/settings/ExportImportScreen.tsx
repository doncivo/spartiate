import { ArrowLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ArchiveError, DEFAULT_THEME, EXPORT_SV, buildExportArchive, parseExportArchive, type ArchiveErrorCode, type ExportData, type ParsedArchive } from '../../domain/exportImport/archive';
import { planImport, type ImportMode } from '../../domain/exportImport/plan';
import { nowIso } from '../../domain/clock';
import { tExportImport, type ExportImportTextKey } from '../../i18n/exportImportText';
import { FileExportError } from '../../platform/files';
import { Button, Icon, SegmentedControl, useLayout } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useNavigationStore } from '../app/navigation';
import './BodyScreen.css';

const REASON: Record<ArchiveErrorCode, ExportImportTextKey> = {
  'not-zip': 'reasonNotZip',
  corrupt: 'reasonCorrupt',
  'missing-file': 'reasonMissingFile',
  'bad-manifest': 'reasonBadManifest',
  'wrong-app': 'reasonWrongApp',
  'future-version': 'reasonFutureVersion',
  'hash-mismatch': 'reasonHashMismatch',
  'invalid-data': 'reasonInvalidData',
};

interface Preview {
  readonly name: string;
  readonly parsed: ParsedArchive;
  readonly local: ExportData;
}
type Message = { readonly kind: 'ok' | 'error'; readonly text: string };

/**
 * Écran « Export et import » (Plus, SPA-005, D-57). Export : archive zip enregistrée par le service de fichiers (boîte « Enregistrer
 * sous » sur PC, feuille de partage sur iPhone). Import : archive choisie, validée en entier, décrite par un aperçu (ajouts,
 * modifications, suppressions) puis appliquée en une transaction après confirmation. Tout refus est visible et la base reste intacte.
 */
export function ExportImportScreen() {
  const container = useAppContainer();
  const layout = useLayout();
  const navigate = useNavigationStore((s) => s.navigate);
  const { data, files } = container;
  const year = new Date(container.clock.nowMs()).getUTCFullYear();
  const [message, setMessage] = useState<Message | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [busy, setBusy] = useState(false);

  /** État local publiable + thème (absent tant qu'il vaut la valeur par défaut « system »). */
  async function readLocal(repos: typeof data.repos): Promise<ExportData> {
    const base = await (await repos.exportImport()).readExportData();
    const theme = await repos.settings.get('ui.theme');
    return theme === DEFAULT_THEME ? base : { ...base, settings: { 'ui.theme': theme } };
  }

  async function doExport(): Promise<void> {
    setMessage(null);
    setBusy(true);
    try {
      const local = await readLocal(data.repos);
      const archive = await buildExportArchive(local, { date: nowIso(container.clock), sv: EXPORT_SV });
      const result = await files.save({ suggestedName: archive.fileName, mime: 'application/zip', data: archive.bytes });
      if (result.saved) setMessage({ kind: 'ok', text: tExportImport('exportSaved') });
    } catch (error) {
      const reason = error instanceof FileExportError ? error.reason : null;
      setMessage({ kind: 'error', text: tExportImport(reason === 'too-large' ? 'exportTooLarge' : reason === 'unavailable' ? 'exportUnavailable' : 'exportFailed') });
    } finally {
      setBusy(false);
    }
  }

  async function pick(): Promise<void> {
    setMessage(null);
    setPreview(null);
    setBusy(true);
    try {
      const picked = await files.pickBytes({ accept: ['.zip'] });
      if (picked === null) return;
      const parsed = await parseExportArchive(picked.bytes, { currentSv: EXPORT_SV, currentYear: year });
      setPreview({ name: picked.name, parsed, local: await readLocal(data.repos) });
      setMode('merge');
    } catch (error) {
      const reason =
        error instanceof ArchiveError ? tExportImport(REASON[error.code]) : error instanceof FileExportError && error.reason === 'too-large' ? tExportImport('reasonTooLarge') : tExportImport('reasonUnreadable');
      setMessage({ kind: 'error', text: tExportImport('refused', { reason }) });
    } finally {
      setBusy(false);
    }
  }

  const plan = useMemo(() => (preview ? planImport(preview.local, preview.parsed.data, mode) : null), [preview, mode]);

  async function confirm(): Promise<void> {
    if (!preview) return;
    setBusy(true);
    try {
      const counts = await data.transaction(async (repos) => {
        // Le plan est recalculé dans la transaction : l'aperçu a pu vieillir (une synchro a pu écrire entre-temps).
        const fresh = await readLocal(repos);
        const final = planImport(fresh, preview.parsed.data, mode);
        await (await repos.exportImport()).applyImport(final, year);
        const theme = final.writes.settings['ui.theme'];
        if (theme !== undefined) await repos.settings.set('ui.theme', theme);
        return final.counts;
      });
      setPreview(null);
      setMessage({ kind: 'ok', text: tExportImport('importDone', { add: counts.add, modify: counts.modify, delete: counts.delete }) });
    } catch {
      setMessage({ kind: 'error', text: tExportImport('importFailed') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ct-body-shell" data-layout={layout}>
      <div className="ct-body">
        <div className="ct-body__topRow">
          <button type="button" className="ct-body__back" aria-label={tExportImport('back')} onClick={() => navigate({ tab: 'more', screen: 'home' })}>
            <Icon icon={ArrowLeft} size={26} />
          </button>
        </div>
        <h1 className="ct-body__title">{tExportImport('title')}</h1>

        <h2 className="ct-body__section">{tExportImport('sectionExport')}</h2>
        <p className="ct-body__hint">{tExportImport('exportHint')}</p>
        <Button disabled={busy || !files.canSave()} onClick={() => void doExport()}>
          {tExportImport('exportButton')}
        </Button>

        <h2 className="ct-body__section">{tExportImport('sectionImport')}</h2>
        <p className="ct-body__hint">{tExportImport('importHint')}</p>
        <Button disabled={busy} onClick={() => void pick()}>
          {tExportImport('pickButton')}
        </Button>

        {message && (
          <p className="ct-body__message" role={message.kind === 'error' ? 'alert' : 'status'}>
            {message.text}
          </p>
        )}

        {preview && plan && (
          <section className="ct-body__field" role="region" aria-label={tExportImport('previewTitle')}>
            <h3 className="ct-body__label">{tExportImport('previewTitle')}</h3>
            <p className="ct-body__hint">{tExportImport('previewFile', { name: preview.name })}</p>
            <p className="ct-body__hint">{tExportImport('previewDate', { date: preview.parsed.manifest.date.slice(0, 10) })}</p>
            <SegmentedControl
              label={tExportImport('modeLabel')}
              value={mode}
              onChange={setMode}
              options={[
                { value: 'merge', label: tExportImport('modeMerge') },
                { value: 'replace', label: tExportImport('modeReplace') },
              ]}
            />
            <p className="ct-body__hint">{tExportImport(mode === 'merge' ? 'mergeHint' : 'replaceHint')}</p>
            <ul className="ct-body__list">
              <li>{tExportImport('previewAdd', { n: plan.counts.add })}</li>
              <li>{tExportImport('previewModify', { n: plan.counts.modify })}</li>
              <li>{tExportImport('previewDelete', { n: plan.counts.delete })}</li>
              <li>{tExportImport('previewUnchanged', { n: plan.counts.unchanged })}</li>
            </ul>
            <Button disabled={busy} onClick={() => void confirm()}>
              {tExportImport('confirm')}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setPreview(null)}>
              {tExportImport('cancel')}
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}
