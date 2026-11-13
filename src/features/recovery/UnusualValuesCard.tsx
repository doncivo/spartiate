import type { UnusualValues } from '../../domain/recovery';
import { tRecoveryFactors } from '../../i18n/recoveryFactorsText';

/**
 * Carte « valeurs inhabituelles, repos conseillé » (I6-01 point A, § 16.7) : affichage seul d'une valeur déjà calculée par `unusualValues`
 * (domaine). Texte seulement (la marque « ! » est décorative), aucun chiffre sur l'écran verrouillé (aucune notification), aucune hypothèse médicale.
 */
export function UnusualValuesCard({ values }: { readonly values: UnusualValues }) {
  return (
    <section className="ct-today__card ct-recovery ct-unusual" aria-labelledby="ct-unusual-title">
      <h2 id="ct-unusual-title" className="ct-today__eyebrow ct-section-title">
        <span aria-hidden="true" className="ct-recovery__mark">
          !{' '}
        </span>
        {tRecoveryFactors('unusualTitle')}
      </h2>
      <p className="ct-today__text">{tRecoveryFactors('unusualLead')}</p>
      <ul className="ct-recovery__list">
        {values.reasons.map((reason) => (
          <li key={reason} className="ct-today__text">
            {tRecoveryFactors(reason === 'hrv_low' ? 'unusualHrvLow' : 'unusualRhrHigh')}
          </li>
        ))}
      </ul>
      <p className="ct-today__text">{tRecoveryFactors('unusualAdvice')}</p>
      <p className="ct-today__muted ct-recovery__disclaimer">{tRecoveryFactors('unusualDisclaimer')}</p>
    </section>
  );
}
