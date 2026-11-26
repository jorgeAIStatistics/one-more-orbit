"""The journey levels' specs (the owner's brief of 2026-11-26), read by tools/journey.py.

Each section: (id, label, lap, look, flags, enter, rows); each row: (bar words, taps in the bar, options).
Options: e = taps inside a leap's flight (embers), fixed = the bar's ticks by hand, down = a tap on the downbeat.
"""

LOOK = {
    'calm': {"palette": "dusk", "bg": "stars", "eq": "bars", "zoom": [0.92, 1]},
    'build': {"palette": "dusk", "bg": "stars", "eq": "bars", "zoom": [1, 1.1], "drain": [0, 0.6], "vignette": [0, 0.5]},
    'ready': {"palette": "dusk", "bg": "stars", "eq": "bars", "zoom": [1.1, 1.16], "drain": [0.6, 1], "vignette": [0.5, 0.9]},
    'drop': {"palette": "dawn", "bg": "stars", "eq": "burst", "zoom": [0.92, 0.98]},
    'drop2': {"palette": "gold", "bg": "stars", "eq": "burst", "zoom": [0.94, 1]},
    'end': {"palette": "dawn", "bg": "stars", "eq": "wave", "zoom": [1, 0.95]},
}

SPECS = {
    # ------------------------------------------------------------------ the ambush, on Darkness (150 BPM, a bar 1.6 s; bar k at 1.6 + 1.6k s)
    'darkness': dict(
        bpm=150, follow='snare', looks=LOOK,
        table=dict(floor=0.33, dbl=0.33, run=3, step=3),
        doc="The ambush, on Darkness (song bars 88-120). With two stars awake the Stillness notices: it reaches for the Landing's light, and Orbin leads it away through the dark between the worlds, everything learned so far tested under pressure, the Stillness behind and around him, swallowing each place as he leaves it. Bars 0-3 at the Landing (it reaches); 4 the flight away to the debris bridge; 8-10 the Meteor, the first freeze (hold through it); 11 a flight to the twin wrecks (a figure-eight, the wave); 14 the first skip; 16 the drop: the great node, the surge, colour draining, flung to the dead moon; skips, freezes, the Meteor, jumps; 29 the escape: a long flight home over everything it has swallowed; 30-31 the Landing's light holds, the Kindlings close by the fire, Helion's signal pulses once.",
        head={"id": "ambush", "title": "Darkness", "artist": "Lost Sky, She Is Jules", "release": "NCS Release", "hitsoundNote": 62, "scale": [2, 4, 5, 7, 9, 10, 0], "swing": False,
              "difficulty": "Normal", "adds": "Everything so far, under pressure: freezes to hold through, skips on the beat", "holds": False, "embers": [],
              "rules": {"tol": 0.12, "ahead": 3.5, "branch": 0.08, "known": ["meteor", "sat"], "buffer": 0.125, "early": 0.3}},
        places=[
            {"id": "landing", "at": [0, 0], "shape": "circle"},
            {"id": "debris", "at": [1.8, -3.2], "shape": "line", "dir": -0.3, "len": 0.5},
            {"id": "wrecks", "at": [0.4, -6.8], "shape": "eight", "size": 1.1, "cross": 52},
            {"id": "deadmoon", "at": [-2.4, -4.2], "shape": "ellipse", "size": 1.1, "rot": 0.3},
            {"id": "home", "at": [0, 0], "shape": "circle"},
        ],
        setpieces=[
            {"bar": 1, "kind": "story", "time": 1.6, "name": "It notices", "what": "the Stillness rises over the Landing and reaches for its light; Orbin draws its eye"},
            {"bar": 4, "kind": "leap", "time": 6.4, "name": "Leading it away", "what": "he throws himself off the Landing into the dark, a light to catch on the way, and it turns after him"},
            {"bar": 10, "kind": "story", "time": 16.0, "name": "The first freeze", "what": "a bar ahead, a stretch of the path darkens and starts to double; when it freezes, hold through it"},
            {"bar": 11, "kind": "leap", "time": 17.6, "name": "The wrecks", "what": "a long flight to the twin wrecks, a figure-eight; the wave"},
            {"bar": 14, "kind": "vent", "time": 22.4, "name": "The skip", "what": "the music skips and the path skips with it, on the beat: tap and you are thrown on, your double left behind"},
            {"bar": 16, "kind": "drop", "time": 25.6, "name": "The surge", "what": "the drop: the great node, a beat of stillness, colour draining in waves, and the surge flings you to the dead moon"},
            {"bar": 29, "kind": "leap", "time": 46.4, "name": "The escape", "what": "the long flight home over everything it has swallowed, two lights to catch"},
            {"bar": 30, "kind": "story", "time": 48.0, "name": "The light holds", "what": "the Landing's light holds; the Kindlings close by the fire; Helion's signal pulses once, clearly"},
        ],
        sections=[
            ('lure', 'VERSE', 16, 'calm', {}, None, [('up', 1), ('up', 2), ('up', 1), ('up+pad', 2)]),
            ('away', 'BUILD', 8, 'build', {}, None, [('leap4', 1, {'e': 1, 'clear': 12}), ('up', 2), ('up', 3), ('up+pad', 2), ('meteor', 3), ('up', 3), ('hold+up', 2, {'fixed': [0, 12]}),
                                                     ('leap4', 1, {'e': 1, 'clear': 12}), ('sat', 2), ('up', 3), ('vent', 3), ('up', 3)]),
            ('surge', 'DROP', 8, 'drop', {"smash": True, "record": True}, 'drop', [
                ('x1.5+up+leap2@2', 2, {'e': 1, 'down': True}), ('up', 3), ('vent', 3), ('up', 3), ('meteor', 3), ('vent', 3), ('hold+up', 2, {'fixed': [0, 12]}), ('up', 3),
                ('orb+down', 3), ('down', 3), ('vent+down', 3), ('down', 3), ('down', 3), ('leap4', 1, {'e': 2, 'clear': 12}), ('up', 2), ('up', 1, {'fixed': [0]})]),
        ],
    ),
    # ------------------------------------------------------------------ the guardian, on Throne (154 BPM, a bar 1.558 s; bar k at 1.558k s)
    'throne': dict(
        bpm=154, follow='snare', looks=LOOK,
        table=dict(floor=0.2, dbl=0.2, run=5, step=3),
        doc="The guardian, on Throne (Rival, Neoni; song bars 80-136). Three phases on the guardian's own body. The waking (bars 0-15): at its feet, it stirs, its head comes up, its hand sweeps across the ring (each sweep telegraphed a bar ahead in vermilion; you hop it on the beat); Helion's signal from inside its chest (8). The climb (16-31): at 16 the heavy bars throw you onto its raised arm (17-19, the Meteor through its seals), at 20 a throw to its helm, and you wind round it and in toward the slit (24-29, the seals breaking); 30-31 near silence: its heart opens. The heart (32-55): the drop throws you onto the great Star-Node in its chest; the four Kindlings come one by one and each gives its mode back (Emberwick's Meteor 33, Cirra's wave 37, Glassmere's ball 41, Verdance's snap 45); at 49 Helion's signal joins as the second spark (dual) and the camera pulls back over the whole guardian; the last tap lights its star (55).",
        head={"id": "royalty", "title": "Throne", "artist": "Rival, Neoni", "release": "NCS Release", "hitsoundNote": 64, "scale": [4, 6, 7, 9, 11, 0, 2], "swing": False,
              "difficulty": "Singularity", "adds": "Everything the four worlds gave, in turn, on the guardian's own body; and two sparks on one tap", "holds": False, "embers": [],
              "rules": {"tol": 0.09, "ahead": 2.5, "branch": 0.055, "known": ["meteor", "sat", "pulsar"], "buffer": 0.09, "early": 0.45}, "shards": [[24, 31.5], [72, 79.5], [180, 187.5]]},
        places=[
            {"id": "feet", "at": [0, 0], "shape": "circle"},
            {"id": "arm", "at": [2.3, -2.6], "shape": "line", "dir": -1.1, "len": 0.45},
            {"id": "crown", "at": [0.1, -5.3], "shape": "circle", "spiral": [106, 130], "grow": 0.45, "to": [0, 0]},
            {"id": "heart", "at": [0.15, -2.4], "shape": "circle", "size": 1.15},
        ],
        setpieces=[
            {"bar": 1, "kind": "story", "time": 1.56, "name": "It wakes", "what": "the guardian kneeling at the edge of the galaxy stirs; its head comes up and the slit in its helm lights cold"},
            {"bar": 4, "kind": "pad", "time": 6.23, "name": "The first sweep", "what": "a bar ahead a vermilion line crosses the ring; on the beat its hand sweeps through, and you hop it"},
            {"bar": 8, "kind": "story", "time": 12.47, "name": "Helion's moment", "what": "his signal, from inside the guardian's chest: the nearest it has ever been"},
            {"bar": 16, "kind": "leap", "time": 25.71, "name": "The climb", "what": "the heavy bars throw you onto its raised arm; the Meteor through its seals"},
            {"bar": 20, "kind": "leap", "time": 31.17, "name": "The helm", "what": "a throw to its helm; you wind round it and in toward the slit, the seals breaking"},
            {"bar": 30, "kind": "story", "time": 46.75, "name": "Its heart opens", "what": "near silence; the Stillness pours out of the slit and the Star-Node in its chest shows"},
            {"bar": 32, "kind": "leap", "time": 50.65, "name": "The heart", "what": "the drop: the great node, a beat of stillness, the impact; thrown onto the Star-Node in its chest"},
            {"bar": 37, "kind": "story", "time": 57.66, "name": "The Kindlings", "what": "one by one the four Kindlings come and each gives its mode back: the Meteor (33), the wave (37), the ball (41), the snap (45)"},
            {"bar": 49, "kind": "story", "time": 76.36, "name": "Two sparks", "what": "Helion's signal joins as the second spark (dual); the camera pulls back over the whole guardian"},
            {"bar": 55, "kind": "story", "time": 85.71, "name": "Its star", "what": "the last tap lights the guardian's star; it bows its head, this time by choice"},
        ],
        sections=[
            ('waking', 'BUILD', 16, 'build', {}, None, [('up', 2), ('up', 2), ('up', 3), ('hold+up', 2, {'fixed': [0, 12]}), ('up+pad', 3), ('up', 3), ('up+pad', 3), ('turn+up', 2),
                                                       ('up', 2), ('up', 3), ('up+pad', 3), ('up', 3), ('up+pad', 3), ('up', 3), ('up+pad', 4), ('up', 4)]),
            ('climb', 'BUILD', 8, 'ready', {}, None, [('x1.25+up+leap2@2', 2, {'e': 1}), ('meteor', 3), ('up', 4), ('up', 3), ('leap2', 2, {'e': 1}), ('up+pad', 3), ('hold+up', 2, {'fixed': [0, 12]}), ('up', 3),
                                                      ('up', 4), ('up', 3), ('up+pad', 4), ('up', 4), ('hold+up', 2, {'fixed': [0, 12]}), ('up', 4), ('up', 3), ('up', 4)]),
            ('heart', 'DROP', 8, 'drop', {"smash": True, "record": True}, 'drop', [
                ('x1.5+up+leap2@2', 2, {'e': 1, 'down': True}), ('up', 4), ('up', 5), ('up+pad', 4), ('up', 5),
                ('sat', 4), ('hold+up', 2, {'fixed': [0, 12]}), ('up+pad', 4), ('up', 5),
                ('pulsar', 4), ('up', 4), ('up+pad', 5), ('hold+up', 2, {'fixed': [0, 12]}),
                ('pulsar+snap', 4), ('snap', 5), ('snap+pad', 4), ('turn+snap', 4),
                ('dual', 4), ('dual', 5), ('hold+dual', 2, {'fixed': [0, 12]}), ('x1.75+dual', 5), ('turn+dual', 5), ('dual', 4), ('dual', 1, {'fixed': [0]})]),
        ],
    ),
    # ------------------------------------------------------------------ Verdance, on Willow Tree (100 BPM, a bar 2.4 s)
    'willow': dict(
        bpm=100, follow='snare', looks=LOOK,
        table=dict(floor=0.25, dbl=0.25, run=4, step=3),
        doc="Verdance, on Willow Tree (Rival & CADMIUM ft. Rosendale). The journey (2026-11-26) climbs the great tree: the roots (bars 0-7, a ring round Verdance among its roots; the Kindling gives the snap at 4; Helion's moment at 6); the drop (8) throws you up a vine into the trunk spiral (9-12, winding outward round the trunk at 1.25x); at 13 a vine flings you onto the branches (13-21, two boughs crossing, a figure-eight), the residue rising after you along it, pushed back by every good tap; the lift (19-21) at 1.5x, the camera pushing in, the dark closing to one light; the last drop (22) throws you into the canopy (23-26, a wide ring of leaves, every seed-light alight); at 27 the tree throws you to the crown, the camera pulls back over the whole relit tree, and on the crown you are two sparks at once (dual, 28-32), a sprint at 2x (30); the seal on the last stab (32).",
        head={"id": "invincible", "title": "Willow Tree (feat. Rosendale)", "artist": "Rival & CADMIUM", "release": "NCS Release", "hitsoundNote": 71, "scale": [11, 1, 3, 4, 6, 8, 10], "swing": False,
              "difficulty": "Hard", "adds": "The snap: each tap jumps you to the other side of the branch at once; dual at the crown", "holds": False, "embers": [],
              "rules": {"tol": 0.1, "ahead": 3, "branch": 0.06, "known": ["meteor", "sat", "pulsar"], "buffer": 0.1, "early": 0.45}, "shards": [[16, 23.5], [56, 63.5], [100, 107.5]]},
        places=[
            {"id": "roots", "at": [0, 0], "shape": "circle"},
            {"id": "trunk", "at": [0.2, -3.4], "shape": "circle", "spiral": [36, 52], "grow": 1.25, "to": [0, 0]},
            {"id": "branches", "at": [1.3, -7.0], "shape": "eight", "size": 1.15, "cross": 60},
            {"id": "canopy", "at": [1.5, -10.4], "shape": "ellipse", "size": 1.15, "rot": 0.12},
            {"id": "crown", "at": [0.2, -13.9], "shape": "circle", "size": 1.05},
        ],
        setpieces=[
            {"bar": 4, "kind": "story", "time": 9.6, "name": "The snap", "what": "Verdance's Kindling rises from the roots and gives the snap: each tap jumps you across the branch at once"},
            {"bar": 6, "kind": "story", "time": 14.4, "name": "Helion's moment", "what": "his motif, nearer now; his silhouette the clearest yet"},
            {"bar": 8, "kind": "leap", "time": 20.4, "name": "Up the vine", "what": "the drop: the great node, a beat of stillness, the impact; a vine whips you up into the trunk spiral; Morrow climbs beside you"},
            {"bar": 13, "kind": "leap", "time": 31.2, "name": "Chased along the branches", "what": "a vine flings you onto the long bough; the residue rises after you along it, pushed back by every good tap"},
            {"bar": 19, "kind": "speed", "time": 45.6, "name": "The lift", "what": "1.5x, the camera pushing in; the dark closes in until only his brother's signal is lit"},
            {"bar": 22, "kind": "leap", "time": 54.0, "name": "The canopy", "what": "the last drop throws you into the canopy; every seed-light alight; Morrow lifts you on its hands"},
            {"bar": 27, "kind": "leap", "time": 64.8, "name": "The crown", "what": "the tree throws you to its crown; the camera pulls back over the whole relit tree"},
            {"bar": 28, "kind": "story", "time": 67.2, "name": "Two sparks", "what": "on the crown you are two sparks at once (dual): Helion's signal answers as the second; a sprint at 2x"},
            {"bar": 32, "kind": "story", "time": 76.8, "name": "The seal", "what": "the last tap breaks the Stillness's seal on the star"},
        ],
        sections=[
            ('roots', 'VERSE', 16, 'calm', {}, None, [('up', 2), ('up', 2), ('up+pad', 3), ('up', 3)]),
            ('gift', 'BUILD', 16, 'build', {}, None, [('pulsar+snap', 3), ('snap', 4), ('snap', 2), ('snap', 5)]),
            ('climb', 'DROP', 8, 'drop', {"smash": True, "record": True}, 'drop', [
                ('x1.25+snap+leap2@2', 3, {'e': 1, 'down': True}), ('snap', 5), ('snap', 6), ('snap+pad', 5), ('snap', 6), ('leap2', 3, {'e': 1}), ('snap', 5), ('snap', 6),
                ('hold+snap', 2, {'fixed': [0, 12]}), ('snap+pad', 6), ('snap', 5)]),
            ('lift', 'BUILD', 8, 'ready', {}, 'pulse', [('x1.5+snap', 5), ('snap', 6), ('snap', 6)]),
            ('twins', 'DROP', 8, 'drop2', {}, 'pulse', [
                ('x1.75+snap+leap2@2', 3, {'e': 1, 'down': True}), ('snap', 6), ('snap+pad', 5), ('snap', 6), ('hold+snap', 2, {'fixed': [0, 12]}),
                ('leap4', 1, {'e': 2, 'clear': 12}), ('dual', 4), ('dual', 5), ('x2+dual', 4), ('dual', 5), ('dual', 1, {'fixed': [0]})]),
        ],
    ),
    # ------------------------------------------------------------------ Glassmere, on Luna (128 BPM, a bar 1.875 s; bar k at 1.875k s)
    'luna': dict(
        bpm=128, follow='snare', looks=LOOK,
        table=dict(floor=0.3, dbl=0.3, run=4, step=3),
        doc="Glassmere, on Luna (song bars 0-20, 44-64). The journey (2026-11-26): the rim of the still lake (bars 0-5, a ring round Glassmere, the ice dull; ripples to tap at 3); the Kindling rises off the lake at 4 with the ball (each tap turns gravity over); at 6 a ripple throws you to the ice stepping-stones (a line of floes, 7, Helion's moment); the drop (8): the great node, a beat of stillness, the impact, and you are thrown down onto the looking-lake, Glassmere itself, flipping across its surface on the beat (9-19), ripples throwing you, ice shards as walls; the riser accelerates (20-23), Vell: 'Come and see the other side.'; the second drop (24) throws you through the surface into the Underlake (25-35), the reflection world: the picture turns over at 26 (a mirror portal), a sprint at 2x (30), and the Underlake winds inward (31-35); at 36 the surface throws you back up, the camera pulls back over the whole relit lake, and the picture turns back as you land (37); the seal on the last stab (40).",
        head={"id": "blank", "title": "Luna", "artist": "Abandoned, GalaxyTones, DNAKM", "release": "NCS Release", "hitsoundNote": 71, "scale": [11, 1, 2, 4, 6, 7, 9], "swing": False,
              "difficulty": "Normal", "adds": "The ball: each tap turns gravity over, across the lake's surface; mirror portals into its reflection", "holds": False, "embers": [32],
              "rules": {"tol": 0.11, "ahead": 3, "branch": 0.07, "known": ["meteor", "sat"], "buffer": 0.12, "early": 0.35}, "shards": [[16, 23.5], [60, 67.5], [124, 131.5]]},
        places=[
            {"id": "rim", "at": [0, 0], "shape": "ellipse", "size": 1.05},
            {"id": "stones", "at": [0.6, -3.5], "shape": "line", "dir": 0.38, "len": 0.7},
            {"id": "lake", "at": [0, 0], "shape": "circle", "size": 1.25},
            {"id": "underlake", "at": [0.2, 4.3], "shape": "circle", "size": 1.15, "spiral": [124, 144], "grow": 0.5, "to": [0, 0]},
            {"id": "surface", "at": [0, 0], "shape": "ellipse", "size": 1.15, "rot": 0.4},
        ],
        setpieces=[
            {"bar": 4, "kind": "story", "time": 7.5, "name": "The ball", "what": "Glassmere's Kindling rises off the lake on the song's pulse and gives the ball: each tap turns gravity over"},
            {"bar": 6, "kind": "leap", "time": 11.25, "name": "The first ripple", "what": "a ripple swells under you and throws you off the rim to the ice stepping-stones, a droplet to catch on the way"},
            {"bar": 7, "kind": "story", "time": 13.125, "name": "Helion's moment", "what": "his motif from far off on the thin bar; his silhouette in the shadow ring, clearer than in Cirra"},
            {"bar": 8, "kind": "leap", "time": 15.94, "name": "The looking-lake", "what": "the drop: the great node, a beat of stillness, the impact; thrown down onto Glassmere itself, flipping across its surface on the beat"},
            {"bar": 14, "kind": "story", "time": 26.25, "name": "Vell beneath", "what": "Vell, under the water, mirrors every flip you make above"},
            {"bar": 20, "kind": "speed", "time": 37.5, "name": "The riser", "what": "the build accelerates (1.5x), the camera pushes in; Vell: 'Come and see the other side.'"},
            {"bar": 24, "kind": "leap", "time": 45.94, "name": "Through the surface", "what": "the second drop: the surface throws you through into the Underlake, the reflection world"},
            {"bar": 26, "kind": "invert", "time": 48.75, "name": "The mirror portal", "what": "the picture turns over: you are in the reflection (cool light, the stars below as above), Vell real beside you"},
            {"bar": 31, "kind": "story", "time": 58.125, "name": "The Underlake winds in", "what": "at 2x the Underlake's ring winds inward, down toward its heart"},
            {"bar": 36, "kind": "leap", "time": 67.5, "name": "Back up", "what": "the surface throws you back up; the camera pulls back over the whole relit lake; the picture turns back as you land"},
            {"bar": 40, "kind": "story", "time": 75.0, "name": "The seal", "what": "the last tap breaks the Stillness's seal on the star"},
        ],
        sections=[
            ('rim', 'VERSE', 16, 'calm', {}, None, [('up', 1), ('up', 2), ('up', 2), ('up+pad', 2)]),
            ('gift', 'BUILD', 8, 'build', {}, None, [('pulsar', 2), ('up', 3), ('leap4', 1, {'e': 1}), ('up', 2)]),
            ('surface', 'DROP', 8, 'drop', {"smash": True, "record": True}, 'drop', [
                ('x1.25+up+leap2@2', 2, {'e': 1, 'down': True}), ('up', 3), ('up', 4), ('up+pad', 3), ('mirror+up', 3), ('up', 3), ('hold+up', 2, {'fixed': [0, 12]}), ('up', 4),
                ('up+pad', 3), ('mirror+up', 3), ('up', 3), ('up', 4)]),
            ('riser', 'BUILD', 8, 'ready', {}, 'pulse', [('x1.5+up', 3), ('up', 3), ('up', 4), ('up', 4)]),
            ('mirror', 'DROP', 8, 'drop2', {}, 'pulse', [
                ('x1.75+up+leap2@2', 2, {'e': 1, 'down': True}), ('up', 3), ('mirror+up', 3), ('up+pad', 4), ('up', 4), ('hold+up', 2, {'fixed': [0, 12]}), ('x2+up', 3), ('up', 4),
                ('up', 3), ('up+pad', 4), ('x1.75+up', 3), ('up', 4), ('leap4', 1, {'e': 2}), ('mirror+up', 3), ('up+pad', 4), ('up', 3), ('up', 1, {'fixed': [0]})]),
        ],
    ),
    # ------------------------------------------------------------------ Cirra, on Flutter (128 BPM, a bar 1.875 s)
    'flutter': dict(
        bpm=128, follow='snare', looks=LOOK,
        table=dict(floor=0.23, dbl=0.35, run=3, step=3),
        doc="Cirra, on Flutter (song bars 30-49, 63-76). The journey (2026-11-26): the Still Rim (bars 0-5, an ellipse round Cirra, its kites hanging dead; a kite at 2), the wave given at 4 on the arpeggio; the first gust catches you at 6 and throws you to the kite strings (a line of light between kite-moons, 7, Helion's moment); the drop (8): the great node, a beat of stillness, the impact, and the gust throws you into the Gust Spiral round Cirra at 2x (9-11, winding outward); a gust at 12 to the Cloud Shelves (1.5x at 13, mini through the gaps 14-15); at 20 the whole relit sky, and a flight to Seo's sky round Cirra for the second drop (21-33): every kite flying, kites lifting you (22, 24, 30), a squeeze (26-27); the seal on the last stab.",
        head={"id": "skyhigh", "title": "Flutter", "artist": "Diamond Eyes", "release": "NCS Release", "hitsoundNote": 66, "scale": [6, 8, 9, 11, 1, 2, 4], "swing": False,
              "difficulty": "Normal", "adds": "The wave: each tap turns the zig-zag through the wind; mini in the tight gusts", "holds": False, "embers": [32],
              "rules": {"tol": 0.125, "ahead": 3.5, "branch": 0.08, "known": ["meteor"], "buffer": 0.13, "early": 0.25}, "shards": [[16, 23.5], [52, 59.5], [96, 103.5]]},
        places=[
            {"id": "rim", "at": [0, 0], "shape": "ellipse", "size": 1.1},
            {"id": "strings", "at": [-0.4, -3.5], "shape": "line", "dir": 0.32, "len": 0.75},
            {"id": "spiral", "at": [0, 0], "shape": "circle", "spiral": [36, 48], "grow": 1.55, "to": [0, 0]},
            {"id": "shelves", "at": [1.25, 3.4], "shape": "ellipse", "rot": -0.5, "size": 1.05},
            {"id": "seosky", "at": [0, 0], "shape": "circle", "size": 1.18},
        ],
        setpieces=[
            {"bar": 4, "kind": "story", "time": 7.5, "name": "The wave", "what": "the Kindling unfolds out of Cirra's dead wind on the arpeggio and gives the wave: each tap turns the zig-zag"},
            {"bar": 6, "kind": "leap", "time": 11.25, "name": "The first gust", "what": "a gust spiral gathers under you and throws you off the rim to the kite strings, a wind chime to ring on the way"},
            {"bar": 7, "kind": "story", "time": 13.125, "name": "Helion's moment", "what": "his music-box motif from far off on the build's thin bar; his signal in the shadow ring"},
            {"bar": 8, "kind": "leap", "time": 15.94, "name": "The spiral at double speed", "what": "the drop: the great node, a beat of stillness, the impact; then the gust throws you into the updraft round Cirra at 2x, winding outward"},
            {"bar": 12, "kind": "leap", "time": 22.5, "name": "The Cloud Shelves", "what": "a gust to the drifting cloud-rocks; mini through the narrow gaps (26.25)"},
            {"bar": 20, "kind": "leap", "time": 37.5, "name": "The whole sky", "what": "the camera pulls back on the whole relit system; a flight to Seo's sky, two chimes on the way"},
            {"bar": 21, "kind": "drop", "time": 39.375, "name": "Seo flies every kite", "what": "the second drop: Seo flies every kite at once and its kites pull you along; kites lift you on the big hits"},
            {"bar": 33, "kind": "story", "time": 61.875, "name": "The seal", "what": "the last tap breaks the Stillness's seal on the star"},
        ],
        sections=[
            ('rim', 'VERSE', 16, 'calm', {}, None, [('up', 1), ('up', 2), ('up+pad', 2), ('up', 2)]),
            ('gift', 'BUILD', 8, 'build', {}, None, [('sat', 2), ('up', 3), ('leap4', 1, {'e': 1}), ('up', 3)]),
            ('gust', 'DROP', 8, 'drop', {"smash": True, "record": True}, 'drop', [
                ('x2+up+leap2@2', 2, {'e': 1, 'down': True}), ('up', 3), ('up', 4), ('up', 3), ('leap2', 3, {'e': 1}), ('x1.5+up', 4),
                ('mini', 4), ('mini', 3), ('up', 4), ('up', 3), ('hold+up', 2, {'fixed': [0, 12]}), ('up', 4)]),
            ('lift', 'BUILD', 8, 'ready', {}, 'pulse', [('leap4', 1, {'e': 2})]),
            ('kites', 'DROP', 8, 'drop2', {}, 'pulse', [
                ('x2+up', 3, {'down': True}), ('up+pad', 4), ('up', 3), ('up+pad', 4), ('up', 4), ('mini', 4), ('mini', 3), ('up', 4),
                ('hold+up', 2, {'fixed': [0, 12]}), ('up+pad', 4), ('up', 4), ('up', 3), ('up', 1, {'fixed': [0]})]),
        ],
    ),
}
