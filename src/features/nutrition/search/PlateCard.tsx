import { useState } from 'react';
import { FOOD_GRAMS_MAX, plateTotals, type Plate } from '../../../domain/nutrition';
import type { LocalTime } from '../../../domain/types';
import { formatInt, orDash, tNutrition } from '../../../i18n/nutritionText';
import { Button } from '../../../ui';
import { MacroLine, NumberField, parseNumber, TimeField } from '../shared';

export interface PlateCardProps {
  readonly plate: Plate;
  readonly busy: boolean;
  readonly failed: boolean;
  readonly onRemove: (ref: string) => void;
  readonly onClear: () => void;
  readonly onCommit: () => void;
  /** BL-117 : quantité et heure propres à chaque aliment, enregistrement en recette (le parent écrit ; `true` si la recette est enregistrée). */
  readonly onGrams: (ref: string, grams: number) => void;
  readonly onTime: (ref: string, time: LocalTime | null) => void;
  readonly onSaveRecipe: (name: string) => Promise<'saved' | 'invalid' | 'error'>;
  readonly defaultTime: string;
}

/** Assiette en cours (§ 15.3) : aliments, quantités et total ; un nutriment inconnu s'écrit « — ». Rien n'est écrit avant « Ajouter l'assiette au journal ». */
export function PlateCard({ plate, busy, failed, onRemove, onClear, onCommit, onGrams, onTime, onSaveRecipe, defaultTime }: PlateCardProps) {
  const totals = plateTotals(plate);
  // Texte en cours de frappe par aliment (« 12, » reste saisissable) ; la quantité n'est reprise que si elle est valide.
  const [typed, setTyped] = useState<Readonly<Record<string, string>>>({});
  // Une quantité saisie hors bornes (0, > 10 000, illisible) n'est jamais reprise en silence : le champ est invalide, dit pourquoi, et l'ajout est bloqué.
  const badGrams = plate.filter((item) => {
    const text = typed[item.food.ref];
    if (text === undefined) return false;
    const n = parseNumber(text);
    return typeof n !== 'number' || !(n > 0) || n > FOOD_GRAMS_MAX;
  });
  const [recipeName, setRecipeName] = useState('');
  const [recipeState, setRecipeState] = useState<'idle' | 'saved' | 'invalid' | 'error'>('idle');
  // Double appui : une seule création de recette à la fois.
  const [savingRecipe, setSavingRecipe] = useState(false);
  return (
    <section className="ct-nutrition__panel ct-flat" aria-label={tNutrition('plateTitle')}>
      <h2 className="ct-nutrition__subtitle ct-section-title">{tNutrition('plateTitle')}</h2>
      <ul className="ct-nutrition__list">
        {plate.map((item) => (
          <li key={item.food.ref} className="ct-nutrition__row">
            <span className="ct-nutrition__num">{item.food.name}</span>
            <NumberField
              label={tNutrition('plateGramsLabel', { name: item.food.name })}
              value={typed[item.food.ref] ?? String(item.grams).replace('.', ',')}
              invalid={badGrams.includes(item)}
              onChange={(value) => {
                setTyped((current) => ({ ...current, [item.food.ref]: value }));
                const grams = parseNumber(value);
                if (typeof grams === 'number') onGrams(item.food.ref, grams);
              }}
            />
            <TimeField value={item.time ?? defaultTime} label={tNutrition('plateTimeLabel', { name: item.food.name })} onChange={(value) => onTime(item.food.ref, value === '' ? null : (value as LocalTime))} />
            <Button variant="secondary" ariaLabel={tNutrition('plateRemove', { name: item.food.name })} onClick={() => onRemove(item.food.ref)}>
              <span aria-hidden="true">×</span>
            </Button>
          </li>
        ))}
      </ul>
      <div className="ct-nutrition__totals" aria-label={tNutrition('totalsLabel')}>
        <strong className="ct-nutrition__num">{tNutrition('kcalValue', { n: orDash(totals.kcal, formatInt) })}</strong>
        <MacroLine p={orDash(totals.proteinG)} c={orDash(totals.carbG)} f={orDash(totals.fatG)} />
      </div>
      <div className="ct-nutrition__row">
        <label className="ct-nutrition__field">
          <span className="ct-nutrition__field-label">{tNutrition('plateRecipeName')}</span>
          <input className="ct-nutrition__input" type="text" value={recipeName} onChange={(event) => { setRecipeName(event.target.value); setRecipeState('idle'); }} />
        </label>
        <Button
          variant="secondary"
          disabled={savingRecipe}
          onClick={() => {
            if (savingRecipe) return;
            setSavingRecipe(true);
            void onSaveRecipe(recipeName)
              .then(setRecipeState)
              .finally(() => setSavingRecipe(false));
          }}
        >
          {tNutrition('plateRecipeSave')}
        </Button>
      </div>
      {recipeState === 'saved' ? <p role="status">{tNutrition('plateRecipeSaved')}</p> : null}
      {recipeState === 'invalid' ? <p role="alert" className="ct-nutrition__warning">{tNutrition('plateRecipeInvalid')}</p> : null}
      {recipeState === 'error' ? <p role="alert" className="ct-nutrition__warning">{tNutrition('plateRecipeError')}</p> : null}
      {badGrams.map((item) => (
        <p key={item.food.ref} role="alert" className="ct-nutrition__warning">
          {tNutrition('plateGramsInvalid', { name: item.food.name })}
        </p>
      ))}
      {failed ? (
        <p role="alert" className="ct-nutrition__warning">
          {tNutrition('writeError')}
        </p>
      ) : null}
      <div className="ct-nutrition__actions">
        <Button disabled={busy || badGrams.length > 0} onClick={onCommit}>
          {tNutrition('plateCommit')}
        </Button>
        <Button variant="secondary" onClick={onClear}>
          {tNutrition('plateClear')}
        </Button>
      </div>
    </section>
  );
}
