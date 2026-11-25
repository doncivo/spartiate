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

describe('C-156 et C-146 : Live Activity (démarrages rapprochés, libellé, « Terminé » en dur, lastError, date de fin bornée)', () => {
  const swift = code('src-tauri/plugins/live-activity/ios/Sources/LiveActivityPlugin.swift');
  const bridge = read('src-tauri/src/live_activity.rs');

  it('deux démarrages rapprochés sont exécutés l’un après l’autre (file de tâches) : jamais deux activités', () => {
    expect(swift).toMatch(/private var tail: Task<Void, Never>\?/);
    expect(swift).toMatch(/await previous\?\.value/);
    for (const method of ['@objc public func start(_ invoke: Invoke)', '@objc public func end(_ invoke: Invoke)']) {
      expect(body(swift, method), method).toMatch(/self\.enqueue \{|enqueue \{/);
      expect(body(swift, method), method).not.toMatch(/^\s*Task \{/m);
    }
  });

  it('activité gardée pour la même échéance : son libellé est mis à jour s’il a changé', () => {
    const start = body(swift, '@objc public func start(_ invoke: Invoke)');
    expect(start).toMatch(/await kept\.update\(ActivityContent\(state: state, staleDate: endDate\)\)/);
    expect(start).toMatch(/kept\.content\.state != state/);
  });

  it('aucun « Terminé » en dur : texte d’état final obligatoire, non vide (Swift et Rust)', () => {
    expect(read('src-tauri/plugins/live-activity/ios/Sources/LiveActivityPlugin.swift')).not.toMatch(/"Terminé"/);
    expect(swift).toMatch(/let finishedLabel: String\n/);
    expect(swift).toMatch(/args\.finishedLabel\.trimmingCharacters\(in: \.whitespacesAndNewlines\)\.isEmpty/);
    expect(bridge).toMatch(/finished_label: String,/);
    expect(bridge).toMatch(/finished_label\.trim\(\)\.is_empty\(\)/);
  });

  it('lastError lu et écrit sous verrou', () => {
    expect(swift).toMatch(/private let errorLock = NSLock\(\)/);
    const uses = [...swift.matchAll(/\blastErrorStore\b/g)].length;
    expect(uses).toBeGreaterThanOrEqual(3);
    for (const line of swift.split('\n').filter((l) => /lastErrorStore/.test(l) && !/private var lastErrorStore/.test(l))) {
      expect(line, line).toMatch(/errorLock|return lastErrorStore|lastErrorStore = /);
    }
    expect(swift).toMatch(/func readLastError\(\)/);
    expect(swift).toMatch(/func writeLastError\(/);
  });

  it('C-146 : date de fin bornée (pas dans le passé, au plus 8 h devant) en Swift et en Rust', () => {
    expect(swift).toMatch(/private let maxEndAheadSeconds: TimeInterval = 8 \* 3600/);
    expect(swift).toMatch(/endDate\.timeIntervalSinceNow > maxEndAheadSeconds/);
    expect(bridge).toMatch(/const MAX_END_AHEAD_MS: f64 = 8\.0 \* 3600\.0 \* 1000\.0;/);
    expect(bridge).toMatch(/end_date_ms > now_ms \+ MAX_END_AHEAD_MS/);
    // Libellé d'état final borné à 40 caractères côté Rust (déjà en place) et côté Swift.
    expect(bridge).toMatch(/FINISHED_LABEL_MAX/);
    expect(swift).toMatch(/prefix\(40\)/);
  });
});

describe('C-157 : fichier des actions de notification écrit hors du fil principal', () => {
  const swift = code('src-tauri/plugins/notification-actions/ios/Sources/NotificationActionsPlugin.swift');

  it('append rend la main tout de suite (file série asynchrone) et prévient par un rappel', () => {
    const append = body(swift, 'func append(');
    expect(append).toMatch(/func append\(_ entry: \[String: Any\], completion: @escaping \(Bool\) -> Void\)/);
    expect(append).toMatch(/queue\.async \{/);
    expect(append).not.toMatch(/queue\.sync/);
  });

  it('didReceive : gestionnaire de fin et réveil du JS appelés dans le rappel, APRÈS l’écriture (jamais sur le fil principal en attente)', () => {
    const didReceive = swift.slice(swift.indexOf('didReceive response: UNNotificationResponse'));
    const call = didReceive.indexOf('ActionStore.shared.append(entry) { written in');
    expect(call).toBeGreaterThan(-1);
    const after = didReceive.slice(call);
    expect(after.indexOf('completionHandler()')).toBeGreaterThan(0);
    expect(after.indexOf('plugin?.wake()')).toBeGreaterThan(after.indexOf('completionHandler()'));
  });
});
