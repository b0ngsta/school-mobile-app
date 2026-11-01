// Design tokens with ROLE-BASED THEMES — "Option A" redesign.
//  student → violet · teacher → green · admin/principal/coordinator → blue
//  driver → amber
// If the backend sends `theme_color` at login, that color overrides the role
// theme (palette derived in 10% steps — see buildBrandTheme below).
// `applyRoleTheme(role, themeColor)` mutates the exported `colors` object, so read
// brand colors INLINE at render time (not inside StyleSheet.create).
import type { TextStyle, ViewStyle } from 'react-native';
import type { Role } from './types';

const BASE = {
  ink: '#171A26',
  subtle: '#7A8095',
  faint: '#A6ABBD',
  line: '#ECEDF3',
  page: '#F5F6FA',
  white: '#ffffff',
  ok: '#16A34A',
  okSoft: '#E8F7EE',
  warn: '#D97706',
  warnSoft: '#FCF2E3',
  info: '#0284C7',
  infoSoft: '#E5F3FB',
  danger: '#DC2640',
  dangerSoft: '#FDEBEE',
};

export interface RoleTheme {
  brand: string;
  brandDark: string;
  brandDeep: string;
  brandSoft: string;
  brandFaint: string;
  onBrandSub: string;
}

export const ROLE_THEMES: Record<Role | 'default', RoleTheme> = {
  student: { brand: '#5B3FD6', brandDark: '#4A30B8', brandDeep: '#3A2494', brandSoft: '#EEEAFB', brandFaint: '#F6F4FD', onBrandSub: '#CFC6F3' },
  teacher: { brand: '#0F9D58', brandDark: '#0C7F47', brandDeep: '#0A6238', brandSoft: '#E6F6EE', brandFaint: '#F3FBF6', onBrandSub: '#BBE7CF' },
  admin: { brand: '#2563EB', brandDark: '#1D4FC7', brandDeep: '#1A3FA0', brandSoft: '#E9EFFD', brandFaint: '#F4F7FE', onBrandSub: '#C2D4F9' },
  principal: { brand: '#1D4ED8', brandDark: '#1A40B4', brandDeep: '#173390', brandSoft: '#E9EFFD', brandFaint: '#F4F7FE', onBrandSub: '#C2D4F9' },
  sub_admin: { brand: '#2563EB', brandDark: '#1D4FC7', brandDeep: '#1A3FA0', brandSoft: '#E9EFFD', brandFaint: '#F4F7FE', onBrandSub: '#C2D4F9' },
  coordinator: { brand: '#0E7490', brandDark: '#0B5D74', brandDeep: '#094A5D', brandSoft: '#E4F3F7', brandFaint: '#F2F9FB', onBrandSub: '#B6DEE9' },
  driver: { brand: '#D97706', brandDark: '#B36205', brandDeep: '#8F4E04', brandSoft: '#FCF2E3', brandFaint: '#FDF8EF', onBrandSub: '#F4D6A8' },
  default: { brand: '#4F46E5', brandDark: '#4238C4', brandDeep: '#352CA0', brandSoft: '#ECEBFC', brandFaint: '#F5F5FE', onBrandSub: '#C9C6F5' },
};

export type ThemeColors = typeof BASE & RoleTheme;

// mutable palette — brand keys are swapped by applyRoleTheme()
export const colors: ThemeColors = { ...BASE, ...ROLE_THEMES.default };

/* ----------------------- dynamic (backend) brand color ---------------------- */
// The backend may send a single brand color at login (`theme_color`, e.g.
// "#BF40BF"). The full brand palette is derived from it in 10% steps:
//   brand       → the color itself
//   brandDark   → 10% darker (lightness −10)
//   brandDeep   → 20% darker (lightness −20)
//   onBrandSub  → 70% mixed toward white (muted text on brand backgrounds)
//   brandSoft   → 90% mixed toward white (chips, soft buttons, stat tiles)
//   brandFaint  → 95% mixed toward white (very light fills)
// These ratios match the hand-picked ROLE_THEMES above, so a backend color
// looks exactly as "native" as the built-in role themes.

const DARK_STEP = 10; // lightness points per step (out of 100)

interface Rgb { r: number; g: number; b: number }
interface Hsl { h: number; s: number; l: number }

/** Parse "#RRGGBB", "#RGB", "RRGGBB" or "RGB" (any case, surrounding spaces ok).
 *  Returns null for anything else so callers can fall back safely. */
function parseHex(input?: string | null): Rgb | null {
  if (typeof input !== 'string') return null;
  let hex = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function toHex({ r, g, b }: Rgb): string {
  const h = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = clamp(s, 0, 100) / 100, ln = clamp(l, 0, 100) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}

/** Mix a color toward white by `amount` (0 → unchanged, 1 → white). */
function tint(c: Rgb, amount: number): string {
  return toHex({ r: c.r + (255 - c.r) * amount, g: c.g + (255 - c.g) * amount, b: c.b + (255 - c.b) * amount });
}

/** WCAG relative luminance → contrast ratio against white. */
function contrastWithWhite({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return 1.05 / (lum + 0.05);
}

/** True if the value is a usable hex color (handy for API validation/logging). */
export const isValidHexColor = (value?: string | null): boolean => parseHex(value) !== null;

/**
 * Build a full brand palette from one hex color.
 * Returns null if the input isn't a valid hex color (caller falls back).
 *
 * Safety: the app puts white text/icons on `brand` (header, buttons, hero
 * cards). If the backend sends a very light color (e.g. "#FFE4F2") that text
 * would be unreadable, so `brand` is darkened in small steps only as far as
 * needed to reach a 3:1 contrast with white. Normal colors are untouched.
 */
export function buildBrandTheme(hex?: string | null): RoleTheme | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;

  let base = rgb;
  const hsl = rgbToHsl(rgb);
  while (contrastWithWhite(base) < 3 && hsl.l > 0) {
    hsl.l = Math.max(0, hsl.l - 2);
    base = hslToRgb(hsl);
  }
  const baseHsl = rgbToHsl(base);
  const darker = (steps: number) =>
    toHex(hslToRgb({ ...baseHsl, l: clamp(baseHsl.l - DARK_STEP * steps, 0, 100) }));

  return {
    brand: toHex(base),
    brandDark: darker(1),
    brandDeep: darker(2),
    brandSoft: tint(base, 0.9),
    brandFaint: tint(base, 0.95),
    onBrandSub: tint(base, 0.7),
  };
}

/**
 * Apply the brand palette.
 *  1. If `themeColor` (from the backend) is a valid hex → palette derived from it.
 *  2. Otherwise → the existing role theme (student violet, teacher green, …).
 *  3. No role either (logged out) → default theme.
 * Invalid / empty / null backend values never break the UI; they just fall back.
 */
export function applyRoleTheme(role?: Role | null, themeColor?: string | null): void {
  const themed = buildBrandTheme(themeColor) || (role && ROLE_THEMES[role]) || ROLE_THEMES.default;
  colors.brand = themed.brand;
  colors.brandDark = themed.brandDark;
  colors.brandDeep = themed.brandDeep;
  colors.brandSoft = themed.brandSoft;
  colors.brandFaint = themed.brandFaint;
  colors.onBrandSub = themed.onBrandSub;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  principal: 'Principal',
  sub_admin: 'Sub Admin',
  coordinator: 'Coordinator',
  teacher: 'Teacher',
  driver: 'Driver',
  student: 'Student',
};

export const radius = { card: 18, pill: 999, input: 14 } as const;

export const shadow: Record<'card' | 'pop', ViewStyle> = {
  card: {
    shadowColor: '#3A4160',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  pop: {
    shadowColor: '#3A4160',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 9,
  },
};

export interface Accent {
  fg: string;
  bg: string;
}

// Accent palette used to tint tile/list icons (cycled by index).
export const ACCENTS: Accent[] = [
  { fg: '#5B3FD6', bg: '#EEEAFB' },
  { fg: '#0F766E', bg: '#E3F4F2' },
  { fg: '#C2410C', bg: '#FBEDE4' },
  { fg: '#1D4ED8', bg: '#E9EFFD' },
  { fg: '#BE185D', bg: '#FBE9F1' },
  { fg: '#B45309', bg: '#FCF2E3' },
  { fg: '#15803D', bg: '#E8F7EE' },
  { fg: '#0E7490', bg: '#E4F3F7' },
];

export const accent = (i: number): Accent => ACCENTS[i % ACCENTS.length];

export interface BadgeColor {
  fg: TextStyle['color'];
  bg: ViewStyle['backgroundColor'];
}

// map API statuses -> badge colors (extend as features grow)
export const statusColor: Record<string, BadgeColor> = {
  pending: { fg: colors.warn, bg: colors.warnSoft },
  submitted: { fg: colors.ok, bg: colors.okSoft },
  late: { fg: colors.danger, bg: colors.dangerSoft },
  paid: { fg: colors.ok, bg: colors.okSoft },
  present: { fg: colors.ok, bg: colors.okSoft },
  absent: { fg: colors.danger, bg: colors.dangerSoft },
  leave: { fg: colors.warn, bg: colors.warnSoft },
  on_leave: { fg: colors.warn, bg: colors.warnSoft },
  upcoming: { fg: colors.info, bg: colors.infoSoft },
  ongoing: { fg: colors.warn, bg: colors.warnSoft },
  completed: { fg: colors.ok, bg: colors.okSoft },
  overdue: { fg: colors.danger, bg: colors.dangerSoft },
  approved: { fg: colors.ok, bg: colors.okSoft },
  rejected: { fg: colors.danger, bg: colors.dangerSoft },
  active: { fg: colors.ok, bg: colors.okSoft },
  maintenance: { fg: colors.warn, bg: colors.warnSoft },
  success: { fg: colors.ok, bg: colors.okSoft },
  failed: { fg: colors.danger, bg: colors.dangerSoft },
  new: { fg: colors.info, bg: colors.infoSoft },
  follow_up: { fg: colors.warn, bg: colors.warnSoft },
  converted: { fg: colors.ok, bg: colors.okSoft },
  closed: { fg: colors.subtle, bg: colors.page },
  default: { fg: colors.subtle, bg: colors.page },
};

export const badge = (s?: string): BadgeColor => (s && statusColor[s]) || statusColor.default;
