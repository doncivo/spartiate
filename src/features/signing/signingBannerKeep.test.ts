import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFakeSigningAlert, createFakeSigningSource, type FakeSigningAlert, type FakeSigningSource } from '../../platform/signing';
import { useAppStatusStore } from '../app/appStatus';
import { useNavigationStore, INITIAL_NAVIGATION } from '../app/navigation';
import { replanSigning } from './signingRun';
import { setupSigning, type SigningHarness } from './testKit';

/** SHELL-0294c (C-126, § 18.3 a) : à moins de 24 h de l'expiration, le bandeau ne disparaît pas sur un échec de lecture et mène à la procédure SideStore. */
const SOON = '2026-10-08T18:00:00Z'; // 10 h après le « maintenant » du banc (08:00 UTC)
const banner = () => useAppStatusStore.getState().sources.signingExpiry;

describe('bandeau de signature (C-126, § 18.3 a)', () => {
  let h: SigningHarness;
  let source: FakeSigningSource;
  let alert: FakeSigningAlert;
  beforeEach(async () => {
    source = createFakeSigningSource();
    alert = createFakeSigningAlert();
    h = await setupSigning({ mode: 'fake', parts: { signing: { source, alert } } });
    useNavigationStore.setState(INITIAL_NAVIGATION);
  });
  afterEach(() => h.db.close());

  it('lecture en échec après une lecture connue à moins de 24 h : le bandeau reste affiché', async () => {
    source.expireAt(SOON);
    await replanSigning(h.container, 'open');
    expect(banner()).toBeDefined();
    source.fail('profile-unreadable');
    await replanSigning(h.container, 'resume');
    expect(banner()).toBeDefined();
  });

  it('sans aucune lecture connue, un échec n’affiche aucun bandeau d’expiration', async () => {
    source.fail('profile-unreadable');
    await replanSigning(h.container, 'open');
    expect(banner()).toBeUndefined();
  });

  it('« Voir » ouvre la procédure SideStore', async () => {
    source.expireAt(SOON);
    await replanSigning(h.container, 'open');
    banner()?.onAction?.();
    expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'sidestore' });
  });
});
