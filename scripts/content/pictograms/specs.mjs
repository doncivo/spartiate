// MEDIA-03 : description paramétrique des pictogrammes, un exercice = deux poses P(tronc, [bras, avant-bras], [cuisse, jambe], extras).
// Angles : 0 vers le bas, 90 vers l'avant, 180 vers le haut, -90 vers l'arrière. Les muscles viennent de exercises.json (rôle primary).
import { P, prop } from './skeleton.mjs';

const UP = 180;
const STAND = [0, 0];

export const SPECS = {
  // --- essais MEDIA-03a (trois de la routine d'Ali, trois autres) ---
  'split-squat-bulgarian': {
    anchor: { joint: 'ankle', x: 58 },
    props: [prop.db('wrist'), (S) => [{ t: 'l', p: [S.ankle2[0] - 8, S.ankle2[1] + 5, S.ankle2[0] + 8, S.ankle2[1] + 5] }, { t: 'l', p: [S.ankle2[0], S.ankle2[1] + 5, S.ankle2[0], 104], thin: true }]],
    start: P(UP, [0, 0], [18, -4], { l2: [-28, -105, 180] }),
    end: P(UP - 8, [0, 0], [66, -4], { l2: [-19, -150, 180] }),
  },
  'hip-thrust-barbell': {
    anchor: { joint: 'ankle', x: 66 },
    props: [prop.bar('hip'), prop.shoulderBench],
    start: P(-135, [45, 45], [130, 12]),
    end: P(-98, [82, 82], [90, 0]),
  },
  'face-pull': {
    anchor: { joint: 'ankle', x: 36 },
    props: [prop.cable([92, 28])],
    start: P(UP - 5, [82, 86], STAND),
    end: P(UP - 5, [88, 200], STAND),
  },
  'lateral-raise-cable': {
    anchor: { joint: 'ankle', x: 40 },
    props: [prop.cable([84, 100])],
    start: P(UP, [8, 8], STAND),
    end: P(UP, [75, 75], STAND),
  },
  'goblet-squat': {
    anchor: { joint: 'ankle', x: 52 },
    props: [prop.db('wrist')],
    start: P(UP, [12, 150], STAND),
    end: P(UP - 28, [12, 150], [86, -12]),
  },
  'hanging-leg-raise': {
    scale: 0.84,
    noFloor: true,
    anchor: { joint: 'wrist', x: 46, y: 6 },
    props: [prop.line(30, 3, 62, 3)],
    start: P(UP, [UP, UP], [0, -6]),
    end: P(UP + 6, [UP, UP], [86, 84]),
  },
};

export const TRIAL_IDS = ['split-squat-bulgarian', 'hip-thrust-barbell', 'face-pull', 'lateral-raise-cable', 'goblet-squat', 'hanging-leg-raise'];
