import { useEffect, useState } from 'react';
import { decideOnboarding, isEmptyBase } from '../../domain/onboarding/draft';
import { logFailure } from '../../platform/desktop/log';
import { useAppContainer } from '../app/AppContainerContext';
import { OnboardingFlow } from '../app/lazyScreens';
import { useNavigationStore } from '../app/navigation';
import { markCompleted, onboardingDisabledForDev, readBaseCounts } from './launch';

/** Repère posé sur <html> quand la décision de premier lancement est prise (« show », « skip », « mark-done », « disabled », « error ») : les tests l'attendent au lieu d'un délai. */
const MARK = 'data-ct-onboarding';

/**
 * Hôte de l'onboarding (I3-07), monté en permanence par la coquille. Il ne rend rien tant que l'onboarding n'a pas lieu d'être :
 * - premier lancement : réglage `onboarding.completed` absent ET base vide (aucun profil, routine, pesée, séance ni repas) ;
 * - installation existante (base non vide, jamais terminé) : marqué terminé sans rien montrer ;
 * - « Revoir mes réglages » (Plus › Profil) : surcouche `onboarding`, toujours possible.
 * Les écrans (`OnboardingFlow`, leurs textes et le contenu d'entraînement) ne sont chargés qu'à l'ouverture.
 */
export function OnboardingHost() {
  const container = useAppContainer();
  const requested = useNavigationStore((s) => s.overlays.at(-1)?.kind === 'onboarding');
  const closeOverlay = useNavigationStore((s) => s.closeOverlay);
  const [auto, setAuto] = useState<'pending' | 'show' | 'none'>('pending');
  const { data } = container;

  useEffect(() => {
    let live = true;
    void (async () => {
      const mark = (value: string): void => document.documentElement.setAttribute(MARK, value);
      if (onboardingDisabledForDev()) {
        mark('disabled');
        return;
      }
      try {
        const completed = await data.repos.settings.get('onboarding.completed');
        const empty = completed ? true : isEmptyBase(await readBaseCounts(data));
        const decision = decideOnboarding({ completed, empty, requested: false });
        if (decision === 'mark-done') await markCompleted(data);
        if (!live) return;
        mark(decision);
        setAuto(decision === 'show' ? 'show' : 'none');
      } catch (error) {
        // Jamais bloquant : l'app reste utilisable, l'onboarding reste accessible par Plus › Profil › Revoir mes réglages.
        logFailure('onboarding-launch', error);
        if (live) mark('error');
      }
    })();
    return () => {
      live = false;
    };
  }, [data]);

  const open = requested || auto === 'show';
  if (!open) return null;
  const mode = requested ? 'review' : 'first-launch';
  const onClose = (reason: 'done' | 'closed'): void => {
    if (mode === 'review') closeOverlay();
    else {
      setAuto('none');
      // Fermé sans terminer : ne revient pas tout seul (le brouillon reste, « Revoir mes réglages » le reprend).
      if (reason === 'closed') void markCompleted(data).catch((error: unknown) => logFailure('onboarding-complete', error));
    }
  };
  return <OnboardingFlow mode={mode} onClose={onClose} />;
}
