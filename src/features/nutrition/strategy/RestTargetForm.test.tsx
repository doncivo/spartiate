import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RestPlan } from '../../../domain/nutrition';
import { RestTargetForm, type RestSaveResult } from './RestTargetForm';

/** C-103 : cible des jours de repos : saisie « −200 », kcal au-dessus de la cible, retrait qui échoue. */
afterEach(cleanup);
const TARGET = { kcal: 2600, proteinG: 150, fatG: 80, carbG: 320 };
const PLAN: RestPlan = { rest: { kcal: 2400, proteinG: 150, fatG: 80, carbG: 270 }, trainingDays: [1, 3, 5] };
const mount = (plan: RestPlan | null, onSave: (p: RestPlan | null, c: boolean) => Promise<RestSaveResult>) => render(<RestTargetForm target={TARGET} plan={plan} defaultDays={[1, 3, 5]} onSave={onSave} />);

describe('RestTargetForm (C-103)', () => {
  it('« −200 » dans l’écart : lu comme 200 kcal en moins, jamais refusé en silence', () => {
    mount(null, vi.fn());
    fireEvent.click(screen.getByRole('switch', { name: 'Cible des jours de repos' }));
    fireEvent.change(screen.getByLabelText('Écart les jours de repos (kcal en moins)'), { target: { value: '-200' } });
    expect(screen.getByText(/Jours de repos : 2\s?400 kcal/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer la cible de repos' })).toBeEnabled();
  });

  it('kcal de repos au-dessus de la cible : refusées avec leur raison, bouton inactif', () => {
    mount(null, vi.fn());
    fireEvent.click(screen.getByRole('switch', { name: 'Cible des jours de repos' }));
    fireEvent.click(screen.getByRole('radio', { name: 'En kcal' }));
    fireEvent.change(screen.getByLabelText('Calories les jours de repos (kcal)'), { target: { value: '2800' } });
    expect(screen.getByRole('alert')).toHaveTextContent('La cible de repos doit rester sous celle des jours d’entraînement.');
    expect(screen.getByRole('button', { name: 'Enregistrer la cible de repos' })).toBeDisabled();
  });

  it('retrait qui échoue : l’interrupteur revient sur « activé » et l’erreur est dite', async () => {
    mount(PLAN, () => Promise.resolve('error'));
    fireEvent.click(screen.getByRole('switch', { name: 'Cible des jours de repos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enregistrement impossible. Réessaie.');
    expect(screen.getByRole('switch', { name: 'Cible des jours de repos' })).toHaveAttribute('aria-checked', 'true');
  });
});
