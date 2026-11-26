import './style.css';
import { audio } from './audio/audio';
import { OLD_QUESTS, ORBS, earned, type Orb } from './game/extras';
import { AMBUSH, BSIDES, FINAL, FIRST, FIRST_ID, MEMORIES, PACKS as ALL_PACKS, SLICE, creditLine, manifest, type LevelPack } from './game/packs';
import { LOGBOOK } from './game/logbook';
import { STAR_PLACES, STAR_TOTAL, starLit, starsLit, starsOf, type StarProgress } from './game/stars';
import { FINAL_ID, NODES, maxStars, nodeOf, nodeState, playable, type MapNode, type Progress } from './game/world';
import { refreshBars } from './gd/presses';
import { GdRenderer as Renderer } from './gd/render';
import { GdRun as Run, TUTORIAL_BEATS } from './gd/run';
import { CHAMBERS, LISTEN, type Chamber } from './game/chambers';
import type { AudioMeta } from './game/types';
import hub0Audio from '../levels/hub0/audio.json';
import hub1Audio from '../levels/hub1/audio.json';
import fire0Audio from '../levels/fire0/audio.json';
import fire1Audio from '../levels/fire1/audio.json';
import sting1Audio from '../levels/sting1/audio.json';
import sting2Audio from '../levels/sting2/audio.json';
import helion1Audio from '../levels/helion1/audio.json';
import helion2Audio from '../levels/helion2/audio.json';
import helion3Audio from '../levels/helion3/audio.json';
import helion4Audio from '../levels/helion4/audio.json';
import helion5Audio from '../levels/helion5/audio.json';
import { BEFORE2, CirraWorld, GlassWorld, VerdWorld, WRITTEN2 } from './ui/worlds2';
import { canHaptics, feel, fullScreen, gameCenter, isNative, watchBackground } from './native';
import { initRecord } from './record';
import { bestFor, persist, save, starCount, starsFor } from './save';
import { SkyMap, type SkyInfo, type SkyNode } from './ui/skymap';
import { SkyTitle } from './ui/skytitle';
import { SkyOpening } from './ui/skyopening';
import { SkyLanding } from './ui/skylanding';
import { SkyStar } from './ui/skystar';
import { SkyCold } from './ui/skycold';
import { SkyMemory } from './ui/skymemory';
import { askEmber, EdgeWorld, EmberWorld, type World, type WorldSky } from './ui/worlds';
import { AmbushWorld, AMBUSH_SAYS } from './ui/worldamb';
import { LANDING } from './art/landingpaint.js';
import { K as PK } from './art/painter.js';
import { CANON as PCANON } from './art/canonpaint.js';
import { COLDPAINT as PCOLD } from './art/coldpaint.js';
import { WORLDS as PWORLDS } from './art/worldpaint.js';
import { COMPANIONS } from './art/companions.js';
import { SkyStory } from './ui/skystory';
import { SkyResult, type ResultInfo } from './ui/skyresult';
import { NebulaScene, PlanetScene, type Said } from './ui/skyplanet';
import { SkyMoment } from './ui/skymoment';
import { SkyRooms, type GlowsInfo, type Room, type StarsInfo, type SyncInfo } from './ui/skyrooms';
import { STORY, planetName, type Frame } from './ui/galaxy';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
type Screen = 'cold' | 'prologue' | 'title' | 'levels' | 'play' | 'pause' | 'results' | 'settings' | 'calib' | 'orbs' | 'stars' | 'credits' | 'logbook' | 'record' | 'story' | 'moment' | 'chambers';
const SCREENS: Screen[] = ['cold', 'prologue', 'title', 'levels', 'pause', 'results', 'settings', 'calib', 'orbs', 'stars', 'credits', 'logbook', 'record', 'story', 'moment', 'chambers'];
/** The screens that are a place on the Landing, painted on the canvas. */
const ROOM_OF: Partial<Record<Screen, Room>> = { settings: 'desk', calib: 'lamp', orbs: 'hearth', stars: 'gallery', credits: 'page', logbook: 'page' };

const PACKS = ALL_PACKS.filter((p) => SLICE.includes(p.level.id));
const shortTitle = (p: LevelPack) => p.level.title.replace(/ \(.*/, '');
/** Every level there is: the four planets, their B-sides (the moons), and the one behind the gate. */
const ALL = [...PACKS, ...BSIDES, FINAL, AMBUSH];
const packOf = (id: string) => (id === 'gate' ? FINAL : ALL.find((p) => p.level.id === id));
/** The level a pack is a version of: itself, or for a B-side its planet's. */
const baseOf = (p: LevelPack) => p.level.side?.of ?? p.level.id;
/** What the map's rules read: clears, stars, and the playtest switch that opens every planet and shows every moon. */
const progress: Progress = { cleared: (id) => bestFor(id).cleared, stars: starsFor, get unlockAll() { return save.unlockAll || /[?&]unlock=1/.test(location.search); } };
/** What the stars read: clears, the gold collected, and the two feats that are done once (a shard run, a daredevil clear). */
const feat = (key: string) => !!save.feats[key];
const starProgress: StarProgress = { cleared: (id) => bestFor(id).cleared, gold: (id) => save.gold[id] ?? 0, feat };
/** Where the player is on the map; `pack` is the level there (for the gate, the last one looked at). */
let at: MapNode = nodeOf(save.at || PACKS[Math.max(0, Math.min(PACKS.length - 1, save.level || 0))].level.id);
let levelIdx = Math.min(PACKS.length - 1, at.index);
let pack = packOf(at.id) ?? PACKS[levelIdx];
const canPlay = () => playable(at, progress);
/** "Emberwick", or "Emberwick's moon" for a B-side. */
const placeName = (p: LevelPack) => (p.level.side ? `${planetName(p.level.id)}’s moon` : planetName(p.level.id));
/** A glow is Orbin's from the start, or for a badge, or for daring a planet (in an older save: for both of its quests), or for clearing its night side. */
const owned = (o: Orb): boolean => {
  if (!o.needs) return true;
  const [kind, lvl] = o.needs.split(':');
  return kind === 'dare' ? feat(o.needs) || (OLD_QUESTS[lvl] ?? ['']).every((q) => !!save.quests[q]) : kind === 'moon' ? bestFor(`${lvl}-b`).cleared : !!save.badges[o.needs];
};

const renderer = new Renderer($<HTMLCanvasElement>('stage'));
// (the one-signal look is the game's look now; the one before it is kept behind ?look=1, to compare)
renderer.look = /[?&#]look=1\b/.test(location.search + location.hash) ? 1 : 2;
/** the galaxy map: one painted sky you tap things in */
const sky = new SkyMap($<HTMLCanvasElement>('stage'));
/** the title: the horizon under that sky */
const skyTitle = new SkyTitle($<HTMLCanvasElement>('stage'));
/** the story: painted scenes with the words written into them */
const skyStory = new SkyStory($<HTMLCanvasElement>('stage'));
/** the opening: the drifting edge, up to the first tap (and its bloom over the level that tap starts) */
const opening = new SkyOpening($<HTMLCanvasElement>('stage'));
const skyResult = new SkyResult($<HTMLCanvasElement>('stage'));
/** the short scenes of a first clear: the gift, the road */
const moment = new SkyMoment($<HTMLCanvasElement>('stage'));
/** the Harmonic Nebula: the sky of a memory of Helion */
const nebula = new NebulaScene();
/** the Landing's places (settings, the sync check, glows, the stars, the still pool), and the held breath of a pause */
const rooms = new SkyRooms($<HTMLCanvasElement>('stage'));
/** the Landing: the title, where every star is carried home, and the ground under the first stage */
const landing = new SkyLanding($<HTMLCanvasElement>('stage'));
landing.wordmark = (x, y, size, align, a, t) => skyTitle.wordmark(x, y, size, align, a, t);
/** the star collection, drawn over the end of a level */
const skyStar = new SkyStar($<HTMLCanvasElement>('stage'));
/** the cold open: a scene (calm, wrongness, the taking, black), its one interaction a press-and-hold */
const coldScene = new SkyCold($<HTMLCanvasElement>('stage'));
const memoryFilm = new SkyMemory($<HTMLCanvasElement>('stage'));
/** the worlds you play on: Emberwick and the Drifting Edge, each a planet in the ring and its inhabitant beside it */
const emberWorld = new EmberWorld();
const edgeWorld = new EdgeWorld();
/** the ambush, after the second star (2026-11-26) */
const ambushWorld = new AmbushWorld();
/** the worlds after Emberwick, built as places (2026-11-25) */
const WORLDS2: Record<string, CirraWorld | GlassWorld | VerdWorld> = { skyhigh: new CirraWorld(), blank: new GlassWorld(), invincible: new VerdWorld() };
// (every planet and level sky is painted by the paint worker soon after the page opens, so no level opens with a hitch)
window.setTimeout(() => { edgeWorld.askAhead(); askEmber(); for (const w of Object.values(WORLDS2)) w.askAhead(); }, 400);
/** stars home in the Landing's fire: the planetoid's own, and one for every world woken */
const starsHome = () => (bestFor(FIRST_ID).cleared ? 1 : 0) + PACKS.filter((p) => bestFor(p.level.id).cleared).length;
let screen: Screen = 'title';
let settingsFrom: Screen = 'levels';
let run: Run | null = null;
let botMode = /[?&]bot=1/.test(location.search);
/** tests: autoplay plays on through the star, the flight home and the memory, and its clear counts (as a player's would) */
type RGB3 = [number, number, number];
const botStar = /[?&#]botstar\b/.test(location.search + location.hash);
let practice = false;
/** a daredevil flight: one attempt, and a fall sends you home */
let dare = false;
/** falls taken back to an ember since this attempt began from the start (none, on a clear: the Unbroken star) */
let emberFalls = 0;
/** the embers of the level being played, in beats (practice: every section; a daredevil, a chamber or autoplay: none) */
let emberBeats: number[] = [];
let emberLit = -1;
/** how far the pause has come down over the scene, 0..1 */
let held = 0;
let lastFrame = performance.now();
/** this visit to a level: the furthest any attempt got, and its flow, for the results screen */
const session = { far: 0, newBest: false, onBeat: 0, judged: 0, streak: 0, drop: -1, attempts: 0 };

/** Input events carry the time the tap happened; fall back to "now" on browsers that report something else. */
const stamp = (e: Event) => (Math.abs(e.timeStamp - performance.now()) < 2000 ? e.timeStamp : performance.now());
const fmtMs = (ms: number) => `${ms > 0 ? '+' : ''}${Math.round(ms)} ms`;


// ------------------------------------------------------------------ screens
function show(s: Screen): void {
  const was = screen;
  screen = s;
  for (const id of SCREENS) $(id).classList.toggle('on', id === s);
  $('hud').classList.toggle('hidden', !(s === 'play' || s === 'pause'));
  $('hud').classList.toggle('held', s === 'pause');
  $('levels').classList.remove('launch');
  // the sheet behind the developer screens: bare, in the Lantern's colours. Colour is what the Hush took: it warms
  // with every planet restored, and floods when the Hush sleeps.
  renderer.idleAt = [0.5, 0.46];
  renderer.idleScale = 1;
  renderer.idleBare = true;
  renderer.idlePal = 'lantern';
  const home = PACKS.filter((p) => bestFor(p.level.id).cleared).map((p) => p.level.id);
  renderer.idleColour = bestFor(FINAL_ID).cleared ? 1 : home.length * 0.12;
  rooms.calm = save.reducedMotion;
  const room = ROOM_OF[s];
  if (room && s !== was) rooms.enter(room);
  if (s === 'levels') {
    sky.settle();
    renderMap(); queuePreview();
    if (arrived) { // home, with a star newly awake: the Landing is where the picture rests, and it says so once
      const n = starsHome(); // (the planetoid's own star counts: it is in the fire)
      sky.chosen = null;
      sky.say(`${['No', 'One', 'Two', 'Three', 'Four'][n] ?? n} star${n === 1 ? '' : 's'} awake. He\u2019s a little clearer.`);
      arrived = '';
    }
    if (starCount() >= maxStars && save.story.end && !save.story.lens) window.setTimeout(() => { if (screen === 'levels') playStory('lens', () => show('levels')); }, 600);
  }
  if (s === 'play') audio.stopPreview(0.9);
  if (s === 'title' && was !== 'title') fireTheme();
}

// ------------------------------------------------------------------ the story
/** the chapter waiting to be told on the way back to the map (a world just woken, or the ending) */
let pendingStory = '';
let storyFrames: Frame[] = [];
let storyAt = 0;
let storyThen: (() => void) | null = null;
function renderStory(): void {
  const f = storyFrames[storyAt];
  skyStory.show(f.scene, f.text, storyFrames.length > 1); // the scene is painted on the canvas; the words fade in over it
  $('storyText').textContent = f.text;
}
function endStory(): void {
  const then = storyThen;
  storyThen = null;
  storyFrames = [];
  then?.();
}
function nextStory(): void {
  if (screen !== 'story') return;
  if (storyAt + 1 < storyFrames.length) { storyAt++; renderStory(); } else endStory();
}
/** Tells a chapter once (always, with `again`), then carries on. Autoplay never stops for it. */
function playStory(key: string, then: () => void, again = false): void {
  const frames = key === 'all' ? Object.values(STORY).flat() : STORY[key];
  if (!frames || botMode || (!again && save.story[key])) { then(); return; }
  if (key !== 'all') { save.story[key] = true; persist(); }
  storyFrames = frames;
  storyAt = 0;
  storyThen = then;
  renderStory();
  show('story');
}
/** Back to the map by way of whatever story is waiting. */
function viaStory(then: () => void): void {
  const key = pendingStory;
  pendingStory = '';
  if (key && MEMORIES[key] && !botMode) { save.story[key] = true; persist(); firstClear(key, then); } // (a world with its memory built: the whole of what a first clear gives)
  else if (key) playStory(key, then); else then();
}

// ------------------------------------------------------------------ a first clear, and the memory it gives back
/** what each memory says, and when (seconds into its song): the brothers speak only to each other, and only here */
const MEMORY_SAYS: Record<string, Said[]> = {
  heroes: [
    { from: 3.6, to: 13.6, text: '\u201cKeep up, little brother.\u201d', x: 0.5, y: 0.8, align: 'center', size: 22, color: '#2c1206', shade: 'rgba(255,238,196,0.85)' },
    { from: 9.4, to: 13.6, text: '\u201cWe\u2019re the same age.\u201d', x: 0.5, y: 0.84, align: 'center', size: 19, color: '#4a2410', shade: 'rgba(255,238,196,0.85)' },
    { from: 15.6, to: 24, text: '\u201cBy a heartbeat. I counted.\u201d', x: 0.5, y: 0.82, align: 'center', size: 22, color: '#2c1206', shade: 'rgba(255,238,196,0.85)' }
  ]
};
let memoryThen: (() => void) | null = null;
/** A memory of Helion: a twin orbit in the Harmonic Nebula, both brothers on one tap. It cannot be failed and keeps no record. */
function startMemory(world: string, then: () => void): void {
  const mp = MEMORIES[world];
  if (!mp) { then(); return; }
  run?.stop();
  audio.stopPreview(0.6);
  audio.ensure();
  audio.setVolumes(save.music, save.sfx);
  memoryThen = then;
  practice = dare = botMode = false;
  renderer.reset();
  nebula.says = MEMORY_SAYS[world] ?? [];
  renderer.backdrop = nebula;
  renderer.planet = null;
  renderer.twinIs = 'helion';
  held = 0;
  const r = (run = new Run(mp, { memory: true, leadIn: mp.audio.offset }, onRunEnd)); // (the bar before it is his heartbeat, close now)
  $('attempt').textContent = 'a memory';
  $('hud').classList.add('memory');
  for (const id of ['bestMark', 'fromMark', 'dropMark', 'tutor', 'hudStars']) $(id).classList.add('hidden');
  $('checks').innerHTML = '';
  $('titleCard').classList.remove('show');
  $('finale').classList.remove('show');
  hud.pct = hud.at = -1; hud.count = ''; hud.crashShown = false; hud.seg = '';
  show('play');
  void r.start();
}
function endMemory(): void {
  const then = memoryThen;
  memoryThen = null;
  run?.stop();
  run = null;
  renderer.twinIs = 'orbin';
  $('hud').classList.remove('memory');
  $('dropMark').classList.remove('hidden');
  then?.();
}
/**
 * What a world's first clear gives, after its star has reignited (the results): the gift, shown once in use; the
 * road lighting toward the guardian; a memory of Helion, played; and then home. After the first world of all the
 * title comes too: it has not been seen yet.
 */
/** A memory again (from the still pool or the settings): by the fire, into the flames, the film, and back. */
function filmAgain(world: string, then: () => void): void {
  if (!SkyMemory.has(world)) { then(); return; }
  landing.rest(starsHome(), false, false); show('title');
  landing.dive(() => memoryFilm.play(world, () => landing.emerge(then)), 1.8);
}
function firstClear(world: string, then: () => void): void {
  // (the gift and road moments and the playable memory are gone: by the fire, into the flames, the memory as a film,
  // back out of the fire; the owner's brief of 2026-11-25)
  const home = () => { arrived = world; then(); };
  if (!SkyMemory.has(world)) { home(); return; }
  landing.rest(starsHome(), false, false); show('title');
  landing.dive(() => memoryFilm.play(world, () => landing.emerge(home)));
}
// ------------------------------------------------------------------ the cold open
/** The cold open: a scene, not a level. It ends in black, and the storyboard begins in that black. */
function startCold(): void {
  run?.stop();
  run = null;
  audio.stopPreview(0.3);
  coldScene.onDone = () => { save.story.cold = true; persist(); startOpening(); };
  coldScene.onSlip = () => feel('crash');
  coldScene.onHeave = () => feel('big');
  coldScene.onQuiet = () => { if (!openingPainted) { opening.reset(false); openingPainted = true; } }; // (painted in the black, while the three lines stand still)
  coldScene.start(!!save.story.cold);
  show('cold');
  // the heaviest pictures after it (the Landing's sky, the first stage's), painted off the main thread while the film plays
  landing.askAhead([0, 1]); edgeWorld.askAhead();
}
$('cold').addEventListener('pointerdown', (e) => { if (screen !== 'cold') return; e.preventDefault(); audioReady = true; coldScene.press(true, e.clientX, e.clientY); });
for (const type of ['pointerup', 'pointercancel'] as const) $('cold').addEventListener(type, () => { if (screen === 'cold') coldScene.press(false); });

// ------------------------------------------------------------------ a star, caught, and carried home
/** the run whose star is being caught (its music plays out under the sequence; it never shows the results) */
let starRun: Run | null = null;
/** A level that ends in its star: the first stage, and every world with its own painted sky. */
function wantsStar(r: Run): boolean {
  return (!r.opts.bot || botStar) && !r.opts.practice && !r.opts.memory && !r.opts.tutorial && !chamber && !r.pack.level.side && (r.pack === FIRST || (BUILT.includes(baseOf(r.pack)) && !!sceneFor(r.pack)));
}
const STINGS: Record<string, AudioMeta> = { [FIRST_ID]: sting1Audio as AudioMeta, heroes: sting2Audio as AudioMeta, skyhigh: sting2Audio as AudioMeta, blank: sting1Audio as AudioMeta, invincible: sting1Audio as AudioMeta };
function beginStar(r: Run): void {
  starRun = r;
  const id = r.pack.level.id, isFirst = r.pack === FIRST, first = !bestFor(id).cleared, homeWas = starsHome();
  fingers.clear(); keysDown.clear();
  r.release(performance.now());
  session.onBeat += 0; // (the run's own numbers are read by the bookkeeping below)
  showResults(r, true, 100, true); // the clear is recorded (bests, shards, stars, glows) without the results screen
  pendingStory = '';
  const n = starsHome();
  // the sting: loaded now, played on the catch
  const meta = STINGS[id];
  let sting: Awaited<ReturnType<typeof audio.loadTrack>> | null = null;
  if (meta && audio.ctx) void audio.loadTrack(meta).then((t) => { sting = t; }, () => undefined);
  const w = window.innerWidth, h = window.innerHeight, fire = landing.stageFire();
  const scene = sceneFor(r.pack)!;
  const kept = starsFor(id).filter(Boolean).length;
  const note = !first ? '' : isFirst ? '' : `${bestFor(id).attempts === 1 ? 'on the first attempt' : `in ${bestFor(id).attempts} attempts`}${kept ? `  ·  ${['', 'one shard', 'two shards', 'all three shards'][kept]}` : ''}`;
  if (isFirst) landing.prepare([0, 1]);
  else landing.prepare([homeWas, n]);
  skyStar.play({
    scene, from: renderer.coreAt[0] ? [renderer.coreAt[0], renderer.coreAt[1] - Math.min(w, h) * 0.12] : isFirst ? [fire[0], fire[1]] : [w * 0.5, h * 0.84], orbin: renderer.heroAt[0] ? renderer.heroAt : [w * 0.5, h * 0.4],
    col: LANDING.STAR_COLS[(Math.max(1, n) - 1) % LANDING.STAR_COLS.length],
    name: isFirst ? 'The first star' : placeName(r.pack), word: isFirst ? 'the Drifting Edge wakes' : first ? 'restored' : 'once more', note,
    quick: !first, hold: isFirst && first,
    onCatch: () => { feel('win'); if (sting && audio.ctx) audio.playPart(sting, meta, audio.ctx.currentTime + 0.01, 0, { gain: 0.95 }); },
    flight: first && !isFirst && worldFor(r.pack) ? { draw: worldFor(r.pack)!.draw, song: worldFor(r.pack)!.relit ?? 999 } : undefined,
    veil: (v) => { if (isFirst) landing.veil = v; },
    then: (at) => afterStar(r, first, homeWas, at)
  });
}
/** the map is drawn once, hidden under the Landing, before the camera rises into it (its colours may just have changed) */
let warmMap = false;
/** The star is his. A first one is carried home to the fire (the first stage's is already there); a replay goes straight back to the map. */
function afterStar(r: Run, first: boolean, homeWas: number, at: { orbin: [number, number, number]; star: [number, number, number] }): void {
  const isFirst = r.pack === FIRST, world = baseOf(r.pack), n = starsHome();
  skyStar.stop();
  r.fadeOut(isFirst ? 5 : 2.2);
  starRun = null;
  run = null;
  $('hud').classList.remove('veiled');
  const rise = (secs: number, then: () => void) => { renderMap(); landing.ascend(() => { show('levels'); then(); }, secs); };
  // the next stretch of road lights as the camera arrives over the map (the old "road" moment, folded in here)
  const opened = () => { const i = PACKS.findIndex((p) => p.level.id === world); if (i >= 0) sky.reveal(i + 1); };
  if (!first) { landing.rest(n, false, false); show('title'); rise(2.2, () => undefined); return; }
  landing.tilt = isFirst ? 0.26 : 0;
  window.setTimeout(() => { warmMap = true; }, 3600);
  landing.arrive({
    from: isFirst ? 0 : homeWas, to: n, flight: !isFirst, orbin: isFirst ? at.orbin : undefined, star: isFirst ? at.star : undefined,
    said: isFirst ? 'The first star, home.' : `${placeName(r.pack)}’s star, home.`,
    onHome: () => feel('pick'),
    then: () => {
      if (isFirst) { rise(6, opened); return; } // one move, from the fire up into the galaxy
      // he rests by the fire; the camera drifts into the flames, and their light becomes a memory of Helion (a short
      // film, the chapter this world's star gives back); it goes back into the fire, the camera pulls back, and rises
      arrived = world;
      // after the second star, the Stillness notices the Landing's light: the ambush (once, as the story goes)
      const next = () => (world === 'skyhigh' && !save.story.ambush && (!r.opts.bot || botStar) ? window.setTimeout(() => startAmbush(() => rise(3.2, opened)), 900) : rise(3.2, opened));
      if (SkyMemory.has(world) && (!r.opts.bot || botStar)) {
        save.story[world] = true; persist();
        window.setTimeout(() => {
          if (screen !== 'title') return;
          audio.stopPreview(2.4);
          landing.dive(() => {
            memoryFilm.play(world, () => landing.emerge(() => { fireTheme(); next(); }));
          });
        }, 1400);
      } else next();
    }
  });
  show('title');
}

// ------------------------------------------------------------------ the ambush (2026-11-26)
/** what comes after the ambush is cleared (the story's way on; a replay goes back to the map) */
let ambushThen: (() => void) | null = null;
const skips = { run: null as Run | null, done: new Set<number>() };
/** The ambush, from the Landing: the Stillness has noticed its light. */
function startAmbush(then: (() => void) | null = null): void {
  ambushThen = then;
  pack = AMBUSH;
  practice = dare = botMode = false;
  chamber = null;
  session.far = session.onBeat = session.judged = session.streak = session.attempts = 0;
  session.newBest = false; session.drop = -1; falls.length = 0;
  audio.ensure();
  ambushWorld.askAhead();
  sceneFor(pack)?.prepare();
  startRun();
}
/** Cleared: home. The level's own last bars are the light holding; the Landing takes over from there, then the map. */
function ambushHome(r: Run): void {
  showResults(r, true, 100, true); // (the clear is recorded without the results screen)
  save.story.ambush = true; persist();
  r.fadeOut(2.4);
  run = null;
  $('hud').classList.remove('veiled');
  landing.rest(starsHome(), false, false);
  show('title');
  const then = ambushThen; ambushThen = null;
  window.setTimeout(() => { if (screen !== 'title') return; fireTheme(); if (then) then(); else { renderMap(); landing.ascend(() => show('levels'), 3.2); } }, 2600);
}

/** the world just woken, on the way home: the hub says so once */
let arrived = '';
$('moment').addEventListener('click', () => { if (screen === 'moment') moment.tap(); });

// ------------------------------------------------------------------ the opening
/** the level behind the opening's first tap, built and loaded while the scene plays, so the tap only has to start it */
let armedRun: Run | null = null;
let warmed = false;
/** The opening. `again`: a replay from the still pool, which can be skipped, starts no level and changes nothing. */
let openingPainted = false;
function startOpening(again = false): void {
  run?.stop();
  run = null;
  armedRun = null;
  warmed = false;
  audio.stopPreview(0.3);
  if (!openingPainted || again) opening.reset(again);
  openingPainted = false;
  show('prologue');
  if (again) { opening.armed = true; return; }
  // the first stage, ready: its course built, its song decoded, the Landing painted under it. The prompt does not
  // appear until all of it is.
  pack = FIRST;
  practice = dare = botMode = false;
  chamber = null;
  const r = (armedRun = new Run(pack, { leadIn: 0, gentle: GENTLE, swell: [0.42, 2.4] }, onRunEnd));
  const scene = sceneFor(pack);
  landing.prepare([0, 1], () => screen === 'prologue' && (opening.dark || opening.state === 'paint'));
  window.setTimeout(() => { scene?.prepare(); void r.prepare().then(() => { if (armedRun === r) opening.armed = true; }); }, 1200);
}
/** beats of the very first flight in which nothing can go wrong: a missed Star-Node is taken for the player */
const GENTLE = 16;
/** The first tap: the song starts at `when` on the audio clock (0: no sound), and the level is under way. */
opening.onTap = (_perfMs, when) => {
  if (opening.again || !armedRun) return;
  save.story.prologue = save.story.open = true;
  save.tutorialDone = true;
  // (no sync check stands between the opening and the first flight: the results say how the taps sat, and the check is at the crater)
  if (!save.calibrated) { save.calibrated = true; save.calLatency = audio.latency(); }
  persist();
  if (when > 0) armedRun.opts.at = when;
  $('hud').classList.add('veiled'); // (the bloom covers the game at first: its interface comes in as the picture lifts)
  startRun(-1, false, armedRun);
  armedRun = null;
};
opening.onDone = () => { if (screen === 'prologue') { renderSettings(); show('settings'); } }; // (a replay: back where it was asked for)
// (the tap is taken the moment the finger lands)
$('prologue').addEventListener('pointerdown', (e) => { if (screen !== 'prologue') return; e.preventDefault(); audioReady = true; opening.tap(stamp(e), e.clientX, e.clientY); });

// ------------------------------------------------------------------ the galaxy map
/** Hands the painted map what it shows now, and where the player is. */
function renderMap(): void {
  sky.info = skyInfo();
  sky.chosen = at.id;
}
/** What the painted map shows: every place that can be seen, how it stands, and the two quiet counts. */
function skyInfo(): SkyInfo {
  const nodes: SkyNode[] = [];
  for (const n of NODES) {
    const st = nodeState(n, progress);
    if (st === 'hidden') continue; // a moon nobody has found is not in the sky yet
    const p = n.kind === 'gate' ? FINAL : packOf(n.id) ?? PACKS[0];
    const lid = n.kind === 'gate' ? FINAL_ID : n.id;
    const b = bestFor(lid);
    nodes.push({
      id: n.id, kind: n.kind === 'gate' ? 'hollow' : n.kind, of: n.planet, name: n.kind === 'moon' ? `${planetName(n.planet)}’s moon` : planetName(lid), song: shortTitle(p), by: p.level.artist,
      state: st === 'cleared' ? 'home' : st === 'open' ? 'open' : 'dark', best: b.cleared ? 100 : b.pct, shards: starsFor(n.kind === 'moon' ? n.planet : lid),
      why: n.kind === 'gate' ? 'wake the four worlds first' : n.index > 0 ? `wake ${planetName(PACKS[n.index - 1].level.id)} first` : '',
      // a world whose song is home can be dared (a moon has no such star)
      dare: n.kind !== 'moon' && st === 'cleared' ? (feat(`dare:${lid}`) ? 'done' : 'open') : undefined
    });
  }
  const rooms = hubRooms();
  // the next world along the road stirs: the hook to go on
  const next = nodes.find((n) => n.kind === 'planet' && n.state === 'open' && n.best === 0 && n.id !== PACKS[0].level.id);
  if (next) next.hook = 'is waking\u2026';
  return { nodes, lens: `${starCount()} of ${maxStars} star shards`, lit: rooms.stars ? `${starsLit(starProgress).length} of ${STAR_TOTAL} stars lit` : '', rooms };
}
/** The Landing grows with every star awake: Ossa's fire (the glows) with the first, the rim's star chart with the second. (The crater and the still pool are always there.) */
function hubRooms(): { glows: boolean; stars: boolean } {
  const home = PACKS.filter((p) => bestFor(p.level.id).cleared).length;
  return { glows: home >= 1 || progress.unlockAll, stars: home >= 2 || progress.unlockAll };
}
/** the Landing was the place chosen when one of its places was entered: coming back out, it still is */
let viaLantern = false;
/** Out of one of the Landing's places, back to the galaxy. */
function leaveRoom(): void {
  show('levels');
  if (viaLantern) sky.chosen = 'landing';
  viaLantern = false;
}
// Taps on the map go to whatever is painted there: a world, the Lantern and its rooms, the stars, or the open sky.
$('levels').addEventListener('click', (e) => {
  if (screen !== 'levels' || $('levels').classList.contains('launch')) return;
  const hit = sky.hit(e.clientX, e.clientY);
  if (hit.kind === 'node') {
    if (hit.id === 'landing') {
      sky.chosen = sky.chosen === 'landing' ? null : 'landing';
      queuePreview();
      if (sky.chosen) rooms.prepare(['hearth', 'desk', 'gallery'], () => screen === 'levels'); // (its rooms are painted while the galaxy is at rest)
      return;
    }
    if (hit.id === at.id && sky.chosen === hit.id) { if (canPlay()) begin(false); } // a second tap on the chosen world flies in
    else { select(hit.id); queuePreview(); const p = packOf(hit.id); if (p) { skyResult.prepare(baseOf(p), () => screen === 'levels' && !$('levels').classList.contains('launch')); paintAhead(p); } } // (its results' skies are painted while the galaxy is at rest)
  } else if (hit.kind === 'practise') { if (canPlay()) begin(true); }
  else if (hit.kind === 'dare') { if (canPlay()) begin(false, true); }
  else if (hit.kind === 'pool') openLogbook();
  else if (hit.kind === 'glows') openGlows();
  else if (hit.kind === 'settings') openSettings('levels');
  else if (hit.kind === 'stars') openStars();
  else if (hit.kind === 'title') toLanding();
  else { sky.chosen = null; queuePreview(); } // the open sky: step back and see all of it
});
/** Moves to a place on the map. */
function select(id: string, quiet = false): void {
  const n = nodeOf(id);
  const changed = n.id !== at.id;
  at = n;
  levelIdx = Math.min(PACKS.length - 1, n.index);
  pack = packOf(n.id) ?? PACKS[levelIdx];
  if (changed) { save.at = n.id; save.level = levelIdx; persist(); }
  renderMap();
  if (changed && !quiet) queuePreview();
}
/** Moves to a planet by its place on the route (0 = the first level). */
function focusLevel(i: number, _scroll = false): void {
  select(PACKS[Math.max(0, Math.min(PACKS.length - 1, i))].level.id);
}
/** The focused level's song plays quietly from its drop: the preview. It needs one tap first (browsers hold audio until then). */
let audioReady = false;
let previewTimer = 0;
function queuePreview(): void {
  clearTimeout(previewTimer);
  if (!audioReady || screen !== 'levels') return;
  // With no world chosen (the whole sky, or the Lantern), or at one with nothing to hear yet (dark, a locked gate, a
  // moon nobody has found), what plays is the Lantern's own theme. A world that can be flown plays its song.
  const home = sky.chosen === null || sky.chosen === 'landing' || !canPlay() || nodeState(at, progress) === 'hidden';
  previewTimer = window.setTimeout(() => {
    if (screen !== 'levels') return;
    audio.setVolumes(save.music, save.sfx);
    if (home) hubTheme();
    else if (audio.previewing !== pack.audio.file) void audio.preview(pack.audio, pack.audio.dropTime - pack.audio.offset - (4 * 60) / pack.audio.bpm);
  }, 320);
}
/**
 * The Landing's theme: original, quiet (Orbin's pulse and the far music box), and it gains a voice with each star that
 * comes home (a drone and four faint taps; then Ossa's struck metal). Two voicings are written so far. It goes
 * round every eight bars.
 */
const HUB = [hub0Audio, hub1Audio] as AudioMeta[];
/** The Landing at rest: fire crackle, night air and the music box (an ember before any star is home, a fire after). */
const FIRE = [fire0Audio, fire1Audio] as AudioMeta[];
function fireTheme(): void {
  if (!audioReady) return;
  const meta = FIRE[Math.min(FIRE.length - 1, starsHome())];
  audio.setVolumes(save.music, save.sfx);
  if (audio.previewing !== meta.file) void audio.preview(meta, 0, 0.7, false, (8 * 4 * 60) / meta.bpm);
}
/** Down to the fire (from the map's Landing), Orbin awake. */
function toLanding(): void { landing.rest(starsHome(), false, false); landing.descend(); show('title'); }
/** The title: Orbin asleep by the fire, the name in the sky. */
function toTitle(): void { landing.rest(starsHome(), true); show('title'); }
function hubTheme(): void {
  const meta = HUB[Math.min(HUB.length - 1, PACKS.filter((p) => bestFor(p.level.id).cleared).length)];
  if (audio.previewing !== meta.file) void audio.preview(meta, 0, 0.6, false, (8 * 4 * 60) / meta.bpm);
}

// ------------------------------------------------------------------ starting a level
/** Flying in from the map: the sync check on a first run, the tutorial before level 1, then the level. */
function begin(asPractice: boolean, asDare = false): void {
  if (!canPlay() || $('levels').classList.contains('launch')) return;
  practice = asPractice;
  dare = asDare && !asPractice;
  botMode = false;
  audio.ensure();
  audio.setVolumes(save.music, save.sfx);
  checkDevice();
  if (!save.calibrated || deviceChanged) { openCalib('begin'); return; }
  enter();
}
function enter(): void {
  // the first time at the galaxy's edge, its card comes first
  // the first time at the guardian: the last memory first (the brothers' last beat, 2026-11-26), then its card
  if (pack === FINAL && !save.story.lastmemory && !botMode && !practice) { save.story.lastmemory = true; persist(); filmAgain('royalty', () => { show('levels'); enter(); }); return; }
  if (pack === FINAL && !save.story.hollow && !botMode && !practice) { playStory('hollow', () => { show('levels'); enter(); }); return; }
  session.far = session.onBeat = session.judged = session.streak = session.attempts = 0;
  session.newBest = false;
  session.drop = -1;
  falls.length = 0;
  if (screen === 'levels') {
    // the chosen world opens over one beat while the preview fades into the level's own music
    $('levels').classList.add('launch');
    sky.launch();
    audio.stopPreview(0.9);
    window.setTimeout(go, 430);
  } else go();
}
function go(): void {
  if (!save.tutorialDone && !botMode && pack.level.id === PACKS[0].level.id) startTutorial(); else startRun();
}

/** Starts an attempt. `from` is a song time (practice restarts from a checkpoint); `quick` is the instant restart after a crash. */
function startRun(from = -1, quick = false, made: Run | null = null, ember = false): void {
  if (!chamber && pack !== AMBUSH && !canPlay()) return;
  audio.ensure();
  audio.setVolumes(save.music, save.sfx);
  audio.stopPreview(0.6);
  if (practice && !botMode && !save.practiced[pack.level.id]) { save.practiced[pack.level.id] = true; persist(); }
  run?.stop();
  if (practice || botMode || chamber) dare = false;
  const counted = !botMode && !practice && !chamber && !ember; // (a test chamber keeps no record; a fall back to an ember is the same attempt)
  if (!ember) emberFalls = 0;
  if (counted) {
    save.bests[pack.level.id] = { ...bestFor(pack.level.id), attempts: bestFor(pack.level.id).attempts + 1 };
    persist();
  }
  session.attempts++;
  renderer.reset();
  renderer.backdrop = chamber ? null : sceneFor(pack);
  renderer.planet = chamber ? null : worldFor(pack);
  if (ember) renderer.planet?.rewind(from); // back to an ember: the planet as it was there
  else renderer.planet?.reset(); // (every attempt starts from how the Stillness left it)
  const hm = chamber || practice ? null : HELION[pack.level.id];
  helionCue = null;
  if (hm && audio.ctx) { const cue = (helionCue = { run: null as unknown as Run, track: null as Awaited<ReturnType<typeof audio.loadTrack>> | null, at: hm.at, meta: hm.meta, played: false }); void audio.loadTrack(hm.meta).then((t) => { cue.track = t; }, () => undefined); }
  renderer.twinIs = 'orbin';
  // the way in: out of the planet's own light (from the map), back to an ember (a fall), or a quick cool dissolve (a restart)
  if (!made && !chamber) { if (ember) renderer.beginIntro([255, 178, 110], 0.45, 0.12); else if (quick) renderer.beginIntro([12, 14, 30], 0.3, 0.06); else if (from < 0) renderer.beginIntro((COMPANIONS.KINDLE as Record<string, RGB3>)[baseOf(pack)] ?? [255, 226, 170], 1.1, 0.9); }
  const sc = chamber ? null : sceneFor(pack);
  if (sc && 'says' in sc) sc.says = bestFor(baseOf(pack)).cleared ? [] : WRITTEN[baseOf(pack)] ?? [];
  held = 0;
  const spb = 60 / pack.audio.bpm;
  // a fresh start plays the whole count-in bar under the title card; an instant restart cuts in for the last two counts
  // (the first attempt at a sleeping world opens on the world itself: about eight seconds of its sky, as the Stillness
  // left it, with one line written there, before the count-in)
  const before = from < 0 && !quick && !made && !chamber && !practice && (!botMode || botStar) && !!sc && 'says' in sc && !bestFor(baseOf(pack)).cleared && session.attempts === 1 && !!BEFORE[baseOf(pack)];
  if (before) { const ps = sc as PlanetScene; ps.says = [...BEFORE[baseOf(pack)], ...ps.says]; }
  // the scene before a first attempt is also where the world's companion comes to him (the Kindling that gives the gift)
  renderer.meet = before ? COMPANIONS.KINDLE[baseOf(pack)] ?? null : null;
  const opts = ember ? { startAt: from, leadIn: 4 * spb } : from >= 0 ? { startAt: from, leadIn: 1.5 } : quick ? { startAt: 2 * spb, leadIn: 0.3 } : { leadIn: before ? 9.2 : 2.4 };
  const r = (run = made ?? new Run(pack, { bot: botMode, practice: practice && !botMode, ...opts, lights: carryLights ?? undefined }, onRunEnd));
  // what the star will need, painted during the scene before (a still picture), never while the course is moving
  if (before) { const n = starsHome(); landing.prepare([n, n + 1], () => run === r && r.time < -1.2); }
  carryLights = null;
  // the embers on the course: a coal at each, catching as he passes (the ones behind a respawn are already lit)
  emberBeats = chamber || dare ? [] : practice ? r.level.segments.map((s) => s.t0 / spb).filter((b) => b > r.t0 / spb + 0.01) : pack.level.embers ?? [];
  renderer.embers = emberBeats;
  emberLit = emberBeats.filter((b) => b * spb <= r.startAt + 1e-6).length - 1;
  const b = bestFor(pack.level.id);
  // the song's thread: a tick at the drop, a ring at your best; in practice, a tick where each section begins and a dab where this run set off
  const along = (t: number) => `${(Math.max(0, Math.min(1, (t - r.t0) / (r.t1 - r.t0))) * 100).toFixed(2)}%`;
  const prac = practice && !botMode;
  $('dropMark').style.left = along(r.level.dropTime);
  $('bestMark').style.left = `${b.pct}%`;
  $('bestMark').classList.toggle('hidden', b.pct === 0 || b.cleared || prac || botMode || !!chamber);
  $('checks').innerHTML = prac ? r.level.segments.filter((s) => s.t0 > r.t0 + 0.01).map((s) => `<i style="left:${along(s.t0)}"></i>`).join('') : '';
  $('fromMark').classList.toggle('hidden', !(prac && from > r.t0 + 0.01));
  if (from >= 0) $('fromMark').style.left = along(from);
  const label = $('attempt');
  label.textContent = botMode ? 'a perfect run' : chamber ? `try ${session.attempts}` : practice ? 'practice' : dare ? 'daredevil' : `attempt ${b.attempts}`;
  label.classList.remove('flash');
  if (quick) { void label.offsetWidth; label.classList.add('flash'); }
  const card = $('titleCard');
  card.classList.remove('show');
  if (from < 0 && !quick && !made) {
    $('tcLevel').textContent = `${placeName(pack)}${practice ? '  ·  practice' : dare ? '  ·  daredevil: one attempt' : ''}`;
    $('tcSong').textContent = shortTitle(pack);
    $('tcArtist').textContent = `by ${pack.level.artist}`;
    if (chamber) { $('tcLevel').textContent = 'test chamber'; $('tcSong').textContent = chamber.name; $('tcArtist').textContent = chamber.what; }
    void card.offsetWidth;
    card.classList.add('show');
  }
  $('tutor').classList.toggle('hidden', !r.opts.gentle);
  $('tutorSkip').classList.toggle('hidden', !!r.opts.gentle);
  $('tutorText').innerHTML = '';
  hud.lesson = -1;
  $('finale').classList.remove('show');
  hud.pct = -1;
  hud.at = -1;
  hud.crashShown = false;
  hud.count = '';
  show('play');
  void r.start().then(() => { if (run === r && r.state === 'error') { alert(`Could not start the level: ${r.error}`); show('levels'); } });
}

// ------------------------------------------------------------------ first run: the tutorial
const LESSONS: Array<[number, string]> = [
  [-9, 'Orbin glides by himself, in time with the music.'],
  [2.6, 'Tap anywhere as he reaches a <i>Star-Node</i>, just as its gold ring closes on it. A little early or late still counts.'],
  [12, '<b>Gold lights</b> are bonus taps. On the beat they build <b>flow</b>: the gold arc round the core.'],
  [17, '<b>Gold rails</b>: keep your finger down to ride along them. Only a missed <i>Star-Node</i> restarts the flight.']
];
/** the very first flight (straight out of the opening) is told less, and later: the opening has already shown the tap */
const FIRST_LESSONS: Array<[number, string]> = [
  [-9, ''],
  [0.5, 'Tap as each gold ring closes on its <i>Star-Node</i>.'],
  [13, ''],
  [26, 'A blue ribbon: keep your finger down along it, and let go at its end.'],
  [36, ''],
  [62, 'Only a missed <i>Star-Node</i> ends a flight, and the next begins at once.'],
  [76, '']
];
function startTutorial(): void {
  run?.stop();
  renderer.reset();
  renderer.planet = null;
  held = 0;
  audio.stopPreview(0.6);
  run = new Run(pack, { tutorial: true, leadIn: 1.8 }, endTutorial);
  $('attempt').textContent = 'the first flight';
  for (const id of ['bestMark', 'fromMark', 'dropMark']) $(id).classList.add('hidden');
  $('checks').innerHTML = '';
  $('titleCard').classList.remove('show');
  $('finale').classList.remove('show');
  $('tutor').classList.remove('hidden');
  hud.pct = -1;
  hud.at = -1;
  hud.lesson = -1;
  hud.count = '';
  show('play');
  void run.start();
}
function endTutorial(): void {
  save.tutorialDone = true;
  persist();
  $('tutor').classList.add('hidden');
  $('dropMark').classList.remove('hidden');
  startRun();
}

// ------------------------------------------------------------------ sync check
// Every tap that meets a note is logged as milliseconds early or late, across attempts. If the taps centre well
// away from zero, that is audio or display delay, not the chart, and one tap on the fix corrects the offset.
const sync = { press: [] as number[], flow: [] as number[], seenPress: 0, seenFlow: 0, of: null as Run | null, last: NaN };
/** the audio output changed since the last calibration (new headphones or speakers) */
let deviceChanged = false;
function harvest(r: Run): void {
  if (sync.of !== r) { sync.of = r; sync.seenPress = sync.seenFlow = 0; }
  if (r.opts.bot || r.opts.tutorial) return;
  const o = r.sim.offsets;
  while (sync.seenPress < o.press.length) { sync.last = o.press[sync.seenPress++] * 1000; sync.press.push(sync.last); }
  while (sync.seenFlow < o.flow.length) { sync.last = o.flow[sync.seenFlow++] * 1000; sync.flow.push(sync.last); }
  if (sync.press.length > 150) sync.press.splice(0, sync.press.length - 150);
  if (sync.flow.length > 150) sync.flow.splice(0, sync.flow.length - 150);
}
function spread(a: number[]): { n: number; mean: number; sd: number } {
  if (a.length < 3) return { n: a.length, mean: 0, sd: 0 };
  const s = [...a].sort((x, y) => x - y);
  const core = s.slice(Math.floor(s.length * 0.1), Math.ceil(s.length * 0.9)); // drop the wildest tenth at each end
  const mean = core.reduce((p, v) => p + v, 0) / core.length;
  return { n: a.length, mean, sd: Math.sqrt(core.reduce((p, v) => p + (v - mean) * (v - mean), 0) / core.length) };
}
/** What the taps so far say about sync: one soft line, and the offset that would set it right (null when there is nothing to set). */
function syncRead(): { line: string; next: number | null } {
  const all = spread([...sync.press, ...sync.flow]), ms = Math.abs(Math.round(all.mean)), side = all.mean > 0 ? 'late' : 'early';
  if (all.n < 12) return { line: 'Not enough taps yet to tell how your timing sits.', next: null };
  if (all.sd > 60) return { line: 'Your taps are too spread out to tell where they sit.', next: null };
  if (Math.abs(all.mean) < 15) return { line: ms < 3 ? 'Your taps sit right on the beat.' : `Your taps sit about ${ms} ms ${side}: close enough.`, next: null };
  return { line: `Your taps sit about ${ms} ms ${side}: a delay in sound or screen, not the song.`, next: Math.max(-200, Math.min(400, save.audioOffset + Math.round(all.mean))) };
}
/** Sets the sound's offset from what the taps said, and starts listening afresh. */
function syncFix(next: number): void {
  save.audioOffset = next;
  persist();
  sync.press.length = sync.flow.length = 0;
}
/** The pause's two quiet lines about sync: what the taps say, and the one tap that sets it right. */
function showPauseSync(): void {
  const r = syncRead(), fix = $('pauseSyncFix'), dot = $('pauseSyncDot');
  $('pauseSyncText').textContent = r.line;
  fix.classList.toggle('hidden', r.next === null);
  dot.classList.toggle('hidden', r.next === null);
  fix.onclick = () => {
    if (r.next === null) return;
    syncFix(r.next);
    $('pauseSyncText').textContent = `Set: the sound now arrives ${fmtMs(r.next)}. Play on, and see.`;
    fix.classList.add('hidden');
    dot.classList.add('hidden');
  };
}
function drawSyncOverlay(): void {
  const el = $('syncOverlay');
  const on = save.syncOverlay || /[?&]sync=1/.test(location.search);
  el.classList.toggle('hidden', !on);
  if (!on) return;
  const row = (x: { n: number; mean: number; sd: number }) => (x.n < 3 ? `      -      (${x.n})` : `${(x.mean >= 0 ? '+' : '') + x.mean.toFixed(0)} ms ±${x.sd.toFixed(0)} (${x.n})`);
  el.textContent = `last  ${Number.isNaN(sync.last) ? '-' : (sync.last >= 0 ? '+' : '') + sync.last.toFixed(0) + ' ms'}\npress ${row(spread(sync.press))}\nflow  ${row(spread(sync.flow))}\noffset ${fmtMs(save.audioOffset)}  (+ = late)`;
}
function checkDevice(): void {
  if (save.calLatency >= 0 && Math.abs(audio.latency() - save.calLatency) > 0.03) deviceChanged = true;
}
navigator.mediaDevices?.addEventListener?.('devicechange', () => { deviceChanged = true; });

// ------------------------------------------------------------------ the end of an attempt
let toastTimer = 0;
function toast(text: string, gold = false): void {
  const el = $('toast');
  el.textContent = text;
  el.className = `toast${gold ? ' gold' : ''}`;
  void el.offsetWidth; // restart the animation
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 1400);
}
function tally(r: Run): void {
  session.onBeat += r.sim.onBeat;
  session.judged += r.sim.judged;
  session.streak = Math.max(session.streak, r.sim.bestStreak);
  if (r.dropFull !== null && r.time > r.level.dropTime) session.drop = Math.max(session.drop, r.dropPower);
}
/** A crash restarts at once (practice: from the last checkpoint). Only a clear, or quitting, shows the results. */
function onRunEnd(r: Run): void {
  if (r !== run || r === starRun) return;
  if (r.opts.memory) { endMemory(); return; }
  harvest(r);
  if (chamber) { // a room: straight back in, or back to the list
    tally(r);
    if (r.state !== 'failed') { chamberDone(r, true); return; }
    if (!chamber.ambush) { startRun(-1, true); return; }
    // the ambush has a checkpoint at each phrase: back to two bars before the light note of the phrase it fell in (never
    // further back than that phrase's roll), with the windows as they stood there
    const spb = r.level.spb, fell = r.crashTime / spb + 0.01;
    const light = [...r.lights].reverse().find((l) => l.beat <= fell);
    const roll = light ? [...r.level.segments].reverse().find((s) => s.core?.charge && s.t0 / spb <= light.beat) : undefined;
    const cp = light ? Math.max(roll ? roll.t0 : 0, (light.beat - 8) * spb) : -1;
    if (cp <= r.t0 + 0.01) { startRun(-1, true); return; }
    carryLights = r.lights.map((l) => (l.beat * spb < cp ? l.on : null));
    startRun(cp);
    return;
  }
  const id = r.pack.level.id;
  const prev = bestFor(id);
  const counted = !r.opts.bot && !r.opts.practice;
  if (r.state === 'failed') {
    tally(r);
    const pct = r.pct;
    session.far = Math.max(session.far, pct);
    if (r.opts.practice) {
      if (pct > (prev.prac ?? 0)) { save.bests[id] = { ...prev, prac: pct }; persist(); }
      // back to the start of the section; the one before if you fell right at its start
      const seg = r.level.segAt(r.crashTime);
      const cp = r.crashTime - seg.t0 < 1.2 && seg.index > 0 ? r.level.segments[seg.index - 1].t0 : seg.t0;
      if (cp <= r.t0 + 0.01) startRun(-1, true); else startRun(cp);
      return;
    }
    if (counted && pct > prev.pct) { save.bests[id] = { ...prev, pct }; persist(); session.newBest = true; if (PACKS.includes(r.pack)) gameCenter.best(id, pct); }
    if (dare && counted) { r.stop(); showResults(r, false, pct); return; } // a daredevil has one attempt: a fall sends him home
    nudgeAfter(r);
    // an ember passed on this attempt: straight back to it, the music a bar before it, the planet as it was there
    const spb = r.level.spb, em = r.opts.bot ? -1 : [...emberBeats].reverse().find((b) => b * spb >= r.startAt - 1e-6 && b * spb < r.crashTime) ?? -1;
    if (em >= 0) { emberFalls++; startRun(em * spb, true, null, true); return; }
    startRun(-1, true);
    return;
  }
  tally(r);
  if (r.pack === AMBUSH && !r.opts.practice) { ambushHome(r); return; }
  showResults(r, true);
}

/**
 * Practice is offered, never pushed: after five falls in the same four bars, one quiet line under the percent,
 * "practise this part?", that fades if it is left alone. A tap on it starts practice from that section.
 */
const falls: number[] = [];
function nudgeAfter(r: Run): void {
  const part = Math.floor(r.sim.crashBeat / 16);
  if (falls.length && falls[0] !== part) falls.length = 0;
  falls.push(part);
  if (falls.length !== 5) return; // (said once for a part: a sixth fall there does not say it again)
  const seg = r.level.segAt(Math.max(0, r.crashTime)), el = $('nudge');
  el.onclick = () => { el.classList.remove('show'); el.classList.add('hidden'); practice = true; if (seg.t0 <= r.t0 + 0.01) startRun(); else startRun(seg.t0); };
  el.classList.remove('hidden', 'show');
  void el.offsetWidth;
  el.classList.add('show');
  window.setTimeout(() => { if (el.classList.contains('show')) { el.classList.remove('show'); el.classList.add('hidden'); } }, 5200);
}
/** reached: how far the run was when it was left (a stopped run no longer knows) */
function showResults(r: Run, cleared: boolean, reached = r.pct, silent = false): void {
  const id = r.pack.level.id;
  const prev = bestFor(id);
  const counted = (!r.opts.bot || botStar) && !r.opts.practice;
  const first = cleared && counted && !prev.cleared;
  const wasHome = !!r.pack.level.side || !!bestFor(baseOf(r.pack)).cleared; // was this world's colour home before the run?
  const said: string[] = []; // what the run changed, in a few soft lines
  const won = { star: [] as string[], glow: [] as string[] };
  let newStars = [false, false, false];
  if (cleared && counted) {
    const moon = !!r.pack.level.side;
    // how things stood before this clear, to tell what it has just changed
    const gateWas = nodeState(nodeOf('gate'), progress) === 'open';
    const hasMoon = NODES.some((n) => n.id === `${id}-b`);
    const moonWas = !hasMoon || nodeState(nodeOf(`${id}-b`), progress) !== 'hidden';
    const orbsWas = new Set(ORBS.filter(owned).map((o) => o.id));
    const starsWas = new Set(starsLit(starProgress).map((s) => s.id));
    save.bests[id] = { ...prev, pct: 100, cleared: true };
    const onBeatPct = r.sim.judged ? (r.sim.onBeat / r.sim.judged) * 100 : 0;
    if (!moon) {
      const done = ALL_PACKS.map((p) => p.level.id).filter((x) => bestFor(x).cleared);
      const fresh = earned(id, { onBeatPct, dropPower: r.dropPower, bestStreak: r.sim.bestStreak, attempts: bestFor(id).attempts, practised: !!save.practiced[id] }, done).filter((b) => !save.badges[b]);
      if (first) pendingStory = r.pack === FINAL ? 'end' : id; // its story card plays on the way back to the map
      if (first) said.push(r.pack === FINAL ? 'The last star is lit.' : 'Its star is awake, and its colour with it.');
      if (first && r.pack !== FINAL && levelIdx + 1 < PACKS.length && !progress.unlockAll) said.push(`${planetName(PACKS[levelIdx + 1].level.id)} is waking\u2026`); // the results end on the hook, not on numbers
      // shards are kept when the run that collected them clears the level
      const had = starsFor(id);
      const now = had.map((k, i) => k || r.sim.stars[i] === 1);
      const gained = now.filter(Boolean).length - had.filter(Boolean).length;
      if (gained > 0) {
        save.stars[id] = now;
        newStars = now.map((k, i) => k && !had[i]);
        if (now.every(Boolean) && !first) said.push(gained === 3 ? 'All three star shards are home.' : 'The last shard is home.');
      }
      // the two feats that are done once: every shard on this one flight, and a clear on a daredevil's single attempt
      if (r.course.stars.length > 0 && r.course.stars.every((st) => r.sim.stars[st.i] === 1)) save.feats[`shards:${id}`] = true;
      if (dare) save.feats[`dare:${id}`] = true;
      if (emberFalls === 0 && r.startAt <= r.t0 + 1e-6 && !r.opts.bot) save.feats[`clean:${id}`] = true; // Unbroken: no fall on the way
      // what the shards have just done to the map
      if (!moonWas && nodeState(nodeOf(`${id}-b`), progress) !== 'hidden') said.push(`${planetName(id)} has a moon now.`);
      if (!gateWas && nodeState(nodeOf('gate'), progress) === 'open') said.push('All four stars are awake: the guardian is in reach.');
      // (Game Center has boards and achievements for the four levels of the route)
      if (PACKS.includes(r.pack)) { gameCenter.best(id, 100); gameCenter.flow(id, onBeatPct); }
      // the share of the level's gold this clear collected (all of it is the Rhythm master star)
      const gold = Math.round((100 * (r.course.flow.filter((f) => r.sim.noteUsed(f.beat)).length + r.sim.holdsFull)) / Math.max(1, r.course.flow.length + r.course.holds.length));
      save.gold[id] = Math.max(save.gold[id] ?? 0, gold);
      // the old badges are still earned, unseen: Game Center's achievements and two of the glows hang on them
      if (gold >= 100 && !save.badges[`tune_${id}`]) fresh.push(`tune_${id}`);
      if (starsFor(id).every(Boolean) && !save.badges[`mender_${id}`]) fresh.push(`mender_${id}`);
      for (const bid of fresh) {
        save.badges[bid] = true;
        if (bid !== `clear_${FINAL_ID}` && !/^(tune|mender)_/.test(bid)) gameCenter.badge(bid);
      }
    }
    // stars this clear has lit (a first clear's own star goes without saying: its song is home), and glows it has won
    for (const s of starsLit(starProgress)) if (!starsWas.has(s.id) && !(first && s.kind === 'restore')) won.star.push(s.name);
    for (const o of ORBS) if (owned(o) && !orbsWas.has(o.id)) won.glow.push(o.name);
  }
  if (cleared && r.opts.practice) save.bests[id] = { ...bestFor(id), prac: 100 };
  persist();
  const pct = cleared ? 100 : Math.max(session.far, reached);
  const keptNow = starsFor(id);
  const sm = r.smoothness();
  const carried = r.sim.stars.filter((x) => x === 1).length;
  console.log(`[one more orbit] ${r.opts.bot ? 'autoplay' : 'run'} ${cleared ? 'cleared' : 'left'} ${r.level.title}: ${r.sim.onBeat}/${r.sim.judged} taps on the beat, best streak ${r.sim.bestStreak}, drop at ${Math.round(r.dropPower * 100)}%. Movement check: ${sm.frames} frames, clock speed never more than ${sm.worstPct.toFixed(2)}% off (average ${sm.meanPct.toFixed(3)}%)`);
  // the painted results: the planet's sky, and a few soft lines
  if (cleared && counted && r.pack.level.side && first) said.unshift('The moon’s song is played all the way through.');
  if (cleared && !said.length && !won.star.length) said.push(r.opts.bot ? 'Autoplay, all the way through.' : r.opts.practice ? 'A practice run, all the way through.' : 'Once more, all the way through.');
  if (!cleared) {
    if (r.opts.bot) said.push('Autoplay.');
    else if (r.opts.practice) said.push('A practice run: nothing is kept.');
    else {
      if (dare) said.push('A daredevil has one attempt, and this one fell.');
      said.push(session.newBest ? 'Your furthest yet.' : bestFor(id).cleared ? 'Its song is already home.' : `Your furthest is ${Math.max(bestFor(id).pct, pct)}%.`);
    }
    if (!wasHome) said.push('The colour rose this far, and waits.');
  }
  if (won.star.length) said.push(won.star.length === 1 ? `A star lit: ${won.star[0]}.` : `${won.star.length} stars lit: ${won.star.join(', ')}.`);
  if (won.glow.length) said.push(won.glow.length === 1 ? `A new glow for Orbin: ${won.glow[0]}.` : `${won.glow.length} new glows for Orbin.`);
  const kept = keptNow.filter(Boolean).length;
  const more = [`Attempt ${counted ? bestFor(id).attempts : session.attempts}. On the beat ${session.judged ? `${Math.round((session.onBeat / session.judged) * 100)}%` : 'not judged'}, best streak ${session.streak}.`];
  if (session.drop >= 0) more.push(session.drop >= 0.995 ? 'The drop played at full charge.' : `The drop played at ${Math.round(session.drop * 100)}% charge.`);
  if (said.length > 3) more.push(said.splice(3).join(' ')); // (three lines in the picture; anything past that is here)
  if (r.opts.bot) more.push(`Movement check: ${sm.frames} frames, the clock never more than ${sm.worstPct.toFixed(2)}% off.`);
  else {
    if (cleared && r.course.holds.length) more.push(`Gold holds in full: ${r.sim.holdsFull} of ${r.course.holds.length}.`);
    if (r.opts.practice && carried) more.push('Practice runs do not keep star shards.');
    else if (!cleared && carried) more.push('A shard is kept when the run that found it clears the song.');
    else if (cleared && r.course.stars.length && !keptNow.every(Boolean)) more.push('A shard is kept by playing its branch clean.');
  }
  resMore = more;
  skyResult.show({
    world: baseOf(r.pack), name: placeName(r.pack), song: shortTitle(r.pack), tag: r.opts.bot ? 'autoplay' : r.opts.practice ? 'practice' : dare ? 'daredevil' : '',
    pct, cleared, first, home: wasHome,
    shards: r.course.stars.length ? keptNow : null, fresh: newStars,
    shardLine: kept === 3 ? 'all three star shards' : kept === 0 ? 'no shards yet' : `${['', 'one', 'two'][kept]} star shard${kept === 1 ? '' : 's'} kept`,
    lines: said, ...syncSaid()
  });
  $('resSaid').textContent = `${placeName(r.pack)}, ${shortTitle(r.pack)}: ${cleared ? 'played all the way through' : `reached ${pct} percent`}. ${said.join(' ')} Tap, or press Enter, for one more orbit; Escape goes up to the galaxy.`;
  botMode = false;
  if (!silent) show('results');
}
/** more about the run, apart from the sync line (which can change while the results are up) */
let resMore: string[] = [];
/** A planet's painted sky for its level, where it has one that is built (Emberwick so far): kept, so it is painted once. */
const scenes = new Map<string, PlanetScene>();
const BUILT = ['heroes', 'skyhigh', 'blank', 'invincible'];
function sceneFor(p: LevelPack): PlanetScene | WorldSky | null {
  // the worlds you play on: the level is the place (the planet in the middle of the ring, its inhabitant beside it)
  if (p === FIRST) return edgeWorld.sky;
  if (p === AMBUSH) return ambushWorld.sky;
  if (p.level.id === 'heroes') return emberWorld.sky;
  if (WORLDS2[p.level.id]) return WORLDS2[p.level.id].sky;
  const world = baseOf(p);
  if (!BUILT.includes(world) || !PlanetScene.has(world)) return null;
  let s = scenes.get(world);
  if (!s) scenes.set(world, (s = new PlanetScene(world)));
  return s;
}
/**
 * Helion's moment in each level (the owner's brief, 2026-11-25): a calm bar near the end of the build where the music
 * thins and his music-box motif sounds from far away (his silhouette flickers in the shadow ring: worlds.ts).
 */
const HELION: Record<string, { meta: AudioMeta; at: number }> = { started: { meta: helion1Audio as AudioMeta, at: 17.6 }, heroes: { meta: helion2Audio as AudioMeta, at: 16.8 }, skyhigh: { meta: helion3Audio as AudioMeta, at: 13.125 }, blank: { meta: helion4Audio as AudioMeta, at: 13.125 }, invincible: { meta: helion5Audio as AudioMeta, at: 14.4 } };
let helionCue: { run: Run; track: Awaited<ReturnType<typeof audio.loadTrack>> | null; at: number; meta: AudioMeta; played: boolean } | null = null;
/** The planet in the middle of the ring, for the worlds that are built as places. */
function worldFor(p: LevelPack): World | null { return p === FIRST ? edgeWorld.world : p === AMBUSH ? ambushWorld.world : p.level.id === 'heroes' ? emberWorld.world : WORLDS2[p.level.id]?.world ?? null; }
/** What is written into a sleeping world's sky, once, on the way to its drop. */
// (the inhabitant speaks at most three times, in calm moments, low on the screen, never over the course)
// (in the clear band between the top of the screen and the ring: never over the course, Ossa or the thread)
const LOW = (from: number, to: number, text: string): Said => ({ from, to, text, x: 0.5, y: 0.2, size: 19, align: 'center' });
const WRITTEN: Record<string, Said[]> = {
  heroes: [LOW(0.3, 4.6, 'Cold. Since the music stopped.'), LOW(9.6, 12.2, 'There. A spark.'), LOW(36.0, 38.6, 'Strike with me.')],
  started: [LOW(1.6, 6.4, 'Something here is listening.')],
  ambush: AMBUSH_SAYS,
  ...WRITTEN2
};
/** the scene before a world's first attempt: written into its sky during the long lead-in (song seconds, below zero) */
const BEFORE: Record<string, Said[]> = { heroes: [
  { from: -8.4, to: -2.6, text: 'Emberwick, the forge-world.', x: 0.5, y: 0.2, size: 24, align: 'center' },
  { from: -6.8, to: -2.6, text: 'Ossa, stopped mid-strike.', x: 0.5, y: 0.245, size: 21, align: 'center' },
  { from: -5.0, to: -2.0, text: 'One spark of its fire is left, and it comes to you.', x: 0.5, y: 0.29, size: 18, align: 'center' }
], ambush: [
  { from: -7.6, to: -2.4, text: 'Two stars awake, and the Landing burning bright.', x: 0.5, y: 0.2, size: 21, align: 'center' },
  { from: -5.6, to: -2.4, text: 'Out in the dark, something has noticed.', x: 0.5, y: 0.245, size: 19, align: 'center' }
], ...BEFORE2 };
/** A chosen world's sky is painted while the galaxy is at rest, so flying in is not held up by it. */
function paintAhead(p: LevelPack): void {
  if (p === FIRST) edgeWorld.askAhead(); else if (p === AMBUSH) ambushWorld.askAhead(); else if (p.level.id === 'heroes') askEmber(); else WORLDS2[p.level.id]?.askAhead();
  window.setTimeout(() => { if (screen === 'levels' && !$('levels').classList.contains('launch')) sceneFor(p)?.prepare(); }, 900);
  // and the Landing as it will be when this world's star comes home (painted a layer at a time while the galaxy is still)
  if (!bestFor(baseOf(p)).cleared) { const n = starsHome(); window.setTimeout(() => landing.prepare([n, n + 1], () => screen === 'levels' && !$('levels').classList.contains('launch')), 1400); }
}
/** the offset the results' one-tap fix would set, when there is one on offer */
let resFix: number | null = null;
/** What the taps say about sync, as the results' last soft line, and the one-tap fix if there is one. */
function syncSaid(fixed = false): Pick<ResultInfo, 'more' | 'fix'> {
  const r = syncRead();
  resFix = fixed ? null : r.next;
  return { more: [...resMore, fixed ? `The sound now arrives ${fmtMs(save.audioOffset)}. Play on, and see.` : r.line], fix: resFix !== null ? `set the sound to ${fmtMs(resFix)}` : '' };
}

// ------------------------------------------------------------------ test chambers
// Short rooms in plain shapes, to judge the play and the sound before any art. Reached from Settings (Playtest) or
// with ?chambers on the address. Nothing here reads or writes the saved game.
let chamber: Chamber | null = null;
/** the ambush, restarting from a checkpoint: how the light notes before it went */
let carryLights: Array<boolean | null> | null = null;
let packWas: LevelPack | null = null;
let listening = '';
function renderChambers(said = ''): void {
  const note = $('chamberSaid');
  note.textContent = said;
  note.classList.toggle('hidden', !said);
  $('chamberList').innerHTML = CHAMBERS.map((c) => `<button class="chamber-row" type="button" data-room="${c.id}"><b>${c.name}</b><small>${c.what}</small><span class="go"><span>PLAY</span></span></button>`).join('');
  $('listenList').innerHTML = LISTEN.map((l) => `<button class="chamber-row${listening === l.id ? ' on' : ''}" type="button" data-listen="${l.id}"><b>${l.name}</b><small>${l.what}</small><span class="go"><span>${listening === l.id ? 'STOP' : 'LISTEN'}</span></span></button>`).join('');
}
function openChambers(said = ''): void {
  run?.stop();
  run = null;
  botMode = false;
  practice = false;
  audio.stopPreview(0.3);
  listening = '';
  renderChambers(said);
  show('chambers');
}
function closeChambers(): void {
  audio.stopPreview(0.3);
  listening = '';
  chamber = null;
  if (packWas) { pack = packWas; packWas = null; }
  renderer.plain = renderer.windows = false;
  show('levels');
}
function startChamber(c: Chamber, bot = false): void {
  audio.stopPreview(0.2);
  listening = '';
  if (!packWas) packWas = pack;
  chamber = c;
  pack = c.pack;
  practice = false;
  botMode = bot;
  renderer.plain = true;
  renderer.planet = null;
  renderer.windows = !!c.ambush;
  Object.assign(session, { far: 0, newBest: false, onBeat: 0, judged: 0, streak: 0, drop: -1, attempts: 0 });
  startRun();
}
/** A room played through, or left: one plain line about how it went, back on the list. */
function chamberDone(r: Run, cleared: boolean, at = r.pct): void {
  const c = chamber!;
  const beat = session.judged ? `${Math.round((session.onBeat / session.judged) * 100)}% of taps on the beat` : 'no taps judged';
  const w = r.windows;
  const amb = c.ambush ? ` Light notes struck on the beat: ${w.struck} of ${r.lights.length}. Windows still lit: ${w.lit} of 4${cleared && !w.lost ? ' (none lost: both stars)' : ''}.` : '';
  const said = `${c.name}: ${cleared ? `cleared on try ${session.attempts}` : `left at ${at}% after ${session.attempts} ${session.attempts === 1 ? 'try' : 'tries'}`}, ${beat}.${amb}`;
  run = null;
  openChambers(said);
}
$('chambers').addEventListener('click', (e) => {
  const row = (e.target as HTMLElement).closest<HTMLElement>('.chamber-row');
  if (!row) return;
  audio.ensure();
  const c = CHAMBERS.find((x) => x.id === row.dataset.room);
  if (c) { startChamber(c); return; }
  const l = LISTEN.find((x) => x.id === row.dataset.listen);
  if (!l) return;
  if (listening === l.id) { audio.stopPreview(0.25); listening = ''; }
  else { listening = l.id; audio.setVolumes(save.music, save.sfx); void audio.preview(l.audio, l.from - l.audio.offset, 1, true); }
  renderChambers($('chamberSaid').textContent ?? '');
});

// ------------------------------------------------------------------ HUD
const hud = { pct: -1, at: -1, seg: '', count: '', crashShown: false, lesson: -1, finale: false };
/** "Emberwick · the drop": where in the song, in the HUD's small hand. */
const sectionSaid = (label: string) => { const s = label.toLowerCase(); return /^drop/.test(s) ? `the ${s}` : s; };
function updateHud(r: Run): void {
  harvest(r);
  drawSyncOverlay();
  // the level's three shards: lit if already kept, glowing once collected on this attempt, dimmed if lost on it
  const kept = starsFor(r.pack.level.id), shards = $('hudStars');
  shards.classList.toggle('hidden', !!r.opts.tutorial || !!r.opts.memory || !r.course.stars.length);
  for (let i = 0; i < 3; i++) {
    const cls = r.sim.stars[i] === 1 ? 'got' : kept[i] ? 'kept' : r.sim.stars[i] === -1 && r.sim.starBeat[i] > -90 ? 'lost' : '';
    if (shards.children[i].className !== cls) shards.children[i].className = cls;
  }
  const pct = r.pct;
  if (pct !== hud.pct) { hud.pct = pct; $('pct').textContent = String(pct); }
  const beat = r.time / r.level.spb;
  // the thread is drawn through as far as the song has come, and the flame rides its end
  const at = r.opts.tutorial ? Math.max(0, Math.min(1, beat / TUTORIAL_BEATS)) : r.progress;
  if (Math.abs(at - hud.at) > 0.0004) { hud.at = at; $('progFill').style.transform = `scaleX(${at.toFixed(4)})`; $('progAt').style.left = `${(at * 100).toFixed(2)}%`; }
  const cb = chamber ? [...chamber.beats].reverse().find((x) => r.time / r.level.spb >= (x.bar - 1) * 4 - 0.01) : undefined;
  const label = r.opts.memory ? 'the Harmonic Nebula' : chamber ? (cb?.label ?? 'ready').toLowerCase() : r.opts.tutorial ? 'Emberwick' : `${planetName(r.pack.level.id)}  ·  ${sectionSaid(r.level.segAt(Math.max(0, r.time)).label)}`;
  if (label !== hud.seg) { hud.seg = label; $('section').textContent = label; }
  // 3, 2, 1 on the beats of the count-in bar: the first press is never a surprise
  let n = '';
  if (r.course.start === 0 && !r.opts.tutorial && !r.opts.memory && !r.opts.gentle && r.startAt <= r.level.spb * 3.5 && r.state === 'playing') n = beat >= 1 && beat < 2 ? '3' : beat >= 2 && beat < 3 ? '2' : beat >= 3 && beat < 4 ? '1' : '';
  if (n !== hud.count) {
    hud.count = n;
    const el = $('countIn');
    el.classList.remove('pop');
    if (n) { el.textContent = n; void el.offsetWidth; el.classList.add('pop'); }
  }
  if (r.state === 'failed' && !hud.crashShown) {
    // the fall: how far you got, in one line; it restarts by itself, or at once on a tap
    hud.crashShown = true;
    const best = !r.opts.bot && !r.opts.practice && pct > bestFor(r.pack.level.id).pct;
    // (letting go of a tether says so: it is the one fall that is not a missed mark)
    toast(r.sim.crashKind === 'snuffed' ? 'the last light is out' : r.sim.crashKind === 'let' ? `let go: ${pct}%` : best && pct >= 2 ? `your furthest yet: ${pct}%` : pct >= 80 ? `so close: ${pct}%` : `${pct}%`, best);
  }
  if (r.finale !== hud.finale) {
    hud.finale = r.finale;
    $('finale').classList.toggle('show', r.finale);
    if (r.finale) $('finaleNote').textContent = !r.opts.bot && !r.opts.practice && !bestFor(r.pack.level.id).cleared ? 'for the first time' : '';
  }
  if (r.finale) $('finaleFill').style.transform = `scaleX(${r.progress.toFixed(3)})`;
  if (r.opts.tutorial || r.opts.gentle) {
    const L = r.opts.tutorial ? LESSONS : FIRST_LESSONS;
    let k = 0;
    L.forEach(([b], i) => { if (beat >= b) k = i; });
    if (k !== hud.lesson) { hud.lesson = k; $('tutorText').innerHTML = L[k][1]; }
  }
}

// ------------------------------------------------------------------ input: one button
function tap(t: number): void {
  if (!run || screen !== 'play') return;
  if (skyStar.on) { skyStar.tap(); return; } // (the level is won: a tap only hurries the words)
  if (run.state === 'failed') { run.skipWait(); return; } // tap to retry at once
  if (!run.opts.bot) run.tap(t);
}
window.addEventListener('pointerdown', (e) => {
  audioReady = true;
  const btn = (e.target as HTMLElement).closest('button');
  if (btn && screen !== 'play' && audio.ctx) audio.hit('tap', 0.5); // every button answers with a click
  if (btn && screen !== 'play') feel('pick');
  if (screen !== 'play' || btn) return;
  e.preventDefault();
  fingers.add(e.pointerId);
  tap(stamp(e));
}, { passive: false });
// Holds: the button is down while any finger (or key) is. Letting the last one go is the release.
const fingers = new Set<number>();
const keysDown = new Set<string>();
function letGo(t: number): void {
  if (fingers.size || keysDown.size) return;
  if (run && screen === 'play' && !run.opts.bot) run.release(t);
}
for (const type of ['pointerup', 'pointercancel'] as const) window.addEventListener(type, (e) => { if (fingers.delete(e.pointerId)) letGo(stamp(e)); });
window.addEventListener('keyup', (e) => { if (screen === 'cold') coldScene.press(false); if (keysDown.delete(e.code)) letGo(stamp(e)); });
window.addEventListener('blur', () => { fingers.clear(); keysDown.clear(); letGo(performance.now()); });
// iOS Safari only lets sound start from the end of a touch (or a click), not from its start: wake the audio there too.
// The same call brings it back after a phone call or a trip to another app.
for (const type of ['pointerup', 'touchend', 'click'] as const) window.addEventListener(type, () => { if (audio.ctx && !audio.running && !(run && (run.state === 'paused' || run.state === 'resuming'))) void audio.resume(); }, { capture: true, passive: true });
// The title opens on the finished tap (a click), not on the touch going down: a touch that changes the screen under the
// finger would land its click on whatever appears there, and start a level. A click is also what lets iOS start the sound.
$('title').addEventListener('click', () => { if (screen === 'title') landingTap(); });
/** A tap at the Landing: it wakes him (or ends the quiet beat after a star comes home), and the camera rises to the map. */
function landingTap(): void {
  if (landing.rising) return;
  if (memoryFilm.on) { memoryFilm.tap(); return; } // (a memory lets go early, into the fire)
  if (landing.inFire) return;
  audioReady = true;
  audio.ensure(); audio.setVolumes(save.music, save.sfx);
  if (phoneCheck) { startPhoneCheck(); return; }
  const k = landing.tap();
  if (k === 'wake') { renderMap(); landing.ascend(() => show('levels'), 2.6); }
  if (!audio.previewing) fireTheme();
}
// the results: a tap anywhere flies the song again; the quiet lines lead elsewhere
$('results').addEventListener('click', (e) => {
  if (screen !== 'results') return;
  const r = skyResult.tap(e.clientX, e.clientY);
  if (r === 'again') { session.far = 0; session.newBest = false; startRun(); }
  else if (r === 'galaxy') toLevels();
  else if (r === 'check') { run?.stop(); run = null; openCalib(); }
  else if (r === 'fix') { if (resFix !== null) syncFix(resFix); if (skyResult.info) Object.assign(skyResult.info, syncSaid(true)); }
});
// the story: a tap anywhere goes on (or brings the rest of the words in); the quiet word in the corner skips
$('story').addEventListener('click', (e) => { if (screen !== 'story') return; const r = skyStory.tap(e.clientX, e.clientY); if (r === 'skip') endStory(); else if (r === 'next') nextStory(); });
window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  audioReady = true;
  const back = e.code === 'Escape';
  if (screen === 'calib') { if (back) closeCalib(); else if (e.code !== 'Tab') { e.preventDefault(); calTap(stamp(e)); } return; }
  if (screen === 'record') { if (record.key(e)) e.preventDefault(); return; }
  if (screen === 'cold') { if (e.code !== 'Tab') { e.preventDefault(); coldScene.press(true); } return; }
  if (screen === 'prologue') { if (back && opening.again) { opening.stop(); renderSettings(); show('settings'); } else if (e.code !== 'Tab') { e.preventDefault(); opening.tap(stamp(e)); } return; }
  if (screen === 'title') { e.preventDefault(); landingTap(); return; }
  if (screen === 'moment') { if (e.code !== 'Tab') { e.preventDefault(); moment.tap(); } return; }
  if (screen === 'story') { if (back) endStory(); else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); nextStory(); } return; }
  if (screen === 'levels') {
    const step = e.code === 'ArrowLeft' || e.code === 'ArrowDown' ? -1 : e.code === 'ArrowRight' || e.code === 'ArrowUp' ? 1 : 0;
    if (step) { e.preventDefault(); select(NODES[Math.max(0, Math.min(NODES.length - 1, NODES.indexOf(at) + step))].id); }
    else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); begin(false); } else if (e.code === 'KeyP') begin(true); else if (back) show('title');
    return;
  }
  if (screen === 'play') {
    if (back || e.code === 'KeyP') pause(); else if (e.code === 'KeyR' && !run?.opts.tutorial) startRun(-1, true); else if (e.code !== 'Tab') { e.preventDefault(); keysDown.add(e.code); tap(stamp(e)); } // any key is the button
    return;
  }
  if (screen === 'pause') { if (back) resume(); else if (e.code === 'KeyR') startRun(-1, true); return; } // (Enter and Space press whichever line has the focus: Resume, when the pause opens)
  if (screen === 'results') { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyR') { e.preventDefault(); startRun(); } else if (back) toLevels(); return; }
  if (back) { if (screen === 'settings') closeSettings(); else if (screen === 'chambers') closeChambers(); else if (screen === 'credits' || screen === 'logbook') { renderSettings(); show('settings'); } else leaveRoom(); }
});

function pause(): void {
  if (!run || screen !== 'play' || run.state !== 'playing' || run.finale) return;
  fingers.clear();
  keysDown.clear();
  run.release(performance.now()); // a held button does not stay held through a pause
  run.pause();
  $('pauseAt').textContent = run.opts.memory ? 'held, in a memory' : run.opts.tutorial ? 'held, in the first flight' : `held at ${run.pct}%`;
  showPauseSync();
  const tut = !!run.opts.tutorial || !!run.opts.memory;
  for (const id of ['pauseRestartBtn', 'pausePracticeBtn', 'pauseSkipBtn']) $(id).classList.toggle('hidden', tut);
  $('pauseSkipBtn').classList.toggle('hidden', tut || buildStart() < 0);
  if (chamber) for (const id of ['pausePracticeBtn', 'pauseSkipBtn']) $(id).classList.add('hidden'); // a room is short: it is always played whole
  $('pauseQuitBtn').textContent = run.opts.memory ? 'Let the memory go' : chamber ? 'Back to the rooms' : 'Leave for the galaxy';
  rooms.prepare(['desk'], () => screen === 'pause', 700); // (the desk is painted while the scene is held, in case Settings is next)
  show('pause');
  $('resumeBtn').focus({ preventScroll: true });
}
function resume(): void {
  if (!run || screen !== 'pause') return;
  show('play');
  run.resume();
}
function toLevels(): void {
  run?.stop();
  run = null;
  botMode = false;
  if (chamber) { openChambers(); return; }
  viaStory(() => show('levels'));
}
/** Quitting shows what the visit came to (how far, flow, sync) before going back to the levels. */
function quit(): void {
  if (!run) { toLevels(); return; }
  const r = run;
  if (r.opts.memory) { endMemory(); return; }
  if (r.opts.tutorial) { r.stop(); run = null; show('levels'); return; }
  if (chamber) { tally(r); const at = r.pct; r.stop(); chamberDone(r, false, at); return; } // (a stopped run no longer knows how far it was)
  tally(r);
  const reached = r.pct;
  r.stop();
  if (session.far === 0 && reached === 0 && session.attempts <= 1) { toLevels(); return; }
  showResults(r, false, reached);
}
/** Where the build-up before the drop begins (the first charge section), as a song time. */
function buildStart(): number {
  let beat = 0;
  for (const s of pack.level.segments) {
    if (s.core?.charge) return Math.max(0, beat - 8) * 60 / pack.audio.bpm; // two bars of run-up before it
    beat += s.bars * 4;
  }
  return -1;
}
/** The game left the screen (another tab or app, the home screen, a call): stop the run and the music, and save. */
function away(): void {
  pause();
  record.halt();
  audio.stopPreview(0.2);
  persist();
  if (!(run && (screen === 'play' || screen === 'pause'))) void audio.suspend(); // nothing keeps playing behind another app
}
function back(): void {
  if (screen === 'levels') queuePreview();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) away(); else back(); });
window.addEventListener('pagehide', persist);
watchBackground(away, back);
window.addEventListener('resize', () => { renderer.resize(); show(screen); });

// ------------------------------------------------------------------ settings
// Installing the website as an app: Chrome and Android offer a prompt; on an iPhone it is done from Safari's Share menu.
type InstallEvent = Event & { prompt: () => Promise<unknown> };
let installEvent: InstallEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e as InstallEvent; });
function installHint(): boolean {
  if (isNative) return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !installed;
}
function renderSettings(): void {
  for (const [id, v] of [['setMusic', save.music], ['setSfx', save.sfx], ['setHit', save.hitVol]] as const) $<HTMLInputElement>(id).value = String(v);
  showVolumes();
  $('aoVal').textContent = fmtMs(save.audioOffset);
  $('voVal').textContent = fmtMs(save.visualOffset);
  for (const [id, on] of [['setMotion', save.reducedMotion], ['setFlash', save.reduceFlash], ['setSync', save.syncOverlay], ['setUnlock', save.unlockAll], ['setHaptics', save.haptics], ['setTapLog', !!save.tapLog]] as const) $(id).setAttribute('aria-pressed', String(on));
  $('setHaptics').classList.toggle('hidden', !canHaptics);
  $('gcBtn').classList.toggle('hidden', !gameCenter.available);
  $('installNote').classList.toggle('hidden', !installHint());
  $('installBtn').classList.toggle('hidden', !installEvent);
  $('syncNote').textContent = !save.calibrated ? 'not done yet' : deviceChanged ? 'your sound has changed' : 'ten seconds';
  $('recordBtn').classList.toggle('hidden', !import.meta.env.DEV);
  const lat = Math.round(audio.latency() * 1000);
  $('setInfo').textContent = `${audio.ctx ? `This device says its sound takes ${lat} ms to arrive; that is already allowed for. ` : ''}New headphones or speakers? Listen for Helion again.`;
  $('settingsBack').textContent = settingsFrom === 'pause' ? 'back to the flight' : 'out to the galaxy';
  const chapters = chaptersOpen().length;
  $('storyBtn').classList.toggle('hidden', chapters === 0);
  $('replayMemory').classList.toggle('hidden', !save.story[PACKS[0].level.id]);
  $('replayAmbush').classList.toggle('hidden', !save.story.ambush && !bestFor('skyhigh').cleared && !progress.unlockAll);
  $('logNote').textContent = chapters === 1 ? 'one chapter' : `${chapters} chapters`;
  rooms.calm = save.reducedMotion;
}
/** Each thread is drawn through as far as its sound is up; drawn right down, its flame is out. (The value is also kept in words, for readers.) */
function showVolumes(): void {
  for (const [id, v] of [['setMusic', save.music], ['setSfx', save.sfx], ['setHit', save.hitVol]] as const) {
    const el = $(id);
    el.style.setProperty('--f', String(v));
    el.classList.toggle('out', v <= 0);
    $(`${id}Val`).textContent = v <= 0 ? 'off' : `${Math.round(v * 100)}%`;
  }
}
function openSettings(from: Screen): void {
  settingsFrom = from;
  if (from === 'levels') viaLantern = sky.chosen === 'landing';
  audio.ensure();
  renderSettings();
  show('settings');
}
function closeSettings(): void {
  persist();
  if (settingsFrom === 'pause') show('pause'); else leaveRoom();
}
function nudge(key: 'audioOffset' | 'visualOffset', by: number): void {
  save[key] = Math.max(-200, Math.min(400, save[key] + by));
  persist();
  renderSettings();
}
function toggle(key: 'reducedMotion' | 'reduceFlash' | 'syncOverlay' | 'unlockAll' | 'haptics' | 'tapLog'): void {
  save[key] = !save[key];
  persist();
  renderSettings();
}

// ------------------------------------------------------------------ the sync check: Marlow taps the glass
// He taps the lamp's glass, "one, two, three, four", and you tap along with him. By ear first: the average distance
// between your taps and his becomes the sound's offset. Then, if you like, by eye: no sound, his taps come down the
// dark and land on the glass, and the average becomes the picture's offset. Nothing is changed until you say so.
const CAL_PERIOD = 0.6;
const CAL_NEED = 8;
const CAL_TAPS = 40; // he taps for 24 seconds, then stops
type CalStage = 'tapping' | 'read' | 'uneven' | 'stopped' | 'set';
const cal = {
  mode: 'ear' as 'ear' | 'eye', stage: 'stopped' as CalStage,
  /** his taps, as times on the audio clock (by ear), and how many of them have been handed to the sound card */
  clicks: [] as number[], t0: 0, sent: 0,
  /** when his first tap lands, on the page's clock (by eye) */
  startPerf: 0,
  taps: [] as number[], read: 0, sd: 0, timer: 0,
  then: 'back' as 'begin' | 'back', from: 'settings' as Screen, done: false
};
/** A round begins: he starts tapping. */
function calStart(): void {
  audio.ensure();
  audio.stopPreview(0.2);
  cal.stage = 'tapping';
  cal.taps = [];
  cal.clicks = [];
  cal.sent = 0;
  cal.t0 = -1;
  clearTimeout(cal.timer);
  if (cal.mode === 'ear') void audio.resume().then(() => { if (cal.stage === 'tapping' && cal.mode === 'ear' && audio.ctx) cal.t0 = audio.ctx.currentTime + 0.8; });
  else { cal.startPerf = performance.now() + CAL_PERIOD * 1000; cal.timer = window.setTimeout(() => { if (cal.stage === 'tapping') cal.stage = 'stopped'; }, CAL_TAPS * CAL_PERIOD * 1000); }
}
/** His taps are handed to the sound card a few at a time, so that when a round ends they end with it. */
function calTick(): void {
  if (cal.stage !== 'tapping' || cal.mode !== 'ear' || !audio.ctx || cal.t0 < 0) return;
  while (cal.sent < CAL_TAPS && cal.t0 + cal.sent * CAL_PERIOD < audio.ctx.currentTime + 0.35) {
    const t = cal.t0 + cal.sent * CAL_PERIOD;
    cal.clicks.push(t);
    audio.hit('glass', cal.sent % 4 === 0 ? 1 : 0.75, t);
    cal.sent++;
  }
  if (cal.sent >= CAL_TAPS && audio.ctx.currentTime > cal.t0 + CAL_TAPS * CAL_PERIOD) cal.stage = 'stopped';
}
/** One of your taps, at page time t. */
function calTap(t: number): void {
  if (cal.stage !== 'tapping') return;
  let d: number;
  if (cal.mode === 'ear') {
    if (cal.clicks.length < 3) return; // let his first taps set the pulse
    const heard = audio.ctxTimeAt(t) - audio.latency();
    if (heard < cal.clicks[2] - CAL_PERIOD / 2) return;
    d = Infinity;
    for (const c of cal.clicks) if (Math.abs(heard - c) < Math.abs(d)) d = heard - c;
    // (a tap just after the last one handed over belongs to the next, not yet in the list)
    const next = cal.t0 + cal.sent * CAL_PERIOD;
    if (Math.abs(heard - next) < Math.abs(d)) d = heard - next;
  } else {
    const x = (t - cal.startPerf) / 1000;
    if (x < CAL_PERIOD * 1.5) return;
    d = ((x + CAL_PERIOD / 2) % CAL_PERIOD) - CAL_PERIOD / 2;
  }
  if (Math.abs(d) > 0.25) return;
  rooms.tapped();
  cal.taps.push(d * 1000);
  if (cal.taps.length < CAL_NEED) return;
  const sorted = [...cal.taps].sort((a, b) => a - b);
  const core = sorted.slice(1, -1);
  const mean = core.reduce((s, v) => s + v, 0) / core.length;
  cal.sd = Math.sqrt(core.reduce((s, v) => s + (v - mean) * (v - mean), 0) / core.length);
  cal.read = Math.max(-200, Math.min(400, Math.round(mean)));
  cal.stage = cal.sd > 40 ? 'uneven' : 'read';
  clearTimeout(cal.timer);
}
/** What the lamp room shows right now. */
function calView(now: number): SyncInfo {
  const ear = cal.mode === 'ear', first = cal.then === 'begin', v = cal.read, set = ear ? save.audioOffset : save.visualOffset;
  const line = cal.stage === 'tapping' ? (cal.taps.length ? `${['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'][cal.taps.length] ?? cal.taps.length} of eight` : 'Eight taps will do.')
    : cal.stage === 'read' ? (Math.abs(v) < 8 ? 'You are right on his beat.' : `You are about ${Math.abs(v)} ms ${v > 0 ? 'behind' : 'ahead of'} him.`) + (v === set ? ' It is already set so.' : '')
    : cal.stage === 'uneven' ? 'Your taps were too uneven to read.'
    : cal.stage === 'set' ? `Set: the ${ear ? 'sound' : 'picture'} now arrives ${fmtMs(set)}.`
    : 'His beat has gone quiet.';
  const leave = { id: 'leave', label: first ? 'not now' : 'leave it' }, again = { id: 'again', label: 'once more' };
  const acts = cal.stage === 'tapping' ? [leave]
    : cal.stage === 'read' ? [...(v === set ? [] : [{ id: 'set', label: 'set it right' }]), again, leave]
    : cal.stage === 'set' ? (first ? [] : [ear ? { id: 'eye', label: 'now by eye' } : { id: 'ear', label: 'by ear again' }, again, { id: 'leave', label: 'done' }])
    : [again, leave];
  return {
    title: 'Listen for Helion.',
    say: ear ? `${deviceChanged && save.calibrated ? 'Your sound has changed. ' : ''}His heartbeat, from far off. Tap along with it, going by what you hear.` : 'No sound now. Tap as each beat of his light arrives.',
    back: first ? 'fly without it' : cal.from === 'settings' ? 'back to the crater' : 'out to the galaxy',
    counting: cal.stage === 'tapping' ? cal.taps.length : -1, taps: cal.taps, line, acts,
    foot: ear ? 'by ear first, then by eye' : 'by eye: his beat makes no sound',
    phase: !ear && cal.stage === 'tapping' ? (((now - cal.startPerf) / 1000 / CAL_PERIOD) % 1 + 1) % 1 : -1
  };
}
/** then 'begin': the check came up on the way into a level, which starts when it is done or passed over. */
function openCalib(then: 'begin' | 'back' = 'back'): void {
  cal.then = then;
  cal.from = screen === 'calib' ? cal.from : screen;
  cal.done = false;
  cal.mode = 'ear';
  if (cal.from === 'levels') viaLantern = sky.chosen === 'landing';
  show('calib');
  calStart();
}
/** One of the lamp room's quiet words was tapped. */
function calAct(id: string): void {
  if (id === 'back' || id === 'leave') closeCalib();
  else if (id === 'again') calStart();
  else if (id === 'eye' || id === 'ear') { cal.mode = id; calStart(); }
  else if (id === 'set' && cal.stage === 'read') {
    if (cal.mode === 'ear') { save.audioOffset = cal.read; save.calLatency = audio.latency(); cal.done = true; sync.press.length = sync.flow.length = 0; } else save.visualOffset = cal.read;
    persist();
    cal.stage = 'set';
    if (cal.then === 'begin') window.setTimeout(() => { if (screen === 'calib' && cal.stage === 'set') closeCalib(); }, 1100); // and on into the level
  }
}
function closeCalib(): void {
  cal.stage = 'stopped';
  clearTimeout(cal.timer);
  if (cal.then === 'begin' || cal.done) {
    // done, or passed over on the way in: it is not asked for again until the sound's output changes
    save.calibrated = true;
    if (save.calLatency < 0 || cal.done) save.calLatency = audio.latency();
    deviceChanged = false;
    persist();
  }
  if (cal.then === 'begin') { cal.then = 'back'; show('levels'); window.setTimeout(enter, 60); return; }
  if (cal.from === 'results' || cal.from === 'pause') { toLevels(); return; }
  if (cal.from === 'settings') { renderSettings(); show('settings'); return; }
  leaveRoom();
}
// A tap along has to be timed from the moment the finger lands, so it is taken on the way down; the quiet words
// (and the way back) are taken as finished taps, like everything else that leaves a screen.
$('calib').addEventListener('pointerdown', (e) => { if (screen !== 'calib' || rooms.hit(e.clientX, e.clientY)) return; e.preventDefault(); calTap(stamp(e)); });
$('calib').addEventListener('click', (e) => { if (screen !== 'calib') return; const id = rooms.hit(e.clientX, e.clientY); if (id) calAct(id); });

// ------------------------------------------------------------------ the hearth (Eko's glows), the gallery (the star chart), the logbook's last page
const glowsView = (): GlowsInfo => ({ glows: ORBS.map((o) => ({ id: o.id, name: o.name, rgb: o.rgb, lit: owned(o), says: o.says, how: o.how })), worn: save.skin });
function openGlows(): void {
  if (!hubRooms().glows) return; // (there is no fire until Emberwick is awake)
  viaLantern = sky.chosen === 'landing';
  rooms.glows = glowsView();
  rooms.look = save.skin;
  $('orbsSaid').textContent = `Ossa’s fire: Orbin’s glows. ${ORBS.map((o) => `${o.name}: ${owned(o) ? (o.id === save.skin ? 'worn now' : 'lit') : `still dark; what lights it: ${o.how}`}`).join('. ')}.`;
  show('orbs');
}
$('orbs').addEventListener('click', (e) => {
  if (screen !== 'orbs') return;
  const id = rooms.hit(e.clientX, e.clientY);
  if (id === 'back') { leaveRoom(); return; }
  const o = ORBS.find((x) => `glow:${x.id}` === id);
  if (!o) return;
  // a flame is worn at a touch; a dark wick says what lights it
  rooms.look = o.id;
  if (owned(o) && save.skin !== o.id) { save.skin = o.id; persist(); rooms.glows = glowsView(); if (audio.ctx) audio.hit('sparkle', 0.5); feel('pick'); }
  else if (audio.ctx) audio.hit('tap', 0.4);
});
const starsView = (): StarsInfo => ({
  groups: STAR_PLACES.map((id) => ({
    id, name: id === 'ambush' ? 'the ambush' : planetName(id), note: id === 'ambush' ? 'not in the sky yet' : '',
    rows: starsOf(id).map((s) => ({ name: s.name, what: s.what, lit: starLit(s, starProgress) }))
  })),
  lit: starsLit(starProgress).length, total: STAR_TOTAL
});
function openStars(): void {
  if (!hubRooms().stars) return; // (the rim's chart is dark until two stars are awake)
  viaLantern = sky.chosen === 'landing';
  const v = (rooms.stars = starsView());
  rooms.place = at.kind === 'gate' ? FINAL_ID : at.planet; // the chart opens on the world you are at
  $('starsSaid').textContent = `The star chart: ${v.lit} of ${v.total} lit. ${v.groups.map((g) => `${g.name}: ${g.rows.map((r) => `${r.name} (${r.what}), ${r.lit ? 'lit' : 'not yet'}`).join('; ')}`).join('. ')}.`;
  show('stars');
}
$('stars').addEventListener('click', (e) => {
  if (screen !== 'stars') return;
  const id = rooms.hit(e.clientX, e.clientY);
  if (id === 'back') leaveRoom();
  else if (id.startsWith('place:')) { rooms.place = id.slice(6); if (audio.ctx) audio.hit('tap', 0.4); }
});
const privacyUrl = isNative ? `${import.meta.env.VITE_SITE_URL}privacy.html` : './privacy.html';
function openCredits(): void {
  rooms.book = null;
  rooms.credits = {
    tracks: manifest.tracks.map((t) => ({ title: t.title, by: `${t.artist}   ·   ${t.release}` })),
    lines: [manifest.licenceNote, 'Helion’s theme, the cold open, the star’s sting and the Landing’s fire were written for this game.'],
    foot: 'ONE MORE ORBIT keeps no record of you.', link: 'the privacy note'
  };
  show('credits');
}
$('credits').addEventListener('click', (e) => {
  if (screen !== 'credits') return;
  const id = rooms.hit(e.clientX, e.clientY);
  if (id === 'back') { renderSettings(); show('settings'); }
  else if (id === 'privacy') window.open(privacyUrl, '_blank', 'noopener');
});
// The still pool: the story so far, and a chapter for each world woken, read a page at a time on the water.
/** where the pool was come to from (the galaxy, or the crater's list), to go back there */
let poolFrom: Screen = 'levels';
function leavePool(): void { if (poolFrom === 'settings') { renderSettings(); show('settings'); } else leaveRoom(); }
const chaptersOpen = () => LOGBOOK.filter((c) => (c.after === 'prologue' ? !!save.story.prologue || !!save.story.open : bestFor(c.after).cleared));
let logAt = 0;
function openLogbook(ch = -1): void {
  const open = chaptersOpen();
  if (!open.length) return;
  logAt = ch >= 0 ? Math.min(ch, open.length - 1) : open.length - 1; // it opens at the newest chapter
  if (screen !== 'logbook' && screen !== 'credits') { poolFrom = screen === 'settings' ? 'settings' : 'levels'; if (screen === 'levels') viaLantern = sky.chosen === 'landing'; }
  rooms.bookBack = poolFrom === 'settings' ? 'back to the crater' : 'out to the galaxy';
  turnLog(0, true);
  show('logbook');
}
/** Turns the page (by +1 or -1); past a chapter's last page the next chapter opens, and past the last of all, the pool is left. */
function turnLog(by: number, fresh = false): void {
  const open = chaptersOpen();
  let page = fresh ? 0 : (rooms.book?.page ?? 0) + by;
  if (page < 0) { if (logAt > 0) { logAt--; page = open[logAt].pages.length - 1; } else page = 0; }
  else if (page >= open[logAt].pages.length) { if (logAt + 1 < open.length) { logAt++; page = 0; } else { leavePool(); return; } }
  const c = open[logAt], last = page === c.pages.length - 1;
  rooms.book = { chapter: logAt === 0 ? 'the still pool' : `the still pool \u00b7 a world awake`, title: c.title, pages: c.pages, page, foot: !last ? 'tap, and it goes on' : logAt + 1 < open.length ? 'tap, for what came next' : 'tap, and the water stills' };
  $('logSaid').textContent = `${c.title}. ${c.pages[page].join(' ')}`;
  if (!fresh && audio.ctx) audio.hit('tap', 0.4);
}
$('logbook').addEventListener('click', (e) => {
  if (screen !== 'logbook') return;
  const id = rooms.hit(e.clientX, e.clientY);
  if (id === 'back') leavePool(); else if (id === 'next') turnLog(1); else if (id === 'prev') turnLog(-1);
});
// (the same credits in plain words, each in full, for anyone reading the page instead of looking at it)
$('creditsSaid').innerHTML = `<p>The songs, and who made them.</p>${manifest.tracks.map(() => '<p></p>').join('')}<p></p><p>No data is collected. <a href="${privacyUrl}" target="_blank" rel="noopener">Privacy policy</a></p>`;
manifest.tracks.forEach((t, i) => { $('creditsSaid').children[i + 1].textContent = creditLine(t); });
$('creditsSaid').children[manifest.tracks.length + 1].textContent = manifest.licenceNote;

// ------------------------------------------------------------------ wiring
$('pauseBtn').addEventListener('click', pause);
$('resumeBtn').addEventListener('click', resume);
$('pauseRestartBtn').addEventListener('click', () => startRun(-1, true));
$('pausePracticeBtn').addEventListener('click', () => { if (!run) return; const seg = run.level.segAt(Math.max(0, run.time)); practice = true; if (seg.t0 <= run.t0 + 0.01) startRun(); else startRun(seg.t0); });
$('pauseSkipBtn').addEventListener('click', () => { practice = true; startRun(buildStart()); });
$('pauseSettingsBtn').addEventListener('click', () => openSettings('pause'));
$('pauseQuitBtn').addEventListener('click', quit);
$('pauseSyncCal').addEventListener('click', () => { run?.stop(); run = null; openCalib(); });
$('tutorSkip').addEventListener('click', () => { run?.stop(); endTutorial(); });
$('settingsClose').addEventListener('click', closeSettings);
$('setMusic').addEventListener('input', (e) => { save.music = Number((e.target as HTMLInputElement).value); audio.setVolumes(save.music, save.sfx); showVolumes(); });
$('setSfx').addEventListener('input', (e) => { save.sfx = Number((e.target as HTMLInputElement).value); audio.setVolumes(save.music, save.sfx); audio.hit('impact', 0.6); showVolumes(); });
$('setHit').addEventListener('input', (e) => { save.hitVol = Number((e.target as HTMLInputElement).value); audio.hit('hit', save.hitVol); showVolumes(); });
for (const id of ['setMusic', 'setSfx', 'setHit']) $(id).addEventListener('change', persist); // saved as soon as the thread is let go
$('aoMinus').addEventListener('click', () => nudge('audioOffset', -5));
$('aoPlus').addEventListener('click', () => nudge('audioOffset', 5));
$('voMinus').addEventListener('click', () => nudge('visualOffset', -5));
$('voPlus').addEventListener('click', () => nudge('visualOffset', 5));
$('setMotion').addEventListener('click', () => toggle('reducedMotion'));
$('setFlash').addEventListener('click', () => toggle('reduceFlash'));
$('setTapLog').addEventListener('click', () => toggle('tapLog'));
$('setSync').addEventListener('click', () => toggle('syncOverlay'));
$('setUnlock').addEventListener('click', () => toggle('unlockAll'));
$('setHaptics').addEventListener('click', () => { toggle('haptics'); feel('big'); });
$('gcBtn').addEventListener('click', () => void gameCenter.show());
$('installBtn').addEventListener('click', () => { void installEvent?.prompt(); installEvent = null; renderSettings(); });
$('syncBtn').addEventListener('click', () => { audio.ensure(); audio.setVolumes(save.music, save.sfx); openCalib(); });
$('creditsBtn').addEventListener('click', openCredits);
$('storyBtn').addEventListener('click', () => openLogbook());
$('chambersBtn').addEventListener('click', () => openChambers());
$('chambersClose').addEventListener('click', () => closeChambers());
$('botBtn').addEventListener('click', () => { botMode = true; practice = false; session.far = session.onBeat = session.judged = session.streak = session.attempts = 0; session.drop = -1; startRun(); });
$('replayAmbush').addEventListener('click', () => startAmbush());
$('replayMemory').addEventListener('click', () => filmAgain(PACKS[0].level.id, () => { renderSettings(); show('settings'); }));
$('replayTutorial').addEventListener('click', () => { practice = false; botMode = false; dare = false; audio.ensure(); startOpening(true); });
$('recordBtn').addEventListener('click', () => { run?.stop(); run = null; audio.stopPreview(0.2); record.open(); });


const record = initRecord({
  pack: () => PACKS[levelIdx],
  show: (s) => { if (s === 'record') show('record'); else { renderSettings(); show('settings'); } },
  play: (from) => { botMode = false; practice = true; startRun(from); }
});
for (const p of PACKS) void refreshBars(p);

function tick(now: number): void {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (run && (screen === 'play' || screen === 'pause')) {
    run.frame(now);
    if (!run.opts.bot) for (const ev of run.events) {
      if (ev.kind === 'hop' || ev.kind === 'flip') feel(ev.smash || ev.sling ? 'big' : 'tap');
      else if (ev.kind === 'tick') feel('tap'); // gold along a hold: a light tick under the thumb
      else if (ev.kind === 'star') feel('win');
      else if (ev.kind === 'drop') feel('big');
      else if (ev.kind === 'crash') feel('crash');
      else if (ev.kind === 'finale') feel('win');
    }
    for (const ev of run.events) if (ev.kind === 'star') toast('a shard, in hand', true);
    if (run.finale && !starRun && wantsStar(run)) beginStar(run);
    // Helion's moment: his motif, from far away, on the riser bar (once per attempt, scheduled on the audio clock)
    if (helionCue && !helionCue.played && helionCue.track && audio.ctx && run.state === 'playing' && run.time >= helionCue.at - 0.3 && run.time < helionCue.at + 0.4) {
      if (helionCue.run !== run) { helionCue.run = run; }
      helionCue.played = true;
      audio.playPart(helionCue.track, helionCue.meta, audio.ctx.currentTime + Math.max(0, helionCue.at - run.time), 0, { gain: 0.9 });
    }
    if (helionCue && run.time < helionCue.at - 1 && helionCue.played) helionCue.played = false; // (an instant restart begins before it again)
    // the ambush: the music skips on the vents (scheduled on the audio clock just before each)
    if (run.pack === AMBUSH && audio.ctx && run.state === 'playing') {
      if (skips.run !== run) { skips.run = run; skips.done.clear(); }
      for (const p of run.course.presses) {
        if (p.pad !== 'vent') continue;
        const at = p.beat * run.level.spb;
        if (run.time < at - 1) skips.done.delete(p.beat);
        else if (!skips.done.has(p.beat) && run.time >= at - 0.25 && run.time < at) { skips.done.add(p.beat); audio.skip(audio.ctx.currentTime + (at - run.time) + 0.03, 0.09); }
      }
    }
    // an ember catches as he passes: a soft chime, two notes
    if (run.state === 'playing' && emberLit + 1 < emberBeats.length && run.time >= emberBeats[emberLit + 1] * run.level.spb) { emberLit++; audio.pluck(76, 0.32); window.setTimeout(() => audio.pluck(83, 0.22), 90); }
    renderer.draw(run, now, dt);
    renderer.drawIntro(now);
    if (renderer.meet && run.time < 0.4) renderer.drawMeet(run.time, now);
    if (skyStar.on) { skyStar.draw(now, dt); if (!run || screen !== 'play') return; } // (its end hands the picture on to the Landing, this frame)
    if (opening.state === 'bloom') opening.drawOver(now); // the first tap's bloom, lifting off the game
    $('hud').classList.toggle('veiled', (opening.state === 'bloom' && opening.cover > 0.35) || !!starRun);
    // paused, the scene dims and softens like a held breath; it comes back a little faster than it went
    held = Math.max(0, Math.min(1, held + (screen === 'pause' ? dt / 0.45 : -dt / 0.22)));
    if (held > 0) rooms.hold(held * held * (3 - 2 * held));
    updateHud(run);
  } else {
    audio.tick(now);
    const room = ROOM_OF[screen];
    if (screen === 'calib') { calTick(); rooms.sync = calView(now); }
    if (room) rooms.draw(room, now);
    else if (screen === 'prologue') {
      // (the level behind the first tap is drawn once, under the scene, at a moment the picture is dark: whatever its first frame costs is spent here, not on the tap)
      if (armedRun && opening.armed && !warmed && opening.dark) { warmed = true; renderer.reset(); renderer.backdrop = sceneFor(pack); renderer.planet = worldFor(pack); renderer.draw(armedRun, now, 0.016); }
      if (opening.state === 'bloom') { sky.draw(now, dt); opening.drawOver(now); } else opening.draw(now);
    }
    else if (screen === 'cold') coldScene.draw(now);
    else if (screen === 'levels') sky.draw(now, dt);
    else if (screen === 'story') skyStory.draw(now);
    else if (screen === 'moment') moment.draw(now);
    else if (screen === 'results') skyResult.draw(now, dt);
    else if (screen === 'title' && memoryFilm.on) memoryFilm.draw(now);
    else if (screen === 'title') { if (warmMap && !landing.between) { warmMap = false; renderMap(); sky.draw(now, 0); } if (landing.between) sky.draw(now, dt); landing.draw(now, dt); } // rising, the galaxy shows through
    else renderer.drawIdle(now, dt);
    if (screen === 'record') record.tick(now);
  }
}
// ------------------------------------------------------------------ the phone check (?phonecheck)
// A tap at the title autoplays Emberwick from two bars before its drop to its end (the busiest stretch of the first ten
// minutes), recording every frame: the time between frames, and the time the game's own work took. The numbers are
// shown on the screen and sent to the server this page came from (frames-phone.log), so they can be read on the Mac.
const phoneCheck = /[?&#]phonecheck\b/.test(location.search + location.hash);
const frameLog = { dt: [] as number[], work: [] as number[], beat: [] as number[], last: 0, sent: false };
// Every scene in turn (the performance pass of 2026-11-25): each world's drop played by itself (from two bars before it,
// 16 s into it), the cold open's strike and struggle, and the Landing; then one report, sent to the Mac.
const phone = { step: -1, at: 0, scenes: [] as Array<Record<string, unknown>> };
const PHONE_LEVELS = (): LevelPack[] => [FIRST, ...PACKS];
function startPhoneCheck(): void { phone.step = -1; phone.scenes = []; nextPhone(); }
function phoneStats(name: string): void {
  const q = (a: number[], k: number) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * k))].toFixed(1) : 0; };
  const d = frameLog.dt, w = frameLog.work;
  phone.scenes.push({ name, frames: d.length, avg: d.length ? +(d.reduce((x, y) => x + y, 0) / d.length).toFixed(2) : 0, p95: q(d, 0.95), p99: q(d, 0.99), worst: q(d, 1), over17: d.filter((x) => x > 17).length, over34: d.filter((x) => x > 34).length, workP99: q(w, 0.99), workWorst: q(w, 1) });
}
function nextPhone(): void {
  phone.step++; phone.at = performance.now(); frameLog.dt = []; frameLog.work = []; frameLog.beat = []; frameLog.last = 0;
  const L = PHONE_LEVELS();
  if (phone.step < L.length) { pack = L[phone.step]; botMode = true; practice = false; dare = false; startRun(Math.max(0, pack.audio.dropTime - pack.audio.offset - (2 * 4 * 60) / pack.audio.bpm)); return; }
  run?.stop(); run = null;
  if (phone.step === L.length) { startCold(); coldScene.press(true, 10, 400); coldScene.press(false); window.setTimeout(() => { coldScene.seek(13.5); coldScene.idleAfter = 0.6; }, 600); return; }
  if (phone.step === L.length + 1) { coldScene.stop(); toLanding(); return; }
  sendFrames();
}
function phoneTick(now: number, work: number): void {
  if (phone.step < 0 || frameLog.sent) return;
  const L = PHONE_LEVELS(), lvl = phone.step < L.length;
  // (a level's frames count from its drop; the scenes', from their start)
  const counting = lvl ? !!run && run.state === 'playing' && run.time >= run.level.dropTime : now - phone.at > 800;
  if (counting) { if (frameLog.last) { frameLog.dt.push(now - frameLog.last); frameLog.work.push(work); } frameLog.last = now; } else frameLog.last = 0;
  const long = lvl ? !!run && run.time >= run.level.dropTime + 16 : now - phone.at > (phone.step === L.length ? 12000 : 8000);
  if (long) { phoneStats(lvl ? `${placeName(L[phone.step])}, the drop` : phone.step === L.length ? 'the cold open, the strike and the struggle' : 'the Landing'); nextPhone(); }
}
function sendFrames(): void {
  if (frameLog.sent) return;
  frameLog.sent = true;
  const out = { when: new Date().toISOString(), ua: navigator.userAgent, screen: `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio}`, scenes: phone.scenes };
  const worst = phone.scenes.reduce((m, s) => Math.max(m, Number(s.worst) || 0), 0);
  const line = `${phone.scenes.length} scenes; worst frame ${worst} ms; ${phone.scenes.map((s) => `${s.name}: avg ${s.avg}, worst ${s.worst}`).join(' · ')}`;
  console.log(`[one more orbit] phone check: ${line}`);
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:18px;z-index:99;font:13px/1.4 system-ui;color:#fff;background:rgba(0,0,0,.78);padding:10px 12px;border-radius:8px';
  el.textContent = `${line}. Sending…`;
  document.body.appendChild(el);
  void fetch('./__frames', { method: 'POST', body: JSON.stringify(out) }).then((res) => { el.textContent = `${line}. ${res.ok ? 'Sent to the Mac.' : 'Could not send.'}`; }, () => { el.textContent = `${line}. Could not send.`; });
}
function loop(now: number): void {
  const t0 = performance.now();
  tick(now);
  if (phoneCheck) phoneTick(now, performance.now() - t0);
  requestAnimationFrame(loop);
}

// The App Store build: full screen, and Game Center gets everything already earned on this device.
fullScreen();
void gameCenter.signIn().then((ok) => {
  if (!ok) return;
  for (const [id, b] of Object.entries(save.bests)) if (b.pct > 0 && PACKS.some((p) => p.level.id === id)) gameCenter.best(id, b.pct);
  for (const id of Object.keys(save.badges)) if (save.badges[id] && id !== `clear_${FINAL_ID}` && !/^(tune|mender)_/.test(id)) gameCenter.badge(id);
});
// The website keeps a copy of itself, so it opens with no connection after the first visit.
if (import.meta.env.PROD && import.meta.env.MODE !== 'single' && !isNative && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js').catch(() => undefined); });
}

for (const f of ['500 20px "Cormorant SC"', 'italic 500 18px "Cormorant Garamond"', '500 18px "Cormorant Lining"']) void document.fonts?.load(f); // the words are lettered on a canvas: have the type ready
document.body.classList.add('boot');
// a first launch is the opening, not a title screen (the title comes after the first star is awake, and on later launches)
const asked = (k: string) => new RegExp(`[?&#]${k}\\b`).test(location.search + location.hash);
if (phoneCheck) toTitle();
else if (asked('cold') || ((asked('fresh') || (!save.story.prologue && !save.story.open)) && !asked('opening'))) startCold();
else if (!save.story.prologue && !save.story.open || asked('opening')) startOpening(asked('opening') && !!save.story.prologue); else toTitle();
if (/[?&#]chambers\b/.test(location.search + location.hash)) openChambers();
window.setTimeout(() => document.body.classList.remove('boot'), 400);
requestAnimationFrame(loop);

// Hooks for tests and debugging; the game itself never reads these.
Object.assign(window, {
  __omo: {
    audio, save, renderer, sky, skyResult, rooms, session, sync, cal, get run() { return run; }, get screen() { return screen; }, tick, show,
    art: { K: PK, parts: PCANON.parts, cold: PCOLD, landing: LANDING, worlds: PWORLDS }, // (for the frame profiler: tools/frameprof)
    level: (i: number) => focusLevel(i), select: (id: string) => select(id, true),
    start: (bot: boolean, prac = false, from = -1, daring = false) => { botMode = bot; practice = prac; dare = daring; startRun(from); },
    story: (k: string) => playStory(k, () => show('levels'), true),
    chambers: () => openChambers(), chamber: (id: string, bot = false) => { const c = CHAMBERS.find((x) => x.id === id); if (c) startChamber(c, bot); }, get room() { return chamber; },
    tutorial: startTutorial, results: (cleared: boolean) => { if (run) showResults(run, cleared, run.pct); }, pause,
    opening, startOpening, startCold, coldScene, landing, skyStar, toTitle, toLanding, ambush: (bot = false, from = -1) => { ambushThen = null; pack = AMBUSH; practice = dare = false; chamber = null; botMode = bot; ambushWorld.askAhead(); startRun(from); }, first: (bot = false, from = -1) => { botMode = bot; practice = false; pack = FIRST; startRun(from); }, moment: (k: 'gift' | 'road', stars = 1) => { moment.play(k, 'heroes', stars, () => show('levels')); show('moment'); }, memory: (w = 'heroes') => filmAgain(w, () => show('levels')), memoryFilm, firstClear: (w = 'heroes') => firstClear(w, () => show('levels')), logbook: openLogbook, orbs: openGlows, stars: openStars, credits: openCredits, sync10: () => openCalib(), calTap, settings: () => openSettings('levels')
  }
});
