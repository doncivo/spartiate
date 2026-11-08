import type { EntrySource } from '../../domain/nutrition';
import { tNutrition, type NutritionTextKey } from '../../i18n/nutritionText';

/** Éléments communs aux écrans de Nutrition (I4-03) : provenance, champs numériques et heure. */

const PROVENANCE_KEY: Readonly<Record<EntrySource, NutritionTextKey>> = {
  custom: 'provCustom',
  ciqual: 'provCiqual',
  off: 'provOff',
  manual: 'provManual',
  estimate: 'provEstimate',
};

/** Provenance d'un aliment (Perso / Ciqual / OFF / Saisie manuelle / Estimation) : affichée partout, jamais seulement par la couleur. */
export function ProvenanceBadge({ source }: { readonly source: EntrySource }) {
  return <span className={`ct-nutrition__badge ct-nutrition__badge--${source}`}>{tNutrition(PROVENANCE_KEY[source])}</span>;
}

/** Nombre saisi : vide = inconnu (`null`), virgule décimale acceptée ; invalide (NaN, négatif) = `undefined`. */
export function parseNumber(text: string): number | null | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export interface NumberFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly step?: string;
  readonly invalid?: boolean;
  readonly autoFocus?: boolean;
  readonly describedBy?: string;
}

export function NumberField({ label, value, onChange, step = 'any', invalid = false, autoFocus = false, describedBy }: NumberFieldProps) {
  return (
    <label className="ct-nutrition__field">
      <span className="ct-nutrition__field-label">{label}</span>
      <input
        className="ct-nutrition__input"
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        value={value}
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function TimeField({ value, onChange, invalid = false }: { readonly value: string; readonly onChange: (value: string) => void; readonly invalid?: boolean }) {
  return (
    <label className="ct-nutrition__field">
      <span className="ct-nutrition__field-label">{tNutrition('timeLabel')}</span>
      <input className="ct-nutrition__input" type="time" value={value} aria-invalid={invalid || undefined} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

/** Heure locale « HH:mm » de l'horloge de l'app (24 h). */
export function nowTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** « P 34 · G 58 · L 15 » : chaque valeur dans son propre élément ; une valeur inconnue s'écrit « — », jamais 0. */
export function MacroLine({ p, c, f }: { readonly p: string; readonly c: string; readonly f: string }) {
  return (
    <span className="ct-nutrition__macroline">
      <span>
        {tNutrition('macroShortP')} <span className="ct-nutrition__num">{p}</span>
      </span>
      <span aria-hidden="true"> · </span>
      <span>
        {tNutrition('macroShortC')} <span className="ct-nutrition__num">{c}</span>
      </span>
      <span aria-hidden="true"> · </span>
      <span>
        {tNutrition('macroShortF')} <span className="ct-nutrition__num">{f}</span>
      </span>
    </span>
  );
}
