// Section palettes, shared by the renderers.
export type RGB = [number, number, number];
export interface Palette { bg0: RGB; bg1: RGB; ring: RGB; acc: RGB }

export const PALETTES: Record<string, Palette> = {
  deep: { bg0: [10, 18, 52], bg1: [2, 4, 14], ring: [80, 130, 255], acc: [130, 190, 255] },
  // the sky behind the title, the galaxy map and the story: storybook indigo with warm light
  lantern: { bg0: [52, 38, 112], bg1: [10, 8, 34], ring: [255, 214, 150], acc: [255, 190, 150] },
  ocean: { bg0: [6, 38, 60], bg1: [2, 8, 20], ring: [40, 210, 225], acc: [120, 255, 240] },
  violet: { bg0: [40, 16, 72], bg1: [8, 3, 22], ring: [176, 96, 255], acc: [220, 170, 255] },
  dusk: { bg0: [58, 12, 30], bg1: [10, 2, 10], ring: [255, 128, 96], acc: [255, 190, 120] },
  neon: { bg0: [62, 10, 86], bg1: [10, 2, 30], ring: [255, 70, 210], acc: [255, 150, 240] },
  aqua: { bg0: [6, 60, 82], bg1: [2, 10, 26], ring: [0, 235, 255], acc: [160, 255, 250] },
  gold: { bg0: [84, 48, 8], bg1: [26, 6, 22], ring: [255, 207, 64], acc: [255, 240, 170] },
  hot: { bg0: [96, 16, 36], bg1: [34, 4, 44], ring: [255, 255, 255], acc: [255, 220, 240] },
  dawn: { bg0: [78, 30, 44], bg1: [16, 6, 26], ring: [255, 150, 110], acc: [255, 214, 160] },
  sky: { bg0: [16, 54, 96], bg1: [4, 10, 30], ring: [110, 190, 255], acc: [200, 235, 255] },
  ice: { bg0: [30, 46, 74], bg1: [6, 8, 18], ring: [200, 225, 255], acc: [255, 255, 255] },
  void: { bg0: [18, 8, 38], bg1: [0, 0, 0], ring: [150, 110, 255], acc: [220, 200, 255] },
  blood: { bg0: [84, 6, 14], bg1: [18, 2, 6], ring: [255, 50, 60], acc: [255, 170, 150] },
  toxic: { bg0: [24, 58, 10], bg1: [4, 12, 4], ring: [150, 255, 60], acc: [230, 255, 150] },
  // the last level: the edge of a black hole, then its white-hot core
  horizon: { bg0: [52, 8, 40], bg1: [2, 0, 6], ring: [255, 61, 139], acc: [255, 170, 210] },
  core: { bg0: [70, 44, 70], bg1: [8, 2, 14], ring: [255, 255, 255], acc: [255, 200, 225] }
};
