import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CLEAN-0296 (C-085) : traducteurs `*Text.ts` aux paramètres libres (`Record<string, …>`), à passer à `catalogText`
 * (src/i18n/catalogText.ts, D-638), qui type les paramètres `{x}` depuis le texte français. La liste figée
 * (tests/untyped-translators.json) est exacte dans les deux sens : un traducteur nouveau aux paramètres libres est refusé, un traducteur
 * migré doit en sortir. Elle ne peut que décroître : jamais au-dessus du relevé de main avant CLEAN-0296.
 */
const root = resolve(__dirname, '..', '..');
const BASELINE = 'tests/untyped-translators.json';
/** Relevé sur main 7f1885f2 (26/11/2026), avant CLEAN-0296 : plafond qui ne remonte jamais. */
const PLAFOND = 40;

/** Nom du traducteur exporté par cette ligne s'il prend ses paramètres en `Record<string, …>`, sinon null. */
export function untypedTranslatorOn(line: string): string | null {
  const m = /^export (?:function|const) (t[A-Z]\w*)\b.*\bRecord<string\b/.exec(line);
  return m ? (m[1] ?? null) : null;
}

function untypedTranslators(): string[] {
  const files = execFileSync('git', ['ls-files', 'src'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((f) => /Text\.ts$/.test(f) && f !== 'src/i18n/catalogText.ts');
  const out: string[] = [];
  for (const file of files) {
    for (const line of readFileSync(resolve(root, file), 'utf8').split('\n')) {
      const name = untypedTranslatorOn(line);
      if (name) out.push(`${file}:${name}`);
    }
  }
  return out.sort();
}

const frozen = (): string[] => JSON.parse(readFileSync(resolve(root, BASELINE), 'utf8')) as string[];

describe('C-085 : traducteurs aux paramètres libres, liste figée qui ne peut que décroître', () => {
  it('reconnaît un traducteur aux paramètres libres, pas un traducteur par catalogText', () => {
    expect(untypedTranslatorOn('export function tX(key: K, params?: Readonly<Record<string, string | number>>): string {')).toBe('tX');
    expect(untypedTranslatorOn('export function tY(key: K, params: Record<string, string> = {}): string {')).toBe('tY');
    expect(untypedTranslatorOn('export const tX = catalogText(xFr);')).toBeNull();
    expect(untypedTranslatorOn('export function tZ(key: K): string {')).toBeNull();
  });

  it('le relevé est exactement la liste figée (aucun ajout, chaque migration en sort)', () => {
    expect(untypedTranslators()).toEqual(frozen());
  });

  it('la liste est triée, sans doublon, et ne dépasse jamais le plafond', () => {
    const list = frozen();
    expect([...new Set(list)].sort()).toEqual(list);
    expect(list.length).toBeLessThanOrEqual(PLAFOND);
  });
});
