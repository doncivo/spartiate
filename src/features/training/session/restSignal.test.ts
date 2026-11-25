import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { announceRestChanged, onRestChanged } from './restSignal';

/**
 * SHELL-0294b (§ 13.3 b) : quand une action de notification change le repos (« +30 s » ou « Passer »), l'écran de séance ouvert relit
 * l'échéance persistée tout de suite (sinon il ne la relirait qu'au retour suivant au premier plan).
 */
describe('signal « repos changé »', () => {
  it('prévient chaque abonné, jusqu’au désabonnement', () => {
    const seen: string[] = [];
    const offA = onRestChanged(() => seen.push('a'));
    const offB = onRestChanged(() => seen.push('b'));
    announceRestChanged();
    offA();
    announceRestChanged();
    offB();
    announceRestChanged();
    expect(seen).toEqual(['a', 'b', 'b']);
  });

  it('un abonné qui lève n’empêche pas les autres', () => {
    const seen: string[] = [];
    const offA = onRestChanged(() => {
      throw new Error('boom');
    });
    const offB = onRestChanged(() => seen.push('b'));
    expect(() => announceRestChanged()).not.toThrow();
    expect(seen).toEqual(['b']);
    offA();
    offB();
  });

  it('la séance active s’abonne et relit le repos (resume) à chaque signal', () => {
    const source = readFileSync(join(__dirname, 'ActiveSession.tsx'), 'utf8');
    expect(source).toMatch(/import \{ onRestChanged \} from '\.\/restSignal';/);
    expect(source).toMatch(/onRestChanged\(\(\) => void resume\(\)\)/);
  });
});
