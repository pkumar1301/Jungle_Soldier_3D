// Procedural textures for the Forest remaster: bark, leaves, fern fronds, grass,
// carved stone and glow sprites, painted on canvases at load time so the build
// needs no extra image files. Every colour map is sRGB; normal maps are linear.
import * as pc from './playcanvas.min.mjs';

// ---------- noise ----------
let seed = 1337;
export const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
export const setSeed = s => { seed = s; };
const P = new Uint8Array(512);
{ const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
const fade = t => t * t * (3 - 2 * t);
const hash = (x, y) => P[(P[x & 255] + y) & 255] / 255;
export function vnoise(x, y, wrapX = 0, wrapY = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const wx = v => wrapX ? ((v % wrapX) + wrapX) % wrapX : v, wy = v => wrapY ? ((v % wrapY) + wrapY) % wrapY : v;
  const a = hash(wx(xi), wy(yi)), b = hash(wx(xi + 1), wy(yi)), c = hash(wx(xi), wy(yi + 1)), d = hash(wx(xi + 1), wy(yi + 1));
  const u = fade(xf), v = fade(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 4, wrapX = 0, wrapY = 0) {
  let s = 0, a = .5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, wrapX * f, wrapY * f); a *= .5; f *= 2; }
  return s / (1 - Math.pow(.5, oct));
}

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function toTexture(device, c, { srgb = true, repeat = true, name = 'tex', aniso = 8 } = {}) {
  const t = new pc.Texture(device, {
    name, width: c.width, height: c.height, format: srgb ? pc.PIXELFORMAT_SRGBA8 : pc.PIXELFORMAT_RGBA8,
    mipmaps: true, minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR, magFilter: pc.FILTER_LINEAR,
    addressU: repeat ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE, addressV: repeat ? pc.ADDRESS_REPEAT : pc.ADDRESS_CLAMP_TO_EDGE,
    anisotropy: aniso
  });
  t.setSource(c);
  return t;
}

// Height field (Float32Array) -> tangent-space normal map canvas.
function normalFromHeight(h, w, hh, strength) {
  const c = canvas(w, hh), ctx = c.getContext('2d'), img = ctx.createImageData(w, hh), d = img.data;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const l = h[y * w + ((x - 1 + w) % w)], r = h[y * w + ((x + 1) % w)];
    const u = h[((y - 1 + hh) % hh) * w + x], dn = h[((y + 1) % hh) * w + x];
    let nx = (l - r) * strength, ny = (dn - u) * strength, nz = 1;
    const il = 1 / Math.hypot(nx, ny, nz); nx *= il; ny *= il; nz *= il;
    const i = (y * w + x) * 4;
    d[i] = (nx * .5 + .5) * 255; d[i + 1] = (ny * .5 + .5) * 255; d[i + 2] = (nz * .5 + .5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------- bark: fibrous vertical ridges, lichen and moss ----------
function bark(device) {
  const w = 256, h = 512, H = new Float32Array(w * h);
  const c = canvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const warp = fbm(u * 6, v * 3, 3, 6, 3) * 2.2;
    const ridge = Math.abs(Math.sin((u * 26 + warp) * Math.PI));
    const fib = fbm(u * 40, v * 4, 3, 40, 4);
    const ht = Math.pow(ridge, .55) * .75 + fib * .25;
    H[y * w + x] = ht;
    const moss = Math.max(0, fbm(u * 5 + 9, v * 4, 4, 5, 4) - .52) * 3.2;
    const lich = Math.max(0, fbm(u * 18 + 3, v * 9, 3, 18, 9) - .62) * 2.2;
    let r = 52 + ht * 60, g = 44 + ht * 46, b = 34 + ht * 32;
    r = r * (1 - lich) + 150 * lich; g = g * (1 - lich) + 158 * lich; b = b * (1 - lich) + 132 * lich;
    const m = Math.min(1, moss) * (1 - ht * .35);
    r = r * (1 - m) + 58 * m; g = g * (1 - m) + 92 * m; b = b * (1 - m) + 30 * m;
    const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { map: toTexture(device, c, { name: 'bark' }), normal: toTexture(device, normalFromHeight(H, w, h, 5), { srgb: false, name: 'barkN' }) };
}

// ---------- carved temple stone with moss on the upper faces ----------
function stone(device) {
  const w = 512, h = 512, H = new Float32Array(w * h);
  const c = canvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    // block mortar lines (4 rows, offset bricks)
    const row = Math.floor(v * 4), bu = (u * 3 + (row % 2) * .5) % 1, bv = (v * 4) % 1;
    const edge = Math.min(bu, 1 - bu, bv, 1 - bv);
    const mortar = Math.min(1, edge * 22);
    const n = fbm(u * 8, v * 8, 5, 8, 8), cr = fbm(u * 30, v * 30, 2, 30, 30);
    const ht = mortar * (.7 + n * .3) - (cr > .78 ? .25 : 0);
    H[y * w + x] = ht;
    const moss = Math.max(0, fbm(u * 4 + 4, v * 4, 4, 4, 4) - .5) * 2.6 * (1 - mortar * .4);
    let g0 = 92 + n * 70;
    let r = g0 * .9, g = g0 * .95, b = g0 * .88;
    const m = Math.min(1, moss);
    r = r * (1 - m) + 60 * m; g = g * (1 - m) + 96 * m; b = b * (1 - m) + 40 * m;
    r *= .55 + mortar * .45; g *= .55 + mortar * .45; b *= .55 + mortar * .45;
    const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { map: toTexture(device, c, { name: 'stone' }), normal: toTexture(device, normalFromHeight(H, w, h, 7), { srgb: false, name: 'stoneN' }) };
}

// ---------- leaf cluster card: overlapping broad jungle leaves ----------
function leafShape(ctx, x, y, len, wid, ang, col, vein) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(wid, len * .25, wid * .9, len * .75, 0, len);
  ctx.bezierCurveTo(-wid * .9, len * .75, -wid, len * .25, 0, 0);
  const g = ctx.createLinearGradient(-wid, 0, wid, 0);
  g.addColorStop(0, col[0]); g.addColorStop(.5, col[1]); g.addColorStop(1, col[0]);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = vein; ctx.lineWidth = Math.max(1, wid * .08);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, len * .95); ctx.stroke();
  ctx.lineWidth = Math.max(.6, wid * .035);
  for (let k = 1; k < 6; k++) { const yy = len * k / 6.5; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(wid * .7, yy + len * .08); ctx.moveTo(0, yy); ctx.lineTo(-wid * .7, yy + len * .08); ctx.stroke(); }
  ctx.restore();
}
function leaves(device) {
  const s = 512, c = canvas(s, s), ctx = c.getContext('2d');
  const greens = [['#1d3b12', '#3f6e1f'], ['#24461a', '#4f7d26'], ['#2d5216', '#6a8f2a'], ['#173211', '#335c1c'], ['#3a5a18', '#7c9a33']];
  for (let i = 0; i < 46; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * s * .34;
    const x = s / 2 + Math.cos(a) * r, y = s / 2 + Math.sin(a) * r;
    leafShape(ctx, x, y, 60 + rand() * 70, 18 + rand() * 20, a + Math.PI * .5 + (rand() - .5) * 1.2, greens[(rand() * 5) | 0], 'rgba(170,200,110,.45)');
  }
  return toTexture(device, c, { name: 'leaves', repeat: false });
}

// ---------- fern frond: stem with paired, tapering leaflets ----------
function fern(device) {
  const w = 128, h = 512, c = canvas(w, h), ctx = c.getContext('2d');
  ctx.strokeStyle = '#4b6b20'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(w / 2, h); ctx.lineTo(w / 2, 6); ctx.stroke();
  for (let y = h - 20; y > 10; y -= 11) {
    const t = 1 - y / h, len = (w * .46) * Math.sin(Math.min(1, (1 - t) * 1.25) * Math.PI * .5 + .15) * (1 - t * .35);
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(w / 2, y); ctx.rotate(side * (1.15 - t * .3));
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(5, -len * .5, 0, -len); ctx.quadraticCurveTo(-5, -len * .5, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, -len);
      g.addColorStop(0, '#2b5a17'); g.addColorStop(1, rand() > .5 ? '#6f9e2c' : '#5c8c26');
      ctx.fillStyle = g; ctx.fill(); ctx.restore();
    }
  }
  return toTexture(device, c, { name: 'fern', repeat: false });
}

// ---------- grass: a tuft of tapered blades ----------
function grass(device) {
  const w = 256, h = 256, c = canvas(w, h), ctx = c.getContext('2d');
  for (let i = 0; i < 46; i++) {
    const x = 20 + rand() * (w - 40), bh = h * (.45 + rand() * .55), lean = (rand() - .5) * 60, bw = 4 + rand() * 6;
    const g = ctx.createLinearGradient(0, h, 0, h - bh);
    g.addColorStop(0, '#1a2a0c'); g.addColorStop(.6, rand() > .3 ? '#3f6420' : '#6b7530'); g.addColorStop(1, '#93a050');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - bw, h); ctx.quadraticCurveTo(x + lean * .3, h - bh * .5, x + lean, h - bh); ctx.quadraticCurveTo(x + lean * .3 + 1, h - bh * .5, x + bw, h); ctx.fill();
  }
  return toTexture(device, c, { name: 'grass', repeat: false });
}

// ---------- glow sprite for fireflies, tracers and sparks ----------
function glow(device) {
  const s = 64, c = canvas(s, s), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  return toTexture(device, c, { name: 'glow', repeat: false, srgb: false });
}

// ---------- soft round blob for smoke and dust ----------
function smoke(device) {
  const s = 128, c = canvas(s, s), ctx = c.getContext('2d'), img = ctx.createImageData(s, s), d = img.data;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = x / s - .5, dy = y / s - .5, r = Math.hypot(dx, dy) * 2;
    const n = fbm(x / 20, y / 20, 4);
    const a = Math.max(0, 1 - r) * (.4 + n * .8);
    const i = (y * s + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.min(255, a * 255);
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(device, c, { name: 'smoke', repeat: false, srgb: false });
}

// ---------- chitin / mushroom cap patterns for enemies ----------
function spots(device, base, spot, n = 40) {
  const s = 256, c = canvas(s, s), ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) { ctx.fillStyle = spot; ctx.beginPath(); ctx.ellipse(rand() * s, rand() * s, 6 + rand() * 14, 5 + rand() * 10, rand() * 3, 0, Math.PI * 2); ctx.fill(); }
  return toTexture(device, c, { name: 'spots' });
}

export function makeTextures(device) {
  setSeed(4242);
  return {
    bark: bark(device), stone: stone(device), leaves: leaves(device), fern: fern(device), grass: grass(device),
    glow: glow(device), smoke: smoke(device),
    cap: spots(device, '#b8321f', '#f3e3c0', 26), chitin: spots(device, '#2a3320', '#4c6a2a', 60)
  };
}
