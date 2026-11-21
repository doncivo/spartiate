import { describe, expect, it } from 'vitest';
import { trailingWeeks } from '../../domain/training/progressStats';
import type { LocalDate } from '../../domain/types';
import { FIRST_WEEKDAYS, weekStartOf } from '../../domain/week';
import { formatDuration as displayDuration } from '../recovery/display';
import { formatDuration as trendsDuration } from '../recovery/RecoveryTrends';
import { localDayOf as cycleLocalDayOf } from '../training/cycle/currentCycle';
import { localDayOf as constancyLocalDayOf } from './constancyData';

/**
 * Revue à froid de PROGRES : les règles recopiées pour tenir le bundle de départ restent égales à leur original (une correction de
 * l'original sans la copie casse ce test). Valeurs synthétiques.
 */

describe('règles recopiées de PROGRES = originaux', () => {
  it('début de semaine (progressStats) = week.weekStartOf, 70 jours × 3 débuts de semaine', () => {
    const days = Array.from({ length: 70 }, (_, i) => new Date(Date.UTC(2026, 8, 28 + i)).toISOString().slice(0, 10) as LocalDate);
    for (const first of FIRST_WEEKDAYS) {
      expect(days.map((day) => trailingWeeks(day, 1, first)[0])).toEqual(days.map((day) => weekStartOf(day, first)));
    }
  });

  it('date locale (constancyData) = currentCycle.localDayOf, autour de minuit et des changements d’heure', () => {
    const instants: number[] = [];
    for (const iso of ['2026-03-29T00:30:00Z', '2026-03-29T01:30:00Z', '2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z', '2026-12-31T22:59:59Z', '2026-12-31T23:00:00Z']) {
      const base = Date.parse(iso);
      for (let h = -26; h <= 26; h += 1) instants.push(base + h * 3_600_000);
    }
    expect(instants.map(constancyLocalDayOf)).toEqual(instants.map(cycleLocalDayOf));
  });

  it('durée (RecoveryTrends) = display.formatDuration', () => {
    const minutes = [0, 0.4, 44.6, 45, 59, 59.5, 60, 61, 432, 480, 719.6, 1440];
    expect(minutes.map(trendsDuration)).toEqual(minutes.map(displayDuration));
  });
});
