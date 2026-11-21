import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isSingular, tPlural } from './plural';
import { formatStreak } from './formatRoutine';
import { sessionsCount } from './cardioText';
import { failureLine } from '../features/sync/syncText';
import { tNutrition } from './nutritionText';
import { tRecoveryFactors } from './recoveryFactorsText';
import { tToday } from './todayText';
import { tTodayPc } from './todayPcText';
import { tTraining } from './trainingText';
import { tReplay } from './workoutReplayText';

/**
 * FIX-0241 critère 5 : règle française des compteurs, 0 et 1 au singulier (« 0 jour », « 1 jour »), 2 et plus au pluriel (« 2 jours »,
 * « 21 jours »). Une famille par nom compté ; le garde balaie ensuite les catalogues vivants.
 */
const CASES: readonly (readonly [number, 'one' | 'other'])[] = [
  [0, 'one'],
  [1, 'one'],
  [2, 'other'],
  [21, 'other'],
];

describe('isSingular', () => {
  it('0 et 1 au singulier, 2 et plus au pluriel', () => {
    expect([0, 1, 2, 21, 100].map(isSingular)).toEqual([true, true, false, false, false]);
  });
});

function family(name: string, noun: [string, string], render: (n: number) => string, rest = ''): void {
  it(`famille « ${name} » : 0, 1, 2 et 21`, () => {
    for (const [n, form] of CASES) {
      expect(render(n)).toBe(`${String(n)} ${noun[form === 'one' ? 0 : 1]}${rest}`);
    }
  });
}

describe('familles de compteurs', () => {
  family('jours (programme)', ['jour', 'jours'], (n) => tPlural(tTraining, n, 'programDaysOne', 'programDays'));
  family('jours (série de routine)', ['jour', 'jours'], (n) => formatStreak(n, 'days'));
  family('semaines', ['semaine', 'semaines'], (n) => formatStreak(n, 'weeks'));
  family('séances', ['séance', 'séances'], (n) => formatStreak(n, 'sessions'));
  family('séances (cardio)', ['séance', 'séances'], (n) => sessionsCount(n));
  family('séances (semaine d’Aujourd’hui PC)', ['séance', 'séances'], (n) => tPlural(tTodayPc, n, 'weekCountOne', 'weekCount'));
  family('pesées sur 14', ['pesée', 'pesées'], (n) => tPlural(tToday, n, 'weightsCountOne', 'weightsCount'), ' sur 14 nécessaires');
  family('séries', ['série', 'séries'], (n) => tPlural(tTraining, n, 'historySetsOne', 'historySets'));
  family('exercices', ['exercice', 'exercices'], (n) => tPlural(tTraining, n, 'countOne', 'countMany'));
  family('séries non validées', ['série non validée', 'séries non validées'], (n) => tPlural(tReplay, n, 'notDoneOne', 'notDone').replace(/, absentes? du déroulé\.$/, ''));
  family('jours du journal de facteurs', ['jour avec', 'jours avec'], (n) => tPlural(tRecoveryFactors, n, 'progressDaysWithOne', 'progressDaysWith', { mean: 'x' }).replace(/ : Recovery moyenne du lendemain x$/, ''));
  family('jours complets', ['jour complet', 'jours complets'], (n) => tPlural(tNutrition, n, 'daysCompleteOne', 'daysComplete').replace(/ sur 7$/, ''));
  it('éléments non intégrés (écran du départ : `n < 2` sans importer plural.ts)', () => {
    expect(failureLine(0)).toBe('0 élément reçu d’une version plus récente n’a pas pu être intégré');
    expect(failureLine(1)).toBe('1 élément reçu d’une version plus récente n’a pas pu être intégré');
    expect(failureLine(2)).toBe('2 éléments reçus d’une version plus récente n’ont pas pu être intégrés');
    expect(failureLine(21)).toBe('21 éléments reçus d’une version plus récente n’ont pas pu être intégrés');
  });
  family('pesées (nutrition)', ['pesée', 'pesées'], (n) => tPlural(tNutrition, n, 'weighInsOne', 'weighInsCount'));
});

describe('garde : aucun « {n} <nom pluriel> » sans variante au singulier', () => {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  /** Catalogues d'écrans retirés par SPA-001b ou bancs legacy (D-67) : hors périmètre, la liste ne peut que se réduire. */
  const RETIRED = new Set(['fr.importCsv.ts', 'fr.scan.ts', 'fr.events.ts', 'fr.capture.ts', 'fr.notifications.ts', 'fr.syncField.ts', 'fr.syncCarryReport.ts', 'fr.ts']);
  /** Exceptions justifiées « fichier:clé ». */
  const ALLOWED = new Set([
    'fr.circuit.ts:headline', // n exercices ≥ 2 par construction (un circuit en compte au moins 2)
    'fr.circuit.ts:headlineOne', // c'est le nombre de tours qui est à 1 ; le nombre d'exercices reste au pluriel
    'fr.routines.ts:everyNDays', // « tous les N jours » : N ≥ 2 (1 = « chaque jour »)
    'fr.routines.ts:everyNWeeksOn', // idem pour les semaines
    'fr.syncPairing.ts:validMinutes', // durée fixe, jamais 0 ni 1
    'fr.trainingCycle.ts:weeksNowTitle', // PROG-05 : durée de cycle 4, 5 ou 6 semaines, jamais 1
    'fr.trainingCycle.ts:weeksNowText', // idem
    'fr.syncReset.ts:waitingMany', // la variante au singulier s'appelle waitingOne et n'a pas de nombre
    'fr.supplements.ts:cardProgressOne', // « {n} sur 1 prise » : le total vaut 1, c'est lui qui accorde
    'fr.supplements.ts:cardProgressMany', // « {n} sur {total} prises » : c'est le total (≥ 2) qui accorde
    // Fractions « fait / prévu » : le nom s'accorde avec le dénominateur, jamais avec le numérateur.
    'fr.body.ts:weightTrendLearning',
    'fr.body.ts:weightTrendCount', // affiché à partir de 14 pesées (sous ce seuil : weightTrendLearning) : toujours au pluriel
    'fr.training.ts:sessionSummary',
    'fr.training.ts:routineSetsChanged', // « 3 → 4 séries » : plage, jamais un compteur seul
    // Plages et seuils fixes, toujours ≥ 2 par construction.
    'fr.training.ts:repRange',
    'fr.training.ts:sessionTargetRange',
    'fr.trainingCycle.ts:rirRange',
    'fr.trainingGeneration.ts:cycleRirRange',
    'fr.trainingCycle.ts:weeksOption', // choix 4 à 8 semaines
    'fr.trainingCycle.ts:nextWeeksNote',
    'fr.trainingCycle.ts:reviewWeeks',
    'fr.onboarding.ts:mesoWeeksOption',
    'fr.onboarding.ts:splitProgram', // programmes de départ de 3 à 6 jours
    'fr.onboarding.ts:splitMismatch',
    'fr.onboarding.ts:splitDayLine', // un jour de programme compte au moins 2 exercices
    'fr.progression.ts:explainDeload', // deload : au moins 2 répétitions en réserve
    'fr.progression.ts:explainDeloadNoLoad', // MOTEUR-0281a : même RIR de deload (au moins 4), exercice sans charge
    'fr.progression.ts:optionFatigueReps', // coupe fixe de 2 répétitions (fatigueRepsCut)
    'fr.signing.ts:remainingDays', // affiché à partir de 48 h : toujours ≥ 2 jours
    'fr.backup.ts:summaryTodayOne', // une sauvegarde existe toujours avec au moins 1 version (sinon « Aucune sauvegarde »)
    'fr.backup.ts:summaryYesterdayOne',
    'fr.backup.ts:summaryOtherOne',
    'fr.backup.ts:summaryToday', // idem : le pluriel ne sert qu'à partir de 2 versions
    'fr.backup.ts:summaryYesterday',
    'fr.backup.ts:summaryOther',
    'fr.supplementNotifications.ts:bodyMany', // notification émise seulement avec ≥ 1 prise ; le singulier est rédigé « Une prise… »
    'fr.supplementNotifications.ts:noticeTakenMany',
    'fr.supplementNotifications.ts:bodyOne',
    'fr.supplementNotifications.ts:noticeTakenOne',
    'fr.progression.ts:alertStall', // alerte à partir de 3 séances sans progrès
    'fr.recoveryFactors.ts:progressNoPair', // seuils fixes du journal de facteurs
    'fr.routines.ts:rateLabel', // fenêtres fixes de 7 et 30 jours
    'fr.nutrition.ts:tdeeMeasuredTerms', // couverture minimale de 4 jours complets
    'fr.nutrition.ts:checkInFirstNeed', // seuils fixes : 4 jours complets, 2 pesées
  ]);
  const NOUNS = /\{(\w+)\} (?:non |déjà )?(jours|séances|pesées|séries|exercices|nuits|semaines|compléments|entrées|fichiers|lignes|éléments|versions|prises|conflits|appareils|records|portions|valeurs|points|avertissements|répétitions)/g;
  const stem = (key: string): string => key.replace(/(One|Many|Other|Plural|_one|_other|Single|None)$/, '').replace(/Count$/, '').replace(/(1|N)$/, '');
  const ENTRY = /^\s*['"]?([\w_]+)['"]?: (['"`])(.*)\2,?\s*$/;

  const files = readdirSync(dir).filter((f) => /^fr\..*\.ts$/.test(f) && !f.endsWith('.test.ts') && !RETIRED.has(f));
  it('les catalogues vivants sont trouvés', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  for (const file of files) {
    it(file, () => {
      const entries = readFileSync(`${dir}${file}`, 'utf8')
        .split('\n')
        .flatMap((line) => {
          const m = ENTRY.exec(line);
          return m ? [{ key: m[1] ?? '', text: m[3] ?? '' }] : [];
        });
      const missing: string[] = [];
      for (const { key, text } of entries) {
        for (const m of text.matchAll(NOUNS)) {
          if (/(One|_one|Single|1)$/.test(key) || ALLOWED.has(`${file}:${key}`)) continue;
          const singular = (m[2] ?? '').slice(0, -1);
          const hasOne = entries.some((e) => e.key !== key && (stem(e.key) === stem(key) || stem(e.key) === key) && new RegExp(`\\{\\w+\\} (?:non |déjà )?${singular}(?![a-zé])`).test(e.text));
          if (!hasOne) missing.push(`${key} : ${text.slice(0, 60)}`);
        }
      }
      expect(missing).toEqual([]);
    });
  }

  // Revue FIX-0241 : bilans à plusieurs compteurs (« 1 ajoutées · 0 refusées ») écrits « ajoutées : {n} » (D-282) ; le participe ou le nom
  // pluriel ne suit jamais un compteur.
  const COUNTED_PLURAL = /\{\w+\} (?:jours |déjà )?(ajoutée?s|refusée?s|connues|lus|mis à jour|inchangée?s|créée?s|remplacée?s|gardée?s|supprimée?s|ajouts|modifications|suppressions)(?![a-zé])/;
  it('bilan à plusieurs compteurs : « libellé : n », jamais « n participes »', () => {
    const bad: string[] = [];
    for (const file of files) {
      for (const line of readFileSync(`${dir}${file}`, 'utf8').split('\n')) {
        const m = ENTRY.exec(line);
        if (m && COUNTED_PLURAL.test(m[3] ?? '') && !ALLOWED.has(`${file}:${m[1] ?? ''}`)) bad.push(`${file}:${m[1] ?? ''} : ${(m[3] ?? '').slice(0, 60)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('un texte au singulier porte le nombre au lieu de figer « 1 » : 0 s’écrit « 0 jour »', () => {
    const bad: string[] = [];
    for (const file of files) {
      for (const line of readFileSync(`${dir}${file}`, 'utf8').split('\n')) {
        const m = ENTRY.exec(line);
        const key = m?.[1] ?? '';
        const text = m?.[3] ?? '';
        if (m && /(One|_one|1)$/.test(key) && /(^|[^\d{])1 [a-zéèû]+/.test(text) && !ALLOWED.has(`${file}:${key}`)) bad.push(`${file}:${key} : ${text.slice(0, 50)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
