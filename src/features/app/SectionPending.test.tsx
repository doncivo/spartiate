import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionPending } from './SectionPending';

/** Plus jamais de zone blanche : une section sans écran le dit (Spartiate 0.1.0, quatre sections neutres). */
describe('section sans écran', () => {
  it('affiche le nom de la section et une phrase explicite', () => {
    render(<SectionPending labelKey="nav.tabs.training" />);
    expect(screen.getByRole('status')).toHaveTextContent('Entraînement');
    expect(screen.getByRole('status')).toHaveTextContent('pas encore disponible');
  });
});
