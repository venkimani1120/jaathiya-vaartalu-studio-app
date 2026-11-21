# Makes the event versions of the e-paper header from the plain one (python3 shared/make_event_headers.py).
# Reads jaathiya-vaartalu-web/public/jaathiyavaartalu{1,2}x.png and writes jaathiyavaartalu-<style>-{1,2}x.png
# to the web app and the Admin app. Every pixel of the plain header is cream blended with one key colour
# (maroon title, gold frame, dark text); the maroon and gold are swapped for the style's colours, so edges
# stay smooth. Styles match STYLES in jaathiya-vaartalu-backend/src/config/events.js.
import pathlib, shutil, struct, zlib
root = pathlib.Path(__file__).resolve().parent.parent
WEB = root / 'jaathiya-vaartalu-web/public'; ADMIN = root / 'jaathiya-vaartalu-admin-mobile/assets'

def load(f):
  d=open(f,'rb').read(); i=8; idat=b''
  while i<len(d):
    n,t=struct.unpack('>I4s',d[i:i+8]); c=d[i+8:i+8+n]
    if t==b'IHDR': W,H=struct.unpack('>II',c[:8]); assert c[8]==8 and c[9]==6
    if t==b'IDAT': idat+=c
    i+=12+n
  raw=zlib.decompress(idat); bpp=4; st=W*bpp; rows=[]; prev=bytearray(st); p=0
  for y in range(H):
    ft=raw[p]; line=bytearray(raw[p+1:p+1+st]); p+=1+st
    for x in range(st):
      a=line[x-bpp] if x>=bpp else 0; b=prev[x]; c=prev[x-bpp] if x>=bpp else 0
      if ft==1: line[x]=(line[x]+a)&255
      elif ft==2: line[x]=(line[x]+b)&255
      elif ft==3: line[x]=(line[x]+(a+b)//2)&255
      elif ft==4:
        pa=abs(b-c);pb=abs(a-c);pc=abs(a+b-2*c)
        pr=a if pa<=pb and pa<=pc else (b if pb<=pc else c); line[x]=(line[x]+pr)&255
    rows.append(line); prev=line
  return W,H,rows
def save(f,W,H,rows):
  raw=bytearray(); prev=bytearray(W*4)
  for line in rows:  # 'up' filter
    raw.append(2); raw+=bytes((line[x]-prev[x])&255 for x in range(len(line))); prev=line
  ch=lambda t,c: struct.pack('>I',len(c))+t+c+struct.pack('>I',zlib.crc32(t+c)&0xffffffff)
  open(f,'wb').write(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',W,H,8,6,0,0,0))+ch(b'IDAT',zlib.compress(bytes(raw),9))+ch(b'IEND',b''))

BG = (247, 241, 227); KEYS = {'maroon': (122, 9, 25), 'gold': (138, 106, 43), 'ink': (42, 26, 18)}
def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
STYLES = {
  # title in three bands like the flag (saffron, navy for the chakra, green); frame in navy
  'tricolour': {'title': [(0.0, '#E8730C'), (0.40, '#E8730C'), (0.40, '#0B2F8A'), (0.62, '#0B2F8A'), (0.62, '#138808'), (1.0, '#138808')], 'gold': '#0B2F8A'},
  'green':     {'title': [(0.0, '#2E7D32'), (1.0, '#1B5E20')], 'gold': '#5D9C3A'},
  'festive':   {'title': [(0.0, '#C62828'), (1.0, '#8E0000')], 'gold': '#C8930F'},
}
TITLE = (88, 218)   # rows of the title in the 1x picture
def grad(stops, f):
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        if f <= b or b == 1.0:
            t = 0 if b == a else min(1, max(0, (f - a) / (b - a)))
            A, B = rgb(ca), rgb(cb)
            return tuple(A[i] + (B[i] - A[i]) * t for i in range(3))
def recolour(src, dst, s, style):
    W, H, rows = load(src); st = STYLES[style]; gold = rgb(st['gold']); cache = {}
    for y in range(H):
        tcol = grad(st['title'], min(1, max(0, (y / s - TITLE[0]) / (TITLE[1] - TITLE[0]))))
        row = rows[y]
        for x in range(W):
            p = tuple(row[x * 4:x * 4 + 3])
            if p == BG: continue
            if p not in cache:   # nearest key colour and how far the pixel is from cream towards it
                best = None
                for name, K in KEYS.items():
                    d = [K[i] - BG[i] for i in range(3)]; v = [p[i] - BG[i] for i in range(3)]
                    t = max(0, min(1, sum(d[i] * v[i] for i in range(3)) / sum(c * c for c in d)))
                    err = sum((BG[i] + d[i] * t - p[i]) ** 2 for i in range(3))
                    if best is None or err < best[0]: best = (err, name, t)
                cache[p] = best[1:]
            name, t = cache[p]
            if name == 'ink': continue
            K = tcol if name == 'maroon' else gold
            row[x * 4:x * 4 + 3] = bytes(round(BG[i] + (K[i] - BG[i]) * t) for i in range(3))
    save(dst, W, H, rows)

for style in STYLES:
    for s in (1, 2):
        out = WEB / f'jaathiyavaartalu-{style}-{s}x.png'
        recolour(WEB / f'jaathiyavaartalu{s}x.png', out, s, style)
        shutil.copy(out, ADMIN / out.name)
        print('made', out.name)
