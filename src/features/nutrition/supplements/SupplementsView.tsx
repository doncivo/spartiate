import { Check } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays } from '../../../domain/localDate';
import {
  ALL_DAYS,
  dueIntakes,
  type DueIntake,
  supplementAdherence,
  supplementStreak,
  validateSupplementDraft,
  type Supplement,
  type SupplementAdherence,
  type SupplementDraftError,
  type SupplementIntake,
} from '../../../domain/nutrition/supplements';
import type { LocalDate, Weekday } from '../../../domain/types';
import { formatDayMonth } from '../../../i18n/nutritionText';
import { weekdayName } from '../../../i18n/formatRoutine';
import { formatSupplementDose, tSupplements, type SupplementsTextKey } from '../../../i18n/supplementsText';
import { Button, ConfirmDialog, Icon, Switch, WeekdayToggles } from '../../../ui';
import { MissingValue } from '../../../ui/MissingValue';
import { useAppContainer } from '../../app/AppContainerContext';
import { useSyncedData } from '../../sync/remoteChanges';
import type { SupplementNotificationResult } from '../../notifications/supplementNotifications';
import { constancyDays, type ConstancyDay } from './constancy';
import { replanSupplementReminders } from './replan';
import './Supplements.css';

const WEEK: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
const ERROR_KEY: Record<SupplementDraftError, SupplementsTextKey> = { name: 'errorName', dose: 'errorDose', unit: 'errorUnit', times: 'errorTimes', days: 'errorDays' };
const HISTORY_DAYS = 30;

type Load = { readonly status: 'loading' | 'failed' } | { readonly status: 'ready'; readonly supplements: readonly Supplement[]; readonly intakes: readonly SupplementIntake[] };

interface FormState {
  readonly id: string | null;
  readonly name: string;
  readonly dose: string;
  readonly unit: string;
  readonly times: readonly string[];
  readonly days: readonly Weekday[];
  readonly active: boolean;
}

const daysOf = (mask: number): Weekday[] => WEEK.filter((d) => (mask & (1 << (d - 1))) !== 0);
const maskOf = (days: readonly Weekday[]): number => days.reduce((m, d) => m | (1 << (d - 1)), 0);
const EMPTY_FORM: FormState = { id: null, name: '', dose: '', unit: '', times: ['08:00'], days: WEEK, active: true };

/** « lun., mar. » ou « tous les jours ». */
function daysText(mask: number): string {
  return mask === ALL_DAYS ? tSupplements('everyDay') : daysOf(mask).map((d) => weekdayName(d, 'short')).join(', ');
}

function summary(s: Supplement): string {
  return [formatSupplementDose(s.dose, s.unit), s.times.join(', '), daysText(s.days)].filter((x): x is string => x !== null).join(' · ');
}

function adherenceText(a: SupplementAdherence): string {
  return a.ratio === null ? tSupplements('statsNone') : tSupplements('statsValue', { pct: Math.round(a.ratio * 100), taken: a.taken, due: a.due });
}

const STRIP_DAYS = 14;
const LEVEL_TEXT = { full: 'dayFull', partial: 'dayPartial', none: 'dayNone', free: 'dayFree' } as const satisfies Record<ConstancyDay['level'], SupplementsTextKey>;

/** « Matin », « Après-midi » ou « Soir » selon l'heure de la prise (Complements-apres : « Matin · 08:00 »). */
function momentName(time: string): string {
  const hour = Number(time.slice(0, 2));
  return tSupplements(hour < 12 ? 'momentMorning' : hour < 18 ? 'momentAfternoon' : 'momentEvening');
}

/** Sous-titre d'une prise : « 5 g · pris » ou « 2 capsules · prévu à 20:00 ». */
function intakeSub(item: DueIntake): string {
  const dose = formatSupplementDose(item.supplement.dose, item.supplement.unit);
  const state = item.taken ? tSupplements('intakeTaken') : tSupplements('intakePlanned', { time: item.moment });
  return dose === null ? state : `${dose} · ${state}`;
}

/** Rappels : état lisible du dernier passage (iPhone) ; PC : « envoyés par l'iPhone ». */
function remindersNote(result: SupplementNotificationResult | null): string | null {
  if (result === null) return null;
  if (result.status === 'unsupported') return tSupplements('remindersPc');
  if (result.status === 'permission') return tSupplements('remindersPermission');
  if (result.status === 'failed') return tSupplements('remindersFailed');
  return null;
}

/**
 * Section « Compléments » de Nutrition (I6-05, § 15.3 ; D-210 à D-214) : liste (actifs et en pause), ajout et modification, pause, suppression
 * après confirmation, constance sur 7 et 30 jours et série, interrupteur des rappels de cet iPhone (désactivés par défaut ; le PC n'envoie rien).
 * Bloc à la demande avec son catalogue de textes ; écriture impossible : message visible, rien de perdu dans le formulaire.
 */
export function SupplementsView({ today }: { readonly today: LocalDate }) {
  const container = useAppContainer();
  const { data } = container;
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<SupplementsTextKey | null>(null);
  const [confirm, setConfirm] = useState<Supplement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reminders, setReminders] = useState<{ readonly enabled: boolean; readonly result: SupplementNotificationResult | null } | null>(null);
  const synced = useSyncedData(['supplement', 'supplement_intake']);

  const read = useCallback(async (): Promise<Load> => {
    try {
      const repo = await data.repos.supplements();
      const [supplements, intakes] = await Promise.all([repo.list(), repo.intakes(addDays(today, -(HISTORY_DAYS - 1)), today)]);
      return { status: 'ready', supplements, intakes };
    } catch {
      return { status: 'failed' };
    }
  }, [data, today]);
  const reload = useCallback(async (): Promise<void> => setLoad(await read()), [read]);

  useEffect(() => {
    let live = true;
    void read().then((next) => {
      if (live) setLoad(next);
    });
    return () => {
      live = false;
    };
  }, [read, synced]);

  useEffect(() => {
    let live = true;
    void import('../../notifications').then(async (m) => {
      const service = m.supplementNotificationsFor(container);
      const prefs = await service.readPrefs();
      const result = await service.replan();
      if (live) setReminders({ enabled: prefs.enabled, result });
    });
    return () => {
      live = false;
    };
  }, [container]);

  const stats = useMemo(() => {
    if (load.status !== 'ready') return null;
    const { supplements, intakes } = load;
    return {
      week: supplementAdherence(supplements, intakes, addDays(today, -6), today),
      month: supplementAdherence(supplements, intakes, addDays(today, -(HISTORY_DAYS - 1)), today),
      streak: supplementStreak(supplements, intakes, today),
      strip: constancyDays(supplements, intakes, today, STRIP_DAYS),
      stripShare: supplementAdherence(supplements, intakes, addDays(today, -(STRIP_DAYS - 1)), today),
      todays: dueIntakes(supplements, intakes, today),
    };
  }, [load, today]);

  const toggleIntake = async (item: DueIntake): Promise<void> => {
    try {
      await (await data.repos.supplements()).setTaken(item.supplement.id, today, item.moment, !item.taken);
      await afterWrite(null);
    } catch {
      setNotice(tSupplements('writeError'));
    }
  };

  const afterWrite = async (message: string | null): Promise<void> => {
    setNotice(message);
    await reload();
    replanSupplementReminders(container);
  };

  const save = async (): Promise<void> => {
    if (form === null) return;
    const doseText = form.dose.trim().replace(',', '.');
    const dose = doseText === '' ? null : Number(doseText);
    const input = { name: form.name, dose, unit: form.unit, times: form.times.filter((t) => t !== ''), days: maskOf(form.days), active: form.active };
    const valid = validateSupplementDraft(input);
    if (!valid.ok) {
      setFormError(ERROR_KEY[valid.error]);
      return;
    }
    try {
      const repo = await data.repos.supplements();
      if (form.id === null) await repo.create(input);
      else await repo.update(form.id, input);
      setForm(null);
      setFormError(null);
      await afterWrite(tSupplements('saved'));
    } catch {
      setFormError('errorWrite');
    }
  };

  const setActive = async (s: Supplement, active: boolean): Promise<void> => {
    try {
      await (await data.repos.supplements()).update(s.id, { ...s, active });
      await afterWrite(null);
    } catch {
      setNotice(tSupplements('errorWrite'));
    }
  };

  const remove = async (s: Supplement): Promise<void> => {
    setConfirm(null);
    try {
      await (await data.repos.supplements()).remove(s.id);
      await afterWrite(null);
    } catch {
      setNotice(tSupplements('errorWrite'));
    }
  };

  const toggleReminders = async (enabled: boolean): Promise<void> => {
    const m = await import('../../notifications');
    const result = await m.supplementNotificationsFor(container).requestPermissionAndReplan({ v: 1, enabled });
    setReminders({ enabled, result });
  };

  const edit = (s: Supplement): void => {
    setFormError(null);
    setForm({ id: s.id, name: s.name, dose: s.dose === null ? '' : String(s.dose), unit: s.unit ?? '', times: [...s.times], days: daysOf(s.days), active: s.active });
  };

  if (load.status === 'loading') {
    return (
      <p className="ct-nutrition__muted" role="status">
        {tSupplements('loading')}
      </p>
    );
  }
  if (load.status === 'failed') {
    return (
      <div role="alert" className="ct-nutrition__error">
        <p>{tSupplements('loadError')}</p>
        <Button variant="secondary" onClick={() => void reload()}>
          {tSupplements('retry')}
        </Button>
      </div>
    );
  }

  const supplements = load.status === 'ready' ? load.supplements : [];
  const note = remindersNote(reminders?.result ?? null);
  return (
    <div className="ct-supplements">
      {notice !== null ? (
        <p role="status" className="ct-nutrition__muted">
          {notice}
        </p>
      ) : null}
      {stats !== null && supplements.length > 0 ? <TodayIntakes items={stats.todays} onToggle={(item) => void toggleIntake(item)} /> : null}
      {form !== null ? (
        <form
          className="ct-supplements__form ct-flat"
          aria-labelledby="ct-supplements-form-title"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h3 id="ct-supplements-form-title" className="ct-section-title">{tSupplements(form.id === null ? 'formTitleNew' : 'formTitleEdit')}</h3>
          <label className="ct-nutrition__field">
            <span className="ct-nutrition__field-label">{tSupplements('name')}</span>
            <input className="ct-nutrition__input" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <div className="ct-nutrition__row">
            <label className="ct-nutrition__field">
              <span className="ct-nutrition__field-label">{tSupplements('dose')}</span>
              <input className="ct-nutrition__input" inputMode="decimal" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} />
            </label>
            <label className="ct-nutrition__field">
              <span className="ct-nutrition__field-label">{tSupplements('unit')}</span>
              <input className="ct-nutrition__input" maxLength={16} placeholder={tSupplements('unitHint')} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </label>
          </div>
          <fieldset className="ct-supplements__fieldset">
            <legend className="ct-nutrition__field-label">{tSupplements('timesLegend')}</legend>
            {form.times.map((time, i) => (
              <span key={i} className="ct-supplements__actions">
                <input
                  type="time"
                  className="ct-nutrition__input"
                  aria-label={tSupplements('timeLabel', { n: i + 1 })}
                  value={time}
                  onChange={(e) => setForm({ ...form, times: form.times.map((t, j) => (j === i ? e.target.value : t)) })}
                />
                {form.times.length > 1 ? (
                  <Button variant="secondary" ariaLabel={tSupplements('removeTime', { n: i + 1 })} onClick={() => setForm({ ...form, times: form.times.filter((_, j) => j !== i) })}>
                    −
                  </Button>
                ) : null}
              </span>
            ))}
            {form.times.length < 4 ? (
              <Button variant="secondary" onClick={() => setForm({ ...form, times: [...form.times, ''] })}>
                {tSupplements('addTime')}
              </Button>
            ) : null}
          </fieldset>
          <WeekdayToggles label={tSupplements('days')} value={form.days} onToggle={(day) => setForm({ ...form, days: form.days.includes(day) ? form.days.filter((d) => d !== day) : [...form.days, day] })} />
          {formError !== null ? (
            <p role="alert" className="ct-nutrition__error">
              {tSupplements(formError)}
            </p>
          ) : null}
          <div className="ct-supplements__actions">
            <Button type="submit">{tSupplements('save')}</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setForm(null);
                setFormError(null);
              }}
            >
              {tSupplements('cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          onClick={() => {
            setFormError(null);
            setForm(EMPTY_FORM);
          }}
        >
          {tSupplements('add')}
        </Button>
      )}

      {supplements.length === 0 ? (
        <div className="ct-supplements__panel ct-flat">
          <p>{tSupplements('empty')}</p>
          <p className="ct-nutrition__muted">{tSupplements('emptyHint')}</p>
        </div>
      ) : (
        <>
        <h3 className="ct-section-title">{tSupplements('listLabel')}</h3>
        <ul className="ct-supplements__list" aria-label={tSupplements('listLabel')}>
          {supplements.map((s) => (
            <li key={s.id} className="ct-supplements__item" aria-label={s.name}>
              <div className="ct-supplements__item-text">
                <p className="ct-supplements__item-name">{s.name}</p>
                <p className="ct-nutrition__muted">{summary(s)}</p>
                {!s.active ? <p className="ct-nutrition__muted">{tSupplements('paused')}</p> : null}
              </div>
              <div className="ct-supplements__actions">
                <Switch checked={s.active} label={tSupplements('active')} onChange={(active) => void setActive(s, active)} />
                <Button variant="secondary" onClick={() => edit(s)}>
                  {tSupplements('edit')}
                </Button>
                <Button variant="secondary" onClick={() => setConfirm(s)}>
                  {tSupplements('remove')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        </>
      )}

      {stats !== null ? (
        <section className="ct-supplements__panel ct-flat" aria-labelledby="ct-supplements-stats">
          <h3 id="ct-supplements-stats" className="ct-section-title">{tSupplements('statsTitle')}</h3>
          <p>{tSupplements('stats7', { value: adherenceText(stats.week) })}</p>
          <p>{tSupplements('stats30', { value: adherenceText(stats.month) })}</p>
          <p>{stats.streak === 0 ? tSupplements('streakNone') : stats.streak === 1 ? tSupplements('streakOne') : tSupplements('streakMany', { n: stats.streak })}</p>
          <ul className="ct-supplements__strip" aria-label={tSupplements('stripLabel')}>
            {stats.strip.map((day) => (
              <li key={day.date} className={`ct-supplements__day ct-supplements__day--${day.level}`}>
                <span className="ct-visually-hidden">{tSupplements('dayLine', { date: formatDayMonth(day.date), state: tSupplements(LEVEL_TEXT[day.level]) })}</span>
              </li>
            ))}
          </ul>
          <p className="ct-nutrition__muted">
            {tSupplements('stripLegend')} ·{' '}
            {stats.stripShare.ratio === null ? <MissingValue reason={tSupplements('stripNone')} /> : tSupplements('stripShare', { pct: Math.round(stats.stripShare.ratio * 100) })}
          </p>
        </section>
      ) : null}

      <section className="ct-supplements__panel ct-flat" aria-labelledby="ct-supplements-reminders">
        <h3 id="ct-supplements-reminders" className="ct-section-title">{tSupplements('remindersTitle')}</h3>
        {reminders !== null && reminders.result?.status !== 'unsupported' ? (
          <>
            <Switch checked={reminders.enabled} label={tSupplements('remindersLabel')} onChange={(enabled) => void toggleReminders(enabled)} />
            <p className="ct-nutrition__muted">{tSupplements('remindersHint')}</p>
          </>
        ) : null}
        {note !== null ? <p className="ct-nutrition__muted">{note}</p> : null}
      </section>

      {confirm !== null ? (
        <ConfirmDialog
          title={tSupplements('removeTitle', { name: confirm.name })}
          description={tSupplements('removeDescription')}
          confirmLabel={tSupplements('removeConfirm')}
          onConfirm={() => void remove(confirm)}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}

/** Héros « 2 / 3 pris aujourd'hui » et prises du jour par heure (Complements-apres) : coche de 44 px, état dit en texte. */
function TodayIntakes({ items, onToggle }: { readonly items: readonly DueIntake[]; readonly onToggle: (item: DueIntake) => void }) {
  const groups = [...new Set(items.map((i) => i.moment))].map((moment) => ({ moment, items: items.filter((i) => i.moment === moment) }));
  return (
    <div className="ct-supplements__today" role="group" aria-label={tSupplements('todayGroup')}>
      {items.length === 0 ? (
        <p className="ct-today__text">
          <MissingValue reason={tSupplements('todayNone')} />
        </p>
      ) : (
        <p className="ct-hero">
          <span className="ct-hero__num">{tSupplements('todayCount', { taken: items.filter((i) => i.taken).length, total: items.length })}</span>
          <span className="ct-hero__unit">{tSupplements('todayUnit')}</span>
        </p>
      )}
      {groups.map((group) => (
        <section key={group.moment} className="ct-supplements__group" aria-label={tSupplements('groupHeading', { moment: momentName(group.moment), time: group.moment })}>
          <h3 className="ct-section-title">{tSupplements('groupHeading', { moment: momentName(group.moment), time: group.moment })}</h3>
          <ul className="ct-supplements__rows">
            {group.items.map((item) => (
              <li key={item.supplement.id} className="ct-supplements__row">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.taken}
                  aria-label={tSupplements(item.taken ? 'checkTaken' : 'checkMark', { name: item.supplement.name })}
                  className="ct-supplements__ck"
                  onClick={() => onToggle(item)}
                >
                  {item.taken ? <Icon icon={Check} size="sm" /> : null}
                </button>
                <div className="ct-supplements__item-text">
                  <p>{item.supplement.name}</p>
                  <p className="ct-nutrition__muted">{intakeSub(item)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
