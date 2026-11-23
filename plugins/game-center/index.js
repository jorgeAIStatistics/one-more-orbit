import { registerPlugin } from '@capacitor/core';

/** The Swift side is in ios/Sources/GameCenterPlugin. On the web there is none: calls reject and the game ignores them. */
export const GameCenter = registerPlugin('GameCenter');
