#!/usr/bin/env python3
"""Builds a plan page from its template: plan.css inlined in place of its <link>, and {{img:name}} replaced by the
still <folder>/<name>.jpg embedded as data. Usage: python3 mockups/build-plan.py <name> <folder of stills>
(reads mockups/<name>.template.html, writes mockups/<name>.html)"""
import base64, pathlib, re, sys
root = pathlib.Path(__file__).resolve().parent
name, shots = sys.argv[1], pathlib.Path(sys.argv[2])
s = (root / f'{name}.template.html').read_text()
css = (root / 'plan.css').read_text()
s = s.replace('<link rel="stylesheet" href="plan.css">', f'<style>\n{css}</style>')
def img(m):
    return 'data:image/jpeg;base64,' + base64.b64encode((shots / (m.group(1) + '.jpg')).read_bytes()).decode()
s = re.sub(r'\{\{img:([a-z0-9]+)\}\}', img, s)
left = re.findall(r'\{\{[^}]*\}\}', s)
if left: sys.exit(f'unfilled: {left}')
(root / f'{name}.html').write_text(s)
print(f'{name}.html  {len(s) / 1e6:.2f} MB')
