// Drawn parts of the front end: the icon set and each level's card artwork.
// Every level has its own composition, built round its signature mode; none is a recolour of another.

const ICONS: Record<string, string> = {
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  orb: '<circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-25 12 12)"/>',
  badge: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
  // a lens shard (the key keeps its old name: it is what the stars became)
  star: '<path d="M12.6 2.2l6.6 9-4.4 10.6L4.8 14.9z"/>',
  quest: '<path d="M12 2.8l8 9.2-8 9.2-8-9.2z"/><path d="M12 8.2l3.3 3.8-3.3 3.8-3.3-3.8z"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  back: '<path d="M11 5l-7 7 7 7M4 12h16"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  restart: '<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5"/>',
  flag: '<path d="M6 21V4M6 5h11l-2.5 4L17 13H6"/>',
  exit: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  sync: '<path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6M18 3v4h-4M6 21v-4h4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  skip: '<path d="M5 5l9 7-9 7zM18 5v14"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3.5 3.5 0 0 0 3.6 3.6M16 6h3.5a3.5 3.5 0 0 1-3.6 3.6M12 13v4M8.5 20h7M10 17h4"/>'
};

export const icon = (name: string) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;

const bars = (cx: number, cy: number, r: number, n: number, col: string, len = 22, w = 3) => {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const l = 6 + len * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6));
    out += `<line x1="${(cx + Math.cos(a) * r).toFixed(1)}" y1="${(cy + Math.sin(a) * r).toFixed(1)}" x2="${(cx + Math.cos(a) * (r + l)).toFixed(1)}" y2="${(cy + Math.sin(a) * (r + l)).toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  }
  return out;
};
const stars = (n: number, col: string) => {
  let out = '';
  for (let i = 0; i < n; i++) out += `<circle cx="${((i * 73.7) % 400).toFixed(0)}" cy="${((i * 41.3 + (i % 7) * 23) % 300).toFixed(0)}" r="${0.7 + (i % 3) * 0.5}" fill="${col}" opacity="${0.25 + (i % 4) * 0.12}"/>`;
  return out;
};
const ball = (x: number, y: number, col: string, r = 9) => `<circle cx="${x}" cy="${y}" r="${r + 5}" fill="#03050e" opacity=".55"/><circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${col}" stroke-width="3.5"/>`;
const mark = (x: number, y: number, a: number, len = 13) => `<line x1="${(x - Math.cos(a) * len).toFixed(1)}" y1="${(y - Math.sin(a) * len).toFixed(1)}" x2="${(x + Math.cos(a) * len).toFixed(1)}" y2="${(y + Math.sin(a) * len).toFixed(1)}" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`;
const wrap = (inner: string, bg: string) => `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="300" fill="${bg}"/>${inner}</svg>`;

/** Heroes Tonight: planet hop. Three planets at different sizes, and a dotted cyan arc carrying the ball between them. */
function heroes(): string {
  const planet = (x: number, y: number, r: number, ring: string, core: string, eq = false) =>
    `<circle cx="${x}" cy="${y}" r="${r * 1.75}" fill="none" stroke="${ring}" stroke-opacity=".18" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${r * 1.38}" fill="none" stroke="${ring}" stroke-opacity=".4" stroke-width="2.5"/>` +
    `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#e2eaff" stroke-width="4"/>${eq ? bars(x, y, r * 0.3, 26, core, r * 0.26, 2.6) : ''}<circle cx="${x}" cy="${y}" r="${r * 0.24}" fill="${core}"/>`;
  return wrap(
    `<radialGradient id="h1" cx="28%" cy="68%" r="80%"><stop offset="0" stop-color="#6b2a3a"/><stop offset="1" stop-color="#1a0a18"/></radialGradient><rect width="400" height="300" fill="url(#h1)"/>${stars(26, '#ffd6a0')}` +
    planet(108, 196, 62, '#ff966e', '#ffb37a', true) + planet(262, 92, 40, '#ffd6a0', '#ffd6a0') + planet(348, 214, 24, '#ff966e', '#ff7d6e') +
    `<path d="M150 150 Q200 60 232 70" fill="none" stroke="#19e3ff" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 10"/><path d="M296 112 Q338 130 344 186" fill="none" stroke="#19e3ff" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 10" opacity=".7"/>` +
    `<path d="M180 96l10-13 7 15" fill="none" stroke="#19e3ff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` + mark(152, 152, -0.8) + ball(200, 84, '#19e3ff'),
    '#1a0a18'
  );
}

/** Sky High: weave. Two rings, and the ball's path zig-zagging between them all the way round, flipping at each violet patch. */
function skyhigh(): string {
  const cx = 200, cy = 152, r1 = 58, r2 = 104, n = 12;
  let zig = '';
  let patches = '';
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const r = i % 2 ? r2 - 5 : r1 + 5;
    zig += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
    const rr = i % 2 ? r2 : r1;
    patches += `<path d="M${(cx + Math.cos(a - 0.13) * rr).toFixed(1)} ${(cy + Math.sin(a - 0.13) * rr).toFixed(1)}A${rr} ${rr} 0 0 1 ${(cx + Math.cos(a + 0.13) * rr).toFixed(1)} ${(cy + Math.sin(a + 0.13) * rr).toFixed(1)}" fill="none" stroke="#b47bff" stroke-width="8" stroke-linecap="round"/>`;
  }
  const a = -Math.PI / 2 + (2.5 / n) * Math.PI * 2;
  return wrap(
    `<radialGradient id="s1" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="#4a1466"/><stop offset="1" stop-color="#12061f"/></radialGradient><rect width="400" height="300" fill="url(#s1)"/>${stars(22, '#ff9af0')}` +
    `<circle cx="${cx}" cy="${cy}" r="${r2 + 34}" fill="none" stroke="#ff46d2" stroke-opacity=".16" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${r2}" fill="none" stroke="#e2eaff" stroke-width="4"/><circle cx="${cx}" cy="${cy}" r="${r1}" fill="none" stroke="#e2eaff" stroke-width="4"/>` +
    `<path d="${zig}" fill="none" stroke="#19e3ff" stroke-width="3" stroke-linejoin="round" stroke-dasharray="1 8" stroke-linecap="round"/>${patches}${bars(cx, cy, 20, 30, '#ff46d2', 20, 3)}<circle cx="${cx}" cy="${cy}" r="16" fill="#ff46d2"/>` +
    ball(cx + Math.cos(a) * 81, cy + Math.sin(a) * 81, '#19e3ff'),
    '#12061f'
  );
}

/** Blank: spin gates. Off-centre, cropped close: turning rings with one gap each, arrows showing the turn, the ball lining up with the gap. */
function blank(): string {
  const cx = 130, cy = 190;
  const gate = (r: number, gap: number, width: number, op: number) => {
    const a0 = gap + 0.3, a1 = gap - 0.3 + Math.PI * 2;
    const p = (a: number) => `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
    return `<path d="M${p(a0)}A${r} ${r} 0 1 1 ${p(a1)}" fill="none" stroke="#ff4078" stroke-width="${width + 3}" opacity="${op}"/><path d="M${p(a0)}A${r} ${r} 0 1 1 ${p(a1)}" fill="none" stroke="#fff" stroke-width="${width - 1.5}" opacity="${op}"/><circle cx="${p(a0).split(' ')[0]}" cy="${p(a0).split(' ')[1]}" r="4.5" fill="#fff" opacity="${op}"/><circle cx="${p(a1).split(' ')[0]}" cy="${p(a1).split(' ')[1]}" r="4.5" fill="#fff" opacity="${op}"/>`;
  };
  return wrap(
    `<linearGradient id="b1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c2f52"/><stop offset="1" stop-color="#060912"/></linearGradient><rect width="400" height="300" fill="url(#b1)"/>${stars(18, '#c8e1ff')}` +
    `<circle cx="${cx}" cy="${cy}" r="70" fill="none" stroke="#e2eaff" stroke-width="4"/>${gate(112, -0.75, 5, 1)}${gate(164, -0.2, 4.5, 0.55)}${gate(222, 0.25, 4, 0.28)}` +
    `<path d="M250 44l16 14-16 14M278 44l16 14-16 14M306 44l16 14-16 14" fill="none" stroke="#19e3ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M300 232a122 122 0 0 0 28-58" fill="none" stroke="#c8e1ff" stroke-width="3" stroke-linecap="round" opacity=".7"/><path d="M322 190l7-17 9 15" fill="none" stroke="#c8e1ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>` +
    `${bars(cx, cy, 22, 28, '#8fb4ff', 22, 3)}<circle cx="${cx}" cy="${cy}" r="18" fill="#c8e1ff"/>` + mark(cx + Math.cos(-0.75) * 70, cy + Math.sin(-0.75) * 70, -0.75) + ball(cx + Math.cos(-1.02) * 82, cy + Math.sin(-1.02) * 82, '#19e3ff'),
    '#060912'
  );
}

/** Invincible: twin orbit. A mirrored composition split down the middle: two balls, two colours, marks answering each other across the line. */
function invincible(): string {
  const cx = 200, cy = 150;
  const side = (flip: number, col: string) => {
    let m = '';
    for (const a of [-1.15, -0.35, 0.5]) m += mark(cx + flip * Math.cos(a) * 96, cy + Math.sin(a) * 96, Math.atan2(Math.sin(a), flip * Math.cos(a)));
    return `<path d="M${cx} ${cy - 96}A96 96 0 0 ${flip > 0 ? 1 : 0} ${cx} ${cy + 96}" fill="none" stroke="#e2eaff" stroke-width="4"/><path d="M${cx} ${cy - 132}A132 132 0 0 ${flip > 0 ? 1 : 0} ${cx} ${cy + 132}" fill="none" stroke="${col}" stroke-opacity=".5" stroke-width="2.5" stroke-dasharray="26 12"/>${m}` +
      ball(cx + flip * Math.cos(-0.78) * 108, cy + Math.sin(-0.78) * 108, col, 10);
  };
  let rays = '';
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.26; rays += `<path d="M${cx} ${cy}L${(cx + Math.cos(a - 0.07) * 320).toFixed(0)} ${(cy + Math.sin(a - 0.07) * 320).toFixed(0)}L${(cx + Math.cos(a + 0.07) * 320).toFixed(0)} ${(cy + Math.sin(a + 0.07) * 320).toFixed(0)}Z" fill="#ffd65a" opacity=".06"/>`; }
  return wrap(
    `<radialGradient id="i1" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#2a3a0c"/><stop offset=".6" stop-color="#0c1206"/><stop offset="1" stop-color="#040503"/></radialGradient><rect width="400" height="300" fill="url(#i1)"/>${rays}` +
    `<line x1="${cx}" y1="0" x2="${cx}" y2="300" stroke="#ffd65a" stroke-width="2" stroke-dasharray="3 9" opacity=".7"/>` + side(1, '#19e3ff') + side(-1, '#b47bff') +
    `${bars(cx, cy, 24, 32, '#96ff3c', 26, 3)}<circle cx="${cx}" cy="${cy}" r="20" fill="#ffd65a"/><circle cx="${cx}" cy="${cy}" r="170" fill="none" stroke="#ffd65a" stroke-opacity=".35" stroke-width="2"/>`,
    '#040503'
  );
}

/** The gate at the end of the world: a black disc in a tilted ring of light, pulling a few stars toward it. */
function gate(): string {
  const cx = 200, cy = 150;
  let pulled = '';
  for (let i = 0; i < 16; i++) { const a = i * 2.4; const d = 70 + ((i * 37) % 150); pulled += `<line x1="${(cx + Math.cos(a) * d).toFixed(0)}" y1="${(cy + Math.sin(a) * d * 0.7).toFixed(0)}" x2="${(cx + Math.cos(a + 0.12) * (d - 16)).toFixed(0)}" y2="${(cy + Math.sin(a + 0.12) * (d - 16) * 0.7).toFixed(0)}" stroke="#ffd0e0" stroke-width="1.6" stroke-linecap="round" opacity="${(0.25 + (i % 4) * 0.12).toFixed(2)}"/>`; }
  return wrap(
    `<radialGradient id="g1" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#3a0d2a"/><stop offset=".55" stop-color="#12061a"/><stop offset="1" stop-color="#040208"/></radialGradient><rect width="400" height="300" fill="url(#g1)"/>${stars(20, '#ff9ac0')}${pulled}` +
    `<ellipse cx="${cx}" cy="${cy}" rx="150" ry="40" fill="none" stroke="#ff3d8b" stroke-opacity=".25" stroke-width="3" transform="rotate(-14 ${cx} ${cy})"/><ellipse cx="${cx}" cy="${cy}" rx="112" ry="29" fill="none" stroke="#ff3d8b" stroke-opacity=".6" stroke-width="5" transform="rotate(-14 ${cx} ${cy})"/>` +
    `<circle cx="${cx}" cy="${cy}" r="52" fill="#020208" stroke="#ff3d8b" stroke-width="4"/><path d="M${cx - 108} ${cy + 27}A112 29 -14 0 0 ${cx + 108} ${cy - 27}" fill="none" stroke="#ff7fb0" stroke-width="5" stroke-linecap="round" transform="rotate(0)"/>`,
    '#040208'
  );
}

export function levelArt(id: string): string {
  return id === 'heroes' ? heroes() : id === 'skyhigh' ? skyhigh() : id === 'blank' ? blank() : id === 'invincible' ? invincible() : id === 'gate' || id === 'royalty' ? gate() : wrap('', '#0d1022');
}

/** Each level's colour for its card details (difficulty dots, Best bar) and where its song preview starts. */
export const LEVEL_UI: Record<string, { col: string; dots: number }> = {
  heroes: { col: '#ffb37a', dots: 1 }, skyhigh: { col: '#ff6fe0', dots: 2 }, blank: { col: '#9fc4ff', dots: 3 }, invincible: { col: '#a8ff5a', dots: 5 }, royalty: { col: '#ff3d8b', dots: 5 }
};
