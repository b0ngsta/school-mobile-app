// Pure helpers for the Performance Report screen (charts drawn with plain
// Views — no SVG library): line segments between two points, radar
// geometry, trend-chart points, labels and subject icons. Tested in
// __tests__/performance.test.tsx.

export interface Pt {
  x: number;
  y: number;
}

/** A straight line drawn as a rotated View: absolute left/top/width + rotation (deg). */
export function segment(a: Pt, b: Pt, thickness = 2): { left: number; top: number; width: number; angle: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const width = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return { left: (a.x + b.x) / 2 - width / 2, top: (a.y + b.y) / 2 - thickness / 2, width, angle };
}

/** Vertex i of an n-gon of radius r around (cx, cy), the first one straight up. */
export function radarPoint(i: number, n: number, r: number, cx: number, cy: number): Pt {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, n);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** Points for percentages (0–100) on a radar of radius r. */
export function radarShape(values: (number | null)[], r: number, cx: number, cy: number): Pt[] {
  return values.map((v, i) => radarPoint(i, values.length, (Math.max(0, Math.min(100, v ?? 0)) / 100) * r, cx, cy));
}

/** The y-axis range for a trend chart: a bit under the lowest value, ticks every 10. */
export function trendRange(values: number[]): { min: number; max: number; ticks: number[] } {
  if (!values.length) return { min: 0, max: 100, ticks: [100, 75, 50, 25, 0] };
  const low = Math.min(...values);
  const min = Math.max(0, Math.floor((low - 10) / 10) * 10);
  const step = 100 - min > 50 ? 20 : 10;
  const ticks: number[] = [];
  for (let v = 100; v >= min; v -= step) ticks.push(v);
  if (ticks[ticks.length - 1] !== min) ticks.push(min);
  return { min, max: 100, ticks };
}

/** Chart points for values over a width × height plot (first/last point inset by `pad`). */
export function trendPoints(values: number[], width: number, height: number, min: number, max = 100, pad = 30): Pt[] {
  const n = values.length;
  const span = Math.max(1, max - min);
  return values.map((v, i) => ({
    x: n === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (n - 1),
    y: height - ((Math.max(min, Math.min(max, v)) - min) / span) * height,
  }));
}

/** 12.04 → "+12%", -3.5 → "−3.5%", 0 → "±0%". */
export function deltaText(d: number | null | undefined): string {
  if (d == null) return '—';
  const v = Math.round(d * 10) / 10;
  if (v === 0) return '±0%';
  return `${v > 0 ? '+' : '−'}${Math.abs(v)}%`;
}

/** 92.0 → "92", 66.67 → "66.7". */
export const num = (v: number | null | undefined): string =>
  v == null ? '—' : String(Math.round(v * 10) / 10);

/** Short x-axis label: "Half Yearly" → "Half\nYearly", "Unit Test 1" → "UT-1". */
export function shortExam(name: string): string {
  const unit = /^unit\s*test\s*-?\s*(\d+)$/i.exec(name.trim());
  if (unit) return `UT-${unit[1]}`;
  const words = name.trim().split(/\s+/);
  if (name.length <= 9 || words.length === 1) return name.length > 11 ? `${name.slice(0, 10)}…` : name;
  return `${words[0]}\n${words.slice(1).join(' ')}`.slice(0, 22);
}

/** "Mathematics" → "Maths", "Social Science" → "S.St." for small chart labels. */
export function shortSubject(name: string): string {
  const n = name.trim().toLowerCase();
  if (/^math/.test(n)) return 'Maths';
  if (/social/.test(n)) return 'S.St.';
  if (/^computer/.test(n)) return 'Comp.';
  if (/^english/.test(n)) return 'Eng';
  if (/^science$/.test(n)) return 'Sci';
  if (/^environment|^evs/.test(n)) return 'EVS';
  return name.length > 7 ? `${name.slice(0, 6)}.` : name;
}

const ICONS: [RegExp, string][] = [
  [/math/i, 'pi'],
  [/english/i, 'book-open-page-variant'],
  [/hindi|sanskrit|urdu|punjabi|marathi|tamil|telugu|bengali|gujarati|kannada|malayalam/i, 'alphabetical-variant'],
  [/social|history|geograph|civics|s\.?st/i, 'earth'],
  [/physics/i, 'atom'],
  [/chemistry/i, 'flask-outline'],
  [/biology|evs|environment/i, 'leaf'],
  [/science/i, 'flask-outline'],
  [/computer|it\b|informat/i, 'laptop'],
  [/art|drawing/i, 'palette-outline'],
  [/music/i, 'music-note'],
  [/sport|physical|p\.?e\b|games/i, 'run'],
  [/account|commerce|business|econom/i, 'finance'],
  [/french|german|spanish|japanese|language/i, 'translate'],
];

export function subjectIcon(name: string): string {
  return ICONS.find(([re]) => re.test(name))?.[1] || 'book-outline';
}

/** Icon + tint for an insight `kind` from the server. */
export function insightStyle(kind: string): { icon: string; fg: string; bg: string } {
  switch (kind) {
    case 'strongest':
      return { icon: 'arrow-top-right-thick', fg: '#16A34A', bg: '#E8F7EE' };
    case 'focus':
      return { icon: 'bullseye-arrow', fg: '#DB2777', bg: '#FCE7F3' };
    case 'above_average':
      return { icon: 'chart-line-variant', fg: '#2563EB', bg: '#E9EFFD' };
    case 'below_average':
      return { icon: 'chart-line-variant', fg: '#D97706', bg: '#FCF2E3' };
    case 'improved':
      return { icon: 'rocket-launch-outline', fg: '#7C3AED', bg: '#F1EAFE' };
    case 'trend_down':
      return { icon: 'trending-down', fg: '#DC2640', bg: '#FDEBEE' };
    default:
      return { icon: 'trending-up', fg: '#0284C7', bg: '#E5F3FB' };
  }
}

/** A colour for a percentage: green ≥ 75, amber ≥ 40, else red. */
export const pctTone = (p: number | null | undefined): string =>
  p == null ? '#7A8095' : p >= 75 ? '#16A34A' : p >= 40 ? '#D97706' : '#DC2640';
