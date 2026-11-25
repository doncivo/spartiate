import { tPlural } from '../../../i18n/plural';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { tonnageKg, workoutDurationSec, type Workout, type WorkoutWithSets } from '../../../domain/training';
import { CATALOG_ASSISTED_IDS, isAssistedEquipment } from '../../../domain/training/assisted';
import type { DataAccess } from '../../../db/repositories/dataAccess';
import { formatClock, formatDay, formatVolume, tTraining } from '../../../i18n/trainingText';
import { Icon } from '../../../ui';
import { ContextMenuZone } from '../../../ui/ContextMenu';
import { useNavigationStore } from '../../app/navigation';
import { useSyncedData } from '../../sync/remoteChanges';
import type { TrainingData } from '../trainingState';
import { HistoryDetail } from './HistoryDetail';
import '../session/Session.css';
import './History.css';
import { SEP } from '../../../i18n/units';

/**
 * Journal des séances (I1-03, § 13.8 « Historique éditable ») : séances closes, récentes d'abord (date, nom, durée, séries, volume), puis le
 * détail d'une séance (correction d'une série, suppression). Section « Journal » de l'onglet Entraînement, chargée à la demande. Relu après
 * chaque lot de synchro qui touche `workout` ou `workout_set` (correction ou suppression faite sur l'autre appareil). La séance ouverte n'y
 * figure jamais (elle reste locale, D-27).
 */

/** SEANCE-0292 (C-082) : page du journal ; « Afficher les séances plus anciennes » lit la suivante (aucune séance hors d'atteinte). */
const HISTORY_PAGE = 50;

interface Item {
  readonly workout: Workout;
  readonly durationSec: number | null;
  readonly sets: number;
  readonly volumeKg: number;
}

type ListLoad = { readonly status: 'loading' } | { readonly status: 'error' } | { readonly status: 'ready'; readonly items: readonly Item[]; readonly more: boolean };

async function readList(access: DataAccess, pages: number): Promise<{ items: Item[]; more: boolean }> {
  const repo = await access.repos.workouts();
  // Pages lues chacune en deux requêtes (séances puis séries), et une séance de plus pour savoir s'il en reste.
  const full: WorkoutWithSets[] = [];
  for (let p = 0; p < pages; p += 1) full.push(...(await repo.closedPage(HISTORY_PAGE, p * HISTORY_PAGE)));
  const more = full.length === HISTORY_PAGE * pages && (await repo.closedPage(1, HISTORY_PAGE * pages)).length > 0;
  // BL-090 : assistés hors volume comme au résumé de séance (FIX-ASSIST) : catalogue et personnalisés avec la machine, supprimés compris.
  const customs = await (await access.repos.exercises()).list({ includeDeleted: true });
  const assisted = new Set([...CATALOG_ASSISTED_IDS, ...customs.filter((c) => isAssistedEquipment(c.equipment)).map((c) => c.id)]);
  const items = full.map((w) => ({ workout: w, durationSec: workoutDurationSec(w), sets: w.sets.filter((s) => s.done && s.setKind !== 'warmup').length, volumeKg: tonnageKg(w.sets, assisted) }));
  return { items, more };
}

export function HistoryView({ data, access }: { readonly data: TrainingData; readonly access: DataAccess }) {
  const [load, setLoad] = useState<ListLoad>({ status: 'loading' });
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [pages, setPages] = useState(1);
  const synced = useSyncedData(['workout', 'workout_set']);
  const navigate = useNavigationStore((s) => s.navigate);
  const listHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { items, more } = await readList(access, pages);
        if (live) setLoad({ status: 'ready', items, more });
      } catch {
        if (live) setLoad((now) => (now.status === 'ready' ? now : { status: 'error' }));
      }
    })();
    return () => {
      live = false;
    };
  }, [access, version, synced, pages]);

  const back = (message: string | null): void => {
    setSelected(null);
    setNotice(message);
    setVersion((v) => v + 1);
    setTimeout(() => listHeading.current?.focus(), 0);
  };

  if (selected !== null) {
    return (
      <div className="ct-history">
        <button type="button" className="ct-training__back" onClick={() => back(null)}>
          <Icon icon={ArrowLeft} size="md" />
          <span>{tTraining('historyBack')}</span>
        </button>
        <HistoryDetail key={selected} data={data} access={access} workoutId={selected} synced={synced} onDeleted={() => back(tTraining('historyDeleted'))} onReplay={() => navigate({ tab: 'training', screen: 'session' })} />
      </div>
    );
  }

  return (
    <div className="ct-history">
      <h2 ref={listHeading} tabIndex={-1} id="ct-history-title" className="ct-training__heading">
        {tTraining('historyTitle')}
      </h2>
      {notice ? (
        <p className="ct-session__muted" role="status">
          {notice}
        </p>
      ) : null}
      {load.status === 'loading' ? (
        <p className="ct-training__muted" role="status">
          {tTraining('loading')}
        </p>
      ) : load.status === 'error' ? (
        <div role="alert" className="ct-training__error-block">
          <p>{tTraining('loadError')}</p>
          <button type="button" className="ct-training__link" onClick={() => setVersion((v) => v + 1)}>
            {tTraining('retry')}
          </button>
        </div>
      ) : load.items.length === 0 ? (
        <p className="ct-session__muted">{tTraining('historyEmpty')}</p>
      ) : (
        <ul className="ct-training__rows" aria-labelledby="ct-history-title">
          {load.items.map((item) => (
            <li key={item.workout.id}>
              <ContextMenuZone
                items={[{ id: 'open', label: tTraining('openItem'), onSelect: () => setSelected(item.workout.id) }]}
                menuLabel={tTraining('rowActions', { name: item.workout.name === '' ? tTraining('sessionFree') : item.workout.name })}
                onActivate={() => setSelected(item.workout.id)}
              >
                {(bind) => (
                  <button type="button" className="ct-training__row" onClick={() => setSelected(item.workout.id)} {...bind}>
                    <span className="ct-training__row-name">{item.workout.name === '' ? tTraining('sessionFree') : item.workout.name}</span>
                    <span className="ct-training__row-meta ct-session__num">
                      {[
                        formatDay(item.workout.endedAt ?? item.workout.startedAt),
                        item.durationSec === null ? null : formatClock(item.durationSec * 1000),
                        tPlural(tTraining, item.sets, 'historySetsOne', 'historySets'),
                        tTraining('historyVolume', { n: formatVolume(item.volumeKg) }),
                      ]
                        .filter((part): part is string => part !== null)
                        .join(SEP)}
                    </span>
                  </button>
                )}
              </ContextMenuZone>
            </li>
          ))}
        </ul>
      )}
      {load.status === 'ready' && load.more ? (
        <button type="button" className="ct-training__link" onClick={() => setPages((n) => n + 1)}>
          {tTraining('historyMore')}
        </button>
      ) : null}
    </div>
  );
}
