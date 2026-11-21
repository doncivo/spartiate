import { formatClock, formatDay, formatVolume } from '../../../i18n/trainingText';
import { tSession } from '../../../i18n/trainingSessionText';

/**
 * SESS-01e (§ 13.5 « image partageable ») : carte du résumé dessinée LOCALEMENT sur un canvas, puis partagée par la feuille du système
 * (`navigator.share` avec fichier, WKWebView) ou téléchargée. Aucune donnée corporelle : la carte ne reçoit que le nom, la date, la durée, les
 * séries, le volume et les records de la séance (ni poids du corps, ni FC, ni sommeil). Aucun envoi réseau. Couleurs lues des jetons du thème.
 */

export interface SummaryCardInput {
  readonly name: string;
  readonly endedAt: string;
  readonly durationSec: number | null;
  readonly workSets: number;
  readonly volumeKg: number;
  readonly records: readonly { readonly exerciseName: string; readonly text: string }[];
}

export interface SummaryCard {
  readonly title: string;
  readonly date: string;
  readonly lines: readonly string[];
}

const MAX_RECORDS = 4;

export function summaryCard(input: SummaryCardInput): SummaryCard {
  const lines: string[] = [];
  if (input.durationSec !== null) lines.push(tSession('shareDuration', { value: formatClock(input.durationSec * 1000) }));
  lines.push(tSession('shareSets', { n: input.workSets }));
  lines.push(tSession('shareVolume', { value: formatVolume(input.volumeKg) }));
  for (const r of input.records.slice(0, MAX_RECORDS)) lines.push(tSession('shareRecord', { name: r.exerciseName, text: r.text }));
  return { title: input.name, date: formatDay(input.endedAt), lines };
}

export interface RenderDeps {
  readonly createCanvas: () => HTMLCanvasElement;
  /** Valeur d'un jeton CSS (`--ct-color-…`). */
  readonly token: (name: string) => string;
}

const defaultDeps = (): RenderDeps => ({
  createCanvas: () => document.createElement('canvas'),
  token: (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
});

const SIZE = 1080;
const MARGIN = 80;

/** PNG de la carte ; null si le canvas est indisponible (l'écran le dit). */
export async function renderSummaryImage(card: SummaryCard, deps: RenderDeps = defaultDeps()): Promise<Blob | null> {
  const canvas = deps.createCanvas();
  const ctx = canvas.getContext('2d');
  if (ctx === null) return null;
  canvas.width = SIZE;
  canvas.height = SIZE;
  ctx.fillStyle = deps.token('--ct-color-surface');
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = deps.token('--ct-color-accent');
  ctx.fillRect(0, 0, SIZE, 16);
  ctx.textBaseline = 'top';
  ctx.fillStyle = deps.token('--ct-color-text-secondary');
  ctx.font = '600 36px sans-serif';
  ctx.fillText(tSession('shareBrand'), MARGIN, MARGIN);
  ctx.fillStyle = deps.token('--ct-color-text');
  ctx.font = '700 72px sans-serif';
  ctx.fillText(card.title === '' ? tSession('shareFree') : card.title, MARGIN, MARGIN + 70);
  ctx.fillStyle = deps.token('--ct-color-text-secondary');
  ctx.font = '400 40px sans-serif';
  ctx.fillText(card.date, MARGIN, MARGIN + 170);
  ctx.fillStyle = deps.token('--ct-color-text');
  ctx.font = '500 48px sans-serif';
  card.lines.forEach((line, i) => ctx.fillText(line, MARGIN, MARGIN + 290 + i * 80, SIZE - 2 * MARGIN));
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded';

export interface ShareDeps {
  readonly nav: { readonly share?: (data: ShareData) => Promise<void>; readonly canShare?: (data: ShareData) => boolean };
  readonly download: (blob: Blob, fileName: string) => void;
}

const defaultShareDeps = (): ShareDeps => ({
  nav: navigator,
  download: (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  },
});

/** Feuille de partage avec le fichier si elle l'accepte ; annulation : `cancelled` ; sinon (absente, refus) : téléchargement. */
export async function shareSummaryImage(blob: Blob, fileName: string, deps: ShareDeps = defaultShareDeps()): Promise<ShareOutcome> {
  const file = new File([blob], fileName, { type: 'image/png' });
  const data: ShareData = { files: [file], title: tSession('shareTitle') };
  const { share, canShare } = deps.nav;
  if (typeof share === 'function' && typeof canShare === 'function' && canShare.call(deps.nav, data)) {
    try {
      await share.call(deps.nav, data);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  deps.download(blob, fileName);
  return 'downloaded';
}
