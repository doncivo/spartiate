import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MEASUREMENT_KINDS, type MeasurementKind } from '../../domain/bodyProgress';
import type { LocalDate } from '../../domain/types';
import { ZoneList } from './BodyZones';
import { summarizeZone, type ZoneSummary } from './bodyZone';

afterEach(cleanup);
const p = (date: string, value: number) => ({ date: date as LocalDate, value });
const all = (s: ZoneSummary): Record<MeasurementKind, ZoneSummary> => Object.fromEntries(MEASUREMENT_KINDS.map((k) => [k, k === 'chest' ? s : summarizeZone([])])) as Record<MeasurementKind, ZoneSummary>;

/** C-090 : la colonne « 4 sem. » ne porte un écart que s'il couvre 4 semaines ; sinon « — » et la phrase complète pour les lecteurs d'écran. */
describe('ZoneList : colonne « 4 sem. » (C-090)', () => {
  it('référence à 5 mois : pas d’écart dans la colonne', () => {
    render(<ZoneList kind="chest" summaries={all(summarizeZone([p('2026-06-01', 80), p('2026-11-01', 85)]))} onSelect={vi.fn()} />);
    const delta = document.getElementById('ct-zone-delta-chest');
    expect(delta?.textContent).toBe('pas d’écart sur 4 semaines');
    expect(screen.queryByText('+5')).toBeNull();
  });

  it('référence à 4 semaines : l’écart est affiché', () => {
    render(<ZoneList kind="chest" summaries={all(summarizeZone([p('2026-10-12', 80), p('2026-11-09', 82)]))} onSelect={vi.fn()} />);
    expect(document.getElementById('ct-zone-delta-chest')?.textContent).toMatch(/2/);
    expect(document.getElementById('ct-zone-delta-chest')?.textContent).not.toMatch(/pas d’écart/);
  });
});
