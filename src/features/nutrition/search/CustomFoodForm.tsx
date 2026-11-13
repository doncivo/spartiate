import { useState, type KeyboardEvent } from 'react';
import { validateFoodDraft, validatePortion, type FoodDraft } from '../../../domain/nutrition';
import type { SearchableFood } from '../../../domain/nutrition/foodSearch';
import { tNutrition } from '../../../i18n/nutritionText';
import { Button } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { NumberField, parseNumber } from '../shared';
import { toSearchable } from './catalogueSearch';

export interface CustomFoodFormProps {
  readonly initialName: string;
  /** Code-barres normalisé d'un produit inconnu d'Open Food Facts (I4-05) : affiché, non modifiable, enregistré avec la fiche. */
  readonly initialBarcode?: string;
  readonly onCreated: (food: SearchableFood) => void;
  readonly onCancel: () => void;
}

/**
 * Fiche personnelle (I4-03, § 15.3) : nom, valeurs pour 100 g (vides = inconnues, jamais 0) et une portion facultative. Provenance « Perso ».
 * La fiche et sa portion sont écrites ensemble ; rien n'est écrit si l'une d'elles est invalide.
 */
export function CustomFoodForm({ initialName, initialBarcode, onCreated, onCancel }: CustomFoodFormProps) {
  const { data } = useAppContainer();
  const [name, setName] = useState(initialName);
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carb, setCarb] = useState('');
  const [portionName, setPortionName] = useState('');
  const [portionGrams, setPortionGrams] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(): Promise<void> {
    if (busy) return;
    const values = [parseNumber(kcal), parseNumber(protein), parseNumber(fat), parseNumber(carb)];
    if (name.trim() === '') return setError(tNutrition('nameRequired'));
    if (values.some((v) => v === undefined)) return setError(tNutrition('foodInvalid'));
    const [energy, p, f, c] = values as (number | null)[];
    if (values.every((v) => v === null)) return setError(tNutrition('nutrientRequired'));
    const draft: FoodDraft = {
      source: 'custom',
      barcode: initialBarcode ?? null,
      name: name.trim(),
      brand: null,
      per100g: { kcal: energy ?? null, proteinG: p ?? null, fatG: f ?? null, carbG: c ?? null, fiberG: null },
      fetchedAt: null,
    };
    if (validateFoodDraft(draft).length > 0) return setError(tNutrition('foodInvalid'));
    const grams = parseNumber(portionGrams);
    const hasPortion = portionName.trim() !== '' || portionGrams.trim() !== '';
    if (hasPortion && (typeof grams !== 'number' || validatePortion({ label: portionName.trim(), grams, position: 0 }).length > 0)) return setError(tNutrition('portionInvalid'));
    setBusy(true);
    setError(null);
    try {
      const record = await data.transaction(async (repos) => {
        const foods = await repos.foods();
        const created = await foods.create(draft);
        if (hasPortion && typeof grams === 'number') await foods.addPortion(created.id, { label: portionName.trim(), grams });
        return created;
      });
      onCreated(toSearchable(record));
    } catch {
      setError(tNutrition('writeError'));
      setBusy(false);
    }
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <form
      className="ct-nutrition__panel ct-nutrition__form ct-flat"
      onKeyDown={onKeyDown}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h2 className="ct-nutrition__subtitle ct-section-title">{tNutrition('customTitle')}</h2>
      <p className="ct-nutrition__muted">{tNutrition('customIntro')}</p>
      <label className="ct-nutrition__field">
        <span className="ct-nutrition__field-label">{tNutrition('foodNameLabel')}</span>
        <input className="ct-nutrition__input" type="text" maxLength={120} autoFocus value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      {initialBarcode ? (
        <label className="ct-nutrition__field">
          <span className="ct-nutrition__field-label">{tNutrition('barcodeFieldOfForm')}</span>
          <input className="ct-nutrition__input ct-nutrition__num" type="text" readOnly value={initialBarcode} />
        </label>
      ) : null}
      <div className="ct-nutrition__row">
        <NumberField label={tNutrition('kcal100')} value={kcal} onChange={setKcal} />
        <NumberField label={tNutrition('protein100')} value={protein} onChange={setProtein} />
      </div>
      <div className="ct-nutrition__row">
        <NumberField label={tNutrition('fat100')} value={fat} onChange={setFat} />
        <NumberField label={tNutrition('carb100')} value={carb} onChange={setCarb} />
      </div>
      <div className="ct-nutrition__row">
        <label className="ct-nutrition__field">
          <span className="ct-nutrition__field-label">{tNutrition('portionNameField')}</span>
          <input className="ct-nutrition__input" type="text" maxLength={80} value={portionName} onChange={(event) => setPortionName(event.target.value)} />
        </label>
        <NumberField label={tNutrition('portionGramsField')} value={portionGrams} onChange={setPortionGrams} />
      </div>
      {error ? (
        <p role="alert" className="ct-nutrition__warning">
          {error}
        </p>
      ) : null}
      <div className="ct-nutrition__actions">
        <Button type="submit" disabled={busy}>
          {tNutrition('createFoodSubmit')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {tNutrition('cancel')}
        </Button>
      </div>
    </form>
  );
}
