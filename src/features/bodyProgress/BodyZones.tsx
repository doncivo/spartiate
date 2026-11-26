import type { MouseEvent as ReactMouseEvent } from 'react';
import { MEASUREMENT_KINDS, isMeasurementKind, type MeasurementKind } from '../../domain/bodyProgress';
import type { BodyGoal } from '../../domain/bodyProfile';
import type { TrendTone, ZoneTrend } from '../../domain/bodyProgress/zoneTrend';
import { formatCm, tBodyProgress, type BodyProgressTextKey } from '../../i18n/bodyProgressText';
import { MissingValue } from '../../ui/MissingValue';
import { SILHOUETTE_DOTS, periodCurveGeometry, type ZonePoint, type ZoneSummary } from './bodyZone';

/**
 * ERGO-02 (Corps-apres, PC-Corps-apres) : sélection de la zone (silhouette et pastilles sur iPhone, liste sur PC) et courbe. Présentation seule.
 * La silhouette est un reflet : chaque zone est aussi un bouton radio nommé (pastille ou ligne), la zone choisie est dite en texte.
 * CORPS-0301c (D-704, D-705, D-716, D-719) : silhouette, pastilles et liste portent la même tendance (marque colorée et mots, jamais la
 * couleur seule) ; la tendance vient du domaine pur (`zoneTrends`).
 */
export const KIND_TEXT = {
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

const SHORT_TEXT = {
  neck: 'kindShort_neck',
  shoulders: 'kindShort_shoulders',
  chest: 'kindShort_chest',
  waist: 'kindShort_waist',
  hips: 'kindShort_hips',
  arm_left: 'kindShort_arm_left',
  arm_right: 'kindShort_arm_right',
  thigh_left: 'kindShort_thigh_left',
  thigh_right: 'kindShort_thigh_right',
  calf_left: 'kindShort_calf_left',
  calf_right: 'kindShort_calf_right',
} as const satisfies Record<MeasurementKind, BodyProgressTextKey>;

export const signed = (delta: number): string => `${delta > 0 ? tBodyProgress('signPlus') : delta < 0 ? tBodyProgress('signMinus') : ''}${formatCm(Math.abs(delta))}`;

/** Zone voisine (flèches du clavier), sans boucle : les bords restent sur place. */
export function neighbourZone(kind: MeasurementKind, step: 1 | -1): MeasurementKind {
  const index = MEASUREMENT_KINDS.indexOf(kind) + step;
  return MEASUREMENT_KINDS[Math.min(MEASUREMENT_KINDS.length - 1, Math.max(0, index))] ?? kind;
}

/** CORPS-0301c (D-705, D-716) : tendance d'une zone en mots (le sens, puis la tonalité quand l'objectif du profil est connu). */
export function trendWords(trend: ZoneTrend | undefined): string {
  if (trend === undefined || trend.direction === 'insufficient') return tBodyProgress('trendDir_insufficient');
  if (trend.direction === 'stable') return tBodyProgress('trendDir_stable');
  const direction = tBodyProgress(trend.direction === 'up' ? 'trendDir_up' : 'trendDir_down');
  if (trend.tone === 'neutral') return direction;
  return tBodyProgress('trendWithTone', { direction, tone: tBodyProgress(trend.tone === 'favorable' ? 'trendTone_favorable' : 'trendTone_unfavorable') });
}

type Trends = Readonly<Record<MeasurementKind, ZoneTrend>>;
const toneOf = (trends: Trends | undefined, k: MeasurementKind): TrendTone => trends?.[k].tone ?? 'neutral';

/** Légende des couleurs (sous la silhouette sur iPhone, sous le titre de la liste sur PC) : chaque couleur dite en mots (§ 18.6). */
export function TrendLegend({ goal }: { readonly goal: BodyGoal | null }) {
  const items = [
    ['favorable', 'trendLegendFavorable'],
    ['unfavorable', 'trendLegendUnfavorable'],
    ['neutral', 'trendLegendNeutral'],
  ] as const;
  return (
    <div className="ct-bodyprogress__legend">
      <ul className="ct-bodyprogress__legendlist" aria-label={tBodyProgress('trendLegendLabel')}>
        {items.map(([tone, key]) => (
          <li key={tone} className="ct-bodyprogress__legenditem">
            <span className={`ct-bodyprogress__mark ct-bodyprogress__mark--${tone}`} aria-hidden="true" />
            <span>{tBodyProgress(key)}</span>
          </li>
        ))}
      </ul>
      <p className="ct-today__muted">{goal === null ? tBodyProgress('trendGoalNone') : tBodyProgress(`trendGoal_${goal}`)}</p>
    </div>
  );
}

interface ZoneProps {
  readonly kind: MeasurementKind;
  readonly onSelect: (kind: MeasurementKind) => void;
  /** CORPS-0301c : tendance de chaque zone, même source pour la silhouette, les pastilles et la liste (D-704). */
  readonly trends?: Trends;
}

/** Distance (unités de la silhouette) au-delà de laquelle un toucher entre les points ne choisit aucune zone. */
const NEAREST_MAX = 24;

/** iPhone : silhouette (zones tactiles, pastilles de 44 px de zone de toucher) ; la ligne de taille est dessinée en plus, comme dans l'aperçu. */
export function Silhouette({ kind, onSelect, trends }: ZoneProps) {
  const here = SILHOUETTE_DOTS[kind];
  // D-704 : un toucher sur un point choisit sa zone ; un toucher entre les points choisit la plus proche (un doigt est plus large qu'un point).
  const onClick = (event: ReactMouseEvent<SVGSVGElement>): void => {
    const zone = (event.target as Element).closest('[data-zone]')?.getAttribute('data-zone');
    if (typeof zone === 'string' && isMeasurementKind(zone)) {
      onSelect(zone);
      return;
    }
    const ctm = typeof event.currentTarget.getScreenCTM === 'function' ? event.currentTarget.getScreenCTM() : null;
    if (ctm === null) return;
    const at = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    let best: MeasurementKind | null = null;
    let bestDistance = NEAREST_MAX;
    for (const k of MEASUREMENT_KINDS) {
      const distance = Math.hypot(SILHOUETTE_DOTS[k].x - at.x, SILHOUETTE_DOTS[k].y - at.y);
      if (distance < bestDistance) {
        best = k;
        bestDistance = distance;
      }
    }
    if (best !== null) onSelect(best);
  };
  return (
    <svg className="ct-bodyprogress__silhouette" viewBox="0 0 120 230" role="img" aria-label={tBodyProgress('silhouetteLabel', { zone: tBodyProgress(KIND_TEXT[kind]) })} onClick={onClick}>
      <g className="ct-bodyprogress__outline">
        <circle cx="60" cy="22" r="16" />
        <path d="M40 44 L80 44 L92 110 L84 112 L76 70 L74 130 L80 222 L66 222 L60 140 L54 222 L40 222 L46 130 L44 70 L36 112 L28 110 Z" />
      </g>
      <line className="ct-bodyprogress__selected" x1={here.x - 20} y1={here.y} x2={here.x + 20} y2={here.y} strokeWidth="3" strokeLinecap="round" />
      {MEASUREMENT_KINDS.map((k) => (
        <g key={k} data-zone={k} data-tone={toneOf(trends, k)}>
          <circle className={`ct-bodyprogress__dot ct-bodyprogress__dot--${toneOf(trends, k)}${k === kind ? ' ct-bodyprogress__dot--on' : ''}`} cx={SILHOUETTE_DOTS[k].x} cy={SILHOUETTE_DOTS[k].y} r={k === kind ? 5.5 : 3.5} />
          <circle className="ct-bodyprogress__hit" cx={SILHOUETTE_DOTS[k].x} cy={SILHOUETTE_DOTS[k].y} r="9" />
        </g>
      ))}
    </svg>
  );
}

/** iPhone : une pastille par zone (cible ≥ 44 px), nom complet pour les lecteurs d'écran ; marque de tendance et tendance dite (D-704). */
export function ZoneChips({ kind, onSelect, trends }: ZoneProps) {
  // C-105 : tabulation itinérante (une seule pastille dans l'ordre de tabulation) et flèches pour passer d'une zone à l'autre.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = neighbourZone(kind, step);
    onSelect(next);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[MEASUREMENT_KINDS.indexOf(next)]?.focus();
  };
  return (
    <div className="ct-bodyprogress__chips" role="radiogroup" aria-label={tBodyProgress('kindLabel')} onKeyDown={onKeyDown}>
      {MEASUREMENT_KINDS.map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={k === kind}
          aria-label={tBodyProgress(KIND_TEXT[k])}
          aria-describedby={trends ? `ct-chip-trend-${k}` : undefined}
          data-zone={k}
          data-tone={toneOf(trends, k)}
          tabIndex={k === kind ? 0 : -1}
          className="ct-bodyprogress__chip"
          onClick={() => onSelect(k)}
        >
          {trends ? <span className={`ct-bodyprogress__mark ct-bodyprogress__mark--${toneOf(trends, k)}`} aria-hidden="true" /> : null}
          {tBodyProgress(SHORT_TEXT[k])}
          {trends ? (
            <span id={`ct-chip-trend-${k}`} className="ct-visually-hidden">
              {trendWords(trends[k])}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** PC : liste des zones à gauche (dernière valeur, écart sur 4 semaines, tendance) ; les flèches haut et bas du groupe changent de zone. */
export function ZoneList({ kind, summaries, onSelect, trends, goal = null }: ZoneProps & { readonly summaries: Readonly<Record<MeasurementKind, ZoneSummary>>; readonly goal?: BodyGoal | null }) {
  return (
    <div className="ct-bodyprogress__zones">
      <h3 className="ct-bodyprogress__heading ct-section-title">{tBodyProgress('zonesListTitle')}</h3>
      {trends ? <TrendLegend goal={goal} /> : null}
      <div
        role="radiogroup"
        aria-label={tBodyProgress('kindLabel')}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          const next = neighbourZone(kind, event.key === 'ArrowDown' ? 1 : -1);
          onSelect(next);
          event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[MEASUREMENT_KINDS.indexOf(next)]?.focus();
        }}
      >
        {MEASUREMENT_KINDS.map((k) => {
          const s = summaries[k];
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={k === kind}
              aria-label={tBodyProgress(KIND_TEXT[k])}
              aria-describedby={`${trends && s.last !== null ? `ct-zone-trend-${k} ` : ''}ct-zone-value-${k} ct-zone-delta-${k}`}
              data-tone={toneOf(trends, k)}
              tabIndex={k === kind ? 0 : -1}
              className="ct-bodyprogress__zone"
              onClick={() => onSelect(k)}
            >
              <span className="ct-bodyprogress__zonelabel">
                <span aria-hidden="true">{tBodyProgress(KIND_TEXT[k])}</span>
                {trends ? (
                  <span id={`ct-zone-trend-${k}`} className="ct-bodyprogress__zonetrend">
                    <span className={`ct-bodyprogress__mark ct-bodyprogress__mark--${toneOf(trends, k)}`} aria-hidden="true" />
                    {trendWords(trends[k])}
                  </span>
                ) : null}
              </span>
              <span id={`ct-zone-value-${k}`} className="ct-bodyprogress__zonevalue">
                {s.last === null ? <MissingValue reason={tBodyProgress('zoneNoMeasure')} /> : formatCm(s.last.value)}
              </span>
              {s.delta === null || s.span !== 'four-weeks' ? (
                <>
                  <span className="ct-bodyprogress__zonedelta" aria-hidden="true">
                    {tBodyProgress('zoneNoDelta')}
                  </span>
                  <span id={`ct-zone-delta-${k}`} className="ct-visually-hidden">
                    {tBodyProgress('zoneNoDeltaFull')}
                  </span>
                </>
              ) : (
                <span id={`ct-zone-delta-${k}`} className="ct-bodyprogress__zonedelta">{s.delta === 0 ? tBodyProgress('zoneDeltaSame') : signed(s.delta)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Courbe de la zone : ligne, points, dernier point plus gros ; le détail est dans le nom de l'image et dans la liste des relevés (jamais la couleur
 * seule). CORPS-0301c (D-706, D-718) : toutes les mesures reçues (celles de la période) et, s'il est donné, le tour de taille de Santé en pointillé.
 */
export function ZoneCurve({ points, overlay = [], zoneName, large }: { readonly points: readonly ZonePoint[]; readonly overlay?: readonly ZonePoint[]; readonly zoneName: string; readonly large: boolean }) {
  const width = large ? 620 : 200;
  const height = large ? 200 : 56;
  const geometry = periodCurveGeometry(points, overlay, width, height, large ? 12 : 6);
  if (geometry === null) return null;
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  const label = tBodyProgress('curveLabel', { zone: zoneName, from: formatCm(sorted[0]?.value ?? 0), to: formatCm(sorted.at(-1)?.value ?? 0) });
  return (
    <svg className="ct-bodyprogress__curve" viewBox={`-6 -6 ${String(width + 12)} ${String(height + 12)}`} role="img" aria-label={label}>
      {geometry.overlay === null ? null : (
        <>
          <path className="ct-bodyprogress__curveoverlay" d={geometry.overlay} fill="none" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
          {geometry.overlayDots.map((dot, i) => (
            <circle key={`o${String(i)}`} className="ct-bodyprogress__curveoverlaydot" cx={dot.x} cy={dot.y} r={2.5} />
          ))}
        </>
      )}
      <path className="ct-bodyprogress__curveline" d={geometry.path} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {geometry.dots.map((dot, i) => (
        <circle key={i} className={dot.last ? 'ct-bodyprogress__curvelast' : 'ct-bodyprogress__curvedot'} cx={dot.x} cy={dot.y} r={dot.last ? 5 : 3} />
      ))}
    </svg>
  );
}
