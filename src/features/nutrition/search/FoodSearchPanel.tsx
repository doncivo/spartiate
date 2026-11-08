import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { computeTotals, validateMealEntry, type SearchProvenance } from '../../../domain/nutrition';
import type { SearchableFood } from '../../../domain/nutrition/foodSearch';
import type { IsoDateTime, LocalDate, LocalTime } from '../../../domain/types';
import type { RecentFood } from '../../../db/repositories/mealEntryRepository';
import type { PortionRecord } from '../../../db/repositories/foodRepository';
import { formatInt, formatTenth, orDash, tNutrition } from '../../../i18n/nutritionText';
import { Button, SegmentedControl } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { MacroLine, NumberField, parseNumber, ProvenanceBadge, revealAfterKeyboard, TimeField } from '../shared';
import { entryFromFood } from '../useCases';
import { searchCatalogue, type CatalogueSearchResult } from './catalogueSearch';
import { CustomFoodForm } from './CustomFoodForm';
import { resolveFood } from './resolveFood';

type Filter = 'all' | SearchProvenance;

interface Selection {
  readonly food: SearchableFood;
  readonly grams: string;
}

export interface FoodSearchPanelProps {
  readonly date: LocalDate;
  readonly defaultTime: string;
  readonly onSaved: () => void;
  readonly onClose: () => void;
}

/**
 * Recherche locale d'un aliment (I4-03, § 15.3) : récents, fiches personnelles, Ciqual et cache Open Food Facts, sans réseau. La provenance
 * est affichée sur chaque ligne. Choisir un aliment ouvre la quantité (grammes ou portions de la fiche), les totaux sont recalculés et
 * corrigeables ; rien n'est enregistré avant « Ajouter au journal ».
 */
export function FoodSearchPanel({ date, defaultTime, onSaved, onClose }: FoodSearchPanelProps) {
  const container = useAppContainer();
  const { data } = container;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [found, setFound] = useState<{ readonly query: string; readonly result: CatalogueSearchResult } | null>(null);
  const [recents, setRecents] = useState<readonly RecentFood[] | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const request = useRef(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const list = await (await data.repos.mealEntries()).recentFoods(12);
        if (live) setRecents(list);
      } catch {
        if (live) setRecents([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [data]);

  useEffect(() => {
    const ticket = (request.current += 1);
    if (query.trim() === '') return;
    void (async () => {
      try {
        const result = await searchCatalogue(await data.repos.foods(), query, { now: new Date(container.clock.nowMs()).toISOString() as IsoDateTime });
        if (ticket === request.current) setFound({ query, result });
      } catch {
        if (ticket === request.current) setFound({ query, result: { hits: [], ciqual: 'unavailable', staleOff: [] } });
      }
    })();
  }, [query, data, container]);

  const closeOnEscape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };

  // Flèches haut / bas : de la zone de recherche aux résultats et entre eux (clavier PC) ; Entrée active le bouton ciblé.
  const moveFocus = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const hits = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[data-hit]') ?? []);
    if (hits.length === 0) return;
    event.preventDefault();
    const index = hits.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % hits.length : (index <= 0 ? hits.length : index) - 1;
    hits[next]?.focus();
  };

  async function pickRecent(recent: RecentFood): Promise<void> {
    const food = await resolveFood(await data.repos.foods(), recent.foodId).catch(() => null);
    if (food === null) {
      setNotice(tNutrition('foodGone'));
      return;
    }
    setNotice(null);
    setSelection({ food, grams: String(recent.lastGrams) });
  }

  if (creating) {
    return (
      <CustomFoodForm
        initialName={query.trim()}
        onCreated={(food) => {
          setCreating(false);
          setSelection({ food, grams: '100' });
        }}
        onCancel={() => setCreating(false)}
      />
    );
  }

  if (selection) {
    return (
      <div className="ct-nutrition__panel" onKeyDown={closeOnEscape}>
        <QuantityStep
          food={selection.food}
          initialGrams={selection.grams}
          date={date}
          defaultTime={defaultTime}
          onBack={() => setSelection(null)}
          onSaved={onSaved}
          onClose={onClose}
        />
      </div>
    );
  }

  // Un résultat n'est montré que pour la requête qui l'a produit (jamais celui d'une frappe précédente).
  const result = found !== null && found.query === query ? found.result : null;
  const visible = (result?.hits ?? []).filter((hit) => filter === 'all' || hit.provenance === filter);
  return (
    <div className="ct-nutrition__panel" ref={root} onKeyDown={(event) => { closeOnEscape(event); moveFocus(event); }}>
      <div className="ct-nutrition__panel-head">
        <label className="ct-nutrition__field ct-nutrition__field--grow">
          <span className="ct-nutrition__field-label">{tNutrition('searchLabel')}</span>
          <input
            className="ct-nutrition__input"
            type="search"
            autoFocus
            value={query}
            placeholder={tNutrition('searchPlaceholder')}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <Button variant="secondary" onClick={onClose}>
          {tNutrition('searchClose')}
        </Button>
      </div>
      <SegmentedControl
        label={tNutrition('searchFilterLabel')}
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: tNutrition('filterAll') },
          { value: 'custom', label: tNutrition('filterCustom') },
          { value: 'ciqual', label: tNutrition('filterCiqual') },
          { value: 'off', label: tNutrition('filterOff') },
        ]}
      />
      <p className="ct-nutrition__muted">{tNutrition('searchHintKeys')}</p>
      {notice ? (
        <p role="alert" className="ct-nutrition__warning">
          {notice}
        </p>
      ) : null}
      {query.trim() === '' ? (
        <section aria-labelledby="ct-nutrition-recents">
          <h2 id="ct-nutrition-recents" className="ct-nutrition__subtitle">
            {tNutrition('recents')}
          </h2>
          {recents === null ? null : recents.length === 0 ? (
            <p className="ct-nutrition__muted">{tNutrition('recentsEmpty')}</p>
          ) : (
            <ul className="ct-nutrition__list">
              {recents.map((recent) => (
                <li key={recent.foodId}>
                  <button type="button" data-hit className="ct-nutrition__hit" onClick={() => void pickRecent(recent)}>
                    <span className="ct-nutrition__hit-name">{recent.foodName}</span>
                    <ProvenanceBadge source={recent.source} />
                    <span className="ct-nutrition__muted ct-nutrition__num">{tNutrition('recentLast', { n: formatTenth(recent.lastGrams) })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : result === null ? null : (
        <section aria-label={tNutrition('searchResults')}>
          {result.ciqual === 'unavailable' ? (
            <p role="status" className="ct-nutrition__warning">
              {tNutrition('ciqualUnavailable')}
            </p>
          ) : null}
          {visible.length === 0 ? (
            <>
              <p>{tNutrition('noResult')}</p>
              <p className="ct-nutrition__muted">{tNutrition('noResultHint')}</p>
            </>
          ) : (
            <ul className="ct-nutrition__list">
              {visible.map((hit) => (
                <li key={hit.ref}>
                  <button type="button" data-hit className="ct-nutrition__hit" onClick={() => { setNotice(null); setSelection({ food: hit, grams: '100' }); }}>
                    <span className="ct-nutrition__hit-name">
                      {hit.name}
                      {hit.brand ? <span className="ct-nutrition__muted"> · {hit.brand}</span> : null}
                    </span>
                    <ProvenanceBadge source={hit.provenance} />
                    <span className="ct-nutrition__muted ct-nutrition__num">
                      {hit.per100g.kcal === null ? tNutrition('per100gUnknown') : tNutrition('per100g', { kcal: formatInt(hit.per100g.kcal) })}
                    </span>
                    {result.staleOff.includes(hit.ref) ? <span className="ct-nutrition__muted">{tNutrition('staleOff')}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="secondary" onClick={() => setCreating(true)}>
            {tNutrition('createFood')}
          </Button>
        </section>
      )}
    </div>
  );
}

interface QuantityStepProps {
  readonly food: SearchableFood;
  readonly initialGrams: string;
  readonly date: LocalDate;
  readonly defaultTime: string;
  readonly onBack: () => void;
  readonly onSaved: () => void;
  readonly onClose: () => void;
}

/** Quantité d'une prise : grammes ou portions de la fiche, heure, totaux recalculés ; enregistrement après confirmation seulement. */
function QuantityStep({ food, initialGrams, date, defaultTime, onBack, onSaved, onClose }: QuantityStepProps) {
  const { data } = useAppContainer();
  const [grams, setGrams] = useState(initialGrams);
  const [time, setTime] = useState(defaultTime);
  const [portions, setPortions] = useState<readonly PortionRecord[]>([]);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const reveal = (): void => revealAfterKeyboard(actionsRef.current);

  useEffect(() => {
    if (food.provenance === 'ciqual') return;
    let live = true;
    void (async () => {
      try {
        const list = await (await data.repos.foods()).listPortions(food.ref);
        if (live) setPortions(list);
      } catch {
        if (live) setPortions([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [data, food]);

  const amount = parseNumber(grams);
  const totals = typeof amount === 'number' ? computeTotals(food.per100g, amount) : null;
  const draft = typeof amount === 'number' ? entryFromFood(food, amount, { date, time: time as LocalTime }) : null;
  const valid = draft !== null && validateMealEntry(draft).length === 0;

  async function save(): Promise<void> {
    if (!valid || draft === null || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await (await data.repos.mealEntries()).create(draft);
      onSaved();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <form
      className="ct-nutrition__panel ct-nutrition__form"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="ct-nutrition__food-head">
        <h2 className="ct-nutrition__subtitle">{food.name}</h2>
        <ProvenanceBadge source={food.provenance} />
        <span className="ct-nutrition__muted ct-nutrition__num">
          {food.per100g.kcal === null ? tNutrition('per100gUnknown') : tNutrition('per100g', { kcal: formatInt(food.per100g.kcal) })}
        </span>
      </div>
      {portions.length > 0 ? (
        <div className="ct-nutrition__chips" role="group" aria-label={tNutrition('portionsLabel')}>
          {portions.map((portion) => (
            <Button key={portion.id} variant="secondary" onClick={() => setGrams(String(portion.grams))}>
              {tNutrition('portionButton', { label: portion.label, grams: formatTenth(portion.grams) })}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="ct-nutrition__row">
        <NumberField label={tNutrition('quantityLabel')} value={grams} onChange={setGrams} invalid={!valid && grams !== ''} autoFocus onFocus={reveal} />
        <TimeField value={time} onChange={setTime} onFocus={reveal} />
      </div>
      <p className="ct-nutrition__muted">{tNutrition('quantityHint')}</p>
      <div className="ct-nutrition__totals" aria-label={tNutrition('totalsLabel')}>
        <strong className="ct-nutrition__num">{totals === null ? tNutrition('unknown') : tNutrition('kcalValue', { n: orDash(totals.kcal, formatInt) })}</strong>
        {totals === null ? null : <MacroLine p={orDash(totals.proteinG)} c={orDash(totals.carbG)} f={orDash(totals.fatG)} />}
      </div>
      {!valid && grams !== '' ? (
        <p role="alert" className="ct-nutrition__warning">
          {tNutrition('quantityInvalid')}
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="ct-nutrition__warning">
          {tNutrition('writeError')}
        </p>
      ) : null}
      <div className="ct-nutrition__actions" ref={actionsRef}>
        <Button type="submit" disabled={!valid || busy}>
          {tNutrition('addToJournal')}
        </Button>
        <Button variant="secondary" onClick={onBack}>
          {tNutrition('changeFood')}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {tNutrition('cancel')}
        </Button>
      </div>
    </form>
  );
}
