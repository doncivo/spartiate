// I4-02 : catalogue Ciqual embarqué (content/food/ciqual.json). Le générateur est déterministe et refuse toute donnée non vérifiée ;
// les cas du parseur utilisent des XML SYNTHÉTIQUES (valeurs inventées, aucune donnée Ciqual de mémoire) ; le contenu réel est contrôlé
// par le validateur et par une valeur relevée dans le fichier officiel (alim 1000 « Pastis », constituant 328 = 274 kcal).
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CIQUAL_FILES, CIQUAL_NUTRIENTS, buildCiqual, checkRawFiles, decodeXmlText, parseDecimal, parseTable, validateCiqual } from './ciqual.mjs';

const ROOT = resolve(__dirname, '..', '..');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

const alimXml = (rows: readonly [string, string, string][]): string =>
  `<?xml version="1.0" encoding="utf-8" ?>\n<TABLE>\n${rows
    .map(([code, name, grp]) => `<ALIM><alim_code> ${code} </alim_code><alim_nom_fr> ${name} </alim_nom_fr><alim_nom_sci missing=" " /><alim_grp_code> ${grp} </alim_grp_code></ALIM>`)
    .join('\n')}\n</TABLE>`;
const grpXml = `<TABLE><ALIM_GRP><alim_grp_code> 01 </alim_grp_code><alim_grp_nom_fr> groupe synthétique </alim_grp_nom_fr><alim_ssgrp_code> 0101 </alim_ssgrp_code></ALIM_GRP><ALIM_GRP><alim_grp_code> 01 </alim_grp_code><alim_grp_nom_fr> groupe synthétique </alim_grp_nom_fr><alim_ssgrp_code> 0102 </alim_ssgrp_code></ALIM_GRP></TABLE>`;
const constXml = `<TABLE>${[
  [328, 'Energie, Règlement UE N° 1169/2011 (kcal/100 g)'],
  [25003, 'Protéines, N x 6.25 (g/100 g)'],
  [31000, 'Glucides (g/100 g)'],
  [34100, 'Fibres alimentaires (g/100 g)'],
  [40000, 'Lipides (g/100 g)'],
  [400, 'Eau (g/100 g)'],
]
  .map(([code, name]) => `<CONST><const_code> ${code} </const_code><const_nom_fr> ${name} </const_nom_fr></CONST>`)
  .join('')}</TABLE>`;
const compoXml = (rows: readonly [string, number, string][]): string =>
  `<TABLE>${rows.map(([alim, constant, teneur]) => `<COMPO><alim_code> ${alim} </alim_code><const_code> ${constant} </const_code><teneur> ${teneur} </teneur><min missing=" " /><max missing=" " /></COMPO>`).join('')}</TABLE>`;

describe('parseDecimal : conventions de la table (virgule décimale, « - », « traces », « < x »)', () => {
  it('valeur mesurée, virgule décimale, zéro écrit', () => {
    expect(parseDecimal(' 59,7 ')).toEqual({ kind: 'value', value: 59.7 });
    expect(parseDecimal('274')).toEqual({ kind: 'value', value: 274 });
    expect(parseDecimal('0')).toEqual({ kind: 'value', value: 0 });
  });
  it('« - » est une valeur absente, « traces » et « < x » ne sont ni zéro ni une valeur', () => {
    expect(parseDecimal(' - ')).toEqual({ kind: 'missing' });
    expect(parseDecimal('')).toEqual({ kind: 'missing' });
    expect(parseDecimal('traces')).toEqual({ kind: 'traces' });
    expect(parseDecimal('&lt; 0,5')).toEqual({ kind: 'below', bound: 0.5 });
    expect(parseDecimal('< 0,01')).toEqual({ kind: 'below', bound: 0.01 });
  });
  it('texte inattendu : invalide (le générateur s’arrête)', () => {
    for (const bad of ['1,2,3', 'abc', '1e5', '-3', '12 g', 'NaN']) expect(parseDecimal(bad), bad).toEqual({ kind: 'invalid' });
  });
});

describe('XML : entités et blocs', () => {
  it('décodage des entités et espaces', () => {
    expect(decodeXmlText('  Pot-au-feu &amp; l&apos;huile &quot;x&quot; &lt;b&gt;  ')).toBe('Pot-au-feu & l\'huile "x" <b>');
  });
  it('un bloc par balise, élément « missing » rendu null', () => {
    const rows = parseTable(alimXml([['9001', 'Aliment A', '01']]), 'ALIM');
    expect(rows).toEqual([{ alim_code: '9001', alim_nom_fr: 'Aliment A', alim_nom_sci: null, alim_grp_code: '01' }]);
  });
});

describe('buildCiqual : jamais de zéro inventé', () => {
  const build = (compo: readonly [string, number, string][], alim: readonly [string, string, string][] = [['9001', 'Aliment synthétique A', '01']]) =>
    buildCiqual({ alim: alimXml(alim), alimGrp: grpXml, compo: compoXml(compo), consts: constXml });

  it('valeurs retenues par code ; absente, traces et « < x » valent null et sont comptées', () => {
    const { data, stats } = build([
      ['9001', 328, '123'],
      ['9001', 25003, '4,5'],
      ['9001', 40000, '< 0,5'],
      ['9001', 31000, 'traces'],
      ['9001', 34100, '-'],
      ['9001', 400, '60'],
    ]);
    expect(data.foods).toEqual([{ code: '9001', nameFr: 'Aliment synthétique A', group: '01', kcal: 123, proteinG: 4.5, fatG: null, carbG: null, fiberG: null }]);
    expect(stats.below.fatG).toBe(1);
    expect(stats.traces.carbG).toBe(1);
    expect(stats.missing.fiberG).toBe(1);
    expect(data.groups).toEqual([{ code: '01', nameFr: 'groupe synthétique' }]);
  });
  it('constituant jamais décrit pour l’aliment : null (pas de ligne = inconnu)', () => {
    const { data } = build([['9001', 328, '10']]);
    expect(data.foods[0]).toMatchObject({ kcal: 10, proteinG: null, fatG: null, carbG: null, fiberG: null });
  });
  it('aliments triés par code numérique, métadonnées de source présentes', () => {
    const { data } = build([], [['9010', 'B', '01'], ['9002', 'A', '01']]);
    expect(data.foods.map((f: Json) => f['code'])).toEqual(['9002', '9010']);
    expect(data.source).toMatchObject({ publisher: 'Anses', version: '2025-11-03', doi: '10.57745/RDMHWY', licence: 'Licence Ouverte Etalab 2.0' });
    expect(data.schemaVersion).toBe(1);
  });
  it('refus : code d’aliment dupliqué, valeur illisible, groupe inconnu, code de constituant décrit autrement', () => {
    expect(() => build([], [['9001', 'A', '01'], ['9001', 'B', '01']])).toThrow(/dupliqu/);
    expect(() => build([['9001', 328, 'beaucoup']])).toThrow(/illisible/);
    expect(() => build([], [['9001', 'A', '99']])).toThrow(/groupe/);
    expect(() => buildCiqual({ alim: alimXml([['9001', 'A', '01']]), alimGrp: grpXml, compo: compoXml([]), consts: constXml.replace('Lipides', 'Autre chose') })).toThrow(/constituant/);
  });
  it('lignes de composition d’un aliment inconnu : refusées', () => {
    expect(() => build([['1234567', 328, '10']])).toThrow(/aliment inconnu/);
  });
  it('les codes de constituants retenus sont ceux de la table officielle', () => {
    expect(CIQUAL_NUTRIENTS).toEqual({ kcal: 328, proteinG: 25003, fatG: 40000, carbG: 31000, fiberG: 34100 });
  });
});

describe('checkRawFiles : somme MD5 publiée', () => {
  it('fichier modifié ou absent : refusé', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ciqual-'));
    for (const file of Object.values(CIQUAL_FILES) as { name: string }[]) writeFileSync(join(dir, file.name), 'pas le bon contenu');
    const errors = checkRawFiles(dir);
    expect(errors.length).toBe(Object.keys(CIQUAL_FILES).length);
    expect(errors[0]).toMatch(/md5/i);
    expect(checkRawFiles(join(dir, 'absent'))).not.toEqual([]);
  });
  it('les sommes publiées sont des MD5 de 32 caractères hexadécimaux', () => {
    for (const file of Object.values(CIQUAL_FILES) as { md5: string }[]) expect(file.md5).toMatch(/^[0-9a-f]{32}$/);
    expect(createHash('md5').update('x').digest('hex')).toHaveLength(32);
  });
});

describe('validateCiqual : schéma du contenu', () => {
  const good = (): Json => ({
    schemaVersion: 1,
    source: { name: 'Table Ciqual 2025', publisher: 'Anses', version: '2025-11-03', doi: '10.57745/RDMHWY', licence: 'Licence Ouverte Etalab 2.0', url: 'https://doi.org/10.57745/RDMHWY', attribution: 'Source : Anses, Table de composition nutritionnelle des aliments Ciqual 2025.' },
    groups: [{ code: '01', nameFr: 'groupe' }],
    foods: [{ code: '9001', nameFr: 'A', group: '01', kcal: 10, proteinG: null, fatG: 0, carbG: 1.5, fiberG: null }],
  });
  it('contenu valide : aucune erreur', () => expect(validateCiqual(good())).toEqual([]));
  it.each([
    ['version de schéma', (d: Json) => (d['schemaVersion'] = 2)],
    ['licence absente', (d: Json) => delete d['source'].licence],
    ['attribution absente', (d: Json) => (d['source'].attribution = '')],
    ['code non numérique', (d: Json) => (d['foods'][0].code = 'abc')],
    ['code dupliqué', (d: Json) => d['foods'].push({ ...d['foods'][0] })],
    ['nom vide', (d: Json) => (d['foods'][0].nameFr = ' ')],
    ['groupe inconnu', (d: Json) => (d['foods'][0].group = '77')],
    ['valeur négative', (d: Json) => (d['foods'][0].kcal = -1)],
    ['valeur non finie', (d: Json) => (d['foods'][0].fatG = 'x')],
    ['clé nutriment manquante', (d: Json) => delete d['foods'][0].fiberG],
    ['énergie impossible (> 900 kcal / 100 g)', (d: Json) => (d['foods'][0].kcal = 901)],
    ['macros > 100 g / 100 g', (d: Json) => ((d['foods'][0].proteinG = 60), (d['foods'][0].carbG = 50))],
  ])('refuse : %s', (_name, mutate) => {
    const d = good();
    (mutate as (d: Json) => void)(d);
    expect(validateCiqual(d).length).toBeGreaterThan(0);
  });
});

describe('contenu réel : content/food/ciqual.json', () => {
  const data = JSON.parse(readFileSync(resolve(ROOT, 'content/food/ciqual.json'), 'utf8')) as Json;
  it('valide, plus de 3 000 génériques, édition 2025', () => {
    expect(validateCiqual(data)).toEqual([]);
    expect(data['foods'].length).toBeGreaterThan(3000);
    expect(data['source'].version).toBe('2025-11-03');
  });
  it('valeur relevée dans le fichier officiel : aliment 1000 « Pastis », 274 kcal / 100 g', () => {
    const food = data['foods'].find((f: Json) => f['code'] === '1000');
    expect(food).toMatchObject({ nameFr: 'Pastis', kcal: 274 });
  });
  it('des valeurs absentes restent null (jamais remplacées par 0)', () => {
    const nulls = data['foods'].filter((f: Json) => f['fiberG'] === null).length;
    expect(nulls).toBeGreaterThan(0);
  });
});

describe('licence et provenance consignées', () => {
  const licences = readFileSync(resolve(ROOT, 'docs/licences.md'), 'utf8');
  it('docs/licences.md : Ciqual, Anses, Etalab 2.0, DOI, MD5 et ODbL pour Open Food Facts', () => {
    expect(licences).toMatch(/Ciqual/);
    expect(licences).toMatch(/Etalab 2\.0/);
    expect(licences).toMatch(/10\.57745\/RDMHWY/);
    expect(licences).toMatch(/H-11/);
    expect(licences).toMatch(/Open Food Facts/);
    expect(licences).toMatch(/ODbL/);
    for (const file of Object.values(CIQUAL_FILES) as { md5: string }[]) expect(licences).toContain(file.md5);
  });
});
