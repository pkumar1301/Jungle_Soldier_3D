// Forest dressing from Quaternius' Stylized Nature MegaKit (CC0): its leaf
// canopies sit on the code-built trunks, and its ferns, bushes, plants and rocks
// replace the code-built undergrowth. Placement comes from the world's own
// batches, so the layout and the trail stay exactly as before.
import * as pc from './playcanvas.min.mjs';
import { Batch } from './geo.js';

const BASE = 'models/megakit/';
const load = (app, n) => new Promise((ok, fail) => app.assets.loadFromUrl(BASE + n + '.gltf', 'container', (e, a) => e ? fail(e) : ok(a.resource)));

// mesh + material pairs of a model, optionally only those whose material name matches
function parts(res, matRe) {
  const e = res.instantiateRenderEntity(), out = [];
  e.findComponents('render').forEach(r => r.meshInstances.forEach(mi => {
    if (!matRe || matRe.test(mi.material.name)) out.push({ mesh: mi.mesh, material: mi.material });
  }));
  e.destroy();
  return out;
}
// shift and scale a mesh so its bounds centre on the origin (y: base or centre)
function fit(mesh, size, base) {
  const a = mesh.aabb, c = a.center, h = a.halfExtents;
  const s = size / (Math.max(h.x, h.z) * 2);
  mesh.radius = h.length() * s + .5;
  return new pc.Mat4().setTRS(new pc.Vec3(-c.x * s, base ? -(c.y - h.y) * s : -c.y * s, -c.z * s), pc.Quat.IDENTITY, new pc.Vec3(s, s, s));
}

export async function dressForest(app, world, onProgress = () => {}) {
  const names = ['CommonTree_1', 'CommonTree_3', 'Fern_1', 'Plant_1_Big', 'Plant_7_Big', 'Bush_Common', 'Bush_Common_Flowers', 'Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3', 'Flower_3_Group', 'Flower_4_Group'];
  const R = {};
  let n = 0;
  await Promise.all(names.map(async k => { R[k] = await load(app, k); onProgress(++n / names.length); }));
  const wind = new Map();
  const windy = (m, str, mode) => { if (!wind.has(m.id)) { const c = m.clone(); world.windify(c, str, mode); wind.set(m.id, c); } return wind.get(m.id); };
  const B = world.batches, root = world.root;
  const swap = (oldB, variants, size, base) => {
    oldB.entities.forEach(e => { e.enabled = false; });
    const made = variants.map(v => {
      const off = fit(v.mesh, size, base);
      return { b: new Batch(v.mesh, v.material, { shadows: v.shadows !== false }), off };
    });
    let k = 0;
    for (const m of oldB.all()) {
      const pick = made[k++ % made.length];
      pick.b.add(new pc.Mat4().mul2(m, pick.off));
    }
    made.forEach(x => x.b.build(app, root));
  };
  // canopy: MegaKit leaf crowns (no bark) on the existing trunks and branch tips
  const leaves = [...parts(R.CommonTree_1, /Leaves/), ...parts(R.CommonTree_3, /Leaves/)].map(p => ({ ...p, material: windy(p.material, .12, 'height') }));
  swap(B.leaf, leaves, 5.2, false);
  // understory: bushes, some in flower
  const bushes = [...parts(R.Bush_Common), ...parts(R.Bush_Common_Flowers)].map(p => ({ ...p, material: windy(p.material, .6, 'height') }));
  swap(B.shrub, bushes, 2.6, false);
  // ground cover: ferns and broad-leaf plants, a few flowers
  const ferns = [...parts(R.Fern_1), ...parts(R.Plant_1_Big), ...parts(R.Plant_7_Big), ...parts(R.Fern_1), ...parts(R.Flower_3_Group), ...parts(R.Flower_4_Group)]
    .map(p => ({ ...p, material: windy(p.material, .8, 'height'), shadows: false }));
  swap(B.fern, ferns, 1.4, true);
  // rocks
  const rocks = [...parts(R.Rock_Medium_1), ...parts(R.Rock_Medium_2), ...parts(R.Rock_Medium_3)];
  for (const rb of B.rocks) swap(rb, rocks, 2.2, true);
}
