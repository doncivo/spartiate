import { useId, useState, type ChangeEvent } from 'react';
import { PDF_IMPORT_LIMITS, pdfPagesToImportText, pdfSizeRefusal, type PdfRefusal } from '../../../domain/training/pdfImport';
import { tPlural } from '../../../i18n/plural';
import { tPdfImport, type PdfImportPlainKey } from '../../../i18n/pdfImportText';
import { extractPdfText, type ExtractPdfText } from '../../../platform/pdf';

/**
 * IMPORT-0303 (D-676) : « Lire un PDF » dans l'import de programme. Bloc à la demande importé par `ProgramImportView` ; il porte la façade
 * `src/platform/pdf` et son catalogue de textes, et la façade ne charge pdf.js qu'à la première lecture. Le fichier est choisi par le
 * sélecteur du navigateur intégré, sa taille vérifiée avant d'en lire les octets, puis le texte de chaque page est extrait localement ;
 * les lignes s'ajoutent au texte, que l'analyseur lit ensuite comme un collage. Les octets ne sont jamais enregistrés. Chaque refus
 * (trop lourd, trop long, protégé, illisible, scanné, lecture indisponible) est dit, le texte reste inchangé.
 */

export interface PdfReaderProps {
  /** Ajoute les lignes au texte ; faux si elles sont refusées (texte trop long : la vue l'a dit, aucun autre message). */
  readonly onLines: (lines: readonly string[]) => boolean;
  readonly onStatus: (message: string | null) => void;
  /** Lecture du texte ; par défaut la façade de l'appareil (`extractPdfText`). */
  readonly read?: ExtractPdfText;
}

const REFUSAL_KEYS: Readonly<Record<PdfRefusal, PdfImportPlainKey>> = {
  'too-large': 'pdf_too-large',
  'too-many-pages': 'pdf_too-many-pages',
  encrypted: 'pdf_encrypted',
  invalid: 'pdf_invalid',
  'no-text': 'pdf_no-text',
  unsupported: 'pdf_unsupported',
  timeout: 'pdf_timeout',
};

export function PdfReader({ onLines, onStatus, read = extractPdfText }: PdfReaderProps) {
  const [busy, setBusy] = useState(false);
  const inputId = useId();

  const choose = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    const tooBig = pdfSizeRefusal(file.size, PDF_IMPORT_LIMITS);
    if (tooBig !== null) {
      onStatus(tPdfImport(REFUSAL_KEYS[tooBig]));
      return;
    }
    setBusy(true);
    onStatus(tPdfImport('pdfReading'));
    try {
      const result = await read(new Uint8Array(await file.arrayBuffer()), PDF_IMPORT_LIMITS);
      if ('reason' in result) {
        onStatus(tPdfImport(REFUSAL_KEYS[result.reason]));
        return;
      }
      const lines = pdfPagesToImportText(result.pages).split('\n').filter((line) => line !== '');
      if (!onLines(lines)) return;
      onStatus(tPlural(tPdfImport, lines.length, 'pdfDoneOne', 'pdfDone', { pages: result.pages.length }));
    } catch {
      // La façade ne rejette pas ; la lecture du fichier par le navigateur, elle, peut échouer : dit, jamais silencieux.
      onStatus(tPdfImport('pdf_invalid'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ct-import__photo">
      <input id={inputId} className="ct-visually-hidden" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(event) => void choose(event)} />
      <label htmlFor={inputId} className="ct-button ct-button--secondary ct-import__photo-button" aria-disabled={busy || undefined}>
        {tPdfImport('pdf')}
      </label>
      <p className="ct-training__muted">{tPdfImport('pdfPrivacy')}</p>
    </div>
  );
}
