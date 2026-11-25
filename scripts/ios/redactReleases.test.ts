import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- module JavaScript sans déclaration de types (script de publication)
import { OLD_RELEASE_TAGS, redactReleaseBodies } from './redact-release-bodies.mjs';

/**
 * BL-165 (REL-0.29.2, D-489, D-564) : les corps de six anciennes publications de spartiate-releases sont réécrits par le workflow de
 * publication, par l'API GitHub, jamais à la main. Chaînes synthétiques seulement : le mot visé est remplacé par un témoin
 * (« Lieu-Témoin ») et le correcteur est injecté ; aucun appel réseau (fetch simulé).
 */
const REPO = 'exemple/depot-public';
const fakeRedact = (t: string): string => t.replace(/Lieu-Témoin/g, 'Salle complète');

interface Call { method: string; url: string; body?: string }

function fakeGitHub(releases: Record<string, { id: number; body: string | null } | number>) {
  const calls: Call[] = [];
  const fetchImpl = async (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body });
    expect(init?.headers?.Authorization).toBe('Bearer jeton-synthetique');
    const tag = decodeURIComponent(url.split('/releases/tags/')[1] ?? '');
    if (method === 'GET') {
      const r = releases[tag];
      if (r === undefined) return { ok: false, status: 404, json: async () => ({}) };
      if (typeof r === 'number') return { ok: false, status: r, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ id: r.id, tag_name: tag, body: r.body }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  return { calls, fetchImpl };
}

describe('BL-165 : réécriture des corps des anciennes publications', () => {
  it('vise les six publications citées par le registre', () => {
    expect(OLD_RELEASE_TAGS).toEqual(['v0.2.0', 'ios-v0.2.0', 'v0.3.0', 'ios-v0.3.0', 'v0.3.3', 'ios-v0.3.3']);
  });

  it('réécrit seulement les corps qui changent, par PATCH sur l’identifiant de la publication', async () => {
    const gh = fakeGitHub({
      'v0.2.0': { id: 11, body: '- Profil « Club Sport Lieu-Témoin » par défaut.' },
      'ios-v0.2.0': { id: 12, body: 'Notes sans lieu.' },
      'v0.3.0': { id: 13, body: null },
    });
    const result = await redactReleaseBodies({ repo: REPO, token: 'jeton-synthetique', tags: ['v0.2.0', 'ios-v0.2.0', 'v0.3.0', 'v9.9.9'], fetchImpl: gh.fetchImpl, redact: fakeRedact });
    expect(result).toEqual([
      { tag: 'v0.2.0', status: 'réécrite' },
      { tag: 'ios-v0.2.0', status: 'inchangée' },
      { tag: 'v0.3.0', status: 'inchangée' },
      { tag: 'v9.9.9', status: 'absente' },
    ]);
    const patches = gh.calls.filter((c) => c.method === 'PATCH');
    expect(patches).toEqual([{ method: 'PATCH', url: `https://api.github.com/repos/${REPO}/releases/11`, body: JSON.stringify({ body: '- Profil « Club Sport Salle complète » par défaut.', make_latest: 'false' }) }]);
  });

  it('à blanc (dryRun), aucune écriture', async () => {
    const gh = fakeGitHub({ 'v0.2.0': { id: 11, body: 'Lieu-Témoin' } });
    const result = await redactReleaseBodies({ repo: REPO, token: 'jeton-synthetique', tags: ['v0.2.0'], fetchImpl: gh.fetchImpl, redact: fakeRedact, dryRun: true });
    expect(result).toEqual([{ tag: 'v0.2.0', status: 'à réécrire' }]);
    expect(gh.calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('une erreur d’API autre que 404 échoue visiblement, sans jamais recopier le corps', async () => {
    const gh = fakeGitHub({ 'v0.2.0': 500 });
    await expect(redactReleaseBodies({ repo: REPO, token: 'jeton-synthetique', tags: ['v0.2.0'], fetchImpl: gh.fetchImpl, redact: fakeRedact })).rejects.toThrow(/v0\.2\.0.*500/);
  });

  it('sans jeton, refuse de s’exécuter', async () => {
    await expect(redactReleaseBodies({ repo: REPO, token: '', tags: ['v0.2.0'], fetchImpl: fakeGitHub({}).fetchImpl, redact: fakeRedact })).rejects.toThrow(/jeton/i);
  });

  it('le correcteur par défaut (redactPlace) laisse un texte neutre intact : aucune écriture', async () => {
    const gh = fakeGitHub({ 'v0.2.0': { id: 11, body: 'Le Club Sport X. Séance Été Ça va' } });
    expect(await redactReleaseBodies({ repo: REPO, token: 'jeton-synthetique', tags: ['v0.2.0'], fetchImpl: gh.fetchImpl })).toEqual([{ tag: 'v0.2.0', status: 'inchangée' }]);
  });

  it('le job de publication de build-ios.yml lance l’étape avec RELEASES_TOKEN, après la publication', () => {
    const wf = readFileSync('.github/workflows/build-ios.yml', 'utf8');
    const publish = wf.slice(wf.indexOf('\n  publish:'));
    const step = publish.indexOf('node scripts/ios/redact-release-bodies.mjs');
    expect(step).toBeGreaterThan(publish.indexOf('- name: Publier sur spartiate-releases'));
    const block = publish.slice(publish.lastIndexOf('- name:', step), step);
    expect(block).toContain('GH_TOKEN: ${{ secrets.RELEASES_TOKEN }}');
  });
});
