import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SHELL-0294b (lot 0.29.4) : contrôles statiques du Swift (pas de Mac : le Swift ne compile qu'en CI). Chaque bloc fige un défaut de l'audit
 * Claude 0.27.0 corrigé dans ce ticket ; le comportement sur l'iPhone reste à constater par Ali (D-36).
 */
const root = join(__dirname, '..', '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');
/** Code sans les commentaires de ligne (`//` en début de ligne). */
const code = (path: string): string =>
  read(path)
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('///'))
    .join('\n');
/** Corps d'une fonction Swift : du nom jusqu'à la première accolade fermante à deux espaces d'indentation. */
const body = (source: string, signature: string): string => {
  const start = source.indexOf(signature);
  expect(start, signature).toBeGreaterThan(-1);
  const end = source.indexOf('\n  }\n', start);
  return source.slice(start, end === -1 ? undefined : end);
};

describe('C-159 : privacy-shield posé dès la perte du premier plan (H-32)', () => {
  const shield = code('src-tauri/plugins/privacy-shield/ios/Sources/PrivacyShieldPlugin.swift');

  it('la scène qui se désactive pose aussi le cache (avant la notification de l’app)', () => {
    expect(shield).toMatch(/UIScene\.willDeactivateNotification/);
  });

  it('le cache est dessiné tout de suite (mise en page et validation de la transaction), pas au tour suivant de la boucle', () => {
    const show = body(shield, 'private func showShield()');
    const added = show.indexOf('window.addSubview(view)');
    expect(added).toBeGreaterThan(-1);
    expect(show.indexOf('window.layoutIfNeeded()')).toBeGreaterThan(added);
    expect(show.indexOf('CATransaction.flush()')).toBeGreaterThan(added);
  });

  it('activé alors que l’app n’est déjà plus au premier plan : le cache est posé aussitôt', () => {
    const set = body(shield, '@objc public func setEnabled(_ invoke: Invoke)');
    expect(set).toMatch(/applicationState != \.active/);
    expect(set.indexOf('self.showShield()')).toBeGreaterThan(set.indexOf('applicationState != .active'));
  });
});

describe('C-159 : Vision n’est plus « occupé » à vie après une lecture bloquée', () => {
  const vision = code('src-tauri/plugins/vision/ios/Sources/VisionPlugin.swift');

  it('chaque lecture a un jeton et une date de début ; seule la lecture en cours libère l’état', () => {
    expect(vision).toMatch(/private func beginReading\(\) -> UInt64\?/);
    expect(vision).toMatch(/private func endReading\(_ token: UInt64\)/);
    const end = body(vision, 'private func endReading(_ token: UInt64)');
    expect(end).toMatch(/if readingToken == token/);
  });

  it('une lecture plus vieille que la garde de temps et sa marge est abandonnée : nouvelle file, plus de « busy »', () => {
    const begin = body(vision, 'private func beginReading() -> UInt64?');
    expect(begin).toMatch(/readingSince/);
    expect(begin).toMatch(/readTimeoutSeconds \+ staleGraceSeconds/);
    expect(begin).toMatch(/visionQueue = DispatchQueue\(label:/);
    expect(vision).toMatch(/private var visionQueue = DispatchQueue\(label:/);
  });

  it('la garde de temps libère l’état « occupé » dès qu’elle répond `timeout`', () => {
    const read = body(vision, 'private func read(');
    const guardStart = read.indexOf('let guardItem = DispatchWorkItem');
    expect(guardStart).toBeGreaterThan(-1);
    const guardBlock = read.slice(guardStart, read.indexOf('guardQueue.asyncAfter', guardStart));
    expect(guardBlock).toMatch(/self\?\.endReading\(token\)/);
  });
});
