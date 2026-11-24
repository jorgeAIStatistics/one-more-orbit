// Test chambers: short rooms in plain visuals, one per gift and one for the ambush, to judge the play alone before
// any art is made for it. A gift's room is a stretch of its planet's own song with the bars laid out as the gift's
// four beats: introduce (shown, then safe), develop, twist, climax. Nothing here touches the saved game.
import type { AudioMeta, ChartFile, LevelFile } from './types';
import { FINAL, PACKS, type LevelPack } from './packs';
import ambushLevel from '../../levels/ambush/level.json';
import ambushAudio from '../../levels/ambush/audio.json';
import ambushChart from '../../levels/ambush/chart.json';
import lullabyAudio from '../../levels/lullaby/audio.json';
import lullabyBAudio from '../../levels/lullabyb/audio.json';
import fallbackAudio from '../../levels/fallback/audio.json';

export interface Chamber {
  id: string;
  name: string;
  /** one line: what to look for */
  what: string;
  pack: LevelPack;
  /** where each of the four beats starts (bars count from 1), for the label on screen */
  beats: Array<{ bar: number; label: string }>;
  /** the ambush: light notes, and the Lantern's four windows */
  ambush?: boolean;
}
/** Something to listen to, not to play. */
export interface Listen { id: string; name: string; what: string; audio: AudioMeta; from: number }

const FOUR = ['1 · INTRODUCE', '2 · DEVELOP', '3 · TWIST', '4 · CLIMAX'];

/**
 * A room cut out of a level: bars `from`..`to` (counted from 1, both included), with those bars' words replaced.
 * Every bar outside the room is a plain hop, so nothing carries in from the rest of the level.
 */
function room(base: LevelPack, id: string, from: number, to: number, bars: string[], rules: LevelFile['rules'] = {}): LevelPack {
  if (bars.length !== to - from + 1) throw new Error(`${id}: ${bars.length} bars given for ${to - from + 1}`);
  let n = 0; // bars before this section
  const segments = base.level.segments.map((s) => {
    const first = n;
    n += s.bars;
    if (!s.core) return s;
    const words = Array.from({ length: s.bars }, (_, k) => { const bar = first + k + 1; return bar >= from && bar <= to ? bars[bar - from] : first + k === 0 ? 'orb+normal+up' : 'up'; });
    return { ...s, core: { ...s.core, bars: words } };
  });
  const level: LevelFile = { ...base.level, id, segments, lab: [(from - 1) * 4, to * 4], shards: undefined, stars: undefined, rules: { ...base.level.rules, known: [], intro: true, ...rules } };
  return { ...base, level };
}

const [HEROES, SKY, BLANK, INV] = PACKS;

export const CHAMBERS: Chamber[] = [
  {
    id: 'room-meteor', name: 'The Meteor', what: 'Emberwick’s gift: tap to dash through a wall',
    // Heroes Tonight, the count bar and the whole drop (bars 16-32)
    pack: room(HEROES, 'room-meteor', 16, 32, [
      'up', 'up', 'meteor', 'up', 'up',          // the big press, then one bar shown and two real, wide
      'up', 'up', 'up', 'up',                     // develop: four bars running, gold between the walls
      'orb+up+spring', 'meteor', 'up', 'up',      // twist: thrown by a spring pad, and straight into walls on landing
      'up', 'up', 'up', 'orb+up'                  // climax: every press a wall, then out
    ], { pairs: 1 }),
    beats: [17, 21, 25, 29].map((bar, i) => ({ bar, label: FOUR[i] }))
  },
  {
    id: 'room-satellite', name: 'The Satellite', what: 'Cirra’s gift: each tap turns the zig-zag',
    // Sky High, the count bar and the whole drop (bars 25-41)
    pack: room(SKY, 'room-satellite', 25, 41, [
      'up', 'up', 'sat', 'sat', 'sat',
      'sat', 'sat', 'sat', 'sat',                 // develop: gold strung along the zig-zag
      'x1.5+sat', 'turn+sat', 'sat', 'sat',       // twist: faster, and the orbit turns round mid-run
      'x2+sat', 'sat', 'turn+sat', 'normal+orb+up' // climax: double speed, one more turn, and out
    ]),
    beats: [26, 30, 34, 38].map((bar, i) => ({ bar, label: FOUR[i] }))
  },
  {
    id: 'room-pulsar', name: 'The Pulsar', what: 'Glassmere’s gift: each tap flips to the other side of the ring',
    // Blank, the melodic drop (bars 41-56)
    pack: room(BLANK, 'room-pulsar', 41, 56, [
      'orb+up', 'pulsar', 'pulsar', 'pulsar',
      'mirror+pulsar', 'pulsar', 'pulsar', 'mirror+pulsar',                 // develop: through a mirror gate and back
      'invert+x0.5+pulsar', 'pulsar', 'pulsar', 'invert+normal+pulsar',     // twist: upside-down and at half speed
      'x2+pulsar', 'mirror+pulsar', 'pulsar', 'mirror+normal+orb+up'        // climax: double speed, mirrored
    ]),
    beats: [41, 45, 49, 53].map((bar, i) => ({ bar, label: FOUR[i] }))
  },
  {
    id: 'room-comet', name: 'The Comet', what: 'Verdance’s gift: press and hold to climb, let go to fall',
    // Invincible, the last bar of the roll and the first four phrases of the drop (bars 16-32)
    pack: room(INV, 'room-comet', 16, 32, [
      'up', 'up', 'comet', 'comet', 'comet',
      'comet', 'comet', 'comet', 'comet',
      'x1.5+comet', 'turn+comet', 'comet', 'comet',                         // twist: faster, and the orbit turns in the middle of a climb
      'invert+comet', 'comet', 'turn+comet', 'invert+normal+orb+up'         // climax: the long climb, upside-down
    ]),
    beats: [17, 21, 25, 29].map((bar, i) => ({ bar, label: FOUR[i] }))
  },
  {
    id: 'ambush', name: 'The ambush', what: 'The Snuffer on the beam: 48 seconds, six light notes, four windows', ambush: true,
    pack: { level: ambushLevel as unknown as LevelFile, audio: ambushAudio as AudioMeta, chart: ambushChart as unknown as ChartFile },
    beats: [{ bar: 1, label: 'IT ARRIVES' }, { bar: 9, label: 'IT REACHES THE LAMP' }, { bar: 17, label: 'DRIVE IT OFF' }, { bar: 25, label: 'EVERYTHING YOU HAVE' }]
  }
];

const bar = (a: AudioMeta, n: number) => a.offset + ((n * 4 * 60) / a.bpm);
export const LISTEN: Listen[] = [
  { id: 'lullaby', name: 'The lullaby · music box', what: 'Original. The prologue, the ending, and the quietest song. One bar of four taps, then 24 bars', audio: lullabyAudio as AudioMeta, from: 0 },
  { id: 'lullabyb', name: 'The lullaby · pipe', what: 'The same tune in a warmer voice', audio: lullabyBAudio as AudioMeta, from: 0 },
  { id: 'fallback', name: 'Fallback · Heroes Tonight, its opening', what: 'If neither lullaby is right: the song’s first 67 seconds, cut off where its first drop would land', audio: fallbackAudio as AudioMeta, from: 0 },
  { id: 'ambush', name: 'The ambush · a cut of Royalty', what: 'Second verse, build and drop: the Hush’s theme, heard again in the finale', audio: ambushAudio as AudioMeta, from: 0 },
  { id: 'royalty', name: 'For comparison · the finale’s first drop', what: 'Royalty as the fight uses it, from four bars before the drop', audio: FINAL.audio, from: bar(FINAL.audio, 28) }
];
