"""Shrink the embedded textures of any GLB (rigged and animated ones included)
without touching meshes, skins or animations.
Usage: python3 shrink_glb_textures.py in.glb out.glb --tex 1024"""
import sys, json, struct, io, argparse, re
import numpy as np
from PIL import Image
ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst'); ap.add_argument('--tex', type=int, default=1024); ap.add_argument('--keep', default='')
A = ap.parse_args()
d = open(A.src, 'rb').read()
jl = struct.unpack('<I', d[12:16])[0]; g = json.loads(d[20:20 + jl])
bo = 20 + jl + 8; BIN = d[bo:bo + struct.unpack('<I', d[20 + jl:24 + jl])[0]]
# optionally drop unused animations, then drop data nothing references any more
if A.keep:
    rx = re.compile(A.keep)
    g['animations'] = [a for a in g.get('animations', []) if rx.search(a.get('name', ''))]
used_acc = set()
for m in g.get('meshes', []):
    for p in m['primitives']:
        used_acc.update(p['attributes'].values())
        if 'indices' in p: used_acc.add(p['indices'])
        for t in p.get('targets', []): used_acc.update(t.values())
for sk in g.get('skins', []):
    if 'inverseBindMatrices' in sk: used_acc.add(sk['inverseBindMatrices'])
for a in g.get('animations', []):
    for smp in a['samplers']: used_acc.update([smp['input'], smp['output']])
acc_map = {o: n for n, o in enumerate(sorted(used_acc))}
g['accessors'] = [g['accessors'][o] for o in sorted(used_acc)]
for m in g.get('meshes', []):
    for p in m['primitives']:
        p['attributes'] = {k: acc_map[v] for k, v in p['attributes'].items()}
        if 'indices' in p: p['indices'] = acc_map[p['indices']]
        if 'targets' in p: p['targets'] = [{k: acc_map[v] for k, v in t.items()} for t in p['targets']]
for sk in g.get('skins', []):
    if 'inverseBindMatrices' in sk: sk['inverseBindMatrices'] = acc_map[sk['inverseBindMatrices']]
for a in g.get('animations', []):
    for smp in a['samplers']: smp['input'] = acc_map[smp['input']]; smp['output'] = acc_map[smp['output']]
used_bv = sorted(set(a['bufferView'] for a in g['accessors'] if 'bufferView' in a) | set(im['bufferView'] for im in g.get('images', []) if 'bufferView' in im))
bv_map = {o: n for n, o in enumerate(used_bv)}
old_views = g['bufferViews']; g['bufferViews'] = [old_views[o] for o in used_bv]
for a in g['accessors']:
    if 'bufferView' in a: a['bufferView'] = bv_map[a['bufferView']]
for im in g.get('images', []):
    if 'bufferView' in im: im['bufferView'] = bv_map[im['bufferView']]
img_views = {im['bufferView']: k for k, im in enumerate(g.get('images', [])) if 'bufferView' in im}
blob = bytearray()
for vi, v in enumerate(g['bufferViews']):
    raw = BIN[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
    if vi in img_views:
        im = Image.open(io.BytesIO(raw)); im.load()
        if max(im.size) > A.tex:
            im.thumbnail((A.tex, A.tex), Image.LANCZOS)
        buf = io.BytesIO(); has_a = im.mode in ('RGBA', 'LA', 'P') and np.array(im.convert('RGBA'))[:, :, 3].min() < 250
        if has_a: im.convert('RGBA').save(buf, 'PNG', optimize=True); mime = 'image/png'
        else: im.convert('RGB').save(buf, 'JPEG', quality=88); mime = 'image/jpeg'
        raw = buf.getvalue(); g['images'][img_views[vi]]['mimeType'] = mime
    while len(blob) % 4: blob.append(0)
    v['byteOffset'] = len(blob); v['byteLength'] = len(raw); v['buffer'] = 0
    blob.extend(raw)
while len(blob) % 4: blob.append(0)
g['buffers'] = [{'byteLength': len(blob)}]
js = json.dumps(g, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
with open(A.dst, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(blob)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js); f.write(struct.pack('<II', len(blob), 0x004E4942)); f.write(blob)
print(f'{A.src} -> {A.dst}: {len(d)/1e6:.1f} MB -> {(28+len(js)+len(blob))/1e6:.1f} MB')
