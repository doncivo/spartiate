import { useEffect, useState } from "react";
import { todayLocal } from "../../domain/clock";
import {
  factorAnalysis,
  FACTOR_MIN_DAYS,
  FACTOR_MIN_OCCURRENCES,
  FACTOR_MIN_WITHOUT,
  type FactorAnalysis,
  type FactorCode,
} from "../../domain/recovery";
import type { LocalDate } from "../../domain/types";
import {
  tRecoveryFactors,
  type RecoveryFactorsTextKey,
} from "../../i18n/recoveryFactorsText";
import { Button } from "../../ui";
import { useAppContainer } from "../app/AppContainerContext";
import { useSyncedData } from "../sync/remoteChanges";
import "./RecoveryToday.css";

/**
 * Progrès › Récupération (I6-01 point B, § 16.7) : écart moyen de Recovery avec et sans chaque facteur, après `FACTOR_MIN_DAYS` jours renseignés et
 * `FACTOR_MIN_OCCURRENCES` occurrences. Lecture seule ; calcul dans le domaine (`factorAnalysis`). « Association observée, pas une cause » est dit
 * tel quel. Écart en texte (« plus bas », « plus haut »), jamais par la couleur seule. Bloc chargé à la demande avec son catalogue de textes.
 */

/** Fenêtre de lecture du journal et des résumés (jours) : une année glissante. */
export const FACTOR_WINDOW_DAYS = 365;

type Load =
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | {
      readonly status: "ready";
      readonly analysis: FactorAnalysis;
      readonly entered: number;
    };

const FACTOR_TEXT = {
  alcohol: "factor_alcohol",
  caffeine_late: "factor_caffeine_late",
  late_meal: "factor_late_meal",
  stress: "factor_stress",
  soreness: "factor_soreness",
  illness: "factor_illness",
  travel: "factor_travel",
  late_training: "factor_late_training",
} as const satisfies Record<FactorCode, RecoveryFactorsTextKey>;

const shift = (day: string, delta: number): LocalDate =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) + delta * 86_400_000)
    .toISOString()
    .slice(0, 10) as LocalDate;
const fr = (n: number): string => String(n).replace(".", ",");

export function RecoveryProgress() {
  const container = useAppContainer();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const synced = useSyncedData(["recovery_day", "recovery_factor"]);
  const today = todayLocal(container.clock);

  useEffect(() => {
    let live = true;
    (async () => {
      const { repos } = container.data;
      const from = shift(today, -FACTOR_WINDOW_DAYS);
      const journal = await (await repos.recoveryFactors()).list(from, today);
      const days = await (await repos.recovery()).listDays(from, today);
      const analysis = factorAnalysis(
        journal.map((j) => ({ day: j.day, factors: j.factors, none: j.none })),
        days.map((d) => ({ day: d.summary.day, recovery: d.summary.recovery })),
      );
      return { status: "ready", analysis, entered: journal.length } as const;
    })().then(
      (result) => {
        if (live) setLoad(result);
      },
      () => {
        if (live) setLoad({ status: "failed" });
      },
    );
    return () => {
      live = false;
    };
  }, [container, today, synced, attempt]);

  if (load.status === "loading") {
    return (
      <p role="status" className="ct-today__muted">
        {tRecoveryFactors("loading")}
      </p>
    );
  }
  if (load.status === "failed") {
    return (
      <section className="ct-today__card ct-recovery" role="alert">
        <p className="ct-today__text">{tRecoveryFactors("loadFailed")}</p>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            setLoad({ status: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          {tRecoveryFactors("retry")}
        </Button>
      </section>
    );
  }

  const { analysis, entered } = load;
  return (
    <section
      className="ct-today__card ct-recovery"
      aria-labelledby="ct-progress-factors-title"
    >
      <h2 id="ct-progress-factors-title" className="ct-today__eyebrow">
        {tRecoveryFactors("progressTitle")}
      </h2>
      {entered === 0 ? (
        <p className="ct-today__text">{tRecoveryFactors("progressEmpty")}</p>
      ) : !analysis.enough ? (
        <p className="ct-today__text">
          {tRecoveryFactors("progressNotEnough", {
            n: analysis.pairedDays,
            min: FACTOR_MIN_DAYS,
          })}
        </p>
      ) : analysis.associations.length === 0 ? (
        <p className="ct-today__text">
          {tRecoveryFactors("progressNoPair", {
            occ: FACTOR_MIN_OCCURRENCES,
            without: FACTOR_MIN_WITHOUT,
          })}
        </p>
      ) : (
        <>
          <ul className="ct-progress-factors__list">
            {analysis.associations.map((a) => {
              const abs = Math.abs(a.difference);
              const diff =
                a.difference === 0
                  ? "progressSame"
                  : a.difference < 0
                    ? abs === 1
                      ? "progressLowerOne"
                      : "progressLower"
                    : abs === 1
                      ? "progressHigherOne"
                      : "progressHigher";
              return (
                <li
                  key={a.factor}
                  aria-label={tRecoveryFactors(FACTOR_TEXT[a.factor])}
                  className="ct-today__text"
                >
                  <strong>{tRecoveryFactors(FACTOR_TEXT[a.factor])}</strong>
                  <br />
                  {tRecoveryFactors("progressDaysWith", {
                    n: a.withDays,
                    mean: fr(a.withMean),
                  })}
                  <br />
                  {tRecoveryFactors("progressDaysWithout", {
                    n: a.withoutDays,
                    mean: fr(a.withoutMean),
                  })}
                  <br />
                  {tRecoveryFactors(diff, { d: fr(abs) })}
                </li>
              );
            })}
          </ul>
          <p className="ct-today__muted ct-recovery__disclaimer">
            {tRecoveryFactors("progressNote")}
          </p>
        </>
      )}
    </section>
  );
}
