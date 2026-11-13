import { useState } from 'react';
import { EQUIPMENT_PROFILE_KINDS, validateEquipmentProfile, type EquipmentInventory, type EquipmentProfileKind, type StackRange } from '../../domain/training';
import type { IdGenerator } from '../../domain/id';
import type { DataAccess } from '../../db/repositories/dataAccess';
import { formatNumber, parseNumber, tTraining, type TrainingTextKey } from '../../i18n/trainingText';
import { Button, ConfirmDialog, SectionTitle, SegmentedControl, Switch } from '../../ui';
import { duplicateEmbeddedProfile } from './content';
import { PROFILE_KIND_KEY } from './labels';
import { setActiveProfile, type AnyProfile, type PersonalProfile, type TrainingData } from './trainingState';

/**
 * Écran « Matériel » (§ 14.3, maquette PC-Materiel) : profils embarqués (lecture seule, à dupliquer) et personnels (modifiables, publiés), profil
 * actif de CET appareil (réglage local). Les valeurs marquées « à vérifier en salle » le sont en texte, jamais par la seule couleur.
 */

const INCREMENT_KEYS = [
  ['barbell', 'incrementBarbell'],
  ['dumbbell', 'incrementDumbbell'],
  ['kettlebell', 'incrementKettlebell'],
  ['machine', 'incrementMachine'],
  ['cable', 'incrementCable'],
] as const satisfies readonly (readonly [string, TrainingTextKey])[];

const kg = (n: number): string => tTraining('kg', { n: formatNumber(n) });
const range = (r: StackRange): string => tTraining('rangeKg', { min: formatNumber(r.minKg), max: formatNumber(r.maxKg), step: formatNumber(r.stepKg) });

function VerifyTag({ show }: { readonly show: boolean }) {
  return show ? <span className="ct-training__badge ct-training__badge--warn">{tTraining('toVerify')}</span> : null;
}

function verifyLabel(key: string): string {
  if (key.startsWith('barbell:')) return key.slice('barbell:'.length);
  const known: Readonly<Record<string, TrainingTextKey>> = { plates: 'platesCountUnknown', dumbbells: 'dumbbells', kettlebells: 'kettlebells', machines: 'machines', cables: 'cables' };
  const k = known[key];
  return k ? tTraining(k) : key;
}

/** Ligne « libellé · valeur » d'un bloc du profil (aperçu PC-Materiel-apres), valeur en chiffres tabulaires, « à vérifier » en texte. */
function Row({ label, value, verify = false }: { readonly label: string; readonly value: string; readonly verify?: boolean }) {
  return (
    <div className="ct-equipment__row">
      <dt>{label}</dt>
      <dd>
        <span className="ct-training__num">{value}</span> <VerifyTag show={verify} />
      </dd>
    </div>
  );
}

/**
 * ERGO-02 (aperçu PC-Materiel-apres) : profil ouvert à plat, sans cartes. Trois colonnes (barres ; haltères et kettlebells ; crans), disques par
 * côté de barre en barres proportionnelles, machines à stack et poulies, matériel disponible. Une donnée absente : « Aucun ».
 */
function Inventory({ data, profile }: { readonly data: TrainingData; readonly profile: AnyProfile }) {
  const inv = profile.inventory;
  const check = new Set(inv.toVerify ?? []);
  const names = new Map(data.content.equipment.map((e) => [e.id, e]));
  const families = new Map<string, string[]>();
  for (const id of inv.available) {
    const entry = names.get(id);
    const family = entry?.family ?? '';
    families.set(family, [...(families.get(family) ?? []), entry?.nameFr ?? id]);
  }
  const machinesRange = profile.origin === 'embedded' ? profile.machinesRange : null;
  const heaviestPlate = Math.max(1, ...inv.platesPerSideKg.map((p) => p.weightKg));
  const platesUnknown = check.has('plates');
  const increments = INCREMENT_KEYS.filter(([key]) => profile.increments[key] !== undefined);
  const stacks = [
    ...inv.machines.map((m) => ({ key: `m-${m.equipmentId}`, label: names.get(m.equipmentId)?.nameFr ?? m.equipmentId, value: range({ minKg: m.stackMinKg, maxKg: m.stackMaxKg, stepKg: m.stepKg }) })),
    ...(inv.machines.length === 0 && machinesRange ? [{ key: 'machines', label: tTraining('machines'), value: range(machinesRange) }] : []),
    ...inv.cables.map((c, i) => ({ key: `c-${String(i)}`, label: tTraining('cables'), value: range(c) })),
  ];
  return (
    <div className="ct-training__inventory">
      <div className="ct-equipment__columns">
        <section className="ct-equipment__block">
          <SectionTitle level={3}>{tTraining('barbells')}</SectionTitle>
          {inv.barbells.length === 0 ? (
            <p className="ct-training__muted">{tTraining('none')}</p>
          ) : (
            <dl className="ct-equipment__rows">
              {inv.barbells.map((b) => (
                <Row key={`${b.type}-${String(b.weightKg)}`} label={b.type} value={kg(b.weightKg)} verify={check.has(`barbell:${b.type}`)} />
              ))}
            </dl>
          )}
          {[...check].filter((k) => k.startsWith('barbell:') && !inv.barbells.some((b) => `barbell:${b.type}` === k)).map((k) => (
            <p key={k}>
              {verifyLabel(k)} <VerifyTag show />
            </p>
          ))}
        </section>
        <section className="ct-equipment__block">
          <SectionTitle level={3}>{tTraining('equipmentDumbbellsKettlebells')}</SectionTitle>
          <dl className="ct-equipment__rows">
            <Row label={tTraining('dumbbells')} value={inv.dumbbells ? tTraining('equipmentDumbbellRange', { min: formatNumber(inv.dumbbells.minKg), max: formatNumber(inv.dumbbells.maxKg) }) : tTraining('none')} verify={check.has('dumbbells')} />
            {inv.dumbbells ? <Row label={tTraining('equipmentStep')} value={kg(inv.dumbbells.stepKg)} /> : null}
            <Row label={tTraining('kettlebells')} value={inv.kettlebellsKg.length === 0 ? tTraining('none') : inv.kettlebellsKg.map(formatNumber).join(' · ')} verify={check.has('kettlebells')} />
          </dl>
        </section>
        <section className="ct-equipment__block">
          <SectionTitle level={3}>{tTraining('equipmentIncrements')}</SectionTitle>
          {increments.length === 0 ? (
            <p className="ct-training__muted">{tTraining('none')}</p>
          ) : (
            <dl className="ct-equipment__rows">
              {increments.map(([key, label]) => (
                <Row key={key} label={tTraining(label)} value={formatNumber(profile.increments[key] ?? 0)} />
              ))}
            </dl>
          )}
          {inv.bodyweight ? <p className="ct-training__muted">{tTraining('bodyweightYes')}</p> : null}
        </section>
      </div>
      <section className="ct-equipment__block">
        <SectionTitle level={3} id={`ct-plates-${profile.id}`}>
          {tTraining('equipmentPlates')}
        </SectionTitle>
        {inv.platesPerSideKg.length === 0 ? (
          <p className="ct-training__muted">{tTraining('none')}</p>
        ) : (
          <ul className="ct-equipment__plates" aria-labelledby={`ct-plates-${profile.id}`}>
            {inv.platesPerSideKg.map((p) => (
              <li key={p.weightKg} className="ct-equipment__plate">
                <span className="ct-equipment__plate-bar" aria-hidden="true" style={{ blockSize: `${(1.5 + 6 * (p.weightKg / heaviestPlate)).toFixed(2)}rem` }} />
                <span className="ct-training__num">{tTraining('equipmentPlate', { n: formatNumber(p.weightKg) })}</span>
                {platesUnknown ? null : <span className="ct-training__muted ct-training__num">{tTraining('equipmentPlateCount', { n: p.count })}</span>}
              </li>
            ))}
          </ul>
        )}
        {platesUnknown ? (
          <p className="ct-training__muted">
            {tTraining('platesCountUnknown')} : {tTraining('equipmentPlateCountUnknown')} <VerifyTag show />
          </p>
        ) : null}
      </section>
      <section className="ct-equipment__block">
        <SectionTitle level={3}>{tTraining('equipmentStacks')}</SectionTitle>
        {stacks.length === 0 ? (
          <p className="ct-training__muted">{tTraining('none')}</p>
        ) : (
          <dl className="ct-equipment__rows">
            {stacks.map((s) => (
              <Row key={s.key} label={s.label} value={s.value} />
            ))}
          </dl>
        )}
        {check.has('machines') || check.has('cables') ? (
          <p className="ct-training__muted">
            {[check.has('machines') ? tTraining('machines') : null, check.has('cables') ? tTraining('cables') : null].filter((x) => x !== null).join(', ')} <VerifyTag show />
          </p>
        ) : null}
      </section>
      <section className="ct-equipment__block">
        <SectionTitle level={3}>{tTraining('availableEquipment')}</SectionTitle>
        {[...families.values()].map((list) => (
          <p key={list.join('|')}>{list.join(', ')}</p>
        ))}
      </section>
    </div>
  );
}

const listText = (values: readonly number[]): string => values.map(formatNumber).join(' ; ');
function parseList(text: string): number[] | null {
  const parts = text
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p !== '');
  const values = parts.map(parseNumber);
  return values.every((v): v is number => v !== null && v > 0) ? values : null;
}

interface EditProps {
  readonly data: TrainingData;
  readonly access: DataAccess;
  readonly profile: PersonalProfile;
  readonly onDone: (saved: boolean) => void;
}

function ProfileForm({ data, access, profile, onDone }: EditProps) {
  const inv = profile.inventory;
  const [name, setName] = useState(profile.name);
  const [kind, setKind] = useState<EquipmentProfileKind>(profile.kind);
  const [bodyweight, setBodyweight] = useState(inv.bodyweight);
  const [available, setAvailable] = useState<readonly string[]>(inv.available);
  const [dMin, setDMin] = useState(inv.dumbbells ? formatNumber(inv.dumbbells.minKg) : '');
  const [dMax, setDMax] = useState(inv.dumbbells ? formatNumber(inv.dumbbells.maxKg) : '');
  const [dStep, setDStep] = useState(inv.dumbbells ? formatNumber(inv.dumbbells.stepKg) : '');
  const [plates, setPlates] = useState(listText(inv.platesPerSideKg.map((p) => p.weightKg)));
  const [kettlebells, setKettlebells] = useState(listText(inv.kettlebellsKg));
  const [increments, setIncrements] = useState<Readonly<Record<string, string>>>(Object.fromEntries(INCREMENT_KEYS.map(([key]) => [key, profile.increments[key] === undefined ? '' : formatNumber(profile.increments[key])])));
  const [toVerify, setToVerify] = useState<readonly string[]>(inv.toVerify ?? []);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    const plateList = parseList(plates);
    const kbList = parseList(kettlebells);
    const anyDumbbell = [dMin, dMax, dStep].some((t) => t.trim() !== '');
    const dumbbells = anyDumbbell ? { minKg: parseNumber(dMin) ?? Number.NaN, maxKg: parseNumber(dMax) ?? Number.NaN, stepKg: parseNumber(dStep) ?? Number.NaN } : null;
    const inc: Record<string, number> = {};
    let badIncrement = false;
    for (const [key] of INCREMENT_KEYS) {
      const text = increments[key] ?? '';
      if (text.trim() === '') continue;
      const value = parseNumber(text);
      if (value === null) badIncrement = true;
      else inc[key] = value;
    }
    const previousCounts = new Map(inv.platesPerSideKg.map((p) => [p.weightKg, p.count]));
    const inventory: EquipmentInventory = {
      ...inv,
      available,
      bodyweight,
      dumbbells,
      platesPerSideKg: (plateList ?? []).map((weightKg) => ({ weightKg, count: previousCounts.get(weightKg) ?? 1 })),
      kettlebellsKg: kbList ?? [],
      toVerify,
    };
    const input = { name: name.trim(), kind, inventory, increments: inc };
    if (plateList === null || kbList === null || badIncrement || validateEquipmentProfile(input).length > 0) {
      setError(tTraining('errorProfile'));
      return;
    }
    try {
      await (await access.repos.equipmentProfiles()).update(profile.id, input);
      onDone(true);
    } catch {
      setError(tTraining('saveError'));
    }
  }

  return (
    <form
      className="ct-training__form"
      aria-labelledby="ct-profile-form-title"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h2 id="ct-profile-form-title" className="ct-training__heading">
        {tTraining('editProfile')}
      </h2>
      <label className="ct-training__field">
        <span className="ct-training__label">{tTraining('profileName')}</span>
        <input className="ct-training__input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="ct-training__field">
        <span className="ct-training__label">{tTraining('profileKind')}</span>
        <SegmentedControl label={tTraining('profileKind')} value={kind} onChange={setKind} options={EQUIPMENT_PROFILE_KINDS.map((k) => ({ value: k, label: tTraining(PROFILE_KIND_KEY[k]) }))} />
      </div>
      <div className="ct-training__switch-row">
        <span>{tTraining('bodyweightYes')}</span>
        <Switch checked={bodyweight} onChange={setBodyweight} label={tTraining('bodyweightYes')} />
      </div>
      <div className="ct-training__grid3">
        <label className="ct-training__field">
          <span className="ct-training__label">{tTraining('dumbbellMin')}</span>
          <input className="ct-training__input ct-training__num" inputMode="decimal" value={dMin} onChange={(e) => setDMin(e.target.value)} />
        </label>
        <label className="ct-training__field">
          <span className="ct-training__label">{tTraining('dumbbellMax')}</span>
          <input className="ct-training__input ct-training__num" inputMode="decimal" value={dMax} onChange={(e) => setDMax(e.target.value)} />
        </label>
        <label className="ct-training__field">
          <span className="ct-training__label">{tTraining('dumbbellStep')}</span>
          <input className="ct-training__input ct-training__num" inputMode="decimal" value={dStep} onChange={(e) => setDStep(e.target.value)} />
        </label>
      </div>
      <label className="ct-training__field">
        <span className="ct-training__label">{tTraining('platesList')}</span>
        <input className="ct-training__input ct-training__num" inputMode="decimal" value={plates} onChange={(e) => setPlates(e.target.value)} />
      </label>
      <label className="ct-training__field">
        <span className="ct-training__label">{tTraining('kettlebellsList')}</span>
        <input className="ct-training__input ct-training__num" inputMode="decimal" value={kettlebells} onChange={(e) => setKettlebells(e.target.value)} />
      </label>
      <fieldset className="ct-training__fieldset">
        <legend className="ct-training__label">{tTraining('increments')}</legend>
        <div className="ct-training__grid3">
          {INCREMENT_KEYS.map(([key, label]) => (
            <label key={key} className="ct-training__field">
              <span className="ct-training__label">{tTraining(label)}</span>
              <input className="ct-training__input ct-training__num" inputMode="decimal" value={increments[key] ?? ''} onChange={(e) => setIncrements((now) => ({ ...now, [key]: e.target.value }))} />
            </label>
          ))}
        </div>
      </fieldset>
      {toVerify.length > 0 && (
        <fieldset className="ct-training__fieldset">
          <legend className="ct-training__label">{tTraining('toVerify')}</legend>
          <ul className="ct-training__plain">
            {toVerify.map((key) => (
              <li key={key} className="ct-training__verify">
                <span>
                  {verifyLabel(key)} <VerifyTag show />
                </span>
                <Button variant="secondary" ariaLabel={`${tTraining('markVerified')} : ${verifyLabel(key)}`} onClick={() => setToVerify((now) => now.filter((k) => k !== key))}>
                  {tTraining('markVerified')}
                </Button>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      <fieldset className="ct-training__fieldset">
        <legend className="ct-training__label">{tTraining('availableEquipment')}</legend>
        <div className="ct-training__checks">
          {data.content.equipment.map((item) => (
            <label key={item.id} className="ct-training__check">
              <input type="checkbox" checked={available.includes(item.id)} onChange={(e) => setAvailable((now) => (e.target.checked ? [...now.filter((id) => id !== item.id), item.id] : now.filter((id) => id !== item.id)))} />
              <span>{item.nameFr}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p className="ct-training__error" role="alert">
          {error}
        </p>
      )}
      <div className="ct-training__actions">
        <Button type="submit">{tTraining('saveProfile')}</Button>
        <Button variant="secondary" onClick={() => onDone(false)}>
          {tTraining('cancel')}
        </Button>
      </div>
    </form>
  );
}

export interface EquipmentViewProps {
  readonly data: TrainingData;
  readonly access: DataAccess;
  readonly ids: IdGenerator;
  readonly reload: () => Promise<void>;
}

export function EquipmentView({ data, access, ids, reload }: EquipmentViewProps) {
  const [viewId, setViewId] = useState<string>(data.active.id);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const viewed = data.profiles.find((p) => p.id === viewId) ?? data.active;
  const isActive = viewed.id === data.active.id;

  const act = async (work: () => Promise<void>, done: string): Promise<void> => {
    try {
      await work();
      await reload();
      setMessage(done);
    } catch {
      setMessage(tTraining('saveError'));
    }
  };

  return (
    <div className="ct-training__equipment">
      <section className="ct-training__side" aria-labelledby="ct-profiles-title">
        <h2 id="ct-profiles-title" className="ct-training__eyebrow ct-section-title">
          {tTraining('profiles')}
        </h2>
        <ul className="ct-training__rows">
          {data.profiles.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="ct-training__row"
                aria-current={p.id === viewed.id ? 'true' : undefined}
                aria-describedby={`ct-profile-meta-${p.id}`}
                onClick={() => {
                  setEditing(false);
                  setMessage(null);
                  setViewId(p.id);
                }}
              >
                <span className="ct-training__row-name">{p.name}</span>
                <span className="ct-training__row-meta" id={`ct-profile-meta-${p.id}`}>
                  {[tTraining(PROFILE_KIND_KEY[p.kind]), p.origin === 'embedded' ? tTraining('embedded') : tTraining('personal'), p.id === data.active.id ? tTraining('activeHere') : null].filter((s) => s !== null).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="ct-training__muted">{tTraining('profilesHint')}</p>
      </section>
      <section className="ct-training__main" aria-labelledby="ct-profile-title">
        {message && (
          <p className="ct-training__message" role="status">
            {message}
          </p>
        )}
        {editing && viewed.origin === 'personal' ? (
          <ProfileForm
            data={data}
            access={access}
            profile={viewed}
            onDone={(saved) => {
              setEditing(false);
              if (saved) void reload().then(() => setMessage(tTraining('profileSaved')));
            }}
          />
        ) : (
          <>
            <h2 id="ct-profile-title" className="ct-training__heading ct-equipment__title">
              {viewed.name}
            </h2>
            <p className="ct-training__muted">
              {tTraining(PROFILE_KIND_KEY[viewed.kind])} · {viewed.origin === 'embedded' ? tTraining('embedded') : tTraining('personal')}
              {isActive && <span className="ct-training__badge">{tTraining('activeHere')}</span>}
            </p>
            <div className="ct-training__actions">
              {!isActive && <Button onClick={() => void act(() => setActiveProfile(access, viewed.id), tTraining('activated'))}>{tTraining('activate')}</Button>}
              {viewed.origin === 'embedded' ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const copy = duplicateEmbeddedProfile(viewed, ids, tTraining('copyName', { name: viewed.name }));
                    void act(async () => {
                      await (await access.repos.equipmentProfiles()).create(copy);
                      setViewId(copy.id);
                    }, tTraining('duplicated'));
                  }}
                >
                  {tTraining('duplicate')}
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setMessage(null);
                      setEditing(true);
                    }}
                  >
                    {tTraining('editProfile')}
                  </Button>
                  {/* ERGO-02 : une seule action rouge à l'écran ; « Activer » l'est déjà quand le profil n'est pas actif (suppression confirmée). */}
                  <Button variant={isActive ? 'danger' : 'secondary'} onClick={() => setConfirm(true)}>
                    {tTraining('deleteProfile')}
                  </Button>
                </>
              )}
            </div>
            {viewed.origin === 'embedded' && <p className="ct-training__muted">{tTraining('readOnly')}</p>}
            <Inventory data={data} profile={viewed} />
          </>
        )}
      </section>
      {confirm && viewed.origin === 'personal' && (
        <ConfirmDialog
          title={tTraining('deleteProfileTitle', { name: viewed.name })}
          description={tTraining('deleteProfileHint')}
          confirmLabel={tTraining('delete')}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            const target = viewed;
            void act(async () => {
              await (await access.repos.equipmentProfiles()).softDelete(target.id);
              if (isActive) await access.repos.settings.set('training.activeEquipmentProfile', null);
              setViewId(data.content.defaultProfileId);
            }, tTraining('profileDeleted'));
          }}
        />
      )}
    </div>
  );
}
