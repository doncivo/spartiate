import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  HEALTH_METRIC_KINDS,
  MEASUREMENT_BOUNDS_CM,
  MEASUREMENT_KINDS,
  hidePhotoId,
  measurementChange,
  parseHiddenPhotoIds,
  photoActions,
  showAllPhotos,
  validateMeasurement,
  type HealthMetricKind,
  type MeasurementIssue,
  type MeasurementKind,
  type PhotoActions,
} from '../../domain/bodyProgress';
import { todayLocal } from '../../domain/clock';
import type { LocalDate } from '../../domain/types';
import type { MeasurementRecord, ProgressPhotoRecord } from '../../db/repositories';
import { formatDayMonthYear } from '../../i18n/format';
import { formatCm, tBodyProgress, type BodyProgressTextKey } from '../../i18n/bodyProgressText';
import { logFailure } from '../../platform/desktop/log';
import { pickPhotoJpeg } from '../../platform/photoImage/picker';
import { shieldOwner } from '../../platform/privacyShield';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useSyncedData } from '../sync/remoteChanges';
import './BodyProgress.css';

/**
 * Progrès › Corps (I6-02, § 17.1, § 18 ; D-99) : mensurations en centimètres (saisie bornée, écart entre les deux dernières mesures) et photos de
 * progression. Les photos restent sur l'appareil (table locale, jamais publiée ni exportée) : seule la fiche (date) passe d'un appareil à l'autre, et un
 * appareil qui n'a pas le fichier le dit. Lecture et écriture par les dépôts ; règles dans `src/domain/bodyProgress`. Bloc chargé à la demande avec
 * son catalogue de textes. Aucune couleur seule : l'état est dit en texte ; cibles de 44 pt ; saisie au clavier (formulaire, Entrée).
 */

const KIND_TEXT = {
  neck: 'kind_neck',
  shoulders: 'kind_shoulders',
  chest: 'kind_chest',
  waist: 'kind_waist',
  hips: 'kind_hips',
  arm_left: 'kind_arm_left',
  arm_right: 'kind_arm_right',
  thigh_left: 'kind_thigh_left',
  thigh_right: 'kind_thigh_right',
  calf_left: 'kind_calf_left',
  calf_right: 'kind_calf_right',
} as const satisfies Record<MeasurementKind, BodyProgressTextKey>;

const ISSUE_TEXT: Record<Exclude<MeasurementIssue, 'range'>, BodyProgressTextKey> = {
  empty: 'errorEmpty',
  format: 'errorFormat',
  date: 'errorDate',
  future: 'errorFuture',
};

/** Genres importés de Santé : texte du nom et de l'unité (dans le nom du genre : `_pct`, `_kg`, `_cm`, `_g`). */
const HEALTH_UNIT = { health_body_fat_pct: 'healthUnit_pct', health_lean_mass_kg: 'healthUnit_kg', health_waist_cm: 'healthUnit_cm', health_height_cm: 'healthUnit_cm', health_fiber_g: 'healthUnit_g' } as const satisfies Record<HealthMetricKind, BodyProgressTextKey>;

/** Au plus deux photos côte à côte. */
const COMPARE_MAX = 2;

type Load =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | {
      readonly status: 'ready';
      readonly measures: readonly MeasurementRecord[];
      readonly health: readonly MeasurementRecord[];
      readonly photos: readonly ProgressPhotoRecord[];
      /** Fiches supprimées ailleurs dont le fichier est encore ici (D-121). */
      readonly deletedElsewhere: readonly ProgressPhotoRecord[];
      /** Fiches masquées sur cet appareil (réglage local). */
      readonly hidden: readonly string[];
      readonly local: ReadonlySet<string>;
    };

export function BodyProgress({ pickPhoto = pickPhotoJpeg }: { readonly pickPhoto?: () => Promise<Uint8Array | null> }) {
  const container = useAppContainer();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const synced = useSyncedData(['measurement', 'progress_photo']);
  const today = todayLocal(container.clock);

  const [kind, setKind] = useState<MeasurementKind>('waist');
  const [text, setText] = useState('');
  const [date, setDate] = useState<LocalDate>(today);
  const [measureMessage, setMeasureMessage] = useState<{ readonly alert: boolean; readonly text: string } | null>(null);
  const [photoMessage, setPhotoMessage] = useState<{ readonly alert: boolean; readonly text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [compare, setCompare] = useState<readonly string[]>([]);
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((n) => n + 1), []);

  // FIX-0171 (constat 5, D-121) : les vues photo (liste, comparaison) ont leur propre demande de bouclier, indépendante du verrouillage : activée à
  // l'entrée, retirée à la sortie ; un échec du plugin est dit à l'écran (et au journal technique, sans aucune donnée).
  const [shieldFailed, setShieldFailed] = useState(false);
  useEffect(() => {
    const shield = shieldOwner(container.privacyShield, 'photos');
    let live = true;
    void shield.setEnabled(true).then((result) => {
      if (!result.ok) logFailure('security', `photo-shield-failed:${result.code}`);
      if (live) setShieldFailed(!result.ok);
    });
    return () => {
      live = false;
      void shield.setEnabled(false).then((result) => {
        if (!result.ok) logFailure('security', `photo-shield-release-failed:${result.code}`);
      });
    };
  }, [container]);

  useEffect(() => {
    let live = true;
    (async () => {
      const { repos } = container.data;
      const photoRepo = await repos.progressPhotos();
      const measureRepo = await repos.measurements();
      const measures = await measureRepo.list();
      // Dernière valeur de chaque genre importé de Santé (I6-04), en lecture seule.
      const health = (await Promise.all(HEALTH_METRIC_KINDS.map((k) => measureRepo.list(k)))).flatMap((rows) => rows.slice(-1));
      const photos = await photoRepo.list();
      // D-121 : une suppression reçue n'efface jamais le fichier local ; la fiche reste affichée « supprimée ailleurs » jusqu'à la suppression ici.
      const deletedElsewhere = await photoRepo.listDeletedWithFile();
      const hidden = parseHiddenPhotoIds(await repos.settings.get('bodyProgress.hiddenPhotos'));
      return { status: 'ready', measures, health, photos, deletedElsewhere, hidden, local: await photoRepo.localFileIds() } as const;
    })().then(
      (result) => {
        if (live) setLoad(result);
      },
      () => {
        if (live) setLoad({ status: 'failed' });
      },
    );
    return () => {
      live = false;
    };
  }, [container, synced, attempt, reload]);

  const saveMeasure = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const result = validateMeasurement(kind, text, date, today);
    if (!result.ok) {
      const { min, max } = MEASUREMENT_BOUNDS_CM[kind];
      setMeasureMessage({ alert: true, text: result.reason === 'range' ? tBodyProgress('errorRange', { min, max }) : tBodyProgress(ISSUE_TEXT[result.reason]) });
      return;
    }
    try {
      await (await container.data.repos.measurements()).save(date, kind, result.value);
      setText('');
      setMeasureMessage({ alert: false, text: tBodyProgress('saved') });
      refresh();
    } catch {
      setMeasureMessage({ alert: true, text: tBodyProgress('saveFailed') });
    }
  };

  const removeMeasure = async (record: MeasurementRecord): Promise<void> => {
    try {
      await (await container.data.repos.measurements()).remove(record.day, record.kind);
      setMeasureMessage(null);
    } catch {
      setMeasureMessage({ alert: true, text: tBodyProgress('saveFailed') });
    }
    refresh();
  };

  const addPhoto = async (): Promise<void> => {
    setPhotoMessage(null);
    setAdding(true);
    try {
      const bytes = await pickPhoto();
      if (bytes === null) return;
      await (await container.data.repos.progressPhotos()).add(todayLocal(container.clock), bytes);
      setPhotoMessage({ alert: false, text: tBodyProgress('photoAdded') });
      refresh();
    } catch {
      setPhotoMessage({ alert: true, text: tBodyProgress('photoFailed') });
    } finally {
      setAdding(false);
    }
  };

  const removePhoto = async (id: string): Promise<void> => {
    setConfirming(null);
    try {
      // Fichier, fiche et capture de synchro dans une seule transaction (constat 3) : un échec laisse la photo intacte.
      await (await container.data.repos.progressPhotos()).remove(id);
      setCompare((ids) => ids.filter((x) => x !== id));
      setPhotoMessage({ alert: false, text: tBodyProgress('photoDeleted') });
    } catch {
      setPhotoMessage({ alert: true, text: tBodyProgress('photoDeleteFailed') });
    }
    refresh();
  };

  /** D-121 : masquer une fiche sans fichier sur cet appareil (réglage local, jamais publié) ; la fiche reste sur les autres appareils. */
  const setHidden = async (next: readonly string[], done: BodyProgressTextKey | null): Promise<void> => {
    try {
      await container.data.repos.settings.set('bodyProgress.hiddenPhotos', next);
      setCompare((ids) => ids.filter((x) => !next.includes(x)));
      setPhotoMessage(done === null ? null : { alert: false, text: tBodyProgress(done) });
    } catch {
      setPhotoMessage({ alert: true, text: tBodyProgress('saveFailed') });
    }
    refresh();
  };

  if (load.status === 'loading') {
    return (
      <p role="status" className="ct-today__muted">
        {tBodyProgress('loading')}
      </p>
    );
  }
  if (load.status === 'failed') {
    return (
      <section className="ct-today__card ct-bodyprogress ct-flat" role="alert">
        <p className="ct-today__text">{tBodyProgress('loadFailed')}</p>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            setLoad({ status: 'loading' });
            setAttempt((n) => n + 1);
          }}
        >
          {tBodyProgress('retry')}
        </Button>
      </section>
    );
  }

  const { measures, health, local, hidden } = load;
  const hiddenHere = load.photos.filter((p) => hidden.includes(p.id) && !local.has(p.id)).length;
  const elsewhere = new Set(load.deletedElsewhere.map((p) => p.id));
  const photos = [...load.photos.filter((p) => local.has(p.id) || !hidden.includes(p.id)), ...load.deletedElsewhere].sort((a, b) =>
    a.day !== b.day ? (a.day < b.day ? 1 : -1) : a.createdAt !== b.createdAt ? (a.createdAt < b.createdAt ? 1 : -1) : a.id < b.id ? 1 : -1,
  );
  const ofKind = measures.filter((m) => m.kind === kind);
  const change = measurementChange(ofKind.map((m) => ({ date: m.day, value: m.value })));
  const compared = compare.map((id) => photos.find((p) => p.id === id)).filter((p): p is ProgressPhotoRecord => p !== undefined);
  const sign = (delta: number): string => (delta > 0 ? tBodyProgress('signPlus') : delta < 0 ? tBodyProgress('signMinus') : '');

  return (
    <div className="ct-bodyprogress">
      <h2 className="ct-today__eyebrow ct-bodyprogress__title ct-section-title">{tBodyProgress('title')}</h2>

      <section className="ct-today__card ct-bodyprogress__card ct-flat" aria-labelledby="ct-bodyprogress-measures">
        <h3 id="ct-bodyprogress-measures" className="ct-bodyprogress__heading ct-section-title">
          {tBodyProgress('measuresTitle')}
        </h3>
        <p className="ct-today__muted">{tBodyProgress('measuresHint')}</p>
        <form className="ct-bodyprogress__form" onSubmit={(event) => void saveMeasure(event)} noValidate>
          <label className="ct-bodyprogress__field">
            <span className="ct-bodyprogress__label">{tBodyProgress('kindLabel')}</span>
            <select className="ct-bodyprogress__input" value={kind} onChange={(e) => setKind(e.target.value as MeasurementKind)}>
              {MEASUREMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {tBodyProgress(KIND_TEXT[k])}
                </option>
              ))}
            </select>
          </label>
          <label className="ct-bodyprogress__field">
            <span className="ct-bodyprogress__label">{tBodyProgress('valueLabel')}</span>
            <input className="ct-bodyprogress__input" inputMode="decimal" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <label className="ct-bodyprogress__field">
            <span className="ct-bodyprogress__label">{tBodyProgress('dateLabel')}</span>
            <input className="ct-bodyprogress__input" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value as LocalDate)} />
          </label>
          <Button type="submit" className="ct-bodyprogress__save">
            {tBodyProgress('save')}
          </Button>
        </form>
        {measureMessage && (
          <p className="ct-bodyprogress__message" role={measureMessage.alert ? 'alert' : 'status'}>
            {measureMessage.text}
          </p>
        )}
        {ofKind.length === 0 ? (
          <p className="ct-today__muted">{tBodyProgress('measuresEmpty')}</p>
        ) : (
          <>
            <p className="ct-today__text">
              {change === null
                ? tBodyProgress('changeNone')
                : change.delta === 0
                  ? tBodyProgress('changeSame', { date: formatDayMonthYear(change.from) })
                  : tBodyProgress('changeLine', { date: formatDayMonthYear(change.from), delta: `${sign(change.delta)}${formatCm(Math.abs(change.delta))}` })}
            </p>
            <ul className="ct-bodyprogress__list">
              {[...ofKind].reverse().map((m) => (
                <li key={m.id} className="ct-bodyprogress__item">
                  <span>{formatDayMonthYear(m.day)}</span>
                  <span className="ct-bodyprogress__value">{tBodyProgress('measureLine', { value: formatCm(m.value) })}</span>
                  <button type="button" className="ct-bodyprogress__delete" aria-label={tBodyProgress('measureDelete', { date: formatDayMonthYear(m.day) })} onClick={() => void removeMeasure(m)}>
                    {tBodyProgress('deleteGlyph')}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {health.length > 0 && (
        <section className="ct-today__card ct-bodyprogress__card ct-flat" aria-labelledby="ct-bodyprogress-health">
          <h3 id="ct-bodyprogress-health" className="ct-bodyprogress__heading ct-section-title">
            {tBodyProgress('healthTitle')}
          </h3>
          <p className="ct-today__muted">{tBodyProgress('healthHint')}</p>
          <ul className="ct-bodyprogress__list">
            {health.map((m) => (
              <li key={m.id} className="ct-bodyprogress__item">
                {tBodyProgress('healthLine', { label: tBodyProgress(`health_${m.kind}` as BodyProgressTextKey), value: formatCm(m.value), unit: tBodyProgress(HEALTH_UNIT[m.kind as HealthMetricKind]), date: formatDayMonthYear(m.day) })}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="ct-today__card ct-bodyprogress__card ct-flat" aria-labelledby="ct-bodyprogress-photos">
        <h3 id="ct-bodyprogress-photos" className="ct-bodyprogress__heading ct-section-title">
          {tBodyProgress('photosTitle')}
        </h3>
        <p className="ct-today__muted">{tBodyProgress('photosPrivacy')}</p>
        {shieldFailed && (
          <p className="ct-bodyprogress__message" role="alert">
            {tBodyProgress('shieldFailed')}
          </p>
        )}
        <Button variant="secondary" fullWidth disabled={adding} onClick={() => void addPhoto()}>
          {adding ? tBodyProgress('photoAdding') : tBodyProgress('photoAdd')}
        </Button>
        {photoMessage && (
          <p className="ct-bodyprogress__message" role={photoMessage.alert ? 'alert' : 'status'}>
            {photoMessage.text}
          </p>
        )}
        {photos.length === 0 ? (
          <p className="ct-today__muted">{tBodyProgress('photosEmpty')}</p>
        ) : (
          <>
            <p className="ct-today__muted">{compared.length === COMPARE_MAX ? tBodyProgress('compareMax') : tBodyProgress('comparePick')}</p>
            <ul className="ct-bodyprogress__photos">
              {photos.map((p) => (
                <PhotoItem
                  key={p.id}
                  photo={p}
                  actions={photoActions({ hasFile: local.has(p.id), deletedElsewhere: elsewhere.has(p.id) })}
                  checked={compare.includes(p.id)}
                  disabled={!compare.includes(p.id) && compare.length >= COMPARE_MAX}
                  confirming={confirming === p.id}
                  onToggle={() => setCompare((ids) => (ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id]))}
                  onAskDelete={() => setConfirming(p.id)}
                  onCancelDelete={() => setConfirming(null)}
                  onDelete={() => void removePhoto(p.id)}
                  onHide={() => void setHidden(hidePhotoId(hidden, p.id), 'photoHidden')}
                />
              ))}
            </ul>
          </>
        )}
        {hiddenHere > 0 && (
          <Button variant="secondary" fullWidth onClick={() => void setHidden(showAllPhotos(), null)}>
            {tBodyProgress('photosShowHidden', { count: hiddenHere })}
          </Button>
        )}
        {compared.length === COMPARE_MAX && (
          <section className="ct-bodyprogress__compare" aria-labelledby="ct-bodyprogress-compare">
            <h4 id="ct-bodyprogress-compare" className="ct-bodyprogress__heading ct-section-title">
              {tBodyProgress('compareTitle')}
            </h4>
            <div className="ct-bodyprogress__pair">
              {[...compared]
                .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
                .map((p) => (
                  <figure key={p.id} className="ct-bodyprogress__figure">
                    {local.has(p.id) ? <PhotoImage id={p.id} alt={tBodyProgress('photoAlt', { date: formatDayMonthYear(p.day) })} /> : <p className="ct-today__muted">{tBodyProgress('compareMissing')}</p>}
                    <figcaption>{formatDayMonthYear(p.day)}</figcaption>
                  </figure>
                ))}
            </div>
            <Button variant="secondary" onClick={() => setCompare([])}>
              {tBodyProgress('compareClose')}
            </Button>
          </section>
        )}
      </section>
    </div>
  );
}

function PhotoItem({
  photo,
  actions,
  checked,
  disabled,
  confirming,
  onToggle,
  onAskDelete,
  onCancelDelete,
  onDelete,
  onHide,
}: {
  readonly photo: ProgressPhotoRecord;
  readonly actions: PhotoActions;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly confirming: boolean;
  readonly onToggle: () => void;
  readonly onAskDelete: () => void;
  readonly onCancelDelete: () => void;
  readonly onDelete: () => void;
  readonly onHide: () => void;
}) {
  const date = formatDayMonthYear(photo.day);
  return (
    <li className="ct-bodyprogress__photo">
      {actions.canDelete ? <PhotoImage id={photo.id} alt={tBodyProgress('photoAlt', { date })} /> : <p className="ct-today__muted">{tBodyProgress('photoElsewhere')}</p>}
      <p className="ct-today__text">{date}</p>
      {actions.deletedElsewhere && <p className="ct-today__muted">{tBodyProgress('photoDeletedElsewhere')}</p>}
      <label className="ct-bodyprogress__check">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} aria-label={tBodyProgress('photoCompareLabel', { date })} />
        <span>{tBodyProgress('photoCompare')}</span>
      </label>
      {actions.canHide && (
        <>
          <p className="ct-today__muted">{tBodyProgress('photoHideHint')}</p>
          <Button variant="secondary" onClick={onHide}>
            {tBodyProgress('photoHide', { date })}
          </Button>
        </>
      )}
      {actions.canDelete &&
        (confirming ? (
          <div className="ct-bodyprogress__confirm">
            <p className="ct-today__text">{tBodyProgress(actions.deletedElsewhere ? 'photoDeleteLocalCost' : 'photoDeleteCost')}</p>
            <Button onClick={onDelete}>{tBodyProgress('photoDeleteConfirm', { date })}</Button>
            <Button variant="secondary" onClick={onCancelDelete}>
              {tBodyProgress('photoDeleteCancel')}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={onAskDelete}>
            {tBodyProgress('photoDelete', { date })}
          </Button>
        ))}
    </li>
  );
}

/** Image d'une photo locale : lue à la demande dans la table locale, affichée en `data:` (aucune requête, aucun fichier exposé). */
function PhotoImage({ id, alt }: { readonly id: string; readonly alt: string }) {
  const container = useAppContainer();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      const bytes = await (await container.data.repos.progressPhotos()).loadFile(id);
      if (!live || bytes === null) return;
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      setSrc(`data:image/jpeg;base64,${btoa(binary)}`);
    })().catch(() => {
      if (live) setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [container, id]);
  if (failed) return <p role="status" className="ct-today__muted">{tBodyProgress('photoImageFailed')}</p>;
  return src === null ? <div className="ct-bodyprogress__img ct-bodyprogress__img--wait" aria-hidden="true" /> : <img className="ct-bodyprogress__img" src={src} alt={alt} />;
}
