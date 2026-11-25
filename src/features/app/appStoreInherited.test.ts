import { describe, expect, it } from 'vitest';
import { useAppStore } from './appStore';

/** SHELL-0294c (C-124) : l'état hérité de CircleTasks (espaces, projets), jamais posé dans Spartiate, n'existe plus dans le store. */
describe('appStore sans état hérité', () => {
  it('ne porte ni espaces ni projets', () => {
    const state = useAppStore.getState() as unknown as Record<string, unknown>;
    for (const key of ['spaces', 'projects', 'setSpaces', 'setProjects']) expect(state).not.toHaveProperty(key);
  });
});
