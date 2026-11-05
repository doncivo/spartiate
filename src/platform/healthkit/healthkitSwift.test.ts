import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Garde de source du plugin Swift (pas de Mac : le Swift ne compile qu'en CI). Constat 0.1.2 sur l'iPhone réel : « La demande d'accès à
 * Santé a échoué » sans fenêtre iOS. L'erreur native ne doit plus se perdre : domaine, code et description de l'NSError (aucune donnée de
 * santé) remontent au statut, avec la présence du texte d'usage et la disponibilité de Santé.
 */
const swift = readFileSync(new URL('../../../src-tauri/plugins/healthkit/ios/Sources/HealthKitPlugin.swift', import.meta.url), 'utf8');
const authorize = /func authorize[\s\S]*?\n  \}\n/.exec(swift)?.[0] ?? '';
const status = /func status[\s\S]*?\n  \}\n/.exec(swift)?.[0] ?? '';

describe('HealthKitPlugin.swift : diagnostic', () => {
  it('authorize garde l’erreur native (domaine, code, localizedDescription) au lieu de la perdre', () => {
    expect(authorize).toMatch(/as NSError/);
    expect(swift).toMatch(/\.domain/);
    expect(swift).toMatch(/\.code/);
    expect(swift).toMatch(/localizedDescription/);
  });

  it('un success = false sans erreur est aussi noté, pas seulement error != nil', () => {
    expect(authorize).toMatch(/guard success/);
    expect(authorize).toMatch(/recordAuthorizationError|lastError/);
  });

  it('le statut porte disponibilité, NSHealthShareUsageDescription (Bundle.main) et dernière erreur', () => {
    expect(status).toMatch(/isHealthDataAvailable\(\)/);
    expect(status).toMatch(/usageDescription/);
    expect(status).toMatch(/lastError/);
    expect(swift).toMatch(/Bundle\.main\.object\(forInfoDictionaryKey: "NSHealthShareUsageDescription"\)/);
  });

  it('la demande reste en lecture seule : toShare vide, jamais de type écrit', () => {
    expect(authorize).toMatch(/toShare: \[\]/);
  });

  it('aucune donnée de santé dans l’erreur remontée (ni valeur ni échantillon)', () => {
    expect(swift).not.toMatch(/lastError[^\n]*(kg|sample|quantity)/i);
  });
});
