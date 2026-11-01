import { expect, it } from 'vitest';
import { pendingFileCount } from './pendingFiles';

it.each([
  [[], 0],
  [['a/e'], 1],
  [['a/e', 'a/e/j-1.spj'], 1],
  [['a/e', 'a/e/j-1.spj', 'a/e/j-2.spj'], 2],
  [['a/e', 'a/e/j-1.spj', 'b/e'], 2],
  [['a/e/j-1.spj', 'a/e/j-1.spj'], 1],
  [['a/e', 'a/epoch/j-1.spj'], 2],
] as const)('compte les attentes distinctes : %j', (paths, expected) => {
  expect(pendingFileCount(paths)).toBe(expected);
});
