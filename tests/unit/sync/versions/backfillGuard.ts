/** DATA-0293 (BL-098) : remplissages de colonnes publiées par les instructions d'une migration (lecture statique, sans exécution). */
export interface Backfill {
  readonly table: string;
  readonly column: string;
}

/** Colonnes d'horodatage et de capture : écrites par tout UPDATE sans être un remplissage de donnée. */
const STAMP = new Set(['updated_at', 'device_id', 'hlc']);

export function publishedBackfills(statements: readonly string[], catalogue: ReadonlyMap<string, ReadonlySet<string>>): Backfill[] {
  const found: Backfill[] = [];
  for (const raw of statements) {
    const sql = raw.replace(/\s+/g, ' ').trim();
    const replace = /^(?:INSERT OR REPLACE INTO|REPLACE INTO) (\w+)/i.exec(sql);
    if (replace?.[1] !== undefined && catalogue.has(replace[1])) {
      found.push({ table: replace[1], column: '*' });
      continue;
    }
    const update = /^UPDATE (?:OR \w+ )?(\w+) SET (.+?)(?: WHERE .*)?$/i.exec(sql);
    const published = update?.[1] === undefined ? undefined : catalogue.get(update[1]);
    if (update?.[1] === undefined || update[2] === undefined || published === undefined) continue;
    for (const m of update[2].matchAll(/(?:^|, )(\w+) = /g)) {
      const column = m[1];
      if (column !== undefined && published.has(column) && !STAMP.has(column)) found.push({ table: update[1], column });
    }
  }
  return found;
}
