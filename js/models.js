// Procedural 3D models for the remaster: the five Forest enemies, pickups and
// projectiles. Each builder returns an entity with named moving parts so the game
// can animate legs, rotors, caps and turret heads in code.
import * as pc from './playcanvas.min.mjs';
import { Geo, mat4, sphere, tube, box } from './geo.js';

const part = (name, mesh, material, parent, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], shadows = true } = {}) => {
  const e = new pc.Entity(name);
  e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: shadows, receiveShadows: true });
  e.setLocalPosition(...pos); e.setLocalEulerAngles(...rot); e.setLocalScale(...scale);
  parent.addChild(e); return e;
};
const pivot = (name, parent, pos = [0, 0, 0], rot = [0, 0, 0]) => {
  const e = new pc.Entity(name); e.setLocalPosition(...pos); e.setLocalEulerAngles(...rot); parent.addChild(e); return e;
};
const mat = (o) => { const m = new pc.StandardMaterial(); m.useMetalness = true; Object.assign(m, o); m.update(); return m; };

export function makeModels(app, tex) {
  const d = app.graphicsDevice;
  const M = {
    metal: mat({ diffuse: new pc.Color(.16, .17, .18), metalness: .85, gloss: .72 }),
    gunmetal: mat({ diffuse: new pc.Color(.3, .31, .29), metalness: .9, gloss: .55 }),
    brass: mat({ diffuse: new pc.Color(.75, .55, .22), metalness: 1, gloss: .7 }),
    redEye: mat({ diffuse: new pc.Color(0, 0, 0), emissive: new pc.Color(1, .12, .05), emissiveIntensity: 9 }),
    cyanEye: mat({ diffuse: new pc.Color(0, 0, 0), emissive: new pc.Color(.2, .95, 1), emissiveIntensity: 8 }),
    greenGlow: mat({ diffuse: new pc.Color(0, 0, 0), emissive: new pc.Color(.45, 1, .15), emissiveIntensity: 2.2 }),
    chitin: mat({ diffuseMap: tex.chitin, metalness: 0, gloss: .45 }),
    bronze: mat({ diffuseMap: tex.chitin, diffuse: new pc.Color(1.6, 1.1, .55), metalness: .35, gloss: .55 }),
    cap: mat({ diffuseMap: tex.cap, metalness: 0, gloss: .48, clearCoat: .35, clearCoatGloss: .7 }),
    flesh: mat({ diffuse: new pc.Color(.86, .8, .66), metalness: 0, gloss: .3 }),
    gills: mat({ diffuse: new pc.Color(.55, .45, .35), metalness: 0, gloss: .2 }),
    rotor: mat({ diffuse: new pc.Color(.05, .05, .05), opacity: .35, blendType: pc.BLEND_NORMAL, depthWrite: false, metalness: .5, gloss: .8 }),
    stone: null
  };
  const unitSphere = sphere(16, 12, 1).mesh(d);
  const hemi = sphere(18, 12, 1, { hemi: true }).mesh(d);
  const cyl = tube([{ x: 0, y: 0, z: 0, r: 1 }, { x: 0, y: 1, z: 0, r: 1 }], 14).mesh(d);
  const cube = box(1, 1, 1).mesh(d);
  const disc = tube([{ x: 0, y: 0, z: 0, r: 1 }, { x: 0, y: .02, z: 0, r: 1 }], 24).mesh(d);
  const legSeg = tube([{ x: 0, y: 0, z: 0, r: .1 }, { x: 0, y: .25, z: .02, r: .11 }, { x: 0, y: .6, z: .03, r: .07 }, { x: 0, y: 1, z: 0, r: .03 }], 7).mesh(d);
  const meshes = { unitSphere, hemi, cyl, cube, disc };

  // ---------- drone: armoured eye with four rotors ----------
  function drone() {
    const e = new pc.Entity('drone'), body = pivot('body', e);
    part('shell', unitSphere, M.metal, body, { scale: [.55, .42, .55] });
    part('band', cyl, M.brass, body, { pos: [0, -.06, 0], scale: [.58, .12, .58] });
    part('eye', unitSphere, M.redEye, body, { pos: [0, -.02, -.47], scale: [.17, .17, .1], shadows: false });
    part('gun', cyl, M.gunmetal, body, { pos: [0, -.32, -.1], rot: [90, 0, 0], scale: [.06, .5, .06] });
    const rotors = [];
    for (let k = 0; k < 4; k++) {
      const a = k * 90 + 45, arm = pivot('arm', body, [0, .05, 0], [0, a, 0]);
      part('strut', cube, M.gunmetal, arm, { pos: [.55, 0, 0], scale: [.7, .06, .1] });
      part('pod', cyl, M.metal, arm, { pos: [.9, -.05, 0], scale: [.1, .18, .1] });
      const r = pivot('rotor', arm, [.9, .15, 0]);
      part('blade', disc, M.rotor, r, { scale: [.34, 1, .34], shadows: false });
      part('bar', cube, M.metal, r, { scale: [.66, .02, .05] });
      rotors.push(r);
    }
    e.parts = { body, rotors };
    return e;
  }

  // ---------- crawler: armoured beetle with six legs ----------
  function crawler() {
    const e = new pc.Entity('crawler'), body = pivot('body', e, [0, .55, 0]);
    part('shell', hemi, M.bronze, body, { scale: [.75, .55, 1.1] });
    part('belly', unitSphere, M.gills, body, { pos: [0, -.02, 0], scale: [.7, .22, 1.02] });
    part('head', unitSphere, M.chitin, body, { pos: [0, .05, -1.05], scale: [.42, .3, .38] });
    for (const s of [-1, 1]) {
      part('eye', unitSphere, M.redEye, body, { pos: [s * .2, .14, -1.32], scale: [.07, .07, .07], shadows: false });
      part('mandible', cyl, M.gunmetal, body, { pos: [s * .14, -.04, -1.3], rot: [-80, s * 25, 0], scale: [.04, .32, .04] });
    }
    const legs = [];
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const hip = pivot('hip', body, [s * .62, -.05, -.45 + k * .48], [0, 0, s * 70]);
      part('leg', legSeg, M.chitin, hip, { scale: [1, .8, 1] });
      const knee = pivot('knee', hip, [0, .78, 0], [0, 0, -s * 110]);
      part('shin', legSeg, M.chitin, knee, { scale: [1, .7, 1] });
      legs.push({ hip, knee, s, k });
    }
    e.parts = { body, legs };
    return e;
  }

  // ---------- turret: stone plinth, armoured head, cyan weak point ----------
  function turret() {
    const e = new pc.Entity('turret');
    part('plinth', cyl, M.metal, e, { scale: [.9, .7, .9] });
    part('ring', cyl, M.brass, e, { pos: [0, .7, 0], scale: [.75, .12, .75] });
    const head = pivot('head', e, [0, 1.2, 0]);
    part('housing', unitSphere, M.metal, head, { scale: [.62, .5, .7] });
    part('armour', cube, M.gunmetal, head, { pos: [0, .3, -.05], scale: [1.1, .16, 1.1] });
    for (const s of [-1, 1]) part('barrel', cyl, M.gunmetal, head, { pos: [s * .18, -.02, -.4], rot: [90, 0, 0], scale: [.07, .95, .07] });
    const core = part('core', unitSphere, M.cyanEye, head, { pos: [0, 0, .58], scale: [.2, .2, .1], shadows: false });
    part('eye', unitSphere, M.redEye, head, { pos: [0, .12, -.6], scale: [.12, .08, .06], shadows: false });
    e.parts = { head, core };
    return e;
  }

  // ---------- mushroom brute (rusher): heavy red cap, stubby legs, big fists ----------
  function brute() {
    const e = new pc.Entity('brute'), body = pivot('body', e, [0, 0, 0]);
    const torso = pivot('torso', body, [0, 1.0, 0]);
    part('stalk', unitSphere, M.flesh, torso, { scale: [.62, .85, .55] });
    const capP = pivot('capP', torso, [0, .78, 0]);
    part('cap', hemi, M.cap, capP, { scale: [1.25, .8, 1.15] });
    part('gills', disc, M.gills, capP, { pos: [0, -.01, 0], scale: [1.2, 1, 1.1] });
    for (const s of [-1, 1]) part('eye', unitSphere, M.redEye, torso, { pos: [s * .2, .35, -.48], scale: [.08, .1, .05], shadows: false });
    part('mouth', cube, M.gills, torso, { pos: [0, .08, -.5], scale: [.34, .08, .05] });
    const arms = [];
    for (const s of [-1, 1]) {
      const sh = pivot('shoulder', torso, [s * .58, .25, 0], [0, 0, s * 20]);
      part('arm', unitSphere, M.flesh, sh, { pos: [0, -.4, 0], scale: [.2, .45, .2] });
      part('fist', unitSphere, M.cap, sh, { pos: [0, -.9, -.05], scale: [.3, .3, .3] });
      arms.push({ sh, s });
    }
    const legs = [];
    for (const s of [-1, 1]) {
      const hp = pivot('hip', body, [s * .28, .55, 0]);
      part('leg', unitSphere, M.flesh, hp, { pos: [0, -.25, 0], scale: [.2, .35, .2] });
      legs.push({ hp, s });
    }
    e.parts = { body, torso, capP, arms, legs };
    return e;
  }

  // ---------- jungle spider (spitter): glowing acid sac, eight legs ----------
  function spider() {
    const e = new pc.Entity('spider'), body = pivot('body', e, [0, 1.0, 0]);
    part('thorax', unitSphere, M.chitin, body, { scale: [.55, .38, .62] });
    const abd = pivot('abd', body, [0, .28, .85]);
    part('abdomen', unitSphere, M.chitin, abd, { scale: [.8, .62, .95] });
    for (let k = 0; k < 5; k++) part('sac', unitSphere, M.greenGlow, abd, { pos: [Math.sin(k * 2.3) * .45, .45 + Math.cos(k) * .1, (k - 2) * .26], scale: [.1, .06, .12], shadows: false });
    for (let k = 0; k < 4; k++) part('eye', unitSphere, M.greenGlow, body, { pos: [(k % 2 ? 1 : -1) * (.08 + (k > 1 ? .12 : 0)), .12 + (k > 1 ? -.04 : .04), -.6], scale: [.06, .06, .04], shadows: false });
    part('fang', cyl, M.gunmetal, body, { pos: [0, -.18, -.62], rot: [-110, 0, 0], scale: [.05, .3, .05] });
    const legs = [];
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      const hip = pivot('hip', body, [s * .4, 0, -.35 + k * .25], [0, s * (-35 + k * 25), s * 60]);
      part('leg', legSeg, M.chitin, hip, { scale: [1.2, 1.1, 1.2] });
      const knee = pivot('knee', hip, [0, 1.08, 0], [0, 0, -s * 120]);
      part('shin', legSeg, M.chitin, knee, { scale: [1.1, 1.3, 1.1] });
      legs.push({ hip, knee, s, k });
    }
    e.parts = { body, abd, legs };
    return e;
  }

  // ---------- pickups ----------
  const glowMat = (c, i = 5) => mat({ diffuse: new pc.Color(0, 0, 0), emissive: new pc.Color(...c), emissiveIntensity: i });
  function pickup(kind) {
    const e = new pc.Entity('pickup-' + kind), spin = pivot('spin', e, [0, .9, 0]);
    if (kind === 'health') {
      const g = glowMat([.2, 1, .35], 4);
      part('h', cube, g, spin, { scale: [.6, .2, .2] }); part('v', cube, g, spin, { scale: [.2, .6, .2] });
    } else if (kind === 'coin') {
      part('coin', cyl, M.brass, spin, { rot: [90, 0, 0], pos: [0, 0, -.04], scale: [.32, .08, .32] });
    } else if (kind === 'grenade') {
      part('g', unitSphere, M.gunmetal, spin, { scale: [.26, .3, .26] });
      part('band', cyl, glowMat([1, .5, .1], 5), spin, { pos: [0, -.03, 0], scale: [.27, .06, .27] });
      part('pin', cyl, M.brass, spin, { pos: [0, .28, 0], scale: [.06, .12, .06] });
    } else if (kind === 'rapid') {
      const g = glowMat([1, .85, .2], 5);
      part('a', cube, g, spin, { pos: [-.08, .14, 0], rot: [0, 0, -25], scale: [.16, .42, .12] });
      part('b', cube, g, spin, { pos: [.08, -.14, 0], rot: [0, 0, -25], scale: [.16, .42, .12] });
    }
    const halo = part('halo', disc, glowMat(kind === 'health' ? [.2, 1, .35] : kind === 'coin' ? [1, .8, .3] : kind === 'grenade' ? [1, .5, .1] : [1, .85, .2], 1.6), e, { pos: [0, .04, 0], scale: [.7, 1, .7], shadows: false });
    e.parts = { spin, halo };
    return e;
  }

  // ---------- projectiles and markers ----------
  const boltMat = glowMat([.35, .95, 1], 14), enemyBoltMat = glowMat([1, .22, .08], 12), acidMat = glowMat([.5, 1, .1], 7);
  function bolt(enemy) {
    const e = new pc.Entity('bolt');
    if (enemy) part('b', unitSphere, enemyBoltMat, e, { scale: [.16, .16, .16], shadows: false });
    else part('b', cube, boltMat, e, { scale: [.05, .05, 1.1], shadows: false });
    return e;
  }
  function acid() { const e = new pc.Entity('acid'); part('a', unitSphere, acidMat, e, { scale: [.22, .22, .22], shadows: false }); return e; }
  function grenadeBall() { const e = new pc.Entity('grenade'); part('g', unitSphere, M.gunmetal, e, { scale: [.14, .17, .14] }); part('l', unitSphere, glowMat([1, .5, .1], 8), e, { pos: [0, .16, 0], scale: [.05, .05, .05], shadows: false }); return e; }
  const ringMat = (c) => mat({ diffuse: new pc.Color(0, 0, 0), emissive: new pc.Color(...c), emissiveIntensity: 3, opacity: .85, blendType: pc.BLEND_ADDITIVE, depthWrite: false });
  const ringMesh = (() => { const g = new Geo(); const n = 40; for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); g.vert(c * .88, 0, s * .88, 0, 1, 0, k / n, 0); g.vert(c, 0, s, 0, 1, 0, k / n, 1); } for (let k = 0; k < n; k++) g.quad(k * 2, k * 2 + 1, k * 2 + 3, k * 2 + 2); return g.mesh(d); })();
  const redRing = ringMat([1, .15, .05]), greenRing = ringMat([.45, 1, .1]), puddleMat = mat({ diffuse: new pc.Color(.1, .3, .02), emissive: new pc.Color(.35, .9, .08), emissiveIntensity: 1.8, opacity: .7, blendType: pc.BLEND_NORMAL, depthWrite: false });
  function ring(kind) { const e = new pc.Entity('ring'); part('r', ringMesh, kind === 'acid' ? greenRing : redRing, e, { shadows: false }); return e; }
  function puddle() { const e = new pc.Entity('puddle'); part('p', disc, puddleMat, e, { scale: [1.6, 1, 1.6], shadows: false }); return e; }
  function log(world) {
    const e = new pc.Entity('log');
    part('log', world.logMesh, world.barkMat, e);
    return e;
  }

  return { M, meshes, drone, crawler, turret, brute, spider, pickup, bolt, acid, grenadeBall, ring, puddle, log, part, pivot };
}
