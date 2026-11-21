import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { tAppleIntelligence } from '../../i18n/appleIntelligenceText';
import { createFakeAppleIntelligence, type AppleIntelligenceResult } from '../../platform/appleIntelligence';
import { AppleIntelligenceTestRow } from './AppleIntelligenceTestRow';

/** IOS-029b C-b4 : Plus › Logs › Outils de test › « Essai Apple Intelligence » (à la demande) : lance l'essai et affiche le résultat tel quel. */
const PROMPT = 'Texte synthétique fixe';

async function run(results: readonly AppleIntelligenceResult[]) {
  const fake = createFakeAppleIntelligence(results);
  render(<AppleIntelligenceTestRow appleIntelligence={fake} />);
  expect(screen.getByText(tAppleIntelligence('row'))).toBeTruthy();
  expect(fake.calls()).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: tAppleIntelligence('start') }));
  const output = await screen.findByRole('status');
  return { fake, output };
}

afterEach(() => cleanup());

describe('Essai Apple Intelligence (IOS-029b)', () => {
  it('aucun appel avant le bouton ; réponse : texte envoyé et réponse du modèle affichés', async () => {
    const { fake, output } = await run([{ kind: 'answered', prompt: PROMPT, response: 'Réponse du modèle local.', elapsedMs: 1500 }]);
    expect(fake.calls()).toBe(1);
    expect(await screen.findByText('Réponse du modèle local.')).toBeTruthy();
    expect(output.textContent).toContain(tAppleIntelligence('prompt', { prompt: PROMPT }));
    expect(output.textContent).toContain(tAppleIntelligence('answered', { seconds: '1,5' }));
  });

  it('indisponible : motif dit et détail natif gardé', async () => {
    const { output } = await run([{ kind: 'unavailable', reason: 'not-enabled', detail: 'appleIntelligenceNotEnabled', prompt: PROMPT }]);
    await screen.findByText(tAppleIntelligence('reasonNotEnabled'));
    expect(output.textContent).toContain(tAppleIntelligence('detail', { detail: 'appleIntelligenceNotEnabled' }));
  });

  it('SDK ancien : « indisponible », jamais une erreur non gérée', async () => {
    await run([{ kind: 'unavailable', reason: 'sdk-absent', detail: null, prompt: PROMPT }]);
    expect(await screen.findByText(tAppleIntelligence('reasonSdkAbsent'))).toBeTruthy();
  });

  it('erreur du modèle : domaine, code et description affichés tels quels', async () => {
    const error = { domain: 'FoundationModels.GenerationError', code: 2, description: 'guardrailViolation' };
    const { output } = await run([{ kind: 'error', prompt: PROMPT, error }]);
    await screen.findByText(tAppleIntelligence('error'));
    expect(output.textContent).toContain(tAppleIntelligence('nativeError', { ...error }));
  });

  it('PC : indisponible sur cet appareil ; échec d’appel : code affiché ; le bouton relance', async () => {
    const { fake } = await run([{ kind: 'unsupported' }, { kind: 'failed', code: 'appleintelligence-timeout' }]);
    expect(await screen.findByText(tAppleIntelligence('unsupported'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: tAppleIntelligence('start') }));
    expect(await screen.findByText(tAppleIntelligence('failed', { code: 'appleintelligence-timeout' }))).toBeTruthy();
    expect(fake.calls()).toBe(2);
  });

  it('monté dans les outils de test des Logs (écran chargé à la demande)', () => {
    const logs = readFileSync(join(__dirname, 'logs', 'LogsScreen.tsx'), 'utf8');
    expect(logs).toMatch(/import \{ AppleIntelligenceTestRow \} from '\.\.\/AppleIntelligenceTestRow';/);
    expect(logs).toMatch(/<TimerTestRow \/>\s*<AppleIntelligenceTestRow \/>/);
  });
});
