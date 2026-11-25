"""Reduce a heavy static GLB (AI sculpts with 300k-1.5M triangles) to a game-ready
triangle budget by vertex clustering, and shrink its textures.
Usage: python3 reduce_glb.py in.glb out.glb --tris 20000 --tex 1024
Keeps UV seams (clusters split by UV), bakes node transforms, keeps materials
(base colour, normal, metal-roughness, emissive). Static meshes only."""
import sys, json, struct, io, argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--tris', type=int, default=20000); ap.add_argument('--uvq', type=int, default=256); ap.add_argument('--tex', type=int, default=1024)
A = ap.parse_args()
d = open(A.src, 'rb').read()
jl = struct.unpack('<I', d[12:16])[0]; g = json.loads(d[20:20 + jl])
bo = 20 + jl + 8; BIN = d[bo:]
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def acc(i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]
    n = NC[a['type']]; dt = np.dtype(CT[a['componentType']])
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', 0)
    if stride and stride != dt.itemsize * n:
        raw = np.frombuffer(BIN, np.uint8, stride * a['count'], off).reshape(a['count'], stride)
        arr = raw[:, :dt.itemsize * n].copy().view(dt).reshape(a['count'], n)
    else:
        arr = np.frombuffer(BIN, dt, a['count'] * n, off).reshape(a['count'], n)
    if a.get('normalized') and dt != np.float32: arr = arr.astype(np.float32) / np.iinfo(dt).max
    return arr.astype(np.float32) if dt == np.float32 else arr
def trs(n):
    if 'matrix' in n: return np.array(n['matrix'], np.float64).reshape(4, 4).T
    t = np.array(n.get('translation', [0, 0, 0])); q = n.get('rotation', [0, 0, 0, 1]); s = np.array(n.get('scale', [1, 1, 1]))
    x, y, z, w = q
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4); M[:3, :3] = R * s; M[:3, 3] = t; return M
prims = {}  # material -> list of (P, N, UV, I)
def walk(ni, parent):
    n = g['nodes'][ni]; M = parent @ trs(n)
    if 'mesh' in n:
        for p in g['meshes'][n['mesh']]['primitives']:
            if p.get('mode', 4) != 4: continue
            P = acc(p['attributes']['POSITION']).astype(np.float64)
            P = (np.c_[P, np.ones(len(P))] @ M.T)[:, :3]
            N = acc(p['attributes']['NORMAL']).astype(np.float64) if 'NORMAL' in p['attributes'] else np.zeros_like(P)
            N = N @ np.linalg.inv(M[:3, :3]).T
            UV = acc(p['attributes']['TEXCOORD_0']).astype(np.float64) if 'TEXCOORD_0' in p['attributes'] else np.zeros((len(P), 2))
            I = acc(p['indices']).reshape(-1).astype(np.int64) if 'indices' in p else np.arange(len(P))
            prims.setdefault(p.get('material', -1), []).append((P, N, UV, I.reshape(-1, 3)))
    for c in n.get('children', []): walk(c, M)
for r in g['scenes'][g.get('scene', 0)]['nodes']: walk(r, np.eye(4))
total = sum(len(x[3]) for v in prims.values() for x in v)
allP = np.concatenate([x[0] for v in prims.values() for x in v]); lo, hi = allP.min(0), allP.max(0); ext = (hi - lo).max()

def cluster(P, N, UV, I, cell):
    key = np.c_[np.floor((P - lo) / cell).astype(np.int64), np.floor(UV * A.uvq).astype(np.int64)]
    _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1)
    k = inv.max() + 1; cnt = np.bincount(inv, minlength=k)[:, None]
    nP = np.zeros((k, 3)); np.add.at(nP, inv, P); nP /= cnt
    nN = np.zeros((k, 3)); np.add.at(nN, inv, N); nN /= np.maximum(np.linalg.norm(nN, axis=1, keepdims=True), 1e-9)
    nU = np.zeros((k, 2)); np.add.at(nU, inv, UV); nU /= cnt
    T = inv[I]; ok = (T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2]); T = T[ok]
    T = np.unique(np.sort(T, axis=1) * 0 + T, axis=0) if len(T) else T
    return nP, nN, nU, T
def reduce_all(cell):
    out = {}
    for m, lst in prims.items():
        P = np.concatenate([x[0] for x in lst]); N = np.concatenate([x[1] for x in lst]); UV = np.concatenate([x[2] for x in lst])
        offs = np.cumsum([0] + [len(x[0]) for x in lst[:-1]]); I = np.concatenate([x[3] + o for x, o in zip(lst, offs)])
        out[m] = cluster(P, N, UV, I, cell)
    return out
if total <= A.tris:
    res = reduce_all(ext * 1e-6)
else:
    a, b = ext / 4000, ext / 5
    for _ in range(14):
        c = (a * b) ** .5; t = sum(len(v[3]) for v in reduce_all(c).values())
        if t > A.tris: a = c
        else: b = c
    res = reduce_all(b)
newtris = sum(len(v[3]) for v in res.values())

# ---- write GLB
blob = bytearray(); views = []; accs = []
def addbuf(b, target=None):
    while len(blob) % 4: blob.append(0)
    v = {'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(b)}
    if target: v['target'] = target
    views.append(v); blob.extend(b); return len(views) - 1
def addacc(arr, comp, typ, target, mm=False):
    bv = addbuf(np.ascontiguousarray(arr).tobytes(), target)
    a = {'bufferView': bv, 'componentType': comp, 'count': int(arr.shape[0]), 'type': typ}
    if mm: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    accs.append(a); return len(accs) - 1
# textures, resized
images = []; texmap = {}
def tex(ti, srgb):
    if ti in texmap: return texmap[ti]
    src = g['images'][g['textures'][ti]['source']]
    bv = g['bufferViews'][src['bufferView']]; raw = BIN[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
    im = Image.open(io.BytesIO(raw)); im.thumbnail((A.tex, A.tex), Image.LANCZOS)
    buf = io.BytesIO()
    if im.mode in ('RGBA', 'LA') and np.array(im.convert('RGBA'))[:, :, 3].min() < 250: im.save(buf, 'PNG', optimize=True); mime = 'image/png'
    else: im.convert('RGB').save(buf, 'JPEG', quality=88); mime = 'image/jpeg'
    images.append({'bufferView': addbuf(buf.getvalue()), 'mimeType': mime})
    texmap[ti] = len(images) - 1; return texmap[ti]
mats = []; matmap = {}
for m in res:
    if m < 0: mats.append({'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': .8}}); matmap[m] = len(mats) - 1; continue
    src = json.loads(json.dumps(g['materials'][m]))
    def fix(o, key, srgb):
        if key in o: o[key] = {'index': tex(o[key]['index'], srgb)}
    pbr = src.get('pbrMetallicRoughness', {})
    fix(pbr, 'baseColorTexture', True); fix(pbr, 'metallicRoughnessTexture', False)
    fix(src, 'normalTexture', False); fix(src, 'emissiveTexture', True); src.pop('occlusionTexture', None)
    src.pop('extensions', None); mats.append(src); matmap[m] = len(mats) - 1
primsout = []
for m, (P, N, UV, T) in res.items():
    if not len(T): continue
    primsout.append({'attributes': {'POSITION': addacc(P.astype('<f4'), 5126, 'VEC3', 34962, True), 'NORMAL': addacc(N.astype('<f4'), 5126, 'VEC3', 34962),
        'TEXCOORD_0': addacc(UV.astype('<f4'), 5126, 'VEC2', 34962)}, 'indices': addacc(T.reshape(-1).astype('<u4'), 5125, 'SCALAR', 34963), 'material': matmap[m]})
out = {'asset': {'version': '2.0', 'generator': 'jungle-soldier reduce_glb.py'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 'reduced'}],
       'meshes': [{'primitives': primsout}], 'materials': mats, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': 0}]}
if images:
    out['images'] = images; out['textures'] = [{'source': i, 'sampler': 0} for i in range(len(images))]
    out['samplers'] = [{'magFilter': 9729, 'minFilter': 9987}]
    # textures index == image index since tex() appends both in step
while len(blob) % 4: blob.append(0)
out['buffers'][0]['byteLength'] = len(blob)
js = json.dumps(out, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
with open(A.dst, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(blob)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js); f.write(struct.pack('<II', len(blob), 0x004E4942)); f.write(blob)
print(f'{A.src}: {total} -> {newtris} triangles, {len(images)} textures, {(28 + len(js) + len(blob)) / 1e6:.1f} MB')
