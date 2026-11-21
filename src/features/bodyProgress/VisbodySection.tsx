import { useEffect, useId, useState } from 'react';
import { todayLocal } from '../../domain/clock';
import { parseVisbodyForm, VISBODY_FIELDS, VISBODY_KINDS, visbodyChange, visbodyDisplayValue, visbodyReports, type VisbodyField, type VisbodyFieldIssue, type VisbodyKind, type VisbodyReport } from '../../domain/bodyProgress/visbody';
import type { LocalDate } from '../../domain/types';
import { tVisbody, type VisbodyTextKey } from '../../i18n/visbodyText';
import { Button } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useSyncedData } from '../sync/remoteChanges';
import './Visbody.css';

/**
 * SUIVIS-029d : Progrès › Corps, bilans VISBODY saisis à la main. Chaque champ facultatif (au moins un), bornes du domaine (refus avec la plage) ; même
 * date : bilan prérempli puis remplacé (un champ vidé est retiré). Une courbe et l'écart au bilan précédent par mesure. Mesures `visbody_*` de la table
 * publiée `measurement` (vues sur les deux appareils, comme les mensurations) ; le poids n'entre pas dans les pesées. Aucune valeur journalisée.
 */
type Texts = Partial<Record<VisbodyKind, string>>;
type Load = { readonly status: 'loading' } | { readonly status: 'failed' } | { readonly status: 'ready'; readonly reports: readonly VisbodyReport[] };

const label = (kind: VisbodyKind): string => tVisbody(`field_${kind}` as VisbodyTextKey);
const unitText = (f: VisbodyField): string => tVisbody(`unit_${f.unit}`);
const num = (v: number): string => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const signed = (v: number): string => (v > 0 ? `+${num(v)}` : v < 0 ? `−${num(-v)}` : num(0));
const dmy = (date: string): string => {
  const [y, m, d] = date.split('-');
  return `${d ?? ''}/${m ?? ''}/${y ?? ''}`;
};
/**
 * Texte d'un champ prérempli : valeur affichée (kcal pour le métabolisme), virgule décimale, SANS arrondi (relecture SUIVIS-029 : 72,45 kg arrondi
 * à 72,5 aurait été réécrit à la correction d'un autre champ). L'arrondi au dixième ne vaut que pour l'affichage des courbes et des écarts.
 */
const textsOf = (report: VisbodyReport | undefined): Texts =>
  Object.fromEntries(VISBODY_KINDS.flatMap((k) => (report?.values[k] === undefined ? [] : [[k, String(visbodyDisplayValue(k, report.values[k] ?? 0)).replace('.', ',')]])));

/**
 * Courbe des bilans (valeurs affichées, au moins deux). Copie volontaire et réduite de src/features/tracking/Sparkline.tsx : l'importer créait un bloc
 * partagé de plus, dont le nom entrait dans la table de préchargement du départ (mesure du bundle).
 */
function Curve({ points, label: text }: { readonly points: readonly number[]; readonly label: string }) {
  const width = 120;
  const height = 32;
  const lo = Math.min(...points);
  const span = Math.max(...points) - lo;
  const coords = points.map((v, i) => `${String((i * width) / (points.length - 1))},${String(span === 0 ? height / 2 : height - 3 - ((v - lo) * (height - 6)) / span)}`);
  return (
    <svg className="ct-visbody__chart" viewBox={`0 0 ${String(width)} ${String(height)}`} preserveAspectRatio="none" role="img" aria-label={text}>
      <polyline className="ct-visbody__line" points={coords.join(' ')} />
    </svg>
  );
}

function Field({ field, value, issue, onChange, idBase }: { readonly field: VisbodyField; readonly value: string; readonly issue: VisbodyFieldIssue | undefined; readonly onChange: (v: string) => void; readonly idBase: string }) {
  const id = `${idBase}-${field.kind}`;
  return (
    <div className="ct-visbody__field">
      <label htmlFor={id}>{label(field.kind)}</label>
      <input
        id={id}
        className="ct-visbody__input"
        inputMode="decimal"
        value={value}
        aria-invalid={issue !== undefined}
        aria-describedby={issue === undefined ? undefined : `${id}-issue`}
        onChange={(e) => onChange(e.target.value)}
      />
      {issue === undefined ? null : (
        <p id={`${id}-issue`} className="ct-visbody__issue">
          {issue === 'range' ? tVisbody('range', { min: num(field.min), max: num(field.max) }) : tVisbody(field.integer ? 'format' : 'formatDecimal')}
        </p>
      )}
    </div>
  );
}

export function VisbodySection() {
  const container = useAppContainer();
  const id = useId();
  const today = todayLocal(container.clock);
  const synced = useSyncedData(['measurement']);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [epoch, setEpoch] = useState(0);
  const [date, setDate] = useState<string>(today);
  const [texts, setTexts] = useState<Texts>({});
  const [issues, setIssues] = useState<Partial<Record<VisbodyKind, VisbodyFieldIssue>>>({});
  const [formIssue, setFormIssue] = useState<'empty' | 'future' | 'dateInvalid' | null>(null);
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle');

  useEffect(() => {
    let live = true;
    (async () => {
      const repo = await container.data.repos.measurements();
      const rows = (await Promise.all(VISBODY_KINDS.map((k) => repo.list(k)))).flat();
      return visbodyReports(rows);
    })().then(
      (reports) => {
        if (live) setLoad({ status: 'ready', reports });
      },
      () => {
        if (live) setLoad({ status: 'failed' });
      },
    );
    return () => {
      live = false;
    };
  }, [container, synced, epoch]);

  const reports = load.status === 'ready' ? load.reports : [];
  const reportOf = (d: string): VisbodyReport | undefined => reports.find((r) => r.date === d);
  // Préremplissage au chargement et à chaque changement de date : le bilan existant de cette date, sinon des champs vides ; jamais par-dessus une saisie.
  const [filledFor, setFilledFor] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  if (load.status === 'ready' && filledFor !== date && !dirty) {
    setFilledFor(date);
    setTexts(textsOf(reportOf(date)));
  }

  const submit = (): void => {
    setStatus('idle');
    const parsed = parseVisbodyForm(texts, date, today);
    if (!parsed.ok) {
      setIssues(parsed.fields);
      setFormIssue(parsed.empty ? 'empty' : parsed.date === 'future' ? 'future' : parsed.date === 'date' ? 'dateInvalid' : null);
      return;
    }
    setIssues({});
    setFormIssue(null);
    const day = parsed.date as LocalDate;
    container.data
      .transaction(async (repos) => {
        const repo = await repos.measurements();
        for (const kind of VISBODY_KINDS) {
          const value = parsed.values[kind];
          if (value === undefined) await repo.remove(day, kind);
          else await repo.save(day, kind, value);
        }
      })
      .then(
        () => {
          setStatus('saved');
          setEpoch((n) => n + 1);
        },
        () => setStatus('failed'),
      );
  };

  const fields = (segment: boolean) =>
    VISBODY_FIELDS.filter((f) => f.segment === segment).map((f) => (
      <Field key={f.kind} field={f} idBase={id} value={texts[f.kind] ?? ''} issue={issues[f.kind]} onChange={(v) => {
        setDirty(true);
        setTexts((t) => ({ ...t, [f.kind]: v }));
      }} />
    ));

  return (
    <section className="ct-today__card ct-bodyprogress__card ct-visbody ct-flat" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="ct-today__eyebrow ct-section-title">
        {tVisbody('title')}
      </h2>
      <p className="ct-today__muted">{tVisbody('hint')}</p>
      <form
        className="ct-visbody__form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="ct-visbody__field">
          <label htmlFor={`${id}-date`}>{tVisbody('date')}</label>
          <input id={`${id}-date`} className="ct-visbody__input" type="date" max={today} value={date} onChange={(e) => {
              setDate(e.target.value);
              setDirty(false);
            }} />
        </div>
        {fields(false)}
        <details className="ct-visbody__block">
          <summary>{tVisbody('segmentsTitle')}</summary>
          <div className="ct-visbody__form">{fields(true)}</div>
        </details>
        <Button type="submit" variant="secondary">
          {tVisbody('save')}
        </Button>
      </form>
      {formIssue === null ? null : (
        <p className="ct-visbody__issue" role="alert">
          {tVisbody(formIssue)}
        </p>
      )}
      {status === 'saved' ? (
        <p className="ct-today__muted" role="status">
          {tVisbody('saved')}
        </p>
      ) : status === 'failed' ? (
        <p className="ct-visbody__issue" role="alert">
          {tVisbody('saveFailed')}
        </p>
      ) : null}
      {load.status === 'failed' ? (
        <p className="ct-today__muted">{tVisbody('loadFailed')}</p>
      ) : load.status === 'ready' && reports.length === 0 ? (
        <p className="ct-today__muted">{tVisbody('none')}</p>
      ) : (
        <ul className="ct-visbody__list">
          {VISBODY_FIELDS.map((f) => {
            const change = visbodyChange(reports, f.kind);
            if (change === null) return null;
            const unit = unitText(f);
            const lastText = tVisbody('last', { value: num(change.last.value), unit, date: dmy(change.last.date) }).replace(/ {2,}/g, ' ');
            return (
              <li key={f.kind} className="ct-visbody__block">
                <span className="ct-visbody__value">{`${label(f.kind)} · ${lastText}`}</span>
                <span className="ct-today__muted">
                  {change.delta === null || change.previous === null ? tVisbody('first') : tVisbody('delta', { delta: signed(change.delta), unit, date: dmy(change.previous.date) })}
                </span>
                {change.points.length > 1 ? <Curve points={change.points} label={tVisbody('curve', { label: label(f.kind), n: change.points.length, value: num(change.last.value), unit })} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
