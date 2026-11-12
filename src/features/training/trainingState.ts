import { useCallback, useEffect, useState } from 'react';
import { allExercises, backfillDumbbellExtras, LEGACY_DUMBBELL_EXTRAS_SOURCES, type CustomExercise, type EquipmentProfile, type Exercise } from '../../domain/training';
import type { DataAccess } from '../../db/repositories/dataAccess';
import { useSyncedData } from '../sync/remoteChanges';
import { loadTrainingContent, type EmbeddedProfile, type TrainingContent } from './content';

/**
 * État partagé des écrans de l'Entraînement : contenu embarqué, exercices personnalisés, profils personnels et profil ACTIF de cet appareil
 * (réglage local `training.activeEquipmentProfile`, sinon le profil embarqué par défaut). Relu après chaque écriture et à chaque lot de synchro
 * qui touche ces tables.
 */

export type PersonalProfile = EquipmentProfile & { readonly origin: 'personal' };
export type AnyProfile = EmbeddedProfile | PersonalProfile;

export interface TrainingData {
  readonly content: TrainingContent;
  readonly customs: readonly CustomExercise[];
  /** Personnalisés, supprimés compris : un exercice supprimé reste résolu par son dernier nom (P-09). */
  readonly allCustoms: readonly CustomExercise[];
  readonly personal: readonly PersonalProfile[];
  readonly profiles: readonly AnyProfile[];
  readonly active: AnyProfile;
  /** Exercices proposables : embarqués puis personnalisés actifs. */
  readonly exercises: readonly Exercise[];
}

export function resolveActiveProfile(content: TrainingContent, personal: readonly PersonalProfile[], storedId: string | null): AnyProfile {
  const all: AnyProfile[] = [...content.profiles, ...personal];
  const fallback = content.profiles.find((p) => p.id === content.defaultProfileId) ?? content.profiles[0];
  if (!fallback) throw new Error('profil de matériel par défaut absent du contenu embarqué');
  return (storedId !== null ? all.find((p) => p.id === storedId) : undefined) ?? fallback;
}

export async function readTrainingData(data: DataAccess): Promise<TrainingData> {
  const [content, exercisesRepo, profilesRepo] = await Promise.all([loadTrainingContent(), data.repos.exercises(), data.repos.equipmentProfiles()]);
  const [allCustoms, personalRows, storedId] = await Promise.all([exercisesRepo.list({ includeDeleted: true }), profilesRepo.list(), data.repos.settings.get('training.activeEquipmentProfile')]);
  const customs = allCustoms.filter((c) => c.deletedAt === null);
  // I2-04 : copie d'un profil embarqué faite avant la 0.3.0 (paire de 9 kg absente) complétée à la lecture, jamais réécrite en base.
  // FIX-0173 : l'ancien profil de salle (figé) reste une source pour ses copies d'avant la 0.3.0.
  const personal = personalRows.map((p): PersonalProfile => ({ ...backfillDumbbellExtras(p, [...content.profiles, ...LEGACY_DUMBBELL_EXTRAS_SOURCES]), origin: 'personal' }));
  return {
    content,
    customs,
    allCustoms,
    personal,
    profiles: [...content.profiles, ...personal],
    active: resolveActiveProfile(content, personal, storedId),
    exercises: allExercises(content.catalog, customs),
  };
}

/** Active un profil sur cet appareil (embarqué ou personnel) : réglage local, jamais publié. */
export async function setActiveProfile(data: DataAccess, id: string): Promise<void> {
  await data.repos.settings.set('training.activeEquipmentProfile', id);
}

export type TrainingLoad = { readonly status: 'loading' } | { readonly status: 'error' } | { readonly status: 'ready'; readonly data: TrainingData };

export function useTrainingData(data: DataAccess): { readonly state: TrainingLoad; readonly reload: () => Promise<void> } {
  const [state, setState] = useState<TrainingLoad>({ status: 'loading' });
  const synced = useSyncedData(['exercise', 'equipment_profile', 'routine', 'routine_day', 'routine_exercise']);
  const reload = useCallback(async () => {
    try {
      setState({ status: 'ready', data: await readTrainingData(data) });
    } catch {
      setState((now) => (now.status === 'ready' ? now : { status: 'error' }));
    }
  }, [data]);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const next = await readTrainingData(data);
        if (live) setState({ status: 'ready', data: next });
      } catch {
        // Base fermée avant la fin de la lecture (écran quitté) : rien à afficher ; sinon le message d'échec et « Réessayer ».
        if (live) setState((now) => (now.status === 'ready' ? now : { status: 'error' }));
      }
    })();
    return () => {
      live = false;
    };
  }, [data, synced]);
  return { state, reload };
}

/** Recherche insensible à la casse et aux accents. */
export const normalizeSearch = (text: string): string => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** Groupe d'affichage d'un exercice : celui du JSON, sinon celui du muscle principal (exercice personnalisé). */
export function exerciseGroup(exercise: Exercise, content: TrainingContent): string | null {
  if (exercise.origin === 'embedded' && exercise.group !== undefined) return exercise.group;
  const first = exercise.muscles[0];
  return first ? (content.groupOfMuscle.get(first.id) ?? null) : null;
}
