import { DEFAULT_GENERATION_CONFIG } from '../../domain/training/config';
import { capLinesToDuration, proposeSplit, type OnboardingDraft, type SplitProposal } from '../../domain/onboarding';
import type { StarterProgram, TrainingContent } from '../training/content';

/** Première séance montrée à l'écran 8 : le premier jour du programme proposé, plafonné par la durée choisie (§ 10.1). Rien n'est écrit. */
export interface FirstSession {
  readonly proposal: SplitProposal;
  readonly program: StarterProgram;
  readonly dayName: string;
  readonly items: readonly { readonly name: string; readonly sets: number; readonly reps: string }[];
  readonly estimatedMin: number;
  readonly droppedCount: number;
}

/** Proposition de split et programme de départ correspondant selon le brouillon ; `null` si le contenu n'a pas le programme. */
export function proposalFor(draft: OnboardingDraft, content: TrainingContent): { readonly proposal: SplitProposal; readonly program: StarterProgram | null } {
  const kind = content.profiles.find((p) => p.id === draft.equipmentProfileId)?.kind ?? null;
  const proposal = proposeSplit({ sessionsPerWeek: draft.sessionsPerWeek, equipmentKind: kind });
  return { proposal, program: content.programs.find((p) => p.id === proposal.programId) ?? null };
}

export function buildFirstSession(draft: OnboardingDraft, content: TrainingContent): FirstSession | null {
  if (!draft.acceptProposal || draft.skipped.includes('split')) return null;
  const { proposal, program } = proposalFor(draft, content);
  const day = program?.days[0];
  if (!program || !day) return null;
  const lines = [...day.exercises].sort((a, b) => a.position - b.position);
  const capped = capLinesToDuration(lines, draft.durationMin, DEFAULT_GENERATION_CONFIG);
  const items = lines.slice(0, capped.keptCount).map((line) => ({
    name: content.catalog.get(line.exerciseId)?.nameFr ?? line.exerciseId,
    sets: line.sets,
    reps: line.repMin !== null ? (line.repMax !== null && line.repMax !== line.repMin ? `${String(line.repMin)}–${String(line.repMax)}` : String(line.repMin)) : line.durationSec !== null ? `${String(line.durationSec)} s` : '—',
  }));
  return { proposal, program, dayName: day.name, items, estimatedMin: capped.estimatedMin, droppedCount: capped.droppedCount };
}
