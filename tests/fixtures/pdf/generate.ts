/**
 * IMPORT-0303 (D-676) : génère les PDF de test de l'import de programme, sans dépendance (PDF 1.4 écrit à la main, police Helvetica
 * standard en WinAnsiEncoding). Relancer : `node tests/fixtures/pdf/generate.ts` ; les fichiers sont déterministes (aucune date).
 *
 * - texte.pdf : programme sur deux pages ; sur la ligne « Squat… » le schéma est écrit AVANT le nom dans le flux (ordre horizontal à refaire).
 * - sans-texte.pdf : une page avec un seul rectangle plein (comme un scan : aucun élément de texte).
 * - chiffre.pdf : protégé par un mot de passe d'ouverture (gestionnaire standard R2, RC4 40 bits, mot de passe « secret »).
 * - 21-pages.pdf : 21 pages de texte (au-delà de la limite de 20).
 * - abime.pdf : en-tête %PDF- suivi d'octets sans structure.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = import.meta.dirname;

interface TextRun {
  readonly x: number;
  readonly y: number;
  readonly text: string;
}

/** Chaîne PDF littérale en WinAnsi (latin1 suffit pour é, à, ×, sauf le tiret long remplacé par 0x97). */
function pdfString(text: string): Buffer {
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch === '—' ? 0x97 : ch.charCodeAt(0);
    if (code > 0xff) throw new Error(`caractère hors WinAnsi : ${ch}`);
    if (ch === '(' || ch === ')' || ch === '\\') bytes.push(0x5c);
    bytes.push(code);
  }
  return Buffer.from(bytes);
}

function textStream(runs: readonly TextRun[]): Buffer {
  const parts: Buffer[] = [];
  for (const run of runs) {
    parts.push(Buffer.from(`BT /F1 12 Tf 1 0 0 1 ${run.x} ${run.y} Tm (`, 'latin1'), pdfString(run.text), Buffer.from(') Tj ET\n', 'latin1'));
  }
  return Buffer.concat(parts);
}

// RC4 et chiffrement standard R2 (PDF 1.4, § 3.5) : assez pour qu'un lecteur exige le mot de passe.
function rc4(key: Buffer, data: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + (s[i] ?? 0) + (key[i % key.length] ?? 0)) & 0xff;
    [s[i], s[j]] = [s[j] ?? 0, s[i] ?? 0];
  }
  const out = Buffer.alloc(data.length);
  let i = 0;
  j = 0;
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + (s[i] ?? 0)) & 0xff;
    [s[i], s[j]] = [s[j] ?? 0, s[i] ?? 0];
    out[n] = (data[n] ?? 0) ^ (s[((s[i] ?? 0) + (s[j] ?? 0)) & 0xff] ?? 0);
  }
  return out;
}
const PAD = Buffer.from('28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a', 'hex');
const padded = (password: string): Buffer => Buffer.concat([Buffer.from(password, 'latin1'), PAD]).subarray(0, 32);
const md5 = (...parts: Buffer[]): Buffer => createHash('md5').update(Buffer.concat(parts)).digest();

interface Encryption {
  readonly key: Buffer;
  readonly o: Buffer;
  readonly u: Buffer;
  readonly p: number;
  readonly id: Buffer;
}
function encryption(user: string, owner: string): Encryption {
  const id = md5(Buffer.from('spartiate-import-0303'));
  const o = rc4(md5(padded(owner)).subarray(0, 5), padded(user));
  const p = -44;
  const pBytes = Buffer.alloc(4);
  pBytes.writeInt32LE(p);
  const key = md5(padded(user), o, pBytes, id).subarray(0, 5);
  return { key, o, u: rc4(key, PAD), p, id };
}
function objectKey(enc: Encryption, num: number): Buffer {
  return md5(enc.key, Buffer.from([num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff, 0, 0])).subarray(0, 10);
}

/** PDF complet : une page par entrée de `pages` (contenu déjà écrit). */
function buildPdf(pages: readonly Buffer[], enc?: Encryption): Buffer {
  const objects: Buffer[] = [];
  const pageCount = pages.length;
  const firstPage = 4;
  const kids = Array.from({ length: pageCount }, (_, i) => `${firstPage + i * 2} 0 R`).join(' ');
  objects.push(Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'latin1'));
  objects.push(Buffer.from(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`, 'latin1'));
  objects.push(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', 'latin1'));
  pages.forEach((content, i) => {
    const pageNum = firstPage + i * 2;
    const streamNum = pageNum + 1;
    objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamNum} 0 R >>`, 'latin1'));
    const data = enc ? rc4(objectKey(enc, streamNum), content) : content;
    objects.push(Buffer.concat([Buffer.from(`<< /Length ${data.length} >>\nstream\n`, 'latin1'), data, Buffer.from('\nendstream', 'latin1')]));
  });
  let encryptRef = '';
  if (enc) {
    objects.push(Buffer.from(`<< /Filter /Standard /V 1 /R 2 /O <${enc.o.toString('hex')}> /U <${enc.u.toString('hex')}> /P ${enc.p} >>`, 'latin1'));
    encryptRef = ` /Encrypt ${objects.length} 0 R /ID [<${enc.id.toString('hex')}> <${enc.id.toString('hex')}>]`;
  }
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let offset = chunks[0]?.length ?? 0;
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(offset);
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), body, Buffer.from('\nendobj\n', 'latin1')]);
    chunks.push(chunk);
    offset += chunk.length;
  });
  const xref = [`xref\n0 ${objects.length + 1}\n`, '0000000000 65535 f \n', ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)].join('');
  chunks.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${encryptRef} >>\nstartxref\n${offset}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(chunks);
}

const lines = (texts: readonly string[], top = 780): TextRun[] => texts.map((text, i) => ({ x: 72, y: top - i * 20, text }));

const page1 = textStream([
  ...lines(['Programme Force', 'Jour A — Haut', 'Développé couché 4×8-10 RIR 2', 'Rowing à la barre 4 x 10']),
  // Ligne écrite schéma d'abord, nom ensuite : l'ordre horizontal (x) doit la remettre dans le bon sens.
  { x: 260, y: 700, text: '3×12' },
  { x: 72, y: 700, text: 'Curl biceps' },
]);
const page2 = textStream(lines(['Jour B — Bas', 'Squat à la barre : 4 séries de 6', 'Fentes 3×10']));

writeFileSync(join(dir, 'texte.pdf'), buildPdf([page1, page2]));
writeFileSync(join(dir, 'sans-texte.pdf'), buildPdf([Buffer.from('0.2 0.2 0.2 rg 72 300 450 450 re f\n', 'latin1')]));
writeFileSync(join(dir, 'chiffre.pdf'), buildPdf([page1], encryption('secret', 'proprietaire')));
writeFileSync(join(dir, '21-pages.pdf'), buildPdf(Array.from({ length: 21 }, (_, i) => textStream(lines([`Page ${i + 1} du programme`, 'Squat 4×8-10'])))));
writeFileSync(join(dir, 'abime.pdf'), Buffer.concat([Buffer.from('%PDF-1.4\n', 'latin1'), Buffer.from(Array.from({ length: 512 }, (_, i) => (i * 37 + 11) & 0xff))]));
