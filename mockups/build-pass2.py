#!/usr/bin/env python3
"""Builds mockups/pass2-plan.html from its template: the bible page's styles, the parts written as fragments
(mockups/pass2-parts/*.html), and the stills embedded as data. Usage: python3 mockups/build-pass2.py <folder of stills>"""
import base64, pathlib, re, sys
root = pathlib.Path(__file__).resolve().parent
shots = pathlib.Path(sys.argv[1])
s = (root / 'pass2-plan.template.html').read_text()
style = re.search(r'<style.*?</style>', (root / 'canon-bible.template.html').read_text(), flags=re.S).group(0)
style = style.replace('</style>', '  code { background: #1b1740; border: 1px solid var(--line); border-radius: 5px; padding: 1px 6px; font-size: 14.5px; }\n  td.q { font-size: 17px; }\n</style>')
style = style.replace('font-size: 12px', 'font-size: 13px')  # nothing on the page under 13 px
s = s.replace('{{STYLE}}', style)
for name in ('MUSIC', 'EMBERWICK', 'DECISIONS'):
    f = root / 'pass2-parts' / f'{name.lower()}.html'
    s = s.replace('{{' + name + '}}', f.read_text() if f.exists() else '<p class="note">(to come)</p>')
def img(m):
    f = shots / (m.group(1) + '.jpg')
    return 'data:image/jpeg;base64,' + base64.b64encode(f.read_bytes()).decode()
s = re.sub(r'\{\{img:([a-z]+)\}\}', img, s)
(root / 'pass2-plan.html').write_text(s)
print(f'pass2-plan.html  {len(s) / 1e6:.2f} MB')
