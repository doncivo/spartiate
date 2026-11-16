import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../../domain/hlc';
import { addDays } from '../../../domain/localDate';
import { DEFAULT_GENERATION_CONFIG } from '../../../domain/training/config';
import { createMesocycleSpec } from '../../../domain/training/mesocycle';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { PC_MEDIA_QUERY } from '../../../ui';
import { AppContainerProvider } from '../../app/AppContainerContext';
import { createAppContainer } from '../../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../../app/navigation';
import { TodaySessionCard } from './TodaySessionCard';

/** ERGO-03 critère 6 (D-297) : repère du cycle sur la carte Séance d'Aujourd'hui (iPhone et PC). Mardi 10 novembre 2026, valeurs synthétiques. */
const DEVICE = '60000000-0000-4000-8000-0000000000e4' as DeviceId;
const TODAY = '2026-11-10' as LocalDate;
let db: TestDb;

function viewport(layout: 'pc' | 'mobile'): void {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === PC_MEDIA_QUERY && layout === 'pc', media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}
const mount = () =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data })}>
      <TodaySessionCard />
    </AppContainerProvider>,
  );
async function follow(startDate: LocalDate, weeks = 4): Promise<void> {
  // Routine absente : le repère ne dépend que du cycle (la carte garde son état « Commencer une séance »).
  const spec = createMesocycleSpec({ routineId: '5e4d3c00-0000-4000-8000-000000000099', startDate, weeks }, DEFAULT_GENERATION_CONFIG);
  if (spec === null) throw new Error('spec');
  await db.data.transaction(async (repos) => (await repos.mesocycles()).start(spec));
}

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-10T07:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

describe.each(['mobile', 'pc'] as const)('ERGO-03 : repère du cycle (%s)', (layout) => {
  it('cycle de 4 semaines commencé hier : « Semaine 1 sur 4 », pas de décharge', async () => {
    viewport(layout);
    await follow(addDays(TODAY, -1));
    mount();
    expect(await screen.findByText('Semaine 1 sur 4')).toBeInTheDocument();
    expect(screen.queryByText('Décharge')).not.toBeInTheDocument();
  });

  it('semaine de décharge : « Semaine 4 sur 4 » et le badge « Décharge »', async () => {
    viewport(layout);
    await follow(addDays(TODAY, -22));
    mount();
    expect(await screen.findByText('Semaine 4 sur 4')).toBeInTheDocument();
    expect(screen.getByText('Décharge')).toHaveClass('ct-session-card__deload');
  });

  it('aucun cycle : rien', async () => {
    viewport(layout);
    mount();
    await screen.findByRole('button', { name: 'Commencer une séance' });
    expect(screen.queryByText(/^Semaine \d/)).not.toBeInTheDocument();
    expect(screen.queryByText('Décharge')).not.toBeInTheDocument();
  });
});

describe('ERGO-03 : badge bronze, tokens seulement', () => {
  it('le badge « Décharge » est écrit en bronze, par jetons', () => {
    const css = readFileSync(resolve(__dirname, 'Session.css'), 'utf8');
    const rule = /\n\.ct-session-card__deload \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('color: var(--ct-color-bronze)');
    expect(rule).toContain('border: 1px solid var(--ct-color-bronze)');
    expect(rule).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});
