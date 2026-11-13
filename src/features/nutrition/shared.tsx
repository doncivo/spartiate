import type { EntrySource } from '../../domain/nutrition';
import { formatInt, orDash, tNutrition, type NutritionTextKey } from '../../i18n/nutritionText';

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
  readonly onFocus?: () => void;
}

export function NumberField({ label, value, onChange, step = 'any', invalid = false, autoFocus = false, describedBy, onFocus }: NumberFieldProps) {
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
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function TimeField({ value, onChange, invalid = false, onFocus }: { readonly value: string; readonly onChange: (value: string) => void; readonly invalid?: boolean; readonly onFocus?: () => void }) {
  return (
    <label className="ct-nutrition__field">
      <span className="ct-nutrition__field-label">{tNutrition('timeLabel')}</span>
      <input className="ct-nutrition__input" type="time" value={value} aria-invalid={invalid || undefined} onFocus={onFocus} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

/**
 * 0.7.1 point 2 : au focus d'un champ (clavier numérique qui s'ouvre), le bas de la fiche reste atteignable : on ramène les boutons d'action dans
 * la zone visible, après l'animation du clavier. Sans effet là où `scrollIntoView` n'existe pas (tests).
 */
export function revealAfterKeyboard(target: HTMLElement | null): void {
  window.setTimeout(() => target?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }), 320);
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

/**
 * ERGO-01 : calories restantes (ou dépassées) en chiffre héros, l'unité à part ; `null` (journal non lu, valeur inconnue) : « — », jamais la
 * cible entière ni un zéro. Le texte complet de la ligne reste celui d'avant (« 1 190 kcal restantes »).
 */
export function KcalHero({ kcal }: { readonly kcal: number | null }) {
  const over = kcal !== null && kcal < 0;
  return (
    <p className="ct-hero">
      <span className="ct-hero__num">{kcal === null ? orDash(null) : formatInt(Math.abs(kcal))}</span>{' '}
      <span className="ct-hero__unit">{tNutrition(over ? 'overKcalUnit' : 'remainingKcalUnit')}</span>
    </p>
  );
}
