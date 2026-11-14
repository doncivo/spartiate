/**
 * Ligne cliquable « étiquette · valeur » de Plus (chevron par la feuille de style). Libellé accessible « étiquette : valeur » quand une
 * valeur est affichée, sinon l'étiquette seule. `hint` : sous-texte sous l'étiquette (planche PC).
 */
export function LinkRow({
  label,
  value = '',
  hint,
  tone,
  onClick,
}: {
  readonly label: string;
  readonly value?: string;
  readonly hint?: string;
  /** ERGO-02 : `danger` colore le libellé (« Repartir de zéro », la seule action rouge de Plus). */
  readonly tone?: 'danger';
  readonly onClick: () => void;
}) {
  return (
    <button type="button" className="ct-settings__row ct-settings__rowButton" data-tone={tone} aria-label={value === '' ? label : `${label} : ${value}`} onClick={onClick}>
      {hint ? (
        <span className="ct-settings__stack">
          <span>{label}</span>
          <span className="ct-settings__hint">{hint}</span>
        </span>
      ) : (
        <span>{label}</span>
      )}
      {value !== '' && <span className="ct-settings__value">{value}</span>}
    </button>
  );
}
