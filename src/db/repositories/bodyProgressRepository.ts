import type { StoredMeasurementKind } from '../../domain/bodyProgress';
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
  /** Une zone saisie, ou un genre importé de Santé (`health_*`, I6-04). */
  readonly kind: StoredMeasurementKind;
  /** Centimètres (zones) ; l'unité d'un genre importé est dans son nom. */
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
  save(day: LocalDate, kind: StoredMeasurementKind, value: number): Promise<MeasurementRecord>;
  /** Supprime la mesure (suppression logique, la synchro la suit) ; sans effet sans ligne vivante. */
  remove(day: LocalDate, kind: StoredMeasurementKind): Promise<void>;
  /** La mesure d'un jour et d'un genre, SUPPRIMÉE comprise (l'import respecte une suppression) ; `null` sans ligne. */
  find(day: LocalDate, kind: StoredMeasurementKind): Promise<MeasurementRecord | null>;
  /**
   * Mesures vivantes d'un genre, de la plus ancienne à la plus récente ; sans genre : les ZONES saisies seulement (les genres importés de Santé se lisent
   * par leur genre) ; un genre inconnu (appareil plus récent) n'est pas rendu.
   */
  list(kind?: StoredMeasurementKind): Promise<readonly MeasurementRecord[]>;
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
   * Enregistre une photo (JPEG déjà réduit) : fichier dans la table locale, fiche publiée, dans une seule transaction. Date invalide, fichier vide, au-delà de
   * `PHOTO_MAX_BYTES` ou qui n'est pas un JPEG : `'invalid'`, rien n'est écrit.
   */
  add(day: LocalDate, bytes: Uint8Array): Promise<ProgressPhotoRecord>;
  /** Fiches vivantes, la plus récente d'abord (même jour : la dernière ajoutée d'abord). */
  list(): Promise<readonly ProgressPhotoRecord[]>;
  /** Fichier de cette photo, ou `null` s'il n'est pas sur cet appareil (fiche reçue de l'autre appareil). */
  loadFile(id: string): Promise<Uint8Array | null>;
  /** Identifiants des fiches dont le fichier est sur cet appareil. */
  localFileIds(): Promise<ReadonlySet<string>>;
  /**
   * FIX-0171 (D-121) : fiches SUPPRIMÉES ailleurs (synchro, import) dont le fichier est encore sur cet appareil ; une suppression reçue n'efface jamais
   * le fichier, il reste jusqu'à une suppression locale confirmée (`remove`).
   */
  listDeletedWithFile(): Promise<readonly ProgressPhotoRecord[]>;
  /**
   * Supprime le fichier (effacement réel) ET la fiche (suppression logique), dans une seule transaction (FIX-0171, constat 3) ; fiche déjà supprimée
   * ailleurs : le fichier seul. Sans le fichier sur cet appareil : `'not-found'`, rien n'est écrit (D-121 : seul l'appareil qui le détient supprime) ;
   * fiche inconnue : sans effet.
   */
  remove(id: string): Promise<void>;
}
