import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  HEALTH_METRIC_KINDS,
  MEASUREMENT_BOUNDS_CM,
  MEASUREMENT_KINDS,
  hidePhotoId,
  parseHiddenPhotoIds,
  photoActions,
  showAllPhotos,
  validateMeasurement,
  type HealthMetricKind,
  type MeasurementIssue,
  type MeasurementKind,
  type PhotoActions,
} from '../../domain/bodyProgress';
import type { BodyGoal, Sex } from '../../domain/bodyProfile';
import { BODY_PERIODS, DEFAULT_BODY_PERIOD, inPeriod, periodStart, type BodyPeriod, type BodySample } from '../../domain/bodyProgress/period';
import { bodyRatios } from '../../domain/bodyProgress/ratios';
import { symmetryAll } from '../../domain/bodyProgress/symmetry';
import { weightEvolution } from '../../domain/bodyProgress/weightEvolution';
import { monthlyRate, zoneTrends } from '../../domain/bodyProgress/zoneTrend';
import type { WeighIn } from '../../domain/nutrition/types';
import { todayLocal } from '../../domain/clock';
import type { LocalDate } from '../../domain/types';
import type { MeasurementRecord, ProgressPhotoRecord } from '../../db/repositories';
import { formatDayMonthYear } from '../../i18n/format';
import { formatCm, tBodyProgress, type BodyProgressTextKey, type BodyProgressPlainKey } from '../../i18n/bodyProgressText';
import { logFailure } from '../../platform/desktop/log';
import { PhotoTooLargeError, pickPhotoJpeg } from '../../platform/photoImage/picker';
import { shieldOwner } from '../../platform/privacyShield';
import { Button, ConfirmDialog, SegmentedControl } from '../../ui';
import { MissingValue } from '../../ui/MissingValue';
import { useLayout } from '../../ui/useLayout';
import { useAppContainer } from '../app/AppContainerContext';
import { useSyncedData } from '../sync/remoteChanges';
import { KIND_TEXT, Silhouette, TrendLegend, ZoneChips, ZoneCurve, ZoneList, neighbourZone, signed, trendWords } from './BodyZones';
import { summarizeZone, type ZonePoint, type ZoneSummary } from './bodyZone';
import { GuidedEntry } from './GuidedEntry';
import { RateLine, RatiosCard, SymmetryCard, WeightLine } from './MeasureInsights';
import { VisbodySection } from './VisbodySection';
import { MeasurementRhythmLazy } from '../settings/measurementRhythm/lazy';
import './BodyProgress.css';

/**
 * Progrès › Corps (I6-02, § 17.1, § 18 ; D-99) : mensurations en centimètres (saisie bornée, écart entre les deux dernières mesures) et photos de
 * progression. Les photos restent sur l'appareil (table locale, jamais publiée ni exportée) : seule la fiche (date) passe d'un appareil à l'autre, et un
 * appareil qui n'a pas le fichier le dit. Lecture et écriture par les dépôts ; règles dans `src/domain/bodyProgress`. Bloc chargé à la demande avec
 * son catalogue de textes. Aucune couleur seule : l'état est dit en texte ; cibles de 44 pt ; saisie au clavier (formulaire, Entrée).
 */

const ISSUE_TEXT: Record<Exclude<MeasurementIssue, 'range'>, BodyProgressPlainKey> = {
  empty: 'errorEmpty',
  format: 'errorFormat',
  date: 'errorDate',
  future: 'errorFuture',
};

/** Genres importés de Santé : texte du nom et de l'unité (dans le nom du genre : `_pct`, `_kg`, `_cm`, `_g`). */
const HEALTH_UNIT = { health_body_fat_pct: 'healthUnit_pct', health_lean_mass_kg: 'healthUnit_kg', health_waist_cm: 'healthUnit_cm', health_height_cm: 'healthUnit_cm', health_fiber_g: 'healthUnit_g' } as const satisfies Record<HealthMetricKind, BodyProgressTextKey>;

const PERIOD_TEXT = { '4w': 'period_4w', '3m': 'period_3m', '6m': 'period_6m', all: 'period_all' } as const satisfies Record<BodyPeriod, BodyProgressPlainKey>;

/** CORPS-0301c : ce que lit Mesures en plus des mensurations (profil en lecture seule, D-669 ; pesées ; séries de Santé). */
interface MeasuresExtra {
  readonly goal: BodyGoal | null;
  readonly sex: Sex | null;
  readonly heightCm: number | null;
  readonly weighIns: readonly WeighIn[];
  /** Tour de taille et hauteur importés de Santé, toutes dates (superposition et hauteur des ratios seulement, D-715). */
  readonly healthWaist: readonly MeasurementRecord[];
  readonly healthHeight: readonly MeasurementRecord[];
}
/** Pesées lues pour la période « Tout » : plus de 27 ans à une pesée par jour (la période n'est jamais coupée en silence). */
const WEIGHT_READ_LIMIT = 10_000;
const NO_EXTRA: MeasuresExtra = { goal: null, sex: null, heightCm: null, weighIns: [], healthWaist: [], healthHeight: [] };

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
      readonly extra: MeasuresExtra;
    };

/**
 * PROG-0301a (BL-177, D-701) : partie rendue seule, pour les sous-onglets de Progrès › Corps (Mesures, Santé, VISBODY, Photos). Sans partie : tout
 * Corps, rendu inchangé. Découpage sans changement de comportement ; BL-179 (CORPS-0301c) part de ce découpage.
 */
export type BodyProgressPart = 'measures' | 'health' | 'visbody' | 'photos';

export function BodyProgress({ pickPhoto = pickPhotoJpeg, part }: { readonly pickPhoto?: () => Promise<Uint8Array | null>; readonly part?: BodyProgressPart }) {
  const container = useAppContainer();
  const pc = useLayout() === 'pc';
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const synced = useSyncedData(['measurement', 'progress_photo', 'profile', 'body_weight']);
  const today = todayLocal(container.clock);

  const [kind, setKindRaw] = useState<MeasurementKind>('waist');
  const [text, setText] = useState('');
  // C-105 : la date suit le jour courant tant qu'Ali n'en a pas choisi une (le journal ouvert après minuit ne garde pas la veille).
  const [pickedDate, setPickedDate] = useState<LocalDate | null>(null);
  const date = pickedDate ?? today;
  const setDate = setPickedDate;
  // C-105 : une valeur saisie pour une zone n'est jamais gardée pour une autre.
  const setKind = (next: MeasurementKind): void => {
    if (next !== kind) setText('');
    setKindRaw(next);
  };
  const [measureMessage, setMeasureMessage] = useState<{ readonly alert: boolean; readonly text: string } | null>(null);
  const [photoMessage, setPhotoMessage] = useState<{ readonly alert: boolean; readonly text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  // C-094 : suppression d'une mesure confirmée (elle se propage par synchro sur les deux appareils).
  const [measureToDelete, setMeasureToDelete] = useState<MeasurementRecord | null>(null);
  const [compare, setCompare] = useState<readonly string[]>([]);
  // CORPS-0301c (D-706, D-718) : période de la courbe, 3 mois par défaut ; saisie guidée (D-709) à la place du formulaire zone par zone.
  const [period, setPeriod] = useState<BodyPeriod>(DEFAULT_BODY_PERIOD);
  const [guided, setGuided] = useState(false);
  // Relecture : à la fermeture de la saisie guidée, le focus revient sur son bouton d'ouverture.
  const guidedStart = useRef<HTMLDivElement>(null);
  const guidedClosed = useRef(false);
  useEffect(() => {
    if (guided || !guidedClosed.current) return;
    guidedClosed.current = false;
    guidedStart.current?.querySelector('button')?.focus();
  }, [guided]);
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((n) => n + 1), []);

  // FIX-0171 (constat 5, D-121) : les vues photo (liste, comparaison) ont leur propre demande de bouclier, indépendante du verrouillage : activée à
  // l'entrée, retirée à la sortie ; un échec du plugin est dit à l'écran (et au journal technique, sans aucune donnée).
  const [shieldFailed, setShieldFailed] = useState(false);
  // PROG-0301a (D-721) : le bouclier suit les vues photo ; un sous-onglet sans photo (Mesures, Santé, VISBODY) ne le demande pas.
  const showsPhotos = part === undefined || part === 'photos';
  useEffect(() => {
    if (!showsPhotos) return undefined;
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
  }, [container, showsPhotos]);

  useEffect(() => {
    // PROG-0301a : VISBODY lit ses propres bilans ; son sous-onglet ne lit ni les mesures ni les photos.
    if (part === 'visbody') return undefined;
    let live = true;
    (async () => {
      const { repos } = container.data;
      const photoRepo = await repos.progressPhotos();
      const measureRepo = await repos.measurements();
      // CORPS-0301c : profil (objectif, sexe, hauteur ; lecture seule) et pesées, pour Mesures seulement ; lancés tout de suite, en
      // parallèle des lectures existantes (le dépôt du profil est un module chargé à la demande).
      const extraRead: Promise<Omit<MeasuresExtra, 'healthWaist' | 'healthHeight'> | null> =
        part === undefined || part === 'measures'
          ? (async () => {
              const [profiles, bodyWeights] = await Promise.all([repos.profile(), repos.bodyWeights()]);
              const [profile, weights] = await Promise.all([profiles.get(), bodyWeights.listRecent(WEIGHT_READ_LIMIT)]);
              const weighIns = [...weights]
                .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.measuredAt ?? '') < (b.measuredAt ?? '') ? -1 : (a.measuredAt ?? '') > (b.measuredAt ?? '') ? 1 : 0))
                .map((w) => ({ date: w.date, kg: w.kg }));
              return { goal: profile?.goal ?? null, sex: profile?.sex ?? null, heightCm: profile?.heightCm ?? null, weighIns };
            })()
          : Promise.resolve(null);
      // Un échec est lu plus bas (await) : jamais une promesse rejetée sans gestionnaire entre-temps.
      extraRead.catch(() => undefined);
      const measures = await measureRepo.list();
      // Dernière valeur de chaque genre importé de Santé (I6-04), en lecture seule.
      // CORPS-0301c : les séries complètes du tour de taille et de la hauteur de Santé servent aussi à Mesures (pointillé, hauteur des ratios).
      const healthRows = await Promise.all(HEALTH_METRIC_KINDS.filter((k) => k !== 'health_fiber_g').map((k) => measureRepo.list(k)));
      const health = healthRows.flatMap((rows) => rows.slice(-1));
      const seriesOf = (k: HealthMetricKind): readonly MeasurementRecord[] => healthRows.find((rows) => rows[0]?.kind === k) ?? [];
      const photos = await photoRepo.list();
      // D-121 : une suppression reçue n'efface jamais le fichier local ; la fiche reste affichée « supprimée ailleurs » jusqu'à la suppression ici.
      const deletedElsewhere = await photoRepo.listDeletedWithFile();
      const hidden = parseHiddenPhotoIds(await repos.settings.get('bodyProgress.hiddenPhotos'));
      const read = await extraRead;
      const extra: MeasuresExtra = read === null ? NO_EXTRA : { ...read, healthWaist: seriesOf('health_waist_cm'), healthHeight: seriesOf('health_height_cm') };
      return { status: 'ready', measures, health, photos, deletedElsewhere, hidden, local: await photoRepo.localFileIds(), extra } as const;
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
  }, [container, synced, attempt, reload, part]);

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

  /** Saisie guidée (D-709) : même dépôt que la saisie zone par zone ; une erreur remonte à l'étape, qui la dit. */
  const saveGuided = async (day: LocalDate, zone: MeasurementKind, value: number): Promise<void> => {
    await (await container.data.repos.measurements()).save(day, zone, value);
    refresh();
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
    } catch (error) {
      setPhotoMessage({ alert: true, text: tBodyProgress(error instanceof PhotoTooLargeError ? 'photoTooLarge' : 'photoFailed') });
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
  const setHidden = async (next: readonly string[], done: BodyProgressPlainKey | null): Promise<void> => {
    try {
      await container.data.repos.settings.set('bodyProgress.hiddenPhotos', next);
      setCompare((ids) => ids.filter((x) => !next.includes(x)));
      setPhotoMessage(done === null ? null : { alert: false, text: tBodyProgress(done) });
    } catch {
      setPhotoMessage({ alert: true, text: tBodyProgress('saveFailed') });
    }
    refresh();
  };

  if (part === 'visbody') {
    return (
      <div className="ct-bodyprogress">
        <h2 className="ct-today__eyebrow ct-bodyprogress__title ct-section-title">{tBodyProgress('title')}</h2>
        <VisbodySection />
      </div>
    );
  }
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

  const { measures, health, local, hidden, extra } = load;
  const hiddenHere = load.photos.filter((p) => hidden.includes(p.id) && !local.has(p.id)).length;
  const elsewhere = new Set(load.deletedElsewhere.map((p) => p.id));
  const photos = [...load.photos.filter((p) => local.has(p.id) || !hidden.includes(p.id)), ...load.deletedElsewhere].sort((a, b) =>
    a.day !== b.day ? (a.day < b.day ? 1 : -1) : a.createdAt !== b.createdAt ? (a.createdAt < b.createdAt ? 1 : -1) : a.id < b.id ? 1 : -1,
  );
  const ofKind = measures.filter((m) => m.kind === kind);
  const pointsOf = (k: MeasurementKind) => measures.filter((m) => m.kind === k).map((m) => ({ date: m.day, value: m.value }));
  const summaries = Object.fromEntries(MEASUREMENT_KINDS.map((k) => [k, summarizeZone(pointsOf(k))])) as Record<MeasurementKind, ZoneSummary>;
  const summary = summaries[kind];
  const zoneName = tBodyProgress(KIND_TEXT[kind]);
  // CORPS-0301c : calculs du domaine pur (PROG-0301b) sur les mesures saisies ; la hauteur de Santé n'entre que dans les ratios (D-715).
  const samples: BodySample[] = [...measures, ...extra.healthHeight].map((m) => ({ kind: m.kind, date: m.day, value: m.value }));
  const trends = zoneTrends(samples, extra.goal);
  const start = periodStart(period, today);
  const toPoint = (m: MeasurementRecord): ZonePoint => ({ date: m.day, value: m.value });
  const periodPoints = pointsOf(kind).filter((p) => inPeriod(p.date, start, today));
  const overlay = kind === 'waist' ? extra.healthWaist.map(toPoint).filter((p) => inPeriod(p.date, start, today)) : [];
  const showCurve = periodPoints.length >= 2;
  const ratios = bodyRatios(samples, extra.heightCm, period, today);
  const symmetries = symmetryAll(samples);
  const compared = compare.map((id) => photos.find((p) => p.id === id)).filter((p): p is ProgressPhotoRecord => p !== undefined);
  const changeText = (): string => {
    if (summary.delta === null || summary.reference === null) return tBodyProgress('changeNone');
    if (summary.span === 'four-weeks' && summary.delta !== 0) return tBodyProgress('heroChange4w', { delta: signed(summary.delta) });
    return summary.delta === 0 ? tBodyProgress('changeSame', { date: formatDayMonthYear(summary.reference.date) }) : tBodyProgress('changeLine', { date: formatDayMonthYear(summary.reference.date), delta: signed(summary.delta) });
  };
  const onKeyZone = (event: React.KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setKind(neighbourZone(kind, event.key === 'ArrowDown' ? 1 : -1));
  };

  const title = <h2 className="ct-today__eyebrow ct-bodyprogress__title ct-section-title">{tBodyProgress('title')}</h2>;
  const zoneList = pc ? <ZoneList kind={kind} summaries={summaries} onSelect={setKind} trends={trends} goal={extra.goal} /> : null;
  const insights = (
    <>
      <RatiosCard ratios={ratios} sex={extra.sex} />
      <SymmetryCard values={symmetries} />
    </>
  );
  const main = (
      <section className="ct-bodyprogress__main ct-flat" aria-labelledby="ct-bodyprogress-measures">
        <h3 id="ct-bodyprogress-measures" className="ct-bodyprogress__heading ct-section-title">
          {tBodyProgress('measuresTitle')}
        </h3>
        <div className="ct-bodyprogress__hero">
          {pc ? null : <Silhouette kind={kind} onSelect={setKind} trends={trends} />}
          <div className="ct-bodyprogress__herotext">
            <p className="ct-bodyprogress__zonename">{zoneName}</p>
            {summary.last === null ? (
              <>
                <p className="ct-today__text">
                  <MissingValue reason={tBodyProgress('heroMissing')} />
                </p>
                <p className="ct-today__muted">{tBodyProgress('trendLine', { trend: trendWords(trends[kind]) })}</p>
              </>
            ) : (
              <>
                <p className="ct-hero">
                  <span className="ct-hero__num">{formatCm(summary.last.value)}</span>
                  <span className="ct-hero__unit">{tBodyProgress('unitCm')}</span>
                </p>
                <p className="ct-today__text">{changeText()}</p>
                <p className="ct-today__muted">{tBodyProgress('heroLastOn', { date: formatDayMonthYear(summary.last.date) })}</p>
                <p className="ct-today__muted">{tBodyProgress('trendLine', { trend: trendWords(trends[kind]) })}</p>
                {showCurve ? <ZoneCurve points={periodPoints} overlay={overlay} zoneName={zoneName} large={pc} /> : <p className="ct-today__muted">{tBodyProgress('curveEmptyPeriod')}</p>}
                {showCurve && overlay.length > 0 ? <p className="ct-today__muted">{tBodyProgress('curveHealthLegend')}</p> : null}
              </>
            )}
          </div>
        </div>
        {pc ? null : <TrendLegend goal={extra.goal} />}
        {pc ? null : <ZoneChips kind={kind} onSelect={setKind} trends={trends} />}
        <div className="ct-bodyprogress__period">
          <SegmentedControl label={tBodyProgress('periodLabel')} value={period} onChange={setPeriod} options={BODY_PERIODS.map((value) => ({ value, label: tBodyProgress(PERIOD_TEXT[value]) }))} />
          <RateLine rate={monthlyRate(samples, kind, period, today)} />
          <WeightLine evolution={weightEvolution(extra.weighIns, period, today)} />
        </div>
        {guided ? (
          <GuidedEntry
            today={today}
            pointsOf={pointsOf}
            save={saveGuided}
            onClose={() => {
              guidedClosed.current = true;
              setGuided(false);
            }}
          />
        ) : (
          <>
            <form className="ct-bodyprogress__entry" onSubmit={(event) => void saveMeasure(event)} noValidate>
              <label className="ct-bodyprogress__date">
                <span className="ct-bodyprogress__label">{tBodyProgress('dateLabel')}</span>
                <input className="ct-bodyprogress__input" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value as LocalDate)} />
              </label>
              <label className="ct-bodyprogress__value">
                <input className="ct-bodyprogress__input" inputMode="decimal" autoComplete="off" placeholder={summary.last === null ? undefined : formatCm(summary.last.value)} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyZone} aria-label={tBodyProgress('valueLabel')} />
                <span className="ct-bodyprogress__unit" aria-hidden="true">
                  {tBodyProgress('unitCm')}
                </span>
              </label>
              <Button type="submit" className="ct-bodyprogress__save">
                {tBodyProgress('save')}
              </Button>
            </form>
            {pc ? <p className="ct-today__muted">{tBodyProgress('entryKeys')}</p> : null}
            <div ref={guidedStart}>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setMeasureMessage(null);
                  setGuided(true);
                }}
              >
                {tBodyProgress('guidedStart')}
              </Button>
            </div>
          </>
        )}
        {/* CORPS-0301d (BL-180) : rythme des mesures et rappel, sous la saisie (zone par zone ou guidée). */}
        <MeasurementRhythmLazy samples={measures} />
        {measureMessage && (
          <p className="ct-bodyprogress__message" role={measureMessage.alert ? 'alert' : 'status'}>
            {measureMessage.text}
          </p>
        )}
        {measureToDelete && (
          <ConfirmDialog
            title={tBodyProgress('measureDeleteTitle', { date: formatDayMonthYear(measureToDelete.day) })}
            description={tBodyProgress('measureDeleteHint')}
            confirmLabel={tBodyProgress('measureDeleteConfirm')}
            onCancel={() => setMeasureToDelete(null)}
            onConfirm={() => {
              const record = measureToDelete;
              setMeasureToDelete(null);
              void removeMeasure(record);
            }}
          />
        )}
        <p className="ct-today__muted">{tBodyProgress('measuresHint')}</p>
        {ofKind.length === 0 ? (
          <p className="ct-today__muted">{tBodyProgress('measuresEmpty')}</p>
        ) : (
          <ul className="ct-bodyprogress__list" aria-label={tBodyProgress('historyTitle')}>
            {[...ofKind].reverse().map((m) => (
              <li key={m.id} className="ct-bodyprogress__item">
                <span>{formatDayMonthYear(m.day)}</span>
                <span className="ct-bodyprogress__value-text">{tBodyProgress('measureLine', { value: formatCm(m.value) })}</span>
                <button type="button" className="ct-bodyprogress__delete" aria-label={tBodyProgress('measureDelete', { date: formatDayMonthYear(m.day) })} onClick={() => setMeasureToDelete(m)}>
                  {tBodyProgress('deleteGlyph')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
  );
  const healthCard = health.length > 0 ? (
        <section className="ct-bodyprogress__card ct-flat" aria-labelledby="ct-bodyprogress-health">
          <h3 id="ct-bodyprogress-health" className="ct-bodyprogress__heading ct-section-title">
            {tBodyProgress('healthTitle')}
          </h3>
          <dl className="ct-bodyprogress__health">
            {health.map((m) => (
              <div key={m.id} className="ct-bodyprogress__healthrow">
                <dt>{tBodyProgress(`health_${m.kind}` as BodyProgressPlainKey)}</dt>
                <dd>
                  <span className="ct-bodyprogress__healthvalue">{`${formatCm(m.value)} ${tBodyProgress(HEALTH_UNIT[m.kind as HealthMetricKind])}`}</span>
                  <span className="ct-today__muted">{tBodyProgress('healthDate', { date: formatDayMonthYear(m.day) })}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="ct-today__muted">{tBodyProgress('healthHint')}</p>
        </section>
  ) : null;
  const photosCard = (
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
  );

  if (part === undefined) {
    return (
      <div className={pc ? 'ct-bodyprogress ct-bodyprogress--pc' : 'ct-bodyprogress'}>
        {title}
        {zoneList}
        {main}
        <div className="ct-bodyprogress__side">
          {insights}
          {healthCard}
          {/* SUIVIS-029d : bilans VISBODY (saisie manuelle, courbes, écart au bilan précédent). */}
          <VisbodySection />
          {photosCard}
        </div>
      </div>
    );
  }
  // PROG-0301a : un sous-onglet ; la grille PC (zones, mesure, courbe) reste dans Mesures (P-30, D-719).
  return (
    <div className={pc && part === 'measures' ? 'ct-bodyprogress ct-bodyprogress--pc' : 'ct-bodyprogress'}>
      {title}
      {part === 'measures' ? (
        <>
          {zoneList}
          {main}
          <div className="ct-bodyprogress__side">{insights}</div>
        </>
      ) : part === 'health' ? (
        (healthCard ?? (
          // D-720 : sans import de Santé, le sous-onglet le dit (le bloc complet, lui, reste absent sans import, comme avant).
          <section className="ct-bodyprogress__card ct-flat" aria-labelledby="ct-bodyprogress-health">
            <h3 id="ct-bodyprogress-health" className="ct-bodyprogress__heading ct-section-title">
              {tBodyProgress('healthTitle')}
            </h3>
            <p className="ct-today__muted">{tBodyProgress('healthEmpty')}</p>
            <p className="ct-today__muted">{tBodyProgress('healthHint')}</p>
          </section>
        ))
      ) : (
        photosCard
      )}
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
