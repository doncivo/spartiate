import { Check } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { todayLocal } from '../../../domain/clock';
import { dueIntakes, type DueIntake } from '../../../domain/nutrition/supplements';
import { formatSupplementDose, tSupplements } from '../../../i18n/supplementsText';
import { Button } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { useNavigationStore } from '../../app/navigation';
import { useSyncedData } from '../../sync/remoteChanges';
import { replanSupplementReminders } from './replan';
import './Supplements.css';

/** Libellé d'une prise : « 08:00 · Créatine, 5 g ». */
export function intakeLabel(item: DueIntake): string {
  const dose = formatSupplementDose(item.supplement.dose, item.supplement.unit);
  return dose === null ? tSupplements('intakeLabel', { time: item.moment, name: item.supplement.name }) : tSupplements('intakeLabelDose', { time: item.moment, name: item.supplement.name, dose });
}

export function progressText(items: readonly DueIntake[]): string {
  const taken = items.filter((i) => i.taken).length;
  return items.length === 1 ? tSupplements('cardProgressOne', { n: taken }) : tSupplements('cardProgressMany', { n: taken, total: items.length });
}

/**
 * Carte « Compléments » d'Aujourd'hui (I6-05, critère 2, D-214) : les prises dues du jour, cochées ou décochées en un tap (cible ≥ 44 px). Aucune
 * prise due (aucun complément, en pause, jour non prévu) ou lecture impossible : rien n'est affiché. Bloc chargé à la demande avec ses textes.
 */
export function SupplementsTodayCard() {
  const container = useAppContainer();
  const { data } = container;
  const navigate = useNavigationStore((s) => s.navigate);
  const [items, setItems] = useState<readonly DueIntake[] | null>(null);
  const [error, setError] = useState(false);
  const synced = useSyncedData(['supplement', 'supplement_intake']);
  const today = todayLocal(container.clock);

  const load = useCallback(async (): Promise<readonly DueIntake[] | null> => {
    try {
      const repo = await data.repos.supplements();
      const [supplements, intakes] = await Promise.all([repo.list(), repo.intakes(today, today)]);
      return dueIntakes(supplements, intakes, today);
    } catch {
      return null;
    }
  }, [data, today]);

  useEffect(() => {
    let live = true;
    void load().then((next) => {
      if (live) setItems(next);
    });
    return () => {
      live = false;
    };
  }, [load, synced]);

  const toggle = async (item: DueIntake): Promise<void> => {
    const taken = !item.taken;
    setItems((current) => current?.map((x) => (x === item ? { ...x, taken } : x)) ?? null);
    try {
      await (await data.repos.supplements()).setTaken(item.supplement.id, today, item.moment, taken);
      setError(false);
      replanSupplementReminders(container);
    } catch {
      setError(true);
      setItems(await load());
    }
  };

  if (items === null || items.length === 0) return null;
  return (
    <section className="ct-today__card ct-supplements-card" aria-labelledby="ct-supplements-card-title">
      <h2 id="ct-supplements-card-title" className="ct-today__eyebrow">
        {tSupplements('cardTitle')}
      </h2>
      <p className="ct-today__text">{progressText(items)}</p>
      <ul className="ct-supplements__intakes">
        {items.map((item) => (
          <li key={`${item.supplement.id}|${item.moment}`}>
            <button type="button" role="checkbox" aria-checked={item.taken} aria-label={intakeLabel(item)} className="ct-supplements__intake" onClick={() => void toggle(item)}>
              <span className="ct-supplements__mark" aria-hidden="true">
                {item.taken ? <Check size={16} /> : null}
              </span>
              <span className="ct-supplements__time">{item.moment}</span>
              <span>{intakeLabel(item).slice(item.moment.length + 3)}</span>
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="ct-today__muted">
          {tSupplements('writeError')}
        </p>
      ) : null}
      <Button variant="secondary" fullWidth onClick={() => navigate({ tab: 'nutrition', screen: 'supplements' })}>
        {tSupplements('manage')}
      </Button>
    </section>
  );
}
