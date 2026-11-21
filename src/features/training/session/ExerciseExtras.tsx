import { useId, useMemo, useState } from 'react';
import { platesPerSide, standardPlates } from '../../../domain/training/plates';
import type { BarbellSpec, Exercise, ProgressionEquipment } from '../../../domain/training/types';
import { formatNumber, parseNumber } from '../../../i18n/trainingText';
import { tSession } from '../../../i18n/trainingSessionText';

/**
 * SESS-01c (§ 13.2) : notes de l'exercice (consignes du contenu : mise en place, exécution, erreurs fréquentes) et calculateur de disques. Bloc à la
 * demande, chargé par la séance active avec son catalogue de textes.
 */

export function ExerciseNotes({ exercise }: { readonly exercise: Exercise }) {
  const { setup, execution, mistakes } = exercise.instructions;
  if (setup.trim() === '' && execution.trim() === '' && mistakes.length === 0) return null;
  return (
    <details className="ct-session__notes">
      <summary className="ct-session__notes-summary">{tSession('notes')}</summary>
      {setup.trim() !== '' && (
        <>
          <p className="ct-training__label">{tSession('notesSetup')}</p>
          <p>{setup}</p>
        </>
      )}
      {execution.trim() !== '' && (
        <>
          <p className="ct-training__label">{tSession('notesExecution')}</p>
          <p>{execution}</p>
        </>
      )}
      {mistakes.length > 0 && (
        <>
          <p className="ct-training__label">{tSession('notesMistakes')}</p>
          <ul>
            {mistakes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}

const BARBELL_IDS: ReadonlySet<string> = new Set(['barbell', 'ez-bar', 'trap-bar']);
const DEFAULT_BAR_KG = 20;

export interface PlateCalculatorProps {
  readonly exercise: Exercise;
  readonly profile: ProgressionEquipment | null;
  /** Charge totale proposée à l'ouverture (série en cours) ; null : vide. */
  readonly initialKg: number | null;
}

/**
 * Charge totale saisie, barre choisie parmi celles du profil pour ce matériel (sinon 20 kg), disques du profil (nombre par côté) sinon jeu standard ;
 * résultat par côté, et le reste quand la charge exacte n'est pas atteignable.
 */
export function PlateCalculator({ exercise, profile, initialKg }: PlateCalculatorProps) {
  const id = useId();
  const bars = useMemo((): BarbellSpec[] => {
    const own = (profile?.inventory.barbells ?? []).filter((b) => b.equipmentId !== undefined && exercise.equipment.includes(b.equipmentId) && BARBELL_IDS.has(b.equipmentId) && b.weightKg > 0);
    const unique = own.filter((b, i) => own.findIndex((o) => o.weightKg === b.weightKg) === i);
    return unique.length > 0 ? unique : [{ type: tSession('platesDefaultBar'), weightKg: DEFAULT_BAR_KG }];
  }, [profile, exercise.equipment]);
  const declared = profile?.inventory.platesPerSideKg ?? [];
  const standard = declared.length === 0;
  const plates = standard ? standardPlates() : declared;
  const [total, setTotal] = useState(initialKg === null ? '' : formatNumber(initialKg));
  const [bar, setBar] = useState(String(bars[0]?.weightKg ?? DEFAULT_BAR_KG));
  const totalKg = parseNumber(total);
  const barKg = Number(bar);
  const result = totalKg === null ? null : platesPerSide(totalKg, barKg, plates);
  const side =
    result === null
      ? null
      : result.perSide.length === 0
        ? tSession('platesBarOnly')
        : tSession('platesSide', {
            plates: result.perSide.map((p) => (p.count > 1 ? tSession('plateItemCount', { count: p.count, kg: formatNumber(p.weightKg) }) : tSession('plateItem', { kg: formatNumber(p.weightKg) }))).join(tSession('plateJoin')),
          });

  return (
    <div className="ct-session__plates" role="group" aria-label={tSession('platesTitle')}>
      <div className="ct-session__fields">
        <label className="ct-session__field" htmlFor={`${id}-total`}>
          <span className="ct-training__label">{tSession('platesTotal')}</span>
          <input id={`${id}-total`} className="ct-session__input ct-session__num" inputMode="decimal" autoComplete="off" value={total} onChange={(e) => setTotal(e.target.value)} />
        </label>
        <label className="ct-session__field" htmlFor={`${id}-bar`}>
          <span className="ct-training__label">{tSession('platesBar')}</span>
          <select id={`${id}-bar`} className="ct-session__input" value={bar} onChange={(e) => setBar(e.target.value)}>
            {bars.map((b) => (
              <option key={b.weightKg} value={String(b.weightKg)}>
                {tSession('platesBarOption', { name: b.type, kg: formatNumber(b.weightKg) })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="ct-session__num" aria-live="polite">
        {totalKg !== null && result === null && <p className="ct-session__muted">{tSession('platesBelowBar')}</p>}
        {side !== null && <p className="ct-session__block-title">{side}</p>}
        {result !== null && result.remainderKg > 0 && <p className="ct-session__muted">{tSession('platesRemainder', { loaded: formatNumber(result.loadedKg), rest: formatNumber(result.remainderKg) })}</p>}
      </div>
      {standard && <p className="ct-session__hint">{tSession('platesStandard')}</p>}
    </div>
  );
}
