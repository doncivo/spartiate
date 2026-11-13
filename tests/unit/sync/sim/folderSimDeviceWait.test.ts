import { describe, expect, it } from 'vitest';
import { awaitDevice } from '../../../sim/syncFolderSim';

/**
 * FIX-0182 : `Y-IOS-02` (e2e iphone) échouait par intermittence sur « simulateur de dossier : /camera → 404 » ou « /scan → 404 ». Le
 * simulateur ne crée un appareil qu'au premier appel `/rpc` de sa page ; le test pilote la caméra ou le scan juste après l'ouverture de la
 * page, parfois avant cet appel ou pendant la création. Les routes de pilotage attendent donc l'appareil (création en cours ou premier appel
 * à venir), dans une limite fixe, au lieu de répondre 404 tout de suite.
 */

type Rooms = Parameters<typeof awaitDevice>[0];
type Device = NonNullable<Awaited<ReturnType<typeof awaitDevice>>>;

const fakeDevice = (name: string): Device => ({ name }) as unknown as Device;

function emptyRoom(): Rooms extends Map<string, infer R> ? R : never {
  return { devices: new Map(), creating: new Map(), deletedFolders: new Set() } as never;
}

describe('simulateur de dossier : pilotage d’un appareil pas encore enregistré (FIX-0182)', () => {
  it('appareil déjà connu : rendu tout de suite', async () => {
    const rooms: Rooms = new Map();
    const room = emptyRoom();
    room.devices.set('iphone', fakeDevice('iphone'));
    rooms.set('r', room);
    await expect(awaitDevice(rooms, 'r', 'iphone', 1_000)).resolves.toBe(room.devices.get('iphone'));
  });

  it('création en cours : la route attend la fin de la création', async () => {
    const rooms: Rooms = new Map();
    const room = emptyRoom();
    const device = fakeDevice('iphone');
    room.creating.set('iphone', new Promise((resolve) => setTimeout(() => resolve(device), 50)));
    rooms.set('r', room);
    await expect(awaitDevice(rooms, 'r', 'iphone', 1_000)).resolves.toBe(device);
  });

  it('premier appel de la page pas encore reçu (salle absente) : la route attend son enregistrement', async () => {
    const rooms: Rooms = new Map();
    const device = fakeDevice('iphone');
    setTimeout(() => {
      const room = emptyRoom();
      room.devices.set('iphone', device);
      rooms.set('r', room);
    }, 50);
    await expect(awaitDevice(rooms, 'r', 'iphone', 1_000)).resolves.toBe(device);
  });

  it('appareil jamais enregistré : undefined à la limite (la route répond alors 404)', async () => {
    const rooms: Rooms = new Map();
    await expect(awaitDevice(rooms, 'r', 'absent', 100)).resolves.toBeUndefined();
  });
});
