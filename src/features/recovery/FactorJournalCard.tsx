import { useState } from 'react';
import { FACTOR_CODES, type FactorCode } from '../../domain/recovery';
import type { FactorEntry } from '../../db/repositories';
import { formatDetailDate } from '../../i18n/format';
import { tRecoveryFactors, type RecoveryFactorsTextKey } from '../../i18n/recoveryFactorsText';
import { toggleFactor, toggleNone } from './factorJournal';

const FACTOR_TEXT = {
  alcohol: 'factor_alcohol',
  caffeine_late: 'factor_caffeine_late',
  late_meal: 'factor_late_meal',
  stress: 'factor_stress',
  soreness: 'factor_soreness',
  illness: 'factor_illness',
  travel: 'factor_travel',
  late_training: 'factor_late_training',
} as const satisfies Record<FactorCode, RecoveryFactorsTextKey>;

/**
 * Journal de facteurs de la veille (I6-01 point B, § 16.7) : huit cases et « Rien de particulier » (distinct de « non renseigné »). Cases en
 * texte, 44 pt (`ct-factors__option`), l'état est dit aussi en toutes lettres (jamais la couleur seule). Contrôlé : l'état affiché est celui
 * enregistré ; l'état affiché suit les tapes tout de suite (plusieurs cases de suite ne se perdent pas) et revient à l'état enregistré à chaque
 * relecture (l’hôte remonte la carte par `key` quand l’enregistré change ou qu’une écriture échoue) ; `onChange(null)` efface la saisie.
 */
export function FactorJournalCard({ day, entry: saved, failed, onChange }: { readonly day: string; readonly entry: FactorEntry | null; readonly failed: boolean; readonly onChange: (next: FactorEntry | null) => void }) {
  const [entry, setEntry] = useState<FactorEntry | null>(saved);
  const change = (next: FactorEntry | null): void => {
    setEntry(next);
    onChange(next);
  };
  const status = entry === null ? tRecoveryFactors('statusUnset') : entry.none ? tRecoveryFactors('statusNone') : tRecoveryFactors('statusSome', { list: entry.factors.map((c) => tRecoveryFactors(FACTOR_TEXT[c])).join(', ') });
  return (
    <fieldset className="ct-today__card ct-recovery ct-factors">
      <legend className="ct-today__eyebrow">{tRecoveryFactors('journalLegend', { date: formatDetailDate(day) })}</legend>
      <div className="ct-factors__group">
        {FACTOR_CODES.map((code) => (
          <label key={code} className="ct-factors__option">
            <input type="checkbox" checked={entry?.factors.includes(code) === true} onChange={() => change(toggleFactor(entry, code))} />
            <span>{tRecoveryFactors(FACTOR_TEXT[code])}</span>
          </label>
        ))}
        <label className="ct-factors__option">
          <input type="checkbox" checked={entry?.none === true} onChange={() => change(toggleNone(entry))} />
          <span>{tRecoveryFactors('none')}</span>
        </label>
      </div>
      <p className="ct-today__text">{status}</p>
      <p className="ct-today__muted">{tRecoveryFactors('journalHint')}</p>
      {failed ? (
        <p role="alert" className="ct-recovery__notice">
          {tRecoveryFactors('saveFailed')}
        </p>
      ) : null}
    </fieldset>
  );
}
