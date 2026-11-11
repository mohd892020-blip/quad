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
// steps back if that turns slow. A phone remembers its tier, so the next launch starts where this one settled. The first
// slow window drops the extra detail instead, for good on that phone. The first warmup seconds of a mission are not judged.
export const QUALITY = {
  window: 2, warmup: 3, slowFrame: .021, awfulFrame: .045, capFrame: .036, evenGap: .003, evenShare: .85, easyFrame: .0178, calm: 3, maxFrameGap: 1, start: 3,
  tiers: [{ dpr: 3 }, { dpr: 2.5 }, { dpr: 2 }, { dpr: 1.5 }, { dpr: 1.25 }, { dpr: 1, low: true }, { dpr: .75, low: true }],
};
// Skipping a mission for a rewarded ad. It is offered after afterFails real fails in a row (a fail counts once the try
// lasted realSecs or reached the pickup), from mission from on, never for the checkpoints in never. Between skips the
// player passes gap missions; each block of blockSize missions allows perBlock skips (challengePerBlock from
// challengeFrom on); and no more than open skipped missions may wait unplayed at once. There is no clock, so changing
// the phone's time gains nothing. devOnly keeps it in developer mode until real ads exist; until then a stand-in plays.
export const SKIP = {
  devOnly: true, afterFails: 3, realSecs: 15, from: 6, never: [10, 20, 30, 40, 50, 55, 60, 70, 80], gap: 2,
  blockSize: 10, perBlock: 2, challengeFrom: 41, challengePerBlock: 1, open: 3, adSecs: 5,
};

// Rewarded-ad boosts, got before flying only: the mission card, the result card's pill and the map's Boosts card. devOnly
// keeps every ad offer in developer mode until real ads exist, as SKIP.devOnly; the stand-in ad runs SKIP.adSecs. What a
// player already holds works either way. land: one ad unlocks Auto Land until the date changes; rush and training say
// whether it works there (a developer keeps LAND everywhere, as before). drop: one ad gives one Auto Drop, kept until a
// handover uses it; the next can be got only once it is used and on a later date. It is used from mission `from`, never
// on checkpoints (SKIP.never), today's mission, Rush Hour or training. A handover made by Auto Drop is never PERFECT,
// leaves the combo as it was, pays `tip` of the tip without the combo's raise, and holds the mission to `stars`. A
// handover it began (the rope paying out, or the hold's count started) stays its own after CANCEL until the aircraft
// leaves Hold's zone. Its button shows in Hold's zone below maxSpeed, with the aircraft at least `above` over the order's
// shortest rope, the order hanging free (less than restSlack of slack) and every ring of the stop flown; it stays
// `linger` seconds past a dip under those, so it never slips from under a finger. The autopilot steers Hold's own
// anchor: the aim walks to the spot at `slew`, riding a ferry; the anchor follows the order's swing by `sway` and leads
// for wind and ferry the way Hold's spring trails; an integral `ki` (at most biasMax) trims the last offset once the
// order is within `near` of the customer's height; the aircraft stays between `rope` and the shortest rope over the
// customer, and `ice` above thin ice's wash line; it climbs at `rise` once more than `slack` too low, and sinks at `sink`
// only once the order is within lineUp of the customer and swinging less than `calm`; within `settle` of its height the
// rope pays out at ROPE_CTL.speed, easing to `touch` + `ease` times the distance left; over traffic the order stays
// carClear above a vehicle within carGap, or due within carSecs. An order resting on a roof or a ledge, or held aside
// against a wall (more than restSlack of slack, or slower than restSpeed and off the plumb line by more than `calm`, for
// restSecs, away from the customer's height) is no swing: the anchor stops following it, the rope winds in and the
// aircraft climbs at `rise`, up to `room` under the top of Hold's zone, until it hangs free. After `secs` it hands back
// on plain Hold and the drop is kept. buzz: the phone's tap when it starts and when a boost is got.
export const BOOSTS = {
  devOnly: true, from: 6,
  land: { rush: false, training: false },
  drop: {
    tip: .5, stars: 2, maxSpeed: 220, above: 12, slew: 120, rise: 140, sink: 100, lineUp: 16, calm: 10, rope: 150, ki: .8, biasMax: 40,
    near: 20, slack: 4, settle: 20, touch: 30, ease: 2.5, ice: 30, sway: 1.2, secs: 12, carSecs: 2.5, carGap: 20, carClear: 24, buzz: 25,
    restSlack: 10, restSpeed: 15, restSecs: .25, room: 30, linger: .6,
  },
  text: {
    land: 'Auto Land', drop: 'Auto Drop', free: 'Free', ready: 'Ready', newTag: 'NEW',
    landIntro: 'Sets you down on any shop pad by itself. Free all day with one ad',
    dropIntro: 'Over the customer, it lowers the order and hands it over for you. Free with one ad',
    landWhy: {
      climb: 'Gusty mountain pads. Auto Land sets you down on them',
      long: 'A long route. Auto Land takes you down to a pad to recharge',
      cold: 'The cold drains your battery. Auto Land gets you onto a pad to recharge',
      battery: 'Only {bat}% battery. Auto Land brings you down on a pad to recharge',
      dark: 'Pickups in the dark. Auto Land finds the pad for you',
      battFail: 'Out of power? Auto Land sets you on a shop pad to recharge',
      padFail: 'Auto Land sets you down on a shop pad to recharge and repair',
    },
    dropWhy: {
      street: 'Street drops in traffic. Auto Drop waits for a gap and lowers it',
      fragile: 'A fragile order. Auto Drop lowers it gently',
      double: 'Two drops in one trip. Auto Drop can hand one over for you',
      glass: 'Glass on a rope. Auto Drop lowers it gently',
      moving: 'A customer on the move. Auto Drop rides along and hands it over',
      mark: 'A small mark. Auto Drop sets the order right on it',
      fail: 'So close! Auto Drop hands the order over for you',
    },
    pillLand: 'Auto Land · free with an ad', pillDrop: 'Auto Drop · free with an ad',
    shop: 'You can afford {names}', shopGo: 'Open the Shop',
    landReady: 'Auto Land ready today', dropReady: 'Auto Drop ready', dropNext: 'Next one tomorrow', dropSoon: 'Next one soon', landUntil: 'Ready until midnight',
    getLand: 'Get Auto Land', getDrop: 'Get Auto Drop', skip: 'Skip mission', watch: 'Watch ad',
    landLine: 'Lands you on any shop pad nearby, until midnight',
    dropLine: 'Over the customer, it lowers the order and hands it over',
    landWhere: 'Not in Rush Hour or flight school',
    dropWhere: "Not on checkpoints, Rush Hour, Today's Mission or flight school",
    paused: ['Auto Drop paused', 'Fly it in yourself. Your Auto Drop is kept'],
    hint: ['Auto Drop', 'Tap AUTO DROP to hand this order over'], hintKeys: ['Auto Drop', 'Press G to hand this order over'],
    usedTip: 'Fly the drop yourself for full tips and three stars',
    reset: 'Reset boosts', title: 'Boosts', pop: 'AUTO',
  },
};
// The price of an Auto Drop in words, read from its numbers so the two never disagree.
{
  const { tip, stars } = BOOSTS.drop, half = tip === .5, cut = Math.round(tip * 100);
  BOOSTS.text.fine = `One delivery · ${half ? 'tip halved' : `${cut}% of the tip`} · ${stars} stars at most`;
  BOOSTS.text.usedRow = ['Auto Drop', `${half ? 'Half tip' : `${cut}% tip`} · ${stars} stars max`];
}

// The golden teasers: one shared gold pill, one soft glow of `glow` seconds after glowDelay when it shows, never a
// blink. One per screen. None on a mission below `from` (the Shop's introduction, the first pass from shop.intro with
// something new to afford, is the one exception). None on a checkpoint (SKIP.never), a chapter's first mission
// (CHAPTERS[].from past 1), today's mission, Rush Hour, training or in flight. A teaser on a result card is for the
// flight that comes next: the next mission after a pass (Next skips the card), the same one after a fail. Ad teasers come
// at least adGap missions played apart and once per mission (card and result together, retries too); each feature at least gap missions
// played after its own last one. A feature introduces itself once from `intro`, then shows on the cards of its missions
// (each with the reason key of its line), and on a fail's result card after the fails it answers: Auto Land after a dead
// battery, or after padWhys near a shop pad; Auto Drop after any fail over the customer except skipWhys. Ignored `ignore`
// times in a row, a feature rests for `rest` missions played. The Shop's pill shows on a pass when something not yet
// named can be afforded, at most once per shop.every missions played. Missions played count every start of a numbered
// mission, retries included; no clock.
export const TEASE = {
  from: 6, adGap: 2, gap: 5, ignore: 3, rest: 5, glow: 1.2, glowDelay: .3,
  shop: { intro: 3, every: 3 },
  land: { intro: 8, cards: { 16: 'climb', 24: 'long', 34: 'cold', 45: 'battery', 65: 'dark', 78: 'cold' }, padWhys: ["TIME'S UP", 'AIRCRAFT DESTROYED'] },
  drop: { intro: 14, cards: { 19: 'street', 26: 'fragile', 37: 'double', 42: 'glass', 47: 'moving', 61: 'mark', 68: 'mark', 75: 'moving' }, skipWhys: ['LEFT THE MISSION'] },
};

// Clouds at flying height. amount is the share of slots that hold a cloud (a level may set its own); each is a cluster of
// puffs that the aircraft pushes (push, within reach of a puff's edge, with wash pressing down and carry dragging along)
// and that springs back. A pushed puff thins and swells; frontShare of the puffs are drawn over the aircraft. No more
// than paintsPerFrame clouds are repainted in one frame; the rest catch up on the next.
export const CLOUDS = {
  seed: 31, amount: .6, spacing: 1100, spacingRange: 800, settled: .5, heightMin: -360, heightMax: 140, puffs: [7, 12], spread: 95, flat: .42, puffR: [28, 50],
  drift: 7, windDrift: .05, awake: 500, reach: 46, push: 1500, wash: .35, carry: .25, spring: 2.6, damp: 2.4, inside: .9,
  alpha: .9, frontShare: .4, frontAlpha: .72, paintsPerFrame: 2, thin: 1.6, thinMin: .25, swell: .5, margin: 70, density: 2, shadeDrop: .22, lightLift: .1,
  falloff: [[0, 1], [.45, .96], [.72, .55], [.9, .14], [1, 0]],
  mist: { rate: 24, max: 40, minSpeed: 40, life: 1, size: 18, grow: 26, alpha: .5, sink: 10 },
  high: { seed: 57, count: 6, width: 340, flat: .3, pad: .2, parts: 6, alpha: .55, drift: .06, speed: 4, top: .06, bottom: .3 },
};

// The weather some missions fly in; the snowfield always has snow, and kinds is the order a mission is looked up in.
// count is how many flakes or drops share three layers at depth (the third passes in front of the aircraft), size
// their size, fall their speed in px/s give or take spread, sway how far a flake swings at swayRate, windShare how much
// of the wind carries them, lean the slant the wind gives the rain, pad how far past the screen they wrap, lowShare
// what is left of them on the low picture. overcast veils the sky in dim, darkened by the time of day's light. Fog clears to near within
// clear of the aircraft (fully inside core of that) and closes to thick past it, lies low up to lowH, and drifts in
// banks bankW wide at bankDepth of the camera's motion; sprite is the size its gradients are painted at. The clearing
// is wide times broader than tall, and thickens through ease (share of the way out, share of the way to thick). Low cloud fills amount of the cloud slots.
export const WEATHER = {
  kinds: ['rain', 'fog', 'clouds', 'snow'], dim: '150,156,170',
  snow: {
    name: 'Snowfall', missions: [16, 33, 67], count: 140, depth: [.45, .8, 1.35], size: [1.3, 1.8, 2.4], fall: 48, spread: .6, sway: 14, swayRate: .9, windShare: .35, lean: 0,
    pad: 30, lowShare: .5, color: '255,255,255', alpha: [.5, .75, .9], overcast: .2,
  },
  rain: {
    name: 'Rain', missions: [6, 14, 19, 26, 31, 39, 64, 75], count: 120, depth: [.5, .8, 1.3], size: [1, 1.1, 1.3], fall: 900, spread: .3, windShare: .5, lean: .0025, long: 18,
    pad: 40, lowShare: .5, color: '205,220,255', alpha: [.22, .32, .45], overcast: .42, splashes: 28, splashRate: 1.6, splashSize: 7, splashAlpha: .5,
  },
  fog: {
    name: 'Fog. Follow the arrow', missions: [11, 20, 28, 36, 60, 73], sprite: 128, clear: 330, wide: 1.45, core: .05, near: .22, thick: .7,
    ease: [[.35, .06], [.6, .32], [.82, .74]], low: .45, lowH: 170, banks: 7, bankW: 520, bankFlat: .32,
    bankAlpha: .35, drift: 14, bankDepth: .8, bankLow: 30, bankHigh: 320, overcast: .3,
  },
  clouds: { name: 'Low cloud', missions: [3, 9, 22, 35, 62], amount: .97, overcast: .22 },
};

// The city's depth. A strip is repainted palSteps times through each fade of the day, not at every step. Each strip slides at par of the camera's pace at scale, its foot base above the street; items
// come from seed (the old skylines reuse the first take of the city's far towers), sized w by h with gap between, lift
// leaving room for spires, headroom above that. haze fades a strip's colour into the sky skyAt down the screen, windows is how strongly
// unlit windows show, density how sharp it is painted (never wider than maxStrip pixels), lowQ keeps it on the low
// picture. litShare is how many windows light up at night. Midground homes take a stone, hazed by midHaze toward the
// far skyline, a striped awning, and at signChance a sign. Red lights blink (on of every blink seconds) on city roofs
// over minH and far towers over farH; twinkle turns per windows of each building on and off every period seconds;
// neon dips at flicker.rate unless hash stays under dip. Roofs get props of these kinds, kept clear of the customer.
// The foreground runs from the city's start to coastGap short of the coast, at par and scale, its foot drop below the
// street, items gap apart; it fades to fade within near of the aircraft or its order, and trees sway with the wind.
export const SKYLINE = {
  seed: 404, take: 16, maxStrip: 8192, headroom: 70, litShare: .3, skyAt: .62, palSteps: 4,
  layers: [
    { key: 'horizon', par: .1, scale: .8, base: 70, count: 16, w: [50, 110], h: [260, 520], gap: [4, 30], haze: .5, windows: .35, density: 1, lift: 1.3, kinds: ['flat', 'stepped', 'spire', 'antenna', 'crown'] },
    { key: 'far2', par: .25, scale: .9, base: 40, haze: .15, windows: .45, density: 1, lift: 1, lowQ: true },
    { key: 'far1', par: .5, scale: 1, base: 10, haze: 0, windows: .6, density: 1, lift: 1 },
    { key: 'mid', par: .72, scale: 1, base: 0, count: 14, w: [110, 190], h: [110, 230], gap: [14, 60], haze: 0, windows: .8, density: 1.5, lift: 1, lowQ: true },
  ],
  midStones: ['#c9a27e', '#b9b3a6', '#a7b4bf', '#c7a48f', '#d4b896', '#9fb0a3'], midHaze: .4, awnings: ['#e8492c', '#2f8f8a', '#d9a321', '#3f6fb0'],
  signs: ['HOTEL', 'CAFE', 'OPEN', 'BAKERY', 'CINEMA', 'MARKET', 'BOOKS', 'GYM'], neon: ['#ff5a8a', '#4fe0ff', '#ffd23d', '#7cff9a'], signChance: .4,
  light: { color: '#ff3b30', blink: 1.4, on: .35, minH: 300, farH: 220, size: 2.2 },
  twinkle: { per: 2, period: 7 }, flicker: { rate: 9, dip: .97 },
  flocks: { count: 3, birds: [3, 6], speed: 14, par: .15, top: .14, bottom: .3, color: 'rgba(40,40,60,.45)' },
  roof: { props: [2, 4], clear: 46, kinds: ['ac', 'vent', 'solar', 'hut', 'box', 'plant', 'antenna'], widths: { ac: 18, vent: 8, solar: 30, hut: 26, box: 10, plant: 22, antenna: 16 } },
  fg: {
    par: 1.35, scale: 1.35, drop: 70, gap: [520, 980], coastGap: 600, kinds: [['tree', .3], ['lamp', .3], ['sign', .15], ['bridge', .1], ['roof', .15]],
    widths: { tree: 110, lamp: 50, sign: 170, bridge: 520, roof: 360 }, heights: { tree: 232, lamp: 225, sign: 240, bridge: 205, roof: 265 },
    color: '#1d1824', tint: .4, alpha: .86, fade: .22, near: 90, sway: 4, swayWind: .02, swayRate: 1.3,
  },
};

// Gentle notes on what the weather does to the flight: gusts past gust of the mission's wind (and at least gustMin),
// a draft past draft, and for the first intro seconds the fog or the cold. A note shows once it has held for show
// seconds and lingers linger seconds after.
export const WEATHER_HINT = { gust: .75, gustMin: 120, draft: 110, show: .5, linger: 1.5, intro: 6 };

// The altimeter on the right edge: a coloured scale from the street (0) to max, w wide, right of the edge, from top
// below the HUD to bottom above the controls; it hides when shorter than minH. The goal's height shows as a tick, and
// chevrons show a climb or a drop, strongest at fastClimb px/s, hidden under still of that.
export const ALTIMETER = {
  max: 900, w: 7, right: 10, top: 64, bottom: 14, minH: 120, alpha: .85, fastClimb: 220, still: .12, up: '#7cff9a', down: '#ffb35c', goal: '#4fc27c',
  colors: [[0, '#e8492c'], [.1, '#ff9a3c'], [.28, '#ffd23d'], [.45, '#4fc27c'], [.7, '#3fb0c8'], [1, '#8a7cff']],
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
export const GROUND_BOX = { x: -2000, w: 49000, h: 200 };
// The drone stops at these, well inside the ground, so it can never fly off the end of the world.
export const EDGE = { left: -1000, right: 46800 };
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
  { name: 'Mountains', from: 33250, style: 'alpine', map: '#8a8f9a', stones: ['#8a8078'], winW: 12, winH: 16 },
  { name: 'Snowfield', from: 39950, style: 'snow', map: '#cfe3f2', stones: ['#9c6b44'], winW: 12, winH: 16 },
];

// The mountains past the forest. Crags are rock to deliver onto, huts are stone, and a cable car hangs between two
// pylons. Each draft is a column of air w wide pushing at v (negative lifts, positive sinks), fading toward its edges.
export const MOUNTAIN = {
  from: 33400, to: 39800, minDist: 1500, windBoost: 1.3, trafficGap: 2, targetLift: 11, seen: 360, idxGap: 400,
  kioskH: 130, kioskColor: '#8a8078', wallColor: '#8a8078', rockColor: '#7d7470', rockCap: '#b9b2a8',
  kiosks: [
    { x: 33700, shop: { name: 'Summit Cafe', items: ['coffee', 'kunafa'], glow: '#ffc23d' } },
    { x: 36550, shop: { name: 'Alpine Grill', items: ['pizza', 'falafel'], glow: '#ff5a3c' } },
    { x: 39350, shop: { name: 'Mountain Store', items: ['medicine', 'watermelon'], extra: ['supplies'], glow: '#4fc27c' } },
  ],
  crags: [{ x: 34300, w: 150, h: 300 }, { x: 35350, w: 200, h: 220 }, { x: 37400, w: 170, h: 340 }, { x: 38500, w: 220, h: 260 }],
  huts: [{ x: 34800, w: 160, h: 110 }, { x: 37950, w: 150, h: 100 }],
  cables: [{ a: 35750, b: 36400, ha: 260, hb: 180 }], camps: [36150, 39100],
  drafts: [{ x: 35100, w: 220, v: -260 }, { x: 37000, w: 200, v: 240 }, { x: 39000, w: 200, v: -220 }], draftTall: 300,
  pylonW: 8, pylonTop: 30, stationW: 70, sag: 40, riderRate: .25, hang: 18,
  rise: 600, ridgeStep: 22, ridgeLong: 260, snowLine: .72, capDepth: 90, haze: .45, farDrift: .18, farH: 380, farSwell: 70, farTeeth: 70, nearDrift: .4, nearH: 210, nearSwell: 40, nearTeeth: 34,
};

// The snowfield past the mountains: snowy pines from seed, chalets, a ski lift, igloos and frozen lakes. cold scales how
// fast the battery drains here. Its ground runs on to groundTo, past the end of the world.
export const SNOW = {
  from: 40100, to: 46500, groundTo: 49000, minDist: 1500, windBoost: 1.2, cold: 1.3, trafficGap: 2, targetLift: 11, seen: 360,
  kioskH: 120, kioskColor: '#9c6b44', wallColor: '#9c6b44',
  kiosks: [
    { x: 40400, shop: { name: 'Cocoa Hut', items: ['coffee', 'cake'], glow: '#c89a6a' } },
    { x: 43250, shop: { name: 'Chalet Grill', items: ['pizza', 'falafel'], glow: '#ff5a3c' } },
    { x: 46050, shop: { name: 'Village Store', items: ['medicine', 'flowers'], extra: ['supplies'], glow: '#4fc27c' } },
  ],
  chalets: [{ x: 41050, w: 160, h: 110 }, { x: 42400, w: 150, h: 120 }, { x: 44700, w: 170, h: 100 }],
  igloos: [42050, 45900], snowmen: [40850, 43050, 44350], lakes: [[41500, 41850], [45150, 45450]],
  lift: { a: 43750, b: 44500, ha: 150, hb: 250 },
  seed: 97, edge: 60, clear: 110, pineGap: 80, pineGapRange: 110, pineH: [150, 290], pineW: [60, 90],
  pylonW: 8, pylonTop: 30, stationW: 70, sag: 36, riderRate: .3, hang: 14,
  rise: 600, ridgeStep: 22, ridgeLong: 230, snowLine: .55, capDepth: 120, haze: .4, farDrift: .2, farH: 340, farSwell: 60, farTeeth: 60, nearDrift: .45, nearH: 170, nearSwell: 30, nearTeeth: 26,
};

// The forest past the desert. Pines grow from seed every pineGap to pineGap + pineGapRange,
// clear of the landmarks by clear; each is a trunk and tiers of needles whose solid core is narrower than the drawing.
// A treehouse deck juts out from its trunk under a crown, so its customer can be reached from beside the crown.
export const FOREST = {
  from: 26600, to: 33000, minDist: 1500, windBoost: 1.1, trafficGap: 1.8, targetLift: 11, seen: 320,
  kioskH: 120, kioskColor: '#8a5a3a', logColor: '#8a5a3a', barkColor: '#5a3a26', needles: '#2f6b45',
  kiosks: [
    { x: 26900, shop: { name: 'Ranger Station', items: ['coffee', 'medicine'], extra: ['supplies'], glow: '#4fc27c' } },
    { x: 29700, shop: { name: 'Lodge Kitchen', items: ['pizza', 'kunafa'], glow: '#ff8a3c' } },
    { x: 32500, shop: { name: 'Cake & Flowers', items: ['cake', 'flowers'], extra: ['vase'], glow: '#d97aa8' } },
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
  nearDrift: .55, nearH: 80, nearSwell: 18, nearTeeth: 22, mistH: 90, mistAlpha: .3, snowCap: .45,
};

// The open coast past the city. Sea spans are water to fall into; sand and the island are safe.
export const BEACH = {
  from: 14300, to: 19900, minDist: 900, windBoost: 1.25, splash: 240,
  sea: [[15050, 17000], [17560, 19200]],
  kiosks: [
    { x: 14560, shop: { name: 'Beach Store', items: ['coffee', 'watermelon'], extra: ['supplies'], glow: '#4fa3c2' } },
    { x: 17140, shop: { name: 'Island Grill', items: ['falafel', 'pizza'], glow: '#ff5a3c' } },
    { x: 19400, shop: { name: 'Gifts & Cakes', items: ['cake', 'flowers'], glow: '#d97aa8' } },
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
// and buggies and camels cross it.
export const DESERT = {
  from: 20000, to: 26300, minDist: 1600, windBoost: 1.4, trafficGap: 1.7, targetLift: 11, kioskH: 110, kioskColor: '#c9a06a', seen: 260,
  kiosks: [
    { x: 20320, shop: { name: 'Oasis Cafe', items: ['coffee', 'kunafa'], extra: ['icecream'], glow: '#4fa3c2' } },
    { x: 23040, shop: { name: 'Caravan Grill', items: ['falafel', 'pizza'], extra: ['icecream'], glow: '#ff5a3c' } },
    { x: 25760, shop: { name: 'Trading Post', items: ['medicine', 'watermelon'], extra: ['supplies'], glow: '#4fc27c' } },
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

// How much larger an order is drawn than the box it flies as, so its shape reads on a phone. ratio: the aircraft's drawn
// silhouette is at least this many times the order's, the order drawn smaller (never narrower than its box, kept on its
// bottom) where it would be more. bigRatio: an order still bigger than that at its box is too big for the aircraft, which
// never carries it; lend is the aircraft that flies such a mission instead. The box an order flies as never changes.
export const CARGO = { drawScale: 1.3, ratio: 2, bigRatio: 1.4, lend: 'courier' };

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
// span is half the drawn width, rotors included, in body units. grow draws a small airframe that many times larger about
// its feet (sole, the lowest drawn point, when it is not DRONE.radius), so it reads on a phone; how it flies and collides
// never changes. area is its drawn silhouette at scale 1 before grow (re-measure with look/d1/art.mjs when a drawing
// changes), so an order can be drawn in proportion to it.
// The aircraft is drawn scale times its body and belongs to the scene, but always reads: its rim is an edge of ink at
// rimIdle, the light or dark colour that stands out from what is behind it. Only when its paint comes close to that
// backdrop does the rim rise toward rimNear and the paint shift toward ink. near is the colour distance where that
// starts and far where it is full; every is how often the scene is read, in seconds. glow: a soft warm light behind an
// aircraft whose paint melts into a dark scene, width times its span across and flat of that down, at alpha times how far
// the rim has come up.
export const CONTRAST = {
  scale: 1.1, every: .2, near: .28, far: .08, rate: 2.5, rest: .02, tintLight: .3, tintDark: .16, rimPx: 1.5, rimIdle: .45, rimNear: .9, box: 170, midLight: .62,
  dark: '#141030', light: '#ffffff', groundGap: 18, skyline: 240, glow: { alpha: .32, width: 1.25, flat: .62, ink: '#ffeed2' },
};

export const AIRCRAFT = [
  { key: 'courier', span: 46, area: 1227, paint: '#e8492c', name: 'Courier', gear: 'arched', thrust: 1, speed: 1, battery: 1, tough: 1, hz: [92, 148], note: 'The all-rounder' },
  { key: 'miniFold', span: 43, grow: 1.15, area: 713, paint: '#8c97a6', name: 'Mini Fold', gear: 'stubs', thrust: 1.2, speed: .8, battery: 1.15, tough: .6, hz: [200, 310], note: 'Light and long-lived, but fragile' },
  { key: 'hexa', span: 48, area: 1417, paint: '#2f8f8a', name: 'Hexa H6', gear: 'tlegs', thrust: 1, speed: .9, battery: 1.25, tough: 1.3, hz: [105, 150], note: 'Steady, with six motors to spare' },
  { key: 'x8', span: 48, area: 1610, paint: '#4f5d75', name: 'X8 Cargo', gear: 'skids', thrust: .85, speed: 1, battery: 1, tough: 1.6, hz: [64, 90], note: 'Takes a beating, climbs slowly' },
  { key: 'fpv', span: 41, grow: 1.1, area: 854, paint: '#17171d', name: 'FPV Racer', gear: 'belly', thrust: 1.6, speed: 1.5, battery: .45, tough: .8, hz: [240, 640], note: 'Wild speed, tiny battery' },
  { key: 'heavy', span: 59, area: 1728, paint: '#d9a321', name: 'Heavy Lifter', gear: 'tall', thrust: 1.1, speed: .6, battery: .6, tough: 1.9, hz: [50, 70], note: 'Slow and short-ranged, nearly unbreakable' },
  { key: 'vtol', span: 40, area: 1020, paint: '#eef1f6', name: 'VTOL Wing', gear: 'retract', thrust: .8, speed: 1.7, battery: 1.4, tough: .7, hz: [130, 200], note: 'Fastest cruiser, weak climber' },
  { key: 'whoop', span: 40, area: 1143, paint: '#2f3540', name: 'Cinewhoop', gear: 'belly', thrust: 1.3, speed: 1.1, battery: .7, tough: 1.3, hz: [300, 600], note: 'Ducted props shrug off bumps' },
  { key: 'cage', span: 23, grow: 1.3, sole: 17, area: 623, paint: '#8b95a3', name: 'Cage Scout', gear: 'none', thrust: .95, speed: .7, battery: .8, tough: 1.5, hz: [180, 280], note: 'A roll cage for tight streets' },
  { key: 'agri', span: 45, area: 1274, paint: '#e9eef2', name: 'Agri Tanker', gear: 'tall', thrust: 1, speed: .7, battery: .75, tough: 1.7, hz: [58, 80], note: 'Farm-built, deep rumble' },
  { key: 'tandem', span: 43, area: 1348, paint: '#5a7fa6', name: 'Twin Tandem', gear: 'skids', thrust: 1.15, speed: .85, battery: .9, tough: 1.2, hz: [70, 105], note: 'Two big rotors, strong lifter' },
  { key: 'tilt', span: 36, area: 953, paint: '#d8dde6', name: 'Tiltrotor', gear: 'retract', thrust: .9, speed: 1.45, battery: 1.2, tough: .8, hz: [150, 240], note: 'Rotors swing forward at speed' },
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
  partPrices: [100, 220, 400], nudgeNames: 2,
  parts: [
    { key: 'motors', stat: 'thrust', gain: .06, name: 'Stronger motors', note: '+6% lift each' },
    { key: 'shell', stat: 'speed', gain: .06, name: 'Sleek shell', note: '+6% speed each' },
    { key: 'cells', stat: 'battery', gain: .1, name: 'Bigger battery', note: '+10% flying time each' },
    { key: 'frame', stat: 'tough', gain: .15, name: 'Reinforced frame', note: '+15% toughness each' },
  ],
};

// The player's score against a fixed ladder of pilots kept on this device. The ladder was set so a full 120 stars plus
// steady replays reach the top; missions 51-55 make 165 stars possible, and Chapter 2 makes 240, so its three pilots stand
// above the old top.
export const LEAGUE = {
  perStar: 100,
  perDelivery: 5,
  pilots: [
    ['Lina Haddad', 24500], ['Mateo Ruiz', 20000], ['Aiko T.', 16000], ['Jonas Becker', 12600], ['Priya N.', 11200], ['Omar Saleh', 9800], ['Sofia Marino', 8400], ['Daniel K.', 7000],
    ['Amara Okafor', 5800], ['Lucas Moreau', 4600], ['Yara M.', 3500], ['Ethan Brooks', 2500], ['Mei Chen', 1600], ['Noor R.', 800], ['Erik Lindqvist', 300],
  ],
};

// When a shop suggests another aircraft while it makes the order. An aircraft slower than chaseSpeed hears, on an
// avalanche stop and on the card of a mission with one, that Boost or a faster aircraft helps; one slower than boostFloor
// is caught even with Boost (or flattens its battery boosting), so it hears only to take a faster aircraft.
// previewEvery: seconds between pictures of the aircraft in the Shop's hangar, which need not keep up with the screen.
// tile: the canvas pixels of a hangar tile's picture; stageDpr caps the big preview's pixel ratio. The preview hovers bob
// body units every bobSecs seconds over a soft shadow floor body units below it, shadowW wide and shadowH tall. pitch: the
// sound label is the first entry whose limit is above the aircraft's idle hz (m.hz[0]). shadow is the floor shadow's
// colour. The big preview also fits stageFill of its width across the aircraft's span, so a wide one clears the name in
// its corner; a tile draws its aircraft at tileFill of the tile's height scale, tileDrop body units low, under the price
// that sits on the tile's top edge.
export const HANGAR = {
  heavyFrom: 1.8, fragileFrom: 1.6, windyFrom: 1.6, rotate: 3, chaseSpeed: 1, boostFloor: .65, tipGap: 10, previewHeight: 68, previewEvery: .05,
  tile: [240, 120], stageDpr: 2, bob: 3, bobSecs: 2.4, floor: 24, shadowW: 30, shadowH: 3.5, shadow: 'rgba(10,6,30,.28)', stageFill: .7, tileFill: .9, tileDrop: 4,
  pitch: [[90, 'Deep rumble'], [160, 'Steady hum'], [250, 'Light buzz'], [Infinity, 'High whine']],
};

// The front screen. The aircraft the player flies hovers in the room the menu leaves it (#menuStage), with a pizza
// swinging under it on a short rope: scaled to fill of that room across twice its span and down tall body units (the
// aircraft, rope and order together), never above maxScale; raise lifts it so the order hangs in the middle. It bobs bob
// body units every bobSecs, tilts tilt radians every tiltSecs, and the order swings swing radians every swingSecs on a
// rope of rope units, hanging hang units below it at cargo times its drawn size. A screen that asks for less motion gets
// it still. On an upright screen the street runs groundAt of the way down the choices, so the rooftops stand between the
// aircraft and the buttons rather than all behind them.
export const MENU = { fill: .62, maxScale: 4, tall: 80, raise: 19, bob: 3, bobSecs: 2.6, tilt: .05, tiltSecs: 3.4, swing: .14, swingSecs: 2.1, rope: 30, hang: 8, cargo: 1.1, order: 'pizza', ropeColor: '#1d1420', ropeWidth: 1.4, glow: 'rgba(255,194,61,.22)', glowSize: 1.6, groundAt: .45, swapSecs: 3.5, swapFade: .35 };
// A locked mission on the map shakes for shake seconds when tapped and names the mission to pass for hint seconds;
// buzz is the tap's buzz in ms.
export const LOCKS = { shake: .42, hint: 1.8, buzz: 12 };

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
// signs is how many marks stand beside a mission on the map. wrapSlack: pixels the map bar's last button may sit below
// the Shop button before it counts as wrapped to a new row.
// regions names where each generated mission flies, one letter a mission: C city, B beach, D desert, F forest,
// M mountains, S snowfield. The first ten visit every one; the Double Runs (12, 17, 22, 27, 32, 37) stay in the city.
export const LEVELS = { regions: 'CBCFDCBMCSFCDCBMCSCFDCBMSCCFDBCCMSBFCDCB', count: 40, seed: 2026, maxDist: 6500, resultDelay: 2, passDelay: 2.2, rowGap: 92, pathWave: .85, pathWidth: 30, balconyMaxSize: 1.3, wayMargin: 24, signs: 2, wrapSlack: 4 };

// The map's chapters after the first. Chapter n opens at mission from, its banner standing in gap extra pixels between
// that mission and the one before. Its card shows by itself once, the first time the chapter is open on the map (or
// before its first mission), and again whenever the banner is tapped; tags are its highlights, each with its map sign.
export const CHAPTERS = [{
  n: 2, from: 56, gap: 110, kicker: 'Chapter 2', name: 'Wild Skies', span: 'Missions 56-80', locked: 'Pass Mission 55 to open',
  intro: 'Twenty-five new missions across every region. The last one crosses four of them in one run.',
  tags: [['ferry', 'Moving customers'], ['rescue', 'Rescue runs'], ['relay', 'Orders handed on'], ['bullseye', 'Bullseye drops'], ['rival', 'A rival in every region'], ['gale', 'Gales and sandstorms']],
}];

// The result screen. tally is how long the money takes to run up, in milliseconds, after tallyDelay. tips answer each way
// of failing, by the words on the screen, and ruleTips answer a clock run out on a rescue or a bullseye stop.
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
    'MISSED A RING': 'Line up with the next ring early, then fly straight through',
    'THROUGH THE ICE': 'Keep the order off the ice. Fly high, and lower the rope only at the customer',
    'CAUGHT BY THE AVALANCHE': 'Keep moving and Boost on the straights. Drop straight onto the customer',
  },
  ruleTips: { rescue: 'Press Hold over them and keep still until the green ring closes', bullseye: 'Hover right over the mark, then lower the rope onto it' },
};

// The last missions, each with one rule of its own. map is where it flies, shop which of that map's shops it opens at,
// near and far how far off the customer is, and kinds which customers will do. stops names the rule of each order on
// a route. A mission with no stops is one order under the rule named by its key. legs overrides near, far, kinds or item
// for one stop of a route, lake picks the frozen lake of an ice stop, sign names the map sign when it is not the key,
// and wallSpeed sets the avalanche's speed for one mission.
// Chapter 2 (56-80) adds:
// - map as a list, for a route across regions listed west to east, where each leg names its own map and the first leg
//   takes the first;
// - ride and speed, a ferry's lane (FERRY.lanes) and its speed;
// - rescue, on a leg or the mission, which makes a stop a rescue (RESCUE);
// - on a leg, handOn: the last customer ties this order on, with no shop in between. It is never raced and never has rings;
// - place, the word for the customer's spot on the card and the HUD when the map's own word would mislead.
// Stop rules may also be:
// - sandstorm (the storm's gusts without rain or thunder; the desert's haze shows them);
// - gale (GALE);
// - hop (HOP);
// - bullseye (BULLSEYE);
// - rescue (a rescue and no other rule);
// - plain or race (no rule).
// A rescue is never also a storm or a sandstorm.
export const CHALLENGES = [
  { key: 'blackout', name: 'Blackout', note: 'Power cut. You only see what your lights reach', map: 'city', shop: 3, item: 'medicine', kinds: ['roof', 'bal'], near: 1500, far: 2600, hawks: 1, wind: 120 },
  { key: 'glass', name: 'Glass Cargo', note: 'One good knock and the vase is gone', map: 'city', shop: 4, item: 'vase', kinds: ['roof'], near: 900, far: 1700, hawks: 0, wind: 110, extra: 12 },
  { key: 'storm', name: 'Storm Front', note: 'Gusts swap sides every few seconds', map: 'city', shop: 5, item: 'watermelon', kinds: ['roof', 'bal'], near: 1400, far: 2400, hawks: 1, wind: 300, extra: 8 },
  { key: 'radar', name: 'Under the Radar', note: 'Stay below the red line or you are spotted', map: 'city', shop: 2, item: 'kunafa', kinds: ['roof'], near: 1600, far: 2600, hawks: 1, wind: 120, extra: 6 },
  { key: 'battery', name: 'Last Drops', note: '40% battery, no boost and a long way to go', map: 'city', shop: 1, item: 'falafel', kinds: ['roof'], near: 1900, far: 2500, hawks: 1, wind: 130, startBat: 40, noBoost: true, extra: 10 },
  { key: 'melt', name: 'Melting Point', note: 'Ice cream in the desert. Melted means failed', map: 'desert', shop: 0, item: 'icecream', kinds: ['rock'], near: 1200, far: 2500, hawks: 1, wind: 170 },
  { key: 'ferry', name: 'Ferry Drop', note: 'The customer is on a moving ferry. Hold rides along', map: 'beach', shop: 0, item: 'coffee', hawks: 1, wind: 150, extra: 14 },
  { key: 'hawks', name: 'Hawk Season', note: 'Six hawks on the way. Shield the order with your aircraft', map: 'city', shop: 2, item: 'kunafa', kinds: ['roof'], near: 2400, far: 3400, hawks: 6, eagles: 1, wind: 140, extra: 10 },
  { key: 'rope', name: 'Long Line', note: 'Double rope. Fly high, the load hangs far below you', map: 'city', shop: 8, item: 'pizza', kinds: ['roof'], near: 1500, far: 2600, hawks: 1, wind: 150, rope: 130, extra: 10 },
  { key: 'finale', name: 'City Finale', note: 'A storm, then a blackout, then a race', map: 'city', shop: 7, stops: ['storm', 'blackout', 'race'], kinds: ['roof', 'bal'], near: 900, far: 1700, hawks: 2, eagles: 1, wind: 220, rival: true, rivalSpeed: 160, extra: 12 },
  { key: 'gates', name: 'Canopy Gates', note: 'Fly through every ring over the pines, in order', map: 'forest', shop: 1, item: 'pizza', kinds: ['cabin'], near: 2100, far: 2600, hawks: 1, wind: 170, extra: 10 },
  { key: 'jet', name: 'Jet Stream', note: 'Above the line the wind carries you. Below it, it fights you', map: 'mountain', shop: 2, item: 'medicine', kinds: ['crag'], near: 3800, far: 4300, hawks: 2, wind: 400, extra: 4 },
  { key: 'avalanche', name: 'Avalanche', note: 'An avalanche is right behind you. Keep moving', map: 'mountain', shop: 0, item: 'coffee', kinds: ['crag'], near: 3500, far: 4000, hawks: 2, wind: 180, wallSpeed: 200, extra: 10 },
  { key: 'ice', name: 'Thin Ice', note: 'Low rotors crack the ice. Stay above the line and lower the rope', map: 'snow', shop: 1, item: 'pizza', lake: 0, hawks: 1, wind: 180, extra: 10 },
  {
    key: 'grand', sign: 'finale', name: 'Grand Finale', note: 'Rings, thin ice, then outrun the avalanche', map: 'snow', shop: 0, stops: ['gates', 'ice', 'avalanche'], kinds: ['chalet'],
    legs: [{ near: 1800, far: 2100 }, {}, { near: 4800, far: 5200 }], lake: 1, hawks: 2, wind: 200, wallSpeed: 198, extra: 10,
  },
  // Chapter 2
  { key: 'peakRace', sign: 'rival', name: 'Peak Race', note: 'A rival races you to the crag. Fly straight and fast', map: 'mountain', shop: 1, stops: ['race'], item: 'pizza', kinds: ['crag'], near: 1800, far: 3000, hawks: 1, wind: 200, rival: true, rivalSpeed: 200, extra: 6 },
  { key: 'sandstorm', name: 'Sandstorm', note: 'Gusts swap sides and the sand hides the way', map: 'desert', shop: 1, item: 'pizza', kinds: ['rock'], near: 1100, far: 2000, hawks: 1, wind: 240, extra: 8 },
  { key: 'relay', name: 'Pass It On', note: 'The customer hands you the next order. No shop in between', map: 'city', shop: 2, stops: ['plain', 'plain'], item: 'cake', kinds: ['roof'], near: 1000, far: 1800, legs: [{}, { item: 'flowers', handOn: true }], hawks: 1, wind: 150, extra: 6 },
  { key: 'ferryChase', sign: 'ferry', name: 'Ferry Chase', note: 'A faster ferry in the far bay. Wait ahead of it, then Hold', map: 'beach', shop: 1, stops: ['ferry'], item: 'falafel', ride: 'far', speed: 80, hawks: 1, wind: 160, extra: 14 },
  { key: 'nightRescue', sign: 'rescue', name: 'Night Rescue', note: 'Follow the arrow to the flare in the fog. Hold steady, race on', map: 'forest', shop: 0, stops: ['rescue', 'race'], item: 'supplies', kinds: ['lookout'], near: 1800, far: 2600, legs: [{}, { item: 'pizza', kinds: ['cabin'], near: 1800, far: 2600 }], hawks: 1, wind: 170, rival: true, rivalSpeed: 205, extra: 8 },
  { key: 'bullseye', name: 'Bullseye', note: 'Set the order down on the small mark. Hold steady', map: 'snow', shop: 0, item: 'coffee', kinds: ['chalet'], near: 500, far: 1200, hawks: 0, wind: 110, extra: 10 },
  { key: 'hopper', sign: 'hop', name: 'Rooftop Hopper', note: 'The customer moves twice on the way. Follow the arrow', map: 'city', shop: 7, stops: ['hop'], item: 'coffee', kinds: ['roof'], near: 1800, far: 2400, hawks: 1, wind: 160, extra: 4 },
  { key: 'stayLow', sign: 'radar', name: 'Stay Low', note: 'Stay under the red line, between the mesas', map: 'desert', shop: 0, stops: ['radar'], item: 'kunafa', kinds: ['rock'], near: 1500, far: 2400, hawks: 1, wind: 200, extra: 6 },
  { key: 'islandRescue', sign: 'rescue', name: 'Island Rescue', note: 'Supplies to the island in the rain. Hold steady over them', map: 'beach', shop: 0, stops: ['rescue'], item: 'supplies', kinds: ['sand'], place: 'Island', near: 2000, far: 3000, hawks: 1, wind: 220, extra: 8 },
  { key: 'darkWoods', sign: 'blackout', name: 'Dark Woods', note: 'Lights out in the pines. Two drops by your own lights', map: 'forest', shop: 0, stops: ['blackout', 'blackout'], item: 'coffee', kinds: ['treehouse'], near: 1200, far: 1800, legs: [{}, { item: 'pizza', kinds: ['cabin'], near: 2100, far: 2600 }], hawks: 1, wind: 150, extra: 6 },
  { key: 'snowRelay', sign: 'relay', name: 'Snow Relay', note: 'Two chalets, one order handed on to the next', map: 'snow', shop: 1, stops: ['plain', 'plain'], item: 'pizza', kinds: ['chalet'], near: 1000, far: 1600, legs: [{}, { item: 'cake', handOn: true, near: 1800, far: 2600 }], hawks: 0, wind: 120, extra: 6 },
  { key: 'gale', name: 'Peak Gale', note: 'A gale in your face all the way to the crag', map: 'mountain', shop: 0, item: 'kunafa', kinds: ['crag'], near: 1400, far: 2000, hawks: 1, wind: 360, extra: 10 },
  { key: 'rooftopDuel', sign: 'bullseye', name: 'Rooftop Duel', note: 'A small mark first, then race a rival to a moving customer', map: 'city', shop: 2, stops: ['bullseye', 'hop'], item: 'kunafa', kinds: ['roof'], near: 1600, far: 2400, legs: [{}, { item: 'flowers', near: 1800, far: 2600 }], hawks: 1, wind: 170, rival: true, rivalSpeed: 210, extra: 6 },
  { key: 'seaDuel', sign: 'rival', name: 'Sea Duel', note: 'A rival races you out to the boats', map: 'beach', shop: 2, stops: ['race'], item: 'cake', kinds: ['boat'], near: 1200, far: 2200, hawks: 1, wind: 200, rival: true, rivalSpeed: 205, extra: 6 },
  { key: 'caravan', sign: 'sandstorm', name: 'Caravan Run', note: 'A sandstorm, an order handed on, then a race', map: 'desert', shop: 0, stops: ['sandstorm', 'plain', 'race'], item: 'coffee', kinds: ['rock'], near: 1200, far: 2000, legs: [{}, { item: 'kunafa', handOn: true, kinds: ['rock', 'oasis'], near: 1000, far: 2200 }, { item: 'pizza', near: 1400, far: 2400 }], hawks: 1, wind: 230, rival: true, rivalSpeed: 215, extra: 8 },
  { key: 'highLine', sign: 'rope', name: 'High Line', note: 'Double rope. Lower the order down to the lookout', map: 'forest', shop: 0, stops: ['rope'], item: 'medicine', kinds: ['lookout'], near: 1800, far: 2600, hawks: 0, wind: 130, rope: 130, extra: 10 },
  { key: 'avalancheRescue', sign: 'avalanche', name: 'Avalanche Rescue', note: 'Supplies to the crag, an avalanche behind. Hold steady there', map: 'mountain', shop: 2, stops: ['avalanche'], item: 'supplies', kinds: ['crag'], near: 3500, far: 4500, rescue: true, hawks: 2, wind: 180, wallSpeed: 200, extra: 10 },
  { key: 'whiteoutDuel', sign: 'rival', name: 'Whiteout Duel', note: 'A rival races you through the snow fog', map: 'snow', shop: 2, stops: ['race'], item: 'flowers', kinds: ['station'], near: 1200, far: 2000, hawks: 1, wind: 170, rival: true, rivalSpeed: 220, extra: 6 },
  { key: 'blackoutRelay', sign: 'blackout', name: 'Blackout Relay', note: 'A power cut, and the order is handed on in the dark', map: 'city', shop: 8, stops: ['blackout', 'blackout'], item: 'pizza', kinds: ['roof'], near: 1200, far: 2000, legs: [{}, { item: 'falafel', handOn: true, near: 1000, far: 1800 }], hawks: 1, wind: 170, extra: 6 },
  { key: 'roughSea', sign: 'ferry', name: 'Rough Sea', note: 'Rain, a strong wind and a fast ferry. Hold rides along', map: 'beach', shop: 0, stops: ['ferry'], item: 'watermelon', ride: 'near', speed: 90, hawks: 1, wind: 260, extra: 12 },
  { key: 'glassLodge', sign: 'glass', name: 'Glass in the Pines', note: 'A glass vase up to a treehouse. Mind the branches', map: 'forest', shop: 2, stops: ['glass'], item: 'vase', kinds: ['treehouse'], near: 700, far: 1500, hawks: 0, wind: 110, extra: 12 },
  { key: 'scorcher', sign: 'melt', name: 'Scorcher', note: 'Ice cream in the heat, then a race to the rocks', map: 'desert', shop: 1, stops: ['melt', 'race'], item: 'icecream', kinds: ['rock'], near: 2100, far: 2300, legs: [{}, { item: 'watermelon', near: 1400, far: 2400 }], hawks: 1, wind: 220, rival: true, rivalSpeed: 225, extra: 6 },
  { key: 'iceRescue', sign: 'ice', name: 'Stranded on the Ice', note: 'Supplies to the frozen lake at night. Stay high, hold steady', map: 'snow', shop: 2, stops: ['ice'], item: 'supplies', lake: 0, rescue: true, hawks: 2, wind: 200, extra: 10 },
  { key: 'summitDuel', sign: 'jet', name: 'Summit Duel', note: 'Ride the jet stream to beat the rival to the far crag', map: 'mountain', shop: 0, stops: ['jet'], item: 'kunafa', kinds: ['crag'], near: 4400, far: 5000, hawks: 2, wind: 360, rival: true, rivalSpeed: 205, extra: 4 },
  {
    key: 'longHaul', sign: 'finale', name: 'The Long Haul', note: 'Sea to summit: a ferry, a sandstorm, rings, an avalanche', map: ['beach', 'desert', 'forest', 'mountain'], shop: 1,
    stops: ['ferry', 'sandstorm', 'gates', 'avalanche'], item: 'pizza', ride: 'far', speed: 80, kinds: ['rock'],
    legs: [{}, { map: 'desert', item: 'kunafa', near: 3500, far: 4500 }, { map: 'forest', item: 'medicine', kinds: ['lookout', 'cabin'], near: 1800, far: 2600 }, { map: 'mountain', item: 'kunafa', kinds: ['crag'], near: 3400, far: 4000 }],
    hawks: 2, wind: 240, wallSpeed: 205, extra: 4,
  },
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

// The ferry works the bay between from and to, with the customer on its open deck. A mission may send it along another
// lane (lanes, named by the mission's ride) and at its own speed; near is this bay's own ends, far is the second bay,
// past the island. The boats moored along a named lane are away for that mission (seaside.js clearBay), so their masts
// never catch the order while it rides along.
export const FERRY = { from: 15520, to: 16880, speed: 62, w: 190, deckH: 30, bow: 18, draft: 10, stripe: 9, stripeH: 6, cabinAt: 14, cabinW: 56, cabinH: 34, targetLift: 11, start: 16200, lanes: { near: {}, far: { from: 17660, to: 18900, start: 18300 } } };

// Rings on a route: count of them from from to to of the way, each at a height band above the ground taken in turn and
// lifted to clear anything within span of it by clear. Passing within reach of the next one counts it. On a screen
// narrower than narrow the HUD marks the ring count instead of naming it.
export const GATES = {
  count: 4, from: .15, to: .75, span: 100, clear: 140, bands: [220, 340], reach: 46, narrow: 360,
  line: 4, thin: .6, pulse: 4, pulseRate: 5, text: 12, popLift: 34, popColor: '#7fe0a8',
  done: 'rgba(79,194,124,.5)', next: '255,194,61', nextAlpha: .55, later: 'rgba(255,255,255,.55)', shadow: 'rgba(20,15,40,.7)',
};

// The jet stream's line stands gap above the route's radar line. Above it the wind blows toward the customer at the
// mission's wind, below it headShare of that blows back. band is how deep the streaks above the line reach, and popGap
// how far the label keeps from any words that pop up and from the pointer.
export const JET = {
  gap: 40, headShare: .6, line: 3, dash: 18, dashRate: 90, text: 12, edge: 10, popGap: 4, color: '#8fd8ff',
  band: 260, streaks: 22, streakLong: 44, streakDrift: 1.4, streak: 'rgba(210,240,255,.35)',
};

// An angler on a frozen lake reaches up for the order lift above the ice. While an order is on the rope, rotor wash
// closer than wash to the ice cracks it: grace seconds of it and the ice gives, and the cracks heal at fade a second.
// A creak sounds every creak seconds of cracking, and the zone's edge and label turn alert while it cracks.
export const THIN_ICE = {
  lift: 48, wash: 200, grace: 1.8, fade: 1, creak: .5, hole: 16, holeAt: -14, holeColor: '#1d3550',
  line: 3, dash: 14, dashRate: 30, text: 12, edge: 8, color: '#bfe6ff', zoneTop: 'rgba(191,230,255,0)', zoneBottom: 'rgba(191,230,255,.16)', zoneAlert: 'rgba(255,255,255,.32)',
  alert: '#ff7a5c', cracks: 6, crackLong: 70, crackColor: 'rgba(255,255,255,.9)',
};

// The avalanche waits delay seconds, behind pixels behind the shop, then rolls after the order at speed (a mission may set
// its own wallSpeed). It spends itself on the climb: over its last spend pixels it slows at a steady rate and comes to
// rest rest pixels short of the customer, so the race is on the way and the handover is never rushed. Within cue of it
// the camera rumbles, less as it slows; off screen its cue turns warn inside twice cue while it still rolls.
export const AVALANCHE = {
  behind: 450, delay: 1.5, speed: 200, spend: 400, rest: 200, cue: 400, rumble: 1.5, dust: 300,
  haze: .9, puff: '#f4f8fc', puffs: 9, puffR: [40, 70], roll: 3, spray: 14, sprayRate: 120, sprayReach: 80, text: 12, edge: 10, warn: '#ff7a5c',
};

// A bullseye drop counts only with the order within reach of the customer, on Hold or not (any other drop counts within
// DELIVERY.reach, holdReach on Hold). Its mark lies flat, drop under the customer: rings of red and white at rings times
// the reach, squashed by flat; while the order is near but not on the mark the outer ring turns off and pulses at blink.
export const BULLSEYE = { reach: 12, drop: 11, rings: [1.25, .85, .45], flat: .35, red: '#e8492c', white: '#fff3df', off: '#ffe14d', blink: 8 };

// A rescue: the stranded customer unclips the supplies while the aircraft holds steady over them for hold seconds (any
// other handover takes DELIVERY.holdTime). Their flare stands at beside them (on the side away from a beach umbrella),
// drop under the spot: a red stick stick tall and stickW wide with a glow glow wide flickering by flickerShare at flicker,
// and soft puffs of smoke rising rise over life seconds as they swell from r[0] to r[1] and fade from alpha, gone before
// they reach the aircraft holding over them, leaning drift with the full wind; half the puffs on the low picture, none
// while the flare is more than reach pixels off screen.
export const RESCUE = { hold: 2.5, at: -32, drop: 11, puffs: 8, life: 3, rise: 150, drift: 60, r: [8, 30], alpha: .85, smoke: '#ffb3a0', color: '#ff5a3c', stick: 10, stickW: 3, glow: 26, flicker: 11, flickerShare: .2, reach: 140 };

// A gale blows against the order the whole way, between floor and all of the mission's wind, swelling at rate; the
// mission's own wind takes over again keep seconds after the gale stop. Streaks of it cross the screen (half on the low
// picture), long px long and width wide, carried at drift of the wind.
export const GALE = { floor: .7, rate: .5, keep: 1, streaks: 24, long: 80, width: 2, drift: 1.6, color: 'rgba(255,255,255,.7)' };

// A hopping customer steps over, as a surprise move does (SURPRISE.move), once the order is each share of at the way out.
export const HOP = { at: [.3, .55] };

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
  note: { gap: 10, edge: 58, h: 26, tall: 42, padX: 14, radius: 12, title: 12.5, sub: 11, titleY: 14, subY: 29, fill: 'rgba(16,12,36,.42)', shake: 4, rate: 46, clear: 8 },
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
    buggy: { length: 56, height: 28 }, camel: { length: 58, height: 42, lane: 15 }, jeep: { length: 58, height: 30 }, deer: { length: 46, height: 38, lane: 15 }, goat: { length: 40, height: 32, lane: 15 }, sled: { length: 60, height: 28 },
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
// prep is how many seconds the shop needs to make the order; price is what ruining it costs. art is the drawing at scale 1:
// its width, silhouette area and lowest point (re-measure with look/d1/art.mjs when a drawing changes); size and weight
// still set how it flies.
export const ITEMS = {
  pizza: { key: 'pizza', price: 10, prep: 7, label: 'Pizza', weight: 1, size: 1, fragile: 1, heat: 1, wind: 1, art: [28, 412, 7] },
  falafel: { key: 'falafel', price: 6, prep: 3.5, label: 'Falafel', weight: .8, size: .8, fragile: .6, heat: .9, wind: .9, art: [22, 379, 11.4] },
  kunafa: { key: 'kunafa', price: 12, prep: 5.5, label: 'Kunafa', weight: 1.1, size: 1.1, fragile: 1.2, heat: 1.1, wind: 1, art: [31, 448, 11] },
  coffee: { key: 'coffee', price: 4, prep: 2.5, label: 'Coffee', weight: .6, size: .6, fragile: 1.6, heat: 1.4, wind: .8, art: [27, 447, 9.5] },
  cake: { key: 'cake', price: 14, prep: 4.5, label: 'Cake', weight: 1, size: 1, fragile: 2, heat: 0, wind: 1.1, art: [30, 450, 11.9] },
  medicine: { key: 'medicine', price: 8, prep: 1.5, label: 'Medicine', weight: .3, size: .5, fragile: .5, heat: 0, wind: .7, urgent: true, art: [26, 478, 9.5] },
  flowers: { key: 'flowers', price: 9, prep: 3, label: 'Flowers', weight: .4, size: .9, fragile: 1.3, heat: 0, wind: 1.8, art: [27.8, 486, 12] },
  watermelon: { key: 'watermelon', price: 5, prep: 2, label: 'Watermelon', weight: 1.8, size: 1, fragile: .7, heat: 0, wind: .5, art: [29, 489, 10.5] },
  tv: { key: 'tv', price: 30, prep: 4, label: 'TV', weight: 2, size: 1.6, fragile: 1.8, heat: 0, wind: 1.6, art: [27, 513, 9.5] },
  vase: { key: 'vase', price: 35, prep: 3, label: 'Glass Vase', weight: .6, size: .9, fragile: 6, heat: 0, wind: 1.2, art: [19.4, 347, 11.5] },
  // spoils: losing all its heat ruins this one, and the word says how
  icecream: { key: 'icecream', price: 7, prep: 2, label: 'Ice Cream', weight: .5, size: .8, fragile: .8, heat: 3, wind: .9, spoils: 'Melted', art: [17.9, 312, 15] },
  // supplies for someone stranded: a roped crate that flies like a pizza, with nothing to keep warm
  supplies: { key: 'supplies', price: 12, prep: 2, label: 'Supplies', weight: 1, size: 1, fragile: .6, heat: 0, wind: .8, art: [26, 465, 9] },
};

// How much a load above or below pizza weight changes lift and battery use.
export const LOAD = { thrustLoss: .12, drainGain: .35 };

export const SHOPS = [
  { name: 'Pizza', items: ['pizza'], glow: '#ff5a3c' },
  { name: 'Falafel', items: ['falafel'], glow: '#7cc28f' },
  { name: 'Sweets', items: ['kunafa', 'cake'], glow: '#f2a65a' },
  { name: 'Pharmacy', items: ['medicine'], glow: '#4fc27c' },
  { name: 'Flowers', items: ['flowers'], extra: ['vase'], glow: '#d97aa8' },
  { name: 'Fruit & Veg', items: ['watermelon'], glow: '#9bd14f' },
  { name: 'Electronics', items: ['tv'], glow: '#4fa3c2' },
  { name: 'Café', items: ['coffee'], glow: '#c89a6a' },
];

// One day: each time holds, then fades into the next. lit = window colours for off, dim and bright.
// Sky stops must line up across times so they can blend; discCut is how much of the disc is shaded.
// Missions open in daylight and the day turns on from there; the missions in sunset and night open at those hours.
export const CLOCK = { hold: 120, fade: 20, steps: 16, startAt: 2, sunset: [9, 18, 27, 36, 45, 57, 69, 76], night: [19, 29, 39, 49, 60, 78] };
export const TIMES = [
  {
    name: 'Sunset', sky: [[0, '#140f2a'], [.45, '#3b2452'], [.8, '#b4505a'], [1, '#f0a259']],
    stars: .7, cloud: '#ffd2c2', cloudShade: '#b9788c', cloudAlpha: .85, disc: '#fff1d0', discShade: '#3b2452', discCut: 1, far1: '#3d2849', far2: '#2c1d40', sea: '#7a4a6e', sand: '#b98a6a', moss: '#4a5a3a', peakFar: '#6a5070', peakNear: '#5a4a58', snowCap: '#f0d0d8', scree: '#6e5f63', snowFar: '#c9a9c0', snowNear: '#e8c8d4', snowGround: '#f3dfe4', ice: '#9fa8d0', hill: '#5e4a6e', pineFar: '#40384f', pineNear: '#2e3040', mistTone: '255,214,200', dune: '#c08a5e', duneNear: '#a56c58', duneFar: '#8a585e',
    ground: '#2a1d2c', walk: '#3a2c33', light: 1, lit: ['#4a3a52', '#f2a65a', '#ffd27a'], extraLit: 0, windowGlow: 0, signGlow: .5,
  },
  {
    name: 'Night', sky: [[0, '#05060f'], [.45, '#0b0f28'], [.8, '#171d40'], [1, '#232a52']],
    stars: 1, cloud: '#6f7aa6', cloudShade: '#383f68', cloudAlpha: .55, disc: '#e8ecff', discShade: '#0a0e26', discCut: 1, far1: '#141a38', far2: '#0e1228', sea: '#141c3e', sand: '#45424f', moss: '#1d2a26', peakFar: '#232845', peakNear: '#1a1e33', snowCap: '#9aa4c8', scree: '#2a2a36', snowFar: '#4a5478', snowNear: '#6c78a0', snowGround: '#8a94b8', ice: '#3c4c78', hill: '#1b2140', pineFar: '#141a2e', pineNear: '#0e1422', mistTone: '150,165,210', dune: '#4a4552', duneNear: '#2f2e4a', duneFar: '#20233f',
    ground: '#10131f', walk: '#1a1c2a', light: .48, lit: ['#1f2233', '#e8a24f', '#ffd884'], extraLit: .22, windowGlow: 1, signGlow: .75,
  },
  {
    name: 'Day', sky: [[0, '#3f8fd6'], [.45, '#7db8e8'], [.8, '#b9dcef'], [1, '#eaf4f2']],
    stars: 0, cloud: '#ffffff', cloudShade: '#b4c3da', cloudAlpha: 1, disc: '#fff3c4', discShade: '#7db8e8', discCut: 0, far1: '#9db8cc', far2: '#b7cddd', sea: '#3f9fc8', sand: '#e8d6a8', moss: '#5f7f45', peakFar: '#8fa3b8', peakNear: '#6f8092', snowCap: '#ffffff', scree: '#8a8478', snowFar: '#dce8f2', snowNear: '#f2f7fc', snowGround: '#f4f8fc', ice: '#a8d4ec', hill: '#9cb4bc', pineFar: '#6a927a', pineNear: '#467556', mistTone: '255,255,255', dune: '#e9c98c', duneNear: '#ddb274', duneFar: '#e6c693',
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
  // the notice naming the next stop waits this long after a delivery, so the tip and a perfect drop read first
  noticeWait: 1,
};

// Who lives at each customer spot. city: a home's sign, then who calls from it; country: the household, then who calls.
// A caller is Mr. or Ms. (titles, which also picks a man's or a woman's voice), a first name and maybe a family name; a
// couple's two take turns from order to order. Seda (in The Haugens' old place) is mission 2's customer. pins:
// [mission, stop, sign] put the owner's names on the first missions; the rest go out by x, so one spot keeps one name
// everywhere. regulars: [sign, name] of the households that call the most, share of all missions with one of them as a
// customer, at their own home or calling from another spot. plate: the name under the customer while the order is on board,
// kept side pixels in from the left edge and clear of the altimeter's scale on the right.
// No first or family name here is one of the High Score pilots in LEAGUE, or a short form of one.
export const HOMES = {
  city: [["Tara's House", 'Ms. Tara'], ['Bill & Louise Home', 'Ms. Louise', 'Mr. Bill'], ["Fuaat's Place", 'Mr. Fuaat'], ["Elisabeth's", 'Ms. Elisabeth'], ["Hannah's House", 'Ms. Hannah'],
    ['The Millers', 'Ms. Anna Miller'], ["Walid's House", 'Mr. Walid'], ["Yuki's Place", 'Ms. Yuki'], ['The Garcias', 'Ms. Carmen Garcia'], ["Noah's", 'Mr. Noah'], ['Kavya & Dev Home', 'Ms. Kavya', 'Mr. Dev'],
    ["Lena's House", 'Ms. Lena'], ['The Adeyemis', 'Mr. Chidi Adeyemi'], ["Emilio's Place", 'Mr. Emilio'], ["Grace's", 'Ms. Grace'], ['The Nguyens', 'Ms. Linh Nguyen'], ["Karim's House", 'Mr. Karim'],
    ['Tom & Ellie Home', 'Ms. Ellie', 'Mr. Tom'], ["Ingrid's Place", 'Ms. Ingrid'], ["Samir's", 'Mr. Samir'], ['The Kowalskis', 'Ms. Marta Kowalski'], ["Aisha's House", 'Ms. Aisha'], ["Julien's Place", 'Mr. Julien'],
    ['The Khourys', 'Mr. Rami Khoury'], ["Rin's", 'Ms. Rin'], ['Jack & Rosa Home', 'Ms. Rosa', 'Mr. Jack'], ["Freya's House", 'Ms. Freya'], ["Diego's", 'Mr. Diego'], ['The Andersens', 'Ms. Mette Andersen'],
    ["Leila's Place", 'Ms. Leila'], ["Ben's House", 'Mr. Ben'], ['The Rossis', 'Ms. Giulia Rossi'], ["Zuri's", 'Ms. Zuri'], ["Hugo's Place", 'Mr. Hugo'], ['Sam & Nadia Home', 'Ms. Nadia', 'Mr. Sam'],
    ["Chloe's House", 'Ms. Chloe'], ['The Silvas', 'Ms. Ana Silva'], ["Arjun's", 'Mr. Arjun'], ["Maya's Place", 'Ms. Maya'], ['The Brandts', 'Mr. Paul Brandt'], ["Zainab's House", 'Ms. Zainab'],
    ["Oscar's", 'Mr. Oscar'], ['Kofi & Efua Home', 'Ms. Efua', 'Mr. Kofi'], ["Clara's Place", 'Ms. Clara'], ['The Tanakas', 'Mr. Hiro Tanaka'], ["Youssef's House", 'Mr. Youssef'], ["Isla's", 'Ms. Isla'],
    ['The Dubois', 'Ms. Claire Dubois'], ["Felix's Place", 'Mr. Felix'], ["Nora's House", 'Ms. Nora'], ['Max & Lily Home', 'Ms. Lily', 'Mr. Max'], ["Tariq's", 'Mr. Tariq'], ['The Schmidts', 'Mr. Moritz Schmidt'],
    ["Elena's Place", 'Ms. Elena'], ["Ravi's House", 'Mr. Ravi'], ["The O'Briens", "Mr. Sean O'Brien"], ["Mila's", 'Ms. Mila'], ["Adam's Place", 'Mr. Adam'], ['The Petrovs', 'Mr. Ivan Petrov'],
    ["Salma's House", 'Ms. Salma'], ['Leo & Vera Home', 'Ms. Vera', 'Mr. Leo'], ["Jonah's", 'Mr. Jonah'], ["Ines's Place", 'Ms. Ines'], ['The Parks', 'Mr. Min Park'], ["Rania's House", 'Ms. Rania'],
    ["Theo's", 'Mr. Theo'], ['The Costas', 'Mr. Nikos Costa'], ["Olga's Place", 'Ms. Olga'], ["Ahmed's House", 'Mr. Ahmed'], ['Raj & Mira Home', 'Ms. Mira', 'Mr. Raj'], ["Astrid's", 'Ms. Astrid'],
    ['The Berglunds', 'Ms. Sara Berglund'], ["Kai's Place", 'Mr. Kai'], ["Rosie's House", 'Ms. Rosie']],
  country: [['Kenji', 'Mr. Kenji'], ['Lucia', 'Ms. Lucia'], ['Ali & Huda', 'Ms. Huda', 'Mr. Ali'], ['Seda', 'Ms. Seda'], ['Marco', 'Mr. Marco'], ['Ayla', 'Ms. Ayla'], ['Pedro', 'Mr. Pedro'],
    ['Esther', 'Ms. Esther'], ['The Mensahs', 'Mr. Kwame Mensah'], ['Dalia', 'Ms. Dalia'], ['Finn', 'Mr. Finn'], ['Jade & Ray', 'Ms. Jade', 'Mr. Ray'], ['Hamza', 'Mr. Hamza'], ['Selin', 'Ms. Selin'],
    ['The Girards', 'Mr. Remy Girard'], ['Ola', 'Ms. Ola'], ['Bruno', 'Mr. Bruno'], ['Keira', 'Ms. Keira'], ['Nils', 'Mr. Nils'], ['The Bakers', 'Ms. June Baker'], ['Farah', 'Ms. Farah'], ['Ezra', 'Mr. Ezra'],
    ['Imani', 'Ms. Imani'], ['Pablo', 'Mr. Pablo'], ['Rui & Joana', 'Ms. Joana', 'Mr. Rui'], ['Sven', 'Mr. Sven'], ['Hiba', 'Ms. Hiba'], ['Anton', 'Mr. Anton'], ['Talia', 'Ms. Talia'],
    ['The Kims', 'Ms. Jisoo Kim'], ['Emil', 'Mr. Emil'], ['Zara', 'Ms. Zara'], ['Lorenzo', 'Mr. Lorenzo'], ['Sakura', 'Ms. Sakura'], ['The Novaks', 'Ms. Petra Novak'], ['Idris', 'Mr. Idris'], ['Bea', 'Ms. Bea'],
    ['Rasha', 'Ms. Rasha'], ['Rafael', 'Mr. Rafael'], ['Tim & Ada', 'Ms. Ada', 'Mr. Tim'], ['Signe', 'Ms. Signe'], ['Malik', 'Mr. Malik'], ['Ruth', 'Ms. Ruth'], ['The Fischers', 'Ms. Greta Fischer'],
    ['Elif', 'Ms. Elif'], ['Joaquin', 'Mr. Joaquin'], ['Amina', 'Ms. Amina'], ['Otto', 'Mr. Otto'], ['The Ortegas', 'Ms. Lola Ortega'], ['Soren', 'Mr. Soren'], ['Naomi', 'Ms. Naomi'], ['Bilal', 'Mr. Bilal'],
    ['The Holms', 'Mr. Karl Holm'], ['Iris', 'Ms. Iris'], ['Tomas', 'Mr. Tomas']],
  titles: { 'Mr.': 'm', 'Ms.': 'f' },
  pins: [[1, 0, "Tara's House"], [3, 0, 'Bill & Louise Home'], [6, 0, "Elisabeth's"], [6, 1, "Hannah's House"], [9, 0, "Fuaat's Place"]],
  regulars: { list: [["Tara's House", 'Tara'], ['Bill & Louise Home', 'Bill & Louise']], share: .8 },
  words: { boat: 'Boat', pier: 'Pier', tower: 'Tower', sand: 'Towel', rock: 'Rock', camp: 'Tent', oasis: 'Oasis', cabin: 'Cabin', treehouse: 'Treehouse', lookout: 'Lookout', clearing: 'Picnic', crag: 'Crag', hut: 'Hut', basecamp: 'Camp', station: 'Lift Hut', chalet: 'Chalet', igloo: 'Igloo', ice: 'Ice Hole', ferry: 'Ferry' },
  plate: { text: 11, h: 18, padX: 7, radius: 6, drop: 7, surface: 11, rim: 1.2, fill: 'rgba(20,15,40,.82)', edge: '#ffc23d', ink: '#fff3df', wait: .6, side: 8, scale: 24 },
};

// Every order comes in as a phone call that rings until it answers itself. firstAt, nextAt, airAt, rushAt: seconds from an
// order coming in to its first ring (the opening, a later stop's after the notice naming it, one handed on in the air,
// Rush's); padAt brings a later stop's ring forward once the aircraft waits on its pad; resumeAt rings again after a
// pause. A call rings loud times every ringEvery seconds, then softly every quietEvery; Rush rings rushRings times.
// approach: the last stretch to the customer (never more than approachShare of the leg), where no talk goes on; below:
// the card's top under the HUD, and it steps under a toast or the hangar tip by gap. While it would sit over the pointer,
// the shop's order note or guard (a box in pixels around the flying aircraft and its time pill), it moves across to east
// pixels in from the right edge. voice: the rhythm and pitch of a caller's line (the words show to it), its pitch by
// title. murmur: what a call sounds like, with no voice and no words: the line's hiss (noise through a band at line, Q
// lineQ, at hiss, in over fade and out over tail) and under it the line's rhythm at the caller's pitch, through a lowpass
// at cut so no vowel comes through, each syllable swelling to level over swell of it and gone by edge before its end.
// speech: the recorded voices (scripts/voices.mjs makes them ahead of time with Piper; make is only read there; calls no
// longer play them), each caller's voice and rate picked by household, join the gap between greeting and request, say
// how a title is spoken, budget the most bytes all lines may take. While a call talks the rotor steps back to rotorShare.
// answerAfter: every call answers itself this many seconds after it starts ringing, picked at random between the two.
export const CALL = {
  answerAfter: [1.0343, 2.34324],
  firstAt: .5, nextAt: 1.4, airAt: .35, rushAt: .1, padAt: .2, resumeAt: .3, between: .25, fade: .25,
  ringEvery: 1.5, loud: 4, quietEvery: 3, rushRings: 1,
  approach: 700, approachShare: .5, below: 88, gap: 8, remeasure: .5, maxChars: 40, linger: .4, buzz: 35, seed: 4141, hudShort: 420,
  guard: { x: 56, up: 64, down: 40 }, east: 76,
  states: { ring: 'Incoming call · {home}', hand: 'Handed on · {home}', drop: 'Next drop · {home}', rush: 'Rush order · {home}' },
  faces: ['#e8492c', '#f09a1a', '#2fa866', '#2f9fc2', '#7d6cf0', '#d0609a', '#b4824e', '#2f8f9d'],
  voice: { pitch: { m: [100, 160], f: [180, 300] }, steps: 8, offset: 3, speed: [.85, 1.2], shift: .06, syll: .12, gap: .05, pause: .14, wobble: 3, rise: 4, lift: 2, fall: 2, maxSpeedUp: 1.6,
    vowels: [[800, 1200], [500, 1800], [320, 2300], [500, 900], [350, 800]] },
  murmur: { cut: 520, q: .7, level: .3, swell: .45, edge: .1, line: 1400, lineQ: .6, hiss: .05, fade: .08, tail: .15 },
  speech: {
    voices: { f: ['ljspeech', 'kristin'], m: ['norman', 'john'] },
    models: { ljspeech: 'en_US-ljspeech-high', kristin: 'en_US-kristin-medium', norman: 'en_US-norman-medium', john: 'en_US-john-medium' },
    rates: [.95, 1, 1.05], join: .15, rotorShare: .7,
    say: { 'Mr.': 'Mister', 'Ms.': 'Miz' },
    make: { pace: 1, rate: 24000, squeeze: .97, trim: -40, pad: .04, rms: -18, peak: -1.5, fade: .015 },
    budget: 2400000,
  },
  ask: {
    pizza: ['a pizza', 'two pizzas'], falafel: ['some falafel', 'double falafel'], kunafa: ['some kunafa', 'double kunafa'], coffee: ['a coffee', 'two coffees'], cake: ['a cake', 'two cakes'],
    medicine: ['my medicine', 'two packs of medicine'], flowers: ['some flowers', 'two bunches of flowers'], watermelon: ['a watermelon', 'two watermelons'], tv: ['a new TV', 'two TVs'],
    vase: ['a glass vase', 'two glass vases'], icecream: ['an ice cream', 'two ice creams'], supplies: ['supplies', 'extra supplies'],
  },
  lines: {
    greet: 'Hi, this is {who}.',
    plain: ['Can I get {ask}, please?', "I'd love {ask}, please!"],
    urgent: ['I need {ask}, quickly please!', '{Ask}, as fast as you can!'],
    rescue: ["I'm stuck out here. Supplies, please!", 'Please bring me supplies!'],
    rush: ['{Ask}, quick!'],
  },
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

// The camera's shots. zoom scales the picture, leadX and leadY place the aircraft across and down the screen, ahead
// leads the shot by that many seconds of flight, follow is how fast it catches up, and breathe drifts the zoom by that
// share at breatheRate. The player steps through order. A mission opens on one of openings, picked at random, moving
// into the first shot over openBlend seconds while the order is made: zoom is where it starts, offX and offY shift
// the camera in world units, and a side move comes from either side. outro pushes in on a delivery. A change of shot glides over blend seconds. Cached images are painted for the closest
// shot, sharpZoom, so no change of shot ever repaints them. Auto cuts to close within near of the shop or customer, to wide above fast px/s, and holds a shot
// at least hold seconds. chip is how long the shot's name shows after a change.
export const SHOTS = {
  order: ['chase', 'wide', 'close', 'cinema', 'auto'], start: 'chase', blend: 1.1, sharpZoom: 1.15, chip: 1.6,
  chase: { name: 'Chase', zoom: 1, leadX: .45, ahead: .35, leadY: .42, follow: 3 },
  wide: { name: 'Wide', zoom: .72, leadX: .5, ahead: .55, leadY: .46, follow: 2.4 },
  close: { name: 'Close', zoom: 1.15, leadX: .46, ahead: .2, leadY: .38, follow: 4 },
  cinema: { name: 'Cinema', zoom: .88, leadX: .36, ahead: .8, leadY: .32, follow: 1.4, breathe: .025, breatheRate: .45 },
  auto: { name: 'Auto', near: 380, fast: 250, hold: 2.2 },
  openBlend: 2.8,
  openings: [
    { name: 'push', zoom: .7 }, { name: 'crane', zoom: .9, offY: -420 }, { name: 'track', zoom: .85, offX: 650, side: true },
    { name: 'pull', zoom: 1.15 }, { name: 'sweep', zoom: .78, offX: 520, offY: -280, side: true },
  ],
  outro: { zoom: 1.08, leadX: .5, ahead: 0, leadY: .45, follow: 1.6 },
};

// popSize is the words that pop up, before the screen's scale, and popRise how fast they climb.
export const FX = {
  popLife: 1.8,
  popSize: 20,
  popRise: 40,
  // a pop marked pump starts pump times its size and settles within pumpTime seconds
  pump: 1.4,
  pumpTime: .15,
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

// The music: tempo in beats a minute, played in eighth steps, scheduled ahead seconds early. level is the game's
// loudness, menuLevel the maps', pausedShare what is left under a pause. Each place has a root note and a voice and
// may own the mode; otherwise times (sunset, night, day) pick it. Arpeggio notes play on the steps in pattern, as
// often as base plus speed times how fast the aircraft goes, a little less while held, and climb an octave with height.
export const MUSIC = {
  tempo: 84, steps: 8, ahead: .3, fade: .8, altSpan: 900, fastSpeed: 400, lateSecs: 10, level: .16, menuLevel: .1, pausedShare: .45, bass: .32, pulse: .4, cueLevel: .3,
  // the music steps back to callShare while a call rings or talks, easing there over callFade seconds, and back the same
  // way for callTail seconds after the call
  callShare: .35, callFade: .15, callTail: .6,
  times: ['mixolydian', 'dorian', 'ionian'],
  progressions: { bright: [0, 5, 3, 4], dark: [0, 5, 3, 6] },
  places: {
    city: { root: 62, voice: 'kalimba' }, beach: { root: 65, voice: 'marimba' },
    desert: { root: 64, voice: 'oud', mode: 'hijaz' }, forest: { root: 67, voice: 'flute' },
  },
  arp: { pattern: [1, 0, 1, 1, 0, 1, 1, 0], base: .45, speed: .5, holdCut: .25, menu: .3, climb: 1, walk: 3, level: .22 },
  pad: { level: .09, attack: 1.2, release: .9, detune: 7, cut: [520, 1500], windRate: 1.7, windWobble: 260, boostLift: 500 },
  voices: {
    kalimba: { wave: 'triangle', attack: .005, decay: 1, overtone: 4, overtoneLevel: .25, overtoneDecay: .25 },
    marimba: { wave: 'sine', attack: .004, decay: .7, overtone: 4, overtoneLevel: .4, overtoneDecay: .15 },
    oud: { wave: 'sawtooth', attack: .006, decay: .55, overtone: 2, overtoneLevel: .15, overtoneDecay: .3 },
    flute: { wave: 'sine', attack: .06, decay: 1.2, overtone: 2, overtoneLevel: .12, overtoneDecay: .9 },
    bass: { wave: 'sine', attack: .02, decay: 1 },
    pulse: { wave: 'sine', attack: .005, decay: .5 },
  },
  cues: {
    pickup: [[0, 0], [2, .5], [4, 1]], deliver: [[4, 0], [2, .5], [7, 1], [9, 1.5]], win: [[0, 0], [4, .5], [7, 1], [9, 1.5], [11, 2.5]], lose: [[4, 0], [3, 1], [1, 2]],
  },
  // Recorded loops by Abstraction, CC0, from the Music Loop Bundle (music/CREDITS.txt), one for each scene: the maps,
  // city missions, the open country (beach, desert, forest, mountains, snow) and challenges. Once one has decoded it
  // takes over from the generated music, which stays only where a device cannot decode them. Each is brought to
  // loudness (an RMS level, measured every stride samples) and its last seam seconds blend into its first, so the
  // turn has no click. The maps play at menuShare; a paused mission keeps pausedShare behind a lowpass at pauseCut.
  // swap is the crossfade between scenes in seconds, and kept how many decoded loops stay in memory.
  tracks: {
    files: { menu: 'abstraction-july-6th.ogg', city: 'abstraction-2024-12-21.ogg', country: 'abstraction-ludum-dare-30-04.ogg', challenge: 'abstraction-2024-02-07.ogg' },
    loudness: .045, stride: 16, seam: .02, menuShare: .85, pausedShare: .45, pauseCut: 700, openCut: 18000, swap: 1.5, kept: 2,
    // a recorded loop steps back the same way while a call rings or talks
    callShare: .35, callFade: .15,
  },
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

// A run of clean deliveries raises the tip. A delivery is clean when nothing struck the aircraft or the order since it
// was loaded (nothing that makes an impact sound) and it arrives at minInteg or better. mult is the tip factor by the
// run's length, the last one held from there on. The run lasts the session, through every mission passed, and is never
// saved; a hit, a ruined order or a mission not passed ends it. The badge shows from showFrom, and its chime climbs by
// notes (semitones) as the run grows. hint is how long the first badge's note explains it. On a screen narrower than
// wideFrom a toast or the shop's tip steps down by step pixels below the badge; narrower than narrow the badge steps
// aside while the weather note shows. anim is how long its bump and its shake take, in seconds; a toast keeps its place
// until a broken run's badge has shaken away.
export const COMBO = { minInteg: 85, mult: [1, 1, 1.1, 1.2], showFrom: 2, notes: [0, 2, 4, 5, 7, 9, 12], hint: 3.5, wideFrom: 620, narrow: 380, step: 24, anim: .42 };

// A perfect drop: a clean order at minInteg or better, handed over within centre of the customer across, through a
// handover whose order never swung sideways faster than swing nor dropped faster than fall, under an aircraft never
// faster than drone. Time then runs at slowRate for slowSecs of real time, easing back to full from easeFrom of the way;
// confetti bursts (half on the low picture) and a gold wave spreads from the customer, the words pop at popSize popLift
// over the aircraft, and a phone buzzes for buzz milliseconds. cue is the pair of ticks either side of the customer while
// the aircraft is over them, gold only while this drop would still count as perfect; tick and width are in pixels.
export const PERFECT = {
  minInteg: 95, centre: 10, swing: 40, fall: 150, drone: 60,
  slowSecs: .5, slowRate: .3, easeFrom: .6, confetti: 30, buzz: 40, popSize: 26, popLift: 80, color: '#7fe0a8',
  wave: { life: .55, from: 14, grow: 80, width: 4, color: '255,210,80' },
  cue: { tick: 12, width: 3, lift: 6, gold: '#ffd23d', dim: 'rgba(255,255,255,.45)' },
};

// Close calls, only with an order on the rope and the aircraft in the player's hands. A pass starts when the aircraft
// or the order comes within gap of anything solid (not the ground, not the shop the order came from) while the aircraft
// flies at speed or faster, and counts once both are back past clear; a touch, a hit, more than maxNear seconds inside
// gap or maxPass seconds in all spends it until the way is clear again. The order passing within cableX by cableY of a
// cable without touching it counts the same, and so does the aircraft or the order within carGap over a moving vehicle
// (looked at only below carHigh over the street), a hawk's dive that came within hawkGap of the order and missed, and an
// eagle's stoop within eagleGap of the aircraft that missed. Each banks bonus into the order's tip, perMission times a
// mission at most, never twice within cooldown seconds. The words ride popLift over the aircraft, clear of its order
// timer, since the danger is already behind it when the pass counts.
export const CLOSE = { gap: 12, clear: 30, speed: 240, maxNear: .8, maxPass: 1.5, cableX: 34, cableY: 30, carGap: 24, carHigh: 90, hawkGap: 44, eagleGap: 60, bonus: 2, perMission: 2, cooldown: 5, popLift: 80, color: '#ffd879' };

// Surprises dress generated missions from `from` to `to` (none in challenges or training; on switches them all off for
// comparisons). Each try of a mission draws its own from a stream seeded by the mission and the try, so the route,
// limits and physics stay exactly as they were and a retry can bring something new: none, one or two by counts, two
// only from twoFrom on a route of two stops or more, on different stops. Kinds open in turn: the ring from `from`, the
// gust and the move from first. Each waits until its stop's order is share of the way out, at least after seconds into
// the leg, with minLeft seconds still on the clock and the customer further than approach; past the approach it lapses.
// It never fires during prep, on Hold or Land, or while a hawk dives or an eagle hunts, and one runs at a time.
// ring: a golden ring ahead of the aircraft and rise above it, lifted clear of anything within span by clear, kept
// keepOff from hawks, eagles and cables, for life seconds; flying through it within reach banks bonus, sparkles and
// buzzes, and the words ride popLift over the aircraft. note is how long the weather note announces it. gust: warn
// seconds of notice, then the wind swings by share of the mission's top wind for secs at follow, never past top of it,
// dying down near the customer. A wind already blowing the gust's way harder than flip of the top turns it the other
// way, so it is always felt. It waits for open air, the aircraft clear above anything within open, and on a narrow
// screen for a toast to clear, so its warning is always seen. move: a customer on a rooftop or a boat (kinds) steps
// over to the closest spot of the same kind a step away and no more than rise higher or lower, with a clear way down in
// the city, on a leg with room past the approach for it to happen, and waits no later than spare short of the approach.
// A mission that allows it leads with it at chance. The clock gains base seconds plus the step at MISSION.speed times
// pace; the tip and the time star do not count the extra way it adds at that pace, nor the cooling of a hot order over
// it. The old spot and the way to the new one show for flash seconds once the old spot is on screen, or seenBy seconds
// after the move at the latest.
export const SURPRISE = {
  on: true, seed: 7070, from: 11, to: 40, twoFrom: 21, counts: [.3, .55, .15], first: { gust: 14, move: 21 }, share: [.25, .6], after: 3, minLeft: 12, approach: 700,
  ring: { ahead: 300, rise: 80, clear: 120, span: 100, reach: 46, life: 4, fade: .25, blink: 1, label: 1.2, note: 2, bonus: 3, keepOff: 160, line: 4, pulse: 4, buzz: 20, sparkle: 10, popLift: 80, color: '255,194,61' },
  gust: { warn: 1.2, secs: 2.2, share: .8, top: .9, flip: .4, follow: 2, open: 150, clear: 140 },
  move: { kinds: ['roof', 'boat'], step: [120, 450], rise: 160, room: 600, spare: 100, base: 5, pace: 1.5, chance: .7, flash: 2.5, seenBy: 8 },
};

// Today's mission: one a day, built from the device's local date (its day number, see storage.js), so every player gets
// the same one on that date. Each weekday has its theme (Monday first), so seven days in a row never repeat one, and the
// region steps on one a day through regions. It flies at tier: the reach, hawks, wind, traffic and rival speed of that
// mission, with the theme's stops or two at chance two, in daylight at chance day else at sunset (the night theme at
// night), and weather from its region's skies at chance weather (the snowfield always snows). Fair for everyone: a clear
// way down and open sky over every customer, never one of the avoid kinds (down among the traffic, behind a balcony rail,
// on the ice), never the same customer twice, a heavy order never more than heavyTop over the street, an order that
// catches the wind never on a perch, in a race, under a cut clock or where a region's wind boost is over calm, an urgent
// order never under a cut clock, and a race leg at least rivalMin long. A date draws from its own stream (seed + day *
// mix + try * retry), so missions 1-55 never move; it takes up to tries draws in its region, then the same in the city.
// reward pays the date's first pass: base, plus step for each day in a row after the first, at most cap steps. It opens
// once mission unlock is passed; the map's countdowns refresh every tick seconds.
export const DAILY = {
  unlock: 5, seed: 6061, mix: 7919, retry: 104729, tries: 8, tier: 6, two: .5, day: .6, weather: .4, calm: 1.2, heavyTop: 240, rivalMin: 1500, tick: 1,
  regions: ['city', 'beach', 'desert', 'forest', 'mountain', 'snow'],
  places: { city: 'City', beach: 'Seaside', desert: 'Desert', forest: 'Forest', mountain: 'Mountains', snow: 'Snowfield' },
  skies: { city: ['rain', 'clouds'], beach: ['clouds'], desert: [], forest: ['fog'], mountain: ['snow'], snow: ['snow'] },
  avoid: ['bal', 'street', 'camp', 'oasis', 'clearing', 'basecamp', 'igloo', 'ice'], perches: ['boat', 'station'],
  // each note says its theme's numbers in words, so a changed clock, hawks or stops needs its note changed too; a no-break
  // space keeps a short last word off a line of its own on a narrow phone
  themes: [
    { key: 'rush', name: 'Tight Clock', note: 'Every clock is 20% shorter', sign: 'clock', clock: .8 },
    { key: 'big', name: 'Big Order', note: 'Two orders tied on one rope, for one customer', sign: 'double', pair: [1.6, 2.2], stops: 1 },
    { key: 'hawks', name: 'Hawk Alley', note: 'One more hawk on every leg', sign: 'hawk', hawks: 1 },
    { key: 'tour', name: 'Grand Tour', note: 'Three stops, one after another', sign: 'route', stops: 3 },
    { key: 'race', name: 'Race Day', note: 'A rival races you to the last customer', sign: 'rival', rival: true },
    { key: 'care', name: 'Soft Touch', note: 'The most delicate order on the menu. Turn\u00a0gently', sign: 'glass', fragile: 1.2, stops: 1 },
    { key: 'night', name: 'Night Shift', note: 'Two stops under the stars', sign: 'blackout', stops: 2, night: true },
  ],
  reward: { base: 20, step: 5, cap: 2 },
};

// The gift calendar: what each of the week's seven gifts pays, the last the big one. The next gift waits on any date after
// the last one claimed, so a missed day only waits and a date at or before the last claim never pays; after the seventh the
// week starts again. It opens once mission unlock is passed, and by itself once, on the first map visit of a date with a
// gift waiting. A claim throws paper pieces from its tile (paper[1] on the big day, half on the low picture) up to spread
// pixels out, the nearest at inner of that, lifted lift higher and turned up to spin degrees, and buzzes buzz[0]
// milliseconds (buzz[1] on the big day).
export const GIFTS = { unlock: 1, days: [10, 12, 15, 18, 20, 25, 100], paper: [24, 48], spread: 110, inner: .45, lift: 30, spin: 720, buzz: [40, 90] };

// Rush Hour, the endless mode over the city: open once mission unlock is passed (or in dev mode), its map card shown from
// mission showFrom on. A run opens on city shop `shop` with that shop's first item, loaded in firstLoad seconds, at hour
// (a CLOCK index), with traffic at tier and the battery draining at drain of a mission's rate; every later order loads in
// `load` seconds with a fresh battery. One clock runs the whole run: it starts at `start` as the first order loads and
// ends the run at zero, even between orders. Each drop adds (base + way / pace) seconds times the level's share, way being
// the way back to the next shop's pad and on to its customer, plus clean for a clean drop and perfect more for a PERFECT;
// the clock holds cap at most. What a drop added shows in gainInk (style.css reads it too) for gainShow seconds in the HUD
// clock and as gainPop words, size `size`, `below` under the drop's points; the last tickFrom seconds tick.
// Every `every` drops the rush level steps to the next row of levels, with a gold toast of its note and a levelBuzz ms
// buzz; past the last row the share shrinks by fade a level and the note says `later`. A row's customers stand near to
// far from their shop and west of `to`, of its kinds (down on the street at chance street), with an order from its menu
// (null: the whole menu); hawks and wind are a mission's. From level eagle.from an order may bring an eagle, at chance
// plus step a level after that, once Mission eagle.after is passed (or in dev mode); until then that level's toast says
// eagle.calm. The next order comes from the shop closest to the drop that has something on the menu; a balcony takes
// only a small, steady, sturdy order, a heavy one never stands more than heavyTop over the street, and a level that finds nobody looks widen wider, widenTries times. From ring.from a drop may
// bring a bonus ring (ring.chance), from gust.from a gust (gust.chance), as SURPRISE plays them. Points: drop, plus
// perfect for a PERFECT, plus perBonus for each dollar a close call or ring banks, times 1 + perLevel per level over the
// first, times combo by the run of clean drops (the badge shows it, the last held), times urgent for an urgent order,
// rounded to `round`. Pay: each dollars a drop, perLevel more for each level over the first it was flown at, and perfect
// more for a PERFECT, paid with the best when the run ends, so a run played out pays more a minute than one quit early;
// measured, it stays well under what missions pay a minute. From level hotFrom the challenge music plays. The result
// card counts the score up over tally ms after tallyDelay (firstTip under a run that ran out before its first drop); a
// new best throws bestPaper paper (half on the low picture) and buzzes bestBuzz ms.
export const RUSH = {
  unlock: 6, showFrom: 5, shop: 0, tier: 6, hour: 0, drain: .6,
  start: 45, firstLoad: 3, load: 1, base: 16, pace: 90, cap: 75, clean: 2, perfect: 4,
  every: 3, fade: .8, heavyTop: 240, widen: .25, widenTries: 3,
  gainShow: .9, gainInk: '#7fe0a8', gainPop: { size: 16, below: 24 }, tickFrom: 5, hotFrom: 5, levelBuzz: 30,
  ring: { from: 2, chance: .35 }, gust: { from: 4, chance: .25 }, eagle: { from: 8, chance: .35, step: .1, after: 24, calm: 'Farther, windier, less time' },
  points: { drop: 100, perfect: 100, perBonus: 10, perLevel: .25, urgent: 1.5, round: 10 },
  combo: [1, 1, 1.2, 1.4, 1.6, 1.8, 2],
  pay: { each: 4, perLevel: 1, perfect: 3 },
  tally: 1100, tallyDelay: 300, bestPaper: 48, bestBuzz: 90,
  intro: 'Deliver until the clock runs out', later: 'Less time per drop', firstTip: 'Fly straight to the customer. Each drop adds time',
  menus: { easy: ['pizza', 'falafel', 'kunafa', 'medicine'], medium: ['pizza', 'falafel', 'kunafa', 'medicine', 'flowers', 'watermelon', 'coffee'] },
  levels: [
    { near: 500, far: 1100, kinds: ['roof'], street: 0, menu: 'easy', hawks: 0, wind: 90, share: 1, to: 7000, note: '' },
    { near: 600, far: 1400, kinds: ['roof'], street: 0, menu: 'easy', hawks: 1, wind: 110, share: .88, to: 7000, note: 'A hawk joins in' },
    { near: 800, far: 1700, kinds: ['roof', 'bal'], street: 0, menu: 'medium', hawks: 1, wind: 130, share: .78, to: 10500, note: 'Balconies and heavier orders' },
    { near: 900, far: 1900, kinds: ['roof', 'bal'], street: .35, menu: 'medium', hawks: 1, wind: 150, share: .7, to: 10500, note: 'Street drops. Mind the traffic' },
    { near: 1000, far: 2100, kinds: ['roof', 'bal'], street: .35, menu: null, hawks: 2, wind: 170, share: .64, to: Infinity, note: 'Fragile orders. Two hawks' },
    { near: 1100, far: 2300, kinds: ['roof', 'bal'], street: .35, menu: null, hawks: 2, wind: 190, share: .58, to: Infinity, note: 'Stronger wind' },
    { near: 1200, far: 2500, kinds: ['roof', 'bal'], street: .35, menu: null, hawks: 3, wind: 205, share: .53, to: Infinity, note: 'Three hawks' },
    { near: 1300, far: 2700, kinds: ['roof', 'bal'], street: .35, menu: null, hawks: 3, wind: 220, share: .49, to: Infinity, note: 'An eagle hunts. Dodge it' },
  ],
};
