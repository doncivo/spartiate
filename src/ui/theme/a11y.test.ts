import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrast } from '../../../tests/unit/theme/cssContrastKit';

/**
 * A11Y (lot 0.28.0, C-111, C-112, C-113) : anneau de focus contrasté et distinct du bouton primaire, bordures de champs, Dynamic Type iOS.
 * Analyse statique des feuilles de style (même approche que `iosInputZoom.test.ts`).
 */
const SRC = fileURLToPath(new URL('../../', import.meta.url));
const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith('.css') ? [path] : [];
  });
}
const files = cssFiles(SRC).filter((f) => !f.endsWith('tokens.css'));

/** Valeur hexadécimale d'un jeton dans le bloc de thème désigné (de son sélecteur à l'accolade fermante de colonne 0 ou 2). */
function valueIn(selector: string, token: string): string | undefined {
  const start = tokens.indexOf(selector);
  const end = tokens.indexOf('\n}', start);
  return tokens.slice(start, end).match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
}
const rootValue = (token: string): string => tokens.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? '';
const themes = [
  ['clair', ":root[data-theme='light']"],
  ['sombre', ":root[data-theme='dark']"],
] as const;

describe('anneau de focus (C-111)', () => {
  it.each(themes)('le jeton --ct-color-focus-ring existe en %s et diffère du rouge d’accent', (_n, selector) => {
    const ring = valueIn(selector, '--ct-color-focus-ring');
    expect(ring).toBeDefined();
    expect(ring?.toLowerCase()).not.toBe(valueIn(selector, '--ct-color-accent')?.toLowerCase());
  });

  it('le bloc sombre du système (prefers-color-scheme) porte le même jeton que data-theme="dark"', () => {
    const media = tokens.slice(tokens.indexOf('@media (prefers-color-scheme: dark)'));
    expect(media.match(/--ct-color-focus-ring:\s*(#[0-9a-fA-F]{6})/)?.[1]).toBe(valueIn(":root[data-theme='dark']", '--ct-color-focus-ring'));
  });

  it('aucun :focus-visible ne dessine son contour en accent, bronze ou select-ring (sous 3:1)', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const css = readFileSync(file, 'utf8');
      for (const m of css.matchAll(/([^{}]*:focus-visible[^{]*)\{([^}]*)\}/g)) {
        const outline = (m[2] ?? '').match(/outline:\s*[^;]*var\((--ct-color-[a-z-]+)/)?.[1];
        if (outline && !['--ct-color-focus-ring', '--ct-color-nav-accent', '--ct-color-on-nav'].includes(outline)) {
          offenders.push(`${relative(SRC, file)} : ${(m[1] ?? '').trim()} -> ${outline}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('les composants de src/ui qui dessinent un anneau le tirent du jeton de focus', () => {
    for (const name of ['Button', 'SegmentedControl', 'Switch', 'StatusBanner', 'WeekdayToggles']) {
      expect(read(`ui/${name}.css`), name).toMatch(/:focus-visible\s*\{[^}]*outline:[^;]*--ct-color-focus-ring/);
    }
  });

  it('les anneaux posés sur la barre sombre (onglets, toast) restent ≥ 3:1 sur --ct-color-nav-bg', () => {
    for (const [, selector] of themes) {
      const bg = valueIn(selector, '--ct-color-nav-bg') ?? rootValue('--ct-color-nav-bg');
      for (const token of ['--ct-color-nav-accent', '--ct-color-on-nav']) {
        const fg = valueIn(selector, token) ?? rootValue(token);
        expect(contrast(fg, bg), token).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe('bordure des champs et interrupteur (C-112)', () => {
  it('les champs et boutons secondaires utilisent --ct-color-control-border, pas la bordure forte décorative', () => {
    expect(read('ui/Button.css')).toMatch(/\.ct-button--secondary\s*\{[^}]*border:[^;]*--ct-color-control-border/);
    expect(read('features/onboarding/OnboardingFlow.css')).toMatch(/\.ct-onb__input\s*\{[^}]*border:[^;]*--ct-color-control-border/);
    expect(read('features/sync/pairing-window/pairing.css')).toMatch(/\.ct-pair__input\s*\{[^}]*border:[^;]*--ct-color-control-border/);
  });
});


describe('Dynamic Type sur iPhone (COQUILLE-PC-c, D-372, C-113, H-19a)', () => {
  /** Bloc `@supports (font: -apple-system-body)` de tokens.css (WebKit seulement : WebView2 sur PC ne reconnaît pas cette valeur). */
  const supports = /@supports \(font: -apple-system-body\)\s*\{([\s\S]*?)\n\}/.exec(tokens)?.[1] ?? '';

  it('iOS : html prend la taille du texte système (font: -apple-system-body) dans un @supports, jamais en dehors', () => {
    expect(supports).toMatch(/html\s*\{[^}]*font:\s*-apple-system-body/);
    // La seule occurrence hors du bloc est la condition @supports elle-même.
    expect(tokens.replace(supports, '').match(/-apple-system-body/g)).toHaveLength(1);
  });

  it('PC : html garde font-size: 100 % hors du bloc @supports', () => {
    expect(tokens).toMatch(/\nhtml\s*\{[^}]*font-size:\s*100%/);
  });

  it('libellé d’onglet mobile et marque PC en rem ; le bouton grandit avec le texte sans passer sous 48 px', () => {
    const rail = read('ui/TabRail.css');
    expect(rail).toMatch(/\.ct-tab-rail\[data-layout='mobile'\] \.ct-tab-rail__label\s*\{[^}]*font-size:[^;]*rem/);
    expect(rail).toMatch(/\.ct-tab-rail__mark\s*\{[^}]*font-size:\s*[\d.]+rem/);
    const button = /\.ct-button\s*\{([^}]*)\}/.exec(read('ui/Button.css'))?.[1] ?? '';
    expect(button).not.toMatch(/\n\s*height:\s*48px/);
    expect(button).toMatch(/min-height:\s*max\(48px,\s*3rem\)/);
  });

  it('cibles tactiles : le jeton reste 44 px, et la barre d’onglets iPhone se dimensionne par min-height', () => {
    expect(tokens).toMatch(/--ct-hit-target-min:\s*44px/);
    expect(read('ui/TabRail.css')).toMatch(/\.ct-tab-rail\[data-layout='mobile'\] \.ct-tab-rail__tab\s*\{[^}]*min-height:\s*var\(--ct-tab-bar-height\)/);
  });

  it('440 px au réglage « Très grand » : la colonne centrale peut rétrécir (min-width: 0) et le texte long passe à la ligne', () => {
    const shell = read('ui/AppShell.css');
    expect(shell).toMatch(/\.ct-app-shell__column\s*\{[^}]*min-width:\s*0/);
    expect(shell).toMatch(/\.ct-app-shell__main\s*\{[^}]*min-width:\s*0/);
    expect(tokens).toMatch(/\nbody\s*\{[^}]*overflow-wrap:\s*(anywhere|break-word)/);
  });
});
