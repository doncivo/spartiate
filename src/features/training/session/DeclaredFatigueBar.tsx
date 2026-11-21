import { DECLARED_FATIGUE_LEVELS, type DeclaredFatigue } from '../../../domain/training/declaredFatigue';
import { tSession, type TrainingSessionTextKey } from '../../../i18n/trainingSessionText';

/**
 * SESS-01d (§ 13.2 « Fatigue déclarée ») : Frais / Normal / Fatigué en tête de séance, facultatif, jamais bloquant ; un second appui efface. État
 * dit par `aria-pressed` et le texte, jamais par la couleur seule. L'effet (« Fatigué » : aucune hausse de charge) est dit dans chaque proposition.
 */

const KEYS: Readonly<Record<DeclaredFatigue, TrainingSessionTextKey>> = { fresh: 'fatigueFresh', normal: 'fatigueNormal', tired: 'fatigueTired' };

export function DeclaredFatigueBar({ level, busy, onChange }: { readonly level: DeclaredFatigue | null; readonly busy: boolean; readonly onChange: (level: DeclaredFatigue | null) => void }) {
  return (
    <div className="ct-session__fatigue">
      <div className="ct-session__fatigue-choices" role="group" aria-label={tSession('fatigueLabel')} aria-describedby="ct-session-fatigue-hint">
        {DECLARED_FATIGUE_LEVELS.map((l) => (
          <button key={l} type="button" className="ct-session__chip" aria-pressed={level === l} disabled={busy} onClick={() => onChange(level === l ? null : l)}>
            {tSession(KEYS[l])}
          </button>
        ))}
      </div>
      <p id="ct-session-fatigue-hint" className="ct-session__hint">
        {tSession(level === 'tired' ? 'fatigueTiredHint' : 'fatigueHint')}
      </p>
    </div>
  );
}
