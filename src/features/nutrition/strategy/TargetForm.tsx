import { useEffect, useState } from 'react';
import { NUTRITION_CONFIG, type Target } from '../../../domain/nutrition';
import { tNutrition } from '../../../i18n/nutritionText';
import { Button } from '../../../ui';
import { NumberField, parseNumber } from '../shared';

export type TargetSaveResult = 'saved' | 'confirmation-required' | 'rejected' | 'error';

export interface TargetFormProps {
  readonly title: string;
  readonly initial: Target | null;
  readonly submitLabel: string;
  /** Écrit (ou refuse) la cible ; la confirmation du plancher est transmise. */
  readonly onSave: (target: Target, lowFloorConfirmed: boolean) => Promise<TargetSaveResult>;
  /** Valeurs lues à chaque modification (`null` si un champ n'est pas valide) : sert aux avertissements de l'appelant. */
  readonly onChange?: (target: Target | null) => void;
  readonly onCancel?: () => void;
  readonly children?: React.ReactNode;
}

const text = (n: number | undefined): string => (n === undefined ? '' : String(n));

/**
 * Cible de calories et de macros saisie par Ali (I4-03, § 15.2). Il a le dernier mot : ses valeurs sont enregistrées telles quelles, avec
 * la source « manuelle ». Seul le plancher est un garde-fou : sous 1 200 kcal, une confirmation explicite ; sous 800 kcal, refus.
 */
export function TargetForm({ title, initial, submitLabel, onSave, onChange, onCancel, children }: TargetFormProps) {
  const [kcal, setKcal] = useState(text(initial?.kcal));
  const [protein, setProtein] = useState(text(initial?.proteinG));
  const [fat, setFat] = useState(text(initial?.fatG));
  const [carb, setCarb] = useState(text(initial?.carbG));
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const energy = parseNumber(kcal);
  const p = parseNumber(protein);
  const f = parseNumber(fat);
  const c = parseNumber(carb);
  const parsed: Target | null = typeof energy === 'number' && energy > 0 && typeof p === 'number' && typeof f === 'number' && typeof c === 'number' ? { kcal: energy, proteinG: p, fatG: f, carbG: c } : null;
  const belowFloor = parsed !== null && parsed.kcal < NUTRITION_CONFIG.floorKcal && parsed.kcal >= NUTRITION_CONFIG.confirmedFloorKcal;

  useEffect(() => {
    onChange?.(parsed);
    // `parsed` est recréé à chaque rendu : les champs sont les vraies dépendances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [energy, p, f, c]);

  async function submit(): Promise<void> {
    if (busy) return;
    if (parsed === null) return setMessage(tNutrition('targetInvalid'));
    setBusy(true);
    setMessage(null);
    const result = await onSave(parsed, confirmed);
    setBusy(false);
    if (result === 'confirmation-required') setMessage(tNutrition('floorConfirmNeeded'));
    else if (result === 'rejected') setMessage(parsed.kcal < NUTRITION_CONFIG.confirmedFloorKcal ? tNutrition('floorRejected') : tNutrition('targetInvalid'));
    else if (result === 'error') setMessage(tNutrition('writeError'));
  }

  return (
    <form
      className="ct-nutrition__form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h2 className="ct-nutrition__subtitle ct-section-title">{title}</h2>
      <p className="ct-nutrition__muted">{tNutrition('targetFormHint')}</p>
      <div className="ct-nutrition__row">
        <NumberField label={tNutrition('kcalLabel')} value={kcal} onChange={setKcal} step="1" />
        <NumberField label={tNutrition('proteinLabel')} value={protein} onChange={setProtein} step="1" />
      </div>
      <div className="ct-nutrition__row">
        <NumberField label={tNutrition('fatLabel')} value={fat} onChange={setFat} step="1" />
        <NumberField label={tNutrition('carbLabel')} value={carb} onChange={setCarb} step="1" />
      </div>
      {belowFloor ? (
        <label className="ct-nutrition__check">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          <span>{tNutrition('floorConfirm')}</span>
        </label>
      ) : null}
      {children}
      {message ? (
        <p role="alert" className="ct-nutrition__warning">
          {message}
        </p>
      ) : null}
      <div className="ct-nutrition__actions">
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            {tNutrition('cancel')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
