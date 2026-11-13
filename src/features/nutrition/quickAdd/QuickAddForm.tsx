import { useState, type KeyboardEvent } from 'react';
import { QUICK_ADD_KCAL_MAX, validateMealEntry } from '../../../domain/nutrition';
import type { LocalDate, LocalTime } from '../../../domain/types';
import { tNutrition } from '../../../i18n/nutritionText';
import { Button } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { NumberField, parseNumber, TimeField } from '../shared';
import { quickAddDraft } from '../useCases';

export interface QuickAddFormProps {
  readonly date: LocalDate;
  readonly defaultTime: string;
  readonly onSaved: () => void;
  readonly onClose: () => void;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Ajout rapide (I4-03, § 15.3) : calories obligatoires, macros facultatives. Un champ vide reste inconnu (`null`), jamais 0. L'entrée
 * n'est enregistrée qu'après « Ajouter » ; chaque valeur reste modifiable jusque-là.
 */
export function QuickAddForm({ date, defaultTime, onSaved, onClose }: QuickAddFormProps) {
  const { data } = useAppContainer();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carb, setCarb] = useState('');
  const [time, setTime] = useState(defaultTime);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(): Promise<void> {
    if (busy) return;
    const energy = parseNumber(kcal);
    if (typeof energy !== 'number') return setError(tNutrition('kcalRequired'));
    if (energy > QUICK_ADD_KCAL_MAX) return setError(tNutrition('kcalTooHigh'));
    const p = parseNumber(protein);
    const f = parseNumber(fat);
    const c = parseNumber(carb);
    if (p === undefined || f === undefined || c === undefined) return setError(tNutrition('valueInvalid'));
    if (!TIME.test(time)) return setError(tNutrition('timeInvalid'));
    const draft = quickAddDraft({ date, time: time as LocalTime, name, kcal: energy, proteinG: p, fatG: f, carbG: c });
    if (validateMealEntry(draft).length > 0) return setError(tNutrition('valueInvalid'));
    setBusy(true);
    setError(null);
    try {
      await (await data.repos.mealEntries()).create(draft);
      onSaved();
    } catch {
      setError(tNutrition('writeError'));
      setBusy(false);
    }
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
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
      <h2 className="ct-nutrition__subtitle ct-section-title">{tNutrition('quickTitle')}</h2>
      <p className="ct-nutrition__muted">{tNutrition('quickIntro')}</p>
      <label className="ct-nutrition__field">
        <span className="ct-nutrition__field-label">{tNutrition('quickName')}</span>
        <input className="ct-nutrition__input" type="text" maxLength={200} value={name} placeholder={tNutrition('quickNamePlaceholder')} onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="ct-nutrition__row">
        <NumberField label={tNutrition('kcalLabel')} value={kcal} onChange={setKcal} autoFocus />
        <TimeField value={time} onChange={setTime} />
      </div>
      <div className="ct-nutrition__row">
        <NumberField label={tNutrition('proteinLabel')} value={protein} onChange={setProtein} />
        <NumberField label={tNutrition('carbLabel')} value={carb} onChange={setCarb} />
        <NumberField label={tNutrition('fatLabel')} value={fat} onChange={setFat} />
      </div>
      {error ? (
        <p role="alert" className="ct-nutrition__warning">
          {error}
        </p>
      ) : null}
      <div className="ct-nutrition__actions">
        <Button type="submit" disabled={busy}>
          {tNutrition('add')}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {tNutrition('cancel')}
        </Button>
      </div>
    </form>
  );
}
