import type { MesocycleSpec } from '../../domain/training/mesocycle';
import type { DeviceId, Hlc, IsoDateTime } from '../../domain/types';

/**
 * Cycles d'entraînement (table `mesocycle`, migration 0007 ; I3-02, § 12.2, § 12.6). Publiés (catalogue de synchro, UUID).
 *
 * - Un seul cycle suivi : `current` rend le cycle actif non supprimé le plus récent (début, puis création, puis identifiant décroissants) ;
 *   deux cycles actifs (créés hors ligne sur deux appareils) restent deux lignes, `activeCount` le dit à l'écran.
 * - Les valeurs écrites sont validées par le domaine (`validateMesocycleSpec`) : refus `'invalid'`, rien n'est écrit. Une ligne reçue
 *   illisible (pauses non JSON, autre version) est relue telle quelle, avec des pauses vides et `readable: false` : le domaine la déclare
 *   invalide, l'écran le dit (jamais suivie en silence).
 * - `start` clôt les autres cycles actifs (issue `stopped`, fin = début du nouveau) : plusieurs écritures, à appeler dans
 *   `DataAccess.transaction`.
 */

export interface MesocycleRecord extends MesocycleSpec {
  readonly id: string;
  /** Faux : ligne illisible (pauses non JSON) ; le domaine la déclare invalide. */
  readonly readable: boolean;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export interface MesocycleRepository {
  current(): Promise<MesocycleRecord | null>;
  activeCount(): Promise<number>;
  get(id: string): Promise<MesocycleRecord | null>;
  /** Cycles non supprimés, du plus récent au plus ancien. */
  list(): Promise<readonly MesocycleRecord[]>;
  /** Cycle actif ; identifiant (UUID) fabriqué si omis ; les autres actifs sont clos (`stopped`). */
  start(spec: MesocycleSpec, options?: { readonly id?: string }): Promise<MesocycleRecord>;
  /** Nouvelles valeurs d'un cycle (pause, reprise, deload anticipé, clôture). Absent ou supprimé : `'not-found'`. */
  save(id: string, spec: MesocycleSpec): Promise<MesocycleRecord>;
}
