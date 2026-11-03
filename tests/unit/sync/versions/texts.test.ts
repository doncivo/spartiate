import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SYNC_TABLES } from '../../../fixtures/legacy-schema/catalogue';
import { failureKinds } from '../../../../src/features/sync/syncText';
import { syncEngineFr } from '../../../../src/i18n/fr.syncEngine';
import { syncVersionFr } from '../../../../src/i18n/fr.syncVersion';

/** Y-07 critère 12 : textes dans src/i18n (français seul), aucun texte en dur (journaux sans contenu : twoVersions.test.ts, applyRecette.test.ts). */

const vars = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort();

type Tree = { readonly [key: string]: string | Tree };
const flatten = (tree: Tree, prefix = ''): Map<string, string> =>
  new Map(Object.entries(tree).flatMap(([key, value]) => (typeof value === 'string' ? [[`${prefix}${key}`, value] as const] : [...flatten(value, `${prefix}${key}.`)])));

describe('textes (Y-07 critère 12)', () => {
  it('sync.version : aucun texte français vide ; la ligne nommant l’appareil porte la variable device', () => {
    for (const [key, text] of flatten(syncVersionFr)) expect(text.trim(), key).not.toBe('');
    expect(vars(syncEngineFr.status.updateRequiredDevice)).toEqual(['device']);
  });

  it('chaque table du catalogue a son libellé de type d’élément (échec de réintégration)', () => {
    for (const table of SYNC_TABLES) expect(failureKinds([table.name]), table.name).not.toBe(syncVersionFr.kinds.other);
    expect(failureKinds(['future_table'])).toBe(syncVersionFr.kinds.other);
    expect(failureKinds(['task', 'event', 'task'])).toBe('tâches, événements');
  });

  it('aucun texte en dur dans le composant de version ni dans le bandeau', () => {
    for (const file of ['../../../../src/features/sync/SyncDetailsVersion.tsx', '../../../../src/features/app/AppStatusBanner.tsx']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const literals = [...source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map((m) => m[2] ?? '');
      expect(literals.length, file).toBeGreaterThan(0);
      for (const text of literals) expect(text, `${file} : ${text}`).not.toMatch(/[àâäéèêëîïôöùûüçœ’«»]/i);
      expect(source, file).not.toMatch(/>\s*[A-ZÉ][a-zéèêàç]+[^<{]*</);
    }
  });
});
