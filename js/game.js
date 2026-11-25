// Jungle Soldier · Forest Remastered (PlayCanvas engine test)
// Forest Level 1 "Overgrown Trail" rebuilt on PlayCanvas with real-time 3D scenery,
// image-based lighting, cascaded shadows, volumetric light shafts, SSAO and bloom.
// Gameplay follows V16 Level 1 (run, strafe, roll, jump, mouse-aim rifle, grenades)
// with the 3D roster: raptors, jungle spiders, rat swarms, bloated rats, wyverns,
// chargers, shell beetles, trapdoor spiders and turrets.
import * as pc from './playcanvas.min.mjs';
import { makeTextures, rand } from './textures.js';
import { buildWorld, groundH, HALF } from './world.js';
import { dressForest } from './scenery.js';
import { makeModels } from './models.js';
import { makeFx } from './fx.js';
import { createMusic } from './music.js';
import { CREATURES, LEVEL_KINDS, loadCreature, makeCreature, setClip, hasClip } from './creatures.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const TEST = params.has('test');
const LEN = 950;
const DIFF = {
  easy: { dmg: .6, waves: 1.3, label: 'Easy' },
  medium: { dmg: 1, waves: 1, label: 'Medium' },
  hard: { dmg: 1.5, waves: .75, label: 'Hard' }
};
const RIFLE = { rate: 8, range: 30, speed: 75, dmg: 1 };
const RUN = 6, STRAFE = 5, ROLL = 11;

let quality = params.get('q') || (() => { try { return localStorage.getItem('pcforest-q'); } catch { return null; } })() || 'high';

// ------------------------------------------------------------------ app
const canvas = $('app');
const app = new pc.Application(canvas, { graphicsDeviceOptions: { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: TEST } });
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
window.addEventListener('resize', () => app.resizeCanvas());
const device = app.graphicsDevice;

function loadTex(url, srgb) {
  return new Promise((res, rej) => {
    const a = new pc.Asset(url, 'texture', { url }, { srgb, mipmaps: true });
    a.on('load', () => res(a.resource)); a.on('error', rej);
    app.assets.add(a); app.assets.load(a);
  });
}
// The dusk HDRI ships as raw RGBE bytes (1024x512x4, decoded from Poly Haven's .hdr)
// so it is served as a plain binary file and uploaded straight into an RGBE texture.
// Binary assets ship base64-encoded in .txt files so any static host serves them.
async function fetchB64(url) {
  const txt = await (await fetch(url)).text();
  const bin = atob(txt.trim()), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
async function loadRgbe(url, w, h) {
  const buf = await fetchB64(url);
  const t = new pc.Texture(device, { name: 'sky', width: w, height: h, format: pc.PIXELFORMAT_RGBA8, type: pc.TEXTURETYPE_RGBE, mipmaps: false,
    projection: pc.TEXTUREPROJECTION_EQUIRECT, addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_CLAMP_TO_EDGE, minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST, levels: [new Uint8Array(buf)] });
  return t;
}
async function loadGlb(url) {
  const blobUrl = URL.createObjectURL(new Blob([await fetchB64(url)], { type: 'model/gltf-binary' }));
  return new Promise((res, rej) => app.assets.loadFromUrlAndFilename(blobUrl, 'soldier.glb', 'container', (err, a) => err ? rej(err) : res(a.resource)));
}

const progress = p => { $('loadfill').style.width = Math.round(p * 100) + '%'; };

async function boot() {
  progress(.05);
  const [hdr, diff, nor, rough, soldierRes] = await Promise.all([
    loadRgbe('assets/qwantani_dusk_1k.rgbe.b64.txt', 1024, 512), loadTex('assets/forest_floor_diff_1k.jpg', true),
    loadTex('assets/forest_floor_nor_gl_1k.jpg', false), loadTex('assets/forest_floor_rough_1k.jpg', false), loadGlb('assets/soldier.glb.b64.txt')
  ]);
  for (const t of [diff, nor, rough]) { t.addressU = t.addressV = pc.ADDRESS_REPEAT; t.anisotropy = 8; }
  progress(.35);
  await new Promise(r => setTimeout(r, 0));
  const tex = makeTextures(device);
  progress(.55);
  await new Promise(r => setTimeout(r, 0));

  // sky and image-based lighting from the dusk HDRI
  const skybox = pc.EnvLighting.generateSkyboxCubemap(hdr);
  const lighting = pc.EnvLighting.generateLightingSource(hdr);
  app.scene.envAtlas = pc.EnvLighting.generateAtlas(lighting);
  app.scene.skybox = skybox;
  app.scene.skyboxIntensity = 1.35;
  app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, 200, 0);
  app.scene.exposure = 1.8;

  const world = buildWorld(app, tex, { diff, nor, rough }, LEN, quality);
  $('loadmsg').textContent = 'PLANTING THE UNDERGROWTH…';
  try { await dressForest(app, world, f => progress(.6 + .2 * f)); }
  catch (err) { console.warn('MegaKit scenery unavailable, keeping the code-built foliage', err); }
  progress(.85);
  await new Promise(r => setTimeout(r, 0));
  const models = makeModels(app, tex);
  const fx = makeFx(app, tex, quality);
  for (const s of [-1, 1]) fx.brazier(new pc.Vec3(s * 9.3, 1.6, world.gateZ + 4.5));
  // creature models for this level (downloaded and reduced GLBs), measured once
  $('loadmsg').textContent = 'WAKING THE CREATURES…';
  let ready = 0;
  await Promise.all(LEVEL_KINDS.map(k => loadCreature(app, k).then(() => progress(.85 + .15 * (++ready) / LEVEL_KINDS.length))));
  const moundMat = new pc.StandardMaterial(); moundMat.diffuseMap = diff; moundMat.diffuse = new pc.Color(.55, .42, .3); moundMat.gloss = .2; moundMat.update();
  const laneMat = new pc.StandardMaterial(); laneMat.diffuse = new pc.Color(0, 0, 0); laneMat.emissive = new pc.Color(1, .12, .05); laneMat.emissiveIntensity = 3;
  laneMat.blendType = pc.BLEND_ADDITIVE; laneMat.depthWrite = false; laneMat.opacity = .5; laneMat.update();
  return { tex, world, models, fx, soldierRes, skinCache: new Map(), moundMat, laneMat };
}

// ------------------------------------------------------------------ renderer setup
let sun, cam, frame;
function setupView() {
  sun = new pc.Entity('sun');
  sun.addComponent('light', {
    type: 'directional', color: new pc.Color(1, .9, .76), intensity: 6, castShadows: true,
    shadowDistance: 70, numCascades: 3, cascadeDistribution: .6, shadowResolution: 2048,
    shadowType: pc.SHADOW_PCF3_32F, shadowBias: .25, normalOffsetBias: .06
  });
  // low sun ahead of the player so its shafts slant back toward the camera
  sun.setLocalEulerAngles(-60, 40, 0);
  app.root.addChild(sun);

  cam = new pc.Entity('camera');
  cam.addComponent('camera', { clearColor: new pc.Color(.5, .55, .45), fov: 60, nearClip: .1, farClip: 520 });
  app.root.addChild(cam);

  app.scene.fog.type = pc.FOG_EXP2;
  app.scene.fog.color = new pc.Color(.30, .36, .27);
  app.scene.fog.density = .0055;

  try {
    frame = new pc.CameraFrame(app, cam.camera);
  } catch (e) { console.warn('CameraFrame unavailable', e); frame = null; }
  applyQuality();
}

function applyQuality() {
  const q = quality;
  device.maxPixelRatio = q === 'high' ? Math.min(window.devicePixelRatio, 1.5) : q === 'medium' ? 1 : .85;
  sun.light.numCascades = q === 'low' ? 1 : q === 'medium' ? 2 : 3;
  sun.light.shadowResolution = q === 'low' ? 1024 : 2048;
  sun.light.shadowDistance = q === 'low' ? 45 : 70;
  if (frame) {
    frame.rendering.toneMapping = pc.TONEMAP_ACES2;
    frame.rendering.samples = q === 'low' ? 1 : 4;
    frame.rendering.sharpness = q === 'high' ? .25 : 0;
    frame.bloom.intensity = .03; frame.bloom.blurLevel = 7; frame.bloom.threshold = 1.2;
    frame.ssao.type = q === 'high' ? pc.SSAOTYPE_LIGHTING : pc.SSAOTYPE_NONE;
    frame.ssao.intensity = .55; frame.ssao.radius = 22; frame.ssao.samples = 10; frame.ssao.blurEnabled = true;
    const vf = frame.volumetricFog;
    vf.enabled = q !== 'low'; vf.light = sun.light;
    vf.tint = new pc.Color(1, .9, .74); vf.density = .014; vf.heightBase = 0; vf.heightFalloff = .09;
    vf.anisotropy = .7; vf.intensity = 1.25; vf.ambientColor = new pc.Color(.45, .55, .42); vf.ambientIntensity = .02;
    vf.maxDistance = 120; vf.steps = q === 'high' ? 32 : 20; vf.scale = q === 'high' ? .5 : .35;
    frame.vignette.intensity = .45; frame.vignette.inner = .45; frame.vignette.outer = 1.15; frame.vignette.curvature = .6;
    frame.grading.enabled = true; frame.grading.saturation = 1.25; frame.grading.contrast = 1.04; frame.grading.brightness = 1.06;
    frame.grading.tint = new pc.Color(1, .98, .93, 1);
    frame.update();
  } else {
    cam.camera.toneMapping = pc.TONEMAP_ACES2; cam.camera.gammaCorrection = pc.GAMMA_SRGB;
  }
  document.querySelectorAll('[data-q]').forEach(b => b.classList.toggle('on', b.dataset.q === q));
}

// ------------------------------------------------------------------ audio
let actx = null; const music = createMusic(); let musicOn = true;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); music.init(actx); music.setVolume(.35); } catch { actx = null; } }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function sfx(kind) {
  const ctx = actx; if (!ctx) return;
  const t = ctx.currentTime, g = ctx.createGain(); g.connect(ctx.destination);
  const noise = (dur, f, q = 1) => {
    const b = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ctx.createBufferSource(); s.buffer = b; const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
    s.connect(fl).connect(g); s.start(t); return s;
  };
  const tone = (type, f0, f1, dur) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); o.connect(g); o.start(t); o.stop(t + dur); };
  if (kind === 'shot') { g.gain.setValueAtTime(.07, t); g.gain.exponentialRampToValueAtTime(.001, t + .09); noise(.09, 2600, .8); tone('square', 900, 220, .06); }
  else if (kind === 'boom') { g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .9); noise(.9, 140, .5); tone('sine', 120, 30, .6); }
  else if (kind === 'hit') { g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.001, t + .08); tone('square', 420, 160, .07); }
  else if (kind === 'kill') { g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .3); noise(.3, 500, .7); tone('sawtooth', 300, 60, .25); }
  else if (kind === 'hurt') { g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); tone('sawtooth', 180, 70, .22); }
  else if (kind === 'pickup') { g.gain.setValueAtTime(.08, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); tone('triangle', 660, 1320, .2); }
  else if (kind === 'enemyShot') { g.gain.setValueAtTime(.035, t); g.gain.exponentialRampToValueAtTime(.001, t + .15); tone('sawtooth', 700, 300, .14); }
  else if (kind === 'warn') { g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.001, t + .35); tone('square', 520, 520, .12); }
}

// ------------------------------------------------------------------ game state
let G = null;   // assets
let S = null;   // run state
const held = new Set();
let mouse = { x: innerWidth / 2, y: innerHeight * .42, down: false };
let soldier, anim, animState = '', muzzleLight, flashLight;
const MUZZLE_FWD = .42, MUZZLE_UP = .04;
const pool = {};

function take(kind, make) {
  const p = pool[kind] || (pool[kind] = []);
  const e = p.pop() || make();
  if (!e.parent) app.root.addChild(e);
  e.enabled = true; return e;
}
function give(kind, e) { e.enabled = false; (pool[kind] || (pool[kind] = [])).push(e); }

function setupSoldier() {
  soldier = G.soldierRes.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
  app.root.addChild(soldier);
  soldier.addComponent('anim', { activate: true });
  const loops = { idle: 1, run: 1, strafeLeft: 1, strafeRight: 1, fire: 1 };
  for (const a of G.soldierRes.animations) {
    const tr = a.resource; soldier.anim.assignAnimation(tr.name, tr, undefined, 1, !!loops[tr.name]);
  }
  soldier.anim.baseLayer.transition('idle', 0);
  handBone = soldier.findByName('mixamorigLeftHand') || soldier.findByName('mixamorigRightHand');
  muzzleLight = new pc.Entity('muzzle');
  muzzleLight.addComponent('light', { type: 'omni', color: new pc.Color(.5, .9, 1), intensity: 0, range: 6, castShadows: false });
  app.root.addChild(muzzleLight);
  flashLight = new pc.Entity('flash');
  flashLight.addComponent('light', { type: 'omni', color: new pc.Color(1, .6, .25), intensity: 0, range: 16, castShadows: false });
  app.root.addChild(flashLight);
}
function play(name, blend = .15) {
  if (animState === name) return;
  animState = name; soldier.anim.baseLayer.transition(name, blend);
}

// ------------------------------------------------------------------ level plan
// fixed encounters (d = metres from the start). 'rats' = a swarm of five.
const PLAN = [
  [60, 'rats', 0],
  [105, 'raptor', -1.5],
  [150, 'spider', 2],
  [190, 'turret', -1],
  [225, 'wyvern', 0],
  [265, 'bloat', 1.5],
  [300, 'rats', -1], [304, 'raptor', 2],
  [345, 'ambush', 2.5],
  [385, 'shell', 0],
  [425, 'raptor', -2], [431, 'raptor', 2],
  [475, 'charger', 0],
  [525, 'spider', -2], [530, 'wyvern', 1],
  [570, 'ambush', -2.5],
  [605, 'turret', -1], [607, 'turret', 1],
  [645, 'bloat', -1], [650, 'rats', 1.5],
  [690, 'shell', 1],
  [735, 'charger', 0],
  [780, 'wyvern', -1.5], [790, 'wyvern', 1.5],
  [825, 'raptor', -2], [829, 'raptor', 2], [835, 'ambush', 0],
  [870, 'rats', 0], [876, 'bloat', 2], [880, 'spider', -2],
  [905, 'charger', 0]
];
const LOGS = [[115, -HALF, 1.2], [235, -1, HALF], [345, -HALF, .5], [455, -.5, HALF], [600, -HALF, 1.5], [715, -2, HALF], [830, -HALF, 2]];
const DROPS = [[45, 'grenade', 2], [160, 'coin', 0], [215, 'coin', -2], [280, 'health', -2], [335, 'coin', 2], [370, 'grenade', -2], [400, 'rapid', 0], [470, 'grenade', -2], [530, 'health', 2], [590, 'coin', -1], [650, 'coin', 1], [680, 'grenade', 0], [700, 'health', 0], [770, 'grenade', 2], [840, 'health', -2], [900, 'coin', 0]];
const HP = { raptor: 4, spider: 4, rat: 1.5, bloat: 2.5, wyvern: 7, charger: 14, shell: 16, ambush: 3, turret: 8 };
const SCORE = { raptor: 150, spider: 150, rat: 40, bloat: 120, wyvern: 220, charger: 400, shell: 350, ambush: 160, turret: 200 };
const NAMES = { raptor: 'Raptor', spider: 'Jungle spider', rat: 'Jungle rat', bloat: 'Bloated rat', wyvern: 'Wyvern', charger: 'Charger', shell: 'Shell beetle', ambush: 'Trapdoor spider', turret: 'Turret' };
const HIT = { raptor: [1.15, 1.1], spider: [.55, 1.15], rat: [.4, .7], bloat: [.6, 1.0], wyvern: [.2, 1.7], charger: [1.45, 1.55], shell: [.75, 1.55], ambush: [.6, 1.25], turret: [1.2, 1.1] };
const FIRST_SEEN = {
  rats: 'Rat swarm: they bite as they pass, so thin them out',
  raptor: 'Raptor: it rears up before it lunges. Strafe away!',
  spider: 'Jungle spider: acid lands on the red ring. Keep moving',
  wyvern: 'Wyvern: it dives at the marked spot. Roll out of it',
  bloat: 'Bloated rat: shoot it early. It bursts and hurts everything nearby',
  ambush: 'Watch the moving ground: something is hiding under it',
  shell: 'Shell beetle: its front shell stops bullets. Flank it or use a grenade',
  charger: 'Charger: dodge the charge, then shoot it while it is stunned',
  turret: 'Turret: hit the glowing core on its back'
};

function clearRun() {
  if (S) {
    for (const e of S.enemies) { give(e.kind, e.ent); releaseExtras(e); }
    for (const b of S.bolts) give(b.kind || (b.enemy ? 'ebolt' : 'bolt'), b.ent);
    for (const p of S.pickups) give('p-' + p.kind, p.ent);
    for (const a of S.lobs) { give('acid', a.ent); give('ring-acid', a.ring); }
    for (const p of S.puddles) give('puddle', p.ent);
    for (const g of S.grenades) give('gren', g.ent);
    for (const l of S.logs) give('log', l.ent);
  }
  S = null;
}
function newRun(diff = 'medium') {
  clearRun();
  S = {
    diff, D: DIFF[diff], d: 0, x: 0, y: 0, vy: 0, speed: 0, lat: 0, health: 100, grenadesLeft: 2, score: 0, coins: 0, kills: 0,
    time: 0, fireCd: 0, rollT: 0, rollDir: 0, inv: 0, rapid: 0, hurtFlash: 0, shake: 0, mode: 'play', planIdx: 0, waveT: 12,
    enemies: [], bolts: [], pickups: [], lobs: [], puddles: [], grenades: [], logs: [], rings: [], aim: new pc.Vec3(0, 1.2, -12), lastTap: {}, throwT: 0, hitT: 0,
    finalShown: false, shots: 0, hits: 0, damageTaken: 0, seen: {}
  };
  for (const [d, x0, x1] of LOGS) {
    const e = take('log', () => G.models.log(G.world));
    const cx = (x0 + x1) / 2, w = (x1 - x0) / 2 + .4;
    e.setPosition(cx, groundH(cx, -d) + .45, -d); e.setLocalScale(w, 1, 1); e.setEulerAngles(0, (rand() - .5) * 6, 0);
    S.logs.push({ d, x0, x1, ent: e });
  }
  for (const [d, kind, x] of DROPS) spawnPickup(kind, d, x);
  soldier.enabled = true; animState = ''; play('idle', 0);
  hud(true);
}

// ------------------------------------------------------------------ spawning
const MAKE = {
  raptor: () => makeCreature(app, 'raptor', null, G.skinCache),
  spider: () => makeCreature(app, 'spider', null, G.skinCache),
  ambush: () => makeCreature(app, 'spider', null, G.skinCache, 1.15),
  rat: () => makeCreature(app, 'rat', null, G.skinCache),
  bloat: () => makeCreature(app, 'rat', 'bloat', G.skinCache, 1.55),
  wyvern: () => makeCreature(app, 'wyvern', null, G.skinCache),
  charger: () => makeCreature(app, 'charger', null, G.skinCache),
  shell: () => makeCreature(app, 'shell', null, G.skinCache),
  turret: () => G.models.turret()
};
function spawn(kind, d, x) {
  if (kind === 'rats') {
    for (let k = 0; k < 5; k++) spawn('rat', d + (k % 3) * 1.3 + rand(), Math.max(-HALF + .6, Math.min(HALF - .6, x + (k - 2) * 1.1 + (rand() - .5))));
    if (!S.seen.rats) { S.seen.rats = 1; notice(FIRST_SEEN.rats); }
    return;
  }
  const e = take(kind, MAKE[kind]);
  e.setLocalScale(1, 1, 1); e.setEulerAngles(0, 180, 0);
  const en = { kind, ent: e, d, x, y: 0, hp: HP[kind] * (S.diff === 'hard' ? 1.25 : S.diff === 'easy' ? .85 : 1), t: rand() * 10, cd: 1 + rand() * 1.5,
    state: 'move', st: 0, dead: false, flash: 0, r: HIT[kind][1], h: HIT[kind][0], base: 1 };
  if (kind === 'turret') { en.x = Math.sign(x || 1) * (HALF + .9); en.cd = 1.2; en.burst = 0; en.base = 1; }
  if (kind === 'spider') { en.hold = 12 + rand() * 3; en.cd = 1.6; }
  if (kind === 'wyvern') { en.y = 7; en.ahead = 22 + rand() * 4; en.cd = 2 + rand(); en.dive = 7 + rand() * 3; en.state = 'fly'; }
  if (kind === 'charger') { en.state = 'approach'; en.cd = 1.5; }
  if (kind === 'shell') { en.state = 'walk'; en.yaw = 0; en.post = Math.max(-2.5, Math.min(2.5, x)); en.touchT = 0; }
  if (kind === 'ambush') {
    en.state = 'hidden'; en.y = -1.6; e.enabled = false;
    en.mound = take('mound', makeMound); en.mound.setPosition(x, groundH(x, -d) + .02, -d);
  }
  if (kind === 'rat' || kind === 'bloat') en.speed = (kind === 'rat' ? 5.2 : 4.4) + rand() * .8;
  if (e.creature) setClip(e, CREATURES[e.creature.kind].main, 0, 1);
  place(en);
  S.enemies.push(en);
  if (!S.seen[kind] && FIRST_SEEN[kind] && kind !== 'rat') { S.seen[kind] = 1; en.announce = true; }
  return en;
}
function releaseExtras(en) {
  if (en.mound) { give('mound', en.mound); en.mound = null; }
  if (en.lane) { give('lane', en.lane); en.lane = null; }
  if (en.ring) { give('ring-red', en.ring); en.ring = null; }
}
function makeMound() {
  const e = new pc.Entity('mound');
  e.addComponent('render', { type: 'sphere', material: G.moundMat, castShadows: false });
  e.setLocalScale(1.9, .22, 1.9);
  return e;
}
function place(en) {
  const gy = groundH(en.x, -en.d);
  en.ent.setPosition(en.x, gy + en.y, -en.d);
}
function spawnPickup(kind, d, x) {
  const e = take('p-' + kind, () => G.models.pickup(kind));
  e.setPosition(x, groundH(x, -d), -d);
  S.pickups.push({ kind, ent: e, d, x, t: rand() * 6 });
}
function waveSpawn() {
  const kinds = ['rats', 'raptor', 'raptor', 'spider', 'wyvern', 'bloat'];
  const k = kinds[(rand() * kinds.length) | 0];
  spawn(k, S.d + 42 + rand() * 10, (rand() * 2 - 1) * (HALF - 1.2));
  sfx('warn'); notice('Contact ahead');
}

// ------------------------------------------------------------------ combat
function damagePlayer(amount, cause) {
  if (S.mode !== 'play' || S.inv > 0 || S.rollT > 0) return;
  const dmg = amount * S.D.dmg;
  S.health = Math.max(0, S.health - dmg); S.damageTaken += dmg; S.dmgBy = S.dmgBy || {}; S.dmgBy[cause] = Math.round((S.dmgBy[cause] || 0) + dmg); S.inv = .45; S.hurtFlash = 1; S.shake = Math.max(S.shake, .35);
  sfx('hurt');
  if (S.hitT <= 0 && S.speed < 1) { play('hit', .08); S.hitT = .5; }
  if (S.health <= 0) die(cause);
}
function die(cause) {
  S.mode = 'dead'; play('death', .1); music.stop?.();
  setTimeout(() => showEnd(false, cause), 1800);
}
// src: where the shot came from (armour check); blast: grenades and bursts ignore armour
function hurtEnemy(en, dmg, at, src, blast) {
  if (en.dead || en.state === 'hidden') return;
  let mult = 1;
  if (en.kind === 'shell' && !blast && src) {
    const fwdX = -Math.sin(en.yaw * Math.PI / 180), fwdZ = -Math.cos(en.yaw * Math.PI / 180);
    const p = en.ent.getPosition(), vx = src.x - p.x, vz = src.z - p.z, l = Math.hypot(vx, vz) || 1;
    const front = (fwdX * vx + fwdZ * vz) / l;          // 1 = straight at its face
    if (front > .57) { mult = .12; G.fx.burst('cyanSpark', at); sfx('hit'); }
    else mult = 1.6;
  }
  if (en.kind === 'charger' && en.state === 'stunned') mult = 2;
  en.hp -= dmg * mult; en.flash = .12; S.hits++;
  G.fx.burst('spark', at);
  if (mult >= 1) sfx('hit');
  if (en.hp <= 0) killEnemy(en);
  else if (en.ent.creature && hasClip(en.ent.creature.kind, 'hit') && mult >= 1 && (en.kind === 'raptor') && en.state === 'move' && rand() < .25) { setClip(en.ent, 'hit', .05); en.hitAnim = .35; }
}
function killEnemy(en) {
  if (en.dead) return;
  en.dead = true; en.st = 0; S.kills++; S.score += SCORE[en.kind];
  const p = en.ent.getPosition().clone(); p.y += en.h;
  releaseExtras(en);
  if (en.kind === 'turret') { G.fx.burst('pop', p); G.fx.burst('spark', p); flash(p, 2.5); }
  else if (en.kind === 'bloat') burst(en, p);
  else G.fx.burst(en.kind === 'spider' || en.kind === 'ambush' ? 'acid' : 'goo', p);
  if (en.ent.creature && hasClip(en.ent.creature.kind, 'death')) setClip(en.ent, 'death', .08, 1);
  sfx('kill'); killpop(NAMES[en.kind] + '  +' + SCORE[en.kind]);
  const px = Math.max(-HALF + .5, Math.min(HALF - .5, en.x));
  if (en.kind === 'rat') { if (rand() < .3) spawnPickup('coin', en.d, px); }
  else if (rand() < .6) spawnPickup('coin', en.d, px);
  else if (rand() < .35) spawnPickup('health', en.d, px);
}
// the bloated rat bursts: hurts the player and every enemy close by
function burst(en, p) {
  G.fx.burst('fire', p); G.fx.burst('acid', p); G.fx.burst('smoke', p); flash(p, 5); sfx('boom');
  S.shake = Math.max(S.shake, .5);
  const gy = groundH(S.x, -S.d);
  if (Math.hypot(S.x - p.x, -S.d - p.z) < 4.5 && S.y < 2) damagePlayer(12, 'Bloated rat burst');
  for (const o of S.enemies) {
    if (o === en || o.dead) continue;
    const c = enemyCenter(o, tmpV2);
    if (c.distance(p) < 4.5) hurtEnemy(o, 6, c, null, true);
  }
  void gy;
}
function flash(p, i) { flashLight.setPosition(p.x, p.y + 1, p.z); flashLight.light.intensity = i; }

const tmpV = new pc.Vec3(), tmpV2 = new pc.Vec3();
function enemyCenter(en, out) {
  const p = en.ent.getPosition();
  return out.set(p.x, p.y + en.h, p.z);
}
function fireBolt(from, to, enemy, speed) {
  const e = take(enemy ? 'ebolt' : 'bolt', () => G.models.bolt(enemy));
  const dir = new pc.Vec3().sub2(to, from).normalize();
  e.setPosition(from); e.lookAt(tmpV.copy(from).add(dir));
  S.bolts.push({ ent: e, pos: from.clone(), from: from.clone(), dir, speed, enemy, life: enemy ? 4 : RIFLE.range / speed });
}
function shoot() {
  const muzzle = muzzlePos();
  const spread = S.rapid > 0 ? .012 : .006;
  const aim = S.aim.clone(); aim.x += (rand() - .5) * spread * 30; aim.y += (rand() - .5) * spread * 30;
  fireBolt(muzzle, aim, false, RIFLE.speed);
  S.shots++;
  muzzleLight.setPosition(muzzle); muzzleLight.light.intensity = 3.5;
  G.fx.burst('cyanSpark', muzzle);
  sfx('shot');
}
let handBone = null;
function muzzlePos() {
  const yaw = soldierYaw * Math.PI / 180;
  if (handBone) {
    // the rifle barrel runs forward past the supporting hand
    const h = handBone.getPosition();
    return new pc.Vec3(h.x + Math.sin(-yaw) * MUZZLE_FWD, h.y + MUZZLE_UP, h.z - Math.cos(yaw) * MUZZLE_FWD);
  }
  const gy = groundH(S.x, -S.d) + S.y;
  return new pc.Vec3(S.x + Math.sin(-yaw) * .55 + Math.cos(yaw) * .18, gy + 1.38, -S.d - Math.cos(yaw) * .55 + Math.sin(-yaw) * .18);
}
function throwGrenade() {
  if (S.grenadesLeft <= 0 || S.throwT > 0) return;
  S.grenadesLeft--; S.throwT = .6; play('grenade', .08);
  const from = muzzlePos(); from.y += .3;
  const to = S.aim.clone(); const dist = Math.min(22, Math.hypot(to.x - from.x, to.z - from.z));
  const dir = new pc.Vec3(to.x - from.x, 0, to.z - from.z).normalize();
  const target = new pc.Vec3(from.x + dir.x * dist, 0, from.z + dir.z * dist); target.y = groundH(target.x, target.z);
  const e = take('gren', () => G.models.grenadeBall());
  S.grenades.push({ ent: e, from, to: target, t: 0, dur: .55 + dist / 40 });
}
function explode(p) {
  G.fx.burst('fire', p); G.fx.burst('smoke', p); G.fx.burst('spark', p); flash(p, 6);
  sfx('boom'); S.shake = Math.max(S.shake, .6);
  for (const en of S.enemies) {
    if (en.dead) continue;
    const c = enemyCenter(en, tmpV);
    const dd = c.distance(p);
    if (dd < 6.5) hurtEnemy(en, 12 * (1 - dd / 9), c, null, true);
  }
}

// ------------------------------------------------------------------ input
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape') { togglePause(); return; }
  if (e.code === 'KeyM') { musicOn = !musicOn; if (musicOn) music.play('jungle'); else music.stop?.(); return; }
  if (!S || S.mode !== 'play') return;
  held.add(e.code);
  const now = performance.now();
  for (const [k, dir] of [['KeyA', -1], ['ArrowLeft', -1], ['KeyD', 1], ['ArrowRight', 1]]) {
    if (e.code === k) {
      if (now - (S.lastTap[k] || 0) < 260 && S.rollT <= 0) { S.rollT = .45; S.rollDir = dir; play('roll', .05); }
      S.lastTap[k] = now;
    }
  }
  if (e.code === 'Space' && S.y <= .001) { S.vy = 6.4; play('jump', .05); }
  if (e.code === 'KeyE') throwGrenade();
});
addEventListener('keyup', e => held.delete(e.code));
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', e => { audio(); if (e.button === 0) mouse.down = true; if (e.button === 2 && S && S.mode === 'play') throwGrenade(); });
addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('blur', () => { held.clear(); mouse.down = false; if (S && S.mode === 'play') togglePause(); });

// ------------------------------------------------------------------ main update
let soldierYaw = 180, camPos = new pc.Vec3(0, 4, 8), camLook = new pc.Vec3(0, 1.5, -10), clock = 0, fpsAcc = 0, fpsN = 0, lowFpsT = 0;
const ray0 = new pc.Vec3(), ray1 = new pc.Vec3();

function update(dt) {
  clock += dt;
  G.world.update(clock);
  if (labOn) { labUpdate(dt); return; }
  if (!S) { idleCamera(dt); return; }
  if (S.mode === 'pause') return;
  dt = Math.min(dt, 1 / 20);
  const playing = S.mode === 'play';
  if (playing) S.time += dt;

  // ---- movement
  const fwd = playing && (held.has('KeyW') || held.has('ArrowUp')), brake = held.has('KeyS') || held.has('ArrowDown');
  const left = held.has('KeyA') || held.has('ArrowLeft'), right = held.has('KeyD') || held.has('ArrowRight');
  const target = fwd ? RUN : 0;
  S.speed += (target - S.speed) * Math.min(1, dt * (brake ? 9 : fwd ? 3.2 : 4.5));
  if (!playing) S.speed *= .9;
  let lat = playing ? (right - left) * STRAFE : 0;
  if (S.rollT > 0) { S.rollT -= dt; lat = S.rollDir * ROLL; }
  S.lat += (lat - S.lat) * Math.min(1, dt * 12);
  let nd = S.d + S.speed * dt, nx = Math.max(-HALF, Math.min(HALF, S.x + S.lat * dt));
  // logs block unless you are high enough to clear them
  for (const l of S.logs) {
    if (S.y < .75 && nx > l.x0 - .4 && nx < l.x1 + .4) {
      if (S.d <= l.d - .7 && nd > l.d - .7) { nd = l.d - .7; S.speed = Math.min(S.speed, .5); if (playing && S.blockedNote !== l.d) { notice('Blocked: jump over it (Space)'); S.blockedNote = l.d; } }
    }
  }
  S.d = Math.min(LEN + 4, nd); S.x = nx;
  S.vy -= 18 * dt; S.y = Math.max(0, S.y + S.vy * dt); if (S.y === 0) S.vy = Math.max(0, S.vy);
  S.inv = Math.max(0, S.inv - dt); S.rapid = Math.max(0, S.rapid - dt); S.throwT -= dt; S.hitT -= dt;
  const gy = groundH(S.x, -S.d);

  // ---- aim: mouse ray onto the enemies, else onto a plane at chest height
  cam.camera.screenToWorld(mouse.x, mouse.y, cam.camera.nearClip, ray0);
  cam.camera.screenToWorld(mouse.x, mouse.y, 80, ray1);
  const rd = new pc.Vec3().sub2(ray1, ray0).normalize();
  let best = null, bestT = 1e9;
  for (const en of S.enemies) {
    if (en.dead) continue;
    const c = enemyCenter(en, tmpV); tmpV2.sub2(c, ray0);
    const t = tmpV2.dot(rd); if (t < 0) continue;
    const dd = tmpV2.sub2(c, new pc.Vec3().copy(rd).mulScalar(t).add(ray0)).length();
    if (dd < en.r * 1.25 && t < bestT) { bestT = t; best = c.clone(); }
  }
  if (best) S.aim.copy(best);
  else {
    const planeY = gy + 1.25; const t = rd.y < -.01 ? (planeY - ray0.y) / rd.y : 60;
    S.aim.copy(rd).mulScalar(Math.min(60, Math.max(4, t))).add(ray0);
    // keep the shot ahead of the soldier
    if (S.aim.z > -S.d - 2) S.aim.z = -S.d - 2;
  }
  // ---- soldier facing (0 = facing -z after the 180 flip)
  let want = Math.atan2(-(S.aim.x - S.x), -(S.aim.z + S.d)) * 180 / Math.PI;
  want = Math.max(-75, Math.min(75, want));
  soldierYaw += (180 + want - soldierYaw) * Math.min(1, dt * 14);
  soldier.setPosition(S.x, gy + S.y, -S.d); soldier.setEulerAngles(0, soldierYaw, 0);

  // ---- firing
  S.fireCd -= dt;
  if (playing && mouse.down && S.fireCd <= 0 && S.throwT <= 0) { shoot(); S.fireCd = 1 / (RIFLE.rate * (S.rapid > 0 ? 1.5 : 1)); }
  muzzleLight.light.intensity *= Math.pow(.0005, dt);
  flashLight.light.intensity *= Math.pow(.004, dt);

  // ---- animation
  if (S.mode === 'play' && S.rollT <= 0 && S.y < .05 && S.throwT <= 0 && S.hitT <= 0) {
    if (S.speed > 1.2) { play('run'); soldier.anim.speed = Math.max(.6, S.speed / RUN * 1.05); }
    else if (S.lat > 1.2) { play('strafeRight'); soldier.anim.speed = 1; }
    else if (S.lat < -1.2) { play('strafeLeft'); soldier.anim.speed = 1; }
    else if (mouse.down) { play('fire'); soldier.anim.speed = 1; }
    else { play('idle'); soldier.anim.speed = 1; }
  }

  // ---- level plan and waves
  while (S.planIdx < PLAN.length && PLAN[S.planIdx][0] - S.d < 46) { const [d, k, x] = PLAN[S.planIdx++]; spawn(k, d, x); }
  if (playing) {
    S.waveT -= dt;
    const live = S.enemies.filter(e => !e.dead).length;
    if (S.waveT <= 0) { if (live < 5 && S.d > 30 && S.d < LEN - 60) waveSpawn(); S.waveT = (13 + rand() * 5) * S.D.waves; }
    if (!S.finalShown && S.d > LEN - 110) { S.finalShown = true; banner('FINAL STRETCH'); music.lift?.(1.12); }
  }

  updateEnemies(dt, gy);
  updateBolts(dt, gy);
  updateLobs(dt, gy);
  updateGrenades(dt);
  updatePickups(dt);

  // ---- finish
  if (playing && S.d >= LEN) { S.mode = 'done'; S.score += Math.round(S.health * 10); play('idle'); setTimeout(() => showEnd(true), 900); }

  // ---- camera
  const cx = S.x * .55, cy = gy + S.y * .4 + 3.15, cz = -S.d + 6.4;
  camPos.lerp(camPos, tmpV.set(cx, cy, cz), Math.min(1, dt * 6));
  camLook.lerp(camLook, tmpV.set(S.x * .35 + (S.aim.x - S.x) * .08, gy + 1.7, -S.d - 12), Math.min(1, dt * 6));
  S.shake = Math.max(0, S.shake - dt * 1.6);
  const sk = S.shake * S.shake * .35;
  cam.setPosition(camPos.x + (rand() - .5) * sk, camPos.y + (rand() - .5) * sk, camPos.z);
  cam.lookAt(camLook);
  sun.setPosition(cam.getPosition());
  G.fx.ambient.setPosition(S.x, gy, -S.d);
  S.hurtFlash = Math.max(0, S.hurtFlash - dt * 2.5);
  hud();

  // adaptive quality: drop one level if the frame rate stays low for 4 s
  if (!TEST && playing) {
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 1) { const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; lowFpsT = fps < 34 ? lowFpsT + 1 : 0;
      if (lowFpsT >= 4 && quality !== 'low') { quality = quality === 'high' ? 'medium' : 'low'; applyQuality(); notice('Graphics lowered to ' + quality + ' for a smoother frame rate'); lowFpsT = 0; } }
  }
}

// face a creature (front = -Z) along a world direction
function faceDir(e, dx, dz) { if (dx || dz) e.setEulerAngles(0, Math.atan2(-dx, -dz) * 180 / Math.PI, 0); }
function makeLane() {
  const e = new pc.Entity('lane');
  e.addComponent('render', { type: 'box', material: G.laneMat, castShadows: false });
  return e;
}
function moveToward(en, tx, td, sp, dt) {
  const dx = tx - en.x, dd = td - en.d, l = Math.hypot(dx, dd);
  if (l < 1e-3) return 0;
  const k = Math.min(l, sp * dt) / l; en.x += dx * k; en.d += dd * k; return l;
}

function updateEnemies(dt, gy) {
  for (let i = S.enemies.length - 1; i >= 0; i--) {
    const en = S.enemies[i], e = en.ent;
    en.t += dt; en.flash = Math.max(0, en.flash - dt);
    const ahead = en.d - S.d, dx = S.x - en.x, dist = Math.hypot(dx, ahead);
    if (en.announce && ahead < 40) { en.announce = false; notice(FIRST_SEEN[en.kind]); }
    if (en.dead) {
      en.st += dt;
      const rigged = e.creature && hasClip(e.creature.kind, 'death');
      if (en.kind === 'wyvern') { en.y = Math.max(0, en.y - dt * 9 * Math.min(1, en.st * 2)); place(en); }
      if (rigged) { if (en.st > 1.3) { en.y -= dt * 1.5; place(en); } if (en.st > 2.2) { give(en.kind, e); S.enemies.splice(i, 1); } }
      else {
        if (e.creature) e.creature.turn.setLocalEulerAngles(0, 0, Math.min(180, en.st * 500));
        const s = Math.max(.01, 1 - en.st * 1.4); e.setLocalScale(s, s, s);
        if (en.st > .7) { give(en.kind, e); S.enemies.splice(i, 1); }
      }
      continue;
    }
    if (ahead < -16 || ahead > 130) { give(en.kind, e); releaseExtras(en); S.enemies.splice(i, 1); continue; }
    const pulse = 1 + en.flash * 1.2;
    e.setLocalScale(pulse, pulse, pulse);
    const live = S.mode === 'play';

    if (en.kind === 'raptor') {
      en.hitAnim = Math.max(0, (en.hitAnim || 0) - dt);
      if (en.state === 'move') {
        if (en.hitAnim <= 0) setClip(e, 'run', .2, 1.25);
        moveToward(en, S.x, S.d, en.hitAnim > 0 ? 1 : 5.6, dt);
        faceDir(e, dx, ahead);
        if (dist < 3.4 && live) { en.state = 'wind'; en.st = 0; setClip(e, 'wind', .1, 1.6); sfx('warn'); }
        if (ahead < -9) { en.state = 'gone'; }
      } else if (en.state === 'wind') {
        en.st += dt; faceDir(e, dx, ahead);
        if (en.st > .6) { en.state = 'leap'; en.st = 0; setClip(e, 'bite', .08, 1.5); en.lx = dx / (dist || 1); en.ld = ahead / (dist || 1); }
      } else if (en.state === 'leap') {
        en.st += dt;
        if (en.st < .35) { en.x += en.lx * 7 * dt; en.d += en.ld * 7 * dt; }
        if (en.st > .25 && !en.bit) { en.bit = true; if (Math.hypot(S.x - en.x, S.d - en.d) < 2.4 && S.y < 1.2) damagePlayer(10, 'Raptor'); }
        if (en.st > .95) { en.state = 'move'; en.bit = false; }
      } else if (en.state === 'gone') { give('raptor', e); releaseExtras(en); S.enemies.splice(i, 1); continue; }
      place(en);
    } else if (en.kind === 'spider') {
      const want = S.d + en.hold, prevD = en.d;
      en.d += Math.max(-5 * dt, Math.min(6.5 * dt, want - en.d));
      en.x += (Math.sin(en.t * .5) * (HALF - 1.5) - en.x) * dt * .6;
      const moving = Math.abs(en.d - prevD) > dt * .5;
      setClip(e, 'walk', .2, moving ? 1.5 : .35);
      place(en); faceDir(e, dx, ahead);
      en.cd -= dt;
      if (en.cd <= 0 && ahead > 6 && ahead < 22 && live) {
        en.cd = 3 + rand() * .7;
        const to = new pc.Vec3(S.x + S.lat * .5, 0, -S.d - S.speed * .9); to.y = groundH(to.x, to.z);
        const from = enemyCenter(en, new pc.Vec3()); from.y += .4;
        const ring = take('ring-acid', () => G.models.ring('acid')); ring.setPosition(to.x, to.y + .06, to.z); ring.setLocalScale(1.6, 1, 1.6);
        S.lobs.push({ ent: take('acid', () => G.models.acid()), ring, from, to, t: 0, dur: 1.25 });
        sfx('enemyShot');
      }
    } else if (en.kind === 'rat' || en.kind === 'bloat') {
      if (en.state === 'fuse') {
        en.st += dt; const f = 1 + Math.abs(Math.sin(en.st * 30)) * .25; e.setLocalScale(f, f, f);
        if (en.st > .6) { killEnemy(en); continue; }
      } else {
        en.x += Math.sin(en.t * 6 + en.d) * dt * 1.2;
        moveToward(en, S.x, S.d, en.speed, dt);
        en.x = Math.max(-HALF, Math.min(HALF, en.x));
        setClip(e, 'run', .1, en.kind === 'rat' ? 1.7 : 1.2);
        faceDir(e, dx, ahead);
        if (en.kind === 'bloat' && dist < 2.0 && live) { en.state = 'fuse'; en.st = 0; sfx('warn'); }
        if (en.kind === 'rat' && dist < 1.0 && S.y < .8 && live) { damagePlayer(4, 'Rat bite'); en.dead = true; en.st = 0; G.fx.burst('goo', e.getPosition()); }
        else if (ahead < -2.5) { if (en.kind === 'rat') damagePlayer(2, 'Rats got past'); en.dead = true; en.st = .5; }
      }
      place(en);
    } else if (en.kind === 'wyvern') {
      if (en.state === 'fly') {
        const tx = Math.sin(en.t * .45) * (HALF - 1);
        en.x += (tx - en.x) * dt * .7;
        en.d += (S.d + en.ahead - en.d) * dt * 1.1;
        en.y += (7 + Math.sin(en.t * 1.3) * .6 - en.y) * dt * 2;
        setClip(e, 'fly', .3, 1);
        faceDir(e, dx, ahead);
        en.cd -= dt; en.dive -= dt;
        if (en.cd <= 0 && ahead > 6 && ahead < 30 && live) {
          en.cd = 3.2 + rand();
          const from = enemyCenter(en, new pc.Vec3());
          fireBolt(from, new pc.Vec3(S.x + S.lat * .3, gy + 1, -S.d), true, 14); sfx('enemyShot');
        }
        if (en.dive <= 0 && ahead > 8 && ahead < 30 && live) {
          en.state = 'warn'; en.st = 0; sfx('warn');
          en.tx = S.x + S.lat * .4; en.td = S.d + S.speed * 1.1;
          en.ring = take('ring-red', () => G.models.ring('red'));
          en.ring.setPosition(en.tx, groundH(en.tx, -en.td) + .06, -en.td); en.ring.setLocalScale(2, 1, 2);
        }
      } else if (en.state === 'warn') {
        en.st += dt; en.y += dt * 2; setClip(e, 'flap', .15, 1.6);
        en.d += (S.d + en.ahead - en.d) * dt;
        faceDir(e, en.tx - en.x, en.d - en.td);
        if (en.st > .75) { en.state = 'dive'; en.st = 0; en.sx = en.x; en.sd = en.d; en.sy = en.y; }
      } else if (en.state === 'dive') {
        en.st += dt; const k = Math.min(1, en.st / 1.0);
        en.x = en.sx + (en.tx - en.sx) * k; en.d = en.sd + (en.td - en.sd) * k; en.y = en.sy + (1.3 - en.sy) * k * k;
        faceDir(e, en.tx - en.sx, en.sd - en.td);
        if (k > .75 && !en.bit && Math.hypot(S.x - en.x, S.d - en.d) < 1.6 && S.y < 1.5) { en.bit = true; damagePlayer(11, 'Wyvern dive'); }
        if (k >= 1) { en.state = 'climb'; en.st = 0; G.fx.burst('goo', new pc.Vec3(en.x, gy + .3, -en.d)); if (en.ring) { give('ring-red', en.ring); en.ring = null; } }
      } else if (en.state === 'climb') {
        en.st += dt; setClip(e, 'flap', .2, 1.4);
        en.y += dt * 4; en.d += (S.d + en.ahead - en.d) * dt * .9;
        if (en.y >= 7) { en.state = 'fly'; en.dive = 8 + rand() * 3; en.bit = false; }
      }
      place(en);
    } else if (en.kind === 'charger') {
      if (en.state === 'approach') {
        // stay about 18 m ahead, then wind up
        const want = S.d + 18;
        const sp = en.d < want - 3 ? 7.5 : 3;
        en.d += Math.max(-sp * dt, Math.min(sp * dt, want - en.d));
        en.x += (S.x - en.x) * dt * .8;
        setClip(e, en.d < want - 3 ? 'run' : 'walk', .25, 1);
        faceDir(e, dx, ahead);
        en.cd -= dt;
        if (en.cd <= 0 && ahead > 10 && ahead < 24 && live) {
          en.state = 'roar'; en.st = 0; setClip(e, 'roar', .15, 1.4); sfx('warn');
          en.lane = take('lane', makeLane);
        }
      } else if (en.state === 'roar') {
        en.st += dt; en.d = Math.max(en.d, S.d + 9);
        en.vx = S.x - en.x; en.vd = S.d - en.d; const l = Math.hypot(en.vx, en.vd) || 1; en.vx /= l; en.vd /= l;
        faceDir(e, en.vx, -en.vd);
        const len = 26, mx = en.x + en.vx * len / 2, md = en.d + en.vd * len / 2;
        en.lane.setPosition(mx, groundH(mx, -md) + .05, -md); en.lane.setEulerAngles(0, Math.atan2(-en.vx, en.vd) * 180 / Math.PI, 0);
        en.lane.setLocalScale(2.4, .02, len);
        G.laneMat.opacity = .25 + Math.abs(Math.sin(en.st * 12)) * .4; G.laneMat.update();
        if (en.st > .95) { en.state = 'charge'; en.st = 0; en.run = 0; setClip(e, 'charge', .1, 1.5); give('lane', en.lane); en.lane = null; }
      } else if (en.state === 'charge') {
        const step = 14 * dt; en.x += en.vx * step; en.d += en.vd * step; en.run += step; en.st += dt;
        en.x = Math.max(-HALF - 1, Math.min(HALF + 1, en.x));
        faceDir(e, en.vx, -en.vd);
        if (Math.random() < .5) G.fx.burst('smoke', new pc.Vec3(en.x, gy + .2, -en.d));
        if (Math.hypot(S.x - en.x, S.d - en.d) < 1.7 && S.y < 1.4 && live) {
          damagePlayer(16, 'Charger'); S.x = Math.max(-HALF, Math.min(HALF, S.x + (S.x >= en.x ? 2.5 : -2.5))); S.shake = .7;
          en.state = 'recover'; en.st = 0; setClip(e, 'butt', .1, 1.2);
        } else if (en.run > 24 || en.d < S.d - 5) {
          en.state = 'stunned'; en.st = 0; setClip(e, 'stun', .1, 1); S.shake = Math.max(S.shake, .4);
          G.fx.burst('smoke', e.getPosition()); notice('Charger stunned: double damage!');
        }
      } else if (en.state === 'stunned') {
        en.st += dt; if (en.st > 2.2) { en.state = 'recover'; en.st = 0; setClip(e, 'idle', .3); }
      } else if (en.state === 'recover') {
        en.st += dt; if (en.st > .9) { en.state = 'approach'; en.cd = 2.5 + rand(); }
      }
      if (en.d < S.d - 14) { give('charger', e); releaseExtras(en); S.enemies.splice(i, 1); continue; }
      place(en);
    } else if (en.kind === 'shell') {
      // walk to its post on the trail, then hold it, slowly turning to keep its shell toward you
      if (en.state === 'walk') {
        moveToward(en, en.post, Math.max(S.d + 22, en.d - 1), 1.6, dt);
        if (ahead < 24) en.state = 'hold';
      }
      const want = Math.atan2(-dx, -ahead) * 180 / Math.PI;
      let dy = ((want - en.yaw + 540) % 360) - 180; dy = Math.max(-45 * dt, Math.min(45 * dt, dy)); en.yaw += dy;
      e.setEulerAngles(0, en.yaw, 0);
      const br = 1 + Math.sin(en.t * 2) * .02; e.setLocalScale(pulse, pulse * br, pulse);
      // solid: the soldier cannot walk through it
      const ox = S.x - en.x, od = S.d - en.d, ol = Math.hypot(ox, od);
      if (ol < 1.9 && live) {
        if (od < 0) S.d = Math.min(S.d, en.d - Math.sqrt(Math.max(0, 1.9 * 1.9 - ox * ox)));
        en.touchT -= dt; if (en.touchT <= 0) { en.touchT = 1; damagePlayer(6, 'Shell beetle'); }
      }
      place(en);
    } else if (en.kind === 'ambush') {
      if (en.state === 'hidden') {
        if (ahead < 16 && live) { en.state = 'warn'; en.st = 0; sfx('warn'); }
      } else if (en.state === 'warn') {
        en.st += dt;
        en.mound.setLocalScale(1.9 + Math.sin(en.st * 40) * .15, .22 + Math.abs(Math.sin(en.st * 25)) * .12, 1.9);
        if (Math.random() < .3) G.fx.burst('goo', en.mound.getPosition());
        if (en.st > .8) { en.state = 'emerge'; en.st = 0; e.enabled = true; G.fx.burst('smoke', en.mound.getPosition()); give('mound', en.mound); en.mound = null; S.shake = Math.max(S.shake, .25); }
      } else if (en.state === 'emerge') {
        en.st += dt; en.y = -1.6 + Math.min(1, en.st / .35) * 1.6; faceDir(e, dx, ahead);
        if (en.st > .35) { en.state = 'lunge'; en.st = 0; en.y = 0; }
      } else {
        en.st += dt; en.cd -= dt;
        moveToward(en, S.x, S.d, en.st < 3 ? 7 : 3, dt); faceDir(e, dx, ahead);
        setClip(e, 'walk', .1, 2.2);
        if (dist < 1.8 && en.cd <= 0 && S.y < 1 && live) { en.cd = 1.3; damagePlayer(10, 'Trapdoor spider'); }
        if (ahead < -9) { give('ambush', e); releaseExtras(en); S.enemies.splice(i, 1); continue; }
      }
      place(en);
    } else if (en.kind === 'turret') {
      const p = e.parts;
      place(en);
      const c = enemyCenter(en, new pc.Vec3());
      const yaw = Math.atan2(-(S.x - c.x), -(-S.d - c.z)) * 180 / Math.PI;
      p.head.setEulerAngles(0, yaw, 0);
      p.core.setLocalScale(.2 * (1 + Math.sin(en.t * 6) * .15), .2 * (1 + Math.sin(en.t * 6) * .15), .1);
      en.cd -= dt;
      if (ahead < 34 && ahead > 2 && live) {
        if (en.cd <= 0) { en.burst = 3; en.cd = 3 + rand() * .6; en.bt = 0; }
        if (en.burst > 0) { en.bt -= dt; if (en.bt <= 0) { en.burst--; en.bt = .16; const from = c.clone(); fireBolt(from, new pc.Vec3(S.x, gy + 1.1, -S.d), true, 17); sfx('enemyShot'); } }
      }
    }
  }
}

function updateBolts(dt, gy) {
  for (let i = S.bolts.length - 1; i >= 0; i--) {
    const b = S.bolts[i];
    const step = b.speed * dt, prev = b.pos.clone();
    b.pos.add(tmpV.copy(b.dir).mulScalar(step));
    b.life -= dt;
    b.ent.setPosition(b.pos);
    let hit = false;
    if (b.enemy) {
      const px = S.x, py = groundH(S.x, -S.d) + S.y + 1, pz = -S.d;
      if (Math.hypot(b.pos.x - px, b.pos.z - pz) < .55 && Math.abs(b.pos.y - py) < 1.1) { damagePlayer(6, 'Enemy fire'); G.fx.burst('spark', b.pos, [1, .3, .1]); hit = true; }
    } else {
      for (const en of S.enemies) {
        if (en.dead) continue;
        const c = enemyCenter(en, tmpV2);
        // segment-sphere test
        const ab = new pc.Vec3().sub2(b.pos, prev), ac = new pc.Vec3().sub2(c, prev);
        const t = Math.max(0, Math.min(1, ac.dot(ab) / Math.max(1e-6, ab.lengthSq())));
        const closest = ab.mulScalar(t).add(prev);
        if (closest.distance(c) < en.r) {
          const core = en.kind === 'turret' && b.pos.z > c.z ? 2 : 1;   // the weak point faces the trail ahead
          hurtEnemy(en, RIFLE.dmg * core, closest, b.from); hit = true; break;
        }
      }
    }
    if (!hit && b.pos.y < groundH(b.pos.x, b.pos.z) + .05) { G.fx.burst('spark', b.pos); hit = true; }
    if (hit || b.life <= 0) { give(b.enemy ? 'ebolt' : 'bolt', b.ent); S.bolts.splice(i, 1); }
  }
}
function updateLobs(dt) {
  for (let i = S.lobs.length - 1; i >= 0; i--) {
    const l = S.lobs[i]; l.t += dt;
    const k = Math.min(1, l.t / l.dur);
    const p = new pc.Vec3().lerp(l.from, l.to, k); p.y += Math.sin(k * Math.PI) * 5;
    l.ent.setPosition(p);
    const rs = 1.6 * (1.4 - k * .4); l.ring.setLocalScale(rs, 1, rs);
    if (k >= 1) {
      G.fx.burst('acid', l.to);
      const gy = groundH(S.x, -S.d);
      if (Math.hypot(S.x - l.to.x, -S.d - l.to.z) < 1.6 && S.y < .8) damagePlayer(8, 'Jungle spider acid');
      const pd = take('puddle', () => G.models.puddle()); pd.setPosition(l.to.x, l.to.y + .03, l.to.z);
      S.puddles.push({ ent: pd, x: l.to.x, z: l.to.z, t: 2.2 });
      give('acid', l.ent); give('ring-acid', l.ring); S.lobs.splice(i, 1);
      void gy;
    }
  }
  for (let i = S.puddles.length - 1; i >= 0; i--) {
    const p = S.puddles[i]; p.t -= dt;
    const s = Math.min(1, p.t / .4); p.ent.setLocalScale(s, 1, s);
    if (Math.hypot(S.x - p.x, -S.d - p.z) < 1.4 && S.y < .3 && S.inv <= 0) damagePlayer(3, 'Acid puddle');
    if (p.t <= 0) { give('puddle', p.ent); S.puddles.splice(i, 1); }
  }
}
function updateGrenades(dt) {
  for (let i = S.grenades.length - 1; i >= 0; i--) {
    const g = S.grenades[i]; g.t += dt;
    const k = Math.min(1, g.t / g.dur);
    const p = new pc.Vec3().lerp(g.from, g.to, k); p.y += Math.sin(k * Math.PI) * 3.2;
    g.ent.setPosition(p); g.ent.rotateLocal(dt * 500, dt * 200, 0);
    if (k >= 1) { const q = g.to.clone(); q.y += .5; explode(q); give('gren', g.ent); S.grenades.splice(i, 1); }
  }
}
function updatePickups(dt) {
  for (let i = S.pickups.length - 1; i >= 0; i--) {
    const p = S.pickups[i]; p.t += dt;
    p.ent.parts.spin.setLocalEulerAngles(0, p.t * 120, 0);
    p.ent.parts.spin.setLocalPosition(0, .9 + Math.sin(p.t * 3) * .12, 0);
    const dd = Math.hypot(p.x - S.x, p.d - S.d);
    if (dd < 1.5 && S.mode === 'play') {
      if (p.kind === 'health') { if (S.health >= 100) continue; S.health = Math.min(100, S.health + 20); notice('+20 health'); }
      if (p.kind === 'coin') { S.coins += 5; S.score += 25; }
      if (p.kind === 'grenade') { if (S.grenadesLeft >= 3) continue; S.grenadesLeft++; notice('+1 grenade'); }
      if (p.kind === 'rapid') { S.rapid = 15; notice('Rapid fire · 15 s'); }
      G.fx.burst('pickup', p.ent.getPosition().clone().add(new pc.Vec3(0, .9, 0)), p.kind === 'health' ? [.3, 1, .4] : p.kind === 'coin' ? [1, .85, .3] : [1, .6, .2]);
      sfx('pickup'); give('p-' + p.kind, p.ent); S.pickups.splice(i, 1);
    } else if (p.d < S.d - 15) { give('p-' + p.kind, p.ent); S.pickups.splice(i, 1); }
  }
}

// ------------------------------------------------------------------ bestiary
// Every creature model in every biome skin, on pedestals behind the start line.
let labOn = false, lab = null, labKind = 'raptor';
const LAB_Z = 24, LAB_SKINS = ['forest', 'desert', 'tundra', 'volcano', 'hive'];
function buildLab() {
  lab = { peds: [], ents: [], token: 0 };
  LAB_SKINS.forEach((n, k) => {
    const x = (k - 2) * 3.4, gy = groundH(x, LAB_Z);
    const ped = new pc.Entity('pedestal');
    ped.addComponent('render', { type: 'cylinder', material: G.world.stoneMat });
    ped.setPosition(x, gy + .2, LAB_Z); ped.setLocalScale(2.6, .4, 2.6); app.root.addChild(ped);
    lab.peds.push({ ped, x, gy });
  });
  const sel = $('labModel');
  sel.innerHTML = Object.entries(CREATURES).map(([k, c]) => `<option value="${k}">${c.name} · ${c.role}</option>`).join('');
  sel.value = labKind;
  sel.addEventListener('change', () => showLabKind(sel.value));
}
async function showLabKind(kind) {
  labKind = kind; const token = ++lab.token;
  $('labStatus').textContent = 'Loading ' + CREATURES[kind].name + '…';
  try { await loadCreature(app, kind); } catch (err) { $('labStatus').textContent = 'Could not load this model'; return; }
  if (token !== lab.token) return;
  lab.ents.forEach(e => e.destroy()); lab.ents = [];
  LAB_SKINS.forEach((skin, k) => {
    const e = makeCreature(app, kind, skin === 'forest' ? null : skin, G.skinCache);
    const sz = e.creature.size, fit = Math.min(1, 2.9 / Math.max(sz[0], sz[2]), 2.6 / sz[1]);
    e.setLocalScale(fit, fit, fit);
    const p = lab.peds[k]; e.setPosition(p.x, p.gy + .4, LAB_Z); app.root.addChild(e); lab.ents.push(e);
  });
  $('labStatus').textContent = '';
}
function labUpdate(dt) {
  const gy = groundH(0, LAB_Z);
  cam.setPosition(Math.sin(clock * .12) * 1.2, gy + 3.1, LAB_Z + 12.5);
  cam.lookAt(0, gy + 1.2, LAB_Z);
  sun.setPosition(cam.getPosition());
  lab.ents.forEach((e, k) => e.setEulerAngles(0, clock * 25 + k * 30, 0));
  if (soldier) soldier.enabled = false;
  void dt;
}
function openLab(on) {
  if (on && !lab) buildLab();
  if (on && !lab.ents.length) showLabKind(labKind);
  labOn = on; $('lab').hidden = !on; $('menu').hidden = on;
  if (!on && soldier) soldier.enabled = true;
}

function idleCamera(dt) {
  // slow fly-through behind the menu
  const d = 40 + (clock * 3.2) % 600, gy = groundH(0, -d);
  cam.setPosition(Math.sin(clock * .1) * 2, gy + 3.2 + Math.sin(clock * .17) * .6, -d + 6);
  cam.lookAt(Math.sin(clock * .1 + .5) * 1.5, gy + 2.4, -d - 14);
  sun.setPosition(cam.getPosition());
  G.fx.ambient.setPosition(0, gy, -d);
  if (soldier) { soldier.setPosition(Math.sin(clock * .1) * 1.6, gy, -d - 1.5); soldier.setEulerAngles(0, 180, 0); play('run'); soldier.anim.speed = 3.2 / RUN * 1.05 + .3; }
  void dt;
}

// ------------------------------------------------------------------ HUD & screens
function fmtTime(t) { const m = Math.floor(t / 60), s = t - m * 60; return String(m).padStart(2, '0') + ':' + s.toFixed(1).padStart(4, '0'); }
let hudLast = 0;
function hud(force) {
  if (!S) return;
  const now = performance.now(); if (!force && now - hudLast < 66) return; hudLast = now;
  $('score').textContent = String(S.score).padStart(5, '0');
  $('hpfill').style.width = S.health + '%';
  $('hpfill').classList.toggle('low', S.health < 30);
  $('hpnum').textContent = Math.ceil(S.health);
  $('gren').textContent = '●'.repeat(S.grenadesLeft) + '○'.repeat(Math.max(0, 3 - S.grenadesLeft));
  $('timer').textContent = fmtTime(S.time);
  $('coins').textContent = 'COINS ' + S.coins;
  $('prog').style.width = Math.min(100, S.d / LEN * 100) + '%';
  $('dist').textContent = Math.floor(Math.min(S.d, LEN)) + ' / ' + LEN + ' m';
  $('kmh').textContent = Math.round(S.speed * 3.6);
  $('rapid').hidden = !(S.rapid > 0); $('rapid').textContent = 'RAPID FIRE ' + Math.ceil(S.rapid) + 's';
  $('hurt').style.opacity = S.hurtFlash * .55 + (S.health < 30 ? .18 + Math.sin(clock * 6) * .06 : 0);
  // reticle follows the mouse
  const r = $('reticle'); r.style.transform = `translate(${mouse.x}px, ${mouse.y}px)`;
}
let noticeT = 0;
function notice(t) { const n = $('notice'); n.textContent = t; n.classList.add('show'); clearTimeout(noticeT); noticeT = setTimeout(() => n.classList.remove('show'), 1700); }
function killpop(t) { const k = $('killpop'); k.textContent = t; k.classList.remove('pop'); void k.offsetWidth; k.classList.add('pop'); }
function banner(t) { const b = $('banner'); b.textContent = t; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }

function startGame() {
  audio();
  const diff = $('difficulty').value;
  newRun(diff);
  $('menu').hidden = true; $('end').hidden = true; $('pause').hidden = true; $('hud').hidden = false; $('reticle').hidden = false;
  document.body.classList.add('playing');
  if (musicOn) { music.play('jungle'); }
  notice('Hold W to run · mouse to aim · hold left click to fire');
}
function togglePause() {
  if (!S || (S.mode !== 'play' && S.mode !== 'pause')) return;
  if (S.mode === 'play') { S.mode = 'pause'; $('pause').hidden = false; held.clear(); mouse.down = false; }
  else { S.mode = 'play'; $('pause').hidden = true; }
}
function stars() {
  let s = 1; if (S.health >= 50) s++; if (S.time < 200 && S.kills >= 22) s++; return s;
}
function showEnd(won, cause) {
  $('hud').hidden = true; $('reticle').hidden = true; document.body.classList.remove('playing');
  $('end').hidden = false;
  $('endEyebrow').textContent = won ? 'MISSION COMPLETE' : 'MISSION FAILED';
  $('endTitle').textContent = won ? 'Overgrown Trail cleared' : (cause ? 'Downed by: ' + cause : 'Downed in the jungle');
  const acc = S.shots ? Math.round(S.hits / S.shots * 100) : 0;
  $('endRows').innerHTML = [['Time', fmtTime(S.time)], ['Kills', S.kills], ['Coins', S.coins], ['Accuracy', acc + '%'], ['Health left', Math.ceil(S.health)], ['Score', S.score]]
    .map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
  $('endStars').textContent = won ? '★'.repeat(stars()) + '☆'.repeat(3 - stars()) : '';
  music.stop?.();
}

// ------------------------------------------------------------------ boot
document.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
  quality = b.dataset.q; try { localStorage.setItem('pcforest-q', quality); } catch { /* storage unavailable */ }
  if (sun) applyQuality();
  $('qnote').textContent = quality === 'high' ? 'Shadows ×3 cascades, light shafts, SSAO, 4× MSAA' : quality === 'medium' ? 'Shadows ×2, light shafts, 4× MSAA (no SSAO)' : 'One shadow cascade, no light shafts, lower resolution';
}));
$('start').addEventListener('click', startGame);
$('again').addEventListener('click', startGame);
$('toMenu').addEventListener('click', () => { $('end').hidden = true; $('menu').hidden = false; clearRun(); animState = ''; });
$('resume').addEventListener('click', togglePause);
$('labBtn').addEventListener('click', () => openLab(true));
$('labBack').addEventListener('click', () => openLab(false));
$('quit').addEventListener('click', () => { $('pause').hidden = true; $('hud').hidden = true; $('reticle').hidden = true; $('menu').hidden = false; document.body.classList.remove('playing'); clearRun(); animState = ''; music.stop?.(); });

(async () => {
  try {
    setupView();
    app.start();
    G = await boot();
    setupSoldier();
    progress(1);
    app.on('update', update);
    $('loader').classList.add('done');
    $('menu').hidden = false;
    window.pcReady = true;
  } catch (e) {
    console.error(e);
    $('loadmsg').textContent = 'Could not start: ' + (e.message || e);
  }
})();

// test hooks for automated checks
window.pcTest = {
  start: (diff = 'medium') => { $('difficulty').value = diff; startGame(); },
  get state() { return S; },
  step(dt, n = 1) { for (let i = 0; i < n; i++) update(dt); },
  hold(code, on = true) { on ? held.add(code) : held.delete(code); },
  press(code) { dispatchEvent(new KeyboardEvent('keydown', { code })); dispatchEvent(new KeyboardEvent('keyup', { code })); },
  setMouse(x, y, down) { mouse.x = x; mouse.y = y; if (down !== undefined) mouse.down = down; },
  setQuality(q) { quality = q; applyQuality(); },
  spawn: (k, ahead, x) => spawn(k, S.d + ahead, x),
  teleport(d, x = 0) { S.d = d; S.x = x; S.planIdx = PLAN.findIndex(p => p[0] > d - 40); if (S.planIdx < 0) S.planIdx = PLAN.length; for (const p of S.pickups) if (p.d < d) p.d = -999; },
  frame: () => frame, app, openLab,
  // headless bot: runs at 30 Hz, aims at the nearest live enemy, jumps logs, returns a summary
  bot(god = false, maxT = 400, stopD = 1e9) {
    const s0 = S; let t = 0, jumps = 0;
    held.add('KeyW');
    while (S === s0 && S.mode === 'play' && t < maxT && S.d < stopD) {
      if (god) S.health = 100;
      let best = null, bd = 1e9;
      for (const en of S.enemies) { if (en.dead || en.state === 'hidden') continue; const dd = en.d - S.d; if (dd > -2 && dd < 32 && dd < bd) { bd = dd; best = en; } }
      // simple dodging: around shell beetles, out of charge lanes and dive rings
      let dodge = 0;
      for (const en of S.enemies) {
        if (en.dead) continue;
        if (en.kind === 'shell' && en.d - S.d < 8 && en.d - S.d > -1 && Math.abs(S.x - en.x) < 2.6) dodge = S.x >= en.x ? 1 : -1;
        if (en.kind === 'charger' && (en.state === 'roar' || en.state === 'charge') && Math.abs(S.x - en.x) < 2.2) dodge = S.x >= en.x ? 1 : -1;
        if (en.kind === 'wyvern' && en.state !== 'fly' && en.tx !== undefined && Math.abs(S.x - en.tx) < 2.2 && Math.abs(S.d - en.td) < 6) dodge = S.x >= en.tx ? 1 : -1;
      }
      if (dodge) { if (Math.abs(S.x) > HALF - .3) dodge = -Math.sign(S.x); held.add(dodge > 0 ? 'KeyD' : 'KeyA'); }
      if (best) { const c = enemyCenter(best, new pc.Vec3()); const sp = cam.camera.worldToScreen(c, new pc.Vec3()); mouse.x = sp.x; mouse.y = sp.y; mouse.down = true; }
      else { mouse.x = innerWidth / 2; mouse.y = innerHeight * .4; mouse.down = false; }
      for (const l of S.logs) if (l.d - S.d < 1.6 && l.d - S.d > .5 && S.x > l.x0 - .5 && S.x < l.x1 + .5 && S.y === 0) { S.vy = 6.4; jumps++; }
      for (const lb of S.lobs) if (Math.hypot(S.x - lb.to.x, -S.d - lb.to.z) < 2 && lb.t > lb.dur - .5) { held.add(S.x > lb.to.x ? 'KeyD' : 'KeyA'); }
      update(1 / 30); t += 1 / 30;
      held.delete('KeyA'); held.delete('KeyD');
    }
    if (S.d < stopD) { held.delete('KeyW'); mouse.down = false; }
    hud(true);
    return { mode: S.mode, d: Math.round(S.d), time: +S.time.toFixed(1), health: Math.round(S.health), kills: S.kills, shots: S.shots, hits: S.hits, dmg: Math.round(S.damageTaken), jumps, score: S.score, by: S.dmgBy };
  }
};
