import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// I3-07 : l'onboarding s'ouvre tout seul sur une base vide ; les tests d'écrans partent d'une base vide sans le vouloir. Accroche de
// développement `ct.skipOnboarding` (src/features/onboarding/launch.ts) : posée ici pour tous les tests DOM, retirée par ceux de l'onboarding.
beforeEach(() => {
  try {
    globalThis.localStorage?.setItem('ct.skipOnboarding', '1');
  } catch {
    /* stockage indisponible : l'accroche reste absente */
  }
});

afterEach(() => {
  cleanup();
});
