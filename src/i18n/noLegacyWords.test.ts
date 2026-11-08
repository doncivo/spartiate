import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Clôture I0 (0.1.6) : Spartiate n'a ni tâche, ni rappel, ni Focus, ni routine, ni checklist (restes de l’ancien projet). Aucun texte AFFICHÉ par
 * les écrans livrés ne doit les nommer : « Tes tâches ne sont pas supprimées » (Repartir de zéro) était faux. Le test lit les littéraux des
 * catalogues vivants (commentaires retirés, comme `tutoiement.test.ts`).
 *
 * Exemptés, avec leur raison : les catalogues d'écrans retirés par SPA-001b (focus, routines, checklists, événements, espaces, objectifs,
 * stats, capture, scan, import CSV, agendas, Rappels Apple, notifications de rappels, onboarding hérité), les noms de types de lignes
 * du banc de test de synchro legacy (D-67 : `fr.syncField`, `fr.syncVersion`, `fr.syncCarryReport`) et les sections de `fr.ts` qui ne servent
 * qu'à eux. La liste ne peut que se réduire.
 */
// I1-01 : « routine » redevient un mot légitime avec l'entraînement (routines de séances, PRD § 14) ; il quitte la liste. Tâches, rappels,
// Focus et checklists restent des restes de l'ancien projet.
const BANNED = /\b(tâches?|rappels?|focus|checklists?)\b/i;
const LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
const strip = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Nom de l'app d'Apple (pas un reste de l’ancien projet) : fictif `apple-reminders` du journal des conflits. */
const ALLOWED = new Set(['Rappels Apple']);

function offenders(file: string, source: string): string[] {
  const found: string[] = [];
  for (const match of strip(source).matchAll(LITERAL)) {
    const text = match[1] ?? match[2] ?? match[3] ?? '';
    if (/\s/.test(text) && !ALLOWED.has(text) && BANNED.test(text)) found.push(`${file} : ${text.slice(0, 100)}`);
  }
  return found;
}

/** Catalogues vivants : textes des écrans livrés (Aujourd'hui, Profil et poids, Plus, Synchronisation, Apple Santé, minuteur, journal…). */
const LIVE_CATALOGS = [
  'fr.training.ts',
  'fr.progression.ts',
  'fr.trainingGeneration.ts',
  'fr.body.ts',
  'fr.health.ts',
  'fr.today.ts',
  'fr.timer.ts',
  'fr.logs.ts',
  'fr.exportImport.ts',
  'fr.startupBlocked.ts',
  'plusText.ts',
  'settingsRefonteText.ts',
  'syncRefonteText.ts',
  'fr.syncEngine.ts',
  'fr.syncConflicts.ts',
  'fr.syncReset.ts',
  'fr.syncFolder.ts',
  'fr.syncForget.ts',
  'fr.syncOwnDeletion.ts',
  'fr.syncPairing.ts',
  'fr.syncPublishCause.ts',
  'fr.syncRestore.ts',
  'fr.signing.ts',
  'fr.security.ts',
  'fr.backup.ts',
  'fr.backupRestore.ts',
  'fr.appearance.ts',
  'fr.appUpdate.ts',
  'fr.appUpdateRestore.ts',
];

/** Sections vivantes de `fr.ts` (le reste est l'héritage des écrans retirés). */
const LIVE_FR_SECTIONS = ['app', 'common', 'files', 'nav', 'settings', 'desktop', 'updater', 'status'];

function sectionsOfFr(): Map<string, string> {
  const lines = read('./fr.ts').split('\n');
  const sections = new Map<string, string>();
  let name: string | null = null;
  for (const line of lines) {
    const head = /^ {2}([a-zA-Z]+): \{/.exec(line);
    if (head) name = head[1] ?? null;
    if (name) sections.set(name, `${sections.get(name) ?? ''}${line}\n`);
  }
  return sections;
}

describe('plus aucun reste de l’ancien projet dans les textes affichés (0.1.6)', () => {
  it.each(LIVE_CATALOGS)('%s', (file) => {
    expect(offenders(file, read(`./${file}`))).toEqual([]);
  });

  it('sections vivantes de fr.ts : app, common, files, nav, settings, desktop, updater, status', () => {
    const sections = sectionsOfFr();
    const found: string[] = [];
    for (const name of LIVE_FR_SECTIONS) {
      expect(sections.has(name), name).toBe(true);
      found.push(...offenders(`fr.ts › ${name}`, sections.get(name) ?? ''));
    }
    expect(found).toEqual([]);
  });

  it('le mot du bouton « Repartir de zéro » : « Tes données ne sont pas supprimées »', () => {
    expect(read('./syncRefonteText.ts')).toContain('Tes données ne sont pas supprimées.');
  });
});
