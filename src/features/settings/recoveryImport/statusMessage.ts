import { tPlural } from '../../../i18n/plural';
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
      // BL-172 (D-664) : un fichier refusé faute de saut de ligne final est toujours dit, avec ce qu'il faut modifier dans le raccourci ;
      // seul (rien d'importé, rien en échec ni illisible), il remplace « aucun fichier trouvé », qui serait faux.
      const refused = result.files.some((f) => f.state === 'unterminated') ? tHealth('recDoneUnterminated') : null;
      const read =
        imported.length === 0
          ? result.files.some((f) => f.state === 'failed')
            ? tHealth('recDoneFailed')
            : result.files.some((f) => f.state === 'unreadable')
              ? tHealth(result.folderIssue === 'unsafe-name' ? 'recDoneUnreadableName' : 'recDoneUnreadable')
              : refused ?? tHealth('recDoneNone')
          : tPlural(tHealth, imported.length, 'recDoneRead1', 'recDoneReadN', { files: imported.length, added });
      const head = refused === null || read === refused ? read : `${read} ${refused}`;
      if (result.recomputeFailed) return `${head} ${tHealth('recRecomputeFailed')}`;
      return result.recomputedDays > 0 ? `${head} ${tPlural(tHealth, result.recomputedDays, 'recRecomputedOne', 'recRecomputed', { days: result.recomputedDays })}` : head;
    }
  }
}
