import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * ERGO-01 : règles de présentation portées par les classes et les jetons (aperçu esthétique validé par Ali le 12/11). La géométrie réelle est
 * relue sur les captures du job visual de la CI ; ces tests rendent la règle visible en revue et rouge si elle revient en arrière.
 */
const css = (path: string): string => readFileSync(path, 'utf8');
const rule = (source: string, selector: string): string => {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`règle absente : ${selector}`);
  return source.slice(start, source.indexOf('}', start));
};
const HIT = 'var(--ct-hit-target-min)';

describe('ERGO-01 : chiffre héros (jetons seulement)', () => {
  it('les classes héros sont globales (importées par tokens.css) et ne portent que des jetons', () => {
    expect(css('src/ui/theme/tokens.css')).toContain("@import './figures.css';");
    const figures = css('src/ui/theme/figures.css');
    const num = rule(figures, '.ct-hero__num');
    expect(num).toContain('font-family: var(--ct-font-title)');
    expect(num).toContain('color: var(--ct-color-bronze)');
    expect(num).toContain('font-variant-numeric: tabular-nums');
    expect(rule(figures, '.ct-hero__unit')).toContain('color: var(--ct-color-text-secondary)');
    expect(figures).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  it('Programme : la semaine du mésocycle est le chiffre de tête (titre, jetons)', () => {
    const week = rule(css('src/features/training/cycle/CycleView.css'), '.ct-cycle__week');
    expect(week).toContain('font-family: var(--ct-font-title)');
    expect(week).toContain('font-size: var(--ct-font-size-heading-sm)');
  });

  it('Résumé : les trois chiffres sont à plat (moins de cartes) et en bronze', () => {
    const source = css('src/features/training/session/Summary.css');
    expect(rule(source, '.ct-summary__kpis')).not.toContain('border: 1px');
    expect(rule(source, '.ct-summary__kpi dd')).toContain('color: var(--ct-color-bronze)');
  });

  it('Aujourd’hui : le bloc à plat garde la marge de la carte mais ni fond ni bordure', () => {
    const flat = rule(css('src/features/app/TodayScreen.css'), '.ct-today__card--flat');
    expect(flat).toContain('background: transparent');
    expect(flat).toContain('border-color: transparent');
  });

  it('Récupération : le cadran héros est plus grand que les deux autres', () => {
    expect(rule(css('src/features/recovery/RecoveryToday.css'), '.ct-recovery__cell--hero .ct-recovery__dial')).toContain('width: 148px');
  });
});

describe('ERGO-01 : séance active', () => {
  const source = css('src/features/training/session/Session.css');
  it('série en cours : bloc central (fond relevé, liseré bronze), bouton Valider à 56 px', () => {
    const current = rule(source, '.ct-session__set--current');
    expect(current).toContain('background: var(--ct-color-surface-raised)');
    expect(current).toContain('border: 1px solid var(--ct-color-bronze)');
    expect(rule(source, '.ct-session__set--current .ct-session__validate')).toContain('min-height: 56px');
  });

  it('repos : barre de progression en jetons (piste et remplissage)', () => {
    expect(rule(source, '.ct-session__rest-bar')).toContain('background: var(--ct-color-surface)');
    expect(rule(source, '.ct-session__rest-fill')).toContain('background: var(--ct-color-bronze)');
  });
});

describe('ERGO-01 : cibles tactiles ≥ 44 pt', () => {
  it.each([
    ['src/ui/Toast.css', '.ct-toast__action'],
    ['src/ui/WeekdayToggles.css', '.ct-weekday-toggles__day'],
  ])('%s %s : hauteur minimale par le jeton', (path, selector) => {
    const block = rule(css(path), selector);
    expect(block).toContain(`min-height: ${HIT}`);
    expect(block).not.toMatch(/(^|\s)height: (3\d|4[0-3])px/);
  });
});
