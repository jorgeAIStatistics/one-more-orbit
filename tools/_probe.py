import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import chart
tid = sys.argv[1]; level, audio, S = chart.load(tid)
pat = lambda v: ''.join('X' if x > .6 else ('o' if x > .33 else '.') for x in v)
for spec in sys.argv[2:]:
    a, b = map(int, spec.split('-'))
    for bar in range(a - 1, b):
        print(f"{tid} bar {bar+1:2d}  K {pat(S['kick'][bar*16:bar*16+16])}  S {pat(S['snare'][bar*16:bar*16+16])}  H {pat(S['hook'][bar*16:bar*16+16])}  F {pat(S['full'][bar*16:bar*16+16])}")
