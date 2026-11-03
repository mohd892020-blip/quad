// Every tunable number lives here. Values come from prototype.html unchanged.

export const FIXED_DT = 1 / 120;
export const MAX_FRAME_DT = .05;
export const HUD_INTERVAL = .1;

// turnDelay: some phones report their new size only this many milliseconds after they turn.
export const VIEW = { refH: 600, refW: 560, turnDelay: 350 };
// A screen stands on a copy of the scene shrunk this many times; stretched back up, it reads as frosted glass.
export const FROST = { shrink: 10 };
export const PERSPECTIVE = { depth: .93, eyeY: .38 };
// Step down a tier when frames average slower than slowFrame over a window, two when slower than awfulFrame. Frames that
// arrive evenly under capFrame are a capped screen, say on battery saver, not a device struggling, so they cost no
// sharpness: even means evenShare of them landed within evenGap of the one before. Gaps over maxFrameGap are the game
// being away, not slow. A session that never stepped down tries one tier up after calm windows under easyFrame, and
// steps back if that turns slow. A phone remembers its tier, so the next launch starts where this one settled.
export const QUALITY = {
  window: 2, slowFrame: .021, awfulFrame: .045, capFrame: .036, evenGap: .003, evenShare: .85, easyFrame: .0178, calm: 3, maxFrameGap: 1, start: 3,
  tiers: [{ dpr: 3 }, { dpr: 2.5 }, { dpr: 2 }, { dpr: 1.5 }, { dpr: 1.25 }, { dpr: 1, low: true }, { dpr: .75, low: true }],
};
// Skipping a mission for a rewarded ad. It is offered after afterFails real fails in a row (a fail counts once the try
// lasted realSecs or reached the pickup), from mission from on, never for the checkpoints in never. Between skips the
// player passes gap missions; each block of blockSize missions allows perBlock skips (challengePerBlock from
// challengeFrom on); and no more than open skipped missions may wait unplayed at once. There is no clock, so changing
// the phone's time gains nothing. devOnly keeps it in developer mode until real ads exist; until then a stand-in plays.
export const SKIP = {
  devOnly: true, afterFails: 3, realSecs: 15, from: 6, never: [10, 20, 30, 40, 50], gap: 2,
  blockSize: 10, perBlock: 2, challengeFrom: 41, challengePerBlock: 1, open: 3, adSecs: 5,
};

// Clouds at flying height. amount is the share of slots that hold a cloud (a level may set its own); each is a cluster of
// puffs that the aircraft pushes (push, within reach of a puff's edge, with wash pressing down and carry dragging along)
// and that springs back. A pushed puff thins and swells; frontShare of the puffs are drawn over the aircraft.
export const CLOUDS = {
  seed: 31, amount: .6, spacing: 1100, spacingRange: 800, settled: .5, heightMin: -360, heightMax: 140, puffs: [7, 12], spread: 95, flat: .42, puffR: [28, 50],
  drift: 7, windDrift: .05, awake: 500, reach: 46, push: 1500, wash: .35, carry: .25, spring: 2.6, damp: 2.4, inside: .9,
  alpha: .9, frontShare: .4, frontAlpha: .72, thin: 1.6, thinMin: .25, swell: .5, margin: 70, density: 2, shadeDrop: .22, lightLift: .1,
  falloff: [[0, 1], [.45, .96], [.72, .55], [.9, .14], [1, 0]],
  mist: { rate: 24, max: 40, minSpeed: 40, life: 1, size: 18, grow: 26, alpha: .5, sink: 10 },
  high: { seed: 57, count: 6, width: 340, flat: .3, pad: .2, parts: 6, alpha: .55, drift: .06, speed: 4, top: .06, bottom: .3 },
};

// The player's choice of picture. Sharp draws at the screen's own density and gives way, never below sharpFloor, only
// when frames are awful. Auto finds the sharpest the device keeps up with. Saver stays on the low tier.
export const PICTURE = { modes: [['sharp', 'Sharp'], ['auto', 'Auto'], ['saver', 'Saver']], sharpFloor: 2, saverTier: 5 };
// ahead is how far past the screen edge a building's image is prepared before it is needed. Building images stop at
// maxDensity: past twice the pixels they look the same and cost four times the memory.
export const SPRITE = { padX: 44, padTop: 50, evictMargin: 900, ahead: 420, maxDensity: 2 };
export const CELL = { size: 256, base: -2400, margin: 48 };

export const G = 700;
export const GROUND = 560;
export const GROUND_BOX = { x: -2000, w: 36000, h: 200 };
// The drone stops at these, well inside the ground, so it can never fly off the end of the world.
export const EDGE = { left: -1000, right: 33300 };
export const CITY_SEED = 7;

// A job: its clock, when harder customers appear, and the pad that starts it.
export const MISSION = {
  baseTime: 22,
  speed: 150,
  urgentTime: .75,
  heavyTime: 6,
  lowTime: 10,
  cooldown: 2,
  balconyFrom: 2,
  streetFrom: 5,
  toastMs: 2600,
  padReach: 58,
  padGap: 6,
  padSpeed: 80,
  haloHeight: 240,
  haloWidth: 44,
};

// The one long city, left to right. Each zone sets its own buildings and obstacles.
export const ZONES = [
  {
    name: 'Village', from: -400, style: 'village', map: '#6f9a52',
    stones: ['#e9dcc0', '#e2d0ab', '#ecdfca', '#d9c7a3'],
    widthMin: 120, widthRange: 70, heightMin: 90, heightRange: 80, gapRange: 110,
    tankChance: .25, dishChance: .15, craneChance: 0, towerChance: .05, lineChance: .6, powerChance: .25, lineMinH: 80, winW: 12, winH: 16,
  },
  {
    name: 'Old Town', from: 3000, style: 'old', map: '#b8916c',
    stones: ['#c9a27a', '#b8916c', '#d4b08a', '#a98463', '#c09673', '#d8bb98'],
    widthMin: 110, widthRange: 110, heightMin: 150, heightRange: 170, gapRange: 60,
    tankChance: .6, dishChance: .45, craneChance: .05, towerChance: .1, lineChance: .7, powerChance: .15, lineMinH: 150, winW: 14, winH: 20,
  },
  {
    name: 'Souk', from: 7000, style: 'souk', map: '#d9823a',
    stones: ['#d6a56b', '#c98f5c', '#e0b47c', '#cf9a68'],
    widthMin: 130, widthRange: 90, heightMin: 130, heightRange: 130, gapRange: 50,
    tankChance: .5, dishChance: .6, craneChance: .08, towerChance: .1, lineChance: .75, powerChance: .6, lineMinH: 130, winW: 14, winH: 18,
  },
  {
    name: 'Downtown', from: 10500, style: 'tower', map: '#5a7fa6',
    stones: ['#6f8296', '#7d92a8', '#5f7286', '#8ba0b5'],
    widthMin: 130, widthRange: 110, heightMin: 300, heightRange: 220, gapRange: 70,
    tankChance: .35, dishChance: .3, craneChance: .22, towerChance: .3, lineChance: .25, powerChance: .8, lineMinH: 170, winW: 22, winH: 30,
  },
  { name: 'Seaside', from: 14300, style: 'beach', map: '#3fb0c8', stones: ['#c99a5e'], winW: 12, winH: 16 },
  { name: 'Desert', from: 20000, style: 'desert', map: '#d9a441', stones: ['#c9a06a'], winW: 12, winH: 16 },
  { name: 'Forest', from: 26450, style: 'forest', map: '#3f8f5a', stones: ['#8a5a3a'], winW: 12, winH: 16 },
];

// The forest past the desert, flown in the missions listed. Pines grow from seed every pineGap to pineGap + pineGapRange,
// clear of the landmarks by clear; each is a trunk and tiers of needles whose solid core is narrower than the drawing.
// A treehouse deck juts out from its trunk under a crown, so its customer can be reached from beside the crown.
export const FOREST = {
  from: 26600, to: 33000, missions: [16, 26, 36], every: 10, minDist: 1500, windBoost: 1.1, trafficGap: 1.8, targetLift: 11, seen: 320,
  kioskH: 120, kioskColor: '#8a5a3a', logColor: '#8a5a3a', barkColor: '#5a3a26', needles: '#2f6b45',
  kiosks: [
    { x: 26900, shop: { name: 'Ranger Station', items: ['coffee', 'medicine'], glow: '#4fc27c' } },
    { x: 29700, shop: { name: 'Lodge Kitchen', items: ['pizza', 'kunafa'], glow: '#ff8a3c' } },
    { x: 32500, shop: { name: 'Berry Bakery', items: ['cake', 'flowers'], glow: '#d97aa8' } },
  ],
  cabins: [{ x: 27650, w: 150, h: 104 }, { x: 30560, w: 170, h: 96 }, { x: 31850, w: 140, h: 118 }],
  treehouses: [{ x: 28320, h: 230 }, { x: 31180, h: 200 }],
  lookouts: [29250], clearings: [27280, 30180, 32170], rivers: [[28760, 29020]],
  seed: 83, edge: 60, clear: 120, pineGap: 70, pineGapRange: 90, pineH: [170, 320], pineW: [64, 96],
  tiers: 3, tierFrom: .2, tierStep: .25, tierTall: .42, tierShrink: .22, tierLight: .82, tierLighten: .08, trunkW: 10, trunkShare: .32, core: .55, coreFrom: .45,
  sway: 3, swayRate: 1.1, windSway: .03,
  houseTrunk: 26, deckBack: 40, deckOut: 120, deckEdge: 22, deckH: 10, crownW: 110, crownH: 90, crownLift: 70,
  crownPuffs: [[-30, 0, 38], [10, -18, 42], [36, 8, 30], [-6, 22, 34]],
  lookoutH: 180, lookoutW: 70, legW: 6, plankH: 8, bridgeY: 7, bridgeH: 8, flow: 40,
  rise: 500, ridgeStep: 22, ridgeLong: 170, hillDrift: .2, hillH: 220, hillSwell: 60, farDrift: .35, farH: 130, farSwell: 26, farTeeth: 16,
  nearDrift: .55, nearH: 80, nearSwell: 18, nearTeeth: 22, mistH: 90, mistAlpha: .3,
};

// The open coast past the city. Sea spans are water to fall into; sand and the island are safe.
// Every level whose number divides by every is flown here, from its three beach kiosks.
export const BEACH = {
  from: 14300, to: 19900, every: 5, minDist: 900, windBoost: 1.25, splash: 240,
  sea: [[15050, 17000], [17560, 19200]],
  kiosks: [
    { x: 14560, shop: { name: 'Beach Bar', items: ['coffee', 'watermelon'], glow: '#4fa3c2' } },
    { x: 17140, shop: { name: 'Island Grill', items: ['falafel', 'pizza'], glow: '#ff5a3c' } },
    { x: 19400, shop: { name: 'Sweet Shack', items: ['cake', 'flowers'], glow: '#d97aa8' } },
  ],
  kioskH: 110, kioskColor: '#c99a5e',
  towers: [14430, 17030, 19280],
  piers: [{ x: 14960, w: 460 }, { x: 19000, w: 280 }],
  boats: [
    { x: 15640, w: 130, paint: '#d9483b' }, { x: 16200, w: 110, paint: '#3f6fb0' }, { x: 16620, w: 140, paint: '#3a8f6b' },
    { x: 17760, w: 120, paint: '#e0a52c' }, { x: 18260, w: 140, paint: '#d9483b' }, { x: 18700, w: 110, paint: '#3f6fb0' },
  ],
  towels: [14860, 17450, 19800],
  palms: [14380, 14830, 17080, 17500, 19760], umbrellas: [14480, 14900, 17490, 19690], umbrellaPaint: ['#e8492c', '#4fa3c2', '#ffc23d', '#d97aa8'],
  horizon: 110, headland: 260, headlandH: 170, seen: 220,
  deckH: 26, plankH: 8, towerH: 120, towerW: 70, legW: 6, flagH: 34, pierEnd: 40, pileGap: 70, pileDrop: 18,
  mastAt: .62, mastH: 66, mastW: 4, boatSpot: .24, targetLift: 11, bob: 2, bobRate: 1.6,
  palmH: 120, umbrellaH: 44, waveStep: 12, waveLength: 26, waveRate: 2.2, waveHeight: 2.5,
};

// The desert past the coast. Quicksand swallows what touches it, gusts raise a sandstorm that cuts the view,
// and buggies and camels cross it. Levels from first on, whose number leaves remainder at, are flown here.
export const DESERT = {
  from: 20000, to: 26300, first: 8, every: 5, at: 3, minDist: 1600, windBoost: 1.4, trafficGap: 1.7, targetLift: 11, kioskH: 110, kioskColor: '#c9a06a', seen: 260,
  kiosks: [
    { x: 20320, shop: { name: 'Oasis Cafe', items: ['coffee', 'kunafa'], glow: '#4fa3c2' } },
    { x: 23040, shop: { name: 'Caravan Grill', items: ['falafel', 'pizza'], glow: '#ff5a3c' } },
    { x: 25760, shop: { name: 'Field Clinic', items: ['medicine', 'watermelon'], glow: '#4fc27c' } },
  ],
  mesas: [{ x: 21050, w: 280, h: 190 }, { x: 22280, w: 220, h: 260 }, { x: 23960, w: 320, h: 170 }, { x: 25240, w: 230, h: 230 }],
  arches: [{ x: 21600, w: 230, h: 150 }, { x: 24600, w: 210, h: 130 }],
  sinks: [[21950, 22150], [23560, 23800], [24950, 25130]],
  cacti: [20720, 21430, 22590, 23420, 24480, 25560, 26180],
  camps: [20880, 24420, 26120],
  oases: [22720, 25640],
  rockColor: '#b5643c', rockCap: '#d98a55', archLeg: 46, archTop: 36,
  cactusW: 24, cactusH: 62, tentW: 92, tentH: 58, tentAt: -84, poolAt: 56, poolW: 120, signGap: 26, signH: 34,
  sinkShade: .62, sinkLine: .44, sinkRings: 3, sinkRate: .28, pitH: 10, pitY: 3, deckY: 7, deckH: 8, plank: 14, rippleShade: .9, rippleLong: 46, ripples: [14, 30],
  duneStep: 26, duneRise: 500, duneLong: 190, duneShort: 73, farDrift: .35, farH: 160, farSwell: 38, nearDrift: .6, nearH: 96, nearSwell: 30,
  stormFrom: .45, stormHaze: .42, stormLine: .5, stormGrains: 34, stormColor: '226,176,104',
};

export const DRONE = {
  radius: 15,
  tiltMax: .48,
  tiltRate: 7,
  thrustLift: 1.72,
  thrustIdle: .78,
  thrustDown: .5,
  windForce: .45,
  dragX: .25,
  dragY: .32,
  batDrain: .42,
  batDrainLift: 1.05,
  ceiling: -420,
  bounce: 1.45,
  hitSpeed: 170,
  hitShakeDiv: 40,
  hitShakeMax: 12,
  hitDamage: .05,
  groundNormal: -.7,
  groundFriction: .02,
};

// Aircraft damage: a hit costs health by impact speed and what was struck. Low health
// smokes, then burns, and burning eats health until the drone reaches a shop or explodes.
export const HEALTH = {
  hitSpeed: 150,
  perSpeed: .13,
  materials: { wall: 1, ground: .9, steel: 1.25, balcony: .8, tank: .7, dish: .5, wood: .75, rock: 1, cactus: .6, tree: .5 },
  hawkHit: 4,
  smokeAt: 60,
  fireAt: 30,
  burnRate: 1.5,
  repairRate: 12,
  smokeRate: 12,
  fireRate: 30,
  respawnDelay: 2.2,
  blastShake: 14,
  blastLife: .7,
  blastRadius: 70,
  debris: 18,
  surfaceReach: 60,
  hitMemory: .2,
  markSpeed: 230,
  markCrash: 9,
  markBlast: 26,
  markBurn: 4,
  markMax: 40,
};

export const ROPE = 62;
// snagFragile: from this fragility up, the rope's own pull counts as a knock, as in the prototype,
// so a delicate order that snags on something is gone in moments.
// swingLimit: radians out from straight down that the load may reach, so it never goes up and over the aircraft.
// A hard swing stops there and comes back at swingBack radians a second. Under swingFree of the rope's length the
// load is left alone: that close in it is resting on the pad beside the aircraft, not swinging.
export const BOX = {
  snagFragile: 1,
  anchorY: 8,
  damping: .997,
  windForce: 1,
  pullBox: .88,
  pullDrone: .12,
  padX: 12,
  padY: 10,
  hitSpeed: 90,
  hitDamage: .07,
  bigHitSpeed: 200,
  bigHitShake: 5,
  friction: .6,
  lineReachX: 14,
  lineReachY: 12,
  lineDamage: 22,
  lineDrag: .15,
  swingSpeed: 360,
  swingDamage: .09,
  swingLimit: 1.45,
  swingBack: 12,
  swingFree: .5,
};

// How much larger an order is drawn than the box it flies as, so its shape reads on a phone.
export const CARGO = { drawScale: 1.3 };

// Rope play over a customer. Zones are measured from the drone to the target.
export const ROPE_CTL = {
  speed: 95,
  max: 220,
  zoneX: 70,
  zoneY: 260,
  holdX: 150,
  holdAbove: 20,
  holdY: 340,
};

// Hold is a critically damped spring on the spot where it was pressed.
export const HOLD = { spring: 14, damp: 7.5, drain: .5 };

// Land is offered near any shop pad to an aircraft slower than maxSpeed, with or without an order on the rope.
// It crosses at up to across, climbing over anything in the way, then within lineUp of the pad it sinks at speed,
// easing down to touch just above the roof.
export const LAND = { zoneX: 280, zoneY: 460, maxSpeed: 260, across: 170, pull: 2.4, look: 60, clear: 30, lineUp: 24, speed: 120, touch: 40, ease: 1.2, follow: 6 };

// feel bends the stick: above 1 small moves stay gentle, below 1 they bite early. size scales all
// touch controls, fade is how much of them shows. thumb starts the stick where the finger lands.
// The controls also follow the screen: its short side over room, kept between roomMin and roomMax.
export const JOY = {
  dead: .12, knobGap: 5, room: 390, roomMin: .8, roomMax: 1.35,
  sizes: { small: .85, medium: 1, large: 1.2 },
  feels: { soft: 1.7, normal: 1, sharp: .6 },
  fades: { solid: 1, light: .65, faint: .4 },
  options: [
    { key: 'size', label: 'Size', values: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']] },
    { key: 'feel', label: 'Feel', values: [['soft', 'Soft'], ['normal', 'Normal'], ['sharp', 'Sharp']] },
    { key: 'fade', label: 'Look', values: [['solid', 'Solid'], ['light', 'Light'], ['faint', 'Faint']] },
    { key: 'origin', label: 'Stick', values: [['fixed', 'Fixed'], ['thumb', 'Follows thumb']] },
    { key: 'hand', label: 'Lift', values: [['right', 'Right hand'], ['left', 'Left hand']] },
  ],
};

export const DEV = { password: '930933', chargeTo: 100 };

// Courier is the prototype's flight, every factor 1. thrust is climb and load strength,
// speed scales horizontal thrust, battery is capacity, tough divides crash damage.
// hz is the motor pitch at idle and full throttle. Real classes set the direction, game balance the size.
// span is half the drawn width, rotors included, in body units.
// The aircraft is drawn scale times its body and belongs to the scene: its rim is a faint edge of light at rimIdle,
// in ink, the light or dark colour that stands out from what is behind it. Only when its paint comes close to that
// backdrop does the rim rise toward rimNear and the paint shift toward ink. near is the colour distance where that
// starts and far where it is full; every is how often the scene is read, in seconds.
export const CONTRAST = {
  scale: 1.1, every: .2, near: .24, far: .08, rate: 2.5, rest: .02, tintLight: .2, tintDark: .12, rimPx: 1, rimIdle: .22, rimNear: .7, box: 170, midLight: .62,
  dark: '#141030', light: '#ffffff', groundGap: 18, skyline: 240,
};

export const AIRCRAFT = [
  { key: 'courier', span: 46, paint: '#e8492c', name: 'Courier', gear: 'arched', thrust: 1, speed: 1, battery: 1, tough: 1, hz: [92, 148], note: 'The all-rounder' },
  { key: 'miniFold', span: 37, paint: '#8c97a6', name: 'Mini Fold', gear: 'stubs', thrust: 1.2, speed: .8, battery: 1.15, tough: .6, hz: [200, 310], note: 'Light and long-lived, but fragile' },
  { key: 'hexa', span: 48, paint: '#2f8f8a', name: 'Hexa H6', gear: 'tlegs', thrust: 1, speed: .9, battery: 1.25, tough: 1.3, hz: [105, 150], note: 'Steady, with six motors to spare' },
  { key: 'x8', span: 48, paint: '#4f5d75', name: 'X8 Cargo', gear: 'skids', thrust: .85, speed: 1, battery: 1, tough: 1.6, hz: [64, 90], note: 'Takes a beating, climbs slowly' },
  { key: 'fpv', span: 37, paint: '#17171d', name: 'FPV Racer', gear: 'belly', thrust: 1.6, speed: 1.5, battery: .45, tough: .8, hz: [240, 640], note: 'Wild speed, tiny battery' },
  { key: 'heavy', span: 59, paint: '#d9a321', name: 'Heavy Lifter', gear: 'tall', thrust: 1.1, speed: .6, battery: .6, tough: 1.9, hz: [50, 70], note: 'Slow and short-ranged, nearly unbreakable' },
  { key: 'vtol', span: 40, paint: '#eef1f6', name: 'VTOL Wing', gear: 'retract', thrust: .8, speed: 1.7, battery: 1.4, tough: .7, hz: [130, 200], note: 'Fastest cruiser, weak climber' },
  { key: 'whoop', span: 40, paint: '#2f3540', name: 'Cinewhoop', gear: 'belly', thrust: 1.3, speed: 1.1, battery: .7, tough: 1.3, hz: [300, 600], note: 'Ducted props shrug off bumps' },
  { key: 'cage', span: 18, paint: '#8b95a3', name: 'Cage Scout', gear: 'none', thrust: .95, speed: .7, battery: .8, tough: 1.5, hz: [180, 280], note: 'A roll cage for tight streets' },
  { key: 'agri', span: 45, paint: '#e9eef2', name: 'Agri Tanker', gear: 'tall', thrust: 1, speed: .7, battery: .75, tough: 1.7, hz: [58, 80], note: 'Farm-built, deep rumble' },
  { key: 'tandem', span: 43, paint: '#5a7fa6', name: 'Twin Tandem', gear: 'skids', thrust: 1.15, speed: .85, battery: .9, tough: 1.2, hz: [70, 105], note: 'Two big rotors, strong lifter' },
  { key: 'tilt', span: 36, paint: '#d8dde6', name: 'Tiltrotor', gear: 'retract', thrust: .9, speed: 1.45, battery: 1.2, tough: .8, hz: [150, 240], note: 'Rotors swing forward at speed' },
];

// Picker badge: of the stats a model ranks in the top topRank for, the one furthest above
// the fleet average. Text is [best in the fleet, top rank]. No such stat means all-round.
export const BADGE = {
  topRank: 4,
  allRound: 'All-round',
  stats: {
    thrust: ['Strongest', 'Strong'],
    speed: ['Fastest', 'Fast'],
    battery: ['Longest range', 'Long range'],
    tough: ['Toughest', 'Tough'],
  },
};

// The first aircraft is free and the rest are bought with delivery money. A part fits every
// aircraft: stat says what it multiplies, gain is how much each level adds.
export const SHOP = {
  aircraft: { miniFold: 150, hexa: 200, x8: 200, cage: 250, agri: 250, tandem: 300, whoop: 350, tilt: 450, heavy: 450, vtol: 550, fpv: 600 },
  partPrices: [100, 220, 400],
  parts: [
    { key: 'motors', stat: 'thrust', gain: .06, name: 'Stronger motors', note: '+6% lift each' },
    { key: 'shell', stat: 'speed', gain: .06, name: 'Sleek shell', note: '+6% speed each' },
    { key: 'cells', stat: 'battery', gain: .1, name: 'Bigger battery', note: '+10% flying time each' },
    { key: 'frame', stat: 'tough', gain: .15, name: 'Reinforced frame', note: '+15% toughness each' },
  ],
};

// The player's score against computer pilots; a full 120 stars plus steady replays reach the top.
export const LEAGUE = {
  perStar: 100,
  perDelivery: 5,
  pilots: [
    ['Sky Fox', 12600], ['Rotor Rex', 11200], ['Night Owl', 9800], ['Blue Kite', 8400], ['Iron Wing', 7000], ['Copper Hawk', 5800],
    ['Dust Devil', 4600], ['Zero Wind', 3500], ['Captain Prop', 2500], ['Mint Comet', 1600], ['Low Battery', 800], ['Rookie Rotor', 300],
  ],
};

// When a shop suggests another aircraft while it makes the order.
// previewEvery: seconds between pictures of the spinning aircraft in settings, which need not keep up with the screen.
export const HANGAR = { heavyFrom: 1.8, fragileFrom: 1.6, windyFrom: 1.6, rotate: 3, tipGap: 10, previewHeight: 68, previewEvery: .05 };

// A Double Run is one long trip with two orders tied together on the rope. The lower one comes off at the
// nearer customer and the aircraft jumps, suddenly lighter. near and gap are how far out each customer is.
// Levels from first on whose number leaves remainder at are flown this way.
export const DOUBLE = {
  first: 12, every: 5, at: 2, maxWeight: 2.2, stack: 1.25, drawGap: 7, prepExtra: 1.5, extraTime: 16,
  near: 2000, nearSpan: 1500, gap: 1800, gapSpan: 1500, kick: 320, boxKick: 240,
};

// Levels from these numbers on are routes of two and three orders.
export const STOPS = { twoFrom: 6, threeFrom: 21 };

// resultDelay stays under HEALTH.respawnDelay, so a wreck is still on screen when the card opens.
// signs is how many marks stand beside a mission on the map.
export const LEVELS = { count: 40, seed: 2026, maxDist: 6500, resultDelay: 2, passDelay: 2.2, rowGap: 92, pathWave: .85, pathWidth: 30, balconyMaxSize: 1.3, wayMargin: 24, signs: 2 };

// The result screen. tally is how long the money takes to run up, in milliseconds, after tallyDelay. tips answer each way
// of failing, by the words on the screen.
export const RESULT = {
  tally: 700, tallyDelay: 1300,
  tips: {
    "TIME'S UP": 'Hold boost on the long straights to win back seconds',
    'BATTERY DEAD': 'Climbing drains the most. Any shop roof recharges you',
    'ORDER RUINED': 'Ease off before you turn, so the order stops swinging',
    'AIRCRAFT DESTROYED': 'When it starts to smoke, land on a shop roof to repair',
    'TRAFFIC STOPPED': 'Stay above the road and drop in behind a car',
    'THE RIVAL GOT THERE FIRST': 'The rival leaves a few seconds after you. Fly straight',
    'LOST AT SEA': 'Keep the order clear of the waves, not just the aircraft',
    'LOST IN QUICKSAND': 'Keep the order away from the dark sand',
    'SPOTTED BY RADAR': 'Stay under the red line, a moment above it is forgiven',
    MELTED: 'Ice cream will not wait. Fly straight there',
    'DOWNED BY AN EAGLE': 'When the red arc shows, break hard or boost out of its line',
  },
};

// The last missions, each with one rule of its own. map is where it flies, shop which of that map's shops it opens at,
// near and far how far off the customer is, and kinds which customers will do. stops names the rule of each order on
// a route. A mission with no stops is one order under the rule named by its key.
export const CHALLENGES = [
  { key: 'blackout', name: 'Blackout', note: 'Power cut. You only see what your lights reach', map: 'city', shop: 3, item: 'medicine', kinds: ['roof', 'bal'], near: 1500, far: 2600, hawks: 1, wind: 120 },
  { key: 'glass', name: 'Glass Cargo', note: 'One good knock and the vase is gone', map: 'city', shop: 4, item: 'vase', kinds: ['roof'], near: 900, far: 1700, hawks: 0, wind: 110, extra: 12 },
  { key: 'storm', name: 'Storm Front', note: 'Gusts swap sides every few seconds', map: 'city', shop: 5, item: 'watermelon', kinds: ['roof', 'bal'], near: 1400, far: 2400, hawks: 1, wind: 300, extra: 8 },
  { key: 'radar', name: 'Under the Radar', note: 'Stay below the red line or you are spotted', map: 'city', shop: 2, item: 'kunafa', kinds: ['roof'], near: 1600, far: 2600, hawks: 1, wind: 120, extra: 6 },
  { key: 'battery', name: 'Last Drops', note: '40% battery, no boost and a long way to go', map: 'city', shop: 1, item: 'falafel', kinds: ['roof'], near: 1900, far: 2500, hawks: 1, wind: 130, startBat: 40, noBoost: true, extra: 10 },
  { key: 'melt', name: 'Melting Point', note: 'Ice cream in the desert. Melted means failed', map: 'desert', shop: 0, item: 'icecream', kinds: ['rock'], near: 1200, far: 2500, hawks: 1, wind: 170 },
  { key: 'ferry', name: 'Ferry Drop', note: 'The customer is on a moving ferry. Hold rides along', map: 'beach', shop: 0, item: 'coffee', hawks: 1, wind: 150, extra: 14 },
  { key: 'hawks', name: 'Hawk Season', note: 'Six hawks on the way. Shield the order with your aircraft', map: 'city', shop: 6, item: 'kunafa', kinds: ['roof'], near: 2400, far: 3400, hawks: 6, eagles: 1, wind: 140, extra: 10 },
  { key: 'rope', name: 'Long Line', note: 'Double rope. Fly high, the load hangs far below you', map: 'city', shop: 8, item: 'pizza', kinds: ['roof'], near: 1500, far: 2600, hawks: 1, wind: 150, rope: 130, extra: 10 },
  { key: 'finale', name: 'Grand Finale', note: 'A storm, then a blackout, then a race', map: 'city', shop: 7, stops: ['storm', 'blackout', 'race'], kinds: ['roof', 'bal'], near: 900, far: 1700, hawks: 2, eagles: 1, wind: 220, rival: true, rivalSpeed: 160, extra: 12 },
];

// reach is how far the aircraft's lights carry, clear the share of it that stays fully lit.
export const BLACKOUT = { reach: 250, minReach: 170, clear: .42, open: 'rgba(3,3,14,0)', shut: 'rgba(3,3,14,.975)' };

// A gust holds for gapMin to gapMin + gapRange seconds at gustMin or more of the mission's wind.
export const STORM = {
  gapMin: 1.8, gapRange: 1.6, gustMin: .7, follow: 2.4, shade: .26, rain: 46, rainLong: 30, rainFall: 900, rainDrift: 1.4, rainLean: .05, rainColor: 'rgba(205,220,255,.45)',
  boltGap: 5, boltRange: 5, boltFade: 2.6, boltAlpha: .5,
};

// The line sits clear above the tallest thing on the route. grace is how many seconds above it are forgiven.
export const RADAR = { clear: 120, grace: 1.6, fade: 1.2, line: 3, dash: 16, dashRate: 40, text: 12, edge: 10, tint: .22 };

// The ferry works the bay between from and to, with the customer on its open deck.
export const FERRY = { from: 15520, to: 16880, speed: 62, w: 190, deckH: 30, bow: 18, draft: 10, stripe: 9, stripeH: 6, cabinAt: 14, cabinW: 56, cabinH: 34, targetLift: 11, start: 16200 };

// The lesson flight: how far the drone must go in each step, measured from the green pad.
export const TRAINING = { prep: 2, climb: 90, ringX: 420, ringY: 150, ringReach: 46, boostFor: .4, padLift: 20, rope: 40 };

// The arrow circles the drone, so it can never slip under the controls or the HUD. Its orbit is the reach of the aircraft
// or the order on the rope, plus clear pixels for the arrow and its chevrons, and never under minOrbit. All sizes are in
// pixels. customer and shop are its light and deep facets, by where it is pointing.
export const POINTER = {
  minOrbit: 80, clear: 46, size: 12, bob: 2.5, bobRate: 3, alpha: .92, rim: 1.2, chevrons: 2, chevronGap: 9, chevronSize: 6, chevronWidth: 2.4, flow: 1.3,
  textSize: 12, pillH: 20, pillPad: 9, pillGap: 7, safeMargin: 44, bottomGap: 60,
  customer: ['#ffe08a', '#f09a1a'], shop: ['#a2f2c3', '#27ad66'], shade: 'rgba(20,15,40,.45)', edge: 'rgba(255,255,255,.85)', pill: 'rgba(16,12,36,.42)',
};

// The ring around the aircraft while the shop works. It clears the aircraft's own span by gap and is made of ticks, each
// taking up tick of its share of the circle. They light clockwise from the top, red to gold to green, so the colour
// reached says how far along the order is. flash is how long the finished ring stands as it spreads by flashGrow and
// fades. width and gap are in world units, minRadius, minWidth, edge and sparkSize in pixels, so it stays clear on a small
// screen. note is the caption over the ring, in pixels too; nudge is how many seconds it shakes for when the player
// tries to leave before the opening order is loaded.
export const PREP = {
  gap: 15, minRadius: 36, width: 4.5, minWidth: 4, edge: 1, ticks: 40, tick: .72, alpha: .86, sparkSize: 13, flash: .9, flashGrow: 16, nudge: .6,
  note: { gap: 10, edge: 58, h: 26, tall: 42, padX: 14, radius: 12, title: 12.5, sub: 11, titleY: 14, subY: 29, fill: 'rgba(16,12,36,.42)', shake: 4, rate: 46 },
  backing: 'rgba(16,12,36,.2)', dim: 'rgba(255,255,255,.3)', sweep: 'rgba(255,255,255,.08)', spark: 'rgba(255,243,223,.8)', ink: '#fff3df',
  stages: [[0, '#ff3f33'], [.5, '#ffc92e'], [1, '#2fe07a']],
};

// Warnings count seconds of full lift left, so a small battery warns earlier than a big one.
// Each order earns one charge. Fair time is grace seconds plus the route at pace: a trip inside it gets
// all the missing charge back, and a trip that takes twice as long gets half.
export const BATTERY = { lowSecs: 20, criticalSecs: 10, chargingBelow: 99, shopReach: 60, grace: 30, pace: 150 };

// The order's time left and a bar that runs down with it, over the aircraft. Sizes are in pixels; lift
// scales with the view. stages colour the bar by the share of time still left.
export const ORDER_TIME = {
  lift: 30, gap: 16, clearCue: 56, w: 50, h: 25, text: 12, textY: -3, alpha: .86, fill: .34, pulse: 4,
  barW: 36, barH: 3, barY: 7, track: .22, stages: [[0, '#ff7a5c'], [.25, '#ffc23d'], [.5, '#4fc27c']],
};

// flipSpeed: above this the boost icon points the way the aircraft is flying.
export const BOOST = { force: 900, drain: 60, refill: 18, refillDelay: .6, batteryDrain: 6, flipSpeed: 60 };

// How long the keys stay on screen when a level opens on a computer.
export const KEY_HINT = { secs: 3 };

export const HAWKS = {
  from: 1, twoFrom: 4, threeFrom: 20, pathMin: .3, pathRange: .5, lift: 90, orbit: 60, circleRate: 1.4,
  trigger: 200, diveSpeed: 380, diveTime: 3, hitDist: 22, shooDist: 30, damage: 14, hitShake: 6,
  fleeX: 240, fleeY: 200, fleeTime: 2.5,
};

// An eagle hunts the aircraft itself, where a hawk goes for the order. It soars over the last leg of a mission from first
// on, on every level whose number leaves remainder at. Once the aircraft is within trigger it screams, marks it for markTime
// and stoops at diveSpeed, turning at most turnRate radians a second, so a hard change of course slips it. A stoop that
// passes the aircraft climbs away for climbTime and comes round again, passes times in all. Touching the order tears off
// damage; touching the aircraft cuts its motors and kills the eagle. spin is how fast the aircraft tumbles as it falls.
export const EAGLES = {
  first: 24, every: 5, at: 4, twoFrom: 39, pathMin: .35, pathRange: .4, lift: 170, orbit: 90, circleRate: .9, flap: 5, stoopFlap: 26,
  trigger: 300, markTime: .7, markRise: 40, diveSpeed: 470, turnRate: 2.2, diveTime: 2.4, hitDist: 30, boxDist: 30, damage: 26, hitShake: 8,
  climbSpeed: 240, climbRise: 200, climbTime: 1.3, passes: 3, fleeX: 300, fleeY: 240, fleeTime: 2.5,
  deadLife: 3, deadSpin: 5, deadKick: 120, feathers: 18, feather: '#6b4a30', spin: 1.2, scale: 1, reach: 60,
  alarmRadius: 74, alarmMin: 58, alarmSpread: .5, alarmWidth: 5, alarmRate: 12, alarmColor: '#ff3b30',
};

export const RIVAL = {
  from: 2, chance: .5, delayMin: 7, delayRange: 2, speed: 135, speedPerDelivery: 3, speedMax: 240,
  padLift: 30, clearance: 70, lookAhead: 90, climb: 3, approach: 140, hover: 60, arrive: 12, arriveY: 26, bonus: 15, scale: 1.1,
};

// Every level has traffic in one lane: the road through the city, speedboats on the sea.
// lane is how far in front of the buildings the wheels roll; the body rises up to the street level.
export const CARS = {
  spacing: 1000, spacingRange: 300, speedMin: 150, speedPerLevel: 2, speedMax: 230, boatSpeed: .85,
  shapes: {
    car: { length: 62, height: 28 }, van: { length: 70, height: 32 }, bike: { length: 36, height: 24 }, boat: { length: 66, height: 16 },
    buggy: { length: 56, height: 28 }, camel: { length: 58, height: 42, lane: 15 }, jeep: { length: 58, height: 30 }, deer: { length: 46, height: 38, lane: 15 },
  },
  lane: 8, buggySpeed: .9, camelSpeed: .3, brake: 500, shake: 8, dust: 220, flashRate: 7,
  paint: ['#d9483b', '#3f6fb0', '#f2efe6', '#3a8f6b', '#e0a52c'], bikeEvery: 3, vanEvery: 5, taxiEvery: 7,
};

// Wind starts soon after take-off and changes every gapMin to gapMin + gapRange seconds. Each change draws one kind:
// a lull, a medium wind or a strong one, as a share (from to to) of the mission's top wind, blowing either way.
export const WIND = {
  firstAt: 4,
  base: 100,
  perDelivery: 12,
  maxDeliveries: 10,
  follow: .8,
  gapMin: 5,
  gapRange: 6,
  kinds: [{ chance: .15, from: 0, to: 0 }, { chance: .5, from: .3, to: .55 }, { chance: .35, from: .65, to: .9 }],
};

// Pizza is the prototype's baseline: every factor is 1, so its flight matches prototype.html.
// prep is how many seconds the shop needs to make the order; price is what ruining it costs.
export const ITEMS = {
  pizza: { key: 'pizza', price: 10, prep: 7, label: 'Pizza', weight: 1, size: 1, fragile: 1, heat: 1, wind: 1 },
  falafel: { key: 'falafel', price: 6, prep: 3.5, label: 'Falafel', weight: .8, size: .8, fragile: .6, heat: .9, wind: .9 },
  kunafa: { key: 'kunafa', price: 12, prep: 5.5, label: 'Kunafa', weight: 1.1, size: 1.1, fragile: 1.2, heat: 1.1, wind: 1 },
  coffee: { key: 'coffee', price: 4, prep: 2.5, label: 'Coffee', weight: .6, size: .6, fragile: 1.6, heat: 1.4, wind: .8 },
  cake: { key: 'cake', price: 14, prep: 4.5, label: 'Cake', weight: 1, size: 1, fragile: 2, heat: 0, wind: 1.1 },
  medicine: { key: 'medicine', price: 8, prep: 1.5, label: 'Medicine', weight: .3, size: .5, fragile: .5, heat: 0, wind: .7, urgent: true },
  flowers: { key: 'flowers', price: 9, prep: 3, label: 'Flowers', weight: .4, size: .9, fragile: 1.3, heat: 0, wind: 1.8 },
  watermelon: { key: 'watermelon', price: 5, prep: 2, label: 'Watermelon', weight: 1.8, size: 1, fragile: .7, heat: 0, wind: .5 },
  tv: { key: 'tv', price: 30, prep: 4, label: 'TV', weight: 2, size: 1.6, fragile: 1.8, heat: 0, wind: 1.6 },
  vase: { key: 'vase', price: 35, prep: 3, label: 'Glass Vase', weight: .6, size: .9, fragile: 6, heat: 0, wind: 1.2 },
  // spoils: losing all its heat ruins this one, and the word says how
  icecream: { key: 'icecream', price: 7, prep: 2, label: 'Ice Cream', weight: .5, size: .8, fragile: .8, heat: 3, wind: .9, spoils: 'Melted' },
};

// How much a load above or below pizza weight changes lift and battery use.
export const LOAD = { thrustLoss: .12, drainGain: .35 };

export const SHOPS = [
  { name: 'Pizza', items: ['pizza'], glow: '#ff5a3c' },
  { name: 'Falafel', items: ['falafel'], glow: '#7cc28f' },
  { name: 'Sweets', items: ['kunafa', 'cake'], glow: '#f2a65a' },
  { name: 'Pharmacy', items: ['medicine'], glow: '#4fc27c' },
  { name: 'Flowers', items: ['flowers'], glow: '#d97aa8' },
  { name: 'Fruit & Veg', items: ['watermelon'], glow: '#9bd14f' },
  { name: 'Electronics', items: ['tv'], glow: '#4fa3c2' },
  { name: 'Café', items: ['coffee'], glow: '#c89a6a' },
];

// One day: each time holds, then fades into the next. lit = window colours for off, dim and bright.
// Sky stops must line up across times so they can blend; discCut is how much of the disc is shaded.
export const CLOCK = { hold: 120, fade: 20, steps: 16, startAt: 2 };
export const TIMES = [
  {
    name: 'Sunset', sky: [[0, '#140f2a'], [.45, '#3b2452'], [.8, '#b4505a'], [1, '#f0a259']],
    stars: .7, cloud: '#ffd2c2', cloudShade: '#b9788c', cloudAlpha: .85, disc: '#fff1d0', discShade: '#3b2452', discCut: 1, far1: '#3d2849', far2: '#2c1d40', sea: '#7a4a6e', sand: '#b98a6a', moss: '#4a5a3a', hill: '#5e4a6e', pineFar: '#40384f', pineNear: '#2e3040', mistTone: '255,214,200', dune: '#c08a5e', duneNear: '#a56c58', duneFar: '#8a585e',
    ground: '#2a1d2c', walk: '#3a2c33', light: 1, lit: ['#4a3a52', '#f2a65a', '#ffd27a'], extraLit: 0, windowGlow: 0, signGlow: .5,
  },
  {
    name: 'Night', sky: [[0, '#05060f'], [.45, '#0b0f28'], [.8, '#171d40'], [1, '#232a52']],
    stars: 1, cloud: '#6f7aa6', cloudShade: '#383f68', cloudAlpha: .55, disc: '#e8ecff', discShade: '#0a0e26', discCut: 1, far1: '#141a38', far2: '#0e1228', sea: '#141c3e', sand: '#45424f', moss: '#1d2a26', hill: '#1b2140', pineFar: '#141a2e', pineNear: '#0e1422', mistTone: '150,165,210', dune: '#4a4552', duneNear: '#2f2e4a', duneFar: '#20233f',
    ground: '#10131f', walk: '#1a1c2a', light: .48, lit: ['#1f2233', '#e8a24f', '#ffd884'], extraLit: .22, windowGlow: 1, signGlow: .75,
  },
  {
    name: 'Day', sky: [[0, '#3f8fd6'], [.45, '#7db8e8'], [.8, '#b9dcef'], [1, '#eaf4f2']],
    stars: 0, cloud: '#ffffff', cloudShade: '#b4c3da', cloudAlpha: 1, disc: '#fff3c4', discShade: '#7db8e8', discCut: 0, far1: '#9db8cc', far2: '#b7cddd', sea: '#3f9fc8', sand: '#e8d6a8', moss: '#5f7f45', hill: '#9cb4bc', pineFar: '#6a927a', pineNear: '#467556', mistTone: '255,255,255', dune: '#e9c98c', duneNear: '#ddb274', duneFar: '#e6c693',
    ground: '#6f6a62', walk: '#8c867b', light: 1.08, lit: ['#5f7f95', '#7c9bb0', '#a8c4d6'], extraLit: 0, windowGlow: 0, signGlow: .2,
  },
];

export const PEOPLE = { spacing: 130, speedMin: 14, speedRange: 22, walkRate: 7, sidewalk: 8, height: 20 };
export const BIRDS = { spacing: 850, countMin: 4, countRange: 5, heightMin: 40, heightRange: 260, radius: 150, speed: .35, flap: 14 };

export const ORDERS = {
  minDist: 700,
  stepDist: 260,
  maxSteps: 12,
  span: 1200,
  spanPerDelivery: 120,
  // a customer needs open air: how close something solid or a line may come to their spot
  clearX: 20,
  clearAbove: 60,
  insideX: 14,
  insideY: 12,
  lineX: 34,
  lineY: 32,
};

export const DELIVERY = {
  reach: 20,
  holdReach: 36,
  maxDroneSpeed: 160,
  holdTime: .7,
  holdDecay: 2,
  popLift: 50,
  heatLoss: 1.45,
  steamRate: 10,
  steamMinHeat: 35,
  crashCrumbs: 14,
  crashShake: 10,
  tipBase: 8,
  tipHeat: .12,
  tipBox: .12,
  tipFastSecs: 25,
  tipFastBonus: 6,
  tipOkSecs: 45,
  tipOkBonus: 3,
  starHeat: 60,
  starBox: 70,
  starTimeShare: .6,
  urgentTip: 1.5,
};

export const RESTAURANT = {
  chargeRate: 30,
  padHeight: 40,
  boxOffsetX: 18,
  boxLift: 11,
};

export const CAMERA = {
  leadX: .45,
  lookAhead: .35,
  follow: 3,
  floorBelow: 40,
  leadY: .42,
  hudGap: 64,
  shakeDecay: 30,
  idleSpeed: 24,
  idleLead: 200,
  idleTimeDiv: 60,
};

export const FX = {
  popLife: 1.8,
  steamLife: 1,
  crumbLife: 1.2,
  steamDrift: .3,
  confetti: { count: 46, spread: 240, lift: 170, minLift: 110, gravity: .28, life: 2.1, size: 5, paint: ['#ffc23d', '#e8492c', '#4fc27c', '#4fa3c2', '#fff3df'] },
};

export const SHAKE = {
  amp: .45,
  soft: 2,
  freqX: [38, 61],
  freqY: [47, 83],
  secondWave: .5,
};

export const DUST = {
  minSpeed: 60,
  countMin: 6,
  countPerSpeed: .05,
  countMax: 22,
  spawnWidth: 18,
  spreadX: 130,
  riseMin: 15,
  riseRange: 45,
  drag: .02,
  lifeMin: .45,
  lifeRange: .35,
  sizeStart: 2.5,
  sizeGrow: 13,
  alpha: .5,
};

export const SHADOW = {
  maxHeight: 420,
  alpha: .42,
  radius: 30,
  radiusGrow: .06,
  flat: .22,
  lift: 3,
};

export const AUDIO = {
  smooth: .07,
  updateEvery: .08,
  tiltLoad: .5,
  boostLoad: .3,
  holdLoad: .45,
  idleHz: 92,
  liftHz: 148,
  detune: 9,
  idleCut: 520,
  liftCut: 1250,
  idleGain: .05,
  liftGain: .11,
  toneMix: .55,
  noiseMix: .35,
  noiseHz: 750,
  noiseLiftHz: 1200,
  noiseQ: 1,
  latency: 'balanced',
  maxHz: 420,
  maxCut: 1700,
  maxNoiseHz: 1700,
  softCut: 2600,
  pitchTrim: .35,
  sfxGain: .5,
  maxVoices: 6,
  sfxGap: .12,
  limiter: { threshold: -14, ratio: 12, attack: .003, release: .2 },
};

export const CITY = {
  leftBuilding: { x: -330, w: 250, h: 190 },
  restaurant: { x: -10, w: 240, h: 150 },
  firstGap: 90,
  endX: 14000,
  shopEvery: 1500,
  shopHRange: 60,
  padInset: 70,
  gapMin: 90,
  cellW: 30,
  floorH: 40,
  sideMargin: 24,
  roofMargin: 30,
  minCols: 2,
  minRows: 1,
  litChance: .42,
  brightChance: .5,
  tankW: 34,
  tankWRange: 26,
  tankH: 26,
  tankInset: 12,
  tankSlack: 60,
  dishInset: 30,
  dishW: 20,
  dishH: 22,
  rigMinW: 150,
  craneMinH: 230,
  craneMastW: 14,
  craneMastHMin: 120,
  craneMastHRange: 70,
  craneJibLen: 260,
  craneJibH: 10,
  towerW: 12,
  towerHMin: 90,
  towerHRange: 80,
  balconyMinH: 200,
  balconyTwoH: 330,
  balconyW: 40,
  balconyH: 8,
  balconyDrop: 6,
  balconyMinFloor: 2,
  balconyRoofGap: 30,
  targetLift: 11,
  roofTargetInset: 34,
  powerDamage: 3,
  lineDropMin: 25,
  lineDropRange: 70,
  lineTilt: 20,
  linePoints: 14,
  lineSag: 22,
  clothFirst: 2,
  clothLast: 13,
  clothStep: 3,
  clothStepRange: 2,
  clothHMin: 18,
  clothHRange: 8,
  clothWMin: 17,
  clothWRange: 6,
  farCount: 60,
  far1WMin: 60,
  far1WRange: 90,
  far1HMin: 120,
  far1HRange: 240,
  far1DomeChance: .25,
  far2WMin: 40,
  far2WRange: 70,
  far2HMin: 80,
  far2HRange: 170,
  far2MinaretChance: .12,
};
