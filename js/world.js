// The Forest, rebuilt as a real 3D scene: HDR sky and image-based light, PBR forest
// floor, instanced giant buttress-root trees with leaf-card canopies, ferns, grass,
// mossy rocks, glowing mushrooms, hanging vines and the temple gate at the finish.
import * as pc from './playcanvas.min.mjs';
import { Geo, Batch, mat4, sphere, tube, box } from './geo.js';
import { fbm, rand, setSeed } from './textures.js';

export const HALF = 5.5;          // half-width of the playable trail (m)
const W = 130;                      // half-width of the ground strip

// Ground height: the trail is flat; banks rise beyond it to frame the corridor.
export function groundH(x, z) {
  const ax = Math.abs(x);
  const wob = Math.sin(z * .021) * 1.5 + Math.sin(z * .053) * .6;
  const bank = Math.max(0, ax - 9 - wob) / 22;
  const s = Math.min(1, bank); const sm = s * s * (3 - 2 * s);
  const n = fbm(x * .05 + 40, z * .05, 3);
  const small = (fbm(x * .4, z * .4, 2) - .5) * .12;
  const far = Math.min(1.6, Math.max(0, ax - 34) / 60);
  return sm * (2.5 + n * 6.5) + far * far * 34 * (.6 + n * .8) + (ax > 7 ? (n - .5) * .5 * Math.min(1, (ax - 7) / 4) : 0) + small;
}

// Wind sway: patch the engine's transform chunk so foliage bends in world space,
// weighted by how far a vertex sits from its mesh origin.
function windify(device, material, strength, mode) {
  const base = pc.ShaderChunks.get(device, pc.SHADERLANGUAGE_GLSL).get('transformVS');
  const weight = mode === 'height' ? 'clamp(localPos.y, 0.0, 4.0)' : 'clamp(length(localPos) - 0.6, 0.0, 4.0)';
  const code = 'uniform float uWindTime;\nuniform float uWindStr;\n' + base.replace('vec4 posW = modelMatrix * vec4(localPos, 1.0);',
    `vec4 posW = modelMatrix * vec4(localPos, 1.0);
    {
      float w = ${weight} * uWindStr;
      float ph = posW.x * 0.31 + posW.z * 0.23;
      posW.x += sin(uWindTime * 1.6 + ph) * w * 0.10 + sin(uWindTime * 4.1 + ph * 3.0) * w * 0.025;
      posW.z += cos(uWindTime * 1.3 + ph) * w * 0.06;
      posW.y += sin(uWindTime * 2.3 + ph * 2.0) * w * 0.02;
    }`);
  material.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set('transformVS', code);
  material.shaderChunksVersion = '2.24';
  material.setParameter('uWindStr', strength);
  material.update();
  return material;
}

function std(opts) {
  const m = new pc.StandardMaterial();
  m.useMetalness = true; m.metalness = 0; m.gloss = .3;
  Object.assign(m, opts);
  m.update();
  return m;
}

export function buildWorld(app, tex, floor, LEN, quality) {
  const device = app.graphicsDevice, root = new pc.Entity('world');
  app.root.addChild(root);
  setSeed(20261124);
  const windMats = [];

  // ---------------- materials ----------------
  const groundMat = std({
    diffuseMap: floor.diff, normalMap: floor.nor, glossMap: floor.rough, glossInvert: true, gloss: 1, bumpiness: 1.4,
    diffuseVertexColor: true, diffuseMapTiling: new pc.Vec2(1, 1)
  });
  const barkMat = std({ diffuseMap: tex.bark.map, normalMap: tex.bark.normal, bumpiness: 1.6, gloss: .18, diffuseVertexColor: true });
  const leafMat = std({ diffuseMap: tex.leaves, opacityMap: tex.leaves, opacityMapChannel: 'a', alphaTest: .45, cull: pc.CULLFACE_NONE, twoSidedLighting: false, gloss: .42, diffuseVertexColor: true });
  // a little light bleeding through the leaves
  leafMat.emissive = new pc.Color(.05, .09, .02); leafMat.emissiveMap = tex.leaves; leafMat.update();
  const fernMat = std({ diffuseMap: tex.fern, opacityMap: tex.fern, opacityMapChannel: 'a', alphaTest: .4, cull: pc.CULLFACE_NONE, gloss: .38 });
  const grassMat = std({ diffuseMap: tex.grass, opacityMap: tex.grass, opacityMapChannel: 'a', alphaTest: .4, cull: pc.CULLFACE_NONE, gloss: .3 });
  const rockMat = std({ diffuseMap: tex.stone.map, normalMap: tex.stone.normal, bumpiness: 1.2, gloss: .25, diffuseVertexColor: true });
  const stoneMat = std({ diffuseMap: tex.stone.map, normalMap: tex.stone.normal, bumpiness: 1.6, gloss: .22 });
  const shroomMat = std({ diffuseVertexColor: true, emissiveVertexColor: true, emissive: new pc.Color(1, 1, 1), emissiveIntensity: 2.4, gloss: .6 });
  windify(device, leafMat, .55, 'radius'); windify(device, fernMat, .8, 'height'); windify(device, grassMat, 1.2, 'height');
  windMats.push(leafMat, fernMat, grassMat);

  // ---------------- ground ----------------
  {
    const g = new Geo(), z0 = 40, z1 = -LEN - 120, step = quality === 'low' ? 3.5 : 2.5;
    const cols = Math.round(2 * W / step), rows = Math.round((z0 - z1) / step);
    g.grid(cols, rows, (u, v) => {
      const x = -W + u * 2 * W, z = z0 + (z1 - z0) * v, y = groundH(x, z);
      const ax = Math.abs(x), wob = Math.sin(z * .07) * .6 + (fbm(x * .3, z * .3, 2) - .5) * 1.6;
      const path = Math.max(0, Math.min(1, (4.6 + wob - ax) / 1.6));
      const moss = Math.min(1, Math.max(0, (ax - 6) / 10));
      const n = fbm(x * .08 + 7, z * .08, 3);
      const c = [
        (.62 + .4 * path) * (1 - moss * .25) * (.85 + n * .3),
        (.66 + .3 * path) * (1 + moss * .05) * (.85 + n * .3),
        (.48 + .3 * path) * (1 - moss * .35) * (.85 + n * .3), 1];
      return { p: [x, y, z], uv: [x / 3.2, z / 3.2], c };
    });
    g.recalcNormals();
    const e = new pc.Entity('ground');
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(g.mesh(device, { colors: true }), groundMat)], castShadows: false, receiveShadows: true });
    root.addChild(e);
  }

  // ---------------- trees ----------------
  const trunks = [], anchors = [];
  for (let v = 0; v < 3; v++) {
    const H = [26, 20, 15][v], R = [1.25, .9, .55][v], g = new Geo(), pts = [];
    const bend = (rand() - .5) * 1.4;
    for (let k = 0; k <= 14; k++) { const t = k / 14; pts.push({ x: Math.sin(t * 2.2) * bend, y: -.6 + t * H, z: Math.cos(t * 1.7) * bend * .4, r: R * (1 - t * .45) }); }
    const fins = 5 + v;
    g.append(tube(pts, 18, {
      uvU: 3, uvV: .22,
      flare: (th, t) => 1 + Math.pow(Math.abs(Math.sin(th * fins * .5)), 3) * 2.6 * Math.exp(-t * 9) + Math.exp(-t * 14) * .5 + (fbm(th * 2, t * 6, 2) - .5) * .25,
      color: t => [1, 1, 1, 1]
    }));
    const anc = [{ x: pts[14].x, y: H, z: pts[14].z, s: 1.35 }];
    const limbs = 3 + v;
    for (let l = 0; l < limbs; l++) {
      const a = l / limbs * Math.PI * 2 + rand(), t0 = .55 + rand() * .3, p0 = pts[Math.round(t0 * 14)];
      const len = H * (.25 + rand() * .15), lp = [];
      for (let k = 0; k <= 5; k++) { const t = k / 5; lp.push({ x: p0.x + Math.cos(a) * len * t, y: p0.y + len * .55 * t - t * t * 1.2, z: p0.z + Math.sin(a) * len * t, r: R * .38 * (1 - t * .7) }); }
      g.append(tube(lp, 8, { uvU: 1, uvV: .3 }));
      anc.push({ x: lp[5].x, y: lp[5].y + .5, z: lp[5].z, s: 1 }, { x: lp[3].x, y: lp[3].y + .8, z: lp[3].z, s: .75 });
    }
    trunks.push(g.mesh(device, { colors: true })); anchors.push(anc);
  }
  // leaf cluster: cards on a sphere, normals pointing out for soft volume lighting
  const cluster = new Geo();
  for (let k = 0; k < 32; k++) {
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const n = new pc.Vec3(s * Math.cos(th), u * .7 + .25, s * Math.sin(th)).normalize();
    const c = new pc.Vec3().copy(n).mulScalar(1.7 + rand() * .8);
    const t1 = new pc.Vec3().cross(n, new pc.Vec3(rand() - .5, 1, rand() - .5)).normalize(), t2 = new pc.Vec3().cross(n, t1);
    const sz = 1.6 + rand() * 1.1, tint = .75 + rand() * .45, col = [tint * (.9 + rand() * .2), tint, tint * .85, 1];
    const b = cluster.count;
    for (const [a, bb, uu, vv] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) {
      const pnt = new pc.Vec3().copy(c).add(new pc.Vec3().copy(t1).mulScalar(a * sz)).add(new pc.Vec3().copy(t2).mulScalar(bb * sz));
      const nn = new pc.Vec3().copy(pnt).normalize();
      cluster.vert(pnt.x, pnt.y, pnt.z, nn.x, nn.y, nn.z, uu, vv, col);
    }
    cluster.quad(b, b + 1, b + 2, b + 3);
  }
  const clusterMesh = cluster.mesh(device, { colors: true });

  const trunkB = trunks.map(m => new Batch(m, barkMat));
  const leafB = new Batch(clusterMesh, leafMat), shrubB = new Batch(clusterMesh, leafMat);
  const treeSpots = [];
  const addTree = (x, z, v, s, ry) => {
    const y = groundH(x, z) - .2;
    trunkB[v].add(mat4(x, y, z, ry, s));
    const m = mat4(0, 0, 0, ry, s), p = new pc.Vec3();
    for (const a of anchors[v]) {
      m.transformPoint(new pc.Vec3(a.x, a.y, a.z), p);
      leafB.add(mat4(x + p.x, y + p.y, z + p.z, rand() * 360, s * a.s * (1.15 + rand() * .5)));
    }
    treeSpots.push({ x, z, r: [1.3, 1, .6][v] * s * 2.4 });
  };
  const density = quality === 'low' ? .55 : quality === 'medium' ? .8 : 1;
  for (let z = 30; z > -LEN - 110; z -= 7 / density) {
    for (const side of [-1, 1]) {
      if (rand() < .85) addTree(side * (11.5 + rand() * 6), z + rand() * 5, rand() < .55 ? 0 : 1, .9 + rand() * .5, rand() * 360);
      if (rand() < .7) addTree(side * (17 + rand() * 12), z + rand() * 6, (rand() * 3) | 0, .8 + rand() * .6, rand() * 360);
      if (rand() < .6) addTree(side * (30 + rand() * 30), z + rand() * 6, (rand() * 3) | 0, .9 + rand() * .7, rand() * 360);
    }
  }
  // understory: low leafy shrubs that close the gaps between the trunks
  for (let z = 30; z > -LEN - 110; z -= 2.2 / density) {
    for (const side of [-1, 1]) {
      const x = side * (8.5 + Math.pow(rand(), .8) * 60), zz = z + rand() * 2;
      shrubB.add(mat4(x, groundH(x, zz) + .3 + rand() * 1.2, zz, rand() * 360, 1.1 + rand() * 1.1, 0, 0, .7 + rand() * .5));
    }
  }
  // a few young trees right at the trail edge so the canopy closes overhead
  for (let z = -20; z > -LEN; z -= 90 + rand() * 60) addTree((rand() < .5 ? -1 : 1) * (7.4 + rand() * 1.2), z, 2, .8 + rand() * .3, rand() * 360);

  // ---------------- undergrowth ----------------
  const fernG = new Geo();
  for (let f = 0; f < 9; f++) {
    const a = f / 9 * Math.PI * 2 + rand() * .3, len = 1.1 + rand() * .5, lift = .7 + rand() * .3;
    const ca = Math.cos(a), sa = Math.sin(a), b = fernG.count;
    for (let k = 0; k <= 6; k++) {
      const t = k / 6, r = t * len, y = Math.sin(t * Math.PI * .8) * lift * .9 - t * t * .25, w = .2 * Math.sin(Math.min(1, t * 1.3 + .1) * Math.PI) + .05;
      for (const s of [-1, 1]) fernG.vert(ca * r - sa * w * s, y, sa * r + ca * w * s, 0, 1, 0, s < 0 ? 0 : 1, 1 - t);
    }
    for (let k = 0; k < 6; k++) fernG.quad(b + k * 2, b + k * 2 + 1, b + k * 2 + 3, b + k * 2 + 2);
  }
  const fernB = new Batch(fernG.mesh(device), fernMat, { shadows: quality === 'high' });
  const grassG = new Geo();
  for (let q = 0; q < 3; q++) {
    const a = q / 3 * Math.PI, ca = Math.cos(a) * .45, sa = Math.sin(a) * .45, b = grassG.count;
    grassG.vert(-ca, 0, -sa, 0, 1, 0, 0, 1); grassG.vert(ca, 0, sa, 0, 1, 0, 1, 1); grassG.vert(ca, .62, sa, 0, 1, 0, 1, 0); grassG.vert(-ca, .62, -sa, 0, 1, 0, 0, 0);
    grassG.quad(b, b + 1, b + 2, b + 3);
  }
  const grassB = new Batch(grassG.mesh(device), grassMat, { shadows: false });
  const rocks = [0, 1].map(k => sphere(10, 8, 1, {
    disp: (x, y, z) => .75 + fbm(x * 2 + k * 9, z * 2 + y * 2, 3) * .55,
    color: (x, y, z) => { const m = Math.max(0, Math.min(1, (y - .1) * 2.5)); return [1 - m * .45, 1 - m * .1, 1 - m * .6, 1]; }, uvScale: 2
  }).mesh(device, { colors: true }));
  const rockB = rocks.map(m => new Batch(m, rockMat));
  const shroom = new Geo();
  for (let k = 0; k < 5; k++) {
    const x = (rand() - .5) * .9, z = (rand() - .5) * .9, h = .15 + rand() * .3, r = .08 + rand() * .1;
    const hot = rand() < .5 ? [.15, .9, .85, 1] : [1, .55, .15, 1];
    shroom.append(tube([{ x: 0, y: 0, z: 0, r: r * .35 }, { x: 0, y: h, z: 0, r: r * .28 }], 6, { color: () => [.1, .09, .08, 1] }).recalcNormals(), mat4(x, 0, z));
    const cap = sphere(10, 6, r, { hemi: true, color: () => hot });
    shroom.append(cap, mat4(x, h, z, 0, 1, 0, 0, .6));
  }
  // vertex colour drives the emissive: keep stalks dark by encoding stalk colour as dim
  const shroomB = new Batch(shroom.mesh(device, { colors: true }), shroomMat, { shadows: false });

  const onTrail = (x) => Math.abs(x) < HALF + .8;
  for (let z = 25; z > -LEN - 100; z -= 1.1 / density) {
    for (let k = 0; k < 4; k++) {
      const side = rand() < .5 ? -1 : 1, x = side * (HALF + 1.2 + Math.pow(rand(), 1.6) * 24), zz = z + rand();
      fernB.add(mat4(x, groundH(x, zz) - .05, zz, rand() * 360, .8 + rand() * .9));
    }
    for (let k = 0; k < 4; k++) {
      const x = (rand() * 2 - 1) * 24, zz = z + rand();
      if (Math.abs(x) < 3.6 && rand() < .9) continue;
      grassB.add(mat4(x, groundH(x, zz) - .02, zz, rand() * 360, .45 + rand() * .6, 0, 0, .5 + rand() * .7));
    }
    if (rand() < .12) { const x = (rand() < .5 ? -1 : 1) * (HALF + 1 + rand() * 16), zz = z; rockB[(rand() * 2) | 0].add(mat4(x, groundH(x, zz) - .2, zz, rand() * 360, .5 + rand() * 1.3, rand() * 30, 0, .4 + rand() * .7)); }
    if (rand() < .1) { const t = treeSpots[(rand() * treeSpots.length) | 0]; if (t) { const a = rand() * 6.28, x = t.x + Math.cos(a) * t.r, zz = t.z + Math.sin(a) * t.r; if (!onTrail(x)) shroomB.add(mat4(x, groundH(x, zz), zz, rand() * 360, 1.2 + rand())); } }
  }
  // leaf litter and twigs scattered flat on the trail
  const litterG = new Geo();
  for (let k = 0; k < 6; k++) {
    const x = (rand() - .5) * 2.4, z = (rand() - .5) * 2.4, a = rand() * Math.PI, sz = .25 + rand() * .2, ca = Math.cos(a) * sz, sa = Math.sin(a) * sz, y = .02 + k * .004;
    const b = litterG.count, tint = [.55 + rand() * .35, .4 + rand() * .2, .22, 1];
    litterG.vert(x - ca + sa, y, z - sa - ca, 0, 1, 0, 0, 0, tint); litterG.vert(x + ca + sa, y, z + sa - ca, 0, 1, 0, 1, 0, tint);
    litterG.vert(x + ca - sa, y, z + sa + ca, 0, 1, 0, 1, 1, tint); litterG.vert(x - ca - sa, y, z - sa + ca, 0, 1, 0, 0, 1, tint);
    litterG.quad(b, b + 3, b + 2, b + 1);
  }
  const litterMat = std({ diffuseMap: tex.leaves, opacityMap: tex.leaves, opacityMapChannel: 'a', alphaTest: .5, gloss: .25, diffuseVertexColor: true });
  const litterB = new Batch(litterG.mesh(device, { colors: true }), litterMat, { shadows: false });
  for (let z = 25; z > -LEN - 20; z -= 2.6 / density) {
    for (let k = 0; k < 3; k++) { const x = (rand() * 2 - 1) * 9, zz = z + rand() * 1.6; litterB.add(mat4(x, groundH(x, zz), zz, rand() * 360, .8 + rand() * .6)); }
  }
  for (const b of [...trunkB, leafB, shrubB, fernB, grassB, ...rockB, shroomB, litterB]) b.build(app, root);
  const batches = { leaf: leafB, shrub: shrubB, fern: fernB, grass: grassB, rocks: rockB };

  // ---------------- hanging vines ----------------
  {
    const vg = new Geo();
    for (let k = 0; k < 3; k++) {
      const len = 7 + k * 2.5, pts = [];
      for (let s = 0; s <= 10; s++) { const t = s / 10; pts.push({ x: Math.sin(t * 5 + k) * .25, y: -t * len, z: Math.cos(t * 4) * .2, r: .045 }); }
      vg.append(tube(pts, 5, { color: () => [.55, .7, .4, 1] }), mat4(k * .8 - .8, 0, 0));
    }
    const vb = new Batch(vg.mesh(device, { colors: true }), barkMat, { shadows: true });
    const lb = new Batch(clusterMesh, leafMat);
    for (let z = -10; z > -LEN; z -= 9 + rand() * 12) {
      const x = (rand() < .5 ? -1 : 1) * (4 + rand() * 4.5), top = 15 + rand() * 5;
      vb.add(mat4(x, top, z, rand() * 360, .9 + rand() * .3));
    }
    vb.build(app, root); lb.build(app, root);
  }

  // ---------------- temple ruins and the finish gate ----------------
  const ruin = new Geo();
  const block = (x, y, z, w, h, d, ry = 0, rz = 0) => ruin.append(box(w, h, d, { uv: .7 }), mat4(x, y, z, ry, 1, 0, rz));
  const gz = -LEN - 6;
  for (const side of [-1, 1]) {
    const px = side * 7;
    for (let k = 0; k < 7; k++) block(px + (rand() - .5) * .15, .65 + k * 1.3, gz, 2.2 - k * .04, 1.28, 2.2 - k * .04, (rand() - .5) * 4);
    block(px, 9.6, gz, 2.8, .8, 2.8);
    block(side * 10.5, 1, gz + 1, 4, 2, 3, 8 * side); block(side * 12.5, 2.4, gz + 1.4, 2.6, 1.3, 2.4, -12 * side);
  }
  block(0, 10.6, gz, 17.5, 1.6, 2.6); block(0, 11.9, gz, 9, 1, 2.2);
  for (let k = 0; k < 4; k++) block(0, -.4 + k * .1, gz + 3.6 - k * 1.2, 16 - k, .5, 1.6);
  // broken pillars and toppled blocks along the trail
  for (let z = -60; z > -LEN + 30; z -= 70 + rand() * 50) {
    const side = rand() < .5 ? -1 : 1, x = side * (HALF + 2.5 + rand() * 3), y0 = groundH(x, z);
    const n = 2 + ((rand() * 4) | 0);
    for (let k = 0; k < n; k++) block(x + (rand() - .5) * .3, y0 + .55 + k * 1.1, z, 1.6, 1.08, 1.6, rand() * 20, (rand() - .5) * 6);
    block(x + side * 2.2, y0 + .35, z + 1.5, 1.5, .8, 2.4, rand() * 50, 6);
  }
  const ruinE = new pc.Entity('ruins');
  ruinE.addComponent('render', { meshInstances: [new pc.MeshInstance(ruin.mesh(device), stoneMat)], castShadows: true, receiveShadows: true });
  root.addChild(ruinE);

  // glowing rune band and portal veil inside the gate
  const runeMat = std({ emissive: new pc.Color(.25, .95, 1), emissiveIntensity: 6, diffuse: new pc.Color(0, 0, 0) });
  const rune = new pc.Entity('rune');
  rune.addComponent('render', { type: 'box', material: runeMat, castShadows: false });
  rune.setLocalPosition(0, 10.6, gz + 1.32); rune.setLocalScale(12, .22, .05); root.addChild(rune);
  for (const side of [-1, 1]) {
    const r2 = rune.clone(); r2.setLocalPosition(side * 5.85, 5, gz + 1.15); r2.setLocalScale(.12, 8, .05); root.addChild(r2);
  }
  const veilMat = new pc.StandardMaterial();
  veilMat.diffuse = new pc.Color(0, 0, 0); veilMat.emissive = new pc.Color(.3, .9, 1); veilMat.emissiveIntensity = .9;
  veilMat.emissiveMap = tex.glow; veilMat.emissiveMapChannel = 'a'; veilMat.blendType = pc.BLEND_ADDITIVE; veilMat.depthWrite = false; veilMat.cull = pc.CULLFACE_NONE; veilMat.update();
  const veil = new pc.Entity('veil');
  veil.addComponent('render', { type: 'plane', material: veilMat, castShadows: false });
  veil.setLocalPosition(0, 5, gz); veil.setLocalEulerAngles(90, 0, 0); veil.setLocalScale(11.5, 1, 10); root.addChild(veil);

  // braziers with real point lights either side of the gate
  const fires = [];
  for (const side of [-1, 1]) {
    const b = new pc.Entity('brazier');
    b.addComponent('render', { type: 'cylinder', material: stoneMat });
    b.setLocalPosition(side * 9.3, .7, gz + 4.5); b.setLocalScale(1, 1.4, 1); root.addChild(b);
    const l = new pc.Entity('fireLight');
    l.addComponent('light', { type: 'omni', color: new pc.Color(1, .55, .2), intensity: 4, range: 14, castShadows: false });
    l.setLocalPosition(side * 9.3, 2.3, gz + 4.5); root.addChild(l);
    fires.push(l);
  }

  // ---------------- fallen logs (gameplay obstacles are placed by the game) ----------------
  const logMesh = tube([{ x: -1, y: 0, z: 0, r: .55 }, { x: -.3, y: .03, z: .05, r: .6 }, { x: .4, y: -.02, z: -.04, r: .57 }, { x: 1, y: 0, z: 0, r: .5 }], 14, { uvU: 2, uvV: .4, color: () => [.9, 1, .85, 1] }).mesh(device, { colors: true });

  return {
    root, windMats, fires, gateZ: gz, batches, windify: (m, str, mode) => { windify(device, m, str, mode); windMats.push(m); return m; }, logMesh, barkMat, stoneMat, leafMat, clusterMesh,
    update(t) {
      for (const m of windMats) m.setParameter('uWindTime', t);
      fires.forEach((l, i) => { l.light.intensity = 3.4 + Math.sin(t * 13 + i * 2) * .5 + Math.sin(t * 29 + i) * .35; });
      veilMat.emissiveIntensity = .8 + Math.sin(t * 2.2) * .25; veilMat.update();
    }
  };
}
