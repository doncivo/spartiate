import { MEASUREMENT_KINDS, type MeasurementKind } from '../../domain/bodyProgress';
import { formatCm, tBodyProgress, type BodyProgressTextKey } from '../../i18n/bodyProgressText';
import { MissingValue } from '../../ui/MissingValue';
import { SILHOUETTE_DOTS, curveGeometry, type ZonePoint, type ZoneSummary } from './bodyZone';

/**
 * ERGO-02 (Corps-apres, PC-Corps-apres) : sélection de la zone (silhouette et pastilles sur iPhone, liste sur PC) et courbe. Présentation seule.
 * La silhouette est un reflet : chaque zone est aussi un bouton radio nommé (pastille ou ligne), la zone choisie est dite en texte.
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

interface ZoneProps {
  readonly kind: MeasurementKind;
  readonly onSelect: (kind: MeasurementKind) => void;
}

/** iPhone : silhouette (zones tactiles, pastilles de 44 px de zone de toucher) ; la ligne de taille est dessinée en plus, comme dans l'aperçu. */
export function Silhouette({ kind, onSelect }: ZoneProps) {
  const here = SILHOUETTE_DOTS[kind];
  return (
    <svg className="ct-bodyprogress__silhouette" viewBox="0 0 120 230" role="img" aria-label={tBodyProgress('silhouetteLabel', { zone: tBodyProgress(KIND_TEXT[kind]) })}>
      <g className="ct-bodyprogress__outline">
        <circle cx="60" cy="22" r="16" />
        <path d="M40 44 L80 44 L92 110 L84 112 L76 70 L74 130 L80 222 L66 222 L60 140 L54 222 L40 222 L46 130 L44 70 L36 112 L28 110 Z" />
      </g>
      <line className="ct-bodyprogress__selected" x1={here.x - 20} y1={here.y} x2={here.x + 20} y2={here.y} strokeWidth="3" strokeLinecap="round" />
      {MEASUREMENT_KINDS.map((k) => (
        <g key={k} data-zone={k} onClick={() => onSelect(k)}>
          <circle className={k === kind ? 'ct-bodyprogress__dot ct-bodyprogress__dot--on' : 'ct-bodyprogress__dot'} cx={SILHOUETTE_DOTS[k].x} cy={SILHOUETTE_DOTS[k].y} r={k === kind ? 5 : 3} />
          <circle className="ct-bodyprogress__hit" cx={SILHOUETTE_DOTS[k].x} cy={SILHOUETTE_DOTS[k].y} r="9" />
        </g>
      ))}
    </svg>
  );
}

/** iPhone : une pastille par zone (cible ≥ 44 px), nom complet pour les lecteurs d'écran. */
export function ZoneChips({ kind, onSelect }: ZoneProps) {
  return (
    <div className="ct-bodyprogress__chips" role="radiogroup" aria-label={tBodyProgress('kindLabel')}>
      {MEASUREMENT_KINDS.map((k) => (
        <button key={k} type="button" role="radio" aria-checked={k === kind} aria-label={tBodyProgress(KIND_TEXT[k])} className="ct-bodyprogress__chip" onClick={() => onSelect(k)}>
          {tBodyProgress(SHORT_TEXT[k])}
        </button>
      ))}
    </div>
  );
}

/** PC : liste des zones à gauche (dernière valeur, écart sur 4 semaines) ; les flèches haut et bas du groupe changent de zone. */
export function ZoneList({ kind, summaries, onSelect }: ZoneProps & { readonly summaries: Readonly<Record<MeasurementKind, ZoneSummary>> }) {
  return (
    <div className="ct-bodyprogress__zones">
      <h3 className="ct-bodyprogress__heading ct-section-title">{tBodyProgress('zonesListTitle')}</h3>
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
            <button key={k} type="button" role="radio" aria-checked={k === kind} aria-label={tBodyProgress(KIND_TEXT[k])} aria-describedby={`ct-zone-value-${k}`} tabIndex={k === kind ? 0 : -1} className="ct-bodyprogress__zone" onClick={() => onSelect(k)}>
              <span aria-hidden="true">{tBodyProgress(KIND_TEXT[k])}</span>
              <span id={`ct-zone-value-${k}`} className="ct-bodyprogress__zonevalue">
                {s.last === null ? <MissingValue reason={tBodyProgress('zoneNoMeasure')} /> : formatCm(s.last.value)}
              </span>
              <span className="ct-bodyprogress__zonedelta">{s.delta === null ? <MissingValue reason={tBodyProgress('zoneNoDelta')} /> : s.delta === 0 ? tBodyProgress('zoneDeltaSame') : signed(s.delta)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Courbe de la zone : ligne, points, dernier point plus gros ; le détail est dans le nom de l'image et dans la liste des relevés (jamais la couleur seule). */
export function ZoneCurve({ points, zoneName, large }: { readonly points: readonly ZonePoint[]; readonly zoneName: string; readonly large: boolean }) {
  const width = large ? 620 : 200;
  const height = large ? 200 : 56;
  const geometry = curveGeometry(points, width, height, large ? 12 : 6);
  if (geometry === null) return null;
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-12);
  const label = tBodyProgress('curveLabel', { zone: zoneName, from: formatCm(sorted[0]?.value ?? 0), to: formatCm(sorted.at(-1)?.value ?? 0) });
  return (
    <svg className="ct-bodyprogress__curve" viewBox={`-6 -6 ${String(width + 12)} ${String(height + 12)}`} role="img" aria-label={label}>
      <path className="ct-bodyprogress__curveline" d={geometry.path} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {geometry.dots.map((dot, i) => (
        <circle key={i} className={dot.last ? 'ct-bodyprogress__curvelast' : 'ct-bodyprogress__curvedot'} cx={dot.x} cy={dot.y} r={dot.last ? 5 : 3} />
      ))}
    </svg>
  );
}
