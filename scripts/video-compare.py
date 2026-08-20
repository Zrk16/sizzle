"""
Measure our film against the reference set, the way content-machine measured its own.

Same computation applied to every file, so the gap is real even though the taste behind
the references is not mine. Shot detection is a luminance-delta threshold, which is what
a cut IS at frame level.
"""
import subprocess, json, sys, math, os

def frames(path, n=140, w=160):
    """Decode n evenly spaced greyscale frames as raw bytes."""
    dur = float(subprocess.run(
        ['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',path],
        capture_output=True, text=True).stdout.strip())
    fps = n/dur
    out = subprocess.run(
        ['ffmpeg','-nostdin','-v','error','-i',path,'-vf',f'fps={fps},scale={w}:90,format=gray',
         '-f','rawvideo','-'], capture_output=True).stdout
    size = w*90
    return dur, [out[i*size:(i+1)*size] for i in range(len(out)//size)]

def stats(name, path):
    dur, fr = frames(path)
    if len(fr) < 8: 
        print(f'{name}: too few frames'); return None
    means = [sum(f)/len(f) for f in fr]
    mean_lum = sum(means)/len(means)

    # darkest 5%: the reference set's single strongest tell (real blacks)
    allpx = sorted(b for f in fr[::7] for b in f[::11])
    dark5 = allpx[int(len(allpx)*0.05)]

    # per-frame delta -> motion, and cuts where the delta spikes
    deltas = []
    for a,b in zip(fr, fr[1:]):
        deltas.append(sum(abs(x-y) for x,y in zip(a[::3],b[::3]))/len(a[::3]))
    motion = sum(deltas)/len(deltas)
    med = sorted(deltas)[len(deltas)//2]
    cuts = sum(1 for d in deltas if d > max(med*4, 18))
    shots = cuts + 1
    still = 100*sum(1 for d in deltas if d < 0.5)/len(deltas)

    print(f'{name:26} dur {dur:5.1f}s  shots {shots:3}  shot_len {dur/max(shots,1):5.2f}s  '
          f'lum {mean_lum:5.1f}  dark5 {dark5:5.1f}  motion {motion:5.2f}  still {still:4.1f}%')
    return dict(dur=dur, shots=shots, shot_len=dur/max(shots,1), lum=mean_lum,
                dark5=dark5, motion=motion, still=still)

R = 'C:/Users/ziyaa/content-machine/refs'
refs = ['airbnb_nick_8s','bolt_labssx_20s','mosy_higgs_29s','eyeson_saas_38s','kayvon_44s']
got = []
for r in refs:
    p = f'{R}/{r}.mp4'
    if os.path.exists(p) and os.path.getsize(p) > 10000:
        s = stats('REF ' + r, p)
        if s: got.append(s)

print()
ours = stats('OURS', 'out/film15.mp4')
print()
print('--- reference range vs ours ---')
for k, unit in [('shot_len','s'),('lum',''),('dark5',''),('motion',''),('still','%')]:
    lo = min(g[k] for g in got); hi = max(g[k] for g in got)
    v = ours[k]
    inside = lo <= v <= hi
    print(f'  {k:9} refs {lo:6.1f} - {hi:6.1f}{unit:2}  ours {v:6.1f}{unit:2}  {"ok" if inside else "<-- OUTSIDE"}')
