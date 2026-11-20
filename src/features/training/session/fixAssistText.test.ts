import { describe, expect, it } from 'vitest';
import { progressionFr } from '../../../i18n/fr.progression';
import { trainingFr } from '../../../i18n/fr.training';

// FIX-ASSIST (critère 11) : la phrase d'un exercice assisté dit le vrai sens de l'assistance, jamais « +x kg » pour une assistance en hausse.
describe('FIX-ASSIST textes de l’exercice assisté', () => {
  it('cran : « Assistance −x kg », minimum, maintien (inactivité, Recovery), note et fiche', () => {
    expect(progressionFr.explainAssistDecrease).toBe('Assistance −{delta} kg : {sets} × {reps} atteint la dernière fois.');
    expect(progressionFr.explainAssistDecreaseUnknownStep).toBe('Assistance −{delta} kg (cran supposé, matériel à vérifier) : {sets} × {reps} atteint la dernière fois.');
    expect(progressionFr.explainExtraRepAssistMin).toBe('Même assistance, une répétition de plus sur la série {set} : assistance minimale du matériel.');
    expect(progressionFr.explainInactivityAssistHeld).toMatch(/^Assistance maintenue/);
    expect(progressionFr.explainRecoveryLowAssistHeld).toMatch(/^Assistance maintenue/);
    expect(progressionFr.noteAssistanceHeld).toMatch(/assistance/i);
    expect(trainingFr.sheetAssisted).toMatch(/assist/i);
  });
});
