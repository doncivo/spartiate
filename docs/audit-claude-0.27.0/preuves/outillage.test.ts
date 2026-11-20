import { describe, expect, it } from 'vitest';
import { epley } from '../../../src/domain/training/estimate1rm';

describe('outillage de preuve', () => {
  it('importe le moteur du tag', () => {
    expect(typeof epley).toBe('function');
  });
});
