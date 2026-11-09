import type { RecipeSearchable } from '../../../domain/nutrition';
import { formatInt } from '../../../i18n/nutritionText';
import { tRecipes } from '../../../i18n/recipesText';

export interface RecipeHitsProps {
  readonly hits: readonly RecipeSearchable[];
  readonly failed: boolean;
  readonly onPick: (ref: string) => void;
}

/**
 * Recettes dans les résultats de la recherche du Journal (I4-07), avec leur badge « Recette » (jamais seulement une couleur). Bloc à la
 * demande : les textes viennent du catalogue des recettes. Choisir une recette ouvre l'étape « portions ou grammes ».
 */
export function RecipeHits({ hits, failed, onPick }: RecipeHitsProps) {
  return (
    <>
      {failed ? (
        <p role="status" className="ct-nutrition__warning">
          {tRecipes('loadError')}
        </p>
      ) : null}
      {hits.length === 0 ? null : (
        <ul className="ct-nutrition__list" aria-label={tRecipes('listLabel')}>
          {hits.map((hit) => (
            <li key={hit.ref}>
              <button type="button" data-hit className="ct-nutrition__hit" onClick={() => onPick(hit.ref)}>
                <span className="ct-nutrition__hit-name">{hit.name}</span>
                <span className="ct-nutrition__badge ct-nutrition__badge--recipe">{tRecipes('badge')}</span>
                <span className="ct-nutrition__muted ct-nutrition__num">
                  {hit.kcalPerServing === null ? tRecipes('kcalPerServingUnknown') : tRecipes('kcalPerServing', { n: formatInt(hit.kcalPerServing) })}
                  {' · '}
                  {tRecipes(hit.servings === 1 ? 'servingsOne' : 'servingsMany', { n: hit.servings })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
