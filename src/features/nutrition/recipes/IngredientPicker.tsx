import { useEffect, useRef, useState } from 'react';
import { ingredientFromFood, type DraftIngredient } from '../../../domain/nutrition';
import type { SearchableFood } from '../../../domain/nutrition/foodSearch';
import type { IsoDateTime } from '../../../domain/types';
import { formatInt, tNutrition } from '../../../i18n/nutritionText';
import { tRecipes } from '../../../i18n/recipesText';
import { Button } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { searchCatalogue, type CatalogueSearchResult } from '../search/catalogueSearch';
import { CustomFoodForm } from '../search/CustomFoodForm';
import { NumberField, parseNumber, ProvenanceBadge } from '../shared';

export interface IngredientPickerProps {
  readonly onAdd: (ingredient: DraftIngredient) => void;
  readonly onBack: () => void;
}

const per100g = (food: SearchableFood): string => (food.per100g.kcal === null ? tRecipes('pickerPer100gUnknown') : tRecipes('pickerPer100g', { kcal: formatInt(food.per100g.kcal) }));

/**
 * Choix d'un ingrédient (I4-07) avec les briques de la recherche du Journal : fiches Perso, Ciqual et cache Open Food Facts, sans réseau
 * (`searchCatalogue`), fiche personnelle créable (`CustomFoodForm`). L'instantané pour 100 g est pris par `ingredientFromFood` ; les grammes
 * sont saisis ensuite. Rien n'est ajouté à la recette avant « Ajouter à la recette ».
 */
export function IngredientPicker({ onAdd, onBack }: IngredientPickerProps) {
  const container = useAppContainer();
  const { data } = container;
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ readonly query: string; readonly result: CatalogueSearchResult } | null>(null);
  const [selected, setSelected] = useState<{ readonly food: SearchableFood; readonly grams: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    const ticket = (request.current += 1);
    if (query.trim() === '') return;
    void (async () => {
      try {
        const result = await searchCatalogue(await data.repos.foods(), query, { now: new Date(container.clock.nowMs()).toISOString() as IsoDateTime });
        if (ticket === request.current) setFound({ query, result });
      } catch {
        if (ticket === request.current) setFound({ query, result: { hits: [], ciqual: 'unavailable', staleOff: [] } });
      }
    })();
  }, [query, data, container]);

  if (creating) {
    return (
      <CustomFoodForm
        initialName={query.trim()}
        onCreated={(food) => {
          setCreating(false);
          setSelected({ food, grams: '100' });
        }}
        onCancel={() => setCreating(false)}
      />
    );
  }

  if (selected) {
    const grams = parseNumber(selected.grams);
    const ingredient = typeof grams === 'number' ? ingredientFromFood(selected.food, grams) : null;
    return (
      <form
        className="ct-nutrition__panel ct-nutrition__form"
        onSubmit={(event) => {
          event.preventDefault();
          if (ingredient !== null) onAdd(ingredient);
        }}
      >
        <div className="ct-nutrition__food-head">
          <h2 className="ct-nutrition__subtitle">{selected.food.name}</h2>
          <ProvenanceBadge source={selected.food.provenance} />
          <span className="ct-nutrition__muted ct-nutrition__num">{per100g(selected.food)}</span>
        </div>
        <NumberField label={tRecipes('pickerGrams')} value={selected.grams} onChange={(value) => setSelected({ ...selected, grams: value })} invalid={ingredient === null && selected.grams !== ''} autoFocus />
        {ingredient === null && selected.grams !== '' ? (
          <p role="alert" className="ct-nutrition__warning">
            {tRecipes('pickerGramsInvalid')}
          </p>
        ) : null}
        <div className="ct-nutrition__actions">
          <Button type="submit" disabled={ingredient === null}>
            {tRecipes('pickerAdd')}
          </Button>
          <Button variant="secondary" onClick={() => setSelected(null)}>
            {tRecipes('pickerChange')}
          </Button>
        </div>
      </form>
    );
  }

  const result = found !== null && found.query === query ? found.result : null;
  return (
    <div className="ct-nutrition__panel">
      <h2 className="ct-nutrition__subtitle">{tRecipes('pickerTitle')}</h2>
      <label className="ct-nutrition__field">
        <span className="ct-nutrition__field-label">{tRecipes('pickerSearch')}</span>
        <input className="ct-nutrition__input" type="search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <p className="ct-nutrition__muted">{tRecipes('pickerHint')}</p>
      {result === null ? null : (
        <section aria-label={tNutrition('searchResults')}>
          {result.ciqual === 'unavailable' ? (
            <p role="status" className="ct-nutrition__warning">
              {tNutrition('ciqualUnavailable')}
            </p>
          ) : null}
          {result.hits.length === 0 ? (
            <p>{tRecipes('pickerEmpty')}</p>
          ) : (
            <ul className="ct-nutrition__list">
              {result.hits.map((hit) => (
                <li key={hit.ref}>
                  <button type="button" className="ct-nutrition__hit" onClick={() => setSelected({ food: hit, grams: '100' })}>
                    <span className="ct-nutrition__hit-name">
                      {hit.name}
                      {hit.brand ? <span className="ct-nutrition__muted"> · {hit.brand}</span> : null}
                    </span>
                    <ProvenanceBadge source={hit.provenance} />
                    <span className="ct-nutrition__muted ct-nutrition__num">{per100g(hit)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div className="ct-nutrition__actions">
        <Button variant="secondary" disabled={query.trim() === ''} onClick={() => setCreating(true)}>
          {tRecipes('pickerCreate')}
        </Button>
        <Button variant="secondary" onClick={onBack}>
          {tRecipes('pickerBack')}
        </Button>
      </div>
    </div>
  );
}
