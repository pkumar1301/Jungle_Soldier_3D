// Biome skins for generated base models. A recipe recolours the model's own
// base-colour texture by colour family (body, crystal highlights, snow/fur,
// leather, flesh) and can paint an emissive layer, so one base mesh with one
// set of animations becomes several biome enemies. Works on any UV layout,
// including the scattered atlases that image-to-3D tools produce.
import * as pc from './playcanvas.min.mjs';
import { fbm } from './textures.js';

function rgb2hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}
function hsv2rgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}
// colour family of a pixel in the frost base
function family(h, s, v) {
  if (v < .12) return 'dark';
  if (s < .24 && v > .55) return 'snow';
  if (h >= 170 && h <= 255 && s > .2) return v > .8 && s < .7 ? 'crystal' : 'body';
  if (h >= 8 && h <= 50 && s > .25) return 'leather';
  if ((h >= 320 || h < 8) && s > .35) return 'flesh';
  return 'other';
}

export const RECIPES = {
  frost: null, // the generated texture as it is
  magma: {
    label: 'Magma imp',
    body: (h, s, v) => hsv2rgb(14, .55, .1 + v * .32),
    crystal: (h, s, v) => hsv2rgb(26, .9, .8 + v * .2),
    snow: (h, s, v) => hsv2rgb(20, .12, .18 + v * .2),
    leather: (h, s, v) => hsv2rgb(15, s * .6, v * .55),
    flesh: (h, s, v) => hsv2rgb(18, .9, Math.min(1, v * 1.2)),
    glow: (fam, h, s, v, u, w) => {
      if (fam === 'crystal') return [1, .45, .08];
      if (fam === 'flesh') return [.9, .3, .05];
      if (fam === 'body') { const n = fbm(u * 14, w * 14, 4); const c = Math.max(0, 1 - Math.abs(n - .5) * 40); return [c * 1, c * .38, c * .05]; }
      if (fam === 'snow' && fbm(u * 60, w * 60, 2) > .72) return [.8, .25, .03];
      return null;
    }
  },
  moss: {
    label: 'Moss imp',
    body: (h, s, v) => hsv2rgb(88 + (h - 210) * .25, .55, v * .78),
    crystal: (h, s, v) => hsv2rgb(70, .65, Math.min(1, v * .95)),
    snow: (h, s, v) => hsv2rgb(62, .32, v * .72),
    leather: (h, s, v) => hsv2rgb(h, s, v * .9),
    flesh: (h, s, v) => hsv2rgb(5, .75, v),
    glow: (fam) => fam === 'crystal' ? [.25, .4, .05] : null
  }
};

export function makeSkinTextures(device, baseTex, recipe) {
  const src = baseTex.getSource();
  const w = src.width, h = src.height;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const ev = document.createElement('canvas'); ev.width = w; ev.height = h;
  const ectx = ev.getContext('2d'), eimg = ectx.createImageData(w, h), e = eimg.data;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    const [hh, ss, vv] = rgb2hsv(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
    const fam = family(hh, ss, vv);
    const f = recipe[fam];
    if (f) { const [r, g, b] = f(hh, ss, vv); d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = b * 255; }
    const gl = recipe.glow ? recipe.glow(fam, hh, ss, vv, x / w, y / h) : null;
    e[i + 3] = 255;
    if (gl) { e[i] = gl[0] * 255; e[i + 1] = gl[1] * 255; e[i + 2] = gl[2] * 255; }
  }
  ctx.putImageData(img, 0, 0); ectx.putImageData(eimg, 0, 0);
  const tex = (c, name) => { const t = new pc.Texture(device, { name, width: w, height: h, format: pc.PIXELFORMAT_SRGBA8, mipmaps: true, minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR, magFilter: pc.FILTER_LINEAR, anisotropy: 4 }); t.setSource(c); return t; };
  return { diffuse: tex(cv, 'skinD'), emissive: recipe.glow ? tex(ev, 'skinE') : null };
}

// Build one ready-to-clone template entity per skin from a generated base model.
// The wrapper faces -Z (the game's convention), stands on y = 0 and is `height` tall.
export function skinnedTemplates(app, res, names, height = 1.6) {
  const device = app.graphicsDevice, out = {};
  let baseMat = null;
  for (const name of names) {
    const inst = res.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
    const rs = inst.findComponents('render');
    if (!baseMat) baseMat = rs[0].meshInstances[0].material;
    const box = new pc.BoundingBox(); let first = true;
    rs.forEach(r => r.meshInstances.forEach(mi => { if (first) { box.copy(mi.aabb); first = false; } else box.add(mi.aabb); }));
    const s = height / (box.halfExtents.y * 2);
    const recipe = RECIPES[name];
    const mat = baseMat.clone();
    mat.metalness = 0; mat.metalnessMap = null; mat.gloss = .42; mat.glossMap = null; mat.useMetalness = true;
    if (recipe) {
      const t = makeSkinTextures(device, baseMat.diffuseMap, recipe);
      mat.diffuseMap = t.diffuse;
      if (t.emissive) { mat.emissiveMap = t.emissive; mat.emissive = new pc.Color(1, 1, 1); mat.emissiveIntensity = name === 'magma' ? 3.2 : 1.5; }
    }
    mat.update();
    rs.forEach(r => r.meshInstances.forEach(mi => { mi.material = mat; }));
    const wrap = new pc.Entity('imp-' + name), body = new pc.Entity('body'), turn = new pc.Entity('turn');
    wrap.addChild(body); body.addChild(turn); turn.addChild(inst);
    turn.setLocalEulerAngles(0, 180, 0);
    inst.setLocalScale(s, s, s);
    inst.setLocalPosition(-box.center.x * s, -(box.center.y - box.halfExtents.y) * s, -box.center.z * s);
    wrap.parts = { body, rigid: true };
    out[name] = wrap;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Biome skins for any textured model (realistic creatures, grey sculpts).
// Each keeps the texture's light and shade (value) and replaces its colour,
// then adds an optional glow layer. Textures are processed at most 1024 px.
const band = (n, w) => Math.max(0, 1 - Math.abs(n - .5) * w);
export const BIOME_SKINS = {
  forest: null,
  // mossy bark-brown for the grey sculpts in the Forest
  moss: { label: 'Forest moss', tone: v => hsv2rgb(78 - v * 40, .5 - v * .18, .1 + v * .55),
    stripe: (u, w) => fbm(u * 7 + 3, w * 7, 3) > .6 ? 1.25 : 1 },
  // bloated exploder: sickly green-yellow skin with glowing pustules
  bloat: { label: 'Bloated', tone: v => hsv2rgb(70 - v * 10, .65, .2 + v * .55),
    glow: (u, w) => { const n = fbm(u * 26 + 11, w * 26, 3); return n > .63 ? [.7 * (n - .63) * 4, (n - .63) * 4, .1] : null; }, glowI: 3 },
  desert: { label: 'Desert', tone: v => hsv2rgb(34 - v * 8, .5 - v * .15, .16 + v * .82),
    stripe: (u, w, v) => { const n = fbm(u * 9, w * 9, 3); return n > .62 ? .72 : 1; } },
  tundra: { label: 'Tundra', tone: v => hsv2rgb(205 - v * 15, .42 - v * .22, .22 + v * .62),
    glow: (u, w, v) => v > .75 ? [.25 * (v - .75) * 4, .7 * (v - .75) * 4, (v - .75) * 4] : null, glowI: .9 },
  volcano: { label: 'Volcano', tone: v => hsv2rgb(12, .55, .05 + v * .3),
    glow: (u, w, v) => { const c = band(fbm(u * 12, w * 12, 4), 34) + (v > .82 ? (v - .82) * 5 : 0); return c > .02 ? [c, c * .38, c * .05] : null; }, glowI: 3.2 },
  hive: { label: 'Alien hive', tone: v => hsv2rgb(278 - v * 30, .55, .08 + v * .62),
    glow: (u, w, v) => { const n = fbm(u * 22 + 7, w * 22, 3); return n > .7 ? [.4 * (n - .7) * 3, (n - .7) * 3, .2 * (n - .7) * 3] : null; }, glowI: 2.2 }
};

export function biomeSkinTextures(device, baseTex, skin, max = 1024) {
  const src = baseTex.getSource();
  const sc = Math.min(1, max / Math.max(src.width, src.height));
  const w = Math.max(4, Math.round(src.width * sc)), h = Math.max(4, Math.round(src.height * sc));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(src, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const ev = document.createElement('canvas'); ev.width = w; ev.height = h;
  const ectx = ev.getContext('2d'), eimg = ectx.createImageData(w, h), e = eimg.data;
  // normalise value so dark and pale source textures both use the full range
  let lo = 1, hi = 0;
  for (let i = 0; i < d.length; i += 16) { const v = Math.max(d[i], d[i + 1], d[i + 2]) / 255; if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = Math.max(.08, hi - lo);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    const v = Math.min(1, Math.max(0, (Math.max(d[i], d[i + 1], d[i + 2]) / 255 - lo) / span));
    const u = x / w, ww = y / h;
    let [r, g, b] = skin.tone(v);
    if (skin.stripe) { const k = skin.stripe(u, ww, v); r *= k; g *= k; b *= k; }
    d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = b * 255;
    const gl = skin.glow ? skin.glow(u, ww, v) : null;
    e[i + 3] = 255;
    if (gl) { e[i] = Math.min(255, gl[0] * 255); e[i + 1] = Math.min(255, gl[1] * 255); e[i + 2] = Math.min(255, gl[2] * 255); }
  }
  ctx.putImageData(img, 0, 0); ectx.putImageData(eimg, 0, 0);
  const tex = (c, name, srgb) => { const t = new pc.Texture(device, { name, width: w, height: h, format: srgb ? pc.PIXELFORMAT_SRGBA8 : pc.PIXELFORMAT_RGBA8, mipmaps: true, minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR, magFilter: pc.FILTER_LINEAR, anisotropy: 4 }); t.setSource(c); return t; };
  return { diffuse: tex(cv, 'biomeD', true), emissive: skin.glow ? tex(ev, 'biomeE', true) : null };
}

// Apply a biome skin to every material of an instantiated model (cached per texture).
export function applyBiomeSkin(app, entity, name, cache = new Map()) {
  const skin = BIOME_SKINS[name]; if (!skin) return;
  entity.findComponents('render').forEach(r => r.meshInstances.forEach(mi => {
    const base = mi.material; const key = base.id + ':' + name;
    if (!cache.has(key)) {
      const m = base.clone();
      if (base.diffuseMap) {
        const t = biomeSkinTextures(app.graphicsDevice, base.diffuseMap, skin);
        m.diffuseMap = t.diffuse; m.diffuse = new pc.Color(1, 1, 1);
        if (t.emissive) { m.emissiveMap = t.emissive; m.emissive = new pc.Color(1, 1, 1); m.emissiveIntensity = skin.glowI || 1; }
      } else {
        const [r, g, b] = skin.tone(.6); m.diffuse = new pc.Color(r, g, b);
      }
      m.update(); cache.set(key, m);
    }
    mi.material = cache.get(key);
  }));
}
