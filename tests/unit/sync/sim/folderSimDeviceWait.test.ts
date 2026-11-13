import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { awaitDevice } from '../../../sim/syncFolderSim';

/**
 * FIX-0182 : `Y-IOS-02` (e2e iphone) échouait par intermittence sur « simulateur de dossier : /camera → 404 » ou « /scan → 404 ». Le
 * simulateur ne crée un appareil qu'au premier appel `/rpc` de sa page ; le test pilote la caméra ou le scan juste après l'ouverture de la
 * page, parfois avant cet appel ou pendant la création. Les routes de pilotage attendent donc l'appareil (création en cours ou premier appel
 * à venir), dans une limite fixe, au lieu de répondre 404 tout de suite. Horloge simulée (Y-TECH-02 : aucun délai réel dans ces tests).
 */

type Rooms = Parameters<typeof awaitDevice>[0];
type Room = Rooms extends Map<string, infer R> ? R : never;
type Device = NonNullable<Awaited<ReturnType<typeof awaitDevice>>>;

const fakeDevice = (name: string): Device => ({ name }) as unknown as Device;
const emptyRoom = (): Room => ({ devices: new Map(), creating: new Map(), deletedFolders: new Set() }) as unknown as Room;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

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
    let finish: (d: Device) => void = () => undefined;
    room.creating.set('iphone', new Promise<Device>((resolve) => { finish = resolve; }));
    rooms.set('r', room);
    const found = awaitDevice(rooms, 'r', 'iphone', 1_000);
    finish(device);
    await expect(found).resolves.toBe(device);
  });

  it('premier appel de la page pas encore reçu (salle absente) : la route attend son enregistrement', async () => {
    const rooms: Rooms = new Map();
    const device = fakeDevice('iphone');
    const found = awaitDevice(rooms, 'r', 'iphone', 1_000);
    await vi.advanceTimersByTimeAsync(100);
    const room = emptyRoom();
    room.devices.set('iphone', device);
    rooms.set('r', room);
    await vi.advanceTimersByTimeAsync(100);
    await expect(found).resolves.toBe(device);
  });

  it('appareil jamais enregistré : undefined à la limite (la route répond alors 404)', async () => {
    const rooms: Rooms = new Map();
    const found = awaitDevice(rooms, 'r', 'absent', 100);
    await vi.advanceTimersByTimeAsync(200);
    await expect(found).resolves.toBeUndefined();
  });
});
