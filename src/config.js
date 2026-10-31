// Every tunable number lives here. Values come from prototype.html unchanged.

export const FIXED_DT = 1 / 120;
export const MAX_FRAME_DT = .05;
export const HUD_INTERVAL = .1;

export const VIEW = { maxDPR: 2, refH: 600, refW: 560 };
export const PERSPECTIVE = { depth: .93, eyeY: .38 };

export const G = 700;
export const GROUND = 560;
export const GROUND_BOX = { x: -2000, w: 12000, h: 200 };
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

export const CITY = {
  leftBuilding: { x: -330, w: 250, h: 190 },
  restaurant: { x: -10, w: 240, h: 150 },
  firstGap: 90,
  endX: 5600,
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
  tankH: 26,
  tankInset: 12,
  tankSlack: 60,
  dishChance: .45,
  dishInset: 30,
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
