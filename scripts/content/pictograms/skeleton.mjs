// MEDIA-03 : moteur de pictogrammes (Node seul, aucune dépendance). Un exercice = deux poses (départ, arrivée) décrites par des angles
// d'articulations ; la cinématique directe en tire les tracés SVG, tous au même gabarit (viewBox, épaisseurs, proportions).
// Couleurs : `currentColor` et variable de la charte (bronze) seulement, jamais de couleur en dur.

/** Gabarit commun (proposition MEDIA-03 : modifier une valeur ici refait tous les pictogrammes). */
export const TEMPLATE = {
  width: 220,
  height: 120,
  panel: 100, // largeur d'une silhouette ; arrivée décalée de `endOffset`
  endOffset: 120,
  floor: 104,
  lengths: { torso: 34, upperArm: 18, forearm: 17, thigh: 24, shin: 24, foot: 8, headGap: 9, headRadius: 6.5 },
  widths: { torso: 7, limb: 4.5, prop: 2.5, floor: 1.5 },
  startOpacity: 0.5,
  accentClass: 'ct-picto-muscle',
};

const RAD = Math.PI / 180;
/** Direction d'un angle : 0 vers le bas, 90 vers l'avant (droite), 180 vers le haut, -90 vers l'arrière. */
const dir = (a) => [Math.sin(a * RAD), Math.cos(a * RAD)];
const add = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const r1 = (n) => Math.round(n * 10) / 10;

/**
 * Pose : t = angle du tronc (hanche vers cou), a = [bras, avant-bras], l = [cuisse, jambe], extras :
 * a2 / l2 = membre éloigné (dessiné plus clair), foot = angle du pied (90 vers l'avant).
 */
export function P(t, a, l, extra = {}) {
  return { t, a, l, ...extra };
}

function joints(pose) {
  const L = TEMPLATE.lengths;
  const hip = [0, 0];
  const u = dir(pose.t);
  const neck = add(hip, u, L.torso);
  const head = add(neck, u, L.headGap);
  const elbow = add(neck, dir(pose.a[0]), L.upperArm);
  const wrist = add(elbow, dir(pose.a[1]), L.forearm);
  const knee = add(hip, dir(pose.l[0]), L.thigh);
  const ankle = add(knee, dir(pose.l[1]), L.shin);
  const toe = add(ankle, dir(pose.foot ?? 90), L.foot);
  const J = { hip, neck, shoulder: neck, head, elbow, wrist, knee, ankle, toe };
  if (pose.a2) {
    J.elbow2 = add(neck, dir(pose.a2[0]), L.upperArm);
    J.wrist2 = add(J.elbow2, dir(pose.a2[1]), L.forearm);
  }
  if (pose.l2) {
    J.knee2 = add(hip, dir(pose.l2[0]), L.thigh);
    J.ankle2 = add(J.knee2, dir(pose.l2[1]), L.shin);
    J.toe2 = add(J.ankle2, dir(pose.l2[2] ?? 90), L.foot);
  }
  return J;
}

/** Pose placée dans le panneau : l'articulation d'ancrage reste au même endroit au départ et à l'arrivée. */
function place(pose, anchor) {
  const J = joints(pose);
  const a = anchor ?? { joint: 'ankle', x: 42 };
  const dx = a.x - J[a.joint][0];
  let dy;
  if (a.y !== undefined) dy = a.y - J[a.joint][1];
  else dy = TEMPLATE.floor - Math.max(...Object.values(J).map((p) => p[1]));
  const out = {};
  for (const [k, p] of Object.entries(J)) out[k] = [p[0] + dx, p[1] + dy];
  return out;
}

/** Zones du corps portant chaque muscle : [segment, début, fin] (fractions le long du segment). */
const ZONES = {
  chest: [['torso', 0.55, 0.95]],
  lats: [['torso', 0.4, 0.85]],
  'middle-traps': [['torso', 0.7, 1]],
  'upper-traps': [['torso', 0.85, 1]],
  trapezius: [['torso', 0.8, 1]],
  'erector-spinae': [['torso', 0, 0.55]],
  'lower-back': [['torso', 0, 0.45]],
  'front-delts': [['arm', 0, 0.45]],
  'middle-delts': [['arm', 0, 0.45]],
  'rear-delts': [['arm', 0, 0.45]],
  deltoids: [['arm', 0, 0.45]],
  shoulders: [['arm', 0, 0.45]],
  'rotator-cuff': [['arm', 0, 0.4]],
  biceps: [['arm', 0.15, 1]],
  triceps: [['arm', 0.15, 1]],
  brachialis: [['arm', 0.4, 1]],
  brachioradialis: [['fore', 0, 0.7]],
  forearms: [['fore', 0.1, 1]],
  'forearm-flexors': [['fore', 0.1, 1]],
  quads: [['thigh', 0.15, 1]],
  hamstrings: [['thigh', 0.1, 0.9]],
  glutes: [['thigh', 0, 0.4], ['torso', 0, 0.12]],
  'gluteus-medius': [['thigh', 0, 0.4], ['torso', 0, 0.12]],
  'gluteus-minimus': [['thigh', 0, 0.4]],
  adductors: [['thigh', 0.3, 0.95]],
  calves: [['shin', 0.1, 0.9]],
  gastrocnemius: [['shin', 0.1, 0.9]],
  soleus: [['shin', 0.1, 0.9]],
  'tibialis-anterior': [['shin', 0.15, 0.95]],
  abs: [['torso', 0.05, 0.55]],
  obliques: [['torso', 0.1, 0.6]],
  'hip-flexors': [['thigh', 0, 0.35]],
};
export const ZONE_MUSCLES = Object.keys(ZONES);

function segmentPoints(J, name) {
  switch (name) {
    case 'torso': return [J.hip, J.neck];
    case 'arm': return [J.neck, J.elbow];
    case 'fore': return [J.elbow, J.wrist];
    case 'thigh': return [J.hip, J.knee];
    case 'shin': return [J.knee, J.ankle];
    default: throw new Error(`segment inconnu : ${name}`);
  }
}

const pt = (p) => `${r1(p[0])} ${r1(p[1])}`;
const line = (pts, width, extra = '') => `<path d="M${pts.map(pt).join('L')}" stroke-width="${width}"${extra}/>`;

/** Primitives d'accessoires : { t: 'l', p: [x1,y1,x2,y2] } ou { t: 'c', c: [x,y,r], f } (f = plein). */
export const prop = {
  bar: (joint = 'wrist') => (S, C) => [{ t: 'c', c: [...C[joint], 7] }, { t: 'c', c: [...C[joint], 1.6], f: true }],
  db: (joint = 'wrist') => (S, C) => [{ t: 'c', c: [...C[joint], 4.2], f: true }],
  kb: (joint = 'wrist') => (S, C) => [{ t: 'c', c: [C[joint][0], C[joint][1] + 5, 5.5], f: true }],
  plate: (joint = 'wrist') => (S, C) => [{ t: 'c', c: [...C[joint], 6.5] }],
  cable: (to, joint = 'wrist') => (S, C) => [{ t: 'l', p: [...C[joint], ...to], thin: true }, { t: 'c', c: [...to, 3] }],
  /** Banc plat sous le dos (ancré sur la hanche de départ), pieds à terre. */
  flatBench: (S) => {
    const y = Math.max(S.hip[1], S.neck[1]) + 7;
    const x0 = Math.min(S.head[0], S.hip[0]) - 6;
    const x1 = Math.max(S.hip[0], S.neck[0]) + 12;
    return [{ t: 'l', p: [x0, y, x1, y] }, { t: 'l', p: [x0 + 4, y, x0 + 4, TEMPLATE.floor], thin: true }, { t: 'l', p: [x1 - 4, y, x1 - 4, TEMPLATE.floor], thin: true }];
  },
  /** Banc sous les épaules seulement (hip thrust) : bord du banc à hauteur de l'omoplate. */
  shoulderBench: (S) => {
    const y = S.neck[1] + 7;
    return [{ t: 'l', p: [S.neck[0] - 14, y, S.neck[0] + 6, y] }, { t: 'l', p: [S.neck[0] - 10, y, S.neck[0] - 10, TEMPLATE.floor], thin: true }];
  },
  /** Dossier et assise d'une machine ou d'un banc incliné, derrière le tronc de départ. */
  seat: (S) => {
    const ux = S.neck[0] - S.hip[0];
    const uy = S.neck[1] - S.hip[1];
    const len = Math.hypot(ux, uy) || 1;
    const nx = (uy / len) * 8;
    const ny = (-ux / len) * 8;
    const sy = S.hip[1] + 8;
    return [
      { t: 'l', p: [S.hip[0] + nx - (ux / len) * 4, S.hip[1] + ny - (uy / len) * 4, S.neck[0] + nx + (ux / len) * 6, S.neck[1] + ny + (uy / len) * 6] },
      { t: 'l', p: [S.hip[0] - 10, sy, S.hip[0] + 22, sy] },
      { t: 'l', p: [S.hip[0] + 6, sy, S.hip[0] + 6, TEMPLATE.floor], thin: true },
    ];
  },
  /** Barre fixe horizontale au-dessus des mains de départ. */
  pullBar: (S) => [{ t: 'l', p: [S.wrist[0] - 16, S.wrist[1] - 2, S.wrist[0] + 16, S.wrist[1] - 2] }],
  /** Marche ou cale au sol sous l'avant-pied de départ. */
  step: (S) => [{ t: 'l', p: [S.ankle[0] - 10, S.ankle[1] + 3, S.ankle[0] + 16, S.ankle[1] + 3] }],
  /** Banc derrière le corps à la hauteur donnée (pied arrière surélevé). */
  benchBehind: (x, y) => () => [{ t: 'l', p: [x - 9, y, x + 9, y] }, { t: 'l', p: [x, y, x, TEMPLATE.floor], thin: true }],
  /** Barre de landmine : du poignet au point d'attache au sol. */
  landmine: (to) => (S, C) => [{ t: 'l', p: [...C.wrist, ...to] }, { t: 'c', c: [...to, 2], f: true }],
  /** Pastille pleine sur une articulation (patin, curseur, roue). */
  dot: (joint, r = 3) => (S, C) => [{ t: 'c', c: [C[joint][0], C[joint][1], r], f: true }],
  /** Lien fin entre deux articulations (bande élastique). */
  link: (a, b) => (S, C) => [{ t: 'l', p: [...C[a], ...C[b]], thin: true }],
  /** Poids suspendu à la ceinture. */
  beltWeight: (S, C) => [{ t: 'l', p: [C.hip[0], C.hip[1], C.hip[0], C.hip[1] + 14], thin: true }, { t: 'c', c: [C.hip[0], C.hip[1] + 18, 5], f: true }],
  /** Dossier vertical ou incliné derrière le tronc de départ. */
  back: (S) => {
    const ux = S.neck[0] - S.hip[0];
    const uy = S.neck[1] - S.hip[1];
    const len = Math.hypot(ux, uy) || 1;
    const nx = (uy / len) * 9;
    const ny = (-ux / len) * 9;
    return [{ t: 'l', p: [S.hip[0] + nx, S.hip[1] + ny, S.neck[0] + nx, S.neck[1] + ny] }];
  },
  /** Appui devant le tronc (banc incliné face à soi) avec son pied au sol. */
  frontPad: (S) => {
    const ux = S.neck[0] - S.hip[0];
    const uy = S.neck[1] - S.hip[1];
    const len = Math.hypot(ux, uy) || 1;
    const nx = (-uy / len) * 9;
    const ny = (ux / len) * 9;
    const x = S.hip[0] + nx;
    const y = S.hip[1] + ny;
    return [{ t: 'l', p: [x, y, S.neck[0] + nx, S.neck[1] + ny] }, { t: 'l', p: [x, y, x, TEMPLATE.floor], thin: true }];
  },
  /** Banc sous le ventre (allongé sur le ventre), un pied de chaque côté. */
  proneBench: (S) => {
    const y = S.hip[1] + 8;
    const x0 = S.hip[0] - 8;
    const x1 = S.neck[0] + 12;
    return [{ t: 'l', p: [x0, y, x1, y] }, { t: 'l', p: [x0 + 3, y, x0 + 3, TEMPLATE.floor], thin: true }, { t: 'l', p: [x1 - 3, y, x1 - 3, TEMPLATE.floor], thin: true }];
  },
  /** Mur derrière le dos. */
  wall: (S) => [{ t: 'l', p: [S.hip[0] - 9, 10, S.hip[0] - 9, TEMPLATE.floor], thin: true }],
  /** Assise basse (banc ou sol surélevé) sous la hanche de départ. */
  stool: (S) => [{ t: 'l', p: [S.hip[0] - 8, S.hip[1] + 8, S.hip[0] + 10, S.hip[1] + 8] }, { t: 'l', p: [S.hip[0], S.hip[1] + 8, S.hip[0], TEMPLATE.floor], thin: true }],
  /** Barres parallèles sous les mains de départ. */
  bars: (S) => [{ t: 'l', p: [S.wrist[0] - 10, S.wrist[1] + 4, S.wrist[0] + 10, S.wrist[1] + 4] }, { t: 'l', p: [S.wrist[0], S.wrist[1] + 4, S.wrist[0], TEMPLATE.floor], thin: true }],
  /** Rail vertical d'une machine guidée (Smith) à l'abscisse x. */
  rail: (x) => () => [{ t: 'l', p: [x, 8, x, TEMPLATE.floor], thin: true }],
  /** Patin ou plateau perpendiculaire à la jambe au niveau de la cheville (presse). */
  footPlate: (S, C) => [{ t: 'l', p: [C.ankle[0] - 3, C.ankle[1] - 11, C.ankle[0] + 3, C.ankle[1] + 11] }],
  line: (x1, y1, x2, y2, thin = false) => () => [{ t: 'l', p: [x1, y1, x2, y2], thin }],
  circle: (x, y, r, f = false) => () => [{ t: 'c', c: [x, y, r], f }],
};

function primitive(p) {
  const W = TEMPLATE.widths;
  if (p.t === 'l') return `<path d="M${pt([p.p[0], p.p[1]])}L${pt([p.p[2], p.p[3]])}" stroke-width="${p.thin ? W.floor : W.prop}"/>`;
  return `<circle cx="${r1(p.c[0])}" cy="${r1(p.c[1])}" r="${r1(p.c[2])}" stroke-width="${W.prop}"${p.f ? ' fill="currentColor"' : ''}/>`;
}

function silhouette(J, pose, muscles, props, S) {
  const W = TEMPLATE.widths;
  const parts = [];
  if (pose.l2) parts.push(`<g opacity=".5">${line([J.hip, J.knee2, J.ankle2, J.toe2], W.limb)}</g>`);
  if (pose.a2) parts.push(`<g opacity=".5">${line([J.neck, J.elbow2, J.wrist2], W.limb)}</g>`);
  parts.push(line([J.hip, J.neck], W.torso));
  parts.push(line([J.hip, J.knee, J.ankle, J.toe], W.limb));
  parts.push(line([J.neck, J.elbow, J.wrist], W.limb));
  parts.push(`<circle cx="${r1(J.head[0])}" cy="${r1(J.head[1])}" r="${TEMPLATE.lengths.headRadius}" stroke-width="3"/>`);
  const accent = [];
  for (const m of muscles) {
    for (const [seg, a, b] of ZONES[m] ?? []) {
      const [p0, p1] = segmentPoints(J, seg);
      const width = seg === 'torso' ? W.torso : W.limb;
      accent.push(line([lerp(p0, p1, a), lerp(p0, p1, b)], width + 0.6));
    }
  }
  const acc = accent.length === 0 ? '' : `<g class="${TEMPLATE.accentClass}">${accent.join('')}</g>`;
  const pr = props.flatMap((f) => f(S, J)).map(primitive).join('');
  return { body: parts.join(''), accent: acc, props: pr };
}

/**
 * Pictogramme complet : { start, end } (poses), muscles (identifiants de muscles.json), props (fonctions de `prop`), anchor.
 * Retourne le texte SVG (viewBox 220 × 120, départ à gauche en transparence, arrivée à droite, flèche entre les deux).
 */
export function renderPictogram(spec) {
  const T = TEMPLATE;
  const S = place(spec.start, spec.anchor);
  const E = place(spec.end, spec.anchor);
  const floor = (x0, x1) => `<path d="M${x0} ${T.floor + 2}H${x1}" stroke-width="${T.widths.floor}" opacity=".35"/>`;
  const panel = (J, pose, opacity, dx) => {
    const s = silhouette(J, pose, spec.muscles, spec.props ?? [], S);
    const o = opacity === 1 ? '' : ` opacity="${opacity}"`;
    const k = spec.scale ? ` scale(${spec.scale})` : '';
    return `<g transform="translate(${dx} 0)${k}"${o}>${spec.noFloor ? '' : floor(4, T.panel - 4)}${s.props}${s.body}${s.accent}</g>`;
  };
  const arrow = `<path d="M${T.panel + 3} 60h14m-5-5 5 5-5 5" stroke-width="2" opacity=".6"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${T.width} ${T.height}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">` +
    panel(S, spec.start, T.startOpacity, 0) +
    arrow +
    panel(E, spec.end, 1, T.endOffset) +
    `</svg>\n`
  );
}
