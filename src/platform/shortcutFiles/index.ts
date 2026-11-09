import { decodeTextBytes } from '../../domain/textEncoding';
import type { OsFamily, Runtime } from '../runtime';

/**
 * Lecture des fichiers écrits par l'app Raccourcis dans iCloud Drive › Spartiate-sante (D-69, I5-01 point 1.3) : `hrv.csv`,
 * `fc-repos.csv`, `sommeil.csv`, `pas.csv`. Façade seule : le service d'import (`features/settings/recoveryImport`) ne connaît que ce contrat.
 *
 * Trois lecteurs possibles :
 * - `unsupported` (PC, navigateur) : ne lit rien, l'écran dit « iPhone seulement » ;
 * - `picker` (iPhone, livré) : sélecteur de fichiers du système (`<input type="file" multiple>`, aucun code Swift). iOS fournit alors lui-même
 *   une copie locale du fichier iCloud (téléchargement forcé par le sélecteur) ; il exige un geste de l'utilisateur, donc `automatic` est
 *   faux : l'ouverture de l'app ne lit rien ;
 * - `folder` (H-26, NON LIVRÉ) : lecteur automatique par marque-page de sécurité du dossier Spartiate-sante (plugin Swift à écrire). Contrat :
 *   `automatic: true`, téléchargement forcé de chaque fichier iCloud avant lecture (coordination de fichier), « absent » si le dossier ou le
 *   fichier manque, jamais un chemin dans la WebView.
 */

export const SHORTCUT_FILE_NAMES = ['hrv.csv', 'fc-repos.csv', 'sommeil.csv', 'pas.csv'] as const;
export type ShortcutFileName = (typeof SHORTCUT_FILE_NAMES)[number];

export type ShortcutFileRead =
  | { readonly name: ShortcutFileName; readonly state: 'ok'; readonly text: string }
  | { readonly name: ShortcutFileName; readonly state: 'absent' }
  | { readonly name: ShortcutFileName; readonly state: 'unreadable' };

export interface ShortcutFilesReader {
  readonly kind: 'unsupported' | 'picker' | 'folder';
  /** Lecture possible sans geste de l'utilisateur (à l'ouverture de l'app). */
  readonly automatic: boolean;
  /** Un résultat par nom demandé, dans l'ordre ; `null` : l'utilisateur a annulé (ou lecteur non pris en charge). Ne rejette pas pour un fichier seul. */
  read(names: readonly ShortcutFileName[]): Promise<readonly ShortcutFileRead[] | null>;
}

/** Taille maximale d'un fichier lu (2 Mio : 10 000 lignes en tiennent largement). */
export const SHORTCUT_FILE_MAX_BYTES = 2 * 1024 * 1024;

export function createUnsupportedShortcutFiles(): ShortcutFilesReader {
  return { kind: 'unsupported', automatic: false, read: () => Promise.resolve(null) };
}

/** Sélecteur du système, plusieurs fichiers ; `null` si l'utilisateur annule. */
function pickFilesFromInput(): Promise<readonly File[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.csv,.txt,text/csv,text/plain';
    input.addEventListener('change', () => resolve(input.files && input.files.length > 0 ? Array.from(input.files) : null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

export function createPickerShortcutFiles(pick: () => Promise<readonly File[] | null> = pickFilesFromInput): ShortcutFilesReader {
  return {
    kind: 'picker',
    automatic: false,
    async read(names) {
      const files = await pick();
      if (files === null) return null;
      const byName = new Map<string, File>();
      for (const file of files) byName.set(file.name.toLowerCase(), file);
      const reads: ShortcutFileRead[] = [];
      for (const name of names) {
        const file = byName.get(name);
        if (file === undefined) {
          reads.push({ name, state: 'absent' });
          continue;
        }
        if (file.size > SHORTCUT_FILE_MAX_BYTES) {
          reads.push({ name, state: 'unreadable' });
          continue;
        }
        try {
          reads.push({ name, state: 'ok', text: decodeTextBytes(new Uint8Array(await file.arrayBuffer())) });
        } catch {
          reads.push({ name, state: 'unreadable' });
        }
      }
      return reads;
    },
  };
}

export function openShortcutFiles(runtime: Runtime, os: OsFamily): ShortcutFilesReader {
  return runtime === 'tauri' && os === 'ios' ? createPickerShortcutFiles() : createUnsupportedShortcutFiles();
}
