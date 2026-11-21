import { useEffect, useId, useMemo, useState, type ChangeEvent } from 'react';
import { OcrError, openOcrService, type OcrFailure, type OcrService } from '../../../platform/ocr';
import { tPlural } from '../../../i18n/plural';
import { tImport, type ProgramImportTextKey } from '../../../i18n/programImportText';

/**
 * IMPORT-029b (§ 17.4, D-200) : lecture d'une photo ou d'une capture du programme par la façade OCR existante (Vision sur l'iPhone,
 * Windows.Media.Ocr sur le PC, mêmes commandes Rust). L'image est choisie par le sélecteur du navigateur intégré, réduite en mémoire (côté le
 * plus grand ≤ 2 000 px, JPEG) puis lue ; elle n'est jamais enregistrée ni envoyée. Les lignes lues s'ajoutent au texte, que l'analyseur
 * de lignes lit ensuite comme un collage. Sans moteur (navigateur) : « disponible sur iPhone et sur PC ». Le PDF n'est pas lu (reporté).
 */

export interface PhotoReaderProps {
  readonly onLines: (lines: readonly string[]) => void;
  readonly onStatus: (message: string | null) => void;
  /** Moteurs de lecture ; par défaut ceux de l'appareil (`openOcrService`). */
  readonly open?: () => OcrService;
}

/** Côté le plus grand de l'image transmise au moteur (Windows.Media.Ocr refuse les images trop grandes). */
export const IMPORT_IMAGE_MAX_EDGE_PX = 2000;

const FAILURE_KEYS: Readonly<Record<OcrFailure, ProgramImportTextKey>> = {
  'language-missing': 'ocr_language-missing',
  'unsupported-format': 'ocr_unsupported-format',
  'too-large': 'ocr_too-large',
  dimensions: 'ocr_dimensions',
  unavailable: 'ocr_unavailable',
  timeout: 'ocr_timeout',
  busy: 'ocr_busy',
  failed: 'ocr_failed',
};

/** Image réduite en JPEG ; image d'origine si le navigateur ne sait pas la décoder (le moteur dira alors s'il la lit). */
async function reduced(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
      const scale = Math.min(1, IMPORT_IMAGE_MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
      if (scale === 1 && file.type === 'image/jpeg') return file;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) return file;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', 0.9));
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}

export function PhotoReader({ onLines, onStatus, open }: PhotoReaderProps) {
  const service = useMemo(() => (open ?? openOcrService)(), [open]);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  useEffect(
    () => () => {
      void service.dispose();
    },
    [service],
  );

  const engine = service.primary;
  if (!engine) {
    return (
      <div className="ct-import__photo">
        <p className="ct-training__muted">{tImport('photoUnavailable')}</p>
        <p className="ct-training__muted">{tImport('pdfLater')}</p>
      </div>
    );
  }

  const read = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    setBusy(true);
    onStatus(tImport('photoReading'));
    try {
      const status = await engine.status();
      if (!status.available) {
        onStatus(tImport(status.reason === 'language-missing' ? 'photoLanguage' : 'photoUnavailable'));
        return;
      }
      const result = await engine.recognize(await reduced(file), { lang: 'fra' });
      const lines = result.lines.map((line) => line.text.trim()).filter((line) => line !== '');
      if (lines.length === 0) {
        onStatus(tImport('photoNone'));
        return;
      }
      onLines(lines);
      const done = tPlural(tImport, lines.length, 'photoDoneOne', 'photoDone');
      onStatus(result.truncated === true ? `${done} ${tImport('photoTruncated')}` : done);
    } catch (error) {
      const reason = tImport(FAILURE_KEYS[error instanceof OcrError ? error.reason : 'failed']);
      onStatus(error instanceof OcrError && error.code !== undefined ? tImport('photoFailedCode', { reason, code: error.code }) : tImport('photoFailed', { reason }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ct-import__photo">
      <input id={inputId} className="ct-visually-hidden" type="file" accept="image/*" disabled={busy} onChange={(event) => void read(event)} />
      <label htmlFor={inputId} className="ct-button ct-button--secondary ct-import__photo-button" aria-disabled={busy || undefined}>
        {tImport('photo')}
      </label>
      <p className="ct-training__muted">{tImport('pdfLater')}</p>
    </div>
  );
}
