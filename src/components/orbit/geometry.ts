// Geometry of the home screen's orbit menu (pure functions, no React).
//
// The menu is ONE path, mirror-symmetric about the Earth's horizontal centre
// line (y = cy):
//
//        │  top rail (x = railX), runs up past the screen top
//        ╰─╮ fillet (radius f)
//           ╲  arc of radius r round the left of the Earth (through 180°)
//           ╱
//        ╭─╯ fillet (mirror)
//        │  bottom rail, runs down past the screen bottom
//
// The Earth and the curved part of this line are ONE baked picture
// (assets/home/orbit_scene.webp, made by tools/earth/render.py — keep the
// shape constants below in sync with it); the app only adds the two rails.
//
// Every screen of the role is a CHECKPOINT riding the path. `progress` (dp
// along the path) is how far the list has moved; checkpoint j sits at
// mod(progress + j·step, cycle). Positions past the path's end are a hidden
// stretch, so a checkpoint leaving at the bottom comes back in at the top: an
// endless loop. Each screen has exactly ONE checkpoint (`slots` = count) and
// the loop is never shorter than the path, so no screen is ever on it twice;
// a short list just spreads out, a long one waits on the hidden stretch.

export const mod = (a: number, m: number): number => ((a % m) + m) % m;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const RAD = Math.PI / 180;

// ---- shape (dp at s = 1; the curve and the Earth are baked — see render.py) ----
const EARTH_R = 116;
/** arc radius / Earth radius */
const PATH_R = 1.38;
/** fillet radius / arc radius */
const FILLET = 0.45;
/** the rails sit this far in from the right edge, the Earth's centre this far */
const RAIL_IN = 46;
const EARTH_IN = 72;
/** orbit_scene.webp's box around the Earth's centre, in Earth radii */
export const SCENE_BOX = { left: 1.62, right: 0.64, halfHeight: 2 } as const;

/** Height kept free at the top-left for the greeting + today panel (dp, at font scale 1). */
export const HEADER_H = 240;
/** Least space between neighbouring checkpoints (dp at s = 1). */
const MIN_STEP = 112;
/** Scroll room on each side of the start, in steps — far more than anyone will ever flick. */
const SCROLL_STEPS = 2000;

export interface OrbitLayout {
  width: number;
  height: number;
  /** x of the two straight rails */
  railX: number;
  /** Earth centre and radius */
  cx: number;
  cy: number;
  R: number;
  /** radius of the arc round the Earth */
  r: number;
  /** checkpoint icon diameter / gap to its label card / label card width */
  node: number;
  gap: number;
  cardMax: number;
  /** room the header keeps free on the right for the top rail's checkpoints */
  headerGutter: number;
  /** dp between neighbouring checkpoints */
  step: number;
  /** checkpoints on the loop (one per screen) and the list length */
  slots: number;
  count: number;
  /** loop length (≥ path length) */
  cycle: number;
  /** path length; [length, cycle) is the hidden stretch */
  length: number;
  /** path position of the arc's left-most point (where a checkpoint comes to rest) */
  focus: number;
  /** where the top rail ends / the bottom rail starts (y) */
  railTopEnd: number;
  railBottomStart: number;
  /** path samples: position → point */
  ss: number[];
  xs: number[];
  ys: number[];
  /** progress that puts item 0 on the first stop at the top */
  home: number;
  /** the menu ScrollView's offset at `home`, and its content height */
  scrollStart: number;
  scrollHeight: number;
}

/**
 * Lay the path out in an area of `width` × `height` (dp) for a list of
 * `count` checkpoints. `headerH` is the height the header keeps at the top.
 */
export function orbitLayout(width: number, height: number, count: number, headerH = HEADER_H): OrbitLayout {
  const s = clamp(Math.min(width / 390, height / 760), 0.78, 1.15);
  // Checkpoint icon: 52 dp (was 46 — too small to read on phones, Oct 2026).
  const node = Math.round(52 * Math.min(1, s));
  const gap = 8;
  const R = EARTH_R * s;
  const r = R * PATH_R;
  const f = r * FILLET;
  const railX = width - RAIL_IN * s;
  const cx = width - EARTH_IN * s;

  // Fillet: centre (railX - f, yF), touching the rail at (railX, yF) and the
  // arc's circle from outside, so |F - C| = r + f.
  const h = Math.sqrt((r + f) ** 2 - (cx - railX + f) ** 2); // cy - yF
  // The top fillet starts below the header, so no label card slides under it.
  const cy = Math.max(height * 0.57, headerH + node / 2 - 30 + h);
  const yF = cy - h;
  const Fx = railX - f;
  const phiT = Math.atan2(h, cx - Fx); // fillet end, seen from its centre
  const thetaT = Math.atan2(-h, Fx - cx) + 2 * Math.PI; // the same point seen from the Earth (≈ 258°)
  const yTop = Math.min(-node - 12, 2 * cy - height - node - 12); // both ends off screen

  const xs: number[] = [];
  const ys: number[] = [];
  const push = (x: number, y: number) => {
    xs.push(x);
    ys.push(y);
  };
  push(railX, yTop);
  const nf = Math.max(4, Math.ceil(phiT / RAD / 8));
  for (let i = 0; i <= nf; i++) push(Fx + f * Math.cos((phiT * i) / nf), yF + f * Math.sin((phiT * i) / nf));
  const na = 2 * Math.ceil((thetaT - Math.PI) / RAD / 5); // even, so a sample lands exactly on 180°
  for (let i = 1; i <= na; i++) {
    const t = thetaT - ((2 * thetaT - 2 * Math.PI) * i) / na;
    push(cx + r * Math.cos(t), cy + r * Math.sin(t));
  }
  for (let i = nf - 1; i >= 0; i--) push(Fx + f * Math.cos((phiT * i) / nf), 2 * cy - yF - f * Math.sin((phiT * i) / nf));
  push(railX, 2 * cy - yTop);

  const ss: number[] = [0];
  for (let i = 1; i < xs.length; i++) ss.push(ss[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
  const length = ss[ss.length - 1];
  const focus = ss[nf + 1 + na / 2];

  // One checkpoint per screen, at least MIN_STEP apart (≤ 9 on a phone screen);
  // a short list spreads over the whole path. cycle ≥ length keeps every
  // screen on the path at most once.
  const n = Math.max(1, count);
  const step = Math.max(MIN_STEP * s, length / n);
  const cycle = Math.max(length, n * step);

  // Label card width (every card is this wide): as wide as fits left of the
  // arc's left-most checkpoint, keeping 4 dp to the screen edge.
  const cardMax = Math.floor(clamp(cx - r - node / 2 - gap - 4, 84, 132 * s));
  const headerGutter = Math.ceil(width - (railX - node / 2 - gap - cardMax) + 6);

  // Item 0 on the first stop that is fully on screen (the one before it may
  // peek in at the top edge — a hint that the list loops).
  const firstVisible = -yTop + node / 2 + 2;
  const home = focus - Math.floor((focus - firstVisible) / step) * step;
  const scrollStart = SCROLL_STEPS * step;

  return {
    width, height, railX, cx, cy, R, r, node, gap, cardMax, headerGutter,
    step, slots: Math.max(0, count), count, cycle, length, focus,
    railTopEnd: yF, railBottomStart: 2 * cy - yF,
    ss, xs, ys, home, scrollStart, scrollHeight: 2 * scrollStart + height,
  };
}

/**
 * Menu progress for the menu ScrollView's offset. Dragging the finger down
 * scrolls up (the offset falls) and the checkpoints follow the finger down
 * the path; offsets snapped to multiples of `step` rest a checkpoint on the
 * arc's left-most point.
 */
export const progressAt = (L: OrbitLayout, scrollY: number): number => L.home + L.scrollStart - scrollY;

/** Path position of checkpoint `j`, in [0, cycle). */
export const slotPos = (L: OrbitLayout, j: number, progress: number): number => mod(progress + j * L.step, L.cycle);

/** List index shown by checkpoint `j` (the list repeats round the loop). */
export const slotItem = (L: OrbitLayout, j: number): number => (L.count > 0 ? j % L.count : 0);

/** Point on the path at position `s`, or null on the hidden stretch. */
export function pathPoint(L: OrbitLayout, s: number): { x: number; y: number } | null {
  if (s < 0 || s > L.length) return null;
  const { ss, xs, ys } = L;
  let lo = 0;
  let hi = ss.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ss[mid] <= s) lo = mid;
    else hi = mid;
  }
  const k = (s - ss[lo]) / (ss[hi] - ss[lo] || 1);
  return { x: xs[lo] + (xs[hi] - xs[lo]) * k, y: ys[lo] + (ys[hi] - ys[lo]) * k };
}

/** Where checkpoint `j` is, or null when it is off screen / hidden. */
export function slotPoint(L: OrbitLayout, j: number, progress: number): { x: number; y: number } | null {
  const p = pathPoint(L, slotPos(L, j, progress));
  if (!p) return null;
  return p.y < -L.node / 4 || p.y > L.height + L.node / 4 ? null : p;
}

/** Native-driver interpolation tables, path position → x / y (the hidden stretch parks off screen). */
export function pathTables(L: OrbitLayout): { input: number[]; x: number[]; y: number[] } {
  const input = [...L.ss];
  const x = [...L.xs];
  const y = [...L.ys];
  if (L.cycle > L.length + 0.5) {
    const lastY = y[y.length - 1];
    input.push(L.length + 0.25, L.cycle);
    x.push(L.width + 200, L.width + 200);
    y.push(lastY, lastY);
  }
  return { input, x, y };
}

export type OrbitHit = { kind: 'item'; slot: number } | { kind: 'earth' } | null;

/**
 * What a tap at (x, y) landed on: a checkpoint on screen (its icon or its
 * label card), the Earth, or nothing. `cardWidths[j]` is the measured width
 * of checkpoint j's label card.
 */
export function hitTest(L: OrbitLayout, progress: number, x: number, y: number, cardWidths: readonly number[]): OrbitHit {
  let best: { slot: number; dist: number } | null = null;
  for (let j = 0; j < L.slots; j++) {
    const p = slotPoint(L, j, progress);
    if (!p) continue;
    const dist = Math.hypot(x - p.x, y - p.y);
    const right = p.x - L.node / 2 - L.gap + 4;
    const left = right - (cardWidths[j] || L.cardMax) - 6;
    const onIcon = dist <= L.node / 2 + 6;
    const onCard = x >= left && x <= right && Math.abs(y - p.y) <= L.node / 2 + 2;
    if ((onIcon || onCard) && (!best || dist < best.dist)) best = { slot: j, dist };
  }
  if (best) return { kind: 'item', slot: best.slot };
  if (Math.hypot(x - L.cx, y - L.cy) <= L.R) return { kind: 'earth' };
  return null;
}
