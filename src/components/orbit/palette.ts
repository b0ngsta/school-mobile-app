// Colours of the night-sky home screen. The home is always this dark scene
// (whatever the role theme), so these are fixed values, not theme colours.

export const HOME = {
  /** Top of the sky — also painted behind the status bar while home shows. */
  skyTop: '#05051A',
  /** Foreground ground colour — painted behind the Android nav bar on home. */
  ground: '#0F0A26',
  /** Fallback behind the sky picture. */
  night: '#28163E',
  ink: '#F3F0FF',
  sub: 'rgba(232,228,255,0.8)',
  faint: 'rgba(214,208,255,0.7)',
  glass: 'rgba(20,16,54,0.7)',
  glassStrong: 'rgba(18,14,48,0.8)',
  glassLine: 'rgba(168,156,255,0.28)',
  railButton: 'rgba(16,12,44,0.86)',
  railLine: 'rgba(172,162,255,0.5)',
  mint: '#4DF7B8',
  mintLine: '#2EF0A8',
  amber: '#FFB547',
  amberText: '#FFD08A',
  lilac: '#9C8CFF',
  lilacText: '#D6CEFF',
  rose: '#FF8FA3',
  gold: '#FFD36B',
} as const;

export interface Neon {
  /** main colour */
  c: string;
  /** light tint (labels, highlights) */
  l: string;
  /** deep shade (gradient edge) */
  d: string;
}

/** Item colours, cycled around the orbit. */
export const NEON: readonly Neon[] = [
  { c: '#FF4F7B', l: '#FFA6BD', d: '#B0164A' }, // pink
  { c: '#9B5CFF', l: '#CDAEFF', d: '#5420C4' }, // violet
  { c: '#2F9BFF', l: '#9AD1FF', d: '#1452B5' }, // blue
  { c: '#1FCB85', l: '#86F2C4', d: '#0A7549' }, // green
  { c: '#FF8A3D', l: '#FFC6A0', d: '#BF4D16' }, // orange
  { c: '#17C6D4', l: '#8DF0F7', d: '#0A7884' }, // cyan
  { c: '#F2BE2A', l: '#FFE38F', d: '#A47806' }, // gold
  { c: '#E04BD8', l: '#F6A9F1', d: '#8A1D85' }, // magenta
  { c: '#5079FF', l: '#AEC2FF', d: '#2140B5' }, // indigo
];

/** Colour of item `i` in a list of `count` — neighbours (incl. last → first) never match. */
export function neonFor(i: number, count: number): Neon {
  const k = NEON.length;
  if (count > 1 && i === count - 1 && (count - 1) % k === 0) return NEON[4];
  return NEON[((i % k) + k) % k];
}

/** "#RRGGBB" + alpha → "rgba(r,g,b,a)". */
export function alpha(hex: string, a: number): string {
  const channel = (i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgba(${channel(0)},${channel(1)},${channel(2)},${a})`;
}
