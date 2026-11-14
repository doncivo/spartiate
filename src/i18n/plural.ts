/**
 * FIX-0241 critère 5 : pluriel français des compteurs. 0 et 1 s'accordent au singulier (« 0 jour », « 1 jour »), 2 et plus au pluriel
 * (« 2 jours », « 21 jours »). Module sans dépendance, importé seulement par les écrans (et catalogues) qui comptent quelque chose.
 */
/**
 * Les écrans du bundle de départ (synchro : ConflictList, SyncDetails*, syncText) n'importent pas ce module : le plafond de 358 400 octets
 * et la liste blanche du départ l'interdisent. Ils écrivent `n < 2`, même règle pour des entiers.
 */
const RULES = new Intl.PluralRules('fr-FR');

export function isSingular(count: number): boolean {
  return RULES.select(count) === 'one';
}

/**
 * Texte d'un compteur : choisit la clé au singulier ou au pluriel et injecte le nombre sous les noms `n` et `count`
 * (les autres paramètres du texte sont passés tels quels). Les textes au singulier portent eux aussi le nombre, pour que 0 s'écrive « 0 jour ».
 */
export function tPlural<K extends string>(
  translate: (key: K, params?: Readonly<Record<string, string | number>>) => string,
  count: number,
  oneKey: K,
  otherKey: K,
  params: Readonly<Record<string, string | number>> = {},
): string {
  return translate(isSingular(count) ? oneKey : otherKey, { n: count, count, ...params });
}
