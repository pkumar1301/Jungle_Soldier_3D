"""Convert the V10 Mixamo soldier (art/soldier/) into one binary glTF (soldier.glb)
with skin, texture and all ten animation clips, so PlayCanvas can load it natively."""
import json, struct, sys, numpy as np
src = sys.argv[1]; out = sys.argv[2]
rig = json.load(open(src + 'soldier_rig.json'))
clips = json.load(open(src + 'soldier_clips.json'))['clips']
raw = open(src + 'soldier_rig.bin', 'rb').read()
tex = open(src + 'soldier_texture.jpg', 'rb').read()
n, f = rig['vertexCount'], rig['triangleCount']
o = 0
def take(dt, count):
    global o
    a = np.frombuffer(raw, dtype=dt, count=count, offset=o); o += a.nbytes; return a
pos = take('<f4', n*3).reshape(n, 3); nor = take('<f4', n*3).reshape(n, 3); uv = take('<f4', n*2).reshape(n, 2)
ji = take('<u2', n*4).reshape(n, 4); jw = take('<f4', n*4).reshape(n, 4).copy(); idx = take('<u4', f*3)
jw /= np.maximum(jw.sum(1, keepdims=True), 1e-8)
nor = nor / np.maximum(np.linalg.norm(nor, axis=1, keepdims=True), 1e-8)

blob = bytearray(); views = []; accs = []
def add(arr, comp, typ, target=None, minmax=False):
    global blob
    while len(blob) % 4: blob += b'\0'
    b = np.ascontiguousarray(arr).tobytes()
    v = {'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(b)}
    if target: v['target'] = target
    views.append(v); blob += b
    cnt = arr.shape[0]
    a = {'bufferView': len(views)-1, 'componentType': comp, 'count': int(cnt), 'type': typ}
    if minmax:
        a['min'] = [float(x) for x in np.atleast_1d(arr.min(0))]; a['max'] = [float(x) for x in np.atleast_1d(arr.max(0))]
    accs.append(a); return len(accs)-1
F, U16, U32 = 5126, 5123, 5125
A_pos = add(pos.astype('<f4'), F, 'VEC3', 34962, True)
A_nor = add(nor.astype('<f4'), F, 'VEC3', 34962)
A_uv = add(uv.astype('<f4'), F, 'VEC2', 34962)
A_ji = add(ji.astype('<u2'), U16, 'VEC4', 34962)
A_jw = add(jw.astype('<f4'), F, 'VEC4', 34962)
A_idx = add(idx.astype('<u4'), U32, 'SCALAR', 34963)
ib = np.array([b['invBind'] for b in rig['bones']], dtype='<f4')
A_ib = add(ib, F, 'MAT4')
# image
while len(blob) % 4: blob += b'\0'
views.append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(tex)}); blob += tex
img_view = len(views)-1

bones = rig['bones']; nb = len(bones)
nodes = [{'name': 'Soldier', 'scale': [.01, .01, .01], 'children': [1, 2]},
         {'name': 'SoldierMesh', 'mesh': 0, 'skin': 0}]
for i, b in enumerate(bones):
    nodes.append({'name': b['name'].replace(':', ''), 'translation': b['t'], 'rotation': b['q']})
for i, b in enumerate(bones):
    if b['parent'] >= 0: nodes[2+b['parent']].setdefault('children', []).append(2+i)
nodes[0]['children'] = [1] + [2+i for i, b in enumerate(bones) if b['parent'] < 0]
name2node = {b['name']: 2+i for i, b in enumerate(bones)}

anims = []
for c in clips:
    t = (np.arange(c['frames']) / c['fps']).astype('<f4')
    A_t = add(t, F, 'SCALAR', None, True)
    samplers, channels = [], []
    hp = np.array(c['hips'], dtype='<f4').reshape(-1, 3)
    samplers.append({'input': A_t, 'output': add(hp, F, 'VEC3'), 'interpolation': 'LINEAR'})
    channels.append({'sampler': 0, 'target': {'node': name2node['mixamorig:Hips'], 'path': 'translation'}})
    for bn, q in c['q'].items():
        qa = np.array(q, dtype='<f4').reshape(-1, 4)
        samplers.append({'input': A_t, 'output': add(qa, F, 'VEC4'), 'interpolation': 'LINEAR'})
        channels.append({'sampler': len(samplers)-1, 'target': {'node': name2node[bn], 'path': 'rotation'}})
    anims.append({'name': c['name'], 'samplers': samplers, 'channels': channels})

gltf = {
  'asset': {'version': '2.0', 'generator': 'jungle-soldier soldier_to_glb.py'},
  'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': nodes,
  'meshes': [{'name': 'Soldier', 'primitives': [{'attributes': {'POSITION': A_pos, 'NORMAL': A_nor, 'TEXCOORD_0': A_uv, 'JOINTS_0': A_ji, 'WEIGHTS_0': A_jw}, 'indices': A_idx, 'material': 0}]}],
  'skins': [{'joints': [2+i for i in range(nb)], 'inverseBindMatrices': A_ib, 'skeleton': name2node['mixamorig:Hips']}],
  'materials': [{'name': 'SoldierMat', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': .05, 'roughnessFactor': .82}}],
  'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
  'images': [{'bufferView': img_view, 'mimeType': 'image/jpeg'}],
  'animations': anims, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(blob)}]}
while len(blob) % 4: blob += b'\0'
gltf['buffers'][0]['byteLength'] = len(blob)
js = json.dumps(gltf, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
with open(out, 'wb') as fh:
    fh.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)))
    fh.write(struct.pack('<II', len(js), 0x4E4F534A)); fh.write(js)
    fh.write(struct.pack('<II', len(blob), 0x004E4942)); fh.write(blob)
print('wrote', out, 12+16+len(js)+len(blob), 'bytes;', len(anims), 'clips')
