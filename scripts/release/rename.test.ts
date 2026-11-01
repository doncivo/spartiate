// SPA-001a, critère 8 / Méthode D-51 : le script de renommage ne touche que les fichiers suivis, est idempotent et protège les données CircleTasks.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error script .mjs sans déclaration de types
import { renameText, runRename } from './rename.mjs';

let repo = '';
const put = (path: string, content: string): void => {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), content);
};
const get = (path: string): string => readFileSync(join(repo, path), 'utf8');
const git = (...args: string[]): void => {
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: repo });
};

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'spa-rename-'));
  git('init', '-q');
  put('src/a.ts', "const U = 'sqlite:circletasks.db'; // CircleTasks\nconst ID = 'fr.circletasks.planner';\n");
  put('src-tauri/Cargo.toml', '[package]\nname = "circletasks"\nversion = "1.0.2"\n\n[lib]\nname = "circletasks_lib"\n');
  put('.claude/agents/x.md', 'Données : `%APPDATA%\\fr.circletasks.planner` toujours interdites.\n');
  put('docs/decisions.md', 'Historique : fr.circletasks.planner\n');
  put('docs/install-pc.md', 'Installer CircleTasks depuis circletasks-releases.\n');
  put('src/b.rs', '// Protocole repris de CircleTasks (ADR 0011).\nlet crlf = "CircleTasks";\r\n');
  put('src/data.bin', 'CircleTasks\0binaire');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  put('src/untracked.ts', "export const NAME = 'CircleTasks';\n");
});
afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('renameText (une chaîne)', () => {
  it('remplace les variantes dans l’ordre du plus spécifique au plus général', () => {
    expect(renameText('src/a.ts', 'fr.circletasks.planner.smoke CircleTasks circletasks_lib circletasks-releases circletasks.db').text).toBe(
      'fr.spartiate.app.smoke Spartiate spartiate_lib spartiate-releases spartiate.db',
    );
  });
  it('est idempotent', () => {
    const once = renameText('src/a.ts', 'CircleTasks fr.circletasks.planner').text;
    expect(renameText('src/a.ts', once)).toEqual({ text: once, count: 0 });
  });
  it('laisse intacte toute ligne portant le sel HKDF du protocole (D-26)', () => {
    const salt = 'pub const HKDF_SALT: &[u8] = b"circletasks";';
    expect(renameText('src-tauri/src/sync/crypto.rs', `${salt}\nCircleTasks`)).toEqual({ text: `${salt}\nSpartiate`, count: 1 });
  });
  it('laisse intacte une ligne de provenance (repris de CircleTasks)', () => {
    expect(renameText('src/b.rs', '// repris de CircleTasks (ADR 0011)\nCircleTasks\n').text).toBe('// repris de CircleTasks (ADR 0011)\nSpartiate\n');
  });
  it('ne touche ni aux fiches d’agents, ni à CLAUDE.md, ni à AGENTS.md (fusion manuelle, données protégées)', () => {
    for (const file of ['.claude/agents/x.md', 'CLAUDE.md', 'AGENTS.md']) expect(renameText(file, 'fr.circletasks.planner').count).toBe(0);
  });
  it('ne touche pas aux documents exemptés (D-41) mais renomme les guides', () => {
    for (const file of ['docs/PRD.md', 'docs/decisions.md', 'docs/SPA-001.md', 'docs/adr/0001.md', 'docs/archive/x.md', 'docs/licences.md', 'docs/relecture-codex-2026-10-31.md']) {
      expect(renameText(file, 'CircleTasks').count, file).toBe(0);
    }
    for (const file of ['docs/install-pc.md', 'docs/install-iphone.md', 'docs/release-pc.md']) expect(renameText(file, 'CircleTasks').text, file).toBe('Spartiate');
  });
});

describe('runRename (dépôt temporaire)', () => {
  it('ne modifie que les fichiers suivis, textes, non exemptés', () => {
    const report = runRename({ cwd: repo, write: true });
    expect(get('src/a.ts')).toBe("const U = 'sqlite:spartiate.db'; // Spartiate\nconst ID = 'fr.spartiate.app';\n");
    expect(get('src-tauri/Cargo.toml')).toContain('name = "spartiate"');
    expect(get('src-tauri/Cargo.toml')).toContain('name = "spartiate_lib"');
    expect(get('src-tauri/Cargo.toml')).toContain('version = "0.1.0"');
    expect(get('.claude/agents/x.md')).toContain('fr.circletasks.planner');
    expect(get('docs/decisions.md')).toContain('fr.circletasks.planner');
    expect(get('docs/install-pc.md')).toBe('Installer Spartiate depuis spartiate-releases.\n');
    expect(get('src/untracked.ts')).toContain('CircleTasks');
    expect(get('src/data.bin')).toContain('CircleTasks');
    expect(get('src/b.rs')).toContain('repris de CircleTasks');
    expect(get('src/b.rs')).toContain('let crlf = "Spartiate";\r\n');
    expect(report.files).toBeGreaterThan(0);
    expect(report.occurrences).toBeGreaterThan(0);
    expect(report.touched.map((t: { file: string }) => t.file)).not.toContain('src/untracked.ts');
  });
  it('une seconde exécution ne change rien', () => {
    const report = runRename({ cwd: repo, write: true });
    expect(report).toMatchObject({ files: 0, occurrences: 0 });
    expect(resolve(repo)).toBe(resolve(repo));
  });
  it('--dry (write: false) ne modifie rien', () => {
    put('src/c.ts', 'CircleTasks\n');
    git('add', 'src/c.ts');
    const report = runRename({ cwd: repo, write: false });
    expect(report.files).toBe(1);
    expect(get('src/c.ts')).toBe('CircleTasks\n');
  });
});
