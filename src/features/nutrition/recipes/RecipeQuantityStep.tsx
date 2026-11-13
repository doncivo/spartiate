import { useRef, useState } from 'react';
import { entryFromRecipe, recipeWeightG, validateMealEntry, type Recipe } from '../../../domain/nutrition';
import type { LocalDate, LocalTime } from '../../../domain/types';
import { formatInt, formatTenth, orDash, tNutrition } from '../../../i18n/nutritionText';
import { tRecipes } from '../../../i18n/recipesText';
import { Button, SegmentedControl } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { MacroLine, NumberField, parseNumber, revealAfterKeyboard, TimeField } from '../shared';

type Mode = 'servings' | 'grams';

export interface RecipeQuantityStepProps {
  readonly recipe: Recipe;
  readonly date: LocalDate;
  readonly defaultTime: string;
  /** Section Recettes : le jour est choisi ici (par défaut `date`, au plus `maxDate`). Dans la recherche du Journal : le jour affiché, sans choix. */
  readonly chooseDay?: { readonly max: LocalDate };
  readonly onBack: () => void;
  /** Appelé après l'écriture de l'entrée ; reçoit le nom de la recette. */
  readonly onSaved: (name: string) => void;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ajout d'une recette au journal (I4-07, § 15.3) : par portions (défaut 1) ou par grammes, heure et jour. Les valeurs sont calculées par le
 * domaine (`entryFromRecipe`) et FIGÉES dans l'entrée : modifier la recette ensuite ne change pas une entrée déjà écrite. Un nutriment
 * inconnu reste « — ». Rien n'est écrit avant « Ajouter au journal ».
 */
export function RecipeQuantityStep({ recipe, date, defaultTime, chooseDay, onBack, onSaved }: RecipeQuantityStepProps) {
  const { data } = useAppContainer();
  const [mode, setMode] = useState<Mode>('servings');
  const [amount, setAmount] = useState('1');
  const [time, setTime] = useState(defaultTime);
  const [day, setDay] = useState<string>(date);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const reveal = (): void => revealAfterKeyboard(actionsRef.current);

  const servingGrams = recipeWeightG(recipe) / recipe.servings;
  const parsed = parseNumber(amount);
  const dayOk = DAY.test(day) && (chooseDay === undefined || day <= chooseDay.max);
  const draft =
    typeof parsed === 'number' && dayOk
      ? entryFromRecipe(recipe, mode === 'servings' ? { kind: 'servings', n: parsed } : { kind: 'grams', g: parsed }, { date: day as LocalDate, time: time as LocalTime })
      : null;
  const valid = draft !== null && validateMealEntry(draft).length === 0;

  function changeMode(next: Mode): void {
    setMode(next);
    setAmount(next === 'servings' ? '1' : String(Math.round(servingGrams * 10) / 10));
  }

  async function save(): Promise<void> {
    if (!valid || draft === null || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await (await data.repos.mealEntries()).create(draft);
      onSaved(recipe.name);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <form
      className="ct-nutrition__panel ct-nutrition__form ct-flat"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h2 className="ct-nutrition__subtitle ct-section-title">{tRecipes('quantityTitle', { name: recipe.name })}</h2>
      <p className="ct-nutrition__muted">
        {tRecipes(recipe.servings === 1 ? 'servingsOne' : 'servingsMany', { n: recipe.servings })} · {tRecipes('oneServingGrams', { n: formatTenth(Math.round(servingGrams * 10) / 10) })}
      </p>
      <SegmentedControl<Mode>
        label={tRecipes('modeLabel')}
        value={mode}
        onChange={changeMode}
        options={[
          { value: 'servings', label: tRecipes('byServings') },
          { value: 'grams', label: tRecipes('byGrams') },
        ]}
      />
      <div className="ct-nutrition__row">
        <NumberField label={tRecipes(mode === 'servings' ? 'servingsField' : 'gramsField')} value={amount} onChange={setAmount} invalid={!valid && amount !== ''} autoFocus onFocus={reveal} />
        <TimeField value={time} onChange={setTime} onFocus={reveal} />
      </div>
      {chooseDay === undefined ? null : (
        <label className="ct-nutrition__field">
          <span className="ct-nutrition__field-label">{tRecipes('dayField')}</span>
          <input className="ct-nutrition__input" type="date" value={day} max={chooseDay.max} aria-invalid={!dayOk || undefined} onFocus={reveal} onChange={(event) => setDay(event.target.value)} />
        </label>
      )}
      <div className="ct-nutrition__totals" aria-label={tRecipes('entryTotals')}>
        <strong className="ct-nutrition__num">{draft === null || draft.kcal === null ? tNutrition('unknown') : tNutrition('kcalValue', { n: orDash(draft.kcal, formatInt) })}</strong>
        {draft === null ? null : <MacroLine p={orDash(draft.proteinG)} c={orDash(draft.carbG)} f={orDash(draft.fatG)} />}
        {draft?.grams == null ? null : <span className="ct-nutrition__muted ct-nutrition__num">{tNutrition('gramsValue', { n: formatTenth(draft.grams) })}</span>}
      </div>
      <p className="ct-nutrition__muted">{tRecipes('snapshotNote')}</p>
      {!valid && amount !== '' ? (
        <p role="alert" className="ct-nutrition__warning">
          {tRecipes('quantityInvalid')}
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="ct-nutrition__warning">
          {tRecipes('writeError')}
        </p>
      ) : null}
      <div className="ct-nutrition__actions" ref={actionsRef}>
        <Button type="submit" disabled={!valid || busy}>
          {tRecipes('addToJournal')}
        </Button>
        <Button variant="secondary" onClick={onBack}>
          {tRecipes('back')}
        </Button>
      </div>
    </form>
  );
}
