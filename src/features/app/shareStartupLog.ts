import { tStartupBlocked } from '../../i18n/fr.startupBlocked';
import { currentLogJournal } from '../../platform/desktop/log';
import type { ShareOutcome } from './StartupBlocked';
import { startupTracker, type StartupTracker } from './startupSteps';

/** Texte partagé : durées des étapes puis entrées du journal technique, déjà assainies (codes, compteurs, identifiants techniques). */
export async function startupLogText(tracker: StartupTracker = startupTracker): Promise<string> {
  const lines = tracker.history().map((step) => `étape ${step.name} ${String(step.ms)} ms`);
  const open = tracker.current();
  if (open) lines.push(`étape ${open.name} en cours`);
  const journal = currentLogJournal();
  if (journal) {
    try {
      for (const entry of await journal.read(200)) lines.push(`${entry.at} ${entry.scope} ${entry.code}${entry.detail ? ` ${entry.detail}` : ''}`);
    } catch {
      lines.push('journal illisible');
    }
  }
  return lines.join('\n');
}

/** Feuille de partage du système (WKWebView : `navigator.share`) ; annulation par l'utilisateur : ni erreur ni message. */
export async function shareStartupLog(tracker: StartupTracker = startupTracker, nav: Pick<Navigator, 'share'> = navigator): Promise<ShareOutcome> {
  if (typeof nav.share !== 'function') return 'failed';
  const text = await startupLogText(tracker);
  try {
    await nav.share({ title: tStartupBlocked('shareTitle'), text });
    return 'shared';
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}
