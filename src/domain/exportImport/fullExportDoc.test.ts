import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FULL_EXPORT_EXCLUDED, FULL_EXPORT_TABLES, fullExportColumns } from './fullExport';

/**
 * I6-03 : `docs/export-complet.md` décrit chaque fichier, chaque colonne (type, unité, NULL possible) et les règles d'ordre. Garde déterministe : le
 * document et le code ne peuvent pas diverger (une colonne ajoutée sans mise à jour du document fait échouer ce test).
 */
const doc = readFileSync('docs/export-complet.md', 'utf8');
const section = (table: string): string => {
  const start = doc.indexOf(`### \`csv/${table}.csv\``);
  if (start < 0) return '';
  const next = doc.indexOf('\n### ', start + 5);
  const nextTop = doc.indexOf('\n## ', start + 5);
  const end = [next, nextTop].filter((i) => i > 0).sort((a, b) => a - b)[0] ?? doc.length;
  return doc.slice(start, end);
};

describe('docs/export-complet.md', () => {
  it('une section par fichier CSV, une ligne par colonne avec son type, son unité et la possibilité de NULL', () => {
    for (const table of FULL_EXPORT_TABLES) {
      const text = section(table);
      expect(text, `section ${table}`).not.toBe('');
      const rows = text.split('\n').filter((l) => l.startsWith('| `'));
      const columns = fullExportColumns(table);
      expect(rows.map((l) => l.split('|')[1]?.trim()), table).toEqual(columns.map((c) => `\`${c.name}\``));
      for (const [i, c] of columns.entries()) {
        const cells = (rows[i] ?? '').split('|').map((x) => x.trim());
        expect(cells[2], `${table}.${c.name} type`).toBe(c.type);
        expect(cells[3], `${table}.${c.name} unité`).toBe(c.unit ?? '—');
        expect(cells[4], `${table}.${c.name} NULL`).toBe(c.nullable ? 'oui' : 'non');
      }
    }
  });

  it('dit le format (BOM, séparateur, fin de ligne, guillemets, dates, nombres, cellule vide), les règles d’ordre et les exclusions', () => {
    for (const phrase of ['UTF-8', 'marque d’ordre des octets', 'point-virgule', 'CRLF', 'guillemets', 'ISO 8601', 'point décimal', 'cellule vide', 'triées par `id`', 'apostrophe', 'manifest.json', 'contenu.json', 'data.json']) {
      expect(doc, phrase).toContain(phrase);
    }
    for (const excluded of FULL_EXPORT_EXCLUDED) expect(doc, excluded).toContain(`\`${excluded}\``);
    expect(doc).toMatch(/photos? de progression/);
    expect(doc).toMatch(/jamais (de|d’)[^.]*(clé|jeton)/);
  });
});
