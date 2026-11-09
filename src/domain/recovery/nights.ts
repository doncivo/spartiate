import type { ShortcutSample, SleepNight } from './shortcutFiles';
import type { NightRecord } from './types';
import { utcToLocal } from '../timeZone';

function clockMinutes(iso: string, timeZone: string): number {
  const [h = 0, m = 0] = utcToLocal(iso, timeZone).time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Assemble les nuits lues dans `sommeil.csv` avec `hrv.csv` et `fc-repos.csv` pour le moteur : HRV = moyenne des échantillons pris entre
 * le coucher et le réveil (arrondie au dixième) ; FC repos = dernière valeur du jour local du réveil ; heures de coucher et de lever
 * en minutes locales. Mesure absente = null, jamais 0.
 */
export function toNightRecords(input: {
  readonly nights: readonly SleepNight[];
  readonly hrv: readonly ShortcutSample[];
  readonly restingHrByDay: readonly { readonly day: string; readonly value: number }[];
  readonly timeZone: string;
}): NightRecord[] {
  return input.nights.map((n) => {
    const from = Date.parse(n.bedAt);
    const to = Date.parse(n.wakeAt);
    const inNight = input.hrv.filter((s) => {
      const t = Date.parse(s.measuredAt);
      return t >= from && t <= to;
    });
    const hrvMs = inNight.length === 0 ? null : Math.round((inNight.reduce((s, x) => s + x.value, 0) / inNight.length) * 10) / 10;
    return {
      day: n.day,
      hrvMs,
      restingHr: input.restingHrByDay.find((r) => r.day === n.day)?.value ?? null,
      asleepMinutes: n.asleepMinutes,
      bedtimeMinutes: clockMinutes(n.bedAt, input.timeZone),
      wakeMinutes: clockMinutes(n.wakeAt, input.timeZone),
    };
  });
}
