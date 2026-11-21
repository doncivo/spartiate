import { readFileSync } from 'node:fs';

/**
 * IMPORT-029 : programmes inventés pour l'analyseur d'import (§ 17.4). Aucun programme réel, aucune donnée d'Ali.
 */

/** Bloc JSON d'exemple du guide (`docs/guide-import-programme.md`), lu tel quel : le guide reste valide. */
export function guideJsonExample(): string {
  const guide = readFileSync('docs/guide-import-programme.md', 'utf8');
  const match = /```json\r?\n([\s\S]*?)```/.exec(guide);
  if (!match?.[1]) throw new Error('exemple JSON absent du guide');
  return match[1];
}

/** Candidats de la bibliothèque embarquée (identifiant, nom, alias), lus du JSON de contenu. */
export function libraryCandidates(): { id: string; nameFr: string; aliasesEn: string[] }[] {
  const json = JSON.parse(readFileSync('content/exercises/exercises.json', 'utf8')) as { exercises: { id: string; nameFr: string; aliasesEn?: string[] }[] };
  return json.exercises.map((e) => ({ id: e.id, nameFr: e.nameFr, aliasesEn: e.aliasesEn ?? [] }));
}

/** Lignes libres variées : titres, puces, séparateurs × x X, « séries de », RIR, repos, secondes. */
export const FREE_LINES = [
  'Jour A — Poussée',
  '1. Développé couché 4×8-10',
  '- Développé militaire à la barre : 3 x 12',
  '• Élévations latérales 4x15 RIR 2',
  'Dips : 3 séries de 10',
  '',
  'Séance 2',
  'A1) Rowing à la barre 4 X 8 RIR 1-2 repos 2 min',
  'Tirage vertical à la poulie 3 séries de 8 à 10 répétitions',
  'Planche 3 x 30 s',
  'Curl marteau 3x12 tempo 3-1-1',
].join('\n');

/** Photo d'un tableau lue en colonnes : le nom sur une ligne, le schéma sur la suivante ; RIR et repos seuls. */
export const OCR_COLUMNS = ['Séance 1', 'Squat à la barre', '4 x 6', 'RIR 2', 'Presse à cuisses', '3 x 10-12', 'repos 90 s', 'Fente bulgare', '3 x 8'].join('\n');

/** Lignes que l'analyseur ne comprend pas, chacune avec sa raison attendue. */
export const REJECTED_LINES: readonly { readonly text: string; readonly reason: string }[] = [
  { text: 'Échauffement vélo 10 min', reason: 'no-scheme' },
  { text: '3 x 12', reason: 'no-name' },
  { text: 'Squat 25 x 5', reason: 'out-of-range' },
  { text: 'Curl 3 x 12-8', reason: 'out-of-range' },
  { text: 'Rowing 4 x 8 RIR 7', reason: 'out-of-range' },
];
