import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import { asEntityId, type DeviceId } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import type { HealthKit, HealthKitBodyMass, HealthKitRead, HealthKitStepCount } from '../../platform/healthkit';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer, type AppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { logFailure } from '../../platform/desktop/log';
import { AppleHealthScreen } from './AppleHealthScreen';
import { SettingsScreen } from './SettingsScreen';

/**
 * Finitions 0.1.2 (d) : Apple Santé dans Plus (iPhone seulement), SPA-006 et D-59. Lecture seule de bodyMass et stepCount ; iOS ne dit jamais
 * si la lecture est accordée : l'écran ne l'affirme jamais. « Utiliser cette pesée » passe par saveHealth, sans écraser la saisie manuelle.
 */
vi.mock('../../platform/desktop/log', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), logFailure: vi.fn() }));

const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-000000000009');

const MASS: HealthKitBodyMass = {
  kg: 82.4,
  measuredAt: '2026-10-01T05:48:00Z',
  timezone: 'Europe/Paris',
  uuid: 'AAAA-1111',
  source: { name: 'Balance Withings', bundleIdentifier: 'com.withings.wiScaleNG' },
};
const STEPS: HealthKitStepCount = {
  count: 8432,
  unit: 'count',
  start: '2026-09-30T22:00:00Z',
  end: '2026-10-01T06:00:00Z',
  timezone: 'Europe/Paris',
  sources: [{ name: 'iPhone d’Ali', bundleIdentifier: 'com.apple.health.X' }],
};

interface Plan {
  availability: Awaited<ReturnType<HealthKit['availability']>>;
  permission: Awaited<ReturnType<HealthKit['requestAuthorization']>>;
  mass: HealthKitRead<HealthKitBodyMass>;
  steps: HealthKitRead<HealthKitStepCount>;
  diagnostic?: Awaited<ReturnType<HealthKit['diagnostic']>>;
}
const GRANTED: Plan = { availability: 'available', permission: 'unknown', mass: { state: 'granted', value: MASS }, steps: { state: 'granted', value: STEPS } };

function fakeHealthKit(plan: Plan) {
  const calls: string[] = [];
  const healthKit: HealthKit = {
    availability: vi.fn(async () => (calls.push('availability'), plan.availability)),
    requestAuthorization: vi.fn(async () => (calls.push('authorize'), plan.permission)),
    bodyMassToday: vi.fn(async () => (calls.push('bodyMass'), plan.mass)),
    stepCountToday: vi.fn(async () => (calls.push('steps'), plan.steps)),
    diagnostic: vi.fn(async () => (calls.push('diagnostic'), plan.diagnostic ?? { available: true, usageDescription: true, error: null })),
  };
  return { calls, healthKit };
}

function mockViewport(width: number): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width >= 1024 && query.includes('min-width: 1024px'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('Apple Santé (finitions 0.1.2 d)', () => {
  let db: TestDb;
  let container: AppContainer;

  const build = (platform: AppContainer['platform']): AppContainer =>
    createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform });
  const renderHealth = (healthKit: HealthKit) =>
    render(
      <AppContainerProvider container={container}>
        <AppleHealthScreen healthKit={healthKit} />
      </AppContainerProvider>,
    );
  const authorize = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Autoriser l’accès' }));
  };

  beforeEach(async () => {
    mockViewport(440);
    db = await openBaseDb(DEVICE);
    container = build({ runtime: 'tauri', os: 'ios' });
  });
  afterEach(async () => {
    cleanup();
    vi.unstubAllGlobals();
    useNavigationStore.setState(INITIAL_NAVIGATION);
    await db.close();
  });

  describe('ligne dans Plus', () => {
    it('iPhone : la ligne « Apple Santé » ouvre l’écran, sans prétendre que l’accès est accordé', async () => {
      render(
        <AppContainerProvider container={container}>
          <SettingsScreen />
        </AppContainerProvider>,
      );
      const row = await screen.findByRole('button', { name: /Apple Santé/ });
      expect(row).not.toHaveTextContent(/autorisé|accordé/i);
      expect(screen.getByRole('heading', { name: 'IPHONE' })).toBeInTheDocument();
      fireEvent.click(row);
      expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'health' });
    });

    it.each([
      ['PC (Tauri Windows)', { runtime: 'tauri', os: 'windows' }],
      ['navigateur', { runtime: 'web', os: 'other' }],
    ] as const)('%s : aucune ligne « Apple Santé »', async (_name, platform) => {
      container = build(platform);
      render(
        <AppContainerProvider container={container}>
          <SettingsScreen />
        </AppContainerProvider>,
      );
      await screen.findByRole('heading', { level: 1, name: 'Plus' });
      expect(screen.queryByText(/Apple Santé/)).toBeNull();
    });
  });

  describe('écran', () => {
    it('avant la demande : « Autoriser l’accès » seul, aucune lecture, mention de la lecture seule', async () => {
      const { healthKit, calls } = fakeHealthKit(GRANTED);
      renderHealth(healthKit);
      expect(await screen.findByRole('button', { name: 'Autoriser l’accès' })).toBeInTheDocument();
      expect(screen.getByText(/en lecture seule/)).toBeInTheDocument();
      expect(calls).not.toContain('bodyMass');
      expect(calls).not.toContain('steps');
      expect(screen.queryByText(/82,4/)).toBeNull();
    });

    it('après la demande : poids et pas du jour avec leur source, sans affirmer que l’accès est accordé', async () => {
      const { healthKit, calls } = fakeHealthKit(GRANTED);
      renderHealth(healthKit);
      await authorize();
      expect(await screen.findByText('82,4 kg')).toBeInTheDocument();
      expect(screen.getByText(/Balance Withings/)).toBeInTheDocument();
      expect(screen.getByText(/07:48/)).toBeInTheDocument();
      expect(screen.getByText(/^8\s432 pas$/)).toBeInTheDocument();
      expect(screen.getByText(/iPhone d’Ali/)).toBeInTheDocument();
      expect(calls.filter((c) => c === 'authorize')).toHaveLength(1);
      // iOS ne révèle jamais l'accord de lecture : la demande terminée est décrite comme « terminée », pas comme « accordée ».
      expect(screen.getByText(/iOS ne dit pas si la lecture est accordée/)).toBeInTheDocument();
      expect(screen.queryByText(/accès accordé|accès autorisé|autorisation accordée/i)).toBeNull();
    });

    it('résultat vide : « aucune donnée » distinct d’un refus, avec la limite d’iOS dite', async () => {
      const { healthKit } = fakeHealthKit({ ...GRANTED, mass: { state: 'empty' }, steps: { state: 'empty' } });
      renderHealth(healthKit);
      await authorize();
      expect(await screen.findByText('Aucune pesée aujourd’hui dans Santé.')).toBeInTheDocument();
      expect(screen.getByText('Aucun pas lu aujourd’hui dans Santé.')).toBeInTheDocument();
      expect(screen.getByText(/ne dit pas si l’accès est refusé ou s’il n’y a simplement aucune donnée/)).toBeInTheDocument();
      expect(screen.queryByText(/Accès refusé/)).toBeNull();
      expect(screen.queryByText(/0 pas/)).toBeNull();
      expect(screen.queryByRole('button', { name: 'Utiliser cette pesée' })).toBeNull();
    });

    it('refus explicite : message de refus et recours (Réglages de Santé, saisie manuelle), aucune lecture', async () => {
      const { healthKit, calls } = fakeHealthKit({ ...GRANTED, permission: 'denied' });
      renderHealth(healthKit);
      await authorize();
      expect(await screen.findByText(/Accès refusé/)).toBeInTheDocument();
      expect(screen.getByText(/saisis ton poids à la main/)).toBeInTheDocument();
      expect(calls).not.toContain('bodyMass');
      expect(screen.queryByText(/Aucune pesée/)).toBeNull();
    });

    it('Santé indisponible : message propre, pas de bouton d’autorisation, recours à la saisie manuelle', async () => {
      const { healthKit } = fakeHealthKit({ ...GRANTED, availability: 'unavailable' });
      renderHealth(healthKit);
      expect(await screen.findByText(/Santé n’est pas disponible sur cet iPhone/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Autoriser l’accès' })).toBeNull();
      expect(screen.queryByText(/Accès refusé/)).toBeNull();
    });

    it('PC (unsupported) : l’écran indique que Santé est sur l’iPhone', async () => {
      const { healthKit } = fakeHealthKit({ ...GRANTED, availability: 'unsupported' });
      renderHealth(healthKit);
      expect(await screen.findByText(/n’est disponible que sur l’iPhone/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Autoriser l’accès' })).toBeNull();
    });

    it('erreur de lecture : alerte visible avec « Réessayer », qui relit', async () => {
      const plan: Plan = { ...GRANTED, mass: { state: 'error', code: 'timeout' } };
      const { healthKit, calls } = fakeHealthKit(plan);
      renderHealth(healthKit);
      await authorize();
      expect(await screen.findByRole('alert')).toHaveTextContent(/timeout/);
      plan.mass = { state: 'granted', value: MASS };
      fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
      expect(await screen.findByText('82,4 kg')).toBeInTheDocument();
      expect(calls.filter((c) => c === 'bodyMass')).toHaveLength(2);
    });

    it('« Utiliser cette pesée » enregistre par saveHealth et conserve la saisie manuelle du jour', async () => {
      const bodyWeights = await db.data.repos.bodyWeights();
      await bodyWeights.saveManual({ date: '2026-10-01' as never, kg: 83.1, timezone: 'Europe/Paris' }, '2026-10-01' as never);
      const { healthKit } = fakeHealthKit(GRANTED);
      renderHealth(healthKit);
      await authorize();
      fireEvent.click(await screen.findByRole('button', { name: 'Utiliser cette pesée' }));
      expect(await screen.findByText(/Pesée enregistrée/)).toBeInTheDocument();
      expect(screen.getByText(/saisie manuelle du jour est conservée/)).toBeInTheDocument();
      await waitFor(async () => {
        const rows = await bodyWeights.listRecent(10);
        expect(rows.map((r) => [r.source, r.kg]).sort()).toEqual([
          ['health', 82.4],
          ['manual', 83.1],
        ]);
      });
      const health = (await bodyWeights.listRecent(10)).find((r) => r.source === 'health');
      expect(health?.healthUuid).toBe('AAAA-1111');
    });

    it('aucune écriture dans Santé : la façade n’expose que des lectures', async () => {
      const { healthKit } = fakeHealthKit(GRANTED);
      expect(Object.keys(healthKit).sort()).toEqual(['availability', 'bodyMassToday', 'diagnostic', 'requestAuthorization', 'stepCountToday']);
      renderHealth(healthKit);
      await authorize();
      await within(document.body).findByText('82,4 kg');
    });
  });

  describe('détail technique (0.1.3)', () => {
    const NATIVE = { domain: 'com.apple.healthkit', code: 4, description: 'Missing entitlement.' };
    const FAILED: Plan = { ...GRANTED, permission: 'error', diagnostic: { available: true, usageDescription: true, error: NATIVE } };

    it('demande échouée : « Détail technique » repliable, fermé au départ, avec domaine, code, description, texte d’usage et disponibilité', async () => {
      const { healthKit } = fakeHealthKit(FAILED);
      renderHealth(healthKit);
      await authorize();
      expect(await screen.findByText('La demande d’accès à Santé a échoué. Réessaie.')).toBeInTheDocument();
      const summary = await screen.findByText('Détail technique');
      const details = summary.closest('details') as HTMLDetailsElement;
      expect(details).not.toBeNull();
      expect(details.open).toBe(false);
      expect(details).toHaveTextContent('com.apple.healthkit');
      expect(details).toHaveTextContent('Code : 4');
      expect(details).toHaveTextContent('Missing entitlement.');
      expect(details).toHaveTextContent('Santé disponible : oui');
      expect(details).toHaveTextContent('Texte d’usage Info.plist : présent');
    });

    it('texte d’usage absent ou Santé indisponible : dit « absent » / « non », jamais passé sous silence', async () => {
      const { healthKit } = fakeHealthKit({ ...FAILED, diagnostic: { available: false, usageDescription: false, error: null } });
      renderHealth(healthKit);
      await authorize();
      const details = (await screen.findByText('Détail technique')).closest('details') as HTMLDetailsElement;
      expect(details).toHaveTextContent('Santé disponible : non');
      expect(details).toHaveTextContent('Texte d’usage Info.plist : absent');
      expect(details).toHaveTextContent('Erreur native : aucune');
    });

    it('le détail est écrit dans le journal technique (scope healthkit, code natif, sans donnée de santé)', async () => {
      vi.mocked(logFailure).mockClear();
      const { healthKit } = fakeHealthKit(FAILED);
      renderHealth(healthKit);
      await authorize();
      await screen.findByText('Détail technique');
      expect(logFailure).toHaveBeenCalledTimes(1);
      const [scope, error] = vi.mocked(logFailure).mock.calls[0] as [string, { code: string; message: string }];
      expect(scope).toBe('healthkit');
      expect(error.code).toBe('healthkit-authorization-failed');
      expect(error.message).toMatch(/com.apple.healthkit/);
      expect(error.message).toMatch(/4/);
      expect(error.message).toMatch(/usage=oui/);
      expect(error.message).not.toMatch(/82|8s?432|kg/);
    });

    it('demande réussie : aucun détail technique affiché ni journalisé', async () => {
      vi.mocked(logFailure).mockClear();
      const { healthKit } = fakeHealthKit(GRANTED);
      renderHealth(healthKit);
      await authorize();
      await screen.findByText('82,4 kg');
      expect(screen.queryByText('Détail technique')).toBeNull();
      expect(logFailure).not.toHaveBeenCalled();
    });
  });
});
