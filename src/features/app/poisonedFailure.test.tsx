import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DbError } from '../../db/driver';
import { t } from '../../i18n';
import { useAppStore, type DbFailure } from './appStore';
import { publishStartFailure } from './bootstrap';
import { DbFailureDetails, failureAlertKey } from './DbFailureDetails';

/** A-008, revue 1 : l'état « connexion invalidée » est durable et son écran n'offre que le redémarrage. */
const poisoned: DbFailure = { phase: 'start', step: 'connection-poisoned', errorName: 'DbError', message: 'ROLLBACK impossible (synthétique)', kind: 'connection-poisoned' };

describe('A-008 revue 1 : écran de l’échec fermé', () => {
  it('failureAlertKey rend le message de redémarrage', () => {
    expect(failureAlertKey(poisoned, false)).toBe('app.dbPoisoned');
    expect(t('app.dbPoisoned')).toContain('Ferme puis rouvre');
  });

  it('le détail n’offre pas « Réessayer » (même avec retry demandé), mais garde « Copier »', () => {
    render(<DbFailureDetails failure={poisoned} readEnvironment={() => Promise.resolve({ runtime: 'web', os: 'windows', buildPlatform: null, appVersion: null, paths: null, pathsError: null })} />);
    expect(screen.queryByRole('button', { name: t('app.diag.retry') })).toBeNull();
    expect(screen.getByRole('button', { name: t('app.diag.copy') })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('app.diag.copy') }));
  });
});

describe('A-008 revue 1 : l’état empoisonné n’est jamais écrasé', () => {
  beforeEach(() => {
    useAppStore.setState({ dbStatus: 'idle', dbErrorDetail: null, dbBackupFailed: false, dbFailure: null });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('un échec de démarrage ultérieur (publishStartFailure) ne remplace pas connection-poisoned', () => {
    useAppStore.getState().setDbStatus('error', { detail: poisoned.message, failure: poisoned });
    publishStartFailure('settings.set(device.id)', new DbError('unknown', 'autre erreur'));
    expect(useAppStore.getState().dbFailure).toMatchObject({ kind: 'connection-poisoned' });
  });

  it('« ready » ne remplace pas un empoisonnement survenu entre-temps', () => {
    useAppStore.getState().setDbStatus('error', { detail: poisoned.message, failure: poisoned });
    useAppStore.getState().setDbStatus('ready');
    expect(useAppStore.getState().dbStatus).toBe('error');
    expect(useAppStore.getState().dbFailure?.kind).toBe('connection-poisoned');
  });
});
