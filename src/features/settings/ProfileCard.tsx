import { useEffect, useState } from 'react';
import { formatKg, tBody } from '../../i18n/bodyText';
import { formatDayMonth } from '../../i18n/format';
import { tPlus } from '../../i18n/plusText';
import { useAppContainer } from '../app/AppContainerContext';
import { useNavigationStore } from '../app/navigation';

const pad2 = (n: number): string => String(n).padStart(2, '0');
const GOAL_KEY = { gain: 'goalGain', loss: 'goalLoss', maintain: 'goalMaintain' } as const;

/**
 * Résumé de « Profil et poids » (Plus, iPhone et PC). Le résumé n'est construit qu'avec les valeurs réellement saisies (taille, dernier poids, objectif) ; sans aucune valeur, ou si la
 * lecture échoue, texte neutre (la carte reste un lien vers l'écran, où l'échec de lecture est dit).
 */
export function useProfileSummary(): readonly string[] {
  const container = useAppContainer();
  const { repos } = container.data;
  const [parts, setParts] = useState<readonly string[]>([]);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [profile, weights] = await Promise.all([
          repos.profile().then((r) => r.get()),
          repos.bodyWeights().then((r) => r.listRecent(1)),
        ]);
        if (!live) return;
        const next: string[] = [];
        if (profile?.heightCm != null) next.push(tPlus('profileHeight', { cm: formatKg(profile.heightCm) }));
        const weight = weights[0];
        if (weight) {
          const now = new Date(container.clock.nowMs());
          const today = `${String(now.getFullYear())}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
          const when = weight.date === today ? tPlus('profileWeightToday') : tPlus('profileWeightOn', { date: formatDayMonth(weight.date) });
          next.push(tPlus('profileWeight', { kg: formatKg(weight.kg), when }));
        }
        if (profile?.goal != null) next.push(tBody(GOAL_KEY[profile.goal]).toLocaleLowerCase('fr-FR'));
        setParts(next);
      } catch {
        if (live) setParts([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [repos, container.clock]);

  return parts;
}

/** Ligne « Profil et poids » du groupe MOI (ERGO-02, aperçu Plus-apres) : résumé sous le libellé, qui passe à la ligne plutôt que d'être coupé. */
export function ProfileCard() {
  const navigate = useNavigationStore((s) => s.navigate);
  const parts = useProfileSummary();
  return (
    <button type="button" className="ct-settings__row ct-settings__rowButton" onClick={() => navigate({ tab: 'more', screen: 'body' })}>
      <span className="ct-settings__stack">
        <span>{tBody('row')}</span>
        <span className="ct-settings__hint">{parts.length > 0 ? parts.join(tPlus('profileSummarySeparator')) : tPlus('profileSummaryEmpty')}</span>
      </span>
    </button>
  );
}
