// Creature models: loads the downloaded and reduced GLB models, works out which
// way each one faces, stands it on the ground at game scale, wires its animation
// clips by name and applies a biome skin. Every creature comes back wrapped so its
// front faces -Z, the convention the game's movement and aiming code uses.
import * as pc from './playcanvas.min.mjs';
import { applyBiomeSkin } from './skins.js';

// clips: state name -> text the clip name ends with (or contains)
// forward: model-space facing for models without head/tail bones
export const CREATURES = {
  raptor: { file: 'raptor.glb', name: 'Raptor', role: 'Rusher', height: 2.0,
    clips: { run: 'Raptor_Run1', idle: 'Raptor_Idle1', wind: 'Raptor_Screech1', bite: 'Raptor_Bite1', leap: 'Raptor_Leap1', hit: 'Raptor_Hit1', death: 'Raptor_Death1', roar: 'Raptor_Roar1' },
    loop: ['run', 'idle'], main: 'run', head: 'Head_09', tail: 'Tail_IK_end', hitH: 1.15, hitR: 1.1 },
  spider: { file: 'spider.glb', name: 'Jungle spider', role: 'Spitter', height: 1.0,
    clips: { walk: 'Scene' }, loop: ['walk'], main: 'walk', forward: [0, 1], hitH: .55, hitR: 1.15 },
  rat: { file: 'rat.glb', name: 'Jungle rat', role: 'Swarm', height: .8,
    clips: { run: 'run_A1', idle: 'idle_A1' }, loop: ['run', 'idle'], main: 'run', head: 'Head_Jaw.002', tail: 'Tail.Stretch.004', hitH: .45, hitR: .75 },
  wyvern: { file: 'wyvern.glb', name: 'Wyvern', role: 'Flyer', span: 7,
    clips: { fly: 'metarigflying', flap: 'metarigflaping' }, loop: ['fly', 'flap'], main: 'fly', head: 'head_021', tail: 'tail.7_012', hitH: .2, hitR: 1.7 },
  charger: { file: 'charger.glb', name: 'Charger', role: 'Elite charger', height: 2.6,
    clips: { run: '_Run', walk: '_Walk', idle: '_IdleA', roar: '_Roar', charge: '_Charge', hit: '_HurtHigh', stun: '_KnockedDown', death: '_KnockedOut', butt: '_Headbutt' },
    loop: ['run', 'walk', 'idle', 'charge'], main: 'walk', head: 'Head_09', tail: 'Tail9_end', hitH: 1.4, hitR: 1.55 },
  shell: { file: 'shell_beetle.glb', name: 'Shell beetle', role: 'Armoured blocker', height: 1.45, forward: [1, 0], hitH: .75, hitR: 1.55, skin: 'moss' },
  // the rest of the roster: shown in the Bestiary, used by later biomes
  imp: { file: 'imp.glb', name: 'Imp', role: 'Rusher (Tundra, Volcano)', height: 1.8, forward: [0, 1] },
  ant: { file: 'ant.glb', name: 'Giant ant', role: 'Rusher (Alien City)', height: 1.3, forward: [-1, 0] },
  stalker: { file: 'stalker.glb', name: 'Pink stalker', role: 'Rusher (Desert)', height: 1.4, forward: [0, 1] },
  crab: { file: 'crab.glb', name: 'Crab', role: 'Swarm (Desert, Space)', height: .8, forward: [0, 1] },
  spiked_crawler: { file: 'spiked_crawler.glb', name: 'Spiked crawler', role: 'Swarm (Tundra, Volcano)', height: 1.3, forward: [0, 1], skin: 'moss' },
  razorback: { file: 'razorback.glb', name: 'Razorback boar', role: 'Elite charger (Desert, Tundra)', height: 1.8, forward: [0, 1], skin: 'moss' },
  furnace_bull: { file: 'furnace_bull.glb', name: 'Furnace bull', role: 'Elite charger (Volcano)', height: 1.9, forward: [0, 1] },
  void_hound: { file: 'void_hound.glb', name: 'Void hound', role: 'Rusher (Space)', height: 1.8, forward: [0, 1] },
  tarantula: { file: 'tarantula.glb', name: 'Tarantula', role: 'Spitter (Desert, Space)', height: .9, forward: [0, 1] },
  mushroom_dragon: { file: 'mushroom_dragon.glb', name: 'Mushroom dragon', role: 'Forest boss', height: 3.2, forward: [-1, 0] }
};
export const LEVEL_KINDS = ['raptor', 'spider', 'rat', 'wyvern', 'charger', 'shell'];

const res = {}, meta = {};
const frames = (app, n) => new Promise(r => { let k = 0; const f = () => { if (++k >= n) { app.off('update', f); r(); } }; app.on('update', f); });
function findClip(tracks, key) {
  return tracks.find(t => t.name.endsWith(key)) || tracks.find(t => t.name.includes(key));
}
function worldBox(e) {
  const b = new pc.BoundingBox(); let first = true;
  e.findComponents('render').forEach(r => r.meshInstances.forEach(mi => { if (first) { b.copy(mi.aabb); first = false; } else b.add(mi.aabb); }));
  return b;
}
function addAnim(inst, kind) {
  const C = CREATURES[kind], r = res[kind];
  if (!C.clips || !r.animations.length) return null;
  inst.addComponent('anim', { activate: true });
  const tracks = r.animations.map(a => a.resource);
  for (const [state, key] of Object.entries(C.clips)) {
    const t = findClip(tracks, key);
    if (t) inst.anim.assignAnimation(state, t, undefined, 1, (C.loop || []).includes(state));
  }
  inst.anim.baseLayer.transition(C.main, 0);
  return inst.anim;
}

// Load a creature's file and measure it once: facing, scale, ground offset.
export async function loadCreature(app, kind, base = 'models/') {
  if (meta[kind]) return meta[kind];
  const C = CREATURES[kind];
  res[kind] = await new Promise((ok, fail) => app.assets.loadFromUrl(base + C.file, 'container', (e, a) => e ? fail(e) : ok(a.resource)));
  const probe = res[kind].instantiateRenderEntity();
  probe.setPosition(0, -500, 0); app.root.addChild(probe);
  addAnim(probe, kind);
  await frames(app, 3);
  // facing: head minus tail bone (in the clip's pose) or the fixed forward hint
  let fx = 0, fz = 1;
  const head = C.head && probe.findByName(C.head);
  const tail = C.tail && probe.find(n => n.name && n.name.includes(C.tail))[0];
  if (head && tail) { const h = head.getPosition(), t = tail.getPosition(); fx = h.x - t.x; fz = h.z - t.z; }
  else if (C.forward) { fx = C.forward[0]; fz = C.forward[1]; }
  const yaw = Math.atan2(fx, -fz) * 180 / Math.PI;
  const box = worldBox(probe);
  probe.destroy();
  const size = [box.halfExtents.x * 2, box.halfExtents.y * 2, box.halfExtents.z * 2];
  const scale = C.span ? C.span / Math.max(size[0], size[2]) : (C.height || 1.5) / size[1];
  meta[kind] = { yaw, scale, center: [box.center.x, box.center.y + 500, box.center.z], half: [box.halfExtents.x, box.halfExtents.y, box.halfExtents.z], size };
  return meta[kind];
}

// A ready creature: wrapper (front = -Z, feet on y = 0) + its anim component.
export function makeCreature(app, kind, skin = null, cache = new Map(), extraScale = 1) {
  const C = CREATURES[kind], M = meta[kind];
  const wrap = new pc.Entity(kind), turn = new pc.Entity('turn');
  wrap.addChild(turn);
  const inst = res[kind].instantiateRenderEntity({ castShadows: true, receiveShadows: true });
  turn.addChild(inst);
  const s = M.scale * extraScale;
  inst.setLocalScale(s, s, s);
  inst.setLocalPosition(-M.center[0] * s, -(M.center[1] - M.half[1]) * s, -M.center[2] * s);
  turn.setLocalEulerAngles(0, M.yaw, 0);
  const anim = addAnim(inst, kind);
  const sk = skin || C.skin;
  if (sk) applyBiomeSkin(app, inst, sk, cache);
  wrap.creature = { kind, anim, cur: C.main, inst, turn, size: M.size.map(v => v * s) };
  return wrap;
}

export function setClip(wrap, state, blend = .15, speed = 1) {
  const c = wrap.creature; if (!c.anim) return;
  if (c.cur !== state) { c.anim.baseLayer.transition(state, blend); c.cur = state; }
  c.anim.speed = speed;
}
export const hasClip = (kind, state) => !!(CREATURES[kind].clips && CREATURES[kind].clips[state]);
