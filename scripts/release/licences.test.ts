import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- script Node sans déclaration de types (module .mjs)
import { BEGIN, END, block } from './licences-npm.mjs';

/** FIX-0272 (A-003) : docs/licences.md liste chaque dépendance npm livrée, avec la version et la licence du verrou. */
const root = resolve(import.meta.dirname, '..', '..');

describe('docs/licences.md : dépendances npm livrées', () => {
  it('le bloc généré correspond à package.json et package-lock.json (react-dom, zustand compris)', () => {
    const doc = readFileSync(resolve(root, 'docs/licences.md'), 'utf8');
    const start = doc.indexOf(BEGIN as string);
    const end = doc.indexOf(END as string);
    expect(start, 'bloc absent : lancer node scripts/release/licences-npm.mjs').toBeGreaterThanOrEqual(0);
    expect(doc.slice(start, end + (END as string).length)).toBe((block as (r: string) => string)(root));
    for (const name of ['react', 'react-dom', 'zustand']) expect(doc).toContain(`| \`${name}\` |`);
  });
});
