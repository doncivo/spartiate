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
 * chaque migration, il ne remonte jamais. CLEAN-0297 (D-645) : 24 → 2 (`tDynamic`, clé calculée de `t()` ; `tProgression`, paramètres
 * dynamiques du moteur).
 */
const PLAFOND = 2;

/** Un texte de type est libre s'il contient `Record<string` ou un alias libre déjà connu (mot entier). */
const loose = (typeText: string, aliases: ReadonlySet<string>): boolean =>
  /\bRecord<string\b/.test(typeText) || [...aliases].some((alias) => new RegExp(`\\b${alias}\\b`).test(typeText));

/**
 * CLEAN-0297 (C-085, D-646) : alias de type locaux aux paramètres libres (`type P = Readonly<Record<string, …>>`, `type Q = P | …`), lus
 * jusqu'à stabilité pour suivre un alias d'alias. Un alias importé d'un autre fichier reste hors de portée (limite connue).
 */
export function looseAliases(fileText: string): Set<string> {
  const defs = [...fileText.matchAll(/^(?:export )?type (\w+)(?:<[^=]*>)? =([^;]*);/gm)].map((m) => [m[1] ?? '', m[2] ?? ''] as const);
  const aliases = new Set<string>();
  for (let grew = true; grew; ) {
    grew = false;
    for (const [name, body] of defs) {
      if (aliases.has(name) || !loose(body, aliases)) continue;
      aliases.add(name);
      grew = true;
    }
  }
  return aliases;
}

/**
 * Nom du traducteur exporté au début de `text` s'il prend ses paramètres en `Record<string, …>` (directement ou par un alias de
 * `aliases`), sinon null. Les paramètres sont lus de la première parenthèse au premier `{` ou `=>`, sans dépasser la fin de la
 * déclaration (premier `;`) : contraintes génériques exclues, signatures sur plusieurs lignes comprises.
 */
export function untypedTranslatorOn(text: string, aliases: ReadonlySet<string> = new Set()): string | null {
  const m = /^export (?:function|const) (t[A-Z]\w*)\b[^(;]*\(([^{;]*?)(?:\{|=>)/.exec(text);
  return m && loose(m[2] ?? '', aliases) ? (m[1] ?? null) : null;
}

/** Fichiers relevés : tout `src/i18n` et tout `*Text.ts` de `src/`, hors tests et `catalogText.ts`. */
const relevé = (f: string): boolean => (/^src\/i18n\/.*\.ts$/.test(f) || /^src\/.*Text\.ts$/.test(f)) && !/\.test\.ts$/.test(f) && f !== 'src/i18n/catalogText.ts';

/** Traducteurs aux paramètres libres d'un fichier (noms seuls). */
export function untypedTranslatorsOf(fileText: string): string[] {
  const aliases = looseAliases(fileText);
  const lines = fileText.split('\n');
  const out: string[] = [];
  lines.forEach((line, i) => {
    if (!line.startsWith('export ')) return;
    const name = untypedTranslatorOn(lines.slice(i, i + 8).join('\n'), aliases);
    if (name) out.push(name);
  });
  return out;
}

function untypedTranslators(): string[] {
  const files = execFileSync('git', ['ls-files', 'src'], { cwd: root, encoding: 'utf8' }).split('\n').filter(relevé);
  return files.flatMap((file) => untypedTranslatorsOf(readFileSync(resolve(root, file), 'utf8')).map((name) => `${file}:${name}`)).sort();
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

  it('CLEAN-0297 : voit un alias de type local aux paramètres libres, même alias d’alias (faille signalée par CLEAN-0296)', () => {
    const file = [
      'type Params = Readonly<Record<string, string | number>>;',
      'export type Maybe = Params | undefined;',
      'type Narrow = Readonly<Record<"n", number>>;',
      'export function tA(key: K, params?: Params): string {',
      '  return key;',
      '}',
      'export const tB = (key: K, params: Maybe): string => key;',
      'export function tC(key: K, params: Narrow): string {',
      '  return key;',
      '}',
    ].join('\n');
    expect([...looseAliases(file)].sort()).toEqual(['Maybe', 'Params']);
    expect(untypedTranslatorsOf(file)).toEqual(['tA', 'tB']);
    expect(untypedTranslatorOn('export function tA(key: K, params?: Params): string {', new Set(['Params']))).toBe('tA');
    expect(untypedTranslatorOn('export function tA(key: K, params?: ParamsTyped): string {', new Set(['Params']))).toBeNull();
  });

  it('CLEAN-0297 : un traducteur typé par CatalogTranslator ne déborde pas sur la déclaration suivante', () => {
    const file = [
      'export const tX: CatalogTranslator<typeof xFr> = translate;',
      '',
      'export const formatKg = (kg: number, extra: Record<string, string>): string => String(kg);',
    ].join('\n');
    expect(untypedTranslatorsOf(file)).toEqual([]);
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
