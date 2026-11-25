// Small mesh-building kit: append primitives into one buffer set, apply transforms,
// then upload as a pc.Mesh. Also the instanced batch helper that splits scenery into
// 80 m chunks so each chunk is frustum culled as one draw call.
import * as pc from './playcanvas.min.mjs';

export class Geo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  get count() { return this.p.length / 3; }
  vert(x, y, z, nx, ny, nz, u, v, col = [1, 1, 1, 1]) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v); this.c.push(...col); return this.count - 1;
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  // grid of (cols+1)x(rows+1) vertices from fn(u,v) -> {p,n?,uv?,c?}
  grid(cols, rows, fn) {
    const base = this.count;
    for (let r = 0; r <= rows; r++) for (let q = 0; q <= cols; q++) {
      const o = fn(q / cols, r / rows);
      this.vert(o.p[0], o.p[1], o.p[2], ...(o.n || [0, 1, 0]), ...(o.uv || [q / cols, r / rows]), o.c);
    }
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const a = base + r * (cols + 1) + q, b = a + 1, c = a + cols + 2, d = a + cols + 1;
      this.quad(a, d, c, b);
    }
    return this;
  }
  append(g, m) {
    const base = this.count, v = new pc.Vec3(), nn = new pc.Vec3();
    for (let k = 0; k < g.count; k++) {
      v.set(g.p[k * 3], g.p[k * 3 + 1], g.p[k * 3 + 2]); nn.set(g.n[k * 3], g.n[k * 3 + 1], g.n[k * 3 + 2]);
      if (m) { m.transformPoint(v, v); m.transformVector(nn, nn); nn.normalize(); }
      this.p.push(v.x, v.y, v.z); this.n.push(nn.x, nn.y, nn.z); this.uv.push(g.uv[k * 2], g.uv[k * 2 + 1]);
      this.c.push(g.c[k * 4], g.c[k * 4 + 1], g.c[k * 4 + 2], g.c[k * 4 + 3]);
    }
    for (const idx of g.i) this.i.push(idx + base);
    return this;
  }
  recalcNormals() { this.n = Array.from(pc.calculateNormals(this.p, this.i)); return this; }
  mesh(device, { colors = false } = {}) {
    const m = new pc.Mesh(device);
    m.setPositions(new Float32Array(this.p)); m.setNormals(new Float32Array(this.n)); m.setUvs(0, new Float32Array(this.uv));
    if (colors) m.setColors(new Float32Array(this.c));
    m.setIndices(this.count > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i));
    m.update(pc.PRIMITIVE_TRIANGLES);
    let r = 0; for (let k = 0; k < this.p.length; k += 3) r = Math.max(r, Math.hypot(this.p[k], this.p[k + 1], this.p[k + 2]));
    m.radius = r;
    return m;
  }
}

export const mat4 = (x, y, z, ry = 0, s = 1, rx = 0, rz = 0, sy = s) => {
  const m = new pc.Mat4(), q = new pc.Quat().setFromEulerAngles(rx, ry, rz);
  return m.setTRS(new pc.Vec3(x, y, z), q, new pc.Vec3(s, sy, s));
};

// Sphere with optional per-vertex displacement and colour.
export function sphere(seg = 12, ring = 8, r = 1, { disp, color, uvScale = 1, hemi = false } = {}) {
  const g = new Geo();
  const rows = hemi ? ring / 2 : ring;
  g.grid(seg, rows, (u, v) => {
    const th = u * Math.PI * 2, ph = v * Math.PI * (hemi ? .5 : 1);
    let nx = Math.sin(ph) * Math.cos(th), ny = Math.cos(ph), nz = Math.sin(ph) * Math.sin(th);
    const k = disp ? disp(nx, ny, nz) : 1;
    return { p: [nx * r * k, ny * r * k, nz * r * k], n: [nx, ny, nz], uv: [u * uvScale, v * uvScale], c: color ? color(nx, ny, nz) : undefined };
  });
  return g;
}

// Tapered tube along a polyline: pts [{x,y,z,r}], radial segments
export function tube(pts, seg = 8, { uvU = 1, uvV = .25, color, flare } = {}) {
  const g = new Geo(); let along = 0;
  const up = new pc.Vec3(0, 1, 0), t = new pc.Vec3(), a = new pc.Vec3(), b = new pc.Vec3();
  for (let k = 0; k < pts.length; k++) {
    const p0 = pts[Math.max(0, k - 1)], p1 = pts[Math.min(pts.length - 1, k + 1)];
    t.set(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z).normalize();
    a.cross(t, Math.abs(t.y) > .95 ? new pc.Vec3(1, 0, 0) : up).normalize(); b.cross(t, a).normalize();
    if (k > 0) along += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y, pts[k].z - pts[k - 1].z);
    for (let s = 0; s <= seg; s++) {
      const th = s / seg * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
      const rr = pts[k].r * (flare ? flare(th, k / (pts.length - 1)) : 1);
      const nx = a.x * cs + b.x * sn, ny = a.y * cs + b.y * sn, nz = a.z * cs + b.z * sn;
      g.vert(pts[k].x + nx * rr, pts[k].y + ny * rr, pts[k].z + nz * rr, nx, ny, nz, s / seg * uvU, along * uvV, color ? color(k / (pts.length - 1)) : undefined);
    }
  }
  for (let k = 0; k < pts.length - 1; k++) for (let s = 0; s < seg; s++) {
    const i0 = k * (seg + 1) + s; g.quad(i0, i0 + 1, i0 + seg + 2, i0 + seg + 1);
  }
  return g;
}

export function box(w, h, d, { uv = 1 } = {}) {
  const g = new Geo(), hw = w / 2, hh = h / 2, hd = d / 2;
  const F = [[[0, 0, 1], [-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd], w, h],
    [[0, 0, -1], [hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd], w, h],
    [[1, 0, 0], [hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd], d, h],
    [[-1, 0, 0], [-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd], d, h],
    [[0, 1, 0], [-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd], w, d],
    [[0, -1, 0], [-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd], w, d]];
  for (const [n, p0, p1, p2, p3, su, sv] of F) {
    const b = g.count, U = su / 4 * uv, V = sv / 4 * uv;
    g.vert(...p0, ...n, 0, 0); g.vert(...p1, ...n, U, 0); g.vert(...p2, ...n, U, V); g.vert(...p3, ...n, 0, V);
    g.quad(b, b + 1, b + 2, b + 3);
  }
  return g;
}

// Instanced scenery batch, split into chunks along z.
export class Batch {
  constructor(mesh, material, { shadows = true, chunk = 80, layer } = {}) {
    this.mesh = mesh; this.material = material; this.shadows = shadows; this.chunk = chunk; this.groups = new Map(); this.layer = layer; this.entities = [];
  }
  all() { return [...this.groups.values()].flat(); }
  add(m) {
    const z = m.data[14], key = Math.floor(z / this.chunk);
    if (!this.groups.has(key)) this.groups.set(key, []);
    this.groups.get(key).push(m);
  }
  build(app, parent) {
    const device = app.graphicsDevice, r = this.mesh.radius || 2;
    for (const [, list] of this.groups) {
      const data = new Float32Array(list.length * 16);
      const min = new pc.Vec3(1e9, 1e9, 1e9), max = new pc.Vec3(-1e9, -1e9, -1e9);
      list.forEach((m, k) => {
        data.set(m.data, k * 16);
        const s = m.getScale().length() / Math.sqrt(3) * r * 1.2, x = m.data[12], y = m.data[13], z = m.data[14];
        min.set(Math.min(min.x, x - s), Math.min(min.y, y - s), Math.min(min.z, z - s));
        max.set(Math.max(max.x, x + s), Math.max(max.y, y + s), Math.max(max.z, z + s));
      });
      const vb = new pc.VertexBuffer(device, pc.VertexFormat.getDefaultInstancingFormat(device), list.length, { data });
      const mi = new pc.MeshInstance(this.mesh, this.material);
      mi.setInstancing(vb, true);
      const e = new pc.Entity('batch');
      e.addComponent('render', { meshInstances: [mi], castShadows: this.shadows, receiveShadows: true });
      const aabb = new pc.BoundingBox(); aabb.setMinMax(min, max);
      e.render.customAabb = aabb;
      parent.addChild(e); this.entities.push(e);
    }
  }
}
