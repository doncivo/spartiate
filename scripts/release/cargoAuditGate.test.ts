import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error module JavaScript sans déclaration de types
import { advisoryWarnings, classify, parseTree } from './cargo-audit-gate.mjs';

/**
 * BL-134 (lot 0.29.1) : `cargo audit` ne bloque la CI que pour une alerte de sécurité sur une crate compilée pour une cible livrée
 * (Windows ou iPhone, dépendances normales et de build) ; une alerte sur une crate absente de ce graphe (dev, fonction non activée)
 * est un avertissement visible. Un rapport illisible bloque (aucun échec silencieux).
 */
const advisory = (id: string, name: string, version: string) => ({ advisory: { id, package: name, title: `titre ${id}` }, package: { name, version } });
const report = (list: unknown[]) => ({ vulnerabilities: { found: list.length > 0, count: list.length, list } });

const TREE = ['spartiate v0.29.1 (C:\\x)', 'serde v1.0.228', 'tokio v1.48.0', 'tokio v1.48.0', 'libc v0.2.177', ''].join('\n');

describe('cargo audit limité au graphe livré (BL-134)', () => {
  it('lit les lignes de `cargo tree --prefix none` en nom@version', () => {
    const set = parseTree(TREE);
    expect([...set].sort()).toEqual(['libc@0.2.177', 'serde@1.0.228', 'spartiate@0.29.1', 'tokio@1.48.0']);
  });

  it('bloque une alerte sur une crate livrée, avertit pour une crate hors graphe', () => {
    const shipped = parseTree(TREE);
    const result = classify(report([advisory('RUSTSEC-2099-0001', 'tokio', '1.48.0'), advisory('RUSTSEC-2023-0071', 'rsa', '0.9.8')]), shipped);
    expect(result.blocking.map((a: { id: string }) => a.id)).toEqual(['RUSTSEC-2099-0001']);
    expect(result.warnings.map((a: { id: string }) => a.id)).toEqual(['RUSTSEC-2023-0071']);
  });

  it('compare nom ET version : une autre version de la même crate hors graphe ne bloque pas', () => {
    const result = classify(report([advisory('RUSTSEC-2099-0002', 'tokio', '0.1.22')]), parseTree(TREE));
    expect(result.blocking).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it('aucun rapport, rapport illisible ou graphe vide : erreur, jamais un passage silencieux', () => {
    expect(() => classify(undefined, parseTree(TREE))).toThrow();
    expect(() => classify({ vulnerabilities: {} }, parseTree(TREE))).toThrow();
    expect(() => classify(report([]), new Set())).toThrow();
    expect(classify(report([]), parseTree(TREE))).toEqual({ blocking: [], warnings: [] });
  });

  it('revue : avertissements de cargo audit (non maintenue, yanked…) rendus visibles, jamais bloquants', () => {
    const warnings = { unmaintained: [{ kind: 'unmaintained', package: { name: 'paste', version: '1.0.15' }, advisory: { id: 'RUSTSEC-2024-0436', title: 'paste - no longer maintained' } }], yanked: [{ kind: 'yanked', package: { name: 'foo', version: '0.1.0' }, advisory: null }] };
    expect(advisoryWarnings({ ...report([]), warnings })).toEqual(['unmaintained RUSTSEC-2024-0436 sur paste@1.0.15 : paste - no longer maintained', 'yanked sur foo@0.1.0']);
    expect(advisoryWarnings(report([]))).toEqual([]);
  });

  it('tests.yml : rapport JSON, graphes des deux cibles livrées, porte appelée sans --ignore', () => {
    const yml = readFileSync(join(resolve(__dirname, '..', '..'), '.github/workflows/tests.yml'), 'utf8');
    expect(yml).toMatch(/cargo audit --json --file src-tauri\/Cargo\.lock/);
    expect(yml).toMatch(/--target x86_64-pc-windows-msvc -e normal,build --prefix none/);
    expect(yml).toMatch(/--target aarch64-apple-ios -e normal,build --prefix none/);
    expect(yml).toMatch(/node scripts\/release\/cargo-audit-gate\.mjs/);
    expect(yml).not.toMatch(/cargo audit[^\n]*--ignore/);
  });
});
