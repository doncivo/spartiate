import type { CardioKind, CardioSessionInput, CardioSource, TrackPoint } from '../../domain/cardio';
import type { RecoveryCardio } from '../../domain/recovery';

/**
 * Séances cardio (table `cardio_session`, PUBLIÉE, écrite par les deux appareils) et tracés GPS (table `cardio_track`, LOCALE : jamais publiée, jamais
 * exportée, effacée avec sa séance ; migration 0017, I6-06, D-221 et D-222). Validation par le domaine (`validateCardioSession`) avant toute écriture ;
 * aucune règle métier ici. Fusion champ par champ par HLC : dernière écriture gagne.
 */
export interface CardioSessionRecord {
  readonly id: string;
  /** Type lu par le domaine : un type inconnu (version plus récente) se lit `other`. */
  readonly kind: CardioKind;
  readonly startedAt: string;
  readonly durationSec: number;
  readonly distanceM: number | null;
  readonly avgHr: number | null;
  readonly rpe: number;
  readonly notes: string;
  readonly source: CardioSource;
  /** Vrai si le tracé GPS est sur CET appareil. */
  readonly hasTrack: boolean;
}

export interface CardioRepository {
  /** Séances vivantes, la plus récente d'abord (début), au plus `limit` (200 par défaut). */
  list(limit?: number): Promise<readonly CardioSessionRecord[]>;
  /** Séance vivante, ou null. */
  get(id: string): Promise<CardioSessionRecord | null>;
  /** Séances vivantes commencées depuis cet instant (moteur de récupération, D-220). */
  listSince(sinceIso: string): Promise<readonly RecoveryCardio[]>;
  /** Enregistre une séance (et son tracé, gardé sur l'appareil) ; rend son identifiant. Invalide : `'invalid'`. */
  add(input: CardioSessionInput, track?: readonly TrackPoint[] | null): Promise<string>;
  /** Remplace les champs d'une séance vivante (seuls les champs changés sont publiés). Invalide : `'invalid'` ; absente : `'not-found'`. */
  update(id: string, input: CardioSessionInput): Promise<void>;
  /** Suppression logique publiée ; le tracé local est effacé. Sans effet si absente ou déjà supprimée. */
  remove(id: string): Promise<void>;
  /** Tracé local de la séance, ou null (aucun tracé sur cet appareil, ou illisible). */
  track(id: string): Promise<TrackPoint[] | null>;
}
