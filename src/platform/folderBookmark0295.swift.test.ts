import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DATA-0295 (lot 0.29.5) : contrôles statiques du Swift de folder-bookmark (pas de Mac : le Swift ne compile qu'en CI, `build-ios.yml`).
 * Chaque bloc fige un défaut de l'audit Claude 0.27.0 corrigé dans ce ticket. Ces contrôles ne valent pas preuve (D-36) : la compilation
 * et le comportement sur l'iPhone restent à constater.
 */
const root = join(__dirname, '..', '..');
const swift = readFileSync(join(root, 'src-tauri/plugins/folder-bookmark/ios/Sources/FolderBookmarkPlugin.swift'), 'utf8')
  .split(/\r?\n/)
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n');
/** Corps d'une fonction Swift : du nom jusqu'à la première accolade fermante à deux espaces d'indentation. */
const body = (signature: string): string => {
  const start = swift.indexOf(signature);
  expect(start, signature).toBeGreaterThan(-1);
  const end = swift.indexOf('\n  }\n', start);
  return swift.slice(start, end === -1 ? undefined : end);
};

describe('C-153 : un seul accès de sécurité ouvert pour la racine, quel que soit le nombre de cycles', () => {
  const resolve = (): string => body('private func resolveBookmark(');

  it('l’accès précédent est refermé après un nouvel accès réussi, même pour la même URL', () => {
    expect(resolve()).not.toMatch(/if let previous = root, previous != url \{\s*previous\.stopAccessingSecurityScopedResource\(\)\s*\}/);
    expect(resolve()).toMatch(/rootAccessStarted/);
    const stop = resolve().lastIndexOf('previous.stopAccessingSecurityScopedResource()');
    expect(stop).toBeGreaterThan(resolve().indexOf('let started = url.startAccessingSecurityScopedResource()'));
    expect(resolve().slice(Math.max(0, stop - 200), stop)).toMatch(/previous != url \|\| started/);
  });

  it('l’état « accès ouvert » est tenu avec la racine', () => {
    expect(swift).toMatch(/private var rootAccessStarted = false/);
    expect(resolve()).toMatch(/rootAccessStarted = started/);
  });
});

describe('C-155 : retour du fsync du dossier contrôlé', () => {
  it('aucun fsync(dirFd) dont le retour est ignoré', () => {
    const calls = swift.split('\n').filter((line) => line.includes('fsync(dirFd)'));
    expect(calls.length).toBeGreaterThan(0);
    for (const line of calls) expect(line).toMatch(/if fsync\(dirFd\) != 0/);
  });
});

describe('C-154 : aucune écriture sur un fichier évincé (substitut `.<nom>.icloud`)', () => {
  const guard = (): string => body('private func refuseEvicted(');

  it('le substitut présent : téléchargement demandé, `cloud-pending`, rien d’écrit', () => {
    expect(guard()).toMatch(/placeholderName\(name\)/);
    expect(guard()).toMatch(/fstatat\(dirFd, placeholder/);
    expect(guard()).toMatch(/startDownloadingUbiquitousItem/);
    expect(guard()).toMatch(/throw Failure\(code: \.cloudPending\)/);
  });

  it.each(['@objc public func append(', '@objc public func writeAtomic('])('%s refuse avant toute création ou écriture', (signature) => {
    const write = body(signature);
    const refused = write.indexOf('try self.refuseEvicted(dirFd, name, url)');
    expect(refused).toBeGreaterThan(-1);
    expect(refused).toBeLessThan(write.indexOf('openat('));
  });
});

describe('Relecture sync-icloud de DATA-0295 (réserves)', () => {
  it('C-154 : refus seulement si le fichier réel est absent (ENOENT) et le substitut présent, comme `status`', () => {
    const guard = body('private func refuseEvicted(');
    const real = guard.indexOf('fstatat(dirFd, name, ');
    expect(real).toBeGreaterThan(-1);
    expect(real).toBeLessThan(guard.indexOf('fstatat(dirFd, placeholder'));
    expect(guard).toMatch(/errno != ENOENT/);
    expect(guard).toMatch(/self\.isRegular\(st\.st_mode\)|isRegular\(st\.st_mode\)/);
  });

  it('C-153 : même URL et nouvel accès refusé : la racine reste l’instance qui détient l’accès ouvert', () => {
    const resolve = body('private func resolveBookmark(');
    expect(resolve).toMatch(/kept = previous/);
    expect(resolve).toMatch(/root = kept\n/);
    expect(resolve).not.toMatch(/root = url\n/);
  });
});
