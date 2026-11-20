// AUDIT-CLAUDE-0.27.0 : configuration des tests de preuve, jamais branchée sur la CI.
// Usage (racine du worktree) : npx vitest run --config docs/audit-claude-0.27.0/preuves/vitest.audit.config.ts <fichier>
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: '.',
    include: ['docs/audit-claude-0.27.0/preuves/**/*.test.ts'],
    environment: 'node',
    maxWorkers: 1,
    coverage: { enabled: false },
  },
});
