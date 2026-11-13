import { useState, type KeyboardEvent } from 'react';
import { QUICK_ADD_KCAL_MAX, rescaleEntry } from '../../../domain/nutrition';
import type { LocalTime } from '../../../domain/types';
import type { MealEntryRecord } from '../../../db/repositories/mealEntryRepository';
import { formatInt, orDash, tNutrition } from '../../../i18n/nutritionText';
import { Button } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { NumberField, parseNumber, ProvenanceBadge, TimeField } from '../shared';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const text = (n: number | null): string => (n === null ? '' : String(n));

export interface EntryEditorProps {
  readonly entry: MealEntryRecord;
  readonly onSaved: () => void;
  readonly onClose: () => void;
}

/**
 * Correction d'une entrée déjà enregistrée (I4-03, critère 2 ; une ligne de photo est corrigeable avant et après enregistrement).
 * Entrée avec masse (recherche, scan, estimation) : les grammes recalculent les totaux et la provenance est conservée.
 * Entrée sans masse (Quick Add) : calories et macros directement ; un champ vidé redevient inconnu, jamais 0.
 */
export function EntryEditor({ entry, onSaved, onClose }: EntryEditorProps) {
  const { data } = useAppContainer();
  const byGrams = entry.grams !== null;
  const [name, setName] = useState(entry.foodName);
  const [grams, setGrams] = useState(text(entry.grams));
  const [kcal, setKcal] = useState(text(entry.kcal));
  const [protein, setProtein] = useState(text(entry.proteinG));
  const [fat, setFat] = useState(text(entry.fatG));
  const [carb, setCarb] = useState(text(entry.carbG));
  const [time, setTime] = useState<string>(entry.time);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amount = parseNumber(grams);
  const preview = byGrams && typeof amount === 'number' ? rescaleEntry(entry, amount) : null;
  const valid = TIME.test(time) && (!byGrams || preview !== null);

  async function save(): Promise<void> {
    if (busy) return;
    if (!TIME.test(time)) return setError(tNutrition('timeInvalid'));
    let patch: Parameters<Awaited<ReturnType<typeof data.repos.mealEntries>>['update']>[1];
    if (byGrams) {
      if (preview === null) return setError(tNutrition('quantityInvalid'));
      patch = { ...preview, time: time as LocalTime };
    } else {
      const energy = parseNumber(kcal);
      if (typeof energy !== 'number') return setError(tNutrition('kcalRequired'));
      if (energy > QUICK_ADD_KCAL_MAX) return setError(tNutrition('kcalTooHigh'));
      const p = parseNumber(protein);
      const f = parseNumber(fat);
      const c = parseNumber(carb);
      if (p === undefined || f === undefined || c === undefined) return setError(tNutrition('valueInvalid'));
      const trimmed = name.trim();
      patch = { foodName: trimmed === '' ? entry.foodName : trimmed.slice(0, 200), kcal: energy, proteinG: p, fatG: f, carbG: c, time: time as LocalTime };
    }
    setBusy(true);
    setError(null);
    try {
      await (await data.repos.mealEntries()).update(entry.id, patch);
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
      className="ct-nutrition__panel ct-nutrition__form"
      onKeyDown={onKeyDown}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="ct-nutrition__food-head">
        <h2 className="ct-nutrition__subtitle ct-section-title">{tNutrition('editTitle')}</h2>
        <ProvenanceBadge source={entry.source} />
      </div>
      {byGrams ? (
        <>
          <p>{entry.foodName}</p>
          <div className="ct-nutrition__row">
            <NumberField label={tNutrition('quantityLabel')} value={grams} onChange={setGrams} invalid={preview === null} autoFocus />
            <TimeField value={time} onChange={setTime} />
          </div>
          <p className="ct-nutrition__muted">{tNutrition('editFoodHint')}</p>
          <p className="ct-nutrition__totals ct-nutrition__num">
            <strong>{preview === null ? tNutrition('unknown') : tNutrition('kcalValue', { n: orDash(preview.kcal, formatInt) })}</strong>
          </p>
        </>
      ) : (
        <>
          <label className="ct-nutrition__field">
            <span className="ct-nutrition__field-label">{tNutrition('quickName')}</span>
            <input className="ct-nutrition__input" type="text" maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
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
          <p className="ct-nutrition__muted">{tNutrition('editQuickHint')}</p>
        </>
      )}
      {error ? (
        <p role="alert" className="ct-nutrition__warning">
          {error}
        </p>
      ) : null}
      <div className="ct-nutrition__actions">
        <Button type="submit" disabled={busy || !valid}>
          {tNutrition('saveCorrection')}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {tNutrition('cancel')}
        </Button>
      </div>
    </form>
  );
}
