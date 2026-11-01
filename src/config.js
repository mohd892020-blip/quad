// Every tunable number lives here. Values come from prototype.html unchanged.

export const FIXED_DT = 1 / 120;
export const MAX_FRAME_DT = .05;
export const HUD_INTERVAL = .1;

export const VIEW = { maxDPR: 2, refH: 600, refW: 560 };
export const PERSPECTIVE = { depth: .93, eyeY: .38 };
// Drop to LOWQ when frames average slower than slowFrame over a window, ignoring tab-switch gaps.
export const QUALITY = { window: 3, slowFrame: .028, maxFrameGap: .2, lowDPR: 1 };
export const SPRITE = { padX: 44, padTop: 50, evictMargin: 900 };
export const CELL = { size: 256, base: -2400, margin: 48 };

export const G = 700;
export const GROUND = 560;
export const GROUND_BOX = { x: -2000, w: 20000, h: 200 };
export const SHIFT = 180;
export const IDLE_SEED = 7;

export const DRONE = {
  radius: 15,
  spawnAbovePad: 90,
  tiltMax: .48,
  tiltRate: 7,
  thrustLift: 1.72,
  thrustIdle: .78,
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

export const ROPE = 62;
export const BOX = {
  startAbovePad: 28,
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
};

export const WIND = {
  firstAt: 22,
  calmChance: .25,
  base: 80,
  perDelivery: 14,
  maxDeliveries: 10,
  follow: .8,
  gapMin: 5,
  gapRange: 6,
};

// Pizza is the prototype's baseline: every factor is 1, so its flight matches prototype.html.
export const ITEMS = {
  pizza: { key: 'pizza', label: 'Pizza', weight: 1, size: 1, fragile: 1, heat: 1, wind: 1 },
  falafel: { key: 'falafel', label: 'Falafel', weight: .8, size: .8, fragile: .6, heat: .9, wind: .9 },
  kunafa: { key: 'kunafa', label: 'Kunafa', weight: 1.1, size: 1.1, fragile: 1.2, heat: 1.1, wind: 1 },
  coffee: { key: 'coffee', label: 'Coffee', weight: .6, size: .6, fragile: 1.6, heat: 1.4, wind: .8 },
  cake: { key: 'cake', label: 'Cake', weight: 1, size: 1, fragile: 2, heat: 0, wind: 1.1 },
  medicine: { key: 'medicine', label: 'Medicine', weight: .3, size: .5, fragile: .5, heat: 0, wind: .7, urgent: true },
  flowers: { key: 'flowers', label: 'Flowers', weight: .4, size: .9, fragile: 1.3, heat: 0, wind: 1.8 },
  watermelon: { key: 'watermelon', label: 'Watermelon', weight: 1.8, size: 1, fragile: .7, heat: 0, wind: .5 },
  tv: { key: 'tv', label: 'TV', weight: 2, size: 1.6, fragile: 1.8, heat: 0, wind: 1.6 },
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

// The first entry is the prototype's sunset. lit = window colours for off, dim and bright.
export const TIMES = [
  {
    name: 'Sunset', sky: [[0, '#140f2a'], [.45, '#3b2452'], [.8, '#b4505a'], [1, '#f0a259']],
    stars: .7, disc: '#fff1d0', discShade: '#3b2452', far1: '#3d2849', far2: '#2c1d40',
    ground: '#2a1d2c', walk: '#3a2c33', light: 1, lit: ['#4a3a52', '#f2a65a', '#ffd27a'], extraLit: 0, windowGlow: false, signGlow: .5,
  },
  {
    name: 'Night', sky: [[0, '#05060f'], [.55, '#0d1230'], [1, '#232a52']],
    stars: 1, disc: '#e8ecff', discShade: '#0a0e26', far1: '#141a38', far2: '#0e1228',
    ground: '#10131f', walk: '#1a1c2a', light: .48, lit: ['#1f2233', '#e8a24f', '#ffd884'], extraLit: .22, windowGlow: true, signGlow: .75,
  },
  {
    name: 'Day', sky: [[0, '#3f8fd6'], [.6, '#9fd1ef'], [1, '#eaf4f2']],
    stars: 0, disc: '#fff3c4', discShade: null, far1: '#9db8cc', far2: '#b7cddd',
    ground: '#6f6a62', walk: '#8c867b', light: 1.08, lit: ['#5f7f95', '#7c9bb0', '#a8c4d6'], extraLit: 0, windowGlow: false, signGlow: .2,
  },
];

export const PEOPLE = { spacing: 55, speedMin: 14, speedRange: 22, walkRate: 7, sidewalk: 8, height: 20 };
export const BIRDS = { spacing: 850, countMin: 4, countRange: 5, heightMin: 40, heightRange: 260, radius: 150, speed: .35, flap: 14 };

export const ORDERS = {
  minDist: 300,
  stepDist: 260,
  maxSteps: 8,
  span: 900,
  spanPerDelivery: 120,
};

export const DELIVERY = {
  reach: 20,
  maxDroneSpeed: 160,
  holdTime: .7,
  holdDecay: 2,
  hintDelay: 700,
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
  starSecs: 35,
  urgentTip: 1.5,
};

export const RESTAURANT = {
  chargeRate: 30,
  pickupTime: .8,
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
  shakeDecay: 30,
  idleSpeed: .4,
  idleLead: 200,
  idleTimeDiv: 60,
};

export const FX = {
  popLife: 1.8,
  steamLife: 1,
  crumbLife: 1.2,
  steamDrift: .3,
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
  idleHz: 92,
  liftHz: 148,
  detune: 9,
  idleCut: 520,
  liftCut: 1250,
  idleGain: .05,
  liftGain: .11,
  toneMix: .55,
  noiseMix: .5,
  noiseHz: 900,
  noiseLiftHz: 1500,
  noiseQ: .7,
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
  gapMin: 90,
  gapRange: 60,
  widthMin: 110,
  widthRange: 110,
  heightMin: 150,
  heightRange: 290,
  cellW: 30,
  floorH: 40,
  sideMargin: 24,
  roofMargin: 30,
  minCols: 2,
  minRows: 1,
  litChance: .42,
  brightChance: .5,
  tankChance: .6,
  tankW: 34,
  tankWRange: 26,
  tankH: 26,
  tankInset: 12,
  tankSlack: 60,
  dishChance: .45,
  dishInset: 30,
  dishW: 20,
  dishH: 22,
  rigMinW: 150,
  craneChance: .12,
  craneMinH: 230,
  craneMastW: 14,
  craneMastHMin: 120,
  craneMastHRange: 70,
  craneJibLen: 260,
  craneJibH: 10,
  towerChance: .14,
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
  lineChance: .55,
  powerChance: .3,
  powerDamage: 3,
  lineMinH: 170,
  lineDropMin: 25,
  lineDropRange: 70,
  lineTilt: 20,
  linePoints: 14,
  lineSag: 22,
  clothFirst: 2,
  clothLast: 13,
  clothStep: 2,
  clothStepRange: 2,
  clothHMin: 12,
  clothHRange: 12,
  clothWMin: 10,
  clothWRange: 8,
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
