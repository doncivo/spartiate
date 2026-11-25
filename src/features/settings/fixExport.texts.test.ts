import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESET_TABLES } from '../../domain/dataReset';
import { dataResetFr } from '../../i18n/fr.dataReset';
import { exportImportFr } from '../../i18n/fr.exportImport';

const FAMILIES = [/profil/i, /pesées/i, /entraînement/i, /nutrition/i, /récupération/i, /mensurations/i, /compléments/i, /cardio/i];

describe('FIX-EXPORT C-107 : textes de l’export et de l’import', () => {
  it('l’aide de l’export liste toutes les familles exportées et dit ce qui n’y est pas', () => {
    for (const f of FAMILIES) expect(exportImportFr.exportHint).toMatch(f);
    expect(exportImportFr.exportHint).toMatch(/photos/i);
    expect(exportImportFr.exportHint).toMatch(/GPS/);
  });
  it('un avertissement « données de santé en clair » existe', () => {
    expect(exportImportFr.exportWarning).toMatch(/santé/i);
    expect(exportImportFr.exportWarning).toMatch(/en clair/i);
  });
  it('mergeHint et replaceHint citent toutes les familles', () => {
    for (const f of FAMILIES) {
      expect(exportImportFr.mergeHint).toMatch(f);
      expect(exportImportFr.replaceHint).toMatch(f);
    }
    expect(exportImportFr.replaceHint).toMatch(/supprim/i);
    expect(exportImportFr.replaceHint).toMatch(/autres appareils/i);
  });
});

type Family = 'wipedProfile' | 'wipedTraining' | 'wipedSupplements' | 'wipedCardio' | 'wipedNutrition' | 'wipedBody' | 'wipedRecovery' | 'wipedTechnical';
/** Chaque table effacée : la famille de l'écran qui doit la nommer et le mot clé précis qu'elle y porte (BL-100). */
const KEYWORD: Readonly<Record<string, readonly [Family, RegExp]>> = {
  profile: ['wipedProfile', /^Profil, objectifs/],
  body_weight: ['wipedBody', /^Pesées/],
  exercise: ['wipedTraining', /Exercices perso/],
  equipment_profile: ['wipedTraining', /profils de matériel/],
  routine: ['wipedTraining', /routines/],
  routine_day: ['wipedTraining', /programmes/],
  routine_exercise: ['wipedTraining', /programmes/],
  workout: ['wipedTraining', /séances et séries/],
  workout_set: ['wipedTraining', /séances et séries/],
  progression_profile: ['wipedTraining', /progression et décisions/],
  recommendation_decision: ['wipedTraining', /progression et décisions/],
  mesocycle: ['wipedTraining', /cycles/],
  food: ['wipedNutrition', /aliments perso/],
  food_portion: ['wipedNutrition', /aliments perso/],
  meal_entry: ['wipedNutrition', /^Journal alimentaire/],
  nutrition_target: ['wipedNutrition', /cibles et check-ins/],
  day_completeness: ['wipedNutrition', /journées complètes/],
  recipe: ['wipedNutrition', /recettes/],
  recipe_ingredient: ['wipedNutrition', /recettes/],
  recovery_day: ['wipedRecovery', /^Récupération : résumés/],
  muscle_recovery: ['wipedRecovery', /^Récupération : résumés/],
  recovery_factor: ['wipedRecovery', /facteurs/],
  measurement: ['wipedBody', /mensurations/],
  progress_photo: ['wipedBody', /photos \(fiches et fichiers\)/],
  food_favorite: ['wipedNutrition', /favoris/],
  supplement: ['wipedSupplements', /^Compléments/],
  supplement_intake: ['wipedSupplements', /prises$/],
  cardio_session: ['wipedCardio', /^Séances de cardio/],
  // SYNC-0291 : gênes déclarées (table publiée injury), effacées.
  injury: ['wipedProfile', /gênes déclarées/],
  progress_photo_file: ['wipedBody', /photos \(fiches et fichiers\)/],
  cardio_track: ['wipedCardio', /tracés GPS/],
  recovery_sample: ['wipedRecovery', /échantillons importés/],
  recovery_import_state: ['wipedRecovery', /échantillons importés/],
  conflict_log: ['wipedTechnical', /^Conflits de synchro/],
  epoch_carry_report: ['wipedTechnical', /comptes rendus de report/],
};

/** Les clés réellement rendues par l'écran : la liste `WIPED` de ResetDataScreen.tsx, lue dans la source (BL-100), pas les clés du catalogue. */
const screenSource = readFileSync(join(import.meta.dirname, 'ResetDataScreen.tsx'), 'utf8');
const SCREEN_KEYS = [...(/const WIPED[^=]*= \[([^\]]*)\]/.exec(screenSource)?.[1] ?? '').matchAll(/'(wiped[A-Za-z]+)'/g)].map((m) => m[1] as Family);

describe('FIX-EXPORT C-108 : « Ce qui est effacé » couvre chaque table effacée', () => {
  const catalogKeys = Object.keys(dataResetFr).filter((k) => k.startsWith('wiped') && k !== 'wipedTitle');
  const wiped = Object.entries(RESET_TABLES)
    .filter(([, f]) => f === 'wiped')
    .map(([t]) => t);
  it('l’écran rend exactement les familles du catalogue (aucune écrite et jamais affichée)', () => {
    expect([...SCREEN_KEYS].sort()).toEqual([...catalogKeys].sort());
  });
  it('chaque table effacée est déclarée, et aucune table déclarée n’est inconnue de RESET_TABLES', () => {
    expect(Object.keys(KEYWORD).sort()).toEqual([...wiped].sort());
  });
  it.each(wiped)('table %s : son mot clé précis figure dans sa famille, rendue par l’écran', (table) => {
    const entry = KEYWORD[table];
    expect(entry, `mot clé manquant pour ${table}`).toBeDefined();
    const [family, re] = entry as readonly [Family, RegExp];
    expect(SCREEN_KEYS).toContain(family);
    expect(dataResetFr[family]).toMatch(re);
  });
  it('keptContent est vrai : bibliothèque embarquée gardée, exercices perso effacés', () => {
    expect(dataResetFr.keptContent).toMatch(/bibliothèque/i);
    expect(dataResetFr.keptContent).not.toMatch(/^Le contenu fourni avec l’app : exercices,/);
    expect(dataResetFr.wipedTraining).toMatch(/exercices perso/i);
  });
});
