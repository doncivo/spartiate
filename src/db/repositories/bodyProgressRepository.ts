import type { MeasurementKind } from '../../domain/bodyProgress';
import type { DeviceId, Hlc, IsoDateTime, LocalDate } from '../../domain/types';

/**
 * Corps (I6-02, § 17.1, § 20.2 ; D-99). Mensurations (`measurement`, migration 0012) et photos de progression (`progress_photo` + `progress_photo_file`).
 * Publiées par les DEUX appareils (aucune règle de lecteur) : la mesure complète, de la photo la FICHE seulement. Aucune règle métier ici : bornes et
 * calcul dans `src/domain/bodyProgress`. Jamais envoyé à un tiers.
 */

export interface MeasurementRecord {
  /** `measurement|AAAA-MM-JJ|genre`. */
  readonly id: string;
  readonly day: LocalDate;
  readonly kind: MeasurementKind;
  /** Centimètres. */
  readonly value: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export interface MeasurementRepository {
  /**
   * Enregistre la mesure du jour (crée la ligne, la modifie, ou rétablit une mesure supprimée). Même valeur : aucune écriture. Date, genre ou valeur hors
   * bornes : `'invalid'`, rien n'est écrit.
   */
  save(day: LocalDate, kind: MeasurementKind, value: number): Promise<MeasurementRecord>;
  /** Supprime la mesure (suppression logique, la synchro la suit) ; sans effet sans ligne vivante. */
  remove(day: LocalDate, kind: MeasurementKind): Promise<void>;
  /** Mesures vivantes d'un genre (ou de tous), de la plus ancienne à la plus récente ; un genre inconnu (appareil plus récent) n'est pas rendu. */
  list(kind?: MeasurementKind): Promise<readonly MeasurementRecord[]>;
}

export interface ProgressPhotoRecord {
  readonly id: string;
  readonly day: LocalDate;
  /** Nom du fichier (`<id>.jpg`) : métadonnée, jamais un chemin. */
  readonly fileName: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly deviceId: DeviceId;
  readonly hlc: Hlc;
}

export interface ProgressPhotoRepository {
  /**
   * Enregistre une photo (JPEG déjà réduit) : fichier dans la table locale, fiche publiée. Date invalide, fichier vide, au-delà de
   * `PHOTO_MAX_BYTES` ou qui n'est pas un JPEG : `'invalid'`, rien n'est écrit.
   */
  add(day: LocalDate, bytes: Uint8Array): Promise<ProgressPhotoRecord>;
  /** Fiches vivantes, la plus récente d'abord (même jour : la dernière ajoutée d'abord). */
  list(): Promise<readonly ProgressPhotoRecord[]>;
  /** Fichier de cette photo, ou `null` s'il n'est pas sur cet appareil (fiche reçue de l'autre appareil). */
  readFile(id: string): Promise<Uint8Array | null>;
  /** Identifiants des fiches dont le fichier est sur cet appareil. */
  localFileIds(): Promise<ReadonlySet<string>>;
  /** Efface les fichiers locaux dont la fiche est SUPPRIMÉE (par l'autre appareil) ; un fichier sans fiche du tout n'est jamais touché (ajout en cours) ; rend leur nombre. */
  purgeOrphanFiles(): Promise<number>;
  /** Supprime le fichier (effacement réel) ET la fiche (suppression logique) ; sans effet sur une fiche inconnue. */
  remove(id: string): Promise<void>;
}
