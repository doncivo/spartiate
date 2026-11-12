import { BODY_FILE_NAMES, type BodyFileName } from '../../domain/health/bodyShortcutFiles';
import { decodeTextBytes } from '../../domain/textEncoding';
import type { OsFamily, Runtime } from '../runtime';

/**
 * Lecture des fichiers écrits par l'app Raccourcis dans iCloud Drive › Spartiate › sante (D-69, D-90, I5-03 point 1) : `hrv.csv`,
 * `fc-repos.csv`, `sommeil.csv`, `pas.csv`, et (I6-04, D-113) les dix fichiers Renpho / Santé (`BODY_FILE_NAMES` : poids, masse grasse, masse maigre, tour de taille, taille,
 * énergie, protéines, glucides, lipides, fibres) : quatorze noms exacts, jamais un autre. Façade seule : le service d'import (`features/settings/recoveryImport`) ne connaît que ce contrat.
 *
 * Trois lecteurs possibles :
 * - `unsupported` (PC, navigateur) : ne lit rien, l'écran dit « iPhone seulement » ;
 * - `folder` (iPhone, I5-03, H-26 UNVERIFIED jusqu'au constat d'Ali) : lecteur automatique. Il appelle la commande Rust `health_files_read`, qui
 *   lit `sante/` par le marque-page de sécurité déjà obtenu pour la synchro (aucun nouveau Swift) : téléchargement forcé de chaque fichier iCloud
 *   avant lecture, « absent » si le dossier ou le fichier manque, jamais un chemin dans la WebView. Dossier de synchro non lié ou injoignable :
 *   `ShortcutFolderError`. Lecture seule : la commande n'écrit, ne renomme ni ne supprime rien, et la synchro ne voit jamais `sante/` ;
 * - `picker` (iPhone, secours) : sélecteur de fichiers du système (`<input type="file" multiple>`). iOS fournit alors lui-même une copie locale du
 *   fichier iCloud ; il exige un geste de l'utilisateur, donc `automatic` est faux.
 */

export const SHORTCUT_FILE_NAMES = ['hrv.csv', 'fc-repos.csv', 'sommeil.csv', 'pas.csv'] as const;
export type ShortcutFileName = (typeof SHORTCUT_FILE_NAMES)[number];
/** La liste blanche entière (quatorze noms) : la commande Rust `health_files_read` refuse tout autre nom. */
export const ALL_SHORTCUT_FILE_NAMES = [...SHORTCUT_FILE_NAMES, ...BODY_FILE_NAMES] as const;
export type AnyShortcutFileName = ShortcutFileName | BodyFileName;

/** Dossier de synchro non lié (`not-configured`), injoignable (`unreachable`) ou lecture en échec (`failed`) ; jamais un chemin ni le texte de l'erreur. */
export type ShortcutFolderErrorCode = 'not-configured' | 'unreachable' | 'failed';

export class ShortcutFolderError extends Error {
  readonly code: ShortcutFolderErrorCode;
  constructor(code: ShortcutFolderErrorCode) {
    super(`shortcut-folder:${code}`);
    this.name = 'ShortcutFolderError';
    this.code = code;
  }
}

/** `size` : taille en octets quand elle est connue ; `cloud` : fichier présent mais pas encore téléchargé (diagnostic, I5-04). */
export type ShortcutFileRead =
  | { readonly name: AnyShortcutFileName; readonly state: 'ok'; readonly text: string; readonly size?: number }
  | { readonly name: AnyShortcutFileName; readonly state: 'absent' }
  | { readonly name: AnyShortcutFileName; readonly state: 'unreadable'; readonly cloud?: true; readonly size?: number };

/** Diagnostic du dossier lu au dernier appel (I5-04) : booléens et comptes seulement, jamais un nom ni un chemin. */
export interface ShortcutFolderProbe {
  readonly rootListed: boolean;
  readonly santePresent: boolean;
  /** Les entrées de `sante` ont pu être listées (faux : présent mais illisible pour l'instant, ou absent). */
  readonly santeListed: boolean;
  /** `devices` existe sous la même racine : la racine liée est bien celle de la synchro. */
  readonly devicesPresent: boolean;
  readonly rootEntries: number;
  readonly santeEntries: number;
  /** I5-05 : `sante` était un substitut iCloud (listé comme un fichier dans le nuage) et son téléchargement a été demandé. */
  readonly santeHydrated: boolean;
  /** I5-06 : raison, en code fixe, de l'échec de liste de `sante` : vide, `not-found`, `unsafe-name` (nom refusé par la garde de chemin), `cloud`, `io`. */
  readonly santeListError: ShortcutSanteListError;
  /** I5-05 : une entrée de la racine liée, par ordre de listage, en codes fixes (jamais un nom). */
  readonly rootProbe: readonly ShortcutRootEntryProbe[];
}

/** Une entrée de la racine liée : dossier ou non, disponibilité, égalités de nom (`devices`, `sante` exact, `sante` normalisé). */
export type ShortcutSanteListError = '' | 'not-found' | 'unsafe-name' | 'cloud' | 'io';

export interface ShortcutRootEntryProbe {
  readonly isDir: boolean;
  readonly availability: 'local' | 'cloud' | 'error';
  readonly eqDevices: boolean;
  readonly eqSanteExact: boolean;
  readonly eqSanteFolded: boolean;
}

export interface ShortcutFilesReader {
  readonly kind: 'unsupported' | 'picker' | 'folder';
  /** Lecture possible sans geste de l'utilisateur (à l'ouverture de l'app). */
  readonly automatic: boolean;
  /** Un résultat par nom demandé, dans l'ordre ; `null` : l'utilisateur a annulé (ou lecteur non pris en charge). Ne rejette pas pour un fichier seul. */
  read(names: readonly AnyShortcutFileName[]): Promise<readonly ShortcutFileRead[] | null>;
  /** Diagnostic du dossier au dernier `read` (lecteur de dossier seulement) ; `null` avant la première lecture. */
  probe?(): ShortcutFolderProbe | null;
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
          // I5-05 point 5 : la taille réelle du fichier choisi, pour le diagnostic (jamais 0).
          reads.push({ name, state: 'ok', text: decodeTextBytes(new Uint8Array(await file.arrayBuffer())), size: file.size });
        } catch {
          reads.push({ name, state: 'unreadable' });
        }
      }
      return reads;
    },
  };
}

/** Appel de la commande Rust (injectable pour les tests) ; `invoke` de Tauri chargé à la demande. */
export type FolderInvoker = (command: 'health_files_read', args: { readonly names: readonly string[] }) => Promise<unknown>;

const tauriInvoker: FolderInvoker = async (command, args) => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(command, { names: [...args.names] });
};

function folderErrorCode(error: unknown): ShortcutFolderErrorCode {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  if (code === 'not-configured') return 'not-configured';
  if (code === 'folder-unreachable' || code === 'unsafe-folder' || code === 'not-local' || code === 'cloud-pending' || code === 'cloud-provider-stopped' || code === 'cloud-error') return 'unreachable';
  return 'failed';
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const count = (value: unknown): number => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0);
const sizeOf = (value: unknown): { readonly size: number } | Record<string, never> => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? { size: value } : {});

const listErrorOf = (value: unknown): ShortcutSanteListError => (value === undefined || value === '' ? '' : value === 'not-found' || value === 'unsafe-name' || value === 'cloud' ? value : 'io');

function probeOf(raw: unknown): ShortcutFolderProbe | null {
  const folder = typeof raw === 'object' && raw !== null ? (raw as { folder?: unknown }).folder : undefined;
  if (typeof folder !== 'object' || folder === null) return null;
  const f = folder as Record<string, unknown>;
  const entries = Array.isArray(f.rootProbe) ? (f.rootProbe as unknown[]) : [];
  const rootProbe = entries.flatMap((raw): ShortcutRootEntryProbe[] => {
    if (typeof raw !== 'object' || raw === null) return [];
    const e = raw as Record<string, unknown>;
    // Que des codes : tout autre champ (un nom, par exemple) est ignoré.
    const availability = e.availability === 'local' || e.availability === 'cloud' ? e.availability : 'error';
    return [{ isDir: e.isDir === true, availability, eqDevices: e.eqDevices === true, eqSanteExact: e.eqSanteExact === true, eqSanteFolded: e.eqSanteFolded === true }];
  });
  return {
    rootListed: f.rootListed === true,
    santePresent: f.santePresent === true,
    santeListed: f.santeListed === true,
    devicesPresent: f.devicesPresent === true,
    rootEntries: count(f.rootEntries),
    santeEntries: count(f.santeEntries),
    santeHydrated: f.santeHydrated === true,
    santeListError: listErrorOf(f.santeListError),
    rootProbe,
  };
}

export function createFolderShortcutFiles(invoke: FolderInvoker = tauriInvoker): ShortcutFilesReader {
  let last: ShortcutFolderProbe | null = null;
  return {
    kind: 'folder',
    automatic: true,
    probe: () => last,
    async read(names) {
      const wanted = names.filter((name) => (ALL_SHORTCUT_FILE_NAMES as readonly string[]).includes(name));
      let raw: unknown;
      try {
        raw = await invoke('health_files_read', { names: wanted });
      } catch (error) {
        throw new ShortcutFolderError(folderErrorCode(error));
      }
      last = probeOf(raw);
      const list = typeof raw === 'object' && raw !== null ? (raw as { files?: unknown }).files : undefined;
      const byName = new Map<string, { state?: unknown; bytes?: unknown; size?: unknown }>();
      if (Array.isArray(list)) {
        for (const entry of list as { name?: unknown; state?: unknown; bytes?: unknown; size?: unknown }[]) {
          if (typeof entry === 'object' && entry !== null && typeof entry.name === 'string') byName.set(entry.name, entry);
        }
      }
      return wanted.map((name): ShortcutFileRead => {
        const entry = byName.get(name);
        if (entry?.state === 'absent') return { name, state: 'absent' };
        if (entry?.state === 'cloud') return { name, state: 'unreadable', cloud: true, ...sizeOf(entry.size) };
        if (entry?.state === 'ok' && typeof entry.bytes === 'string') {
          try {
            return { name, state: 'ok', text: decodeTextBytes(decodeBase64(entry.bytes)), ...sizeOf(entry.size) };
          } catch {
            return { name, state: 'unreadable' };
          }
        }
        return { name, state: 'unreadable', ...(entry?.state === 'unreadable' ? sizeOf(entry.size) : {}) };
      });
    },
  };
}

/** Lecteur principal : dossier automatique sur iPhone, rien ailleurs. */
export function openShortcutFiles(runtime: Runtime, os: OsFamily): ShortcutFilesReader {
  return runtime === 'tauri' && os === 'ios' ? createFolderShortcutFiles() : createUnsupportedShortcutFiles();
}

/** Secours : sélecteur de fichiers du système, iPhone seulement. */
export function openShortcutPicker(runtime: Runtime, os: OsFamily): ShortcutFilesReader {
  return runtime === 'tauri' && os === 'ios' ? createPickerShortcutFiles() : createUnsupportedShortcutFiles();
}
