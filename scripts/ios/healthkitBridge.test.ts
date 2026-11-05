import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..', '..');
const readBridge = (): string => readFileSync(join(root, 'src-tauri', 'src', 'healthkit.rs'), 'utf8');

describe('pont Rust HealthKit (SPA-006)', () => {
  it('borne les appels Swift, avec un délai utilisateur distinct pour la demande d’autorisation', () => {
    const bridge = readBridge();
    expect(bridge).toContain('call_with_deadline');
    expect(bridge).toContain('STATUS_DEADLINE');
    expect(bridge).toContain('READ_DEADLINE');
    expect(bridge).toContain('AUTHORIZE_DEADLINE');
    expect(bridge).toContain('call(app, "status", STATUS_DEADLINE)');
    expect(bridge).toContain('call(app, "authorize", AUTHORIZE_DEADLINE)');
    expect(bridge).toContain('call(app, "bodyMassToday", READ_DEADLINE)');
    expect(bridge).toContain('call(app, "stepCountToday", READ_DEADLINE)');
  });
});
