# Layouts for Heroes Tonight, Blank and Invincible (Sky High's is hand-kept in its own level.json).
# Re-run with: python tools/_levels.py   then   python tools/chart.py <id>
from _mk import seg, write
def L(p, bg='stars', eq='bars', **k): return dict(palette=p, bg=bg, eq=eq, **k)

# ---- 1. Heroes Tonight: the basics. Gates, doubles, one reverse, a speed jump and rocket at the drop. Circles only.
write('heroes', dict(id='heroes', title='Heroes Tonight (feat. Johnning)', artist='Janji', release='NCS Release', hitsoundNote=68, scale=[8, 10, 0, 1, 3, 5, 7], difficulty='Easy', adds='Planet hop: slingshots from planet to planet'), [
  seg('calm', 4, 'INTRO', 16, 'arp', ['L=8'], L('dawn', zoom=[0.9, 1]), lead='snare', motif='calm', cycle=4, teach='TAP as the ball crosses each gate'),
  seg('calm2', 4, 'INTRO', 16, 'arp', ['L=8'], L('sky'), lead='snare', motif='calm', cycle=4),
  seg('build', 2, 'BUILD', 8, 'kick', ['B=@x...x...x...x...'], L('dusk', bg='tunnel', zoom=[1, 1.04]), warn='BUILD-UP'),
  seg('build2', 4, 'BUILD', 4, 'kick', ['B=@x.x.x.x.x.x.x.x.'], L('dusk', bg='tunnel', zoom=[1.04, 1.16], drain=[0, 0.7], vignette=[0, 0.6]), warn='FASTER', chain=7),
  seg('gap', 1, 'BUILD', 4, 'kick', ['B=@x.xx............'], L('dusk', bg='tunnel', zoom=[1.16, 1.2], drain=[0.7, 0.95], vignette=[0.6, 0.9])),
  seg('count', 1, 'READY', 8, 'kick', ['B=@............X...'], L('dusk', zoom=[1.2, 1.25], drain=[1, 1], vignette=[0.9, 1]), blackout=True, count=True),
  seg('drop1', 4, 'DROP', 8, 'lead', ['L=16 acc', 'L=16', 'L=16', 'L=16'], L('dawn', bg='tunnel', eq='burst', zoom=[0.94, 1]), lead='hook', motif='drop', cycle=4, pads=True, rocket=3, sling=[1, -0.3], enter='drop'),
  seg('drop2', 4, 'DROP', 8, 'lead', ['L=16 acc', 'L=16', 'L=16', 'L=16'], L('gold', bg='tunnel', eq='burst'), lead='hook', motif='drop', cycle=4, pads=True, enter='pulse'),
  seg('drop3', 4, 'DROP', 8, 'lead', ['L=16 flip', 'L=16', 'L=16 flip', 'L=16'], L('sky', bg='grid', eq='burst', rot=[0, 0.5]), lead='hook', motif='drop', cycle=4, pads=True, enter='pulse', warn='FLIP GATES', teach='FLIP GATE: tapping it turns the ball round'),
  seg('drop4', 4, 'DROP', 8, 'lead', ['L=16 acc', 'L=16', 'L=16', 'L=16'], L('hot', bg='tunnel', eq='burst', zoom=[1, 1.08]), lead='hook', motif='drop', cycle=4, pads=True, rocket=2, orbs=True, enter='pulse'),
  seg('outro', 4, 'END', 8, 'lead', ['L=@X...............', 'L=@x...............', 'L=@x...............', '-'], L('dawn', eq='wave', zoom=[1.08, 0.95]), lead='hook', enter='flash')],
  core={'calm': {'bars': ['up'], 'record': True}, 'calm2': {'bars': ['up', 'up', 'up+sling', 'up']}, 'build': {'bars': ['up+sling', 'up'], 'pulse': True}, 'build2': {'pulse': True, 'charge': True}, 'gap': {'charge': True}, 'count': {'charge': True}, 'drop1': {'bars': ['up', 'up', 'up+sling', 'up'], 'smash': True, 'record': True}, 'drop2': {'bars': ['up+sling', 'up', 'up+sling', 'up']}, 'drop3': {'bars': ['up+sling', 'up', 'up', 'up']}, 'drop4': {'bars': ['up+sling', 'up', 'up+sling', 'up']}, 'outro': {'bars': ['up+sling', 'up', 'up', 'up']}})

# ---- 3. Blank: adds moving gates and camera tilt, and combines ghost gates, spikes, inward jumps and shapes.
TH = dict(lead='hook', motif='theme', cycle=8); ME = dict(lead='hook', motif='mel', cycle=8)
write('blank', dict(id='blank', title='Blank', artist='Disfigure', release='NCS Release', hitsoundNote=74, scale=[2, 4, 6, 7, 9, 11, 1], difficulty='Hard', adds='Spin gates: openings that come round to you, with turns and speed changes'), [
  seg('verse', 4, 'VERSE', 8, 'arp', ['L=8'], L('ice', eq='wave', zoom=[0.9, 1]), lead='snare', motif='verse', cycle=4),
  seg('verse2', 4, 'VERSE', 8, 'arp', ['L=8 flip', 'L=8', 'L=8 portal', 'L=8'], L('ice', bg='grid', eq='wave'), lead='snare', motif='verse', cycle=4, shape='ellipse', warn='PORTALS', teach='PORTAL: tap it to jump across the ring'),
  seg('theme', 8, 'THEME', 8, 'lead', ['L=16 acc', 'L=16', 'L=16', 'L=16', 'L=16', 'L=16', 'L=16', 'L=16'], L('void', bg='tunnel', eq='bars'), shape='square', rocket=2, enter='pulse', warn='THE THEME', **TH),
  seg('theme2', 8, 'THEME', 8, 'lead', ['L=16 acc', 'L=16', 'L=16', 'L=16', 'L=16 flip', 'L=16', 'L=16', 'L=16'], L('violet', bg='tunnel', eq='bars', tilt=[0, 0.22]), shape='square', sling=[-1, -0.2], warn='SLINGSHOT', enter='pulse', **TH),
  seg('spikes', 4, 'BUILD', 4, 'snare', ['L=@x...x...x...x... hop'], L('dusk', bg='grid', zoom=[1, 1.06], tilt=[0.22, 0]), lead='snare', jump='in', warn='SPIKES', teach='SPIKES: tap the arrow to hop over'),
  seg('rush', 4, 'BUILD', 4, 'snare', ['L=@x.x.x.x.x.x.x.x.'], L('dusk', bg='grid', zoom=[1.06, 1.22], drain=[0, 0.95], vignette=[0, 0.9]), lead='snare', jump='in', mini=True, warn='MINI MODE'),
  seg('heavy', 4, 'DROP', 8, 'kick', ['L=8 acc hop', 'L=8 hop', 'L=8 hop', 'L=8 hop'], L('blood', bg='grid', eq='burst', zoom=[0.92, 1]), lead='full', motif='heavy', cycle=4, shape='square', rocket=4, sling=[1, 0.3], hazard='beam', enter='drop', teach='BEAMS sweep the ring: tap to hop them'),
  seg('heavy2', 4, 'DROP', 8, 'kick', ['L=8 hop', 'L=8 hop', 'L=8 hop', 'L=8 hop'], L('blood', bg='tunnel', eq='burst', rot=[0, -0.5]), lead='full', motif='heavy', cycle=4, shape='square', hazard='beam', enter='pulse'),
  seg('mel', 8, 'DROP', 8, 'lead', ['L=16 acc', 'L=16', 'L=16', 'L=16', 'L=16', 'L=16', 'L=16', 'L=16'], L('ice', bg='tunnel', eq='burst', zoom=[1, 1.06]), shape='ellipse', rocket=2, sling=[-1, 0.25], enter='pulse', warn='SLINGSHOT', **ME),
  seg('mel2', 8, 'DROP', 8, 'lead', ['L=16 flip', 'L=16', 'L=16 portal', 'L=16', 'L=16 flip', 'L=16', 'L=16 portal', 'L=16'], L('hot', bg='tunnel', eq='burst', rot=[0, 1], flip=True), shape='circle', enter='pulse', warn='FLIPS AND PORTALS', **ME),
  seg('end', 1, 'END', 8, 'kick', ['B=@X...............'], L('ice', eq='wave'), rocket=6, enter='flash')],
  core={'verse': {'bars': ['up', 'up', 'up+sling', 'down']}, 'verse2': {'bars': ['turn+up', 'weave', 'up', 'down']}, 'theme': {'bars': ['spin', 'spin', 'up+sling', 'up', 'spin', 'weave', 'spin', 'down'], 'record': True}, 'theme2': {'bars': ['fast+spin', 'spin', 'weave', 'up', 'turn+spin', 'spin', 'down', 'normal+up']}, 'spikes': {'bars': ['up', 'weave', 'spin', 'spin'], 'pulse': True}, 'rush': {'pulse': True, 'charge': True}, 'heavy': {'bars': ['slow+spin', 'spin', 'turn+spin', 'spin'], 'smash': True, 'record': True}, 'heavy2': {'bars': ['spin', 'weave', 'spin+sling', 'down']}, 'mel': {'bars': ['fast+spin', 'weave', 'up+sling', 'spin', 'turn+spin', 'down', 'spin', 'weave'], 'record': True}, 'mel2': {'bars': ['spin', 'spin', 'weave', 'down', 'up+sling', 'spin', 'turn+spin', 'normal+up']}, 'end': {'bars': ['up']}})

# ---- 4. Invincible: everything, on swung 16ths. The drop is the densest, fastest-changing stretch in the game.
DR = dict(motif='drop', cycle=4, enter='pulse')
write('invincible', dict(id='invincible', title='Invincible', artist='DEAF KEV', release='NCS Release', hitsoundNote=65, scale=[0, 1, 3, 5, 7, 8, 10], swing=True, difficulty='Insane', adds='Twin orbit: one tap moves two mirrored balls, plus every mode before'), [
  seg('groove', 4, 'GROOVE', 4, 'kick', ['B=8'], L('toxic', bg='grid', zoom=[0.9, 1]), motif='groove', cycle=4),
  seg('groove2', 4, 'GROOVE', 4, 'kick', ['B=8 flip', 'B=8', 'B=8 portal', 'B=8'], L('toxic', bg='grid', rot=[0, 0.25]), motif='groove', cycle=4, shape='ellipse', warn='FLIPS AND PORTALS'),
  seg('break', 4, 'BREAK', 4, 'snare', ['L=@.....xxx.....xxx', 'L=@.....xxx......x.', 'L=@.....xxx.....xxx', 'L=@x...xxxx....x...'], L('void', eq='wave'), lead='snare', jump='in', warn='SWUNG TRIPLES'),
  seg('build', 2, 'BUILD', 4, 'kick', ['B=@x...x...x...x... hop'], L('dusk', bg='grid', zoom=[1, 1.08], drain=[0, 0.4], vignette=[0, 0.4]), jump='in', hazard='beam', warn='BEAMS'),
  seg('roll', 2, 'BUILD', 4, 'kick', ['B=@x.x.x.x.x.x.x.x.', 'B=@x.x....xX.......'], L('dusk', bg='grid', zoom=[1.08, 1.22], drain=[0.4, 1], vignette=[0.4, 1]), jump='in', mini=True, warn='MINI MODE'),
  seg('drop1', 4, 'DROP', 4, 'kick', ['B=16 acc', 'B=16', 'B=16', 'B=16'], L('toxic', bg='tunnel', eq='burst', zoom=[0.92, 1]), shape='square', rocket=5, sling=[1, -0.3], **{**DR, 'enter': 'drop'}),
  seg('drop2', 4, 'DROP', 4, 'kick', ['B=16 flip', 'B=16', 'B=16 flip', 'B=16'], L('blood', bg='tunnel', eq='burst', tilt=[0, 0.2]), shape='square', warn='FLIP GATES', **DR),
  seg('drop3', 4, 'DROP', 4, 'kick', ['B=16 portal', 'B=16 flip', 'B=16 portal', 'B=16 flip'], L('void', bg='grid', eq='burst', rot=[0, 1], tilt=[0.2, 0]), shape='ellipse', rocket=2, sling=[-1, 0.3], warn='SLINGSHOT', **DR),
  seg('drop4', 4, 'DROP', 4, 'kick', ['B=16 acc', 'B=16', 'B=16', 'B=16'], L('gold', bg='tunnel', eq='burst', flip=True), shape='circle', jump='in', mini=True, warn='MINI MODE', **DR),
  seg('drop5', 4, 'DROP', 4, 'kick', ['B=16 flip', 'B=16 portal', 'B=16 flip', 'B=16 portal'], L('toxic', bg='grid', eq='burst', rot=[0, -1]), shape='square', rocket=4, sling=[1, 0.3], warn='EVERYTHING', **DR),
  seg('drop6', 4, 'DROP', 4, 'kick', ['B=16 acc', 'B=16', 'B=16', 'B=16'], L('hot', bg='tunnel', eq='burst', zoom=[1, 1.1], flip=True), shape='circle', sling=[-1, -0.3], **DR),
  seg('end', 1, 'END', 8, 'kick', ['B=@X...............'], L('toxic', eq='wave'), rocket=6, enter='flash')],
  core={'groove': {'bars': ['up', 'weave', 'up', 'down']}, 'groove2': {'bars': ['turn+up', 'spin', 'up+sling', 'weave']}, 'break': {'bars': ['twin', 'twin', 'twin+weave', 'twin+spin'], 'record': True}, 'build': {'pulse': True, 'charge': True}, 'roll': {'pulse': True, 'charge': True}, 'drop1': {'bars': ['up', 'weave', 'up+sling', 'spin'], 'smash': True, 'record': True}, 'drop2': {'bars': ['twin', 'twin+weave', 'twin', 'twin+spin']}, 'drop3': {'bars': ['fast+down', 'weave', 'turn+spin', 'normal+up']}, 'drop4': {'bars': ['twin', 'twin+weave', 'twin+spin', 'twin'], 'record': True}, 'drop5': {'bars': ['turn+twin', 'twin+weave', 'down', 'twin']}, 'drop6': {'bars': ['twin+spin', 'twin+weave', 'twin', 'twin']}, 'end': {'bars': ['up']}})

