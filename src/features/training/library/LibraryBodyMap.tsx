import { tTraining } from '../../../i18n/trainingText';

/**
 * SEANCE-0292b (BL-111, § 14.2 b) : carte du corps de la bibliothèque. Silhouettes avant et arrière, une zone par groupe musculaire
 * d'affichage du contenu (11 groupes) ; un toucher choisit le groupe du filtre « Groupe musculaire », un second le retire. Les silhouettes
 * sont un REFLET masqué aux technologies d'assistance : la saisie accessible reste la liste « Groupe musculaire » (D-538). Géométrie reprise
 * de la body map de l'onboarding (même tracé), copiée ici pour ne pas charger le catalogue de textes de l'onboarding avec la bibliothèque.
 */

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

function Silhouette({ zones, selected, onTouch, label }: { readonly zones: readonly Zone[]; readonly selected: string; readonly onTouch: (group: string) => void; readonly label: string }) {
  return (
    <div className="ct-training__silhouette">
      <svg viewBox="0 0 100 200" focusable="false">
        <path className="ct-training__outline" d={OUTLINE} />
        {zones.map((zone, i) => (
          <path key={`${zone.group}-${String(i)}`} className="ct-training__zone" data-group={zone.group} data-state={zone.group === selected ? 'selected' : 'normal'} d={zone.d} onClick={() => onTouch(zone.group)} />
        ))}
      </svg>
      <span className="ct-training__silhouette-label">{label}</span>
    </div>
  );
}

/** `groups` : groupes du contenu (une zone sans groupe connu ne fait rien) ; `selected` : groupe choisi ('' : tous). */
export function LibraryBodyMap({ groups, selected, onChange }: { readonly groups: readonly string[]; readonly selected: string; readonly onChange: (group: string) => void }) {
  const touch = (group: string): void => {
    if (!groups.includes(group)) return;
    onChange(group === selected ? '' : group);
  };
  return (
    <div className="ct-training__bodymap" aria-hidden="true">
      <Silhouette zones={FRONT} selected={selected} onTouch={touch} label={tTraining('bodyMapFront')} />
      <Silhouette zones={BACK} selected={selected} onTouch={touch} label={tTraining('bodyMapBack')} />
    </div>
  );
}
