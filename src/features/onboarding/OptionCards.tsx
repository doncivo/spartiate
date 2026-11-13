import { useId } from 'react';

/** Choix unique en cartes (aperçu ERGO-02 : objectif, expérience, matériel) : un groupe radio, un libellé et sa précision par carte. */
export interface CardOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** Précision sous le libellé ; absente : carte simple. */
  readonly hint?: string;
}

export interface OptionCardsProps<T extends string> {
  readonly label: string;
  /** Valeur choisie ; `''` : aucune (ou la carte neutre dont la valeur est `''`). */
  readonly value: T | '';
  readonly options: readonly CardOption<T | ''>[];
  /** Un second appui sur la carte choisie la décoche (`''`), sauf pour la carte neutre. */
  readonly onChange: (value: T | '') => void;
  readonly columns: 1 | 2 | 3;
}

export function OptionCards<T extends string>({ label, value, options, onChange, columns }: OptionCardsProps<T>) {
  const baseId = useId();
  const checkedIndex = options.findIndex((o) => o.value === value);
  const tabbable = checkedIndex >= 0 ? checkedIndex : 0;
  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number): void {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const next = (index + step + options.length) % options.length;
    const target = options[next];
    if (target === undefined) return;
    onChange(target.value);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  }
  return (
    <div className="ct-onb__cards" data-columns={columns} role="radiogroup" aria-label={label}>
      {options.map((option, index) => {
        const checked = index === checkedIndex;
        const hintId = option.hint === undefined ? undefined : `${baseId}-${String(index)}`;
        return (
          <button
            key={option.value === '' ? 'none' : option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.label}
            aria-describedby={hintId}
            tabIndex={index === tabbable ? 0 : -1}
            className="ct-onb__card-option"
            data-checked={checked || undefined}
            onClick={() => onChange(checked && option.value !== '' ? '' : option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
            {option.hint !== undefined && <small id={hintId}>{option.hint}</small>}
          </button>
        );
      })}
    </div>
  );
}
