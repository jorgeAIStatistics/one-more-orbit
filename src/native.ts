// What the game asks of the device: haptics, Game Center and "the app went to the background".
// In the App Store build these reach iOS through Capacitor. On the website haptics fall back to the browser's
// vibration (Android), and Game Center simply is not there.
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar } from '@capacitor/status-bar';
import { GameCenter } from 'omo-game-center';
import { save } from './save';

/** True inside the App Store build. */
export const isNative = Capacitor.isNativePlatform();
export const canHaptics = isNative || typeof navigator.vibrate === 'function';

export type Feel = 'tap' | 'big' | 'crash' | 'win' | 'pick';
const BUZZ: Record<Feel, number | number[]> = { tap: 8, big: 28, crash: [40, 50, 70], win: [20, 60, 20, 60, 50], pick: 5 };
/** A touch you can feel. Does nothing when haptics are off in Settings or the device has none. */
export function feel(kind: Feel): void {
  if (!save.haptics || !canHaptics) return;
  try {
    if (!isNative) { navigator.vibrate(BUZZ[kind]); return; }
    if (kind === 'crash') void Haptics.notification({ type: NotificationType.Error });
    else if (kind === 'win') void Haptics.notification({ type: NotificationType.Success });
    else void Haptics.impact({ style: kind === 'big' ? ImpactStyle.Heavy : ImpactStyle.Light });
  } catch { /* a device that refuses: play on without */ }
}

// ---- Game Center. One leaderboard pair per level and one achievement per badge; the IDs are listed for
// App Store Connect in release/app-store-listing.md. Change the prefix here and there together.
// Apple only promises letters and digits in an ID, so these use neither dots nor underscores: omoBestHeroes, omoBadgeClearHeroes.
const GC = 'omo';
const camel = (s: string) => s.split(/[^a-z0-9]+/i).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
export const leaderboardId = (kind: 'best' | 'flow', level: string) => `${GC}${camel(kind)}${camel(level)}`;
export const achievementId = (badge: string) => `${GC}Badge${camel(badge)}`;
let signedIn = false;
export const gameCenter = {
  available: isNative && Capacitor.getPlatform() === 'ios',
  get signedIn() { return signedIn; },
  /** Call once at launch, and again when the player asks for the leaderboards. */
  async signIn(): Promise<boolean> {
    if (!this.available) return false;
    try { signedIn = (await GameCenter.signIn()).authenticated; } catch { signedIn = false; }
    return signedIn;
  },
  /** Best percent reached on a level (a whole number, 0 to 100). */
  best(level: string, pct: number): void {
    if (signedIn) void GameCenter.submitScore({ leaderboardId: leaderboardId('best', level), score: Math.round(pct) }).catch(() => undefined);
  },
  /** Share of taps on the beat in a clear, in tenths of a percent (987 shows as 98.7). */
  flow(level: string, onBeatPct: number): void {
    if (signedIn) void GameCenter.submitScore({ leaderboardId: leaderboardId('flow', level), score: Math.round(onBeatPct * 10) }).catch(() => undefined);
  },
  badge(id: string): void {
    if (signedIn) void GameCenter.reportAchievement({ achievementId: achievementId(id), percent: 100 }).catch(() => undefined);
  },
  async show(): Promise<void> {
    if (!this.available) return;
    if (!signedIn && !(await this.signIn())) return;
    await GameCenter.show({ view: 'leaderboards' }).catch(() => undefined);
  }
};

/** Runs `away` when the app leaves the screen (home button, a call, the app switcher) and `back` when it returns. */
export function watchBackground(away: () => void, back: () => void): void {
  if (!isNative) return; // the website gets this from the page's own visibility events
  void App.addListener('appStateChange', ({ isActive }) => { if (isActive) back(); else away(); });
  void App.addListener('pause', away);
}

/** The App Store build plays full screen: no clock or battery over the game. */
export function fullScreen(): void {
  if (isNative) void StatusBar.hide().catch(() => undefined);
}
