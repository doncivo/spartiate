// AUDIT-CLAUDE-0.27.0, partie 11 : contrôles déterministes des tests et des workflows (D-50).
// Usage : node docs/audit-claude-0.27.0/preuves/partie11-tests.mjs > docs/audit-claude-0.27.0/preuves/resultats/partie11-tests.json
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ls = (spec) => execSync(`git ls-tree -r --name-only v0.27.0 -- ${spec}`, { encoding: 'utf8' }).split('\n').filter(Boolean);
const tests = [...ls('src tests scripts')].filter((f) => /\.(test|spec)\.(ts|tsx|mjs)$/.test(f));
const out = { fichiers: tests.length, desactives: [], focalises: [], sansAssertion: [], attentesArbitraires: [], horlogeReelle: [], aleatoire: [], seuilsCouverture: null, workflows: {} };
for (const f of tests) {
  const t = readFileSync(f, 'utf8');
  const L = t.split('\n');
  L.forEach((l, i) => {
    if (/\b(it|test|describe)\.(skip|todo|fixme)\b|\bx(it|describe)\(/.test(l)) out.desactives.push(`${f}:${i + 1}: ${l.trim().slice(0, 100)}`);
    if (/\b(it|test|describe)\.only\b|\bf(it|describe)\(/.test(l)) out.focalises.push(`${f}:${i + 1}`);
    if (/waitForTimeout\(\s*\d{3,}|setTimeout\([^,]+,\s*[1-9]\d{3,}\)/.test(l)) out.attentesArbitraires.push(`${f}:${i + 1}: ${l.trim().slice(0, 100)}`);
    if (/Math\.random\(/.test(l)) out.aleatoire.push(`${f}:${i + 1}`);
  });
  // Blocs it(...) sans expect / assert / toThrow / rejects dans leur corps (approximation par découpe sur it( / test().
  const blocks = t.split(/\n\s*(?:it|test)(?:\.each\([^)]*\))?\(/).slice(1);
  blocks.forEach((b) => {
    const body = b.split(/\n\s*(?:it|test|describe)(?:\.each\([^)]*\))?\(/)[0];
    if (!/expect|assert|toThrow|rejects|\.should|fail\(|throw new Error|toMatchSnapshot|verify|check[A-Z]\w*\(/.test(body)) out.sansAssertion.push(`${f}: ${body.split('\n')[0].trim().slice(0, 90)}`);
  });
  if (/new Date\(\)|Date\.now\(\)/.test(t) && !/useFakeTimers|setSystemTime|vi\.spyOn\(Date|clock|Clock/.test(t)) out.horlogeReelle.push(f);
}
const vc = readFileSync('vitest.config.ts', 'utf8');
out.seuilsCouverture = [...vc.matchAll(/'([^']+)':\s*\{\s*lines:\s*(\d+)/g)].map((m) => `${m[1]} ${m[2]} %`);
for (const w of ls('.github/workflows').filter((f) => f.endsWith('.yml'))) {
  const y = readFileSync(w, 'utf8');
  const uses = [...y.matchAll(/uses:\s*([^\s#]+)/g)].map((m) => m[1]);
  out.workflows[w] = {
    permissionsGlobales: (y.match(/^permissions:[\s\S]*?(?=^\S)/m)?.[0] ?? 'ABSENT').replace(/\s+/g, ' ').trim(),
    permissionsParJob: [...y.matchAll(/^\s{4}permissions:\s*\n((?:\s{6}.+\n)+)/gm)].map((m) => m[1].replace(/\s+/g, ' ').trim()),
    actionsNonFigees: uses.filter((u) => !/@[0-9a-f]{40}$/.test(u) && !u.startsWith('./')),
    actionsFigees: uses.filter((u) => /@[0-9a-f]{40}$/.test(u)).length,
    secrets: [...new Set([...y.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]))],
    pullRequestTarget: /pull_request_target/.test(y),
    scriptInjection: [...y.matchAll(/\$\{\{\s*github\.(event\.(issue|pull_request|comment|head_commit)\.[a-z_.]+|head_ref)\s*\}\}/g)].map((m) => m[0]),
  };
}
console.log(JSON.stringify(out, null, 1));
