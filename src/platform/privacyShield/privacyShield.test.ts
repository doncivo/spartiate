import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakePrivacyShield, createNoopPrivacyShield, openPrivacyShield, shieldOwner } from './index';
import { setNativeShield, shieldFailureOf } from './tauriPrivacyShield';

describe('cache de confidentialité natif (I-03, ADR 0013 §2.5)', () => {
  afterEach(() => {
    delete (globalThis as { __ctPrivacyShield?: unknown }).__ctPrivacyShield;
    delete (globalThis as { __ctPrivacyShieldFake?: unknown }).__ctPrivacyShieldFake;
  });

  it('adaptateur : set_enabled { enabled } ; rejets → codes, jamais levés', async () => {
    const call = vi.fn(() => Promise.resolve({ enabled: true }));
    await expect(setNativeShield(true, call)).resolves.toEqual({ ok: true });
    expect(call).toHaveBeenCalledWith('plugin:privacy-shield|set_enabled', { enabled: true });
    await expect(setNativeShield(false, () => Promise.reject({ code: 'invalid-argument', message: 'invalid-argument' }))).resolves.toEqual({ ok: false, code: 'invalid-argument' });
    await expect(setNativeShield(true, () => Promise.reject('Command plugin:privacy-shield|set_enabled not allowed by ACL'))).resolves.toEqual({ ok: false, code: 'unavailable' });
    expect(shieldFailureOf({ code: 'other' })).toBe('unknown');
    expect(shieldFailureOf(new Error('boum'))).toBe('unknown');
  });

  it('PC et navigateur : vide, réussite sans effet', async () => {
    for (const [runtime, os] of [['tauri', 'windows'], ['web', 'ios']] as const) {
      const shield = openPrivacyShield(runtime, os);
      expect(shield.supported).toBe(false);
      await expect(shield.setEnabled(true)).resolves.toEqual({ ok: true });
    }
  });

  it('faux : appels enregistrés, échec réglable ; développement : __ctPrivacyShieldFake', async () => {
    (globalThis as { __ctPrivacyShieldFake?: boolean }).__ctPrivacyShieldFake = true;
    const shield = openPrivacyShield('web', 'other');
    const fake = (globalThis as { __ctPrivacyShield?: ReturnType<typeof createFakePrivacyShield> }).__ctPrivacyShield;
    await shield.setEnabled(true);
    fake?.failWith('unavailable');
    await expect(shield.setEnabled(false)).resolves.toEqual({ ok: false, code: 'unavailable' });
    expect(fake?.calls).toEqual([true, false]);
  });
});

describe('FIX-0171 (constat 5) : propriétaires du bouclier (verrouillage, vues photo)', () => {
  it('le bouclier reste actif tant qu’un propriétaire le demande ; retiré quand plus personne ne le demande', async () => {
    const base = createFakePrivacyShield();
    const lock = shieldOwner(base, 'appLock');
    const photos = shieldOwner(base, 'photos');
    expect(photos.supported).toBe(true);
    await lock.setEnabled(false);
    await photos.setEnabled(true);
    await lock.setEnabled(false);
    await photos.setEnabled(false);
    expect(base.calls).toEqual([false, true, true, false]);
    await lock.setEnabled(true);
    await photos.setEnabled(true);
    await photos.setEnabled(false);
    expect(base.calls.slice(-3)).toEqual([true, true, true]);
  });

  it('appels rapprochés : servis dans l’ordre, le dernier état demandé gagne', async () => {
    const base = createFakePrivacyShield();
    const photos = shieldOwner(base, 'photos');
    const results = await Promise.all([photos.setEnabled(true), photos.setEnabled(false), photos.setEnabled(true)]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(base.calls.at(-1)).toBe(true);
  });

  it('échec du plugin rendu au propriétaire, jamais levé', async () => {
    const base = createFakePrivacyShield();
    base.failWith('unavailable');
    await expect(shieldOwner(base, 'photos').setEnabled(true)).resolves.toEqual({ ok: false, code: 'unavailable' });
    const throwing = { supported: true, setEnabled: () => Promise.reject(new Error('boum')) };
    await expect(shieldOwner(throwing, 'photos').setEnabled(true)).resolves.toEqual({ ok: false, code: 'unknown' });
  });

  it('PC : bouclier vide, sans effet', async () => {
    const owner = shieldOwner(createNoopPrivacyShield(), 'photos');
    expect(owner.supported).toBe(false);
    await expect(owner.setEnabled(true)).resolves.toEqual({ ok: true });
  });
});
