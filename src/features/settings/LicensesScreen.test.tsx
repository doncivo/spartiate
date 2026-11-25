import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { LicensesScreen } from './LicensesScreen';
import { licencesFr } from '../../i18n/fr.licenses';

/**
 * SHELL-0294c (C-119, § 18.2 c) : « À propos et licences » dans Plus. La source est docs/licences.md : chaque ressource qui y est
 * nommée est rendue ; l'avis BSD de d3-ease (qui demande d'être reproduit dans l'app) y figure ; l'écran et son catalogue sont à la demande.
 */
describe('LicensesScreen (C-119)', () => {
  beforeEach(() => useNavigationStore.setState(INITIAL_NAVIGATION));
  afterEach(() => cleanup());

  it('affiche chaque ressource de docs/licences.md avec sa licence', () => {
    render(<LicensesScreen />);
    const source = readFileSync(join(import.meta.dirname, '..', '..', '..', 'docs', 'licences.md'), 'utf8');
    for (const name of ['Cinzel', 'Lucide', 'Recharts', 'd3-ease', 'qrcode-generator', 'Ciqual', 'keyring', 'aws-lc-rs', 'tauri-plugin-geolocation']) {
      expect(source).toContain(name);
      expect(screen.getAllByText(new RegExp(name)).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/SIL Open Font License/)).toBeInTheDocument();
    expect(screen.getByText(/Licence Ouverte Etalab 2\.0/)).toBeInTheDocument();
  });

  it('reproduit l’avis BSD-3-Clause de d3-ease (copyright, conditions, avertissement)', () => {
    render(<LicensesScreen />);
    expect(screen.getByText(/Mike Bostock/)).toBeInTheDocument();
    expect(screen.getByText(/Robert Penner/)).toBeInTheDocument();
  });

  it('le retour ramène à Plus', () => {
    useNavigationStore.getState().navigate({ tab: 'more', screen: 'licenses' });
    render(<LicensesScreen />);
    fireEvent.click(screen.getByRole('button', { name: licencesFr.back }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'home' });
  });

  it('est servi à la demande par l’écran Plus (aucun écran de plus dans le départ)', () => {
    const settings = readFileSync(join(import.meta.dirname, 'SettingsScreen.tsx'), 'utf8');
    expect(settings).toContain("import('./LicensesScreen')");
    expect(readFileSync(join(import.meta.dirname, '..', 'app', 'screenNames.ts'), 'utf8')).not.toContain("'licensesscreen'");
  });

  it('affiche en entier l’avis de licence de d3-ease (texte de node_modules/d3-ease/LICENSE), comme l’exige docs/licences.md', () => {
    render(<LicensesScreen />);
    const full = readFileSync(join(import.meta.dirname, '..', '..', '..', 'node_modules', 'd3-ease', 'LICENSE'), 'utf8');
    const norm = (text: string): string => text.split(/\s+/).join(' ').trim();
    const shown = screen.getByTestId('license-d3-ease');
    expect(norm(shown.textContent ?? '')).toBe(norm(full));
  });
});
