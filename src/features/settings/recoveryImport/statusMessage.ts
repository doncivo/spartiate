import { tHealth } from '../../../i18n/healthText';
import type { ImportRunResult } from './service';

/**
 * Phrase française de l'issue d'un lancement d'import (I5-04 point 1) : aucun statut n'est silencieux. Ni valeur ni nom de fichier de l'utilisateur,
 * seulement des comptes.
 */
export function importStatusMessage(result: ImportRunResult): string {
  switch (result.status) {
    case 'unsupported':
      return tHealth('recUnsupported');
    case 'needs-pick':
      return tHealth('recNeedsPick');
    case 'busy':
      return tHealth('recBusy');
    case 'throttled':
      return tHealth('recThrottled');
    case 'folder-unavailable':
      return tHealth('recFolderUnavailable');
    case 'cancelled':
      return tHealth('recCancelled');
    case 'done': {
      const imported = result.files.filter((f) => f.state === 'imported');
      const added = imported.reduce((sum, f) => sum + f.added, 0);
      const read =
        imported.length === 0
          ? result.files.some((f) => f.state === 'unreadable' || f.state === 'failed')
            ? tHealth('recDoneUnreadable')
            : tHealth('recDoneNone')
          : imported.length === 1
            ? tHealth('recDoneRead1', { added })
            : tHealth('recDoneReadN', { files: imported.length, added });
      if (result.recomputeFailed) return `${read} ${tHealth('recRecomputeFailed')}`;
      return result.recomputedDays > 0 ? `${read} ${tHealth('recRecomputed', { days: result.recomputedDays })}` : read;
    }
  }
}
