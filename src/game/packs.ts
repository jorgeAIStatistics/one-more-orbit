// Every playable level: its layout, audio facts and chart. To add a level, add its folder under /levels
// (see README) and one entry here. The order here is the setlist: clearing a level unlocks the next.
import type { AudioMeta, ChartFile, LevelFile } from './types';
import manifestJson from '../../levels/manifest.json';
import skyLevel from '../../levels/skyhigh/level.json';
import skyAudio from '../../levels/skyhigh/audio.json';
import skyChart from '../../levels/skyhigh/chart.json';
import heroesLevel from '../../levels/heroes/level.json';
import heroesAudio from '../../levels/heroes/audio.json';
import heroesChart from '../../levels/heroes/chart.json';
import blankLevel from '../../levels/blank/level.json';
import blankAudio from '../../levels/blank/audio.json';
import blankChart from '../../levels/blank/chart.json';
import invLevel from '../../levels/invincible/level.json';
import invAudio from '../../levels/invincible/audio.json';
import invChart from '../../levels/invincible/chart.json';

export interface LevelPack {
  level: LevelFile;
  audio: AudioMeta;
  chart: ChartFile;
}

/** Levels built for the new (hop) core so far. The others wait for the playtest of this one. */
export const SLICE = ['heroes'];

export interface TrackCredit { id: string; title: string; artist: string; release: string; playable: boolean }
export const manifest = manifestJson as { licenceNote: string; creditSuffix: string; tracks: TrackCredit[] };

export const creditLine = (t: TrackCredit) => `${t.title} – ${t.artist} [${t.release}] · ${manifest.creditSuffix}`;

const pack = (level: unknown, audio: unknown, chart: unknown): LevelPack => ({ level: level as LevelFile, audio: audio as AudioMeta, chart: chart as ChartFile });

export const PACKS: LevelPack[] = [
  pack(heroesLevel, heroesAudio, heroesChart),
  pack(skyLevel, skyAudio, skyChart),
  pack(blankLevel, blankAudio, blankChart),
  pack(invLevel, invAudio, invChart)
];
