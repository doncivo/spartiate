import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error module JavaScript sans déclaration de types
import { NOTICES_PATH, renderNotices } from './third-party-notices.mjs';

/**
 * BL-043 : les avis de licence des composants livrés (MIT, Apache-2.0, BSD, ISC, MPL-2.0…) figurent dans les binaires livrés.
 * `public/THIRD-PARTY-NOTICES.txt` est copié par Vite dans `dist/`, donc embarqué dans l'installeur PC et dans l'IPA.
 */
const root = resolve(import.meta.dirname, '..', '..');

const components = [
  { ecosystem: 'npm', name: 'react', version: '18.3.1', license: 'MIT', text: 'MIT License\r\nCopyright (c) Meta' },
  { ecosystem: 'cargo', name: 'serde', version: '1.0.0', license: 'MIT OR Apache-2.0', text: 'MIT License\nCopyright (c) Meta' },
  { ecosystem: 'cargo', name: 'selectors', version: '0.38.0', license: 'MPL-2.0', text: 'Mozilla Public License Version 2.0' },
  { ecosystem: 'cargo', name: 'alloc-stdlib', version: '0.2.2', license: 'BSD-3-Clause', text: null },
];

describe('BL-043 : génération des avis de licence', () => {
  const out = renderNotices(components) as string;
  it('liste chaque composant avec sa version et sa licence déclarée', () => {
    expect(out).toContain('npm react 18.3.1 : MIT');
    expect(out).toContain('cargo serde 1.0.0 : MIT OR Apache-2.0');
  });
  it('regroupe les textes identiques (fins de ligne normalisées) et nomme les composants concernés', () => {
    expect(out.split('Copyright (c) Meta').length - 1).toBe(1);
    expect(out).toContain('react 18.3.1');
    expect(out).not.toContain('\r');
  });
  it('MPL-2.0 : indique où trouver le code source ; un texte absent est dit, jamais passé sous silence', () => {
    expect(out).toContain('https://crates.io/crates/selectors/0.38.0');
    expect(out).toMatch(/alloc-stdlib 0\.2\.2[^\n]*aucun fichier de licence/);
  });
  it('est déterministe : l\'ordre d\'entrée ne change pas la sortie', () => {
    expect(renderNotices([...components].reverse())).toBe(out);
  });
});

describe('BL-043 : le fichier livré', () => {
  const file = readFileSync(resolve(root, NOTICES_PATH as string), 'utf8');
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };

  it('est dans public/ (copié dans dist/, donc dans les binaires PC et iPhone)', () => {
    expect(NOTICES_PATH).toBe('public/THIRD-PARTY-NOTICES.txt');
    expect(file.length).toBeGreaterThan(10_000);
  });
  it('couvre chaque dépendance npm livrée de package.json', () => {
    for (const name of Object.keys(pkg.dependencies)) expect(file, name).toContain(`npm ${name} `);
  });
  it('couvre les composants MPL-2.0 de l\'application avec leur source', () => {
    for (const name of ['cssparser', 'selectors', 'option-ext']) expect(file, name).toContain(`https://crates.io/crates/${name}/`);
  });
  it('contient le texte de MIT et d\'Apache-2.0', () => {
    expect(file).toContain('Permission is hereby granted, free of charge');
    expect(file).toContain('Apache License');
  });
});

describe('BL-043 : la vérification est en CI et dans les builds', () => {
  const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
  it('tests.yml régénère et compare le fichier', () => {
    expect(read('.github/workflows/tests.yml')).toContain('third-party-notices.mjs --check');
  });
  it('build-windows.yml et build-ios.yml exigent le fichier dans dist/', () => {
    expect(read('.github/workflows/build-windows.yml')).toContain('dist/THIRD-PARTY-NOTICES.txt');
    expect(read('.github/workflows/build-ios.yml')).toContain('dist/THIRD-PARTY-NOTICES.txt');
  });
});
