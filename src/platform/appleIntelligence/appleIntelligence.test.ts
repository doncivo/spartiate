import { describe, expect, it, vi } from 'vitest';
import { createFakeAppleIntelligence, createTauriAppleIntelligence, unsupportedAppleIntelligence, type AppleIntelligenceInvoker } from './index';

/**
 * IOS-029b (essai Apple Intelligence, H-41 proposée) : façade du plugin `apple-intelligence`. Rust seul appelle le Swift
 * (`apple_intelligence_probe`, sans argument : le texte envoyé est fixe dans le Swift). Réponse et erreur rendues telles quelles, tronquées ;
 * jamais d'exception.
 */
const PROMPT = 'Texte synthétique fixe';

function rig(reply: unknown) {
  const calls: { command: string; args: unknown }[] = [];
  const invoke: AppleIntelligenceInvoker = vi.fn(async (command: string, args?: Record<string, unknown>) => {
    calls.push({ command, args });
    if (reply instanceof Error || typeof reply === 'string') throw reply;
    return reply;
  });
  return { calls, ai: createTauriAppleIntelligence({ invoke }) };
}

describe('Apple Intelligence : adaptateur iPhone', () => {
  it('réponse du modèle : texte envoyé, réponse et durée ; commande sans argument', async () => {
    const { ai, calls } = rig({ status: 'answered', prompt: PROMPT, response: 'Une réponse.', elapsedMs: 1234 });
    expect(await ai.probe()).toEqual({ kind: 'answered', prompt: PROMPT, response: 'Une réponse.', elapsedMs: 1234 });
    expect(calls).toEqual([{ command: 'apple_intelligence_probe', args: undefined }]);
  });

  it('réponse tronquée à 2 000 caractères ; durée illisible → null', async () => {
    const { ai } = rig({ status: 'answered', prompt: PROMPT, response: 'a'.repeat(5000), elapsedMs: -3 });
    const result = await ai.probe();
    expect(result).toMatchObject({ kind: 'answered', elapsedMs: null });
    expect(result.kind === 'answered' ? result.response.length : 0).toBe(2000);
  });

  it('modèle indisponible : motif lu dans le détail natif (appareil, Apple Intelligence coupée, modèle pas prêt), détail gardé', async () => {
    const cases: [string, string][] = [
      ['deviceNotEligible', 'device-not-eligible'],
      ['appleIntelligenceNotEnabled', 'not-enabled'],
      ['modelNotReady', 'model-not-ready'],
      ['somethingNew', 'unknown'],
    ];
    for (const [detail, reason] of cases) {
      expect(await rig({ status: 'unavailable', reason: 'model-unavailable', detail, prompt: PROMPT }).ai.probe()).toEqual({ kind: 'unavailable', reason, detail, prompt: PROMPT });
    }
  });

  it('SDK sans Foundation Models ou iOS antérieur à 26 : motif dit', async () => {
    expect(await rig({ status: 'unavailable', reason: 'sdk-absent', prompt: PROMPT }).ai.probe()).toEqual({ kind: 'unavailable', reason: 'sdk-absent', detail: null, prompt: PROMPT });
    expect(await rig({ status: 'unavailable', reason: 'os-too-old', prompt: PROMPT }).ai.probe()).toEqual({ kind: 'unavailable', reason: 'os-too-old', detail: null, prompt: PROMPT });
  });

  it('erreur de génération : domaine, code, description rendus tels quels (description tronquée à 300)', async () => {
    const error = { domain: 'FoundationModels.LanguageModelSession.GenerationError', code: 3, description: 'x'.repeat(400) };
    const result = await rig({ status: 'error', prompt: PROMPT, error }).ai.probe();
    expect(result).toMatchObject({ kind: 'error', prompt: PROMPT, error: { domain: error.domain, code: 3 } });
    expect(result.kind === 'error' ? result.error.description.length : 0).toBe(300);
  });

  it('appel impossible : code de Rust gardé (délai, plugin absent), sinon « failed » ; forme inattendue : « bad-reply »', async () => {
    expect(await rig('appleintelligence-timeout').ai.probe()).toEqual({ kind: 'failed', code: 'appleintelligence-timeout' });
    expect(await rig(new Error('boom')).ai.probe()).toEqual({ kind: 'failed', code: 'failed' });
    expect(await rig({ status: 'zzz' }).ai.probe()).toEqual({ kind: 'failed', code: 'bad-reply' });
    expect(await rig(null).ai.probe()).toEqual({ kind: 'failed', code: 'bad-reply' });
    expect(await rig({ status: 'answered', prompt: PROMPT }).ai.probe()).toEqual({ kind: 'failed', code: 'bad-reply' });
  });
});

describe('Apple Intelligence : stub PC et faux', () => {
  it('PC, navigateur : « unsupported », aucun appel', async () => {
    expect(await unsupportedAppleIntelligence.probe()).toEqual({ kind: 'unsupported' });
  });

  it('faux : rend les résultats programmés dans l’ordre, compte les appels', async () => {
    const fake = createFakeAppleIntelligence([{ kind: 'failed', code: 'appleintelligence-timeout' }]);
    expect(await fake.probe()).toEqual({ kind: 'failed', code: 'appleintelligence-timeout' });
    expect(await fake.probe()).toEqual({ kind: 'unsupported' });
    expect(fake.calls()).toBe(2);
  });
});
