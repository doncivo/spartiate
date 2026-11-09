import { useRef, useState } from 'react';
import { validateRecipeDraft, type DraftIngredient, type Recipe, type RecipeDraft } from '../../../domain/nutrition';
import { tRecipes } from '../../../i18n/recipesText';
import { Button } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { NumberField, parseNumber, ProvenanceBadge } from '../shared';
import { IngredientPicker } from './IngredientPicker';
import { problemMessage, totalsRows } from './recipeModel';
import './Recipes.css';

interface Row {
  readonly key: number;
  readonly ingredient: DraftIngredient;
  /** Grammes en cours de saisie (texte) : corrigeables, validés à l'enregistrement. */
  readonly grams: string;
}

export interface RecipeEditorProps {
  /** `null` : nouvelle recette. */
  readonly recipe: Recipe | null;
  readonly onSaved: () => void;
  readonly onCancel: () => void;
}

const text = (n: number | null): string => (n === null ? '' : String(n));
/** Nombre saisi : vide ou invalide = `NaN`, que `validateRecipeDraft` refuse avec son message (aucun échec silencieux). */
const numberOrNaN = (value: string): number => {
  const n = parseNumber(value);
  return typeof n === 'number' ? n : Number.NaN;
};

/**
 * Création et modification d'une recette (I4-07, § 15.3) : nom, portions, poids cuit facultatif, ingrédients (copiés avec leur instantané pour
 * 100 g, grammes corrigeables, suppression), totaux de la recette et par portion calculés par le domaine : un nutriment inconnu est « — »
 * avec sa cause. `validateRecipeDraft` dit chaque problème en français ; rien n'est écrit tant que la recette n'est pas valide.
 */
export function RecipeEditor({ recipe, onSaved, onCancel }: RecipeEditorProps) {
  const { data } = useAppContainer();
  const counter = useRef(recipe?.ingredients.length ?? 0);
  const [name, setName] = useState(recipe?.name ?? '');
  const [servings, setServings] = useState(String(recipe?.servings ?? 1));
  const [cooked, setCooked] = useState(text(recipe?.cookedWeightG ?? null));
  const [rows, setRows] = useState<readonly Row[]>(() => (recipe?.ingredients ?? []).map((i, key) => ({ key, ingredient: { name: i.name, source: i.source, foodRef: i.foodRef, grams: i.grams, per100g: i.per100g }, grams: String(i.grams) })));
  const [picking, setPicking] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const draft: RecipeDraft = {
    name,
    servings: numberOrNaN(servings),
    cookedWeightG: cooked.trim() === '' ? null : numberOrNaN(cooked),
    ingredients: rows.map((r) => ({ ...r.ingredient, grams: numberOrNaN(r.grams) })),
  };
  const problems = validateRecipeDraft(draft);
  const names = rows.map((r) => r.ingredient.name);
  const stats = totalsRows({ servings: draft.servings, ingredients: draft.ingredients.map((ingredient, position) => ({ ...ingredient, id: String(position), position })) });

  if (picking) {
    return (
      <IngredientPicker
        onBack={() => setPicking(false)}
        onAdd={(ingredient) => {
          counter.current += 1;
          setRows((current) => [...current, { key: counter.current, ingredient, grams: String(ingredient.grams) }]);
          setPicking(false);
        }}
      />
    );
  }

  async function save(): Promise<void> {
    if (busy) return;
    setAttempted(true);
    if (problems.length > 0) return;
    setBusy(true);
    setFailed(false);
    try {
      const repo = await data.repos.recipes();
      if (recipe === null) await repo.create(draft);
      else await repo.update(recipe.id, draft);
      onSaved();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <form
      className="ct-nutrition__panel ct-nutrition__form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h2 className="ct-nutrition__subtitle">{tRecipes(recipe === null ? 'formNew' : 'formEdit')}</h2>
      <label className="ct-nutrition__field">
        <span className="ct-nutrition__field-label">{tRecipes('nameLabel')}</span>
        <input className="ct-nutrition__input" type="text" autoComplete="off" value={name} aria-invalid={(attempted && name.trim() === '') || undefined} onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="ct-nutrition__row">
        <NumberField label={tRecipes('servingsLabel')} value={servings} step="1" onChange={setServings} invalid={attempted && !Number.isInteger(draft.servings)} />
        <NumberField label={tRecipes('cookedLabel')} value={cooked} onChange={setCooked} describedBy="ct-recipe-cooked-hint" />
      </div>
      <p id="ct-recipe-cooked-hint" className="ct-nutrition__muted">
        {tRecipes('cookedHint')}
      </p>

      <h3 className="ct-nutrition__subtitle">{tRecipes('ingredientsTitle')}</h3>
      {rows.length === 0 ? (
        <p className="ct-nutrition__muted">{tRecipes('ingredientsEmpty')}</p>
      ) : (
        <ul className="ct-nutrition__list" aria-label={tRecipes('ingredientsList')}>
          {rows.map((row, index) => (
            <li key={row.key} className="ct-recipe__ingredient">
              <span className="ct-nutrition__hit-name">{row.ingredient.name}</span>
              <ProvenanceBadge source={row.ingredient.source} />
              <NumberField
                label={tRecipes('ingredientGrams', { name: row.ingredient.name })}
                value={row.grams}
                onChange={(value) => setRows((current) => current.map((r) => (r.key === row.key ? { ...r, grams: value } : r)))}
                invalid={attempted && problems.some((p) => p.index === index && p.code === 'ingredient-grams-invalid')}
              />
              <Button variant="secondary" ariaLabel={tRecipes('removeIngredient', { name: row.ingredient.name })} onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}>
                ×
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="ct-nutrition__actions">
        <Button variant="secondary" onClick={() => setPicking(true)}>
          {tRecipes('addIngredient')}
        </Button>
      </div>

      <table className="ct-recipe__table">
        <caption className="ct-nutrition__subtitle">{tRecipes('totalsTitle')}</caption>
        <thead>
          <tr>
            <th scope="col" className="ct-visually-hidden">
              {tRecipes('totalsTitle')}
            </th>
            <th scope="col">{tRecipes('colTotal')}</th>
            <th scope="col">{tRecipes('colServing')}</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((row) => (
            <tr key={row.key}>
              <th scope="row">
                {row.label}
                {row.unknownIn === null ? null : <span className="ct-nutrition__muted ct-recipe__cause">{row.unknownIn}</span>}
              </th>
              <td className="ct-nutrition__num">{row.total}</td>
              <td className="ct-nutrition__num">{row.perServing}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ct-nutrition__muted">{tRecipes('totalsNote')}</p>

      {attempted && problems.length > 0 ? (
        <div role="alert" className="ct-nutrition__warning">
          <p>{tRecipes('problemsTitle')}</p>
          <ul>
            {problems.map((p, i) => (
              <li key={`${p.code}-${String(p.index)}-${String(i)}`}>{problemMessage(p, names)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {failed ? (
        <p role="alert" className="ct-nutrition__warning">
          {tRecipes('writeError')}
        </p>
      ) : null}
      <div className="ct-nutrition__actions">
        <Button type="submit" disabled={busy}>
          {tRecipes('save')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {tRecipes('cancel')}
        </Button>
      </div>
    </form>
  );
}
