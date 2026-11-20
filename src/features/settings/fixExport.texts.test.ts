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

const KEYWORD: Readonly<Record<string, RegExp>> = {
  profile: /profil/i,
  body_weight: /pesées/i,
  exercise: /exercices perso/i,
  equipment_profile: /profils de matériel/i,
  routine: /routines/i,
  routine_day: /programmes/i,
  routine_exercise: /programmes/i,
  workout: /séances/i,
  workout_set: /séries/i,
  progression_profile: /progression/i,
  recommendation_decision: /progression/i,
  mesocycle: /cycles/i,
  food: /aliments perso/i,
  food_portion: /aliments perso/i,
  meal_entry: /journal alimentaire/i,
  nutrition_target: /cibles/i,
  day_completeness: /journées complètes/i,
  recipe: /recettes/i,
  recipe_ingredient: /recettes/i,
  recovery_day: /récupération/i,
  muscle_recovery: /récupération/i,
  recovery_factor: /facteurs/i,
  measurement: /mensurations/i,
  progress_photo: /photos/i,
  food_favorite: /favoris/i,
  supplement: /compléments/i,
  supplement_intake: /prises/i,
  cardio_session: /séances de cardio/i,
  progress_photo_file: /photos/i,
  cardio_track: /tracés GPS/i,
  recovery_sample: /échantillons/i,
  recovery_import_state: /import/i,
  conflict_log: /conflits/i,
  epoch_carry_report: /comptes rendus/i,
};

describe('FIX-EXPORT C-108 : « Ce qui est effacé » couvre chaque table effacée', () => {
  const wipedText = Object.entries(dataResetFr)
    .filter(([k]) => k.startsWith('wiped') && k !== 'wipedTitle')
    .map(([, v]) => String(v))
    .join(' | ');
  const wiped = Object.entries(RESET_TABLES)
    .filter(([, f]) => f === 'wiped')
    .map(([t]) => t);
  it.each(wiped)('table %s : un mot clé est déclaré et présent dans le texte', (table) => {
    const re = KEYWORD[table];
    expect(re, `mot clé manquant pour ${table}`).toBeDefined();
    expect(wipedText).toMatch(re as RegExp);
  });
  it('keptContent est vrai : bibliothèque embarquée gardée, exercices perso effacés', () => {
    expect(dataResetFr.keptContent).toMatch(/bibliothèque/i);
    expect(dataResetFr.keptContent).not.toMatch(/^Le contenu fourni avec l’app : exercices,/);
    expect(wipedText).toMatch(/exercices perso/i);
  });
});
