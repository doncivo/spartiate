import type { Sex } from '../../domain/bodyProfile';
import { ratioReference, type RatioReference } from '../../domain/bodyProgress/ratioReferences';
import { BODY_RATIOS, type BodyRatio, type BodyRatioKind } from '../../domain/bodyProgress/ratios';
import { SYMMETRY_PAIRS, type Symmetry, type SymmetryPair } from '../../domain/bodyProgress/symmetry';
import type { WeightEvolution } from '../../domain/bodyProgress/weightEvolution';
import type { MonthlyRate } from '../../domain/bodyProgress/zoneTrend';
import { formatDayMonthYear } from '../../i18n/format';
import { formatCm, tBodyProgress, type BodyProgressPlainKey } from '../../i18n/bodyProgressText';
import { signed } from './BodyZones';

/**
 * CORPS-0301c (BL-179) : présentation des calculs purs de Corps › Mesures (src/domain/bodyProgress, PROG-0301b) : rythme par mois et poids
 * sous la courbe (D-706, D-718), 4 ratios avec repères (D-707, D-715, D-745), symétrie gauche / droite (D-708). Aucun calcul ici : formats et
 * mots seulement ; une valeur inconnue est dite « inconnu » avec sa raison, jamais 0.
 */

/** Ratio au centième, virgule française (« 0,48 »). */
const ratioText = (value: number): string => value.toFixed(2).replace('.', ',');
const signedRatio = (delta: number): string => `${delta > 0 ? tBodyProgress('signPlus') : delta < 0 ? tBodyProgress('signMinus') : ''}${ratioText(Math.abs(delta))}`;

export function RateLine({ rate }: { readonly rate: MonthlyRate }) {
  return <p className="ct-today__text">{rate.status === 'known' ? tBodyProgress('rateKnown', { rate: signed(rate.cmPerMonth) }) : tBodyProgress('rateUnknown')}</p>;
}

export function WeightLine({ evolution }: { readonly evolution: WeightEvolution }) {
  const text =
    evolution.status === 'known'
      ? tBodyProgress('weightKnown', { delta: signed(evolution.deltaKg), from: formatDayMonthYear(evolution.from.date), to: formatDayMonthYear(evolution.to.date) })
      : evolution.status === 'learning'
        ? evolution.weighIns === 0
          ? tBodyProgress('weightNone')
          : tBodyProgress('weightLearning', { count: evolution.weighIns, needed: evolution.needed })
        : tBodyProgress('weightUnknown');
  return <p className="ct-today__text">{text}</p>;
}

const RATIO_TEXT: Record<BodyRatioKind, BodyProgressPlainKey> = {
  waist_height: 'ratio_waist_height',
  shoulders_waist: 'ratio_shoulders_waist',
  waist_hips: 'ratio_waist_hips',
  chest_waist: 'ratio_chest_waist',
};
const UNKNOWN_TEXT = { 'no-height': 'ratioUnknown_noHeight', missing: 'ratioUnknown_missing', gap: 'ratioUnknown_gap' } as const satisfies Record<string, BodyProgressPlainKey>;
const BAND_TEXT = { 'below-healthy': 'refWH_belowHealthy', healthy: 'refWH_healthy', increased: 'refWH_increased', high: 'refWH_high' } as const satisfies Record<string, BodyProgressPlainKey>;
const CAVEAT_TEXT = { 'bmi-35': 'refCaveat_bmi35', european: 'refCaveat_european', aesthetic: 'refCaveat_aesthetic' } as const satisfies Record<string, BodyProgressPlainKey>;

/** Repère d'un ratio (D-745) et sa mention, en mots. */
function referenceText(ref: RatioReference, sex: Sex | null): { readonly line: string; readonly caveat: string | null } {
  switch (ref.kind) {
    case 'band':
      return { line: tBodyProgress(BAND_TEXT[ref.band]), caveat: tBodyProgress(CAVEAT_TEXT[ref.caveat]) };
    case 'threshold':
      return {
        line: tBodyProgress(ref.below ? 'refWHips_below' : 'refWHips_above', { limit: ratioText(ref.limit), sex: tBodyProgress(sex === 'female' ? 'refSex_female' : 'refSex_male') }),
        caveat: tBodyProgress(CAVEAT_TEXT[ref.caveat]),
      };
    case 'range': {
      const key = ref.position === 'below' ? 'refChest_below' : ref.position === 'above' ? 'refChest_above' : 'refChest_within';
      return { line: tBodyProgress(key, { min: ratioText(ref.min), max: ratioText(ref.max) }), caveat: tBodyProgress(CAVEAT_TEXT[ref.caveat]) };
    }
    case 'none':
      return { line: tBodyProgress(ref.reason === 'no-sex' ? 'refNone_noSex' : 'refNone_noReference'), caveat: null };
  }
}

function RatioItem({ ratio, sex }: { readonly ratio: BodyRatio; readonly sex: Sex | null }) {
  const { current, evolution, height } = ratio;
  const ref = current.status === 'known' ? referenceText(ratioReference(ratio.kind, current.value, sex), sex) : null;
  return (
    <li className="ct-bodyprogress__insight">
      <span className="ct-bodyprogress__insightname">{tBodyProgress(RATIO_TEXT[ratio.kind])}</span>
      {current.status === 'known' ? <span className="ct-bodyprogress__insightvalue">{ratioText(current.value)}</span> : <span className="ct-today__muted">{tBodyProgress(UNKNOWN_TEXT[current.reason])}</span>}
      {current.status === 'known' ? (
        <span className="ct-today__muted">
          {evolution.status === 'known'
            ? evolution.delta === 0
              ? tBodyProgress('ratioEvolutionSame', { date: formatDayMonthYear(evolution.from) })
              : tBodyProgress('ratioEvolution', { delta: signedRatio(evolution.delta), date: formatDayMonthYear(evolution.from) })
            : tBodyProgress('ratioEvolutionUnknown')}
        </span>
      ) : null}
      {ref === null ? null : <span className="ct-today__text">{ref.line}</span>}
      {ref?.caveat ? <span className="ct-today__muted">{ref.caveat}</span> : null}
      {height === null ? null : <span className="ct-today__muted">{tBodyProgress(height.source === 'profile' ? 'ratioHeight_profile' : 'ratioHeight_health', { cm: formatCm(height.cm) })}</span>}
      {height?.healthDiffers ? <span className="ct-today__muted">{tBodyProgress('ratioHeightDiffers')}</span> : null}
    </li>
  );
}

export function RatiosCard({ ratios, sex }: { readonly ratios: Readonly<Record<BodyRatioKind, BodyRatio>>; readonly sex: Sex | null }) {
  return (
    <section className="ct-bodyprogress__card ct-flat" aria-labelledby="ct-bodyprogress-ratios">
      <h3 id="ct-bodyprogress-ratios" className="ct-bodyprogress__heading ct-section-title">
        {tBodyProgress('ratiosTitle')}
      </h3>
      <p className="ct-today__muted">{tBodyProgress('ratiosHint')}</p>
      <ul className="ct-bodyprogress__insights">
        {BODY_RATIOS.map((kind) => (
          <RatioItem key={kind} ratio={ratios[kind]} sex={sex} />
        ))}
      </ul>
    </section>
  );
}

const PAIR_TEXT: Record<SymmetryPair, BodyProgressPlainKey> = { arm: 'pair_arm', thigh: 'pair_thigh', calf: 'pair_calf' };

function SymmetryItem({ value }: { readonly value: Symmetry }) {
  return (
    <li className="ct-bodyprogress__insight" data-flagged={value.status === 'known' && value.flagged ? 'true' : undefined}>
      <span className="ct-bodyprogress__insightname">{tBodyProgress(PAIR_TEXT[value.pair])}</span>
      {value.status === 'unknown' ? (
        <span className="ct-today__muted">{tBodyProgress(value.reason === 'gap' ? 'symmetryGap' : 'symmetryMissing')}</span>
      ) : (
        <>
          <span className="ct-bodyprogress__insightvalue">{tBodyProgress('symmetryKnown', { cm: formatCm(value.diffCm), pct: formatCm(value.diffPct) })}</span>
          <span className="ct-today__muted">{value.larger === null ? tBodyProgress('symmetryEqual') : tBodyProgress(value.larger === 'left' ? 'symmetryLarger_left' : 'symmetryLarger_right')}</span>
          {value.flagged ? (
            <span className="ct-bodyprogress__flag">
              <span className="ct-bodyprogress__mark ct-bodyprogress__mark--unfavorable" aria-hidden="true" />
              {tBodyProgress('symmetryFlag')}
            </span>
          ) : null}
        </>
      )}
    </li>
  );
}

export function SymmetryCard({ values }: { readonly values: Readonly<Record<SymmetryPair, Symmetry>> }) {
  return (
    <section className="ct-bodyprogress__card ct-flat" aria-labelledby="ct-bodyprogress-symmetry">
      <h3 id="ct-bodyprogress-symmetry" className="ct-bodyprogress__heading ct-section-title">
        {tBodyProgress('symmetryTitle')}
      </h3>
      <p className="ct-today__muted">{tBodyProgress('symmetryHint')}</p>
      <ul className="ct-bodyprogress__insights">
        {SYMMETRY_PAIRS.map((pair) => (
          <SymmetryItem key={pair} value={values[pair]} />
        ))}
      </ul>
    </section>
  );
}
