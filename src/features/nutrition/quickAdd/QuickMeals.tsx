import { useEffect, useState } from "react";
import { addDays } from "../../../domain/localDate";
import {
  entriesOfMoment,
  favoriteFromLines,
  linesFromRecipe,
  linesToDrafts,
  mealLines,
  mealMoment,
  recentMeals,
  scaleLine,
  type MealLine,
  type MealMoment,
  type RecentMeal,
  type Recipe,
} from "../../../domain/nutrition";
import type { LocalDate, LocalTime } from "../../../domain/types";
import { formatDayShort, formatInt, orDash } from "../../../i18n/nutritionText";
import {
  tQuick,
  type NutritionQuickTextKey,
} from "../../../i18n/nutritionQuickText";
import { Button } from "../../../ui";
import { useAppContainer } from "../../app/AppContainerContext";
import {
  MacroLine,
  NumberField,
  parseNumber,
  ProvenanceBadge,
} from "../shared";

const MOMENT_KEY: Readonly<Record<MealMoment, NutritionQuickTextKey>> = {
  morning: "momentMorning",
  midday: "momentMidday",
  afternoon: "momentAfternoon",
  evening: "momentEvening",
};
const RECENT_LIMIT = 5;
const RECENT_DAYS = 14;

interface Source {
  readonly title: string;
  readonly lines: readonly MealLine[];
  /** Vrai : heures d'origine (copie d'hier) ; faux : heure courante (récents, favoris). */
  readonly keepTimes: boolean;
}

interface Loaded {
  readonly yesterday: readonly MealLine[];
  readonly recents: readonly RecentMeal[];
  readonly favorites: readonly Recipe[];
}

export interface QuickMealsProps {
  /** Jour affiché du Journal : les lignes y sont écrites. */
  readonly date: LocalDate;
  readonly defaultTime: string;
  readonly onSaved: () => void;
  readonly onClose: () => void;
}

function Preview({
  source,
  date,
  defaultTime,
  onSaved,
  onBack,
}: {
  readonly source: Source;
  readonly date: LocalDate;
  readonly defaultTime: string;
  readonly onSaved: () => void;
  readonly onBack: () => void;
}) {
  const { data } = useAppContainer();
  const [texts, setTexts] = useState<readonly string[]>(
    source.lines.map((l) => (l.grams === null ? "" : String(l.grams))),
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [favNote, setFavNote] = useState<string | null>(null);
  const [favError, setFavError] = useState<string | null>(null);

  const lines = source.lines.map((line, i): MealLine | null => {
    if (line.grams === null) return line;
    const parsed = parseNumber(texts[i] ?? "");
    return typeof parsed === "number" ? scaleLine(line, parsed) : null;
  });
  const valid = lines.every((l) => l !== null);
  const okLines = lines.filter((l): l is MealLine => l !== null);
  const drafts = valid
    ? linesToDrafts(
        okLines,
        date,
        source.keepTimes ? null : (defaultTime as LocalTime),
      )
    : null;
  const sum = (pick: (l: MealLine) => number | null): number | null => {
    if (!valid) return null;
    let total = 0;
    for (const l of okLines) {
      const v = pick(l);
      if (v === null) return null;
      total += v;
    }
    return Math.round(total * 10) / 10;
  };

  async function add(): Promise<void> {
    if (drafts === null || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      // Tout ou rien : `createMany` valide tout avant d'écrire, dans une seule transaction.
      await data.transaction(async (repos) =>
        (await repos.mealEntries()).createMany(drafts),
      );
      onSaved();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  async function saveFavorite(): Promise<void> {
    setFavNote(null);
    setFavError(null);
    if (name.trim() === "") return setFavError(tQuick("favoriteNameNeeded"));
    const fav = favoriteFromLines(name, okLines);
    if (fav === null) return setFavError(tQuick("favoriteNothing"));
    try {
      await (await data.repos.recipes()).create(fav.draft);
      setFavNote(
        tQuick("favoriteSaved", { name: fav.draft.name }) +
          (fav.skipped > 0
            ? ` ${tQuick("favoriteSkipped", { n: fav.skipped })}`
            : ""),
      );
      setName("");
    } catch {
      setFavError(tQuick("favoriteError"));
    }
  }

  const kcal = sum((l) => l.kcal);
  return (
    <div className="ct-nutrition__panel ct-nutrition__form ct-flat">
      <h2 className="ct-nutrition__subtitle ct-section-title">
        {tQuick("previewTitle", { title: source.title })}
      </h2>
      <p className="ct-nutrition__muted">{tQuick("previewHint")}</p>
      <ul className="ct-nutrition__entries" aria-label={tQuick("linesLabel")}>
        {source.lines.map((line, i) => {
          const shown = lines[i];
          return (
            <li key={`${line.foodName}-${i}`} className="ct-nutrition__entry">
              <div className="ct-nutrition__entry-main">
                <p className="ct-nutrition__entry-name">
                  <span>{line.foodName}</span>{" "}
                  <ProvenanceBadge source={line.source} />
                  {line.method === "photo" ? (
                    <span className="ct-nutrition__muted">
                      {" "}
                      · {tQuick("estimate")}
                    </span>
                  ) : null}
                </p>
                {shown ? (
                  <MacroLine
                    p={orDash(shown.proteinG)}
                    c={orDash(shown.carbG)}
                    f={orDash(shown.fatG)}
                  />
                ) : null}
              </div>
              {line.grams === null ? (
                <p className="ct-nutrition__muted">{tQuick("noGrams")}</p>
              ) : (
                <NumberField
                  label={tQuick("gramsOf", { name: line.foodName })}
                  value={texts[i] ?? ""}
                  onChange={(v) =>
                    setTexts((t) => t.map((x, j) => (j === i ? v : x)))
                  }
                  invalid={shown === null}
                />
              )}
              <p className="ct-nutrition__entry-kcal ct-nutrition__num">
                {shown?.kcal == null
                  ? tQuick("kcalUnknown")
                  : tQuick("kcal", { n: formatInt(shown.kcal) })}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="ct-nutrition__totals">
        <strong className="ct-nutrition__num">
          {tQuick("total")} :{" "}
          {kcal === null
            ? tQuick("kcalUnknown")
            : tQuick("kcal", { n: formatInt(kcal) })}
        </strong>
      </p>
      {valid ? null : (
        <p role="alert" className="ct-nutrition__warning">
          {tQuick("invalid")}
        </p>
      )}
      {failed ? (
        <p role="alert" className="ct-nutrition__warning">
          {tQuick("writeError")}
        </p>
      ) : null}
      <div className="ct-nutrition__actions">
        <Button disabled={drafts === null || busy} onClick={() => void add()}>
          {tQuick("add")}
        </Button>
        <Button variant="secondary" onClick={onBack}>
          {tQuick("back")}
        </Button>
      </div>
      <div className="ct-nutrition__form">
        <label className="ct-nutrition__field">
          <span className="ct-nutrition__field-label">
            {tQuick("favoriteName")}
          </span>
          <input
            className="ct-nutrition__input"
            type="text"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <Button
          variant="secondary"
          disabled={!valid}
          onClick={() => void saveFavorite()}
        >
          {tQuick("favoriteSave")}
        </Button>
        {favNote ? <p role="status">{favNote}</p> : null}
        {favError ? (
          <p role="alert" className="ct-nutrition__warning">
            {favError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Repas rapides (§ 15.3, REPAS-029a ; D-410 : règles locales, aucune IA) : copier le repas ou la journée d'hier, reprendre un repas récent,
 * rejouer un favori. Chaque geste ouvre un APERÇU aux quantités modifiables ; rien n'est écrit avant « Ajouter au journal » (tout ou rien).
 */
export function QuickMeals({
  date,
  defaultTime,
  onSaved,
  onClose,
}: QuickMealsProps) {
  const { data } = useAppContainer();
  const [load, setLoad] = useState<
    | { readonly status: "loading" }
    | { readonly status: "failed" }
    | { readonly status: "ready"; readonly value: Loaded }
  >({ status: "loading" });
  const [source, setSource] = useState<Source | null>(null);
  const [empty, setEmpty] = useState<"meal" | "day" | null>(null);

  const [version, setVersion] = useState(0);
  const refresh = (): void => setVersion((v) => v + 1);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const entries = await data.repos.mealEntries();
        const recipes = await data.repos.recipes();
        const [yesterday, window, favorites] = await Promise.all([
          entries.listByDate(addDays(date, -1)),
          entries.listBetween(addDays(date, -RECENT_DAYS), date),
          recipes.list(),
        ]);
        if (live)
          setLoad({
            status: "ready",
            value: {
              yesterday: mealLines(yesterday),
              recents: recentMeals(window, date, RECENT_LIMIT),
              favorites,
            },
          });
      } catch {
        if (live) setLoad({ status: "failed" });
      }
    })();
    return () => {
      live = false;
    };
  }, [data, date, version]);

  if (source !== null)
    return (
      <Preview
        source={source}
        date={date}
        defaultTime={defaultTime}
        onSaved={onSaved}
        onBack={() => {
          setSource(null);
          refresh();
        }}
      />
    );
  if (load.status === "loading") {
    return (
      <p className="ct-nutrition__muted" role="status">
        {tQuick("loading")}
      </p>
    );
  }
  if (load.status === "failed") {
    return (
      <div className="ct-nutrition__panel ct-flat">
        <p role="alert" className="ct-nutrition__warning">
          {tQuick("loadError")}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setLoad({ status: "loading" });
            refresh();
          }}
        >
          {tQuick("retry")}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {tQuick("close")}
        </Button>
      </div>
    );
  }
  const loaded: Loaded = load.value;
  const { yesterday, recents, favorites } = loaded;
  const moment = mealMoment(defaultTime as LocalTime);
  const yesterdayMeal: MealLine[] = entriesOfMoment<MealLine>(
    yesterday,
    moment,
  );

  return (
    <div className="ct-nutrition__panel ct-nutrition__form ct-flat">
      <h2 className="ct-nutrition__subtitle ct-section-title">
        {tQuick("title")}
      </h2>
      <div className="ct-nutrition__actions">
        <Button
          onClick={() =>
            yesterdayMeal.length === 0
              ? setEmpty("meal")
              : setSource({
                  title: tQuick("copyMeal"),
                  lines: yesterdayMeal,
                  keepTimes: true,
                })
          }
        >
          {tQuick("copyMeal")}
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            yesterday.length === 0
              ? setEmpty("day")
              : setSource({
                  title: tQuick("copyDay"),
                  lines: yesterday,
                  keepTimes: true,
                })
          }
        >
          {tQuick("copyDay")}
        </Button>
      </div>
      {empty === null ? null : (
        <p role="status" className="ct-nutrition__muted">
          {tQuick(empty === "meal" ? "noMealYesterday" : "noDayYesterday")}
        </p>
      )}
      <h3 className="ct-nutrition__eyebrow ct-section-title">
        {tQuick("recentsTitle")}
      </h3>
      {recents.length === 0 ? (
        <p className="ct-nutrition__muted">{tQuick("recentsNone")}</p>
      ) : (
        <ul
          className="ct-nutrition__entries"
          aria-label={tQuick("recentsTitle")}
        >
          {recents.map((meal) => {
            const label = tQuick("recentLabel", {
              day: formatDayShort(meal.date),
              moment: tQuick(MOMENT_KEY[meal.moment]),
            });
            return (
              <li
                key={`${meal.date}/${meal.moment}`}
                className="ct-nutrition__entry"
              >
                <div className="ct-nutrition__entry-main">
                  <p className="ct-nutrition__entry-name">{label}</p>
                  <p className="ct-nutrition__muted">
                    {tQuick("summary", {
                      count: meal.lines.length,
                      names: meal.lines.map((l) => l.foodName).join(", "),
                    })}
                  </p>
                </div>
                <p className="ct-nutrition__entry-kcal ct-nutrition__num">
                  {meal.kcal === null
                    ? tQuick("kcalUnknown")
                    : tQuick("kcal", { n: formatInt(meal.kcal) })}
                </p>
                <Button
                  variant="secondary"
                  ariaLabel={tQuick("recentButton", { label })}
                  onClick={() =>
                    setSource({
                      title: label,
                      lines: meal.lines,
                      keepTimes: false,
                    })
                  }
                >
                  {tQuick("recentButton", { label })}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <h3 className="ct-nutrition__eyebrow ct-section-title">
        {tQuick("favoritesTitle")}
      </h3>
      {favorites.length === 0 ? (
        <p className="ct-nutrition__muted">{tQuick("favoritesNone")}</p>
      ) : (
        <ul
          className="ct-nutrition__entries"
          aria-label={tQuick("favoritesTitle")}
        >
          {favorites.map((fav) => (
            <li key={fav.id} className="ct-nutrition__entry">
              <div className="ct-nutrition__entry-main">
                <p className="ct-nutrition__entry-name">{fav.name}</p>
                <p className="ct-nutrition__muted">
                  {tQuick("summary", {
                    count: fav.ingredients.length,
                    names: fav.ingredients.map((i) => i.name).join(", "),
                  })}
                </p>
              </div>
              <Button
                variant="secondary"
                ariaLabel={tQuick("favoriteButton", { name: fav.name })}
                onClick={() =>
                  setSource({
                    title: fav.name,
                    lines: linesFromRecipe(fav),
                    keepTimes: false,
                  })
                }
              >
                {tQuick("favoriteButton", { name: fav.name })}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="ct-nutrition__actions">
        <Button variant="secondary" onClick={onClose}>
          {tQuick("close")}
        </Button>
      </div>
    </div>
  );
}
