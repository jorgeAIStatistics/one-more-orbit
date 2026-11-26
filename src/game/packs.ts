// Every playable level: its layout, audio facts and chart. To add a level, add its folder under /levels
// (see README) and one entry here. The order here is the setlist: clearing a level unlocks the next.
import type { AudioMeta, ChartFile, LevelFile } from './types';
import manifestJson from '../../levels/manifest.json';
import skyLevel from '../../levels/flutter/level.json';
import skyAudio from '../../levels/flutter/audio.json';
import skyChart from '../../levels/flutter/chart.json';
import skyPresses from '../../levels/flutter/presses.json';
// (Emberwick's song is Volcano now; the level keeps the world's id, "heroes", so saves, scenes and stars still find it)
import heroesLevel from '../../levels/volcano/level.json';
import heroesAudio from '../../levels/volcano/audio.json';
import heroesChart from '../../levels/volcano/chart.json';
import heroesPresses from '../../levels/volcano/presses.json';
import startedLevel from '../../levels/started/level.json';
import startedAudio from '../../levels/started/audio.json';
import startedChart from '../../levels/started/chart.json';
import startedPresses from '../../levels/started/presses.json';
import nebulaLevel from '../../levels/nebula/level.json';
import nebulaAudio from '../../levels/nebula/audio.json';
import nebulaChart from '../../levels/nebula/chart.json';
import nebulaPresses from '../../levels/nebula/presses.json';
import mboxLevel from '../../levels/mbox1/level.json';
import mboxAudio from '../../levels/mbox1/audio.json';
import mboxChart from '../../levels/mbox1/chart.json';
import mboxPresses from '../../levels/mbox1/presses.json';
import blankLevel from '../../levels/luna/level.json';
import blankAudio from '../../levels/luna/audio.json';
import blankChart from '../../levels/luna/chart.json';
import blankPresses from '../../levels/luna/presses.json';
import invLevel from '../../levels/willow/level.json';
import invAudio from '../../levels/willow/audio.json';
import invChart from '../../levels/willow/chart.json';
import invPresses from '../../levels/willow/presses.json';
import royLevel from '../../levels/royalty/level.json';
import royAudio from '../../levels/royalty/audio.json';
import royChart from '../../levels/royalty/chart.json';
import royPresses from '../../levels/royalty/presses.json';
import royAudit from '../../levels/royalty/audit.json';
import heroesB from '../../levels/heroes/bside.json';
import skyB from '../../levels/flutter/bside.json';
import blankB from '../../levels/luna/bside.json';
import invB from '../../levels/willow/bside.json';

export interface LevelPack {
  level: LevelFile;
  audio: AudioMeta;
  chart: ChartFile;
  /** press moments recorded by hand (Record Mode); bars without one use the chart */
  presses?: { bars: Record<string, { by: 'hand'; t: number[]; f?: number[] }> };
  /** the audio audit's corrections to the generated presses (tools/audit.py): ticks to demote to flow notes and to promote to presses */
  audit?: { demote: number[]; promote: number[] };
}

/** Levels built for the ring-hop core. */
export const SLICE = ['heroes', 'skyhigh', 'blank', 'invincible'];

export interface TrackCredit { id: string; title: string; artist: string; release: string; playable: boolean }
export const manifest = manifestJson as { licenceNote: string; creditSuffix: string; tracks: TrackCredit[] };

export const creditLine = (t: TrackCredit) => `${t.title} – ${t.artist} [${t.release}] · ${manifest.creditSuffix}`;

const pack = (level: unknown, audio: unknown, chart: unknown, presses?: unknown, audit?: unknown): LevelPack => ({ level: level as LevelFile, audio: audio as AudioMeta, chart: chart as ChartFile, presses: presses as LevelPack['presses'], audit: audit as LevelPack['audit'] });

export const PACKS: LevelPack[] = [
  pack(heroesLevel, heroesAudio, heroesChart, heroesPresses),
  pack(skyLevel, skyAudio, skyChart, skyPresses),
  pack(blankLevel, blankAudio, blankChart, blankPresses),
  pack(invLevel, invAudio, invChart, invPresses)
];

/** What a level's bside.json holds: the harder rules, and how each section's bars play on the night side. */
interface BSideFile { difficulty: string; adds: string; side: { tol?: number; ahead?: number; mirror?: boolean; speed?: number }; bars: Record<string, string[]> }

/** A level's B-side: the same song, notes and holds, with the night side's rules and bars. No star trails. */
function bside(base: LevelPack, file: unknown): LevelPack {
  const b = file as BSideFile;
  const level: LevelFile = {
    ...base.level,
    id: `${base.level.id}-b`,
    difficulty: b.difficulty,
    adds: b.adds,
    side: { of: base.level.id, ...b.side },
    stars: undefined,
    shards: undefined,
    segments: base.level.segments.map((s) => (b.bars[s.id] && s.core ? { ...s, core: { ...s.core, bars: b.bars[s.id] } } : s))
  };
  return { ...base, level };
}

/** The hidden levels: one B-side per level, in the same order. */
export const BSIDES: LevelPack[] = [bside(PACKS[0], heroesB), bside(PACKS[1], skyB), bside(PACKS[2], blankB), bside(PACKS[3], invB)];

/** The level behind the gate at the end of the world. Not on the route: it opens on stars, not on a clear. */
export const FINAL: LevelPack = pack(royLevel, royAudio, royChart, royPresses, royAudit);

/**
 * Memories of Helion: one after each world's first clear, played as a twin orbit in the Harmonic Nebula. They cannot
 * be failed and keep no record. Keyed by the world whose star, reignited, gives the memory back. (One is built so far.)
 */
export const MEMORIES: Record<string, LevelPack> = { heroes: pack(mboxLevel, mboxAudio, mboxChart, mboxPresses) };

/**
 * The first stage: the Drifting Edge, the planetoid Orbin fell on. It is not on the map: the opening's first tap starts
 * it, and it ends with the planetoid's own star, the first of all. (It can be flown again from the still pool.)
 */
export const FIRST: LevelPack = pack(startedLevel, startedAudio, startedChart, startedPresses);
export const FIRST_ID = FIRST.level.id;

/** The cold open: the Harmonic Nebula before the Stillness. A twin orbit that cannot be failed, on Helion's theme. */
export const COLD: LevelPack = pack(nebulaLevel, nebulaAudio, nebulaChart, nebulaPresses);
