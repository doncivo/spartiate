import { plateTotals, type Plate } from '../../../domain/nutrition';
import { formatInt, formatTenth, orDash, tNutrition } from '../../../i18n/nutritionText';
import { Button } from '../../../ui';
import { MacroLine } from '../shared';

export interface PlateCardProps {
  readonly plate: Plate;
  readonly busy: boolean;
  readonly failed: boolean;
  readonly onRemove: (ref: string) => void;
  readonly onClear: () => void;
  readonly onCommit: () => void;
}

/** Assiette en cours (§ 15.3) : aliments, quantités et total ; un nutriment inconnu s'écrit « — ». Rien n'est écrit avant « Ajouter l'assiette au journal ». */
export function PlateCard({ plate, busy, failed, onRemove, onClear, onCommit }: PlateCardProps) {
  const totals = plateTotals(plate);
  return (
    <section className="ct-nutrition__panel ct-flat" aria-label={tNutrition('plateTitle')}>
      <h2 className="ct-nutrition__subtitle ct-section-title">{tNutrition('plateTitle')}</h2>
      <ul className="ct-nutrition__list">
        {plate.map((item) => (
          <li key={item.food.ref} className="ct-nutrition__row">
            <span className="ct-nutrition__num">{tNutrition('plateItem', { name: item.food.name, grams: formatTenth(item.grams) })}</span>
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
      {failed ? (
        <p role="alert" className="ct-nutrition__warning">
          {tNutrition('writeError')}
        </p>
      ) : null}
      <div className="ct-nutrition__actions">
        <Button disabled={busy} onClick={onCommit}>
          {tNutrition('plateCommit')}
        </Button>
        <Button variant="secondary" onClick={onClear}>
          {tNutrition('plateClear')}
        </Button>
      </div>
    </section>
  );
}
