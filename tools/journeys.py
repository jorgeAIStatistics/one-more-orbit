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
