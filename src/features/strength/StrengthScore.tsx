import { useEffect, useState } from 'react';
import { STRENGTH_SCORE_VERSION } from '../../domain/training/config';
import { strengthScore, type GroupScore, type ReferenceLift, type StrengthExercise, type StrengthGroup, type StrengthLevel, type StrengthResult, type UnknownReason } from '../../domain/training/strengthScore';
import type { Sex } from '../../domain/bodyProfile';
import type { LocalDate } from '../../domain/types';
import { formatStrengthDate, formatStrengthKg, tStrength, type StrengthPlainKey } from '../../i18n/strengthText';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useSyncedData } from '../sync/remoteChanges';
import { groupCountKey } from './groupCount';
import './StrengthScore.css';

/**
 * Progrès › Force : Strength Score maison (PRD § 17.1 ; STR-0300, BL-174, D-675). Score par 8 groupes à partir des e1RM des mouvements de
 * référence du catalogue (`strengthStandardKey`, content/strength/standards.json), ramenés à 80 kg de poids de corps (tendance des pesées) et
 * placés entre les seuils du sexe du profil (config.ts, proposition Q-42). Un groupe sans donnée s'écrit « inconnu » avec sa raison, jamais 0.
 * Bloc chargé à la demande avec son catalogue de textes et ses mouvements de référence (jamais dans le départ) ; carte en un seul bloc.
 */

interface Loaded {
  readonly result: StrengthResult;
  readonly sex: Sex | null;
}

type Load = { readonly status: 'loading' } | { readonly status: 'failed' } | ({ readonly status: 'ready' } & Loaded);

const GROUP_KEY: Readonly<Record<StrengthGroup, StrengthPlainKey>> = {
  chest: 'groupChest',
  back: 'groupBack',
  shoulders: 'groupShoulders',
  biceps: 'groupBiceps',
  triceps: 'groupTriceps',
  quads: 'groupQuads',
  hamstrings: 'groupHamstrings',
  glutes: 'groupGlutes',
};
const LEVEL_KEY: Readonly<Record<StrengthLevel, StrengthPlainKey>> = {
  beginner: 'levelBeginner',
  novice: 'levelNovice',
  intermediate: 'levelIntermediate',
  advanced: 'levelAdvanced',
  elite: 'levelElite',
};
const REASON_KEY: Readonly<Record<Exclude<UnknownReason, 'noSession'>, StrengthPlainKey>> = { noSex: 'reasonSex', noBodyweight: 'reasonBodyweight', noReference: 'reasonReference' };

const levelText = (level: StrengthLevel): string => tStrength(LEVEL_KEY[level]);

function reasonText(g: Extract<GroupScore, { kind: 'unknown' }>): string {
  if (g.reason !== 'noSession') return tStrength(REASON_KEY[g.reason]);
  if (g.references.length === 0) return tStrength('reasonSessionNone');
  return tStrength('reasonSession', { names: [...new Set(g.references)].sort((a, b) => a.localeCompare(b, 'fr')).join(', ') });
}

interface ReferenceFile {
  readonly lifts: readonly ReferenceLift[];
}

/** Lecture : mouvements de référence et catalogue embarqués, profil, pesées, historique clos de chaque exercice de référence. */
async function load(access: ReturnType<typeof useAppContainer>['data']): Promise<Loaded> {
  const [referenceModule, catalogModule, profileRepo, weightsRepo, progression] = await Promise.all([
    import('../../../content/strength/standards.json'),
    import('../../../content/exercises/exercises.json'),
    access.repos.profile(),
    access.repos.bodyWeights(),
    access.repos.progression(),
  ]);
  const reference = referenceModule.default as unknown as ReferenceFile;
  const catalog = catalogModule.default.exercises as readonly { readonly id: string; readonly nameFr: string; readonly strengthStandardKey: string | null }[];
  const [profile, weights] = await Promise.all([profileRepo.get(), weightsRepo.listRecent(400)]);
  const keyed = catalog.filter((x): x is typeof x & { readonly strengthStandardKey: string } => x.strengthStandardKey !== null);
  const exercises: StrengthExercise[] = await Promise.all(keyed.map(async (x) => ({ id: x.id, nameFr: x.nameFr, key: x.strengthStandardKey, history: await progression.history(x.id) })));
  const sex = profile?.sex ?? null;
  const weighIns = weights.map((w) => ({ date: w.date as LocalDate, kg: w.kg }));
  return { result: strengthScore({ sex, weighIns, lifts: reference.lifts, exercises }), sex };
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
      <span className="ct-strength__value">{g.kind === 'value' ? String(g.score) : tStrength('unknown')}</span>
      <span className="ct-strength__detail">{g.kind === 'value' ? tStrength('groupLine', { level: levelText(g.level), name: g.lift.nameFr }) : reasonText(g)}</span>
    </li>
  );
}

function Ready({ data }: { readonly data: Loaded }) {
  const { result, sex } = data;
  const bodyweightKg = result.bodyweightKg;
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
                {tStrength('globalLine', { level: levelText(result.global.level), counted: tStrength(groupCountKey(result.global.counted), { n: result.global.counted }) })}
              </span>
            </p>
          ) : null}
          <p className="ct-strength__context">{tStrength('context', { kg: formatStrengthKg(bodyweightKg), sex: tStrength(sex === 'male' ? 'sexMale' : 'sexFemale') })}</p>
          {result.frozenSince !== null ? (
            <p className="ct-strength__context" role="status">
              {tStrength(result.bodyweightFrozen ? 'frozen' : 'frozenNoWeight', { date: formatStrengthDate(result.frozenSince) })}
            </p>
          ) : null}
        </div>
      )}
      <ul className="ct-strength__list">
        {result.groups.map((g) => (
          <GroupRow key={g.group} g={g} />
        ))}
      </ul>
      {sex !== null && bodyweightKg !== null ? (
        <>
          <h3 id="ct-strength-lifts" className="ct-strength__subhead">
            {tStrength('liftsTitle')}
          </h3>
          {result.lifts.length > 0 ? (
            <ul className="ct-strength__lifts" aria-labelledby="ct-strength-lifts">
              {result.lifts.map((l) => (
                <li key={l.key} className="ct-strength__detail">
                  {tStrength('liftLine', { name: l.nameFr, kg: formatStrengthKg(l.e1rmKg), rel: formatStrengthKg(l.relativeKg), score: l.score, level: levelText(l.level) })}
                </li>
              ))}
            </ul>
          ) : (
            <p className="ct-strength__detail">{tStrength('liftsNone')}</p>
          )}
        </>
      ) : null}
      <h3 className="ct-strength__subhead">{tStrength('methodTitle')}</h3>
      <p className="ct-strength__foot">{tStrength('methodE1rm')}</p>
      <p className="ct-strength__foot">{tStrength('methodRelative')}</p>
      <p className="ct-strength__foot">{tStrength('methodScore')}</p>
      <p className="ct-strength__foot">{tStrength('methodUnknown')}</p>
      <p className="ct-strength__foot">{tStrength('version', { v: STRENGTH_SCORE_VERSION })}</p>
    </>
  );
}

export function StrengthScore() {
  const container = useAppContainer();
  const synced = useSyncedData(['workout', 'workout_set', 'profile', 'body_weight', 'recommendation_decision']);
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
