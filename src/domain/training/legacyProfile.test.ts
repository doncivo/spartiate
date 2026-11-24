import { describe, expect, it } from 'vitest';
import { CURRENT_DEFAULT_PROFILE_ID, LEGACY_DEFAULT_PROFILE_ID, canonicalEquipmentProfileId } from './legacyProfile';

/** DATA-0292 (BL-138, D-489) : l'ancien identifiant du profil par défaut est reconnu (jamais écrit en clair) et rattaché au nouveau. */
describe('identifiant du profil de matériel par défaut (D-489)', () => {
  it('le nouvel identifiant est « salle-complete »', () => {
    expect(CURRENT_DEFAULT_PROFILE_ID).toBe('salle-complete');
  });

  it('l’ancien identifiant est reconstruit (préfixe de marque + lieu) et ne vaut pas le nouveau', () => {
    expect(LEGACY_DEFAULT_PROFILE_ID.startsWith('fitness-park-')).toBe(true);
    expect(LEGACY_DEFAULT_PROFILE_ID).not.toBe(CURRENT_DEFAULT_PROFILE_ID);
  });

  it('canonicalEquipmentProfileId : l’ancien est rattaché au nouveau, tout le reste est rendu tel quel', () => {
    expect(canonicalEquipmentProfileId(LEGACY_DEFAULT_PROFILE_ID)).toBe('salle-complete');
    expect(canonicalEquipmentProfileId('salle-complete')).toBe('salle-complete');
    expect(canonicalEquipmentProfileId('salle-commerciale')).toBe('salle-commerciale');
    const uuid = '0f8fad5b-d9cb-469f-a165-70867728950e';
    expect(canonicalEquipmentProfileId(uuid)).toBe(uuid);
    expect(canonicalEquipmentProfileId('')).toBe('');
    expect(canonicalEquipmentProfileId(null)).toBeNull();
  });
});
