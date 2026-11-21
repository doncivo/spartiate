import { useCallback, useEffect, useState } from 'react';
import { todayLocal } from '../../../domain/clock';
import { CHECKIN_ANSWERS, dueCheckins, parseInjuries, recordCheckin, type CheckinAnswer, type InjuriesValue } from '../../../domain/training/injuries';
import { tInjuries, type InjuriesTextKey } from '../../../i18n/injuriesText';
import { Button } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { replanInjuryReminders } from './replan';
import './Injuries.css';

const ANSWER_KEY = { better: 'answerBetter', same: 'answerSame', worse: 'answerWorse', healed: 'answerHealed' } as const satisfies Record<CheckinAnswer, InjuriesTextKey>;

/**
 * Carte « Où en est ta gêne ? » d'Aujourd'hui (BLESSURES-b) : visible seulement quand une gêne active a 14 jours ou plus depuis son début ou sa
 * dernière réponse. Mieux / Pareil / Pire / Guérie : la réponse est tracée ; « Guérie » clôt la gêne ; aucune réponse = rien ne change. « Pire »
 * ne propose rien d'augmenter : une phrase prudente. Bloc chargé à la demande avec ses textes ; lecture impossible : rien d'affiché.
 */
export function InjuryCheckinCard() {
  const container = useAppContainer();
  const { settings } = container.data.repos;
  const today = todayLocal(container.clock);
  const [value, setValue] = useState<InjuriesValue | null>(null);
  const [worse, setWorse] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void settings.get('training.injuries').then(
      (raw) => {
        if (live) setValue(parseInjuries(raw));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [settings]);

  const answer = useCallback(
    async (id: string, choice: CheckinAnswer): Promise<void> => {
      if (value === null) return;
      try {
        const next = recordCheckin(value, id, choice, today);
        await settings.set('training.injuries', next);
        setValue(next);
        setFailed(false);
        setWorse(choice === 'worse');
        replanInjuryReminders(container);
      } catch {
        setFailed(true);
      }
    },
    [value, today, settings, container],
  );

  const due = value === null ? [] : dueCheckins(value, today);
  const first = due[0];
  if (first === undefined && !worse) return null;
  return (
    <section className="ct-today__card ct-injuries" aria-label={tInjuries('checkinTitle')}>
      {first !== undefined && (
        <>
          <h2 className="ct-today__eyebrow ct-section-title">{tInjuries('checkinTitle')}</h2>
          <p className="ct-today__muted">{tInjuries('checkinLead')}</p>
          <div className="ct-injuries__answers">
            {CHECKIN_ANSWERS.map((choice) => (
              <Button key={choice} variant="secondary" onClick={() => void answer(first.id, choice)}>
                {tInjuries(ANSWER_KEY[choice])}
              </Button>
            ))}
          </div>
        </>
      )}
      {worse && <p className="ct-today__text" role="status">{tInjuries('worseAdvice')}</p>}
      {failed && <p className="ct-today__muted" role="alert">{tInjuries('checkinSaveError')}</p>}
    </section>
  );
}
