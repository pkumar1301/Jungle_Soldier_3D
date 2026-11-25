// GPU particle effects (PlayCanvas particle system): muzzle sparks, hit sparks,
// explosions with smoke, acid splashes, pickup bursts, ambient fireflies,
// drifting pollen in the light shafts and brazier flames. Burst emitters are pooled.
import * as pc from './playcanvas.min.mjs';

const curve = (pts) => new pc.Curve(pts);
const cset = (...cs) => new pc.CurveSet(cs.map(c => c.keys.flat()));

function emitter(app, parent, opts) {
  const e = new pc.Entity('fx');
  e.addComponent('particlesystem', Object.assign({
    autoPlay: false, loop: false, localSpace: false, numParticles: 30, lifetime: .5, rate: 0, rate2: 0,
    emitterShape: pc.EMITTERSHAPE_SPHERE, emitterRadius: .1, blendType: pc.BLEND_ADDITIVE,
    depthWrite: false, lighting: false, halfLambert: false, sort: pc.PARTICLESORT_NONE, alignToMotion: false
  }, opts));
  parent.addChild(e);
  return e;
}

export function makeFx(app, tex, quality) {
  const root = new pc.Entity('fx-root'); app.root.addChild(root);
  const pools = {};
  const define = (name, count, opts) => { pools[name] = { list: Array.from({ length: count }, () => emitter(app, root, opts)), i: 0 }; };

  define('spark', 10, {
    numParticles: 14, lifetime: .35, colorMap: tex.glow, emitterRadius: .05,
    velocityGraph: cset(curve([0, -4]), curve([0, 1]), curve([0, -4])), velocityGraph2: cset(curve([0, 4]), curve([0, 6]), curve([0, 4])),
    scaleGraph: curve([0, .12, 1, .02]), alphaGraph: curve([0, 1, 1, 0]),
    colorGraph: cset(curve([0, 1, 1, 1]), curve([0, .9, 1, .5]), curve([0, .6, 1, .2]))
  });
  define('cyanSpark', 10, {
    numParticles: 10, lifetime: .25, colorMap: tex.glow, emitterRadius: .03,
    velocityGraph: cset(curve([0, -3]), curve([0, -1]), curve([0, -3])), velocityGraph2: cset(curve([0, 3]), curve([0, 3]), curve([0, 3])),
    scaleGraph: curve([0, .1, 1, .01]), alphaGraph: curve([0, 1, 1, 0]),
    colorGraph: cset(curve([0, .5, 1, .2]), curve([0, 1, 1, .8]), curve([0, 1, 1, 1]))
  });
  const fireOpts = (n, size, spd) => ({
    numParticles: n, lifetime: .55, colorMap: tex.smoke, emitterRadius: .25 * size,
    velocityGraph: cset(curve([0, -spd, 1, -.5]), curve([0, -.5, 1, .8]), curve([0, -spd, 1, -.5])), velocityGraph2: cset(curve([0, spd, 1, .5]), curve([0, spd * 1.2, 1, 2]), curve([0, spd, 1, .5])),
    scaleGraph: curve([0, .3 * size, .25, .9 * size, 1, 1.2 * size]), alphaGraph: curve([0, .9, .5, .45, 1, 0]),
    colorGraph: cset(curve([0, 1, .4, 1, 1, .5]), curve([0, .9, .3, .45, 1, .12]), curve([0, .6, .3, .1, 1, .04]))
  });
  define('fire', 4, fireOpts(30, 1.5, 6));
  define('pop', 8, fireOpts(16, .7, 3.5));
  define('smoke', 5, {
    numParticles: 16, lifetime: 2, colorMap: tex.smoke, emitterRadius: .7, blendType: pc.BLEND_NORMAL, lighting: true,
    velocityGraph: cset(curve([0, -1.2]), curve([0, 1, 1, 2]), curve([0, -1.2])), velocityGraph2: cset(curve([0, 1.2]), curve([0, 2.5, 1, 3]), curve([0, 1.2])),
    scaleGraph: curve([0, .6, 1, 2.6]), alphaGraph: curve([0, 0, .25, .3, 1, 0]),
    colorGraph: cset(curve([0, .22]), curve([0, .2]), curve([0, .18]))
  });
  define('acid', 6, {
    numParticles: 26, lifetime: .6, colorMap: tex.glow, emitterRadius: .3,
    velocityGraph: cset(curve([0, -3]), curve([0, 2, 1, -6]), curve([0, -3])), velocityGraph2: cset(curve([0, 3]), curve([0, 6, 1, -4]), curve([0, 3])),
    scaleGraph: curve([0, .25, 1, .08]), alphaGraph: curve([0, 1, 1, 0]),
    colorGraph: cset(curve([0, .5]), curve([0, 1]), curve([0, .15]))
  });
  define('goo', 8, {
    numParticles: 22, lifetime: .7, colorMap: tex.smoke, emitterRadius: .4, blendType: pc.BLEND_NORMAL, lighting: true,
    velocityGraph: cset(curve([0, -3]), curve([0, 1, 1, -5]), curve([0, -3])), velocityGraph2: cset(curve([0, 3]), curve([0, 5, 1, -3]), curve([0, 3])),
    scaleGraph: curve([0, .35, 1, .15]), alphaGraph: curve([0, .95, 1, 0]),
    colorGraph: cset(curve([0, .45]), curve([0, .42]), curve([0, .3]))
  });
  define('pickup', 4, {
    numParticles: 30, lifetime: .7, colorMap: tex.glow, emitterRadius: .4,
    velocityGraph: cset(curve([0, -1]), curve([0, 1]), curve([0, -1])), velocityGraph2: cset(curve([0, 1]), curve([0, 5]), curve([0, 1])),
    scaleGraph: curve([0, .15, 1, 0]), alphaGraph: curve([0, 1, 1, 0]),
    colorGraph: cset(curve([0, 1]), curve([0, 1]), curve([0, .7]))
  });

  function burst(name, pos, color) {
    const p = pools[name]; const e = p.list[p.i]; p.i = (p.i + 1) % p.list.length;
    e.setPosition(pos);
    if (color) e.particlesystem.colorGraph = cset(curve([0, color[0]]), curve([0, color[1]]), curve([0, color[2]]));
    e.particlesystem.reset(); e.particlesystem.play();
  }

  // ambient fireflies and pollen around the player
  const amb = new pc.Entity('ambient'); root.addChild(amb);
  const n = quality === 'low' ? .5 : 1;
  const flies = emitter(app, amb, {
    autoPlay: true, loop: true, numParticles: Math.round(140 * n), lifetime: 6, rate: .04, rate2: .06,
    emitterShape: pc.EMITTERSHAPE_BOX, emitterExtents: new pc.Vec3(26, 5, 70), colorMap: tex.glow,
    velocityGraph: cset(curve([0, -.4, .5, .4, 1, -.3]), curve([0, -.2, .5, .3, 1, -.2]), curve([0, -.3, 1, .3])),
    velocityGraph2: cset(curve([0, .4, .5, -.4, 1, .3]), curve([0, .2, .5, -.3, 1, .2]), curve([0, .3, 1, -.3])),
    scaleGraph: curve([0, .07, 1, .07]), alphaGraph: curve([0, 0, .2, 1, .4, .3, .6, 1, 1, 0]),
    colorGraph: cset(curve([0, .75]), curve([0, 1]), curve([0, .35])), preWarm: true
  });
  flies.setLocalPosition(0, 2.5, -20);
  const pollen = emitter(app, amb, {
    autoPlay: true, loop: true, numParticles: Math.round(220 * n), lifetime: 8, rate: .03, rate2: .04,
    emitterShape: pc.EMITTERSHAPE_BOX, emitterExtents: new pc.Vec3(22, 12, 70), colorMap: tex.glow, lighting: false,
    velocityGraph: cset(curve([0, -.1]), curve([0, -.15]), curve([0, -.1])), velocityGraph2: cset(curve([0, .1]), curve([0, .05]), curve([0, .1])),
    scaleGraph: curve([0, .035, 1, .035]), alphaGraph: curve([0, 0, .3, .35, .7, .35, 1, 0]),
    colorGraph: cset(curve([0, 1]), curve([0, .92]), curve([0, .7])), preWarm: true
  });
  pollen.setLocalPosition(0, 6, -20);

  function brazier(pos) {
    const f = emitter(app, root, {
      autoPlay: true, loop: true, numParticles: 60, lifetime: .9, rate: .015, rate2: .02, colorMap: tex.smoke, emitterRadius: .35,
      velocityGraph: cset(curve([0, -.3]), curve([0, 1.5, 1, 2.5]), curve([0, -.3])), velocityGraph2: cset(curve([0, .3]), curve([0, 2.5, 1, 3.5]), curve([0, .3])),
      scaleGraph: curve([0, .9, 1, .2]), alphaGraph: curve([0, 0, .15, 1, 1, 0]),
      colorGraph: cset(curve([0, 1, 1, 1]), curve([0, .75, 1, .25]), curve([0, .35, 1, .05])), preWarm: true
    });
    f.setPosition(pos);
  }

  return { burst, ambient: amb, brazier };
}
