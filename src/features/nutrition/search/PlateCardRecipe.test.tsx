import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Plate } from '../../../domain/nutrition';
import { PlateCard } from './PlateCard';

/** SHELL-0294c (BL-164) : « Enregistrer en recette » est désactivé tant qu'une quantité de l'assiette est invalide (la recette prendrait les grammes retenus, pas ceux du champ). */
const PLATE = [{ food: { ref: 'custom:1', name: 'Skyr', per100g: { kcal: 60, proteinG: 11, fatG: 0.2, carbG: 4, fiberG: null } }, grams: 150 }] as unknown as Plate;

describe('PlateCard : enregistrement en recette', () => {
  afterEach(() => cleanup());

  it('désactivé quand une quantité saisie est invalide, de nouveau actif quand elle est corrigée', () => {
    const onSaveRecipe = vi.fn(async () => 'saved' as const);
    render(<PlateCard plate={PLATE} busy={false} failed={false} onRemove={() => undefined} onClear={() => undefined} onCommit={() => undefined} onGrams={() => undefined} onTime={() => undefined} onSaveRecipe={onSaveRecipe} defaultTime="12:00" />);
    const save = screen.getByRole('button', { name: 'Enregistrer en recette' });
    expect(save).toBeEnabled();
    const grams = screen.getByRole('textbox', { name: 'Quantité de Skyr (g)' });
    fireEvent.change(grams, { target: { value: '0' } });
    expect(screen.getByRole('button', { name: 'Enregistrer en recette' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer en recette' }));
    expect(onSaveRecipe).not.toHaveBeenCalled();
    fireEvent.change(grams, { target: { value: '120' } });
    expect(screen.getByRole('button', { name: 'Enregistrer en recette' })).toBeEnabled();
  });
});
