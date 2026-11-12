import { tOnboarding } from '../../i18n/onboardingText';

/**
 * Body map (maquette iPhone-Onboarding, étape 6) : silhouettes avant et arrière, REFLET visuel des muscles choisis ; les zones sont
 * tactiles à la souris et au doigt, mais la saisie accessible (clavier, lecteur d'écran) est la liste de boutons juste dessous : les
 * silhouettes sont donc masquées aux technologies d'assistance. Chaque état est aussi dit en texte (jamais la couleur seule).
 */
type State = 'normal' | 'priority' | 'avoided';

interface Zone {
  readonly group: string;
  readonly d: string;
}

const FRONT: readonly Zone[] = [
  { group: 'chest', d: 'M31 36h18v14c-6 3-14 3-18-1zM51 36h18v13c-4 4-12 4-18 1z' },
  { group: 'shoulders', d: 'M24 36c3-3 8-4 12-3l-2 12-10 1z' },
  { group: 'shoulders', d: 'M76 36c-3-3-8-4-12-3l2 12 10 1z' },
  { group: 'biceps', d: 'M22 50l9-1-2 22-8-1z' },
  { group: 'biceps', d: 'M78 50l-9-1 2 22 8-1z' },
  { group: 'forearms', d: 'M20 73l8 1-3 22-6-1z' },
  { group: 'forearms', d: 'M80 73l-8 1 3 22 6-1z' },
  { group: 'abs', d: 'M38 52h24v34c-5 3-19 3-24 0z' },
  { group: 'quadriceps', d: 'M34 92l14 2v44l-10 6c-4-14-6-32-4-52z' },
  { group: 'quadriceps', d: 'M66 92l-14 2v44l10 6c4-14 6-32 4-52z' },
  { group: 'calves', d: 'M38 148l8-2 1 30-7 2z' },
  { group: 'calves', d: 'M62 148l-8-2-1 30 7 2z' },
];

const BACK: readonly Zone[] = [
  { group: 'shoulders', d: 'M24 36c3-3 8-4 12-3l-2 12-10 1z' },
  { group: 'shoulders', d: 'M76 36c-3-3-8-4-12-3l2 12 10 1z' },
  { group: 'back', d: 'M32 46l18 4 18-4v34c-10 6-26 6-36 0z' },
  { group: 'triceps', d: 'M22 50l9-1-2 22-8-1z' },
  { group: 'triceps', d: 'M78 50l-9-1 2 22 8-1z' },
  { group: 'glutes', d: 'M34 94h15v18c-6 2-12 1-16-3zM51 94h15l1 15c-4 4-10 5-16 3z' },
  { group: 'hamstrings', d: 'M35 115l13-1v30l-9 2c-3-9-5-20-4-31z' },
  { group: 'hamstrings', d: 'M65 115l-13-1v30l9 2c3-9 5-20 4-31z' },
  { group: 'calves', d: 'M38 150l8-2 1 28-7 2z' },
  { group: 'calves', d: 'M62 150l-8-2-1 28 7 2z' },
];

const OUTLINE =
  'M50 6c-6 0-10 5-10 11s4 11 10 11 10-5 10-11-4-11-10-11zM40 30c-6 2-14 6-16 12l-6 34 6 1 5-24-1 22-3 42 6 30 1 40 8 0 3-38 5-30h4l5 30 3 38 8 0 1-40 6-30-3-42-1-22 5 24 6-1-6-34c-2-6-10-10-16-12z';

function Silhouette({ zones, states, onTouch, label }: { readonly zones: readonly Zone[]; readonly states: Readonly<Record<string, State>>; readonly onTouch: (group: string) => void; readonly label: string }) {
  return (
    <div className="ct-onb__silhouette" aria-hidden="true">
      <svg viewBox="0 0 100 200" focusable="false">
        <path className="ct-onb__outline" d={OUTLINE} />
        {zones.map((zone, i) => (
          <path key={`${zone.group}-${String(i)}`} className="ct-onb__zone" data-state={states[zone.group] ?? 'normal'} d={zone.d} onClick={() => onTouch(zone.group)} />
        ))}
      </svg>
      <span className="ct-onb__silhouetteLabel">{label}</span>
    </div>
  );
}

export function BodyMap({ states, onTouch }: { readonly states: Readonly<Record<string, State>>; readonly onTouch: (group: string) => void }) {
  return (
    <div className="ct-onb__map">
      <Silhouette zones={FRONT} states={states} onTouch={onTouch} label={tOnboarding('bodyFront')} />
      <Silhouette zones={BACK} states={states} onTouch={onTouch} label={tOnboarding('bodyBack')} />
    </div>
  );
}
