import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DATA-0295 (BL-003, D-67) : les réparations de l'ancien schéma CircleTasks (`routine.paused` recalculé, session Focus ouverte refermée)
 * ne servent qu'au banc legacy (`tests/fixtures/legacy-schema/repairs.ts`) : elles n'ont rien à faire dans le dépôt de synchro livré.
 * Elles vivent dans le banc, branchées sur ses repositories. Restent dans le dépôt livré, appelés par le moteur selon les règles du
 * catalogue injecté (aucune règle dans le catalogue de production) : `targetReminders` (`rules.companion`) et `deleteExternalEventsOf`
 * (`rules.dropExternalEventsOn`, et `snapshot.ts`), à purger avec CLEAN-03.
 */
const root = resolve(__dirname, '..', '..', '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');
const LEGACY_REPAIRS = ['routinePauses', 'setRoutinePaused', 'openFocusSessions', 'closeFocusSession'] as const;

describe('BL-003 : réparations de l’ancien schéma hors du dépôt de synchro livré', () => {
  it.each(['src/db/repositories/syncRepository.ts', 'src/db/repositories/sql/syncRepository.ts'])('%s ne déclare ni n’implémente les réparations legacy', (path) => {
    const source = read(path);
    for (const name of LEGACY_REPAIRS) expect(source, `${path} : ${name}`).not.toMatch(new RegExp(`\\b${name}\\s*\\(`));
    expect(source).not.toMatch(/\bFROM routine_pause\b|\bUPDATE routine SET paused\b|\bfocus_session\b/);
  });

  it('le banc legacy porte ses réparations (requêtes et appel)', () => {
    const repairs = read('tests/fixtures/legacy-schema/repairs.ts');
    for (const name of LEGACY_REPAIRS) expect(repairs, name).toMatch(new RegExp(`\\b${name}\\b`));
    expect(repairs).toMatch(/FROM routine_pause/);
  });
});
