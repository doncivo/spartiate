// SPA-001a, critère 8 quinquies (D-50, D-54 / P-01) : tout chemin cité entre accents graves existe, ou figure dans docs/a-creer.md.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error script .mjs sans déclaration de types
import { checkDocsPaths, extractPathMentions, parseRegistry } from './lib/docsPaths.mjs';

const root = resolve(__dirname, '..', '..');
const git = (...args: string[]): string[] => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);

const present = new Set(['src/ui/AppShell.tsx', 'src/ui/theme/tokens.css', 'src-tauri/plugins/files/ios/Package.swift']);
const exists = (path: string): boolean => present.has(path) || [...present].some((p) => p.startsWith(path.replace(/\/$/, '') + '/'));

describe('extraction des mentions', () => {
  it('ne retient que les chemins entre accents graves commençant par une racine connue', () => {
    const line = 'Voir `src/ui/AppShell.tsx`, `ios/Package.swift`, `npm run lint` et `docs/PRD.md`.';
    expect(extractPathMentions(line).map((m: { path: string }) => m.path)).toEqual(['src/ui/AppShell.tsx']);
  });
  it('retire la ponctuation finale, un suffixe :ligne et une ancre', () => {
    expect(extractPathMentions('`src/ui/AppShell.tsx:12` et `src/ui/AppShell.tsx#a`').map((m: { path: string }) => m.path)).toEqual(['src/ui/AppShell.tsx', 'src/ui/AppShell.tsx']);
  });
  it('distingue littéral, glob, paramètre et alternative', () => {
    const kinds = extractPathMentions('`src/a.ts` `src/**/*.ts` `src/<nom>/x.ts` `src/domain/a|b` `src/{a,b}.ts`').map((m: { kind: string }) => m.kind);
    expect(kinds).toEqual(['literal', 'glob', 'param', 'alternative', 'glob']);
  });
});

describe('registre docs/a-creer.md', () => {
  const table = ['| Chemin | Ticket | Propriétaire |', '| --- | --- | --- |', '| `src/domain/training/` | I1 | training |', '| `content/brand/x.svg` | SPA-001a | ui-design-system |'].join('\n');
  it('lit chemin · ticket · propriétaire', () => {
    const { rows, problems } = parseRegistry(table);
    expect(problems).toEqual([]);
    expect(rows.map((r: { path: string }) => r.path)).toEqual(['src/domain/training/', 'content/brand/x.svg']);
  });
  it('refuse une ligne sans ticket ou sans propriétaire', () => {
    expect(parseRegistry(table + '\n| `src/x.ts` |  | qa-test |').problems.join('\n')).toContain('src/x.ts');
    expect(parseRegistry(table + '\n| `src/y.ts` | I1 |  |').problems.join('\n')).toContain('src/y.ts');
  });
});

describe('contrôle des chemins', () => {
  const registry = [{ path: 'src/domain/training/', ticket: 'I1', owner: 'training' }];
  const check = (text: string): string[] => checkDocsPaths({ files: [['docs/x.md', text]], exists, registry });
  it('accepte un chemin existant, un fichier du registre et un sous-chemin d’un dossier enregistré', () => {
    expect(check('`src/ui/AppShell.tsx` `src/domain/training/config.ts`')).toEqual([]);
  });
  it('refuse un chemin littéral inexistant et non enregistré, avec fichier et ligne', () => {
    expect(check('ligne 1\nModifie `src/ui/tokens.css`.')).toEqual(['docs/x.md:2 chemin introuvable et absent de docs/a-creer.md : src/ui/tokens.css']);
  });
  it('ne traite ni glob, ni paramètre, ni alternative comme des fichiers à créer', () => {
    expect(check('`src/**/x.ts` `src/<nom>/x.ts` `src/domain/training|nutrition`')).toEqual([]);
  });
  it('admet une mention historique ou négative, avec son motif local, mais pas une prescription', () => {
    expect(check('- pas de `src/ui/shell/MobileShell.tsx` (D-47)')).toEqual([]);
    expect(check('- `tests/desktop/config.rs` <!-- ancien-ok: chemin cité par la décision D-45, historique -->')).toEqual([]);
    expect(check('- `tests/desktop/config.rs` <!-- ancien-ok: -->')).not.toEqual([]);
    expect(check('- Crée `src/platform/ios`.')).not.toEqual([]);
  });
  it('un chemin relatif se résout dans son contexte déclaré, un chemin relatif inexistant est refusé (revue Codex 2)', () => {
    expect(check('`src-tauri/plugins/files/` : `ios/Absent.swift`')).toEqual(['docs/x.md:1 chemin introuvable et absent de docs/a-creer.md : src-tauri/plugins/files/ios/Absent.swift']);
    expect(check('`src-tauri/plugins/files/` : `ios/Package.swift`')).toEqual([]);
    // Sans contexte déclaré sur la ligne, il n’est pas interprété à la racine du dépôt.
    expect(check('`ios/Absent.swift`')).toEqual([]);
    // Une négation locale garde son effet sur un chemin relatif.
    expect(check('pas de `src-tauri/plugins/files/` : `ios/Absent.swift` (ancien)')).toEqual([]);
  });
  it('un chemin relatif à un plugin ne se résout pas à la racine du dépôt', () => {
    expect(check('`ios/Package.swift` et `src-tauri/plugins/files/ios/Package.swift`')).toEqual([]);
  });
});

describe('dépôt réel (D-50)', () => {
  const tracked = git('ls-files', '-z', '--cached', '--others', '--exclude-standard');
  const set = new Set(tracked);
  const dirs = new Set<string>();
  for (const file of tracked) for (let p = file; p.includes('/'); ) dirs.add((p = p.slice(0, p.lastIndexOf('/'))));
  const realExists = (path: string): boolean => set.has(path) || dirs.has(path.replace(/\/$/, ''));
  const scanned = tracked.filter(
    (f) => /^docs\/prd\/.+\.md$/.test(f) || /^docs\/SPA-[^/]+\.md$/.test(f) || f === 'docs/reprise.md' || f === 'docs/decisions.md' || /^\.claude\/agents\/.+\.md$/.test(f),
  );
  const text = (f: string): string => readFileSync(resolve(root, f), 'utf8');

  it('le registre existe et est bien formé', () => {
    const { rows, problems } = parseRegistry(text('docs/a-creer.md'));
    expect(problems).toEqual([]);
    expect(rows.length).toBeGreaterThan(0);
  });
  it('chaque chemin cité existe ou figure au registre', () => {
    const { rows } = parseRegistry(text('docs/a-creer.md'));
    const problems = checkDocsPaths({ files: scanned.map((f) => [f, text(f)]), exists: realExists, registry: rows });
    expect(problems).toEqual([]);
  });
  it('le périmètre contrôlé couvre bien les chapitres du PRD, les tickets, la reprise, les décisions et les fiches', () => {
    expect(scanned.some((f) => f.startsWith('docs/prd/'))).toBe(true);
    expect(scanned).toContain('docs/SPA-001.md');
    expect(scanned).toContain('docs/reprise.md');
    expect(scanned).toContain('docs/decisions.md');
    expect(scanned.filter((f) => f.startsWith('.claude/agents/')).length).toBe(25);
  });
});
