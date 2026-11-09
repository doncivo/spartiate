import { lazy, Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { computeTotals, isFavorite, parseRecipeFoodId, resolveFavorites, toggleFavorite, validateMealEntry, type Favorite, type Recipe, type RecipeSearchable, type SearchProvenance } from '../../../domain/nutrition';
import type { SearchableFood } from '../../../domain/nutrition/foodSearch';
import { missingNutrients } from '../../../domain/nutrition/offProduct';
import type { IsoDateTime, LocalDate, LocalTime } from '../../../domain/types';
import type { RecentFood } from '../../../db/repositories/mealEntryRepository';
import type { PortionRecord } from '../../../db/repositories/foodRepository';
import { formatInt, formatTenth, orDash, tNutrition } from '../../../i18n/nutritionText';
import { resolveBarcodeScanner } from '../../../platform/barcode';
import { Button, SegmentedControl } from '../../../ui';
import { useAppContainer } from '../../app/AppContainerContext';
import { canOpenAppSettings, openAppSettingsAction } from '../../security/systemSettingsAction';
import type { ScanOutcome } from '../scan/scanBarcode';
import { MacroLine, NumberField, parseNumber, ProvenanceBadge, revealAfterKeyboard, TimeField } from '../shared';
import { entryFromFood } from '../useCases';
import { searchCatalogue, toSearchable, type CatalogueSearchResult } from './catalogueSearch';
import { CustomFoodForm } from './CustomFoodForm';
import { chooseOnline, resolveBarcode, searchOnline, type OffDeps, type OffFailure, type OnlineItem, type OnlineSearch } from './offLookup';
import { missingList, offFailureCause, offFailureMessage, offRefusalMessage } from './offMessages';
import { loadFavorites, saveFavorites } from './favoritesStore';
import { resolveFood } from './resolveFood';

/** Écran de visée du scan (iPhone) : bloc à la demande, jamais dans le départ. */
const BarcodeScanView = lazy(() => import('../scan/BarcodeScanView').then((m) => ({ default: m.BarcodeScanView })));

/** Recettes (I4-07) : résultats, étape « portions ou grammes » et leur catalogue de textes sont des blocs à la demande. */
const RecipeHits = lazy(() => import('../recipes/RecipeHits').then((m) => ({ default: m.RecipeHits })));
const RecipeQuantityStep = lazy(() => import('../recipes/RecipeQuantityStep').then((m) => ({ default: m.RecipeQuantityStep })));

type Filter = 'all' | 'recipe' | SearchProvenance;

type RecipeSearchState = { readonly query: string; readonly hits: readonly RecipeSearchable[]; readonly failed: boolean };

interface Selection {
  readonly food: SearchableFood;
  readonly grams: string;
  /** Fiche Open Food Facts périmée proposée faute de réseau : cause dite. */
  readonly staleCause?: string;
}

/** Résultat d'une saisie ou d'un scan de code, rendu sous le champ. */
type LookupState = { readonly status: 'busy' } | { readonly status: 'message'; readonly text: string; readonly createCode?: string };

type ScanNotice = { readonly kind: 'denied' | 'settings-failed' | 'failed' | 'unreadable' };

type OnlineState = { readonly query: string; readonly status: 'busy' } | { readonly query: string; readonly status: 'done'; readonly result: OnlineSearch };

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
  // Favoris (D-79) : liste conservée (sans les aliments disparus) et aliments retrouvés, dans le même ordre.
  const [favorites, setFavorites] = useState<{ readonly status: 'loading' | 'ready' | 'failed'; readonly kept: readonly Favorite[]; readonly foods: readonly SearchableFood[]; readonly gone: readonly string[] }>({ status: 'loading', kept: [], foods: [], gone: [] });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [recipeSearch, setRecipeSearch] = useState<RecipeSearchState | null>(null);
  const [recipeSelection, setRecipeSelection] = useState<Recipe | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ readonly name: string; readonly barcode?: string } | null>(null);
  const [code, setCode] = useState('');
  const [lookup, setLookup] = useState<LookupState | null>(null);
  const [online, setOnline] = useState<OnlineState | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState<ScanNotice | null>(null);
  const request = useRef(0);
  const lookupTicket = useRef(0);
  const picking = useRef(false);
  const onlineTicket = useRef(0);
  const { runtime, os } = container.platform;
  const scannerLoader = useMemo(() => resolveBarcodeScanner(runtime, os), [runtime, os]);

  const offDeps = async (): Promise<OffDeps> => ({
    foods: await data.repos.foods(),
    // Client Open Food Facts : chargé à la demande, au premier geste d'Ali (jamais au montage).
    client: async () => (await import('../../../platform/off')).resolveOffClient(runtime),
    now: new Date(container.clock.nowMs()).toISOString() as IsoDateTime,
  });

  /** Saisie ou scan d'un code : cache d'abord, réseau seulement si la fiche manque ou a plus de 90 jours. */
  async function lookupCode(input: string): Promise<void> {
    const ticket = (lookupTicket.current += 1);
    setNotice(null);
    setScanNotice(null);
    setLookup({ status: 'busy' });
    let state: LookupState | null;
    let chosen: Selection | null = null;
    try {
      const result = await resolveBarcode(await offDeps(), input);
      switch (result.kind) {
        case 'invalid-code':
          state = { status: 'message', text: tNutrition('barcodeInvalid') };
          break;
        case 'found':
          state = null;
          chosen = { food: toSearchable(result.food), grams: '100', ...(result.via === 'stale' && result.refreshFailure ? { staleCause: offFailureCause(result.refreshFailure) } : {}) };
          break;
        case 'not-found':
          state = { status: 'message', text: tNutrition('barcodeNotFound', { code: result.code }), createCode: result.code };
          break;
        case 'refused':
          state = { status: 'message', text: offRefusalMessage(result.reason), createCode: result.code };
          break;
        case 'failed':
          state = { status: 'message', text: offFailureMessage(result.failure) };
          break;
      }
    } catch {
      state = { status: 'message', text: offFailureMessage({ kind: 'bad-response' } satisfies OffFailure) };
    }
    if (ticket !== lookupTicket.current) return;
    setLookup(state);
    if (chosen) setSelection(chosen);
  }

  /** « Chercher en ligne » : un seul appel, sur ce geste. N'écrit rien avant le choix d'une fiche. */
  async function runOnlineSearch(): Promise<void> {
    const text = query.trim();
    const ticket = (onlineTicket.current += 1);
    setOnline({ query: text, status: 'busy' });
    let result: OnlineSearch;
    try {
      result = await searchOnline(await offDeps(), text);
    } catch {
      result = { kind: 'failed', failure: { kind: 'bad-response' } };
    }
    if (ticket === onlineTicket.current) setOnline({ query: text, status: 'done', result });
  }

  /** Tout choix fait par un geste d'Ali prime sur la recherche d'un code encore en vol : son résultat tardif est ignoré. */
  function supersedeLookup(): void {
    lookupTicket.current += 1;
    setLookup((current) => (current?.status === 'busy' ? null : current));
  }

  async function pickOnline(item: OnlineItem): Promise<void> {
    if (picking.current) return;
    picking.current = true;
    supersedeLookup();
    try {
      const record = await chooseOnline(await data.repos.foods(), item.draft);
      setNotice(null);
      setSelection({ food: toSearchable(record), grams: '100' });
    } catch {
      setNotice(tNutrition('writeError'));
    } finally {
      picking.current = false;
    }
  }

  function onScanOutcome(outcome: ScanOutcome): void {
    setScanning(false);
    switch (outcome.kind) {
      case 'scanned':
        setCode(outcome.barcode.code);
        void lookupCode(outcome.barcode.code);
        return;
      case 'cancelled':
        return;
      case 'camera-denied':
        setScanNotice({ kind: 'denied' });
        return;
      case 'unreadable':
        setScanNotice({ kind: 'unreadable' });
        return;
      case 'failed':
        setScanNotice({ kind: 'failed' });
    }
  }

  async function openSettings(): Promise<void> {
    setScanNotice((await openAppSettingsAction()) === null ? { kind: 'denied' } : { kind: 'settings-failed' });
  }
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
    let live = true;
    void (async () => {
      const read = await loadFavorites(data.repos.settings);
      if (!read.ok) {
        if (live) setFavorites((c) => ({ ...c, status: 'failed' }));
        return;
      }
      if (read.list.length === 0) {
        if (live) setFavorites({ status: 'ready', kept: [], foods: [], gone: [] });
        return;
      }
      const foods = await data.repos.foods();
      const resolved = await resolveFavorites(read.list, (ref) => resolveFood(foods, ref));
      if (live) setFavorites({ status: 'ready', kept: resolved.kept, foods: resolved.foods, gone: resolved.gone });
    })().catch(() => {
      if (live) setFavorites((c) => ({ ...c, status: 'failed' }));
    });
    return () => {
      live = false;
    };
  }, [data]);

  /**
   * Ajoute ou retire un favori ; `false` si rien n'a été écrit. La liste est RELUE avant d'écrire (jamais écrasée depuis un état d'écran) ;
   * une lecture en échec n'écrit rien et désactive l'étoile (D-79 point 3).
   */
  async function onToggleFavorite(food: SearchableFood): Promise<boolean> {
    if (favorites.status !== 'ready') return false;
    const read = await loadFavorites(data.repos.settings);
    if (!read.ok) {
      setFavorites((current) => ({ ...current, status: 'failed' }));
      return false;
    }
    const base = read.list.filter((f) => !favorites.gone.includes(f.ref));
    const nextKept = toggleFavorite(base, { source: food.provenance, ref: food.ref });
    try {
      await saveFavorites(data.repos.settings, nextKept);
    } catch {
      return false;
    }
    setFavorites((current) => ({
      ...current,
      kept: nextKept,
      foods: isFavorite(nextKept, food.ref) ? [food, ...current.foods.filter((f) => f.ref !== food.ref)] : current.foods.filter((f) => f.ref !== food.ref),
    }));
    return true;
  }

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

  // Recettes (D-80) : lues à la demande, seulement quand elles peuvent figurer dans les résultats (filtre « Tout » ou « Mes recettes »).
  useEffect(() => {
    if (!(filter === 'all' || filter === 'recipe') || (query.trim() === '' && filter !== 'recipe')) return;
    let live = true;
    void (async () => {
      try {
        const { findRecipes } = await import('../recipes/recipeSearch');
        const hits = await findRecipes(data, query);
        if (live) setRecipeSearch({ query, hits, failed: false });
      } catch {
        if (live) setRecipeSearch({ query, hits: [], failed: true });
      }
    })();
    return () => {
      live = false;
    };
  }, [query, filter, data]);

  async function pickRecipe(ref: string): Promise<void> {
    try {
      const { loadRecipeByRef } = await import('../recipes/recipeSearch');
      const recipe = await loadRecipeByRef(data, ref);
      if (recipe === null) {
        setNotice(tNutrition('foodGone'));
        return;
      }
      setNotice(null);
      supersedeLookup();
      setRecipeSelection(recipe);
    } catch {
      setNotice(tNutrition('loadError'));
    }
  }

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
    // Un récent issu d'une recette (`recipe:<id>`) rouvre l'étape « portions ou grammes » de la recette.
    if (parseRecipeFoodId(recent.foodId) !== null) return pickRecipe(recent.foodId);
    const food = await resolveFood(await data.repos.foods(), recent.foodId).catch(() => null);
    if (food === null) {
      setNotice(tNutrition('foodGone'));
      return;
    }
    setNotice(null);
    supersedeLookup();
    setSelection({ food, grams: String(recent.lastGrams) });
  }

  if (creating) {
    return (
      <CustomFoodForm
        initialName={creating.name}
        {...(creating.barcode === undefined ? {} : { initialBarcode: creating.barcode })}
        onCreated={(food) => {
          supersedeLookup();
          setCreating(null);
          setLookup(null);
          setSelection({ food, grams: '100' });
        }}
        onCancel={() => setCreating(null)}
      />
    );
  }

  if (recipeSelection) {
    return (
      <div className="ct-nutrition__panel" onKeyDown={closeOnEscape}>
        <Suspense
          fallback={
            <p role="status" className="ct-nutrition__muted">
              {tNutrition('loading')}
            </p>
          }
        >
          <RecipeQuantityStep recipe={recipeSelection} date={date} defaultTime={defaultTime} onBack={() => setRecipeSelection(null)} onSaved={onSaved} />
        </Suspense>
      </div>
    );
  }

  if (selection) {
    return (
      <div className="ct-nutrition__panel" onKeyDown={closeOnEscape}>
        <QuantityStep
          food={selection.food}
          staleCause={selection.staleCause}
          favorite={isFavorite(favorites.kept, selection.food.ref)}
          favoritesStatus={favorites.status}
          onToggleFavorite={onToggleFavorite}
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
  // Recettes : seulement celles de la requête affichée ; masquées par les filtres Perso / Ciqual / OFF.
  const recipeView = recipeSearch !== null && recipeSearch.query === query && (filter === 'all' || filter === 'recipe') ? recipeSearch : null;
  const recipeCount = recipeView?.hits.length ?? 0;
  const onlineView = online !== null && online.query === query.trim() ? online : null;
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
          { value: 'recipe', label: tNutrition('filterRecipe') },
        ]}
      />
      <p className="ct-nutrition__muted">{tNutrition('searchHintKeys')}</p>
      <form
        className="ct-nutrition__panel-head"
        onSubmit={(event) => {
          event.preventDefault();
          if (code.trim() !== '') void lookupCode(code);
        }}
      >
        <label className="ct-nutrition__field ct-nutrition__field--grow">
          <span className="ct-nutrition__field-label">{tNutrition('barcodeLabel')}</span>
          <input
            className="ct-nutrition__input ct-nutrition__num"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={code}
            aria-describedby="ct-nutrition-barcode-hint"
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <Button type="submit" variant="secondary" disabled={code.trim() === '' || lookup?.status === 'busy'}>
          {tNutrition('barcodeSubmit')}
        </Button>
        {scannerLoader ? (
          <Button
            variant="secondary"
            onClick={() => {
              setScanNotice(null);
              setLookup(null);
              setScanning(true);
            }}
          >
            {tNutrition('scanButton')}
          </Button>
        ) : null}
      </form>
      <p id="ct-nutrition-barcode-hint" className="ct-nutrition__muted">
        {tNutrition('barcodeHint')}
      </p>
      {lookup?.status === 'busy' ? (
        <p role="status" className="ct-nutrition__muted">
          {tNutrition('barcodeBusy')}
        </p>
      ) : lookup?.status === 'message' ? (
        <div role="alert" className="ct-nutrition__warning">
          <p>{lookup.text}</p>
          {lookup.createCode ? (
            <Button variant="secondary" onClick={() => {
                supersedeLookup();
                setCreating({ name: '', barcode: lookup.createCode as string });
              }}>
              {tNutrition('barcodeCreate')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {scanNotice ? (
        <div role="alert" className="ct-nutrition__warning">
          <p>
            {scanNotice.kind === 'denied'
              ? tNutrition('scanDenied')
              : scanNotice.kind === 'settings-failed'
                ? tNutrition('scanSettingsFailed')
                : scanNotice.kind === 'unreadable'
                  ? tNutrition('scanUnreadable')
                  : tNutrition('scanFailed')}
          </p>
          {scanNotice.kind === 'denied' && canOpenAppSettings() ? (
            <Button variant="secondary" onClick={() => void openSettings()}>
              {tNutrition('scanOpenSettings')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {scanning && scannerLoader ? (
        <Suspense fallback={null}>
          <BarcodeScanView load={scannerLoader} onOutcome={onScanOutcome} />
        </Suspense>
      ) : null}
      {notice ? (
        <p role="alert" className="ct-nutrition__warning">
          {notice}
        </p>
      ) : null}
      {query.trim() === '' && favorites.foods.length > 0 ? (
        <section aria-labelledby="ct-nutrition-favorites">
          <h2 id="ct-nutrition-favorites" className="ct-nutrition__subtitle">
            {tNutrition('favorites')}
          </h2>
          <ul className="ct-nutrition__list">
            {favorites.foods.map((food) => (
              <li key={food.ref}>
                <button type="button" data-hit className="ct-nutrition__hit" onClick={() => { setNotice(null); supersedeLookup(); setSelection({ food, grams: '100' }); }}>
                  <span className="ct-nutrition__hit-name">
                    {food.name}
                    {food.brand ? <span className="ct-nutrition__muted"> · {food.brand}</span> : null}
                  </span>
                  <ProvenanceBadge source={food.provenance} />
                  <span className="ct-nutrition__muted ct-nutrition__num">
                    {food.per100g.kcal === null ? tNutrition('per100gUnknown') : tNutrition('per100g', { kcal: formatInt(food.per100g.kcal) })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {query.trim() === '' && filter === 'recipe' ? (
        <section aria-label={tNutrition('searchResults')}>
          <Suspense fallback={null}>
            <RecipeHits hits={recipeView?.hits ?? []} failed={recipeView?.failed ?? false} onPick={(ref) => void pickRecipe(ref)} />
          </Suspense>
        </section>
      ) : query.trim() === '' ? (
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
          {recipeView !== null && (recipeView.hits.length > 0 || recipeView.failed) ? (
            <Suspense fallback={null}>
              <RecipeHits hits={recipeView.hits} failed={recipeView.failed} onPick={(ref) => void pickRecipe(ref)} />
            </Suspense>
          ) : null}
          {visible.length === 0 && recipeCount > 0 ? null : visible.length === 0 ? (
            <>
              <p>{tNutrition('noResult')}</p>
              <p className="ct-nutrition__muted">{tNutrition('noResultHint')}</p>
            </>
          ) : (
            <ul className="ct-nutrition__list">
              {visible.map((hit) => (
                <li key={hit.ref}>
                  <button type="button" data-hit className="ct-nutrition__hit" onClick={() => { setNotice(null); supersedeLookup(); setSelection({ food: hit, grams: '100' }); }}>
                    <span className="ct-nutrition__hit-name">
                      {hit.name}
                      {hit.brand ? <span className="ct-nutrition__muted"> · {hit.brand}</span> : null}
                    </span>
                    <ProvenanceBadge source={hit.provenance} />
                    <span className="ct-nutrition__muted ct-nutrition__num">
                      {hit.per100g.kcal === null ? tNutrition('per100gUnknown') : tNutrition('per100g', { kcal: formatInt(hit.per100g.kcal) })}
                    </span>
                    {hit.provenance === 'off' ? <span className="ct-nutrition__muted">{tNutrition('offAttributionShort')}</span> : null}
                    {result.staleOff.includes(hit.ref) ? <span className="ct-nutrition__muted">{tNutrition('staleOff')}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="ct-nutrition__actions">
            <Button
              variant="secondary"
              onClick={() => {
                supersedeLookup();
                setCreating({ name: query.trim() });
              }}
            >
              {tNutrition('createFood')}
            </Button>
            <Button variant="secondary" disabled={onlineView?.status === 'busy'} onClick={() => void runOnlineSearch()}>
              {tNutrition('searchOnline')}
            </Button>
          </div>
          <p className="ct-nutrition__muted">{tNutrition('searchOnlineHint')}</p>
          {onlineView?.status === 'busy' ? (
            <p role="status" className="ct-nutrition__muted">
              {tNutrition('searchOnlineBusy')}
            </p>
          ) : onlineView?.status === 'done' ? (
            <OnlineResults query={onlineView.query} result={onlineView.result} onPick={(item) => void pickOnline(item)} />
          ) : null}
        </section>
      )}
    </div>
  );
}

interface OnlineResultsProps {
  readonly query: string;
  readonly result: OnlineSearch;
  readonly onPick: (item: OnlineItem) => void;
}

/** Résultats d'une recherche en ligne : provenance Open Food Facts et attribution sur chaque ligne ; rien n'est enregistré avant le choix. */
function OnlineResults({ query, result, onPick }: OnlineResultsProps) {
  if (result.kind === 'failed') {
    return (
      <p role="alert" className="ct-nutrition__warning">
        {offFailureMessage(result.failure)}
      </p>
    );
  }
  if (result.kind === 'invalid-query') {
    return (
      <p role="alert" className="ct-nutrition__warning">
        {offFailureMessage({ kind: 'invalid-input' })}
      </p>
    );
  }
  return (
    <section aria-labelledby="ct-nutrition-online">
      <h2 id="ct-nutrition-online" className="ct-nutrition__subtitle">
        {tNutrition('onlineResults')}
      </h2>
      {result.items.length === 0 ? (
        result.refused > 0 ? null : <p>{tNutrition('onlineEmpty', { query })}</p>
      ) : (
        <ul className="ct-nutrition__list">
          {result.items.map((item, index) => (
            <li key={`${item.draft.barcode}-${index}`}>
              <button type="button" data-hit className="ct-nutrition__hit" onClick={() => onPick(item)}>
                <span className="ct-nutrition__hit-name">
                  {item.draft.name}
                  {item.draft.brand ? <span className="ct-nutrition__muted"> · {item.draft.brand}</span> : null}
                </span>
                <ProvenanceBadge source="off" />
                <span className="ct-nutrition__muted ct-nutrition__num">
                  {item.draft.per100g.kcal === null ? tNutrition('per100gUnknown') : tNutrition('per100g', { kcal: formatInt(item.draft.per100g.kcal) })}
                </span>
                <span className="ct-nutrition__muted">{tNutrition('offAttributionShort')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {result.refused > 0 ? <p className="ct-nutrition__muted">{tNutrition('onlineRefused', { n: result.refused })}</p> : null}
    </section>
  );
}

interface QuantityStepProps {
  readonly food: SearchableFood;
  readonly staleCause?: string | undefined;
  readonly favorite: boolean;
  readonly favoritesStatus: 'loading' | 'ready' | 'failed';
  readonly onToggleFavorite: (food: SearchableFood) => Promise<boolean>;
  readonly initialGrams: string;
  readonly date: LocalDate;
  readonly defaultTime: string;
  readonly onBack: () => void;
  readonly onSaved: () => void;
  readonly onClose: () => void;
}

/** Quantité d'une prise : grammes ou portions de la fiche, heure, totaux recalculés ; enregistrement après confirmation seulement. */
function QuantityStep({ food, staleCause, favorite, favoritesStatus, onToggleFavorite, initialGrams, date, defaultTime, onBack, onSaved, onClose }: QuantityStepProps) {
  const { data } = useAppContainer();
  const [grams, setGrams] = useState(initialGrams);
  const [time, setTime] = useState(defaultTime);
  const [portions, setPortions] = useState<readonly PortionRecord[]>([]);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [favoriteFailed, setFavoriteFailed] = useState(false);
  const togglingFavorite = useRef(false);
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

  async function toggleFavorite(): Promise<void> {
    if (togglingFavorite.current) return;
    togglingFavorite.current = true;
    try {
      setFavoriteFailed(!(await onToggleFavorite(food)));
    } finally {
      togglingFavorite.current = false;
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
        <Button variant="secondary" pressed={favorite} disabled={favoritesStatus !== 'ready'} ariaBusy={favoritesStatus === 'loading'} ariaLabel={tNutrition('favoriteToggle')} className="ct-nutrition__star" onClick={() => void toggleFavorite()}>
          <span aria-hidden="true">{favorite ? '★' : '☆'}</span>
        </Button>
      </div>
      {favoritesStatus === 'failed' || favoriteFailed ? (
        <p role="alert" className="ct-nutrition__warning">
          {tNutrition(favoritesStatus === 'failed' ? 'favoritesReadError' : 'writeError')}
        </p>
      ) : null}
      {food.provenance === 'off' ? (
        <>
          <p className="ct-nutrition__muted">{tNutrition('offAttribution')}</p>
          {missingNutrients(food.per100g).length > 0 ? (
            <p className="ct-nutrition__muted">{tNutrition('offMissing', { list: missingList(missingNutrients(food.per100g)) })}</p>
          ) : null}
          {staleCause ? (
            <p role="status" className="ct-nutrition__warning">
              {tNutrition('offStaleFiche', { cause: staleCause })}
            </p>
          ) : null}
        </>
      ) : null}
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
