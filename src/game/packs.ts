// Every playable level: its layout, audio facts and the three charts. To add a level, add its folder under
// /levels (see README) and one entry here.
import type { AudioMeta, ChartFile, Difficulty, LevelFile } from './types';
import manifestJson from '../../levels/manifest.json';
import skyLevel from '../../levels/skyhigh/level.json';
import skyAudio from '../../levels/skyhigh/audio.json';
import skyNormal from '../../levels/skyhigh/normal.json';
import skyHard from '../../levels/skyhigh/hard.json';
import skyInsane from '../../levels/skyhigh/insane.json';

export interface LevelPack {
  level: LevelFile;
  audio: AudioMeta;
  charts: Record<Difficulty, ChartFile>;
}

export interface TrackCredit { id: string; title: string; artist: string; release: string; playable: boolean }
export const manifest = manifestJson as { licenceNote: string; creditSuffix: string; tracks: TrackCredit[] };

export const creditLine = (t: TrackCredit) => `${t.title} – ${t.artist} [${t.release}] · ${manifest.creditSuffix}`;

const pack = (level: unknown, audio: unknown, n: unknown, h: unknown, i: unknown): LevelPack => ({
  level: level as LevelFile,
  audio: audio as AudioMeta,
  charts: { normal: n as ChartFile, hard: h as ChartFile, insane: i as ChartFile }
});

export const PACKS: LevelPack[] = [pack(skyLevel, skyAudio, skyNormal, skyHard, skyInsane)];
