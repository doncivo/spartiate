// CI-PUB (C-166, C-172, C-174, C-175) : garde statique des trois workflows et du contrôle « suite verte » avant publication.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateSuiteVerte } from './check-suite-verte.mjs';

const root = resolve(__dirname, '..', '..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');
const FILES = ['tests.yml', 'build-windows.yml', 'build-ios.yml'];
const wf = (name: string): string => read(`.github/workflows/${name}`);

/** Blocs de jobs : identifiant -> texte. */
function jobs(text: string): Record<string, string> {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l === 'jobs:');
  const out: Record<string, string> = {};
  let current = '';
  for (const line of lines.slice(start + 1)) {
    const m = /^ {2}([a-z0-9-]+):\s*$/.exec(line);
    if (m) {
      current = m[1] ?? '';
      out[current] = '';
    } else if (current) out[current] += `${line}\n`;
  }
  return out;
}

/** Étapes d'un fichier : blocs commençant par « - » à six espaces. */
const steps = (text: string): string[] => text.split(/\n(?= {6}- )/);

const usesOf = (text: string): { action: string; ref: string; line: string }[] =>
  [...text.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/gm)].map((m) => {
    const [action = '', ref = ''] = (m[1] ?? '').split('@');
    return { action, ref, line: m[0] };
  });

describe('C-166 : actions figées par SHA', () => {
  for (const f of FILES) {
    it(`${f} : chaque uses: distant est un SHA de 40 caractères suivi de # vN`, () => {
      const uses = usesOf(wf(f)).filter((u) => !u.action.startsWith('./'));
      expect(uses.length).toBeGreaterThan(0);
      for (const u of uses) {
        expect(u.ref, u.line).toMatch(/^[0-9a-f]{40}$/);
        expect(u.line, u.line).toMatch(/#\s*(v\d|stable)/);
      }
    });
  }
  it('une même action porte le même SHA dans les trois workflows', () => {
    const seen = new Map<string, string>();
    for (const f of FILES) {
      for (const u of usesOf(wf(f))) {
        const known = seen.get(u.action);
        if (known) expect(u.ref, `${f} ${u.action}`).toBe(known);
        else seen.set(u.action, u.ref);
      }
    }
  });
});

describe('C-172 : contrôle du check « suite verte » avant publication', () => {
  const run = (over: Record<string, unknown>) => ({ name: 'suite verte', status: 'completed', conclusion: 'success', started_at: '2026-11-20T10:00:00Z', ...over });
  it('vert : accepté', () => {
    expect(evaluateSuiteVerte([run({})], 'a'.repeat(40)).ok).toBe(true);
  });
  it('absent (autres checks seulement) : refusé avec message clair', () => {
    const r = evaluateSuiteVerte([run({ name: 'cargo audit' })], 'a'.repeat(40));
    expect(r.ok).toBe(false);
    expect(r.message).toContain('absent');
  });
  it('en cours : refusé', () => {
    const r = evaluateSuiteVerte([run({ status: 'in_progress', conclusion: null })]);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('pas terminé');
  });
  it('échec : refusé', () => {
    expect(evaluateSuiteVerte([run({ conclusion: 'failure' })]).ok).toBe(false);
  });
  it('le plus récent l’emporte (relance verte après échec, et inversement)', () => {
    const old = run({ conclusion: 'failure', started_at: '2026-11-20T09:00:00Z' });
    expect(evaluateSuiteVerte([old, run({})]).ok).toBe(true);
    expect(evaluateSuiteVerte([run({}), run({ conclusion: 'failure', started_at: '2026-11-20T11:00:00Z' })]).ok).toBe(false);
  });
  it('entrée invalide : refusé', () => {
    expect(evaluateSuiteVerte(null).ok).toBe(false);
  });
  for (const [f, build] of [
    ['build-windows.yml', 'windows'],
    ['build-ios.yml', 'ios'],
  ] as const) {
    it(`${f} : job garde (checks: read, script) dont dépend le job ${build}`, () => {
      const j = jobs(wf(f));
      const garde = j['garde'] ?? '';
      expect(garde).toMatch(/checks:\s*read/);
      expect(garde).toContain('scripts/release/check-suite-verte.mjs');
      expect(garde).toMatch(/GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/);
      expect(garde).not.toContain('RELEASES_TOKEN');
      expect(j[build]).toMatch(/needs:\s*garde/);
    });
  }
  it('PC : npm ci --ignore-scripts dans le job qui reçoit la clé de signature', () => {
    const win = jobs(wf('build-windows.yml'))['windows'] ?? '';
    expect(win).toContain('TAURI_SIGNING_PRIVATE_KEY');
    expect(win).toMatch(/npm ci --ignore-scripts/);
    expect(win).not.toMatch(/npm ci\s*$/m);
  });
  it('--clobber précédé d’une comparaison SHA-256 dans les deux publications', () => {
    for (const f of ['build-windows.yml', 'build-ios.yml']) {
      const publish = jobs(wf(f))['publish'] ?? '';
      expect(publish, f).toMatch(/gh release download/);
      expect(publish.indexOf('gh release download'), f).toBeLessThan(publish.indexOf('--clobber'));
      expect(publish, f).toMatch(/sha256|shasum -a 256/);
    }
  });
});

describe('C-174 : contrôles qui échouent si la commande échoue', () => {
  it('build-ios : aucun `|| true` sur cargo tree ni sur codesign -d', () => {
    const text = wf('build-ios.yml');
    expect(text).not.toMatch(/cargo tree[^\n]*\|\|\s*true/);
    expect(text).not.toMatch(/codesign -d[^\n]*\|\|\s*true/);
  });
  it('« suite verte » dépend de tous les jobs de tests.yml sauf visual (voulu)', () => {
    const text = wf('tests.yml');
    const all = jobs(text);
    const ids = Object.keys(all).filter((id) => id !== 'suite-verte' && id !== 'visual');
    const needs = /^ {4}needs:\s*\[([^\]]*)\]/m.exec(all['suite-verte'] ?? '');
    const declared = (needs?.[1] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    expect([...declared].sort()).toEqual([...ids].sort());
  });
  it('la clé du cache WebKit est calculée sous pipefail, hors substitution masquante', () => {
    const text = wf('tests.yml');
    const i = text.indexOf('id: webkit-deps-key');
    expect(text.slice(i, i + 400)).toContain('set -euo pipefail');
    expect(text).not.toMatch(/echo "pkgs=\$\(npx playwright/);
  });
  it('les étapes de version iOS et PC démarrent par set -euo pipefail', () => {
    const ios = steps(wf('build-ios.yml')).find((s) => s.includes('name: Vérifier la version du tag')) ?? '';
    const win = steps(wf('build-windows.yml')).find((s) => s.includes('name: Vérifier les versions')) ?? '';
    expect(ios).toMatch(/run: \|\n\s+set -euo pipefail/);
    expect(win).toMatch(/run: \|\n\s+set -euo pipefail/);
  });
});

describe('C-175 : durcissement', () => {
  it('build-ios : cache cargo en écriture hors tag seulement, lecture seule sur tag', () => {
    const text = wf('build-ios.yml');
    expect(text).toMatch(/name: Cache cargo\n\s+if: github\.ref_type != 'tag'/);
    expect(text).toMatch(/name: Cache cargo \(lecture seule\)\n\s+if: github\.ref_type == 'tag'\n\s+uses: actions\/cache\/restore@/);
  });
  it('persist-credentials: false sur tous les checkouts', () => {
    for (const f of FILES) {
      const text = wf(f);
      const n = [...text.matchAll(/actions\/checkout@/g)].length;
      const ok = [...text.matchAll(/actions\/checkout@[^\n]*\n\s+with:\n\s+persist-credentials: false/g)].length;
      expect(ok, f).toBe(n);
    }
  });
  it('tout upload-artifact porte retention-days', () => {
    for (const f of FILES) {
      for (const s of steps(wf(f)).filter((x) => x.includes('actions/upload-artifact@'))) expect(s, f).toMatch(/retention-days:/);
    }
  });
  it('cargo-audit est installé en version fixée, la clé de cache la porte', () => {
    const text = wf('tests.yml');
    expect(text).toMatch(/cargo install cargo-audit --locked --version \d+\.\d+\.\d+/);
    expect(text).not.toMatch(/cargo-audit-\$\{\{ runner\.os \}\}-\$\{\{ steps\.mois/);
  });
  it('npm audit des dépendances livrées dans tests.yml', () => {
    expect(wf('tests.yml')).toContain('npm audit --omit=dev --audit-level=high');
  });
});
