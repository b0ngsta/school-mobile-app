// Building blocks of the student-portal screens (Attendance, Homework,
// Time Table, Notice Board, Events, Teacher Remarks, Transport, Holidays, Subject
// Teachers, Syllabus, School Info, FileViewer): the rounded brand header the
// screens draw themselves (routes with `ownHeader`), a month switcher, the
// date box, the attachment row, the attendance ring and the bar chart.
// Brand colours are read inline (role themes change them at login).
import React, { ReactNode, memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { t } from '../i18n';
import { colors, shadow } from '../theme';
import type { FileKind } from '../types';
import { displayName, fileKind } from './files';

const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

/* ------------------------------------------------------------- header */

interface PortalHeaderProps {
  title: string;
  subtitle?: string | null;
  onBack?: () => void;
  /** Icon button(s) at the top-right. */
  right?: ReactNode;
  /** Title in the middle (School Info, Attendance). */
  centered?: boolean;
  /** Under the title: month switcher, search box, date card… */
  children?: ReactNode;
}

export function PortalHeader({ title, subtitle, onBack, right, centered, children }: PortalHeaderProps) {
  return (
    <View style={[styles.header, { backgroundColor: colors.brand }]}>
      <View style={[styles.blob, styles.blobA]} />
      <View style={[styles.blob, styles.blobB]} />
      <View style={styles.headRow}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={HIT} style={styles.back} accessibilityRole="button"
            accessibilityLabel={t('Back')}>
            <MCIcon name="chevron-left" size={30} color="#fff" />
          </TouchableOpacity>
        ) : null}
        <Text style={[styles.title, centered && styles.titleCentered]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {right ? <View style={styles.right}>{right}</View> : centered && onBack ? <View style={styles.backSpace} /> : null}
      </View>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.onBrandSub }, onBack && !centered && styles.subIndent,
          centered && styles.subCentered]} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
      {children ? <View style={styles.headChildren}>{children}</View> : null}
    </View>
  );
}

/** Puts a PortalHeader at the top of a ListScreen (cancels the list's 16 dp padding). */
export function ListHeaderBleed({ children }: { children: ReactNode }) {
  return <View style={styles.bleed}>{children}</View>;
}

/** Round translucent icon button for the header's `right` slot. */
export function HeaderIcon({ icon, onPress, label }: { icon: string; onPress: () => void; label: string }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={HIT} accessibilityRole="button" accessibilityLabel={label}
      style={styles.headIcon}>
      <MCIcon name={icon} size={24} color="#fff" />
    </TouchableOpacity>
  );
}

/** ‹ October / 2026 › inside the header. */
export function MonthSwitcher({ label, sub, onPrev, onNext, prevDisabled, nextDisabled }: {
  label: string;
  sub?: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
}) {
  return (
    <View style={styles.switcher}>
      <SwitchButton icon="chevron-left" onPress={onPrev} disabled={prevDisabled} label={t('Previous month')} />
      <View style={styles.switchText}>
        <Text style={styles.switchLabel}>{label}</Text>
        {sub ? <Text style={[styles.switchSub, { color: colors.onBrandSub }]}>{sub}</Text> : null}
      </View>
      <SwitchButton icon="chevron-right" onPress={onNext} disabled={nextDisabled} label={t('Next month')} />
    </View>
  );
}

function SwitchButton({ icon, onPress, disabled, label }: { icon: string; onPress: () => void; disabled?: boolean; label: string }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      style={[styles.switchBtn, disabled && styles.disabled]} activeOpacity={0.75}>
      <MCIcon name={icon} size={24} color={colors.brand} />
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------ pieces */

/** "OCT / 06 / 2026" box at the left of a list card. */
export const DateBox = memo(function DateBox({ date, tone = 'brand', showYear = true }: {
  date: string;
  tone?: 'brand' | 'danger' | 'info' | 'pink' | 'violet' | 'muted';
  showYear?: boolean;
}) {
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  const valid = !Number.isNaN(d.getTime());
  const fg = TONES[tone].fg();
  return (
    <View style={[styles.dateBox, { backgroundColor: TONES[tone].bg() }]}>
      <Text style={[styles.dateMon, { color: fg }]}>{valid ? t('months')[d.getMonth()].toUpperCase() : '—'}</Text>
      <Text style={[styles.dateDay, { color: fg }]}>{valid ? String(d.getDate()).padStart(2, '0') : ''}</Text>
      {showYear && valid ? <Text style={[styles.dateYear, { color: fg }]}>{d.getFullYear()}</Text> : null}
    </View>
  );
});

const TONES = {
  brand: { bg: () => colors.brandSoft, fg: () => colors.brand },
  danger: { bg: () => colors.dangerSoft, fg: () => colors.danger },
  info: { bg: () => colors.infoSoft, fg: () => colors.info },
  pink: { bg: () => '#FDEAF3', fg: () => '#DB2777' },
  violet: { bg: () => '#EEEDFD', fg: () => '#5B5BD6' },
  muted: { bg: () => colors.page, fg: () => colors.subtle },
};
export const DATE_TONES = ['danger', 'info', 'pink', 'violet'] as const;

/** Pink "1778949112057.pdf · Tap to open PDF" row under a card. */
export function AttachmentRow({ path, name, type, onPress, style }: {
  path: string;
  name?: string | null;
  type?: FileKind | string | null;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const kind = fileKind(path, type);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.attach, style]} accessibilityRole="button"
      accessibilityLabel={kind === 'pdf' ? t('Open PDF') : t('Open photo')}>
      <MCIcon name={kind === 'pdf' ? 'file-pdf-box' : 'image-outline'} size={28} color={colors.danger} />
      <View style={styles.attachText}>
        <Text style={styles.attachName} numberOfLines={1}>{displayName({ path, name })}</Text>
        <Text style={styles.attachHint}>{kind === 'pdf' ? t('Tap to open PDF') : t('Tap to open photo')}</Text>
      </View>
      <MCIcon name="open-in-new" size={22} color={colors.danger} />
    </TouchableOpacity>
  );
}

/** Small pill: "PDF attached", "Completed", "1 day". */
export function Pill({ label, icon, fg, bg }: { label: string; icon?: string; fg: string; bg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: fg + '33' }]}>
      {icon ? <MCIcon name={icon} size={14} color={fg} style={styles.pillIcon} /> : null}
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** The white rounded card used across the portal screens. */
export function PCard({ children, style, onPress, accessibilityLabel }: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.card, shadow.card, style]}
        accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, shadow.card, style]}>{children}</View>;
}

/** Subject tiles (Homework → By Subject, Syllabus): a colour per first letter. */
const SUBJECT_COLORS = ['#EC4899', '#EF4444', '#6366F1', '#8B5CF6', '#10B981', '#F59E0B', '#0EA5E9', '#14B8A6'];
export function subjectColor(name: string, index = 0): string {
  const code = (name.trim().toUpperCase().charCodeAt(0) || 65) + index;
  return SUBJECT_COLORS[code % SUBJECT_COLORS.length];
}

export const SubjectTile = memo(function SubjectTile({ name, sub, index, onPress }: {
  name: string;
  sub?: string | null;
  index: number;
  onPress: () => void;
}) {
  const color = subjectColor(name, index);
  return (
    <View style={styles.tileWrap}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.tile, shadow.card]} accessibilityRole="button"
        accessibilityLabel={name}>
        <View style={[styles.tileIcon, { backgroundColor: color, shadowColor: color }]}>
          <Text style={styles.tileLetter}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
        </View>
        <Text style={styles.tileName} numberOfLines={2}>{name.toUpperCase()}</Text>
        {sub ? <Text style={styles.tileSub} numberOfLines={2}>{sub}</Text> : null}
      </TouchableOpacity>
    </View>
  );
});

/** Section heading with an optional count bubble ("Holiday List (3)"). */
export function PortalSection({ title, count }: { title: string; count?: number | null }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count != null ? (
        <View style={[styles.count, { backgroundColor: colors.brandSoft }]}>
          <Text style={[styles.countText, { color: colors.brand }]}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------- ring chart */

/**
 * Donut / ring filled to `percent` (0–100), the number in the middle.
 * Pure Views: two half-rings rotated behind half-width clips (no SVG library).
 */
export function ProgressRing({ percent, size = 150, thickness = 14, color = '#fff', track = 'rgba(255,255,255,0.22)',
  label, labelColor = '#fff' }: {
  percent: number | null;
  size?: number;
  thickness?: number;
  color?: string;
  track?: string;
  label?: string;
  labelColor?: string;
}) {
  const p = Math.max(0, Math.min(100, percent ?? 0));
  const deg = p * 3.6;
  const half = size / 2;
  const piece = (rotate: number, left: number) => (
    <View
      style={{
        position: 'absolute',
        left,
        top: 0,
        width: size,
        height: size,
        borderRadius: half,
        borderWidth: thickness,
        borderTopColor: color,
        borderRightColor: color,
        borderBottomColor: 'transparent',
        borderLeftColor: 'transparent',
        transform: [{ rotate: `${rotate}deg` }],
      }}
    />
  );
  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p) }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: half, borderWidth: thickness, borderColor: track }} />
      {/* right half: 0°…min(deg, 180°) */}
      <View style={{ position: 'absolute', left: half, top: 0, width: half, height: size, overflow: 'hidden' }}>
        {piece(Math.min(deg, 180) - 135, -half)}
      </View>
      {/* left half: 180°…deg */}
      {deg > 180 ? (
        <View style={{ position: 'absolute', left: 0, top: 0, width: half, height: size, overflow: 'hidden' }}>
          {piece(deg - 135, 0)}
        </View>
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
        <Text style={[styles.ringText, { color: labelColor, fontSize: size * 0.21 }]}>
          {label ?? (percent == null ? '—' : `${Math.round(p)}%`)}
        </Text>
      </View>
    </View>
  );
}

/* ----------------------------------------------------------- bar chart */

export interface BarGroup {
  label: string;
  values: number[];
}

/** Grouped vertical bars (e.g. present / absent per month) with a light grid. */
export function BarChart({ groups, colors: barColors, height = 170, legend }: {
  groups: BarGroup[];
  colors: string[];
  height?: number;
  legend?: string[];
}) {
  const max = Math.max(1, ...groups.flatMap(g => g.values));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => top - i * step);
  return (
    <View>
      <View style={[styles.chart, { height }]}>
        <View style={styles.axis}>
          {ticks.map(v => <Text key={v} style={styles.tick}>{v}</Text>)}
        </View>
        <View style={styles.plot}>
          {ticks.map((v, i) => (
            <View key={v} style={[styles.gridLine, { top: (i / (ticks.length - 1)) * (height - 4) }]} />
          ))}
          <View style={styles.bars}>
            {groups.map(g => (
              <View key={g.label} style={styles.group} accessible accessibilityLabel={`${g.label}: ${g.values.join(', ')}`}>
                <View style={styles.groupBars}>
                  {g.values.map((v, i) => (
                    <View key={i} style={[styles.bar, { height: Math.max(v > 0 ? 3 : 0, (v / top) * (height - 4)),
                      backgroundColor: barColors[i % barColors.length] }]} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.xLabels}>
        <View style={styles.axisSpace} />
        {groups.map(g => <Text key={g.label} style={styles.xLabel}>{g.label}</Text>)}
      </View>
      {legend ? (
        <View style={styles.legend}>
          {legend.map((l, i) => (
            <View key={l} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: barColors[i % barColors.length] }]} />
              <Text style={styles.legendText}>{l}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function niceStep(max: number): number {
  if (max <= 10) return max <= 5 ? 1 : 5;
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / pow;
  return (unit <= 1 ? 1 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * pow;
}

/* -------------------------------------------------------------- styles */

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 22,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
  blobA: { width: 220, height: 220, top: -120, right: -70 },
  blobB: { width: 140, height: 140, bottom: -80, left: -40 },
  headRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  back: { marginLeft: -8, marginRight: 6 },
  backSpace: { width: 30 },
  title: { flex: 1, color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.2 },
  titleCentered: { textAlign: 'center' },
  right: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  subtitle: { fontSize: 14.5, fontWeight: '500', marginTop: 4 },
  subIndent: { marginLeft: 28 },
  subCentered: { textAlign: 'center' },
  headChildren: { marginTop: 16 },
  headIcon: { padding: 4 },
  bleed: { marginHorizontal: -16, marginTop: -16, marginBottom: 16 },

  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 22,
    padding: 6,
  },
  switchBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  switchText: { flex: 1, alignItems: 'center' },
  switchLabel: { color: '#fff', fontSize: 20, fontWeight: '800' },
  switchSub: { fontSize: 13.5, marginTop: 2, fontWeight: '600' },

  dateBox: { width: 64, minHeight: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  dateMon: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.5 },
  dateDay: { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  dateYear: { fontSize: 10.5, fontWeight: '700' },

  attach: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF2F3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F8D7DB',
  },
  attachText: { flex: 1, marginHorizontal: 12 },
  attachName: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  attachHint: { fontSize: 12, color: colors.subtle, marginTop: 1 },

  pill: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginTop: 6 },
  pillIcon: { marginRight: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },

  card: { backgroundColor: '#fff', borderRadius: 22, marginBottom: 14, overflow: 'hidden' },

  tileWrap: { width: '33.333%', padding: 5 },
  tile: { backgroundColor: '#fff', borderRadius: 20, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 6, minHeight: 128 },
  tileIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  tileLetter: { color: '#fff', fontSize: 22, fontWeight: '800' },
  tileName: { fontSize: 12.5, fontWeight: '800', color: colors.ink, marginTop: 10, textAlign: 'center', letterSpacing: 0.3 },
  tileSub: { fontSize: 11, color: colors.subtle, marginTop: 3, textAlign: 'center' },

  section: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: colors.ink },
  count: { marginLeft: 10, minWidth: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  countText: { fontSize: 13.5, fontWeight: '800' },

  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringText: { fontWeight: '800' },

  chart: { flexDirection: 'row' },
  axis: { width: 26, justifyContent: 'space-between', paddingBottom: 0 },
  axisSpace: { width: 26 },
  tick: { fontSize: 10.5, color: colors.subtle, textAlign: 'left' },
  plot: { flex: 1, position: 'relative' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.line },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  group: { flex: 1, alignItems: 'center' },
  groupBars: { flexDirection: 'row', alignItems: 'flex-end' },
  bar: { width: 7, borderTopLeftRadius: 4, borderTopRightRadius: 4, marginHorizontal: 2 },
  xLabels: { flexDirection: 'row', marginTop: 6 },
  xLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: colors.subtle },
  legend: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12 },
  legendDot: { width: 14, height: 14, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 13, color: colors.ink },
});
