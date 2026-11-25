import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SHELL-0294b (§ 13.3 b) : quand une action de notification change le repos (« +30 s » ou « Passer »), l'écran de séance ouvert relit
 * l'échéance persistée tout de suite (sinon il ne la relirait qu'au retour suivant au premier plan).
 *
 * Bundle de départ (D-604) : le signal passe par un événement du document (`ct-rest-changed`), pas par un module partagé entre le bloc des
 * notifications et celui de l'Entraînement (un module partagé devient un bloc de plus, nommé dans les listes de préchargement du départ).
 */
const root = join(__dirname, '..', '..', '..', '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

describe('signal « repos changé »', () => {
  it('aucun module partagé : restSignal.ts n’existe plus', () => {
    expect(existsSync(join(root, 'src/features/training/session/restSignal.ts'))).toBe(false);
  });

  it('la séance active écoute « ct-rest-changed » sur le document et relit le repos (resume), puis se désabonne', () => {
    const source = read('src/features/training/session/ActiveSession.tsx');
    expect(source).toMatch(/const REST_CHANGED_EVENT = 'ct-rest-changed';/);
    expect(source).toMatch(/document\.addEventListener\(REST_CHANGED_EVENT, onRestChanged\)/);
    expect(source).toMatch(/document\.removeEventListener\(REST_CHANGED_EVENT, onRestChanged\)/);
  });

  it('le répartiteur des actions émet le même événement après une action de repos appliquée', () => {
    const wake = read('src/features/notifications/supplementWake.ts');
    expect(wake).toMatch(/const REST_CHANGED_EVENT = 'ct-rest-changed';/);
    expect(wake).toMatch(/onChanged: \(\) => void document\.dispatchEvent\(new Event\(REST_CHANGED_EVENT\)\)/);
  });
});
