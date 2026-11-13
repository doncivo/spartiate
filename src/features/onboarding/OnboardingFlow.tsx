import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { todayLocal } from "../../domain/clock";
import {
  parseDecimal,
  type BodyGoal,
  type Experience,
  type Sex,
} from "../../domain/bodyProfile";
import type { ActivityLevel } from "../../domain/nutrition/config";
import {
  GOAL_RATE_MAX_PCT,
  GOAL_RATE_MIN_PCT,
  ONBOARDING_STEPS,
  RATE_GOALS,
  nextStep,
  previousStep,
  validateStep,
  type ChangeField,
  type ChangeValue,
  type OnboardingChange,
  type OnboardingDraft,
  type OnboardingStepId,
  type StepIssueCode,
} from "../../domain/onboarding";
import { logFailure } from "../../platform/desktop/log";
import {
  healthKit as platformHealthKit,
  type HealthKit,
} from "../../platform/healthkit";
import {
  formatDecimal,
  tOnboarding,
  type OnboardingTextKey,
} from "../../i18n/onboardingText";
import { Button, Icon, useFocusTrap, useLayout } from "../../ui";
import { useAppContainer } from "../app/AppContainerContext";
import { useAppStore } from "../app/appStore";
import { useNavigationStore } from "../app/navigation";
import { RATES as RATE_OPTIONS } from "./StepsBasics";
import { loadTrainingContent, type TrainingContent } from "../training/content";
import {
  finishOnboarding,
  loadStart,
  parseField,
  previewChanges,
  saveDraft,
} from "./onboardingData";
import {
  StepAvailability,
  StepExperience,
  StepGoal,
  StepYou,
  type FieldTexts,
  type StepProps,
} from "./StepsBasics";
import {
  StepEquipment,
  StepPriorities,
  StepResult,
  StepSplit,
} from "./StepsPlan";
import "./OnboardingFlow.css";

const TITLE_KEY: Readonly<Record<OnboardingStepId, OnboardingTextKey>> = {
  you: "youTitle",
  goal: "goalTitle",
  experience: "experienceTitle",
  availability: "availabilityTitle",
  equipment: "equipmentTitle",
  priorities: "prioritiesTitle",
  split: "splitTitle",
  result: "resultTitle",
};
const NAME_KEY: Readonly<Record<OnboardingStepId, OnboardingTextKey>> = {
  you: "stepNameYou",
  goal: "stepNameGoal",
  experience: "stepNameExperience",
  availability: "stepNameAvailability",
  equipment: "stepNameEquipment",
  priorities: "stepNamePriorities",
  split: "stepNameSplit",
  result: "stepNameResult",
};
const TEXT_KEY: Readonly<Record<OnboardingStepId, OnboardingTextKey>> = {
  you: "youText",
  goal: "goalText",
  experience: "experienceText",
  availability: "availabilityText",
  equipment: "equipmentText",
  priorities: "prioritiesText",
  split: "splitText",
  result: "resultText",
};

export interface OnboardingFlowProps {
  /** `first-launch` : premier lancement sur base vide ; `review` : « Revoir mes réglages » (Plus › Profil). */
  readonly mode: "first-launch" | "review";
  /** `done` : « Commencer » (tout est enregistré) ; `closed` : fermé sans terminer (le brouillon reste). */
  readonly onClose: (reason: "done" | "closed") => void;
  /** Lecture Santé du poids (iPhone seulement, jamais de demande d'autorisation ici) ; défaut : la façade de la plateforme. */
  readonly healthKit?: HealthKit;
}

const asText = (n: number | null): string =>
  n === null ? "" : String(n).replace(".", ",");
const asInteger = (text: string): number | null => {
  const value = parseField(text);
  return value !== null && Number.isInteger(value) ? value : null;
};

/**
 * Onboarding Spartiate en 8 écrans (PRD § 10.1), plein écran sur iPhone (440 px) et carte centrée sur PC. Un écran à la fois : précédent,
 * suivant, passer (toute question non essentielle est ignorable), brouillon enregistré à chaque changement (reprise après fermeture).
 * Rien n'est écrit dans le profil, la nutrition ni les routines avant « Commencer » (une transaction, tout ou rien).
 */
export function OnboardingFlow({
  onClose,
  healthKit = platformHealthKit,
}: OnboardingFlowProps) {
  const container = useAppContainer();
  const layout = useLayout();
  const navigate = useNavigationStore((s) => s.navigate);
  const timeZone =
    useAppStore((s) => s.timeZone) ??
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [today] = useState(() => todayLocal(container.clock));
  const year = Number(today.slice(0, 4));
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [prefillWeightKg, setPrefillWeightKg] = useState<number | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [content, setContent] = useState<TrainingContent | "error" | null>(
    null,
  );
  const [texts, setTexts] = useState<FieldTexts>({
    birthYear: "",
    heightCm: "",
    weightKg: "",
    expenditureKcal: "",
  });
  const [issues, setIssues] = useState<readonly StepIssueCode[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [healthSource, setHealthSource] = useState<string | null>(null);
  const [startMeta, setStartMeta] = useState<{
    readonly baseline: OnboardingDraft | null;
    readonly persist: boolean;
  } | null>(null);
  /** Remplacements à confirmer avant l'écriture finale, et ceux que l'utilisateur refuse (décochés). */
  const [confirming, setConfirming] = useState<{
    readonly changes: readonly OnboardingChange[];
    readonly refused: ReadonlySet<ChangeField>;
  } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
  const close = (): void => {
    // Pendant l'écriture finale, fermer ferait deux sorties : ignoré.
    if (!busyRef.current) onClose("closed");
  };
  const trapRef = useFocusTrap<HTMLElement>({ active: true, onEscape: close });
  const { data } = container;

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        // FIX-0171 (constat 6) : brouillon inachevé repris tel quel ; assistant terminé revu depuis les données actuelles, sans brouillon enregistré.
        const start = await loadStart(data);
        if (!live) return;
        const merged = start.draft;
        setPrefillWeightKg(start.prefillWeightKg);
        setStartMeta({ baseline: start.baseline, persist: start.persist });
        setTexts({
          birthYear: asText(merged.birthYear),
          heightCm: asText(merged.heightCm),
          weightKg: asText(merged.weightKg),
          expenditureKcal: asText(merged.expenditureKcal),
        });
        setDraft(merged);
      } catch (error) {
        logFailure("onboarding-load", error);
        if (live) setLoadFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [data]);

  useEffect(() => {
    let live = true;
    loadTrainingContent().then(
      (loaded) => live && setContent(loaded),
      (error: unknown) => {
        logFailure("onboarding-content", error);
        if (live) setContent("error");
      },
    );
    return () => {
      live = false;
    };
  }, []);

  const step = draft?.step ?? "you";
  // Le titre de l'écran reçoit le focus à chaque changement d'écran : lecteur d'écran et clavier repartent du haut de l'écran.
  const ready = draft !== null;
  useLayoutEffect(() => {
    if (ready) headingRef.current?.focus();
  }, [step, ready]);

  // Un « Continuer » refusé envoie le focus au premier champ en erreur (sinon à l'alerte) : clavier et lecteur d'écran n'ont pas à le chercher.
  useEffect(() => {
    if (issues.length === 0) return;
    const panel = document.querySelector(".ct-onb__panel");
    const target =
      panel?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      panel?.querySelector<HTMLElement>('.ct-onb__body [role="alert"]');
    target?.focus();
  }, [issues]);

  const persist = startMeta?.persist ?? false;
  const commit = useCallback(
    (next: OnboardingDraft) => {
      setDraft(next);
      setConfirming(null);
      // Revue d'un assistant terminé : rien n'est écrit avant la fin (aucun brouillon qui reprendrait le pas sur les données actuelles).
      if (!persist) return;
      saveDraft(data, next).then(
        () =>
          setNotice((current) =>
            current === tOnboarding("saveDraftError") ? null : current,
          ),
        (error: unknown) => {
          logFailure("onboarding-draft", error);
          setNotice(tOnboarding("saveDraftError"));
        },
      );
    },
    [data, persist],
  );

  // ERGO-02 (C6) : sur iPhone seulement, le poids lu dans Santé (lecture existante, autorisation déjà accordée) remplit un champ encore vide.
  // Jamais de demande d'autorisation ici, jamais de lecture sur PC ; un champ déjà rempli ou saisi n'est jamais remplacé.
  const healthTried = useRef(false);
  /** Poids lu dans Santé et posé dans le champ (null : aucun) ; comparé à la fin pour ne pas en faire une pesée s'il n'a pas été modifié. */
  const healthPrefillKg = useRef<number | null>(null);
  const latest = useRef<{ draft: OnboardingDraft | null; texts: FieldTexts }>({
    draft: null,
    texts,
  });
  useEffect(() => {
    latest.current = { draft, texts };
  }, [draft, texts]);
  useEffect(() => {
    if (draft === null || layout !== "mobile" || healthTried.current) return;
    healthTried.current = true;
    healthKit.bodyMassToday().then(
      (read) => {
        const current = latest.current;
        if (
          read.state !== "granted" ||
          current.draft === null ||
          current.draft.weightKg !== null ||
          current.texts.weightKg.trim() !== ""
        )
          return;
        setTexts((old) => ({ ...old, weightKg: asText(read.value.kg) }));
        healthPrefillKg.current = read.value.kg;
        setHealthSource(read.value.source.name);
        commit({ ...current.draft, weightKg: read.value.kg });
      },
      (error: unknown) => logFailure("onboarding-health", error),
    );
  }, [draft, layout, healthKit, commit]);

  if (loadFailed) {
    return (
      <Shell layout={layout} trapRef={trapRef} onKeyDown={null} side={null}>
        <p role="alert">{tOnboarding("loadError")}</p>
        <Button variant="secondary" onClick={() => onClose("closed")}>
          {tOnboarding("close")}
        </Button>
      </Shell>
    );
  }
  if (draft === null) {
    return (
      <Shell layout={layout} trapRef={trapRef} onKeyDown={null} side={null}>
        <p role="status">{tOnboarding("loading")}</p>
      </Shell>
    );
  }

  const index = ONBOARDING_STEPS.indexOf(step);
  const patch = (partial: Partial<OnboardingDraft>): void => {
    setIssues([]);
    commit({ ...draft, ...partial });
  };
  const setText = (key: keyof FieldTexts, value: string): void => {
    setTexts((old) => ({ ...old, [key]: value }));
    if (key === "birthYear") patch({ birthYear: asInteger(value) });
    else if (key === "heightCm") patch({ heightCm: parseField(value) });
    else if (key === "weightKg") patch({ weightKg: parseField(value) });
    else patch({ expenditureKcal: asInteger(value) });
  };
  /** Règles de l'écran, plus un texte saisi mais illisible (« abc ») : refusé avec le message du champ, jamais zéro. */
  const check = (): StepIssueCode[] => {
    const found = validateStep(step, draft, year).map((i) => i.code);
    const unreadable = (text: string, value: number | null): boolean =>
      text.trim() !== "" &&
      (value === null || Number.isNaN(parseDecimal(text)));
    if (step === "you") {
      if (
        unreadable(texts.birthYear, draft.birthYear) &&
        !found.includes("birth-year-range")
      )
        found.push("birth-year-range");
      if (
        unreadable(texts.heightCm, draft.heightCm) &&
        !found.includes("height-range")
      )
        found.push("height-range");
      if (
        unreadable(texts.weightKg, draft.weightKg) &&
        !found.includes("weight-range")
      )
        found.push("weight-range");
    }
    if (
      step === "result" &&
      unreadable(texts.expenditureKcal, draft.expenditureKcal) &&
      !found.includes("expenditure-range")
    )
      found.push("expenditure-range");
    return found;
  };
  const goTo = (
    target: OnboardingStepId,
    extra: Partial<OnboardingDraft> = {},
  ): void => {
    setIssues([]);
    commit({ ...draft, ...extra, step: target });
  };
  const onNext = (): void => {
    const found = check();
    if (found.length > 0) {
      setIssues(found);
      return;
    }
    const target = nextStep(step);
    if (target !== null)
      goTo(target, { skipped: draft.skipped.filter((s) => s !== step) });
  };
  const onSkip = (): void => {
    const target = nextStep(step);
    if (target !== null)
      goTo(target, {
        skipped: draft.skipped.includes(step)
          ? draft.skipped
          : [...draft.skipped, step],
      });
  };
  const onBack = (): void => {
    const target = previousStep(step);
    if (target !== null) goTo(target);
  };
  const baseline = startMeta?.baseline ?? null;
  const onFinish = async (
    refused: ReadonlySet<ChangeField> | null,
  ): Promise<void> => {
    const found = check();
    if (found.length > 0) {
      setIssues(found);
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      // FIX-0171 (constat 6) : une valeur qui en remplace une déjà enregistrée est confirmée (ou refusée) avant toute écriture.
      if (refused === null) {
        const replacements = (
          await previewChanges(data, draft, baseline)
        ).filter((c) => c.replaces);
        if (replacements.length > 0) {
          setConfirming({ changes: replacements, refused: new Set() });
          setBusy(false);
          return;
        }
      }
      // Contenu absent alors que la proposition est acceptée : on ne termine pas en silence, l'erreur est dite et Ali peut réessayer ou écarter la proposition.
      const wantsRoutine =
        draft.acceptProposal && !draft.skipped.includes("split");
      const loaded =
        content === "error" || content === null
          ? await loadTrainingContent().catch((error: unknown) => {
              logFailure("onboarding-content", error);
              return null;
            })
          : content;
      if (loaded === null && wantsRoutine) {
        setNotice(tOnboarding("contentError"));
        setBusy(false);
        return;
      }
      await finishOnboarding(
        { data, ids: container.ids, today, timeZone, year },
        draft,
        loaded,
        {
          baseline,
          refused: [...(refused ?? [])],
          healthPrefillKg: healthPrefillKg.current,
        },
      );
      navigate({ tab: "today" });
      onClose("done");
    } catch (error) {
      logFailure("onboarding-finish", error);
      setNotice(tOnboarding("finishError"));
      setBusy(false);
    }
  };

  const props: StepProps = {
    draft,
    patch,
    issues,
    year,
    today,
    texts,
    setText,
    content,
    prefillWeightKg,
    layout,
    healthSource,
  };
  const pc = layout === "pc";
  /** Raccourcis PC (aperçu) : Entrée continue, 1 / 2 / 3 choisissent l'expérience, ← → règlent les séances ou le rythme. Jamais depuis un bouton ou un choix. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (
      !pc ||
      busy ||
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    const target = event.target as HTMLElement;
    const interactive =
      target.closest(
        'button, a, select, textarea, [role="radio"], [role="switch"], input:not([type="text"])',
      ) !== null;
    if (interactive) return;
    const inField = target.tagName === "INPUT";
    if (event.key === "Enter") {
      event.preventDefault();
      if (step === "result") {
        if (!confirming) void onFinish(null);
      } else onNext();
      return;
    }
    if (inField) return;
    if (step === "experience" && ["1", "2", "3"].includes(event.key)) {
      const level = (["beginner", "intermediate", "advanced"] as const)[
        Number(event.key) - 1
      ];
      if (level !== undefined) {
        event.preventDefault();
        patch({ experience: level });
      }
      return;
    }
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const direction = event.key === "ArrowRight" ? 1 : -1;
    if (step === "availability") {
      const choices = [1, 2, 3, 4, 5, 6, 7];
      const at =
        draft.sessionsPerWeek === null
          ? -1
          : choices.indexOf(draft.sessionsPerWeek);
      const next =
        choices[
          at === -1
            ? direction === 1
              ? 0
              : choices.length - 1
            : Math.min(choices.length - 1, Math.max(0, at + direction))
        ];
      if (next !== undefined) {
        event.preventDefault();
        patch({ sessionsPerWeek: next });
      }
    } else if (
      step === "goal" &&
      draft.goal !== null &&
      RATE_GOALS.includes(draft.goal)
    ) {
      const rates = (RATE_OPTIONS[draft.goal] ?? []).filter(
        (r) => r >= GOAL_RATE_MIN_PCT && r <= GOAL_RATE_MAX_PCT,
      );
      const sorted = [...rates].sort((a, b) => a - b);
      const at =
        draft.weeklyRatePct === null ? -1 : sorted.indexOf(draft.weeklyRatePct);
      const next =
        sorted[
          at === -1
            ? direction === 1
              ? 0
              : sorted.length - 1
            : Math.min(sorted.length - 1, Math.max(0, at + direction))
        ];
      if (next !== undefined) {
        event.preventDefault();
        patch({ weeklyRatePct: next });
      }
    }
  };
  const body =
    step === "you" ? (
      <StepYou {...props} />
    ) : step === "goal" ? (
      <StepGoal {...props} />
    ) : step === "experience" ? (
      <StepExperience {...props} />
    ) : step === "availability" ? (
      <StepAvailability {...props} />
    ) : step === "equipment" ? (
      <StepEquipment {...props} />
    ) : step === "priorities" ? (
      <StepPriorities {...props} />
    ) : step === "split" ? (
      <StepSplit {...props} />
    ) : (
      <StepResult {...props} />
    );

  const closeButton = (
    <button
      type="button"
      className="ct-onb__close"
      aria-label={tOnboarding("close")}
      onClick={close}
    >
      <Icon icon={X} size="lg" />
    </button>
  );
  const skipLink =
    step !== "result" ? (
      <button type="button" className="ct-onb__link" onClick={onSkip}>
        {tOnboarding("skip")}
      </button>
    ) : null;
  const side = pc ? (
    <aside className="ct-onb__side">
      <p className="ct-onb__brand">{tOnboarding("brandPc")}</p>
      <p className="ct-onb__sideTitle">{tOnboarding("sideTitle")}</p>
      {/* Liste nommée, pas une navigation : les étapes ne sont pas des liens (une seule « navigation » à l'écran, celle de l'app). */}
      <ol className="ct-onb__steps" aria-label={tOnboarding("sideLabel")}>
        {ONBOARDING_STEPS.map((id, i) => {
          const state = i < index ? "done" : i === index ? "current" : "todo";
          return (
            <li
              key={id}
              className="ct-onb__stepItem"
              data-state={state}
              {...(state === "current"
                ? { "aria-current": "step" as const }
                : {})}
            >
              <i className="ct-onb__stepDot" aria-hidden="true">
                {state === "done" ? "✓" : i + 1}
              </i>
              <span>{tOnboarding(NAME_KEY[id])}</span>
              {state !== "todo" && (
                <span className="ct-visually-hidden">
                  {tOnboarding(
                    state === "done" ? "stepStateDone" : "stepStateCurrent",
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="ct-onb__sideNote">{tOnboarding("sideNote")}</p>
    </aside>
  ) : null;
  const keyHint =
    step === "result"
      ? "hintStart"
      : step === "you"
        ? "hintEnterTab"
        : step === "experience"
          ? "hintDigits"
          : "hintEnter";

  return (
    <Shell layout={layout} trapRef={trapRef} onKeyDown={onKeyDown} side={side}>
      <header className="ct-onb__header">
        <p className="ct-onb__eyebrow">
          {tOnboarding("stepEyebrow", {
            step: index + 1,
            total: ONBOARDING_STEPS.length,
          })}
        </p>
        <div className="ct-onb__headerActions">
          {!pc && (
            <span className="ct-onb__duration">{tOnboarding("duration")}</span>
          )}
          {!pc && skipLink}
          {closeButton}
        </div>
      </header>
      {!pc && (
        <div
          className="ct-onb__progress"
          role="progressbar"
          aria-label={tOnboarding("progressLabel")}
          aria-valuemin={1}
          aria-valuemax={ONBOARDING_STEPS.length}
          aria-valuenow={index + 1}
          aria-valuetext={tOnboarding("stepEyebrow", {
            step: index + 1,
            total: ONBOARDING_STEPS.length,
          })}
        >
          {ONBOARDING_STEPS.map((id, i) => (
            <i
              key={id}
              className="ct-onb__segment"
              data-state={i < index ? "done" : i === index ? "current" : "todo"}
            />
          ))}
        </div>
      )}
      {!pc && step === "you" && (
        <p className="ct-onb__brand">{tOnboarding("brand")}</p>
      )}
      <h1
        ref={headingRef}
        id="ct-onb-title"
        tabIndex={-1}
        className="ct-onb__title"
      >
        {tOnboarding(TITLE_KEY[step])}
      </h1>
      <p className="ct-onb__text">{tOnboarding(TEXT_KEY[step])}</p>
      <div className="ct-onb__body" data-step={step}>
        {body}
      </div>
      {notice && (
        <p className="ct-onb__error" role="alert">
          {notice}
        </p>
      )}
      {!pc && <p className="ct-onb__hint">{tOnboarding("skipHint")}</p>}
      {step === "result" && confirming && (
        <section className="ct-onb__body" aria-labelledby="ct-onb-confirm">
          <h2 id="ct-onb-confirm" className="ct-onb__label">
            {tOnboarding("confirmTitle")}
          </h2>
          <p className="ct-onb__text">{tOnboarding("confirmText")}</p>
          {confirming.changes.map((change) => (
            <label key={change.field} className="ct-onb__check">
              <input
                type="checkbox"
                checked={!confirming.refused.has(change.field)}
                onChange={() =>
                  setConfirming((current) => {
                    if (!current) return current;
                    const next = new Set(current.refused);
                    if (next.has(change.field)) next.delete(change.field);
                    else next.add(change.field);
                    return { ...current, refused: next };
                  })
                }
              />
              <span>
                {changeLine(change, content === "error" ? null : content)}
              </span>
            </label>
          ))}
        </section>
      )}
      <footer className="ct-onb__footer">
        {step === "result" && confirming ? (
          <>
            <Button
              variant="secondary"
              fullWidth={!pc}
              onClick={() => setConfirming(null)}
              disabled={busy}
            >
              {tOnboarding("confirmBack")}
            </Button>
            <Button
              fullWidth={!pc}
              onClick={() => void onFinish(confirming.refused)}
              disabled={busy}
              ariaBusy={busy}
            >
              {tOnboarding("confirmSave")}
            </Button>
          </>
        ) : step === "result" ? (
          <>
            <Button
              variant="secondary"
              fullWidth={!pc}
              onClick={() => goTo("you")}
              disabled={busy}
            >
              {tOnboarding("edit")}
            </Button>
            <Button
              fullWidth={!pc}
              onClick={() => void onFinish(null)}
              disabled={busy}
              ariaBusy={busy}
            >
              {tOnboarding("start")}
            </Button>
            {pc && (
              <span className="ct-onb__keyHint">{tOnboarding(keyHint)}</span>
            )}
          </>
        ) : (
          <>
            {step !== "you" && (
              <Button variant="secondary" fullWidth={!pc} onClick={onBack}>
                {tOnboarding("back")}
              </Button>
            )}
            <Button fullWidth={!pc} onClick={onNext}>
              {tOnboarding("next")}
            </Button>
            {pc && (
              <span className="ct-onb__keyHint">{tOnboarding(keyHint)}</span>
            )}
            {pc && <span className="ct-onb__footerSkip">{skipLink}</span>}
          </>
        )}
      </footer>
    </Shell>
  );
}

const SEX_KEY = {
  male: "sexMale",
  female: "sexFemale",
} as const satisfies Record<Sex, OnboardingTextKey>;
const ACTIVITY_KEY = {
  sedentary: "activitySedentary",
  light: "activityLight",
  moderate: "activityModerate",
  active: "activityActive",
} as const satisfies Record<ActivityLevel, OnboardingTextKey>;
const PROFILE_GOAL_KEY = {
  gain: "profileGoalGain",
  loss: "profileGoalLoss",
  maintain: "profileGoalMaintain",
} as const satisfies Record<BodyGoal, OnboardingTextKey>;
const EXPERIENCE_KEY = {
  beginner: "experienceBeginner",
  intermediate: "experienceIntermediate",
  advanced: "experienceAdvanced",
} as const satisfies Record<Experience, OnboardingTextKey>;
const FIELD_KEY = {
  sex: "fieldSex",
  birthYear: "fieldBirthYear",
  heightCm: "fieldHeight",
  weightKg: "weightKg",
  activity: "fieldActivity",
  goal: "fieldGoal",
  experience: "fieldExperience",
  equipmentProfileId: "fieldEquipment",
  nutritionGoal: "fieldNutritionGoal",
} as const satisfies Record<ChangeField, OnboardingTextKey>;

/** Valeur d'un remplacement dite en texte (libellés du catalogue, jamais un code). */
function changeValue(
  field: ChangeField,
  value: ChangeValue | null,
  content: TrainingContent | null,
): string {
  if (value === null) return tOnboarding("unset");
  if (typeof value === "object") {
    return value.kind === "maintain"
      ? tOnboarding("nutritionMaintain")
      : tOnboarding(value.kind === "gain" ? "nutritionGain" : "nutritionLoss", {
          kg: formatDecimal(value.weeklyRateKg),
        });
  }
  switch (field) {
    case "sex":
      return tOnboarding(SEX_KEY[value as Sex]);
    case "heightCm":
      return tOnboarding("valueCm", { n: formatDecimal(Number(value)) });
    case "activity":
      return tOnboarding(ACTIVITY_KEY[value as ActivityLevel]);
    case "goal":
      return tOnboarding(PROFILE_GOAL_KEY[value as BodyGoal]);
    case "experience":
      return tOnboarding(EXPERIENCE_KEY[value as Experience]);
    case "equipmentProfileId":
      return (
        content?.profiles.find((p) => p.id === value)?.name ?? String(value)
      );
    default:
      return typeof value === "number" ? formatDecimal(value) : value;
  }
}

function changeLine(
  change: OnboardingChange,
  content: TrainingContent | null,
): string {
  if (change.field === "weightKg")
    return tOnboarding("confirmWeight", {
      after: changeValue("weightKg", change.after, content),
      before: changeValue("weightKg", change.before, content),
    });
  return tOnboarding("confirmLine", {
    label: tOnboarding(FIELD_KEY[change.field]),
    before: changeValue(change.field, change.before, content),
    after: changeValue(change.field, change.after, content),
  });
}

function Shell({
  layout,
  trapRef,
  onKeyDown,
  side,
  children,
}: {
  readonly layout: string;
  readonly trapRef: React.RefObject<HTMLElement>;
  readonly onKeyDown:
    ((event: React.KeyboardEvent<HTMLElement>) => void) | null;
  readonly side: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="ct-onb" data-layout={layout}>
      <section
        ref={trapRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={tOnboarding("dialogLabel")}
        className="ct-onb__panel"
        {...(onKeyDown ? { onKeyDown } : {})}
      >
        {side}
        <div className="ct-onb__main">{children}</div>
      </section>
    </div>
  );
}
