export interface GameCenterPlugin {
  /** Signs the player in (shows Apple's sheet the first time). Never rejects for "not signed in". */
  signIn(): Promise<{ authenticated: boolean; alias?: string; reason?: string }>;
  /** Sends a score. Game Center keeps the player's best. */
  submitScore(options: { leaderboardId: string; score: number }): Promise<{ sent: boolean }>;
  /** Reports progress on an achievement, 0 to 100. */
  reportAchievement(options: { achievementId: string; percent: number }): Promise<{ sent: boolean }>;
  /** Opens the Game Center dashboard. */
  show(options?: { view?: 'leaderboards' | 'achievements' }): Promise<void>;
}
export declare const GameCenter: GameCenterPlugin;
