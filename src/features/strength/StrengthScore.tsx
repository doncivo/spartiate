import { useEffect, useState } from 'react';
import { currentBodyweightKg } from '../../domain/training/bodyweight';
import { strengthScore, type GroupNoneReason, type GroupScore, type ScoreBound, type StrengthExercise, type StrengthGroup, type StrengthResult, type StrengthStandards, type StrengthTier } from '../../domain/training/strengthScore';
import type { Sex } from '../../domain/bodyProfile';
import { formatStrengthKg, tStrength, type StrengthTextKey } from '../../i18n/strengthText';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useSyncedData } from '../sync/remoteChanges';
import './StrengthScore.css';

/**
 * Progrès › Strength Score (PRD § 17.1 ; STR-01, D-310 à D-313 ; proposition docs/maquettes/propositions/strength-score/). Score par 8 groupes
 * à partir des 1RM estimés des mouvements de référence du catalogue (`strengthStandardKey`), ajusté au sexe du profil et au poids de corps
 * (tendance des pesées), sur les normes embarquées (content/strength/standards.json, attribution visible exigée par la licence). Un groupe sans
 * donnée s'écrit « — » avec sa raison, jamais 0. Bloc chargé à la demande avec son catalogue de textes et ses normes (jamais dans le départ).
 */

interface StandardsFile extends StrengthStandards {
  readonly source: { readonly dataset: string; readonly dataVersion: string };
}

interface Loaded {
  readonly result: StrengthResult;
  readonly sex: Sex | null;
  readonly bodyweightKg: number | null;
  readonly source: StandardsFile['source'];
}

type Load = { readonly status: 'loading' } | { readonly status: 'failed' } | ({ readonly status: 'ready' } & Loaded);

const GROUP_KEY: Readonly<Record<StrengthGroup, StrengthTextKey>> = {
  chest: 'groupChest',
  back: 'groupBack',
  shoulders: 'groupShoulders',
  biceps: 'groupBiceps',
  triceps: 'groupTriceps',
  quads: 'groupQuads',
  hamstrings: 'groupHamstrings',
  glutes: 'groupGlutes',
};
const TIER_KEY: Readonly<Record<StrengthTier, StrengthTextKey>> = { iron: 'tierIron', bronze: 'tierBronze', silver: 'tierSilver', gold: 'tierGold' };
const REASON_KEY: Readonly<Record<Exclude<GroupNoneReason, 'noSession'>, StrengthTextKey>> = { noSex: 'reasonSex', noBodyweight: 'reasonBodyweight', noStandard: 'reasonStandard' };

const scoreText = (score: number, bound: ScoreBound): string => (bound === 'below' ? tStrength('below') : bound === 'above' ? tStrength('above') : String(score));

function reasonText(g: Extract<GroupScore, { kind: 'none' }>): string {
  if (g.reason !== 'noSession') return tStrength(REASON_KEY[g.reason]);
  if (g.references.length === 0) return tStrength('reasonSessionNone');
  return tStrength('reasonSession', { names: [...new Set(g.references)].sort((a, b) => a.localeCompare(b, 'fr')).join(', ') });
}

/** Lecture : normes et catalogue embarqués, profil, pesées, historique clos de chaque exercice de référence. */
async function load(access: ReturnType<typeof useAppContainer>['data']): Promise<Loaded> {
  const [standardsModule, catalogModule, profileRepo, weightsRepo, progression] = await Promise.all([
    import('../../../content/strength/standards.json'),
    import('../../../content/exercises/exercises.json'),
    access.repos.profile(),
    access.repos.bodyWeights(),
    access.repos.progression(),
  ]);
  const standards = standardsModule.default as unknown as StandardsFile;
  const catalog = catalogModule.default.exercises as readonly { readonly id: string; readonly nameFr: string; readonly strengthStandardKey: string | null }[];
  const [profile, weights] = await Promise.all([profileRepo.get(), weightsRepo.listRecent(400)]);
  const keyed = catalog.filter((x): x is typeof x & { readonly strengthStandardKey: string } => x.strengthStandardKey !== null);
  const exercises: StrengthExercise[] = await Promise.all(keyed.map(async (x) => ({ id: x.id, nameFr: x.nameFr, key: x.strengthStandardKey, history: await progression.history(x.id) })));
  const sex = profile?.sex ?? null;
  const bodyweightKg = currentBodyweightKg(weights.map((w) => ({ date: w.date, kg: w.kg })));
  return { result: strengthScore({ sex, bodyweightKg, standards, exercises }), sex, bodyweightKg, source: standards.source };
}

function GroupRow({ g }: { readonly g: GroupScore }) {
  const id = `ct-strength-group-${g.group}`;
  return (
    <li className="ct-strength__row" aria-labelledby={id}>
      <span id={id} className="ct-strength__name">
        {tStrength(GROUP_KEY[g.group])}
      </span>
      <span className="ct-strength__bar" aria-hidden="true">
        {g.kind === 'value' ? <i className="ct-strength__fill" style={{ width: `${String(g.score)}%` }} /> : null}
      </span>
      <span className="ct-strength__value">{g.kind === 'value' ? scoreText(g.score, g.bound) : tStrength('none')}</span>
      <span className="ct-strength__detail">{g.kind === 'value' ? tStrength('liftLine', { name: g.lift.nameFr, kg: formatStrengthKg(g.lift.oneRmKg) }) : reasonText(g)}</span>
    </li>
  );
}

function Ready({ data }: { readonly data: Loaded }) {
  const { result, sex, bodyweightKg, source } = data;
  const wc = result.weightClass;
  return (
    <>
      {sex === null ? (
        <div className="ct-strength__notice" role="status">
          <p>{tStrength('noSex')}</p>
          <p className="ct-today__muted">{tStrength('noSexHint')}</p>
        </div>
      ) : bodyweightKg === null ? (
        <div className="ct-strength__notice" role="status">
          <p>{tStrength('noBodyweight')}</p>
          <p className="ct-today__muted">{tStrength('noBodyweightHint')}</p>
        </div>
      ) : (
        <div className="ct-strength__hero">
          {result.global !== null ? (
            <p className="ct-strength__global">
              <span className="ct-strength__global-value">{String(result.global.score)}</span>{' '}
              <span className="ct-strength__global-label">
                {tStrength('globalLine', { tier: tStrength(TIER_KEY[result.global.tier]), counted: tStrength(result.global.counted === 1 ? 'groupOne' : 'groupMany', { n: result.global.counted }) })}
              </span>
            </p>
          ) : null}
          {wc !== null ? (
            <p className="ct-strength__context">
              {tStrength('context', {
                kg: formatStrengthKg(bodyweightKg),
                sex: tStrength(sex === 'male' ? 'sexMale' : 'sexFemale'),
                range: wc.upToKg !== null ? tStrength('rangeUpTo', { kg: String(wc.upToKg) }) : tStrength('rangeAbove', { kg: String(wc.aboveKg ?? 0) }),
              })}
            </p>
          ) : null}
        </div>
      )}
      <ul className="ct-strength__list">
        {result.groups.map((g) => (
          <GroupRow key={g.group} g={g} />
        ))}
      </ul>
      <p className="ct-strength__foot">{tStrength('method')}</p>
      <p className="ct-strength__foot">{tStrength('attribution', { dataset: source.dataset, date: source.dataVersion.split('-').reverse().join('/') })}</p>
    </>
  );
}

export function StrengthScore() {
  const container = useAppContainer();
  const synced = useSyncedData(['workout', 'workout_set', 'profile', 'body_weight']);
  const [state, setState] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    load(container.data).then(
      (data) => {
        if (live) setState({ status: 'ready', ...data });
      },
      () => {
        if (live) setState({ status: 'failed' });
      },
    );
    return () => {
      live = false;
    };
  }, [container, synced, attempt]);

  return (
    <section className="ct-today__card ct-strength ct-flat" aria-labelledby="ct-strength-title">
      <h2 id="ct-strength-title" className="ct-today__eyebrow ct-strength__title ct-section-title">
        {tStrength('title')}
      </h2>
      <p className="ct-today__muted ct-strength__subtitle">{tStrength('subtitle')}</p>
      {state.status === 'loading' ? (
        <p className="ct-today__muted" role="status">
          {tStrength('loading')}
        </p>
      ) : state.status === 'failed' ? (
        <div role="alert">
          <p>{tStrength('loadFailed')}</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            {tStrength('retry')}
          </Button>
        </div>
      ) : (
        <Ready data={state} />
      )}
    </section>
  );
}
