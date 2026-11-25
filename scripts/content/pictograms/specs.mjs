// MEDIA-03 : description paramétrique des pictogrammes, un exercice = deux poses P(tronc, [bras, avant-bras], [cuisse, jambe], extras).
// Angles : 0 vers le bas, 90 vers l'avant, 180 vers le haut, -90 vers l'arrière. Les muscles viennent de exercises.json (rôle primary).
import { P, prop } from './skeleton.mjs';

const UP = 180;
const STAND = [0, 0];
const SEATED = [88, 3];
const LYING_LEGS = [105, 8];
const SEAT = { joint: 'hip', x: 36, y: 78 };
const LYING = { joint: 'ankle', x: 72 };
const FLOORSIT = { joint: 'hip', x: 30, y: 96 };
const PLANK = [-78, -78];

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

  // --- MEDIA-03b : les autres exercices sans photo ---
  // Poussées
  'incline-press-machine': { anchor: SEAT, props: [prop.seat, prop.db()], start: P(200, [-45, 90], SEATED), end: P(200, [72, 72], SEATED) },
  'chest-press-cable': { props: [prop.cable([6, 50])], start: P(172, [-40, 80], [20, 0], { l2: [-20, -10] }), end: P(172, [82, 82], [20, 0], { l2: [-20, -10] }) },
  'push-up-weighted': { anchor: { joint: 'wrist', x: 74 }, props: [prop.plate('hip')], start: P(100, [0, 0], [-84, -84], { foot: 20 }), end: P(84, [-40, 30], [-86, -86], { foot: 20 }) },
  'cable-fly-low': { props: [prop.cable([4, 100])], start: P(UP, [-15, -15], STAND), end: P(UP, [112, 112], STAND) },
  'cable-fly-high': { props: [prop.cable([4, 14])], start: P(UP, [-140, -140], STAND), end: P(UP, [30, 30], STAND) },
  'squeeze-press-dumbbell': { anchor: LYING, props: [prop.flatBench, prop.db()], start: P(-90, [100, 180], LYING_LEGS), end: P(-90, [180, 180], LYING_LEGS) },
  'landmine-press': { props: [prop.landmine([96, 102])], start: P(UP - 6, [-20, 100], [10, 0], { l2: [-14, -6] }), end: P(UP - 6, [135, 135], [10, 0], { l2: [-14, -6] }) },
  'landmine-press-one-arm': { props: [prop.landmine([96, 102])], start: P(UP - 6, [-20, 100], [14, 0], { l2: [-18, -6] }), end: P(UP - 6, [135, 135], [14, 0], { l2: [-18, -6] }) },
  'dips': { scale: 0.9, noFloor: true, anchor: { joint: 'wrist', x: 50, y: 62 }, props: [prop.bars], start: P(UP, [0, 0], [8, -30]), end: P(165, [-60, 60], [8, -30]) },
  'dip-machine': { anchor: SEAT, props: [prop.seat, prop.db()], start: P(185, [-50, 60], SEATED), end: P(185, [4, 4], SEATED) },
  'overhead-triceps-extension-cable': { props: [prop.cable([4, 98])], start: P(UP - 6, [172, -25], [10, 0], { l2: [-10, -4] }), end: P(UP - 6, [178, 178], [10, 0], { l2: [-10, -4] }) },
  'triceps-pushdown-one-arm': { props: [prop.cable([84, 10])], start: P(UP - 4, [5, 160], STAND), end: P(UP - 4, [5, 5], STAND) },
  'triceps-kickback-cable': { props: [prop.cable([92, 98])], start: P(115, [-90, 5], [14, -4], { l2: [14, -4] }), end: P(115, [-90, -90], [14, -4], { l2: [14, -4] }) },
  'curl-behind-body-cable': { props: [prop.cable([4, 98])], start: P(UP, [-20, -20], STAND), end: P(UP, [-20, -150], STAND) },
  'spider-curl': { props: [prop.frontPad, prop.db()], start: P(145, [0, 0], STAND), end: P(145, [0, 150], STAND) },
  'reverse-curl-cable': { props: [prop.cable([92, 100])], start: P(UP, [0, 0], STAND), end: P(UP, [5, 130], STAND) },
  'wrist-curl': { anchor: SEAT, props: [prop.stool, prop.db()], start: P(150, [50, 100], SEATED), end: P(150, [50, 70], SEATED) },
  'wrist-curl-cable': { anchor: SEAT, props: [prop.stool, prop.cable([92, 98])], start: P(150, [50, 100], SEATED), end: P(150, [50, 70], SEATED) },
  'front-raise-plate': { props: [prop.plate()], start: P(UP, [8, 8], STAND), end: P(UP, [90, 92], STAND) },
  'lateral-raise-machine': { anchor: SEAT, props: [prop.seat, prop.dot('wrist')], start: P(UP, [8, 8], SEATED), end: P(UP, [75, 75], SEATED) },
  'lateral-raise-dumbbell-one-arm': { props: [prop.db()], start: P(UP, [8, 8], STAND), end: P(UP, [75, 75], STAND) },
  'y-raise-cable': { props: [prop.cable([92, 100])], start: P(UP, [10, 10], STAND), end: P(UP, [150, 150], STAND) },
  'overhead-press-smith': { props: [prop.rail(40), prop.bar()], start: P(UP, [10, 175], STAND), end: P(UP, [176, 178], STAND) },
  'external-rotation-cable': { props: [prop.cable([92, 58])], start: P(UP, [0, 100], STAND), end: P(UP, [0, 150], STAND) },
  'reverse-fly-machine': { anchor: SEAT, props: [prop.seat, prop.dot('wrist')], start: P(172, [95, 95], SEATED), end: P(172, [45, 45], SEATED) },
  // Tirages
  'row-dumbbell-one-arm': { props: [prop.db(), (S) => [{ t: 'l', p: [S.neck[0] + 4, S.neck[1] + 22, S.neck[0] + 26, S.neck[1] + 22] }, { t: 'l', p: [S.neck[0] + 15, S.neck[1] + 22, S.neck[0] + 15, 104], thin: true }]], start: P(120, [0, 0], [26, -8]), end: P(120, [-120, 0], [26, -8]) },
  'chest-supported-row-dumbbell': { props: [prop.frontPad, prop.db()], start: P(140, [0, 0], STAND), end: P(140, [-125, 0], STAND) },
  'chest-supported-row-machine': { props: [prop.frontPad, prop.dot('wrist')], start: P(140, [40, 40], STAND), end: P(140, [-110, -100], STAND) },
  'row-t-bar': { props: [prop.landmine([96, 102])], start: P(120, [20, 30], [26, -8]), end: P(120, [-120, -15], [26, -8]) },
  'seated-row-one-arm': { anchor: FLOORSIT, props: [prop.cable([96, 92])], start: P(178, [86, 90], [90, 90]), end: P(172, [-20, 100], [90, 90]) },
  'seated-row-wide-grip': { anchor: FLOORSIT, props: [prop.cable([96, 92])], start: P(178, [86, 90], [90, 90]), end: P(172, [-40, 96], [90, 90]) },
  'lat-pulldown-machine': { anchor: SEAT, props: [prop.seat, prop.cable([52, 4])], start: P(190, [170, 176], SEATED), end: P(190, [-15, 175], SEATED) },
  'lat-pulldown-one-arm': { anchor: SEAT, props: [prop.seat, prop.cable([52, 4])], start: P(190, [170, 176], SEATED), end: P(190, [-15, 175], SEATED) },
  'pull-up-assisted': { scale: 0.84, noFloor: true, anchor: { joint: 'wrist', x: 46, y: 6 }, props: [prop.line(30, 3, 62, 3), (S, C) => [{ t: 'l', p: [C.knee[0] - 6, C.knee[1] + 3, C.knee[0] + 6, C.knee[1] + 3] }]], start: P(UP, [UP, UP], [0, -8]), end: P(UP, [35, 155], [10, -40]) },
  'pull-up-weighted': { scale: 0.84, noFloor: true, anchor: { joint: 'wrist', x: 46, y: 6 }, props: [prop.line(30, 3, 62, 3), prop.beltWeight], start: P(UP, [UP, UP], [0, -8]), end: P(UP, [35, 155], [10, -40]) },
  'rack-pull': { props: [prop.bar()], start: P(128, [0, 0], [16, -6]), end: P(UP, [0, 0], STAND) },
  // Jambes

  // Squats et fentes (jambe arrière au sol, accordée à la hauteur de hanche)
  'split-squat-dumbbell': { anchor: { joint: 'ankle', x: 58 }, props: [prop.db()], start: P(UP, [0, 0], [20, -4], { l2: [-26, -25] }), end: P(UP, [0, 0], [66, -4], { l2: [-12, -62] }) },
  'front-foot-elevated-split-squat': { anchor: { joint: 'ankle', x: 58, y: 93 }, props: [prop.step, prop.db()], start: P(UP, [0, 0], [20, -4], { l2: [-26, -25] }), end: P(UP, [0, 0], [66, -4], { l2: [-12, -62] }) },
  'lunge-smith': { anchor: { joint: 'ankle', x: 58 }, props: [prop.rail(40), prop.bar('neck')], start: P(UP, [10, 170], [20, -4], { l2: [-26, -25] }), end: P(UP, [10, 170], [66, -4], { l2: [-12, -62] }) },
  'lateral-lunge': { props: [prop.db()], start: P(UP, [10, 150], STAND, { l2: [0, 0] }), end: P(UP - 28, [10, 150], [70, -8], { l2: [-45, -45] }) },
  'cossack-squat': { props: [prop.kb()], start: P(UP, [10, 150], [-4, -4], { l2: [4, 4] }), end: P(UP - 20, [10, 150], [95, -12], { l2: [-70, -70] }) },
  'sledge-squat': { anchor: { joint: 'ankle', x: 50 }, props: [prop.back], start: P(UP, [0, 0], STAND), end: P(UP - 15, [0, 0], [80, -10]) },
  'spanish-squat': { props: [prop.cable([4, 62], 'knee')], start: P(UP, [90, 90], STAND), end: P(UP + 10, [90, 90], [70, -20]) },
  'leg-press-one-leg': { anchor: { joint: 'hip', x: 28, y: 74 }, props: [prop.back, prop.footPlate], start: P(-120, [60, 40], [125, 70]), end: P(-120, [60, 40], [118, 120]) },
  'belt-squat': { props: [prop.beltWeight], start: P(UP, [30, 30], STAND), end: P(UP - 15, [30, 30], [80, -5]) },
  'leg-extension-one-leg': { anchor: SEAT, props: [prop.seat, (S, C) => [{ t: 'c', c: [...C.ankle, 3], f: true }]], start: P(185, [60, 20], [88, 3]), end: P(185, [60, 20], [88, 88]) },
  // Charnières et fessiers
  'romanian-deadlift-dumbbell': { props: [prop.db()], start: P(UP, [0, 0], [4, 0]), end: P(120, [0, 0], [14, -2]) },
  'single-leg-romanian-deadlift': { props: [prop.db()], start: P(UP, [0, 0], STAND, { l2: [0, 0] }), end: P(105, [0, 0], [8, -2], { l2: [-100, -100] }) },
  'stiff-leg-deadlift': { props: [prop.bar()], start: P(UP, [0, 0], STAND), end: P(112, [0, 0], [8, 0]) },
  'trap-bar-deadlift': { props: [prop.bar()], start: P(140, [0, 0], [80, -10]), end: P(UP, [0, 0], STAND) },
  'sumo-deadlift': { props: [prop.bar()], start: P(135, [0, 0], [72, 2]), end: P(UP, [0, 0], STAND) },
  'kettlebell-swing': { props: [prop.kb()], start: P(125, [20, 20], [40, -4]), end: P(UP, [90, 90], STAND) },
  'cable-pull-through': { props: [prop.cable([4, 98])], start: P(120, [10, 10], [18, -6]), end: P(UP, [0, 0], STAND) },
  'reverse-hyperextension': { anchor: { joint: 'hip', x: 44, y: 54 }, props: [prop.proneBench], start: P(95, [10, 10], [0, 0]), end: P(95, [10, 10], [-88, -88]) },
  'hip-thrust-machine': { anchor: { joint: 'ankle', x: 66 }, props: [prop.bar('hip'), prop.shoulderBench], start: P(-135, [45, 45], [130, 12]), end: P(-98, [82, 82], [90, 0]) },
  'single-leg-glute-bridge': { anchor: { joint: 'ankle', x: 66 }, props: [prop.shoulderBench], start: P(-135, [45, 45], [130, 12], { l2: [125, 125] }), end: P(-98, [82, 82], [90, 0], { l2: [125, 125] }) },
  'single-leg-hip-thrust': { anchor: { joint: 'ankle', x: 66 }, props: [prop.db('hip'), prop.shoulderBench], start: P(-135, [45, 45], [130, 12], { l2: [125, 125] }), end: P(-98, [82, 82], [90, 0], { l2: [125, 125] }) },
  'frog-pump': { anchor: LYING, props: [prop.plate('hip')], start: P(-90, [80, 80], [115, 10]), end: P(-72, [80, 80], [85, 5]) },
  'leg-curl-sliding': { anchor: LYING, start: P(-70, [75, 75], [70, 70]), end: P(-70, [75, 75], [60, -30]) },
  'leg-curl-one-leg': { anchor: { joint: 'hip', x: 48, y: 66 }, props: [prop.proneBench], start: P(90, [70, 80], [-90, -90]), end: P(90, [70, 80], [-90, 180]) },
  'nordic-curl': { anchor: { joint: 'knee', x: 50 }, start: P(UP, [60, 60], [0, -90], { foot: 180 }), end: P(105, [70, 70], [-75, -90], { foot: 180 }) },
  'single-leg-curl': { anchor: { joint: 'ankle2', x: 40 }, props: [prop.cable([4, 98], 'ankle')], start: P(UP, [30, 30], [0, 0], { l2: [0, 0] }), end: P(UP, [30, 30], [0, -110], { l2: [0, 0] }) },
  'glute-kickback-machine': { anchor: { joint: 'ankle2', x: 42 }, props: [prop.dot('ankle')], start: P(150, [40, 40], [20, -5], { l2: [0, 0] }), end: P(150, [40, 40], [-35, -40], { l2: [0, 0] }) },
  'quadruped-hip-extension': { start: P(108, [0, 0], [0, -90], { foot: 180, l2: [0, -90] }), end: P(108, [0, 0], [-100, -100], { foot: 180, l2: [0, -90] }) },
  'cable-hip-abduction': { anchor: { joint: 'ankle2', x: 42 }, props: [prop.cable([92, 100], 'ankle')], start: P(UP, [40, 60], [0, 0], { l2: [0, 0] }), end: P(UP, [40, 60], [-28, -28], { l2: [0, 0] }) },
  'band-lateral-walk': { props: [prop.link('knee', 'knee2')], start: P(165, [70, 70], [40, -8], { l2: [30, -6] }), end: P(165, [70, 70], [40, -8], { l2: [-25, -30] }) },
  // Mollets et tibiaux
  'calf-raise-dumbbell': { props: [prop.step, prop.db()], start: P(UP, [0, 0], STAND, { foot: 100 }), end: P(UP, [0, 0], STAND, { foot: 25 }) },
  'calf-raise-one-leg': { props: [prop.step], start: P(UP, [40, 60], STAND, { foot: 100, l2: [0, -110] }), end: P(UP, [40, 60], STAND, { foot: 25, l2: [0, -110] }) },
  'calf-raise-smith': { props: [prop.rail(40), prop.bar('neck'), prop.step], start: P(UP, [10, 170], STAND, { foot: 100 }), end: P(UP, [10, 170], STAND, { foot: 25 }) },
  'tibialis-raise': { props: [prop.wall], start: P(190, [20, 20], [12, 12], { foot: 90 }), end: P(190, [20, 20], [12, 12], { foot: 150 }) },
  'tibialis-raise-machine': { anchor: FLOORSIT, props: [prop.dot('toe', 3)], start: P(185, [-70, -70], [90, 90], { foot: 90 }), end: P(185, [-70, -70], [90, 90], { foot: 150 }) },
  'tibialis-raise-band': { anchor: FLOORSIT, props: [prop.cable([96, 80], 'toe')], start: P(185, [-70, -70], [90, 90], { foot: 90 }), end: P(185, [-70, -70], [90, 90], { foot: 150 }) },
  // Gainage
  'body-saw': { props: [prop.dot('toe', 2.5)], start: P(96, [0, 90], PLANK, { foot: 30 }), end: P(101, [0, 95], [-82, -82], { foot: 30 }) },
  'copenhagen-plank': { start: P(96, [0, 90], PLANK, { foot: 30, l2: [-68, -68] }), end: P(96, [0, 90], PLANK, { foot: 30, l2: [-100, -100] }) },
  'dead-bug': { anchor: LYING, start: P(-90, [180, 180], [180, 90], { l2: [180, 90], a2: [180, 180] }), end: P(-90, [-90, -90], [180, 90], { l2: [95, 95], a2: [180, 180] }) },
  'hollow-hold': { anchor: LYING, start: P(-90, [-90, -90], [90, 90]), end: P(-108, [-112, -112], [108, 108]) },
  'bird-dog': { start: P(108, [0, 0], [0, -90], { foot: 180, l2: [0, -90], a2: [0, 0] }), end: P(108, [100, 100], [0, -90], { foot: 180, l2: [-92, -92], a2: [0, 0] }) },
  'hanging-knee-raise': { scale: 0.84, noFloor: true, anchor: { joint: 'wrist', x: 46, y: 6 }, props: [prop.line(30, 3, 62, 3)], start: P(UP, [UP, UP], [0, -6]), end: P(UP + 6, [UP, UP], [100, 8]) },
  'captain-chair-knee-raise': { anchor: { joint: 'hip', x: 42, y: 56 }, props: [prop.back], start: P(UP, [0, 90], [0, 0]), end: P(UP, [0, 90], [98, 8]) },
  'cable-crunch': { anchor: { joint: 'knee', x: 44 }, props: [prop.cable([92, 8])], start: P(UP, [20, 170], [0, -90], { foot: 180 }), end: P(130, [50, 170], [0, -90], { foot: 180 }) },
  'machine-crunch': { anchor: SEAT, props: [prop.seat, prop.dot('wrist')], start: P(190, [20, 150], SEATED), end: P(140, [30, 150], SEATED) },
  'pallof-press': { props: [prop.cable([4, 58])], start: P(UP, [-10, 95], [8, -4], { l2: [-8, -4] }), end: P(UP, [90, 90], [8, -4], { l2: [-8, -4] }) },
  'ab-wheel-rollout': { anchor: { joint: 'knee', x: 36 }, props: [prop.dot('wrist', 4.5)], start: P(150, [30, 15], [-25, -90], { foot: 180 }), end: P(98, [105, 105], [-80, -90], { foot: 180 }) },
  'cable-woodchopper': { props: [prop.cable([92, 14])], start: P(UP + 8, [130, 130], [12, -4], { l2: [-12, -4] }), end: P(UP - 40, [10, 10], [12, -4], { l2: [-12, -4] }) },
  'russian-twist': { anchor: { joint: 'hip', x: 44, y: 94 }, props: [prop.dot('wrist', 4.5)], start: P(200, [90, 90], [115, 70]), end: P(200, [70, 100], [115, 70]) },
  // Portés
  'suitcase-carry': { props: [prop.db()], start: P(UP, [0, 0], [8, -6], { l2: [-10, -8] }), end: P(UP, [0, 0], [-10, -8], { l2: [8, -6] }) },
  'farmer-carry': { props: [prop.db(), prop.db('wrist2')], start: P(UP, [0, 0], [8, -6], { l2: [-10, -8], a2: [0, 0] }), end: P(UP, [0, 0], [-10, -8], { l2: [8, -6], a2: [0, 0] }) },
  'dead-hang': { scale: 0.84, noFloor: true, anchor: { joint: 'wrist', x: 46, y: 6 }, props: [prop.line(30, 3, 62, 3)], start: P(UP, [UP, UP], [0, -6]), end: P(UP, [172, 176], [0, -6]) },
};

export const TRIAL_IDS = ['split-squat-bulgarian', 'hip-thrust-barbell', 'face-pull', 'lateral-raise-cable', 'goblet-squat', 'hanging-leg-raise'];
