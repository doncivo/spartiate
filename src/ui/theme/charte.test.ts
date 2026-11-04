import { describe, expect, it } from 'vitest';
import { SETTINGS_DEFINITIONS } from '../../domain/model/settings';
import { THEMES, contrast, loadRules, themeTokens, type Theme } from '../../../tests/unit/theme/cssContrastKit';

/**
 * SPA-009 (§ 18.4, D-19, D-47) : la charte « laconique, sombre, rouge et bronze » est portée par les jetons `--ct-*` réels de tokens.css,
 * lus dans les deux thèmes ; sombre est le défaut. Les ratios sont calculés (jamais un seuil abaissé) : ivoire sur rouge, secondaire sur
 * surface, bronze sur surface, texte sombre sur vert. Le rouge n'est jamais une couleur de texte sur fond sombre (3,0:1).
 */
const rules = loadRules();
const tokens = (theme: Theme): Record<string, string> => themeTokens(rules, theme);

const CHARTE: Record<Theme, Record<string, string>> = {
  dark: {
    '--ct-color-bg': '#0d0e11',
    '--ct-color-surface': '#15171c',
    '--ct-color-surface-raised': '#1d2027',
    '--ct-color-border': '#2a2e37',
    '--ct-color-text': '#ede7dc',
    '--ct-color-text-secondary': '#a39c90',
    '--ct-color-accent': '#b8322a',
    '--ct-color-bronze': '#c28e4c',
    '--ct-color-ok': '#5e9e6b',
    '--ct-color-warn': '#d9a441',
    '--ct-color-info': '#6f8fb3',
  },
  light: {
    '--ct-color-bg': '#f4f1ea',
    '--ct-color-surface': '#ffffff',
    '--ct-color-surface-raised': '#ece8df',
    '--ct-color-border': '#d8d2c6',
    '--ct-color-text': '#15171c',
    '--ct-color-text-secondary': '#5e584f',
    '--ct-color-accent': '#b8322a',
    '--ct-color-bronze': '#8e6530',
    '--ct-color-ok': '#5e9e6b',
    '--ct-color-warn': '#d9a441',
    '--ct-color-info': '#6f8fb3',
  },
};

describe.each(THEMES)('charte § 18.4, thème %s', (theme) => {
  it('les jetons portent les valeurs de la charte', () => {
    const t = tokens(theme);
    for (const [name, value] of Object.entries(CHARTE[theme])) expect(t[name]?.toLowerCase(), name).toBe(value);
  });

  it('contrastes AA calculés : ivoire sur rouge, secondaire et bronze sur surface, texte sombre sur vert', () => {
    const t = tokens(theme);
    const at = (name: string): string => t[name] as string;
    expect(contrast(at('--ct-color-accent-on'), at('--ct-color-accent')), 'accent-on / accent').toBeGreaterThanOrEqual(4.5);
    expect(contrast(at('--ct-color-text'), at('--ct-color-bg')), 'texte / fond').toBeGreaterThanOrEqual(4.5);
    expect(contrast(at('--ct-color-text-secondary'), at('--ct-color-surface')), 'secondaire / surface').toBeGreaterThanOrEqual(4.5);
    expect(contrast(at('--ct-color-bronze'), at('--ct-color-surface')), 'bronze / surface').toBeGreaterThanOrEqual(4.5);
    expect(contrast(at('--ct-color-ok-on'), at('--ct-color-ok')), 'texte sombre / vert').toBeGreaterThanOrEqual(4.5);
  });
});

describe('le rouge n’est jamais une couleur de texte', () => {
  it('sombre : le rouge sur le fond est sous 4,5:1 (fond de bouton seulement) et aucune règle ne l’emploie en `color`', () => {
    const t = tokens('dark');
    expect(contrast(t['--ct-color-accent'] as string, t['--ct-color-bg'] as string)).toBeLessThan(4.5);
    const offenders = rules.filter((r) => /var\(--ct-color-accent\)/.test(r.decls['color'] ?? '')).map((r) => `${r.file} :: ${r.selector}`);
    expect(offenders).toEqual([]);
  });
});

describe('thème par défaut', () => {
  it('sombre est le défaut du réglage d’apparence', () => {
    expect(SETTINGS_DEFINITIONS['ui.theme'].defaultValue).toBe('dark');
  });
});
