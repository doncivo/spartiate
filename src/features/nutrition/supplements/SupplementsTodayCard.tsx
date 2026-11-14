import { Check } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { todayLocal } from '../../../domain/clock';
import { dueIntakes, NO_SUPPLEMENT_ACTION_TROUBLE, parseSupplementActionTrouble, troubleAfterManualTake, type DueIntake, type SupplementActionTrouble } from '../../../domain/nutrition/supplements';
import { formatSupplementDose, tSupplements } from '../../../i18n/supplementsText';
import { Button, Icon } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { useNavigationStore } from '../../app/navigation';
import { logFailure } from '../../../platform/desktop/log';
import { useSyncedData } from '../../sync/remoteChanges';
import { replanSupplementReminders } from './replan';
import './Supplements.css';

const TROUBLE_KEY = 'notifications.actionTrouble';

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
  const [clearError, setClearError] = useState(false);
  const [trouble, setTrouble] = useState<SupplementActionTrouble>(NO_SUPPLEMENT_ACTION_TROUBLE);
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
    // FIX-0242 : échec durable d'une prise cochée depuis la notification (réglage local, relu à chaque lecture de la carte).
    void data.repos.settings.get(TROUBLE_KEY).then(
      (raw) => {
        if (live) setTrouble(parseSupplementActionTrouble(raw));
      },
      () => logFailure('supplements', 'action-trouble-read-failed'),
    );
    return () => {
      live = false;
    };
  }, [load, data, synced]);

  /** Applique `change` à l'état durable relu juste avant l'écriture, dans une transaction ; n'écrit que si l'état change. Échec : message sur la carte et journal. */
  const updateTrouble = async (change: (prev: SupplementActionTrouble) => SupplementActionTrouble): Promise<void> => {
    try {
      // Lecture et écriture dans une transaction (sérialisée par le pilote) : un échec noté par le passage des actions n'est jamais écrasé.
      const next = await data.transaction(async (repos) => {
        const prev = parseSupplementActionTrouble(await repos.settings.get(TROUBLE_KEY));
        const changed = change(prev);
        if (JSON.stringify(changed) !== JSON.stringify(prev)) await repos.settings.set(TROUBLE_KEY, changed);
        return changed;
      });
      setTrouble(next);
      setClearError(false);
    } catch {
      // rien n'est effacé sans succès : le message reste affiché, avec la raison
      logFailure('supplements', 'action-trouble-clear-failed');
      setClearError(true);
    }
  };

  /** Prise cochée à la main : lève l'état durable (jour concerné ou antérieur, pertes). */
  const clearTrouble = (): Promise<void> => updateTrouble((prev) => troubleAfterManualTake(prev, today));

  /** « Compris » : accusé de réception explicite, efface tout l'état durable (échecs et pertes). */
  const acknowledgeTrouble = (): Promise<void> => updateTrouble(() => NO_SUPPLEMENT_ACTION_TROUBLE);

  const toggle = async (item: DueIntake): Promise<void> => {
    const taken = !item.taken;
    setItems((current) => current?.map((x) => (x === item ? { ...x, taken } : x)) ?? null);
    try {
      await (await data.repos.supplements()).setTaken(item.supplement.id, today, item.moment, taken);
      setError(false);
      if (taken) await clearTrouble();
      replanSupplementReminders(container);
    } catch {
      setError(true);
      setItems(await load());
    }
  };

  const showTrouble = trouble.failed || trouble.lost;
  if (items === null || (items.length === 0 && !showTrouble)) return null;
  return (
    <section className="ct-today__card ct-supplements-card" aria-labelledby="ct-supplements-card-title">
      <h2 id="ct-supplements-card-title" className="ct-today__eyebrow ct-section-title">
        {tSupplements('cardTitle')}
      </h2>
      {items.length > 0 ? <p className="ct-today__text">{progressText(items)}</p> : null}
      {trouble.failed ? (
        <p role="alert" className="ct-today__muted">
          {tSupplements('actionTroubleFailed')}
        </p>
      ) : null}
      {trouble.lost ? (
        <p role="alert" className="ct-today__muted">
          {tSupplements('actionTroubleLost')}
        </p>
      ) : null}
      {showTrouble ? (
        <Button variant="secondary" fullWidth onClick={() => void acknowledgeTrouble()}>
          {tSupplements('actionTroubleAck')}
        </Button>
      ) : null}
      {clearError ? (
        <p role="alert" className="ct-today__muted">
          {tSupplements('actionTroubleClearError')}
        </p>
      ) : null}
      <ul className="ct-supplements__intakes">
        {items.map((item) => (
          <li key={`${item.supplement.id}|${item.moment}`}>
            <button type="button" role="checkbox" aria-checked={item.taken} aria-label={intakeLabel(item)} className="ct-supplements__intake" onClick={() => void toggle(item)}>
              <span className="ct-supplements__mark" aria-hidden="true">
                {item.taken ? <Icon icon={Check} size="sm" /> : null}
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
