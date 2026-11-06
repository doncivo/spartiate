import type { EquipmentProfile, EquipmentProfileInput } from '../../domain/training';
import type { ReadOptions } from './common';

/**
 * Profils de matériel (table `equipment_profile`, § 14.3). Les profils sont publiés ; le profil ACTIF est un réglage local de
 * l'appareil (`settings`, clé `training.activeEquipmentProfile`), jamais publié ni capturé.
 */
export interface EquipmentProfileRepository {
  /** Identifiant (UUID) fourni par l'appelant ; collision refusée (`'conflict'`) ; profil invalide `'invalid'`. */
  create(input: EquipmentProfileInput): Promise<EquipmentProfile>;
  update(id: string, patch: Partial<Omit<EquipmentProfileInput, 'id'>>): Promise<EquipmentProfile>;
  softDelete(id: string): Promise<void>;
  get(id: string, options?: ReadOptions): Promise<EquipmentProfile | null>;
  /** Triés par nom. */
  list(options?: ReadOptions): Promise<EquipmentProfile[]>;
  /** Identifiant du profil actif de cet appareil, ou `null`. Peut désigner un profil absent ou supprimé : voir `getActive`. */
  getActiveId(): Promise<string | null>;
  /** Profil actif existant et non supprimé, sinon `null` (jamais d'erreur). */
  getActive(): Promise<EquipmentProfile | null>;
  /** `null` : aucun profil actif. Un identifiant sans profil vivant : `'not-found'`. */
  setActive(id: string | null): Promise<void>;
}
