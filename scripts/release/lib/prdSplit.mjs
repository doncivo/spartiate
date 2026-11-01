// Découpage du PRD en chapitres (D-49). Une section = un titre « ## » de premier niveau, blocs de code exclus.
// Le préambule (titre et chapeau avant le premier « ## ») reste dans le chapitre 00 : aucun octet de contenu n'est perdu.

/**
 * @param {string} text
 * @returns {{ heading: string; body: string }[]}
 */
export function parseSections(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let current = null;
  let preamble = [];
  let fenced = false;
  for (const line of lines) {
    if (/^```/.test(line)) fenced = !fenced;
    if (!fenced && /^## /.test(line)) {
      if (current) sections.push(current);
      current = { heading: line, lines: [...preamble, line] };
      preamble = [];
      continue;
    }
    if (current) current.lines.push(line);
    else preamble.push(line);
  }
  if (current) sections.push(current);
  return sections.map((s) => ({ heading: s.heading, body: s.lines.join('\n').replace(/\s+$/, '') + '\n' }));
}

/**
 * Nom du chapitre : NN-titre-en-minuscules.md, NN = numéro de section (annexes : index suivant).
 * @param {string} heading
 * @param {number} number
 */
export function chapterFileName(heading, number) {
  const title = heading
    .replace(/^##\s+/, '')
    .replace(/^\d+\.\s*/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${String(number).padStart(2, '0')}-${title}.md`;
}

/**
 * Applique des remplacements exacts : chaque ancien texte doit apparaître exactement une fois.
 * @param {string} text
 * @param {{ old: string; new: string }[]} changes
 */
export function applyChanges(text, changes) {
  let result = text;
  for (const change of changes) {
    const first = result.indexOf(change.old);
    if (first < 0) throw new Error(`correction introuvable : « ${change.old.slice(0, 60)} »`);
    if (result.indexOf(change.old, first + 1) >= 0) throw new Error(`correction ambiguë (exactement une fois attendu) : « ${change.old.slice(0, 60)} »`);
    result = result.slice(0, first) + change.new + result.slice(first + change.old.length);
  }
  return result;
}
