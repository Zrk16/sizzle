"""
Measure our score against real reference films.

I cannot hear any of these. What I can do is what content-machine did for pictures:
measure the references, measure ours, and read the gap. Every number below is the same
computation applied to both, so the comparison is meaningful even though the judgement
behind it is not mine.
"""
import struct, math, sys, os

def load(path):
    raw = open(path, 'rb').read()
    # find the data chunk properly; some encoders pad the header
    i = 12
    sr = None
    while i < len(raw) - 8:
        cid = raw[i:i+4]
        size = struct.unpack('<I', raw[i+4:i+8])[0]
        if cid == b'fmt ':
            sr = struct.unpack('<I', raw[i+12:i+16])[0]
        elif cid == b'data':
            body = raw[i+8:i+8+size]
            n = len(body)//2
            return sr, struct.unpack('<%dh' % n, body[:n*2])
        i += 8 + size + (size & 1)
    raise SystemExit('no data chunk in ' + path)

def band_energy(sig, sr, lo, hi, probes=6):
    """Rough energy in a band, by correlating against probe frequencies."""
    step = max(1, (hi - lo)//probes)
    total = 0.0
    N = min(len(sig), sr * 4)
    for f in range(lo, hi, step):
        re = im = 0.0
        w = 2*math.pi*f/sr
        for i in range(0, N, 3):          # decimate; we want shape, not precision
            a = w*i
            re += sig[i]*math.cos(a); im += sig[i]*math.sin(a)
        total += re*re + im*im
    return total / max(1, probes)

def analyse(name, path):
    sr, s = load(path)
    n = len(s)
    # RMS envelope, 50ms windows
    win = int(sr*0.05); env = []
    for i in range(0, n-win, win):
        seg = s[i:i+win]
        env.append(math.sqrt(sum(x*x for x in seg)/win))
    env_sorted = sorted(env)
    med = env_sorted[len(env_sorted)//2] or 1
    p95 = env_sorted[int(len(env_sorted)*0.95)]
    peak = max(env)

    def db(v): return 20*math.log10(max(v,1)/32767)

    bands = {
        'sub 20-80':    band_energy(s, sr, 20, 80),
        'low 80-300':   band_energy(s, sr, 80, 300),
        'mid 300-2k':   band_energy(s, sr, 300, 2000),
        'high 2k-8k':   band_energy(s, sr, 2000, 8000),
    }
    tot = sum(bands.values()) or 1
    shape = {k: 100*v/tot for k, v in bands.items()}

    print(f'\n{name}')
    print(f'  loudness   median {db(med):6.1f} dBFS   p95 {db(p95):6.1f}   peak {db(peak):6.1f}')
    print(f'  dynamics   p95/median {p95/med:5.2f}x   peak/median {peak/med:5.2f}x')
    print('  spectrum   ' + '  '.join(f'{k}={v:4.1f}%' for k, v in shape.items()))
    return shape, p95/med

refs = ['airbnb_nick_8s','bolt_labssx_20s','mosy_higgs_29s','eyeson_saas_38s']
shapes = []
for r in refs:
    p = f'out/aud/{r}.wav'
    if os.path.exists(p):
        shapes.append(analyse('REF  ' + r, p)[0])
ours, ours_dyn = analyse('OURS (generated)', 'out/aud/OURS.wav')

print('\n--- reference average vs ours ---')
avg = {k: sum(sh[k] for sh in shapes)/len(shapes) for k in ours}
for k in ours:
    delta = ours[k] - avg[k]
    flag = '  <-- OFF' if abs(delta) > 12 else ''
    print(f'  {k:12} refs {avg[k]:5.1f}%   ours {ours[k]:5.1f}%   {delta:+6.1f}pt{flag}')
