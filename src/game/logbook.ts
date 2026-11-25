// The still pool: what is read there. First "The story so far" (the owner's own text: the script the whole game is
// told from, never shown as a block during play), then a short chapter for each world woken. Optional, a few short
// pages each; nothing in it is the only place a beat of the story lives. (The first world's chapter is written; the
// rest come with their worlds.)
export interface Chapter {
  id: string;
  title: string;
  /** what opens it: the opening, or a level cleared */
  after: 'prologue' | string;
  /** pages, each a few short paragraphs (no more than ninety words a page) */
  pages: string[][];
}
export const LOGBOOK: Chapter[] = [
  {
    id: 'story', title: 'The story so far', after: 'prologue',
    pages: [
      ['Long before the stars fell silent, the Harmonic Nebula spun to a single, golden pulse. Every comet hummed a melody; every orbit kept the time.', 'At its center drifted two twin sparks of starlight—Orbin and his brother Helion—dancing in effortless sync, their twin heartbeats anchoring the rhythm of the cosmos.'],
      ['Then came the Stillness. It did not roar like a supernova; it crept in like a held breath, swallowing the music one constellation at a time.', 'A shadow with no shape and no tempo coiled around the nebula’s core, choking the light until the galaxies began to fracture.'],
      ['Orbin reached out as the darkness seized Helion, their hands brushing for one final, desperate beat—before a violent shockwave tore the sky apart and hurled Orbin into the uncharted void.'],
      ['When Orbin’s glow finally flickered back to life, he was alone in a strange, quiet galaxy. The stars here were dim, frozen mid-note, and the sky felt impossibly vast.', 'Yet deep within his core, a faint, familiar rhythm still echoed—a distant signal from Helion, trapped three galaxies away behind a wall of creeping shadow.'],
      ['Orbin cannot fly back on his own. To cross the cosmos, he must wake these sleeping worlds one beat at a time.', 'Every stage is a fallen star waiting to be reignited, every timed leap a note returned to the sky.'],
      ['With each realm restored, the music grows louder, lighting the path toward the colossal guardian watching over this galaxy’s edge—the first of three great trials standing between Orbin, the heart of the darkness, and the brother he swore never to leave behind.', 'Tap to the pulse. Wake the stars. Bring him home.']
    ]
  },
  {
    id: 'ossa', title: 'Emberwick, awake', after: 'heroes',
    pages: [
      ['Emberwick: forge-hills, stopped mid-strike.', 'Ossa, a great beast of cooled slag, stood reared over a cold anvil-hill with its antlers raised, for longer than anyone was there to count.'],
      ['When the star was reignited the strike landed at last, and the hills rang.', 'Ossa gave Orbin a coal.', '“It does not stop for walls.”'],
      ['And something came back with the light: the Harmonic Nebula, all gold, and the two of them on one orbit.', '“Keep up, little brother.”', '“We’re the same age.”', '“By a heartbeat. I counted.”']
    ]
  }
];
