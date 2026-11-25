import { describe, expect, it } from 'vitest';
import { openLogJournal } from './index';

/** SHELL-0294e (C-163, D-616) : dans l'app installée, un système resté « other » est noté au journal de session (jamais masqué sans trace). */
describe('openLogJournal : système inconnu (C-163)', () => {
  it('app installée, fenêtre principale, système « other » : l’entrée app / os-unknown est au journal', async () => {
    const journal = openLogJournal('tauri', 'other', 'main');
    const entries = await journal.read();
    expect(entries.map((e) => `${e.scope} ${e.code}`)).toEqual(['app os-unknown']);
  });

  it('Windows, iPhone et navigateur de développement : aucune entrée de ce genre', async () => {
    for (const [runtime, os] of [['tauri', 'windows'], ['tauri', 'ios'], ['web', 'other']] as const) {
      expect(await openLogJournal(runtime, os, 'main').read(), `${runtime} ${os}`).toEqual([]);
    }
  });
});
