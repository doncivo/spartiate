import { programImportFr } from './fr.programImport';

/** Textes de l'import de programme (IMPORT-029) ; importé seulement par le bloc à la demande `ProgramImportView`. */
export type ProgramImportTextKey = keyof typeof programImportFr;

export function tImport(key: ProgramImportTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = programImportFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
