// SPA-001a, critère 8 quater (D-49) : le PRD v6.3 en chapitres conserve le texte de la v6.2, aux seules corrections listées près.
// Source : docs/archive/PRD-v6.2.md (copie du commit de départ). Corrections : scripts/release/fixtures/prd-v6.3-changes.json.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error script .mjs sans déclaration de types
import { applyChanges, chapterFileName, parseSections } from './lib/prdSplit.mjs';

const root = resolve(__dirname, '..', '..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');
const norm = (text: string): string => text.replace(/\r\n/g, '\n').replace(/\s+$/, '');

interface Section { heading: string; body: string }
interface Change { id: string; decision: string; section: string; old: string; new: string; why: string }

describe('analyse des sections (consciente des blocs de code)', () => {
  it('ne coupe pas sur un titre « ## » situé dans un bloc de code', () => {
    const text = '# Titre\n\nchapeau\n\n## 0. A\ntexte\n\n## 1. B\n```md\n## Faux titre\n```\nfin\n';
    const sections = parseSections(text) as Section[];
    expect(sections.map((s) => s.heading)).toEqual(['## 0. A', '## 1. B']);
    expect(sections[1]?.body).toContain('## Faux titre');
    expect(sections[0]?.body.startsWith('# Titre')).toBe(true);
  });
  it('nomme les chapitres NN-titre.md d’après le numéro de section, annexes comprises', () => {
    expect(chapterFileName('## 0. Statut et conventions', 0)).toBe('00-statut-et-conventions.md');
    expect(chapterFileName('## 19. Plugins Swift et contrat iOS', 19)).toBe('19-plugins-swift-et-contrat-ios.md');
    expect(chapterFileName('## Annexe A — `CLAUDE.md` et `AGENTS.md` du fork (fusion, D-42)', 28)).toBe('28-annexe-a-claude-md-et-agents-md-du-fork-fusion-d-42.md');
  });
  it('applyChanges exige que chaque ancien texte apparaisse exactement une fois', () => {
    expect(applyChanges('a b c', [{ old: 'b', new: 'X' }])).toBe('a X c');
    expect(() => applyChanges('a b b', [{ old: 'b', new: 'X' }])).toThrow(/une seule fois|exactement/);
    expect(() => applyChanges('a', [{ old: 'z', new: 'X' }])).toThrow(/introuvable|exactement/);
  });
});

describe('conservation du contenu v6.2 → v6.3', () => {
  const source = parseSections(read('docs/archive/PRD-v6.2.md')) as Section[];
  const changes = (JSON.parse(read('scripts/release/fixtures/prd-v6.3-changes.json')) as { changes: Change[] }).changes;
  const files = readdirSync(resolve(root, 'docs/prd')).filter((f) => /^\d{2}-.+\.md$/.test(f)).sort();
  const sectionNumber = (heading: string, index: number): number => (/^## (\d+)\./.exec(heading)?.[1] ? Number(/^## (\d+)\./.exec(heading)?.[1]) : index);

  it('les corrections listées sont motivées par une décision approuvée', () => {
    expect(changes.length).toBeGreaterThan(0);
    for (const change of changes) {
      expect(['D-47', 'D-48', 'D-49', 'D-58', 'D-59']).toContain(change.decision);
      expect(change.why.length).toBeGreaterThan(10);
    }
    expect(new Set(changes.map((c) => c.decision))).toEqual(new Set(['D-47', 'D-48', 'D-49', 'D-58', 'D-59']));
  });
  it('un fichier par section, nommé d’après son titre et son numéro, dans l’ordre', () => {
    expect(files).toEqual(source.map((section, index) => chapterFileName(section.heading, sectionNumber(section.heading, index))));
  });
  it('chaque chapitre égale la section source après application des seules corrections listées', () => {
    source.forEach((section, index) => {
      const mine = changes.filter((c) => c.section === String(index).padStart(2, '0'));
      const expected = applyChanges(section.body, mine);
      expect(norm(read(`docs/prd/${files[index]}`)), `chapitre ${files[index]}`).toBe(norm(expected));
    });
  });
  it('toute correction cible une section existante', () => {
    for (const change of changes) expect(Number(change.section)).toBeLessThan(source.length);
  });
  it('titres, ordre, tableaux et blocs de code : mêmes comptes qu’à la source (hors lignes de corrections)', () => {
    const all = files.map((f) => read(`docs/prd/${f}`)).join('\n');
    const count = (text: string, re: RegExp): number => (text.match(re) ?? []).length;
    const src = source.map((s) => s.body).join('\n');
    expect(count(all, /^#{1,4} /gm)).toBeGreaterThanOrEqual(count(src, /^#{1,4} /gm));
    expect(count(all, /^```/gm) % 2).toBe(0);
    expect(count(all, /^```/gm)).toBe(count(src, /^```/gm));
  });
});

describe('page de renvoi et index', () => {
  const page = read('docs/PRD.md');
  const index = read('docs/prd/README.md');
  const files = readdirSync(resolve(root, 'docs/prd')).filter((f) => /^\d{2}-.+\.md$/.test(f));
  it('docs/PRD.md tient en une page et renvoie à l’index', () => {
    expect(page.split('\n').length).toBeLessThanOrEqual(60);
    expect(page).toContain('prd/README.md');
    expect(page).toMatch(/6\.3/);
    expect(page).toMatch(/journal des révisions/i);
  });
  it('l’index liste chaque chapitre avec son lien, un résumé et les agents concernés', () => {
    for (const file of files) expect(index, file).toContain(`(${file})`);
    expect(index).toMatch(/agents? concernés?/i);
  });
});

describe('corrections de fond D-47, D-48, D-58, D-59 présentes dans les chapitres', () => {
  const all = readdirSync(resolve(root, 'docs/prd'))
    .filter((f) => /^\d{2}-.+\.md$/.test(f))
    .map((f) => read(`docs/prd/${f}`))
    .join('\n');
  it('D-47 : coquilles réelles, rupture 1 024 px, contrast.test.ts, caméra seule, settings hors catalogue, quotas', () => {
    expect(all).toContain('src/ui/AppShell.tsx');
    expect(all).toContain('src/ui/useLayout.ts');
    expect(all).toMatch(/1 024 px/);
    expect(all).toContain('src/ui/theme/contrast.test.ts');
    expect(all).toMatch(/NSPhotoLibraryUsageDescription/);
    expect(all).toMatch(/pré-migration 5/);
    expect(all).toMatch(/withGlobalTauri/);
  });
  it('D-48 : la rubrique « Relais » est au gabarit de ticket', () => {
    expect(all).toMatch(/Relais.{0,200}relecteur obligatoire/s);
  });
  it('D-58 et D-59 : versions 0.1.0 / 0.1.1 et H-3a / H-3b / H-3c', () => {
    expect(all).toContain('0.1.1');
    for (const id of ['H-3a', 'H-3b', 'H-3c']) expect(all).toContain(id);
  });
});
