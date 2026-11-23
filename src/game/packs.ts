// Every playable level: its layout, audio facts and chart. To add a level, add its folder under /levels
// (see README) and one entry here. The order here is the setlist: clearing a level unlocks the next.
import type { AudioMeta, ChartFile, LevelFile } from './types';
import manifestJson from '../../levels/manifest.json';
import skyLevel from '../../levels/skyhigh/level.json';
import skyAudio from '../../levels/skyhigh/audio.json';
import skyChart from '../../levels/skyhigh/chart.json';
import skyPresses from '../../levels/skyhigh/presses.json';
import skyAudit from '../../levels/skyhigh/audit.json';
import heroesLevel from '../../levels/heroes/level.json';
import heroesAudio from '../../levels/heroes/audio.json';
import heroesChart from '../../levels/heroes/chart.json';
import heroesPresses from '../../levels/heroes/presses.json';
import heroesAudit from '../../levels/heroes/audit.json';
import blankLevel from '../../levels/blank/level.json';
import blankAudio from '../../levels/blank/audio.json';
import blankChart from '../../levels/blank/chart.json';
import blankPresses from '../../levels/blank/presses.json';
import blankAudit from '../../levels/blank/audit.json';
import invLevel from '../../levels/invincible/level.json';
import invAudio from '../../levels/invincible/audio.json';
import invChart from '../../levels/invincible/chart.json';
import invPresses from '../../levels/invincible/presses.json';
import invAudit from '../../levels/invincible/audit.json';

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
  pack(heroesLevel, heroesAudio, heroesChart, heroesPresses, heroesAudit),
  pack(skyLevel, skyAudio, skyChart, skyPresses, skyAudit),
  pack(blankLevel, blankAudio, blankChart, blankPresses, blankAudit),
  pack(invLevel, invAudio, invChart, invPresses, invAudit)
];
