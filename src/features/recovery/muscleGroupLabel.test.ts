import { describe, expect, it } from 'vitest';
import { muscleGroupLabel } from './muscleGroupLabel';

describe('muscleGroupLabel (BL-142)', () => {
  it('identifiant neutre : libellé français', () => {
    expect(muscleGroupLabel('legs')).toBe('Jambes');
    expect(muscleGroupLabel('shoulders')).toBe('Épaules');
  });
  it('ligne ancienne portant déjà le libellé : rendue telle quelle', () => {
    expect(muscleGroupLabel('Jambes')).toBe('Jambes');
  });
});
