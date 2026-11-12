import { X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { todayLocal } from '../../domain/clock';
import { parseDecimal } from '../../domain/bodyProfile';
import {
  ONBOARDING_STEPS,
  nextStep,
  previousStep,
  validateStep,
  type OnboardingDraft,
  type OnboardingStepId,
  type StepIssueCode,
} from '../../domain/onboarding';
import { logFailure } from '../../platform/desktop/log';
import { tOnboarding, type OnboardingTextKey } from '../../i18n/onboardingText';
import { Button, Icon, useFocusTrap, useLayout } from '../../ui';
import { useAppContainer } from '../app/AppContainerContext';
import { useAppStore } from '../app/appStore';
import { useNavigationStore } from '../app/navigation';
import { loadTrainingContent, type TrainingContent } from '../training/content';
import { finishOnboarding, loadDraft, mergePrefill, parseField, readPrefill, saveDraft } from './onboardingData';
import { StepAvailability, StepExperience, StepGoal, StepYou, type FieldTexts, type StepProps } from './StepsBasics';
import { StepEquipment, StepPriorities, StepResult, StepSplit } from './StepsPlan';
import './OnboardingFlow.css';

const TITLE_KEY: Readonly<Record<OnboardingStepId, OnboardingTextKey>> = {
  you: 'youTitle',
  goal: 'goalTitle',
  experience: 'experienceTitle',
  availability: 'availabilityTitle',
  equipment: 'equipmentTitle',
  priorities: 'prioritiesTitle',
  split: 'splitTitle',
  result: 'resultTitle',
};
const TEXT_KEY: Readonly<Record<OnboardingStepId, OnboardingTextKey>> = {
  you: 'youText',
  goal: 'goalText',
  experience: 'experienceText',
  availability: 'availabilityText',
  equipment: 'equipmentText',
  priorities: 'prioritiesText',
  split: 'splitText',
  result: 'resultText',
};

export interface OnboardingFlowProps {
  /** `first-launch` : premier lancement sur base vide ; `review` : « Revoir mes réglages » (Plus › Profil). */
  readonly mode: 'first-launch' | 'review';
  /** `done` : « Commencer » (tout est enregistré) ; `closed` : fermé sans terminer (le brouillon reste). */
  readonly onClose: (reason: 'done' | 'closed') => void;
}

const asText = (n: number | null): string => (n === null ? '' : String(n).replace('.', ','));
const asInteger = (text: string): number | null => {
  const value = parseField(text);
  return value !== null && Number.isInteger(value) ? value : null;
};

/**
 * Onboarding Spartiate en 8 écrans (PRD § 10.1), plein écran sur iPhone (440 px) et carte centrée sur PC. Un écran à la fois : précédent,
 * suivant, passer (toute question non essentielle est ignorable), brouillon enregistré à chaque changement (reprise après fermeture).
 * Rien n'est écrit dans le profil, la nutrition ni les routines avant « Commencer » (une transaction, tout ou rien).
 */
export function OnboardingFlow({ onClose }: OnboardingFlowProps) {
  const container = useAppContainer();
  const layout = useLayout();
  const navigate = useNavigationStore((s) => s.navigate);
  const timeZone = useAppStore((s) => s.timeZone) ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [today] = useState(() => todayLocal(container.clock));
  const year = Number(today.slice(0, 4));
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [prefillWeightKg, setPrefillWeightKg] = useState<number | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [content, setContent] = useState<TrainingContent | 'error' | null>(null);
  const [texts, setTexts] = useState<FieldTexts>({ birthYear: '', heightCm: '', weightKg: '', expenditureKcal: '' });
  const [issues, setIssues] = useState<readonly StepIssueCode[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
  const close = (): void => {
    // Pendant l'écriture finale, fermer ferait deux sorties : ignoré.
    if (!busyRef.current) onClose('closed');
  };
  const trapRef = useFocusTrap<HTMLElement>({ active: true, onEscape: close });
  const { data } = container;

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [saved, prefill] = await Promise.all([loadDraft(data), readPrefill(data)]);
        if (!live) return;
        const merged = mergePrefill(saved, prefill);
        setPrefillWeightKg(prefill.weightKg ?? null);
        setTexts({ birthYear: asText(merged.birthYear), heightCm: asText(merged.heightCm), weightKg: asText(merged.weightKg), expenditureKcal: asText(merged.expenditureKcal) });
        setDraft(merged);
      } catch (error) {
        logFailure('onboarding-load', error);
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
        logFailure('onboarding-content', error);
        if (live) setContent('error');
      },
    );
    return () => {
      live = false;
    };
  }, []);

  const step = draft?.step ?? 'you';
  // Le titre de l'écran reçoit le focus à chaque changement d'écran : lecteur d'écran et clavier repartent du haut de l'écran.
  const ready = draft !== null;
  useLayoutEffect(() => {
    if (ready) headingRef.current?.focus();
  }, [step, ready]);

  // Un « Continuer » refusé envoie le focus au premier champ en erreur (sinon à l'alerte) : clavier et lecteur d'écran n'ont pas à le chercher.
  useEffect(() => {
    if (issues.length === 0) return;
    const panel = document.querySelector('.ct-onb__panel');
    const target = panel?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? panel?.querySelector<HTMLElement>('.ct-onb__body [role="alert"]');
    target?.focus();
  }, [issues]);

  const commit = useCallback(
    (next: OnboardingDraft) => {
      setDraft(next);
      saveDraft(data, next).then(
        () => setNotice((current) => (current === tOnboarding('saveDraftError') ? null : current)),
        (error: unknown) => {
          logFailure('onboarding-draft', error);
          setNotice(tOnboarding('saveDraftError'));
        },
      );
    },
    [data],
  );

  if (loadFailed) {
    return (
      <Shell layout={layout} trapRef={trapRef}>
        <p role="alert">{tOnboarding('loadError')}</p>
        <Button variant="secondary" onClick={() => onClose('closed')}>
          {tOnboarding('close')}
        </Button>
      </Shell>
    );
  }
  if (draft === null) {
    return (
      <Shell layout={layout} trapRef={trapRef}>
        <p role="status">{tOnboarding('loading')}</p>
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
    if (key === 'birthYear') patch({ birthYear: asInteger(value) });
    else if (key === 'heightCm') patch({ heightCm: parseField(value) });
    else if (key === 'weightKg') patch({ weightKg: parseField(value) });
    else patch({ expenditureKcal: asInteger(value) });
  };
  /** Règles de l'écran, plus un texte saisi mais illisible (« abc ») : refusé avec le message du champ, jamais zéro. */
  const check = (): StepIssueCode[] => {
    const found = validateStep(step, draft, year).map((i) => i.code);
    const unreadable = (text: string, value: number | null): boolean => text.trim() !== '' && (value === null || Number.isNaN(parseDecimal(text)));
    if (step === 'you') {
      if (unreadable(texts.birthYear, draft.birthYear) && !found.includes('birth-year-range')) found.push('birth-year-range');
      if (unreadable(texts.heightCm, draft.heightCm) && !found.includes('height-range')) found.push('height-range');
      if (unreadable(texts.weightKg, draft.weightKg) && !found.includes('weight-range')) found.push('weight-range');
    }
    if (step === 'result' && unreadable(texts.expenditureKcal, draft.expenditureKcal) && !found.includes('expenditure-range')) found.push('expenditure-range');
    return found;
  };
  const goTo = (target: OnboardingStepId, extra: Partial<OnboardingDraft> = {}): void => {
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
    if (target !== null) goTo(target, { skipped: draft.skipped.filter((s) => s !== step) });
  };
  const onSkip = (): void => {
    const target = nextStep(step);
    if (target !== null) goTo(target, { skipped: draft.skipped.includes(step) ? draft.skipped : [...draft.skipped, step] });
  };
  const onBack = (): void => {
    const target = previousStep(step);
    if (target !== null) goTo(target);
  };
  const onFinish = async (): Promise<void> => {
    const found = check();
    if (found.length > 0) {
      setIssues(found);
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      // Contenu absent alors que la proposition est acceptée : on ne termine pas en silence, l'erreur est dite et Ali peut réessayer ou écarter la proposition.
      const wantsRoutine = draft.acceptProposal && !draft.skipped.includes('split');
      const loaded = content === 'error' || content === null ? await loadTrainingContent().catch((error: unknown) => {
        logFailure('onboarding-content', error);
        return null;
      }) : content;
      if (loaded === null && wantsRoutine) {
        setNotice(tOnboarding('contentError'));
        setBusy(false);
        return;
      }
      await finishOnboarding({ data, ids: container.ids, today, timeZone, year }, draft, loaded);
      navigate({ tab: 'today' });
      onClose('done');
    } catch (error) {
      logFailure('onboarding-finish', error);
      setNotice(tOnboarding('finishError'));
      setBusy(false);
    }
  };

  const props: StepProps = { draft, patch, issues, year, today, texts, setText, content, prefillWeightKg };
  const body =
    step === 'you' ? <StepYou {...props} /> : step === 'goal' ? <StepGoal {...props} /> : step === 'experience' ? <StepExperience {...props} /> : step === 'availability' ? <StepAvailability {...props} /> : step === 'equipment' ? <StepEquipment {...props} /> : step === 'priorities' ? <StepPriorities {...props} /> : step === 'split' ? <StepSplit {...props} /> : <StepResult {...props} />;

  return (
    <Shell layout={layout} trapRef={trapRef}>
      <header className="ct-onb__header">
        <p className="ct-onb__eyebrow">{tOnboarding('stepEyebrow', { step: index + 1, total: ONBOARDING_STEPS.length })}</p>
        <div className="ct-onb__headerActions">
          {step !== 'result' && (
            <button type="button" className="ct-onb__link" onClick={onSkip}>
              {tOnboarding('skip')}
            </button>
          )}
          <button type="button" className="ct-onb__close" aria-label={tOnboarding('close')} onClick={close}>
            <Icon icon={X} size={22} />
          </button>
        </div>
      </header>
      <div className="ct-onb__progress" role="progressbar" aria-label={tOnboarding('progressLabel')} aria-valuemin={1} aria-valuemax={ONBOARDING_STEPS.length} aria-valuenow={index + 1} aria-valuetext={tOnboarding('stepEyebrow', { step: index + 1, total: ONBOARDING_STEPS.length })}>
        {ONBOARDING_STEPS.map((id, i) => (
          <i key={id} className="ct-onb__segment" data-state={i < index ? 'done' : i === index ? 'current' : 'todo'} />
        ))}
      </div>
      <h1 ref={headingRef} id="ct-onb-title" tabIndex={-1} className="ct-onb__title">
        {tOnboarding(TITLE_KEY[step])}
      </h1>
      <p className="ct-onb__text">{tOnboarding(TEXT_KEY[step])}</p>
      <div className="ct-onb__body">{body}</div>
      {notice && (
        <p className="ct-onb__error" role="alert">
          {notice}
        </p>
      )}
      <p className="ct-onb__hint">{tOnboarding('skipHint')}</p>
      <footer className="ct-onb__footer">
        {step === 'result' ? (
          <>
            <Button variant="secondary" fullWidth onClick={() => goTo('you')} disabled={busy}>
              {tOnboarding('edit')}
            </Button>
            <Button fullWidth onClick={() => void onFinish()} disabled={busy} ariaBusy={busy}>
              {tOnboarding('start')}
            </Button>
          </>
        ) : (
          <>
            {step !== 'you' && (
              <Button variant="secondary" fullWidth onClick={onBack}>
                {tOnboarding('back')}
              </Button>
            )}
            <Button fullWidth onClick={onNext}>
              {tOnboarding('next')}
            </Button>
          </>
        )}
      </footer>
    </Shell>
  );
}

function Shell({ layout, trapRef, children }: { readonly layout: string; readonly trapRef: React.RefObject<HTMLElement>; readonly children: React.ReactNode }) {
  return (
    <div className="ct-onb" data-layout={layout}>
      <section ref={trapRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={tOnboarding('dialogLabel')} className="ct-onb__panel">
        {children}
      </section>
    </div>
  );
}
