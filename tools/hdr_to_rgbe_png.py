"""Re-encode a Radiance .hdr (RLE RGBE) as an RGBA PNG holding the same RGBE bytes,
so the HDRI can be served as a standard web image and loaded by PlayCanvas with
texture type RGBE."""
import sys, numpy as np
from PIL import Image
data = open(sys.argv[1], 'rb').read()
i = data.index(b'\n\n') + 2
j = data.index(b'\n', i); res = data[i:j].split(); h, w = int(res[1]), int(res[3]); p = j + 1
out = np.zeros((h, w, 4), np.uint8)
for y in range(h):
    if data[p] == 2 and data[p+1] == 2:
        p += 4
        for c in range(4):
            x = 0
            while x < w:
                n = data[p]; p += 1
                if n > 128:
                    n -= 128; out[y, x:x+n, c] = data[p]; p += 1
                else:
                    out[y, x:x+n, c] = np.frombuffer(data, np.uint8, n, p); p += n
                x += n
    else:
        out[y] = np.frombuffer(data, np.uint8, w*4, p).reshape(w, 4); p += w*4
Image.fromarray(out, 'RGBA').save(sys.argv[2], optimize=True)
print('wrote', sys.argv[2], w, h)
