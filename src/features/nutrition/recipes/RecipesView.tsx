import { useCallback, useEffect, useState } from 'react';
import { recipePerServing, type Recipe } from '../../../domain/nutrition';
import type { LocalDate } from '../../../domain/types';
import { formatInt } from '../../../i18n/nutritionText';
import { tRecipes } from '../../../i18n/recipesText';
import { Button, ConfirmDialog } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { useSyncedData } from '../../sync/remoteChanges';
import { nowTime } from '../shared';
import { RecipeEditor } from './RecipeEditor';
import { RecipeQuantityStep } from './RecipeQuantityStep';
import './Recipes.css';

type Load = { readonly status: 'loading' } | { readonly status: 'error' } | { readonly status: 'ready'; readonly list: readonly Recipe[] };
type View = { readonly kind: 'list' } | { readonly kind: 'new' } | { readonly kind: 'edit'; readonly recipe: Recipe } | { readonly kind: 'add'; readonly recipe: Recipe };

export interface RecipesViewProps {
  readonly today: LocalDate;
  /** Relit l'instantané de Nutrition après une prise écrite dans le journal. */
  readonly onChanged: () => Promise<void>;
}

/**
 * Section « Recettes » de Nutrition (I4-07, § 15.3, D-80) : liste (nom, portions, kcal par portion ou « — »), création et modification,
 * ajout au journal (portions ou grammes) et suppression avec confirmation. Bloc à la demande, avec son catalogue de textes ; les recettes
 * ne sont lues qu'à l'ouverture de la section. États : chargement, vide, erreur avec « Réessayer ».
 */
export function RecipesView({ today, onChanged }: RecipesViewProps) {
  const container = useAppContainer();
  const { data } = container;
  const [state, setState] = useState<Load>({ status: 'loading' });
  const [view, setView] = useState<View>({ kind: 'list' });
  const [toDelete, setToDelete] = useState<Recipe | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const synced = useSyncedData(['recipe', 'recipe_ingredient']);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const list = await (await data.repos.recipes()).list();
        if (live) setState({ status: 'ready', list });
      } catch {
        // Lecture en échec : message et « Réessayer » ; une liste déjà lue reste affichée.
        if (live) setState((now) => (now.status === 'ready' ? now : { status: 'error' }));
      }
    })();
    return () => {
      live = false;
    };
  }, [data, version, synced]);

  async function confirmDelete(): Promise<void> {
    const recipe = toDelete;
    setToDelete(null);
    if (recipe === null) return;
    try {
      await (await data.repos.recipes()).softDelete(recipe.id);
      setError(null);
      setNotice(null);
      reload();
    } catch {
      setError(tRecipes('writeError'));
    }
  }

  if (view.kind === 'new' || view.kind === 'edit') {
    return (
      <div className="ct-nutrition__journal" data-testid="recipes">
        <RecipeEditor
          recipe={view.kind === 'edit' ? view.recipe : null}
          onCancel={() => setView({ kind: 'list' })}
          onSaved={() => {
            setView({ kind: 'list' });
            setNotice(null);
            reload();
          }}
        />
      </div>
    );
  }

  if (view.kind === 'add') {
    return (
      <div className="ct-nutrition__journal" data-testid="recipes">
        <RecipeQuantityStep
          recipe={view.recipe}
          date={today}
          defaultTime={nowTime(container.clock.nowMs())}
          chooseDay={{ max: today }}
          onBack={() => setView({ kind: 'list' })}
          onSaved={(name) => {
            setView({ kind: 'list' });
            setNotice(tRecipes('added', { name }));
            void onChanged();
          }}
        />
      </div>
    );
  }

  return (
    <div className="ct-nutrition__journal" data-testid="recipes">
      <div className="ct-nutrition__actions">
        <Button onClick={() => setView({ kind: 'new' })}>{tRecipes('newRecipe')}</Button>
      </div>
      {notice ? (
        <p role="status" className="ct-nutrition__coverage-title">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="ct-nutrition__warning">
          {error}
        </p>
      ) : null}
      {state.status === 'loading' ? (
        <p className="ct-nutrition__muted" role="status">
          {tRecipes('loading')}
        </p>
      ) : state.status === 'error' ? (
        <div role="alert" className="ct-nutrition__error">
          <p>{tRecipes('loadError')}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setState({ status: 'loading' });
              reload();
            }}
          >
            {tRecipes('retry')}
          </Button>
        </div>
      ) : state.list.length === 0 ? (
        <div className="ct-nutrition__card" role="status">
          <p className="ct-nutrition__coverage-title">{tRecipes('empty')}</p>
          <p className="ct-nutrition__muted">{tRecipes('emptyHint')}</p>
        </div>
      ) : (
        <ul className="ct-recipe__list" aria-label={tRecipes('listLabel')}>
          {state.list.map((recipe) => {
            const kcal = recipePerServing(recipe).kcal;
            return (
              <li key={recipe.id} className="ct-recipe__item">
                <div className="ct-recipe__item-main">
                  <p className="ct-nutrition__entry-name">{recipe.name}</p>
                  <p className="ct-nutrition__muted ct-nutrition__num">
                    {tRecipes(recipe.servings === 1 ? 'servingsOne' : 'servingsMany', { n: recipe.servings })}
                    {' · '}
                    {kcal === null ? tRecipes('kcalPerServingUnknown') : tRecipes('kcalPerServing', { n: formatInt(kcal) })}
                  </p>
                </div>
                <div className="ct-nutrition__actions">
                  <Button ariaLabel={tRecipes('addRecipe', { name: recipe.name })} onClick={() => { setNotice(null); setView({ kind: 'add', recipe }); }}>
                    {tRecipes('addShort')}
                  </Button>
                  <Button variant="secondary" ariaLabel={tRecipes('editRecipe', { name: recipe.name })} onClick={() => { setNotice(null); setView({ kind: 'edit', recipe }); }}>
                    {tRecipes('edit')}
                  </Button>
                  <Button variant="secondary" ariaLabel={tRecipes('deleteRecipe', { name: recipe.name })} onClick={() => setToDelete(recipe)}>
                    {tRecipes('delete')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {toDelete ? (
        <ConfirmDialog
          title={tRecipes('deleteTitle', { name: toDelete.name })}
          description={tRecipes('deleteDescription')}
          confirmLabel={tRecipes('delete')}
          cancelLabel={tRecipes('cancel')}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        />
      ) : null}
    </div>
  );
}
