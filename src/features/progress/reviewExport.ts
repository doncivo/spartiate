import { tWeeklyReview } from '../../i18n/weeklyReviewText';

/**
 * BILAN-029 (C-6) : export du bilan en fichier Markdown, sur l'appareil, comme l'image du résumé de séance (D-381) : feuille de partage du
 * système avec le fichier (`navigator.share`, WKWebView) si elle l'accepte, sinon téléchargement. Aucun envoi réseau, aucune API.
 */
export type ReviewShareOutcome = 'shared' | 'cancelled' | 'downloaded';

export interface ReviewShareDeps {
  readonly nav: { readonly share?: (data: ShareData) => Promise<void>; readonly canShare?: (data: ShareData) => boolean };
  readonly download: (blob: Blob, fileName: string) => void;
}

const MARKDOWN = 'text/markdown;charset=utf-8';

const defaultDeps = (): ReviewShareDeps => ({
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

export async function shareReviewText(text: string, fileName: string, deps: ReviewShareDeps = defaultDeps()): Promise<ReviewShareOutcome> {
  const blob = new Blob([text], { type: MARKDOWN });
  const data: ShareData = { files: [new File([blob], fileName, { type: MARKDOWN })], title: tWeeklyReview('title') };
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
