import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 0.7.1 : garde des règles de mise en page à l'origine des défauts vus sur l'iPhone (440 px). La géométrie réelle est vérifiée par les e2e
 * (tests/e2e/V0-7-1-mise-en-page.spec.ts) ; ces tests rendent la cause commune visible en revue et rouge si elle revient.
 */
const css = (path: string): string => readFileSync(path, 'utf8');
const rule = (source: string, selector: string): string => {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`règle absente : ${selector}`);
  return source.slice(start, source.indexOf('}', start));
};

describe('0.7.1 : règles de mise en page', () => {
  it('point 3 : toute carte d’Aujourd’hui porte la marge intérieure de la carte Poids (cause commune : .ct-today__card sans padding)', () => {
    expect(rule(css('src/features/app/TodayScreen.css'), '.ct-today__card')).toContain('padding: var(--ct-space-5) var(--ct-space-6)');
  });

  it('point 5 : un champ de la Bibliothèque ne fixe pas 200 px de hauteur dans une colonne (flex-basis seulement en rangée)', () => {
    const source = css('src/features/training/TrainingScreen.css');
    expect(rule(source, '.ct-training__field')).toContain('flex: 0 0 auto');
    expect(rule(source, ".ct-training-shell[data-layout='pc'] .ct-training__filters > .ct-training__field,\n.ct-training__grid2 > .ct-training__field,\n.ct-training__grid3 > .ct-training__field")).toContain('flex: 1 1 200px');
  });

  it('point 1 : Quantité et Heure se partagent la largeur de la carte (minmax(0, 1fr)), jamais plus larges qu’elle', () => {
    const source = css('src/features/nutrition/NutritionScreen.css');
    expect(rule(source, '.ct-nutrition__row')).toContain('grid-auto-columns: minmax(0, 1fr)');
    expect(rule(source, '.ct-nutrition__input')).toContain('max-width: 100%');
  });

  it('point 2 : le bas des écrans Nutrition garde la hauteur de la barre d’onglets plus la zone de sécurité', () => {
    expect(rule(css('src/features/nutrition/NutritionScreen.css'), ".ct-nutrition-shell[data-layout='mobile']")).toContain('calc(var(--ct-tab-bar-height) + var(--ct-safe-area-bottom))');
  });

  it('point 4 : un contrôle segmenté défilant reste sur une seule ligne', () => {
    const block = rule(css('src/ui/SegmentedControl.css'), ".ct-segmented[data-scroll='true']");
    expect(block).toContain('flex-wrap: nowrap');
    expect(block).toContain('overflow-x: auto');
  });
});
