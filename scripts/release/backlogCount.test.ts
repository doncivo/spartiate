import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- module JavaScript sans déclaration de types (script de publication)
import { countBacklog, formatCount } from './backlog-count.mjs';

/**
 * BL-147 (audit du projet du 24/11, N-10) : un seul décompte des lignes ouvertes du registre, produit par script
 * (`node scripts/release/backlog-count.mjs`) et cité tel quel par docs/reprise.md ; plus de compte recopié à la main ailleurs.
 */
const SAMPLE = [
  '| ID | Origine | Description | Statut |',
  '|---|---|---|---|',
  '| A | x | y | à faire (0.29.x, CI, S) |',
  '| B | x | y | à faire (0.29.x, coquille, iOS et qualité, M) : D-1 |',
  '| C | x | y | fait en partie ; reste : z (0.29.x, données et synchro, M) |',
  '| D | x | y | à trancher par Ali (Q-11) |',
  '| E | x | y | constat d\'Ali à faire (docs/constats-ali.md) |',
  '| F | x | y | fait (PR #1) |',
  '| G | x | y | à faire (0.29.x, CI, M) |',
].join('\n');

describe('BL-147 : compteur unique du registre', () => {
  it('compte les lignes « à faire » par module, les restes, les arbitrages et les constats', () => {
    const c = countBacklog(SAMPLE);
    expect(c.todo).toBe(3);
    expect(c.byModule).toEqual({ CI: 2, 'coquille, iOS et qualité': 1 });
    expect(c.partial).toBe(1);
    expect(c.decide).toBe(1);
    expect(c.constat).toBe(1);
  });

  it('docs/reprise.md cite le compte exact produit par le script sur docs/backlog.md', () => {
    const line = formatCount(countBacklog(readFileSync('docs/backlog.md', 'utf8')));
    expect(readFileSync('docs/reprise.md', 'utf8')).toContain(line);
  });
});
