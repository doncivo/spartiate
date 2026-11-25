import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { LicensesScreen } from './LicensesScreen';
import { SideStoreScreen } from './SideStoreScreen';

/** SHELL-0294c (§ 18.3 a) : la procédure d'actualisation par SideStore, écran à la demande atteint depuis le bandeau de signature. */
describe('SideStoreScreen', () => {
  beforeEach(() => useNavigationStore.setState(INITIAL_NAVIGATION));
  afterEach(() => cleanup());

  it('donne des étapes numérotées et un retour vers Plus', () => {
    render(<SideStoreScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Actualiser avec SideStore' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    fireEvent.click(screen.getByRole('button', { name: 'Retour à Plus' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'home' });
  });

  it('est servie à la demande par le bloc de l’écran Licences (route sidestore), sans écran de plus dans le départ', () => {
    useNavigationStore.getState().navigate({ tab: 'more', screen: 'sidestore' });
    render(<LicensesScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Actualiser avec SideStore' })).toBeInTheDocument();
    expect(readFileSync(join(import.meta.dirname, '..', 'app', 'screenNames.ts'), 'utf8')).not.toContain("'sidestorescreen'");
  });
});
