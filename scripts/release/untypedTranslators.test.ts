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
/**
 * Relevé de main 7f1885f2 (26/11/2026) : 43 avec la règle élargie après la relecture à froid. Plafond égal à la liste figée : abaissé à
 * chaque migration, il ne remonte jamais.
 */
const PLAFOND = 24;

/**
 * Nom du traducteur exporté au début de `text` s'il prend ses paramètres en `Record<string, …>`, sinon null. Les paramètres sont lus de
 * la première parenthèse au premier `{` ou `=>` (contraintes génériques exclues, signatures sur plusieurs lignes comprises).
 */
export function untypedTranslatorOn(text: string): string | null {
  const m = /^export (?:function|const) (t[A-Z]\w*)\b[^(]*\(([^{]*?)(?:\{|=>)/.exec(text);
  return m && /\bRecord<string\b/.test(m[2] ?? '') ? (m[1] ?? null) : null;
}

/** Fichiers relevés : tout `src/i18n` et tout `*Text.ts` de `src/`, hors tests et `catalogText.ts`. */
const relevé = (f: string): boolean => (/^src\/i18n\/.*\.ts$/.test(f) || /^src\/.*Text\.ts$/.test(f)) && !/\.test\.ts$/.test(f) && f !== 'src/i18n/catalogText.ts';

function untypedTranslators(): string[] {
  const files = execFileSync('git', ['ls-files', 'src'], { cwd: root, encoding: 'utf8' }).split('\n').filter(relevé);
  const out: string[] = [];
  for (const file of files) {
    const lines = readFileSync(resolve(root, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!line.startsWith('export ')) return;
      const name = untypedTranslatorOn(lines.slice(i, i + 8).join('\n'));
      if (name) out.push(`${file}:${name}`);
    });
  }
  return out.sort();
}

const frozen = (): string[] => JSON.parse(readFileSync(resolve(root, BASELINE), 'utf8')) as string[];

describe('C-085 : traducteurs aux paramètres libres, liste figée qui ne peut que décroître', () => {
  it('reconnaît un traducteur aux paramètres libres, pas un traducteur par catalogText', () => {
    expect(untypedTranslatorOn('export function tX(key: K, params?: Readonly<Record<string, string | number>>): string {')).toBe('tX');
    expect(untypedTranslatorOn('export function tW(\n  key: K,\n  params?: Record<string, string>,\n): string {')).toBe('tW');
    expect(untypedTranslatorOn('export const tV = (key: K): string => format(key, {} as Record<string, string>);')).toBeNull();
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
