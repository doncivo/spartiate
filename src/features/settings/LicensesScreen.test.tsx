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
    for (const name of ['Cinzel', 'Lucide', 'qrcode-generator', 'Ciqual', 'keyring', 'aws-lc-rs', 'tauri-plugin-geolocation']) {
      expect(source).toContain(name);
      expect(screen.getAllByText(new RegExp(name)).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/SIL Open Font License/)).toBeInTheDocument();
    expect(screen.getByText(/Licence Ouverte Etalab 2\.0/)).toBeInTheDocument();
  });

  it('BL-116 : Recharts et d3-ease, retirés avec la dépendance jamais importée, ne sont plus crédités ni déclarés', () => {
    render(<LicensesScreen />);
    expect(screen.queryByText(/Recharts/)).toBeNull();
    expect(screen.queryByText(/d3-ease|Mike Bostock/)).toBeNull();
    const root = join(import.meta.dirname, '..', '..', '..');
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies)).not.toContain('recharts');
    expect(readFileSync(join(root, 'package-lock.json'), 'utf8')).not.toContain('node_modules/recharts');
    expect(readFileSync(join(root, 'docs', 'licences.md'), 'utf8')).not.toMatch(/^| `recharts` |/m);
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
});
