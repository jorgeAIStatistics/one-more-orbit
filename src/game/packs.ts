// Every playable level: its layout, audio facts and chart. To add a level, add its folder under /levels
// (see README) and one entry here. The order here is the setlist: clearing a level unlocks the next.
import type { AudioMeta, ChartFile, LevelFile } from './types';
import manifestJson from '../../levels/manifest.json';
import skyLevel from '../../levels/skyhigh/level.json';
import skyAudio from '../../levels/skyhigh/audio.json';
import skyChart from '../../levels/skyhigh/chart.json';

export interface LevelPack {
  level: LevelFile;
  audio: AudioMeta;
  chart: ChartFile;
}

export interface TrackCredit { id: string; title: string; artist: string; release: string; playable: boolean }
export const manifest = manifestJson as { licenceNote: string; creditSuffix: string; tracks: TrackCredit[] };

export const creditLine = (t: TrackCredit) => `${t.title} – ${t.artist} [${t.release}] · ${manifest.creditSuffix}`;

const pack = (level: unknown, audio: unknown, chart: unknown): LevelPack => ({ level: level as LevelFile, audio: audio as AudioMeta, chart: chart as ChartFile });

export const PACKS: LevelPack[] = [pack(skyLevel, skyAudio, skyChart)];
