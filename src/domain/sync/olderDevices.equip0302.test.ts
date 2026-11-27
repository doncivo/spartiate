import { describe, expect, it } from 'vitest';
import { olderActiveDevices } from './compat';

/**
 * EQUIP-0302, relecture sync-icloud (D-796) : appareils actifs, autres que soi, qui publient une version de schéma inférieure (ou inconnue, ou une
 * majeure inférieure) : tant qu'il en existe un, l'écrivain à jour n'enregistre aucune liste qu'il lirait autrement.
 */
const d = (over: Partial<{ self: boolean; status: string; sv: number | null; sm: number | null }>) => ({ self: false, status: 'active', sv: 25, sm: 1, ...over });

describe('olderActiveDevices', () => {
  it('sv inférieur, inconnu ou majeure inférieure : plus ancien ; soi, inactif, même version ou plus récent : non', () => {
    const older = [d({ sv: 24 }), d({ sv: null }), d({ sm: 0 }), d({ status: 'clock-ahead', sv: 20 })];
    const other = [d({ self: true, sv: 3 }), d({ status: 'forgotten', sv: 24 }), d({ status: 'expired', sv: 24 }), d({ status: 'foreign', sv: 24 }), d({ status: 'corrupt', sv: 24 }), d({ status: 'rollback', sv: 24 }), d({}), d({ sv: 26 })];
    expect(olderActiveDevices([...older, ...other], 25)).toEqual(older);
  });
});
