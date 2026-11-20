import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ERGO-01b (décision d'Ali du 13/11) : règles visuelles de tous les autres écrans, portées par des jetons et des classes partagées. La
 * géométrie réelle se relit sur les captures du job visual de la CI ; ces tests rendent la règle visible en revue et rouge si elle recule.
 */
const css = (path: string): string => readFileSync(path, 'utf8');
const rule = (source: string, selector: string): string => {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`règle absente : ${selector}`);
  return source.slice(start, source.indexOf('}', start));
};
const HIT = 'var(--ct-hit-target-min)';

describe('ERGO-01b : jetons', () => {
  const tokens = css('src/ui/theme/tokens.css');
  it('filet fin et espacement de section sur la grille 4 pt (16 / 24 px)', () => {
    expect(tokens).toContain('--ct-line: 1px solid var(--ct-color-border);');
    expect(tokens).toContain('--ct-space-section: 24px;');
    expect(tokens).toContain('--ct-space-4: 16px;');
  });
});

describe('ERGO-01b : classes partagées (figures.css, importé par tokens.css)', () => {
  const figures = css('src/ui/theme/figures.css');

  it('titre de section : petites capitales bronze espacées, jetons seulement', () => {
    const title = rule(figures, 'h4.ct-section-title');
    expect(title).toContain('text-transform: uppercase');
    expect(title).toContain('letter-spacing: 0.16em');
    expect(title).toContain('font-size: var(--ct-font-size-xs)');
    expect(title).toContain('color: var(--ct-color-bronze)');
  });

  it('bloc à plat : ni fond ni bordure de carte, filet fin au-dessus, 16 px dedans', () => {
    const flat = rule(figures, 'li.ct-flat'); // dernier sélecteur du groupe section, div, form, li
    expect(flat).toContain('background: transparent');
    expect(flat).toContain('border: 0');
    expect(flat).toContain('border-top: var(--ct-line)');
    expect(flat).toContain('padding: var(--ct-space-4) 0');
  });

  it('filet seul et pile de sections à 24 px', () => {
    expect(rule(figures, '.ct-rule')).toContain('border-top: var(--ct-line)');
    expect(rule(figures, '.ct-stack')).toContain('gap: var(--ct-space-section)');
  });

  it('aucune couleur en dur dans les classes partagées', () => {
    expect(figures).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});

describe('ERGO-01b : onglets iPhone et barre latérale PC à indicateur bronze', () => {
  const rail = css('src/ui/TabRail.css');
  it.each(["mobile", "pc"])('%s : l’onglet actif porte un indicateur bronze (jeton de la barre)', (layout) => {
    const indicator = rule(rail, `.ct-tab-rail[data-layout='${layout}'] .ct-tab-rail__tab[data-active='true']::before`);
    expect(indicator).toContain("content: ''");
    expect(indicator).toContain('background: var(--ct-color-nav-accent)');
  });

  it('PC : onglets de 44 px au moins (jeton), icône active en bronze', () => {
    expect(rule(rail, ".ct-tab-rail[data-layout='pc'] .ct-tab-rail__tab")).toContain(`min-height: ${HIT}`);
    expect(rule(rail, ".ct-tab-rail[data-layout='pc'] .ct-tab-rail__tab[data-active='true'] .ct-tab-rail__icon")).toContain('color: var(--ct-color-nav-accent)');
  });
});

describe('ERGO-01b : boutons arrondis de 44 px au moins', () => {
  it('Button : arrondi et hauteur minimale par le jeton', () => {
    const button = rule(css('src/ui/Button.css'), '.ct-button');
    expect(button).toContain('border-radius: var(--ct-radius-pill)');
    expect(button).toContain(`min-height: ${HIT}`);
  });

  it.each([
    ['src/features/settings/SettingsScreen.css', '.ct-settings__link'],
    ['src/features/settings/BodyScreen.css', '.ct-body .ct-body__save'],
  ])('%s %s : 44 px sur toutes les plateformes, arrondi', (path, selector) => {
    const block = rule(css(path), selector);
    expect(block).toContain(`min-height: ${HIT}`);
    expect(block).toContain('border-radius: var(--ct-radius-pill)');
    expect(block).not.toMatch(/(^|\s)height: (3\d|4[0-3])px/);
  });
});

describe('ERGO-01b : icônes Lucide homogènes (composant partagé)', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return walk(path);
      return path.endsWith('.tsx') && !path.endsWith('.test.tsx') ? [path] : [];
    });
  const files = walk('src').map((path) => ({ path, source: css(path) }));

  it('une icône Lucide ne se dessine que par <Icon icon={…}> (jamais <Check size=… /> en direct)', () => {
    const direct: string[] = [];
    for (const { path, source } of files) {
      const imports = /import \{([^}]*)\} from 'lucide-react'/.exec(source);
      if (!imports || path.endsWith(join('ui', 'Icon.tsx'))) continue;
      for (const name of (imports[1] as string).split(',').map((n) => n.trim().replace(/^type\s+/, '')).filter(Boolean)) {
        if (new RegExp(`<${name}[\\s/>]`).test(source)) direct.push(`${path} : <${name}>`);
      }
    }
    expect(direct).toEqual([]);
  });

  it('taille par nom (sm, md, lg), jamais en pixels ni trait au choix de l’écran', () => {
    const free: string[] = [];
    for (const { path, source } of files) {
      for (const match of source.matchAll(/<Icon\b[^>]*>/g)) {
        if (/size=\{|strokeWidth=|color=/.test(match[0])) free.push(`${path} : ${match[0]}`);
      }
    }
    expect(free).toEqual([]);
  });
});
