// Performance Report (Nov 2026; route `ReportCards`, launcher "Performance
// Report"): how the student did over the whole academic session, built from
// PUBLISHED exam results — GET /student/performance (backend
// services/performance.py). Three tabs:
//   Overview  — trophy card (overall %, grade, marks, class rank), you vs class
//               average per subject (tap a bar), subject-wise comparison rows
//               (tap → Subjects tab), the school's own report cards if any
//   Analysis  — subject mastery radar (you / class average toggle, tap a
//               subject), insights, overall trend across exams (tap a point)
//   Subjects  — one subject at a time (chips): ring, grade, rank, class
//               average / highest, exam-by-exam bars and marks
// Charts are plain Views (helpers in ./performance.ts), so no native chart
// library is needed. Exam-by-exam tables stay on the Exams screen.
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { PCard, PortalHeader, ProgressRing, subjectColor } from '../../components/portal';
import { Bone, Empty, ErrorBox, Screen, fmtDate } from '../../components/ui';
import { useApi, useI18n, useReduceMotion } from '../../hooks';
import { colors, shadow } from '../../theme';
import type { PerfSubject, PerformanceReport as Report, ReportCard, ScreenProps } from '../../types';
import {
  deltaText,
  insightStyle,
  num,
  pctTone,
  radarPoint,
  radarShape,
  segment,
  shortExam,
  shortSubject,
  subjectIcon,
  trendPoints,
  trendRange,
} from './performance';
import type { Pt } from './performance';

type Tab = 'overview' | 'analysis' | 'subjects';
const CLASS = '#8EC5FF'; // class-average series
const GOLD = '#FFC93C';

export default function PerformanceReport({ goBack }: ScreenProps) {
  const { t } = useI18n();
  const { data, error, loading, refreshing, refresh } = useApi<Report>('/student/performance');
  const cards = useApi<ReportCard[]>('/student/report-cards');
  const [tab, setTab] = useState<Tab>('overview');
  const [subject, setSubject] = useState<string | null>(null);

  const subjects = useMemo(() => data?.subjects || [], [data]);
  const picked = subjects.find(s => s.subject === subject) || subjects[0] || null;
  const openSubject = (name: string) => {
    setSubject(name);
    setTab('subjects');
  };
  const pull = () => {
    refresh();
    cards.refresh();
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('Overview') },
    { key: 'analysis', label: t('Analysis') },
    { key: 'subjects', label: t('Subjects') },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={pull} padded={false}>
      <PortalHeader title={t('Performance Report')} onBack={goBack}
        subtitle={data ? t('Session {label}', { label: data.session.label }) : null}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {tabs.map(x => {
            const on = tab === x.key;
            return (
              <TouchableOpacity key={x.key} onPress={() => setTab(x.key)} activeOpacity={0.8}
                style={[styles.tab, on && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}
                testID={`perf-tab-${x.key}`}>
                <Text style={[styles.tabText, { color: on ? colors.brand : '#fff' }]}>{x.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </PortalHeader>
      <View style={styles.body}>
        <ErrorBox message={error} />
        {loading ? (
          <>
            <Bone height={170} radius={22} style={{ marginBottom: 14 }} />
            <Bone height={220} radius={18} style={{ marginBottom: 14 }} />
            <Bone height={180} radius={18} />
          </>
        ) : !data?.overall ? (
          <>
            <Empty icon="chart-box-outline"
              text={t('No published results yet this session. Your performance report appears here once the school publishes exam results.')} />
            <TeacherReportCards cards={cards.data} />
          </>
        ) : tab === 'overview' ? (
          <Overview report={data} onSubject={openSubject} cards={cards.data} />
        ) : tab === 'analysis' ? (
          <Analysis report={data} onSubject={openSubject} />
        ) : (
          <Subjects subjects={subjects} picked={picked} onPick={setSubject} />
        )}
      </View>
    </Screen>
  );
}

/* ================================================================ overview */

function Overview({ report, onSubject, cards }: { report: Report; onSubject: (s: string) => void; cards: ReportCard[] | null }) {
  const { t } = useI18n();
  const o = report.overall!;
  const [focus, setFocus] = useState<string | null>(null);
  const subjects = report.subjects;
  const sel = subjects.find(s => s.subject === focus) || null;
  return (
    <>
      {/* trophy card */}
      <View style={[styles.hero, { backgroundColor: colors.brandDeep }, shadow.card]} testID="perf-hero">
        <View style={[styles.glow, styles.glowA]} />
        <View style={[styles.glow, styles.glowB]} />
        <Text style={[styles.sparkle, { top: 16, left: 22 }]}>✦</Text>
        <Text style={[styles.sparkle, { top: 56, right: 18, fontSize: 18 }]}>✦</Text>
        <Text style={[styles.sparkle, { bottom: 20, left: 110, fontSize: 10 }]}>✦</Text>
        <View style={styles.trophyWrap}>
          <View style={styles.trophyHalo} />
          <MCIcon name="trophy" size={72} color={GOLD} />
          <View style={styles.laurels}>
            <MCIcon name="star-four-points" size={14} color={GOLD} />
            <MCIcon name="star-four-points" size={10} color="#FFE7A3" />
            <MCIcon name="star-four-points" size={14} color={GOLD} />
          </View>
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroLabel}>{t('Overall Performance')}</Text>
          <CountUp value={o.percentage ?? 0} style={styles.heroPct} suffix="%" />
          {o.grade ? (
            <View style={styles.gradePill}>
              <Text style={styles.gradeText}>{t('Grade {g}', { g: o.grade })}</Text>
            </View>
          ) : null}
          <Text style={styles.heroMeta}>
            {num(o.obtained)} / {num(o.max_total)}
            {o.rank && o.class_size > 1 ? `  |  ${t('Class Rank {r} / {n}', { r: o.rank, n: o.class_size })}` : ''}
          </Text>
        </View>
      </View>

      {/* quick stats */}
      <View style={styles.quick}>
        <QuickStat icon="file-document-multiple-outline" label={t('Exams')} value={String(o.exams_count)} />
        <QuickStat icon="bookshelf" label={t('Subjects')} value={String(o.subjects_count)} />
        <QuickStat icon="account-group-outline" label={t('Class avg')} value={o.class_average != null ? `${num(o.class_average)}%` : '—'} />
        <QuickStat icon="swap-vertical" label={t('vs class')} value={deltaText(o.vs_class)}
          tone={o.vs_class == null ? undefined : o.vs_class >= 0 ? colors.ok : colors.danger} />
      </View>

      {/* you vs class average */}
      <PCard style={styles.card}>
        <Text style={styles.cardTitle}>{t('Your Performance vs Class Average')}</Text>
        <Legend />
        <CompareBars subjects={subjects} focus={focus} onFocus={s => setFocus(f => (f === s ? null : s))} />
        {sel ? (
          <View style={[styles.tip, { backgroundColor: colors.brandFaint }]} testID="perf-bar-tip">
            <Text style={styles.tipTitle}>{sel.subject}</Text>
            <Text style={styles.tipText}>
              {t('You {you}% · Class {avg}% · Best {best}%', {
                you: num(sel.percentage), avg: num(sel.class_average), best: num(sel.class_highest),
              })}
            </Text>
          </View>
        ) : (
          <Text style={styles.hint}>{t('Tap a bar to compare')}</Text>
        )}
      </PCard>

      {/* subject-wise comparison */}
      <PCard style={styles.card}>
        <Text style={styles.cardTitle}>{t('Subject-wise Comparison')}</Text>
        {subjects.map((s, i) => (
          <SubjectRow key={s.subject} s={s} index={i} onPress={() => onSubject(s.subject)} />
        ))}
      </PCard>

      {/* exams of the session */}
      <PCard style={styles.card}>
        <Text style={styles.cardTitle}>{t('Exams this session')}</Text>
        {report.exams.map(e => (
          <View key={e.id} style={styles.examRow}>
            <View style={[styles.examDot, { backgroundColor: pctTone(e.percentage) }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.examName}>{e.name}</Text>
              <Text style={styles.examMeta}>
                {fmtDate(e.start_date)} · {num(e.obtained)}/{num(e.max_total)}
                {e.rank && e.class_size > 1 ? ` · ${t('Rank {r}/{n}', { r: e.rank, n: e.class_size })}` : ''}
              </Text>
            </View>
            <Text style={[styles.examPct, { color: pctTone(e.percentage) }]}>{num(e.percentage)}%</Text>
            {e.grade ? <Text style={[styles.examGrade, { color: colors.brand, backgroundColor: colors.brandSoft }]}>{e.grade}</Text> : null}
          </View>
        ))}
      </PCard>

      <TeacherReportCards cards={cards} />
    </>
  );
}

function QuickStat({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: string }) {
  return (
    <View style={[styles.quickItem, shadow.card]}>
      <MCIcon name={icon} size={18} color={colors.brand} />
      <Text style={[styles.quickValue, tone ? { color: tone } : null]} numberOfLines={1}>{value}</Text>
      <Text style={styles.quickLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function Legend({ you = true, cls = true }: { you?: boolean; cls?: boolean }) {
  const { t } = useI18n();
  return (
    <View style={styles.legend}>
      {you && (
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.brand }]} />
          <Text style={styles.legendText}>{t('You')}</Text>
        </View>
      )}
      {cls && (
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: CLASS }]} />
          <Text style={styles.legendText}>{t('Class Average')}</Text>
        </View>
      )}
    </View>
  );
}

/** Grouped bars: you (brand) and the class average (light blue) per subject, 0–100 %. */
const CompareBars = memo(function CompareBars({ subjects, focus, onFocus }: {
  subjects: PerfSubject[];
  focus: string | null;
  onFocus: (s: string) => void;
}) {
  const H = 150;
  const grow = useGrow();
  return (
    <View style={styles.barsWrap}>
      <View style={[styles.yAxis, { height: H }]}>
        {[100, 80, 60, 40, 20, 0].map(v => <Text key={v} style={styles.yTick}>{v}%</Text>)}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ height: H }}>
          {[0, 1, 2, 3, 4, 5].map(i => <View key={i} style={[styles.grid, { top: (i / 5) * (H - 1) }]} />)}
          <View style={styles.barRow}>
            {subjects.map(s => {
              const dim = focus != null && focus !== s.subject;
              return (
                <TouchableOpacity key={s.subject} style={[styles.barGroup, dim && { opacity: 0.35 }]} activeOpacity={0.7}
                  onPress={() => onFocus(s.subject)} accessibilityRole="button"
                  accessibilityLabel={`${s.subject}: ${num(s.percentage)}%, class ${num(s.class_average)}%`}>
                  <Text style={[styles.barValue, { color: colors.brand }]}>{num(s.percentage)}%</Text>
                  <View style={styles.barPair}>
                    <Animated.View style={[styles.bar, {
                      height: (Math.max(0, s.percentage ?? 0) / 100) * (H - 18), backgroundColor: colors.brand,
                      transform: [{ scaleY: grow }], transformOrigin: 'bottom',
                    }]} />
                    <Animated.View style={[styles.bar, {
                      height: (Math.max(0, s.class_average ?? 0) / 100) * (H - 18), backgroundColor: CLASS,
                      transform: [{ scaleY: grow }], transformOrigin: 'bottom',
                    }]} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={styles.xRow}>
          {subjects.map(s => <Text key={s.subject} style={styles.xLabel} numberOfLines={1}>{shortSubject(s.subject)}</Text>)}
        </View>
      </View>
    </View>
  );
});

function SubjectRow({ s, index, onPress }: { s: PerfSubject; index: number; onPress: () => void }) {
  const { t } = useI18n();
  const tint = subjectColor(s.subject, index);
  const up = (s.vs_class ?? 0) >= 0;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.sRow} accessibilityRole="button"
      accessibilityLabel={`${s.subject} ${num(s.percentage)}%`} testID={`perf-subject-${s.subject}`}>
      <View style={[styles.sIcon, { backgroundColor: tint + '1F' }]}>
        <MCIcon name={subjectIcon(s.subject)} size={20} color={tint} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.sName} numberOfLines={1}>{s.subject}</Text>
        <Meter value={s.percentage} color={tint} mark={s.class_average} />
      </View>
      <View style={styles.sRight}>
        <Text style={styles.sPct}>{num(s.percentage)}%</Text>
        {s.vs_class != null ? (
          <View style={[styles.delta, { backgroundColor: up ? colors.okSoft : colors.dangerSoft }]}>
            <MCIcon name={up ? 'arrow-up' : 'arrow-down'} size={11} color={up ? colors.ok : colors.danger} />
            <Text style={[styles.deltaText, { color: up ? colors.ok : colors.danger }]}>{deltaText(s.vs_class).replace(/^[+−]/, '')}</Text>
          </View>
        ) : null}
        <Text style={styles.sAvg}>{t('Class avg {n}%', { n: num(s.class_average) })}</Text>
      </View>
      <MCIcon name="chevron-right" size={20} color={colors.faint} />
    </TouchableOpacity>
  );
}

/** Thin progress bar with an optional tick for the class average. */
function Meter({ value, color, mark }: { value: number | null; color: string; mark?: number | null }) {
  const grow = useGrow();
  return (
    <View style={styles.meter}>
      <Animated.View style={[styles.meterFill, {
        width: `${Math.max(0, Math.min(100, value ?? 0))}%`, backgroundColor: color,
        transform: [{ scaleX: grow }], transformOrigin: 'left',
      }]} />
      {mark != null ? <View style={[styles.meterMark, { left: `${Math.max(0, Math.min(100, mark))}%` }]} /> : null}
    </View>
  );
}

function TeacherReportCards({ cards }: { cards: ReportCard[] | null }) {
  const { t } = useI18n();
  if (!cards?.length) return null;
  return (
    <PCard style={styles.card}>
      <Text style={styles.cardTitle}>{t('Report cards from school')}</Text>
      {cards.map(rc => {
        let grades: Record<string, string | number> | null = null;
        try {
          const g = typeof rc.grades === 'string' ? JSON.parse(rc.grades) : rc.grades;
          grades = g && typeof g === 'object' ? g : null;
        } catch {
          grades = null;
        }
        return (
          <View key={rc.id} style={styles.rc}>
            <Text style={styles.examName}>{rc.term}</Text>
            <Text style={styles.examMeta}>{t('rc.issued', { date: fmtDate(rc.created_at), name: rc.issued_by })}</Text>
            {grades ? (
              <View style={styles.rcGrades}>
                {Object.entries(grades).map(([k, v]) => (
                  <View key={k} style={[styles.rcPill, { backgroundColor: colors.brandSoft }]}>
                    <Text style={[styles.rcPillText, { color: colors.brand }]}>{k}: {String(v)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {rc.remarks ? <Text style={styles.rcRemark}>“{rc.remarks}”</Text> : null}
          </View>
        );
      })}
    </PCard>
  );
}

/* ================================================================ analysis */

function Analysis({ report, onSubject }: { report: Report; onSubject: (s: string) => void }) {
  const { t } = useI18n();
  const [showYou, setShowYou] = useState(true);
  const [showClass, setShowClass] = useState(true);
  const [point, setPoint] = useState<number | null>(report.exams.length ? report.exams.length - 1 : null);
  const subjects = report.subjects;
  return (
    <>
      <PCard style={styles.card}>
        <View style={styles.titleRow}>
          <MCIcon name="star-four-points-outline" size={20} color={colors.brand} />
          <Text style={[styles.cardTitle, styles.titleInRow]}>{t('Subject Mastery')}</Text>
        </View>
        {subjects.length >= 3 ? (
          <Radar subjects={subjects} you={showYou} cls={showClass} onSubject={onSubject} />
        ) : (
          subjects.map((s, i) => (
            <View key={s.subject} style={{ marginVertical: 6 }}>
              <Text style={styles.sName}>{s.subject} · {num(s.percentage)}%</Text>
              <Meter value={s.percentage} color={subjectColor(s.subject, i)} mark={s.class_average} />
            </View>
          ))
        )}
        <View style={styles.legend}>
          <Toggle on={showYou} color={colors.brand} label={t('You')} onPress={() => setShowYou(v => !v || !showClass)} />
          <Toggle on={showClass} color={CLASS} label={t('Class Average')} onPress={() => setShowClass(v => !v || !showYou)} />
        </View>
      </PCard>

      {report.insights.length > 0 && (
        <PCard style={styles.card}>
          <View style={styles.titleRow}>
            <MCIcon name="creation" size={20} color={colors.brand} />
            <Text style={[styles.cardTitle, styles.titleInRow]}>{t('Performance Insights')}</Text>
          </View>
          {report.insights.map((ins, i) => {
            const st = insightStyle(ins.kind);
            const body = (
              <View style={[styles.insight, { backgroundColor: colors.brandFaint }]}>
                <View style={[styles.insightIcon, { backgroundColor: st.bg }]}>
                  <MCIcon name={st.icon} size={22} color={st.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>{t(ins.title)}</Text>
                  <Text style={styles.insightText}>{ins.text}</Text>
                </View>
                {ins.subject ? <MCIcon name="chevron-right" size={20} color={colors.faint} /> : null}
              </View>
            );
            return ins.subject ? (
              <TouchableOpacity key={i} activeOpacity={0.8} onPress={() => onSubject(ins.subject!)}>{body}</TouchableOpacity>
            ) : (
              <View key={i}>{body}</View>
            );
          })}
        </PCard>
      )}

      <PCard style={styles.card}>
        <View style={styles.titleRow}>
          <MCIcon name="chart-bar" size={20} color={colors.brand} />
          <Text style={[styles.cardTitle, styles.titleInRow]}>{t('Performance Trend (Overall)')}</Text>
        </View>
        {report.exams.length ? (
          <TrendChart labels={report.exams.map(e => e.name)} values={report.exams.map(e => e.percentage)}
            compare={report.exams.map(e => e.class_average)} selected={point} onSelect={setPoint} />
        ) : null}
        {point != null && report.exams[point] ? (
          <View style={[styles.tip, { backgroundColor: colors.brandFaint }]} testID="perf-trend-tip">
            <Text style={styles.tipTitle}>{report.exams[point].name}</Text>
            <Text style={styles.tipText}>
              {num(report.exams[point].obtained)}/{num(report.exams[point].max_total)} · {num(report.exams[point].percentage)}%
              {report.exams[point].grade ? ` · ${t('Grade {g}', { g: report.exams[point].grade })}` : ''}
              {report.exams[point].class_average != null ? ` · ${t('Class {n}%', { n: num(report.exams[point].class_average) })}` : ''}
            </Text>
          </View>
        ) : null}
      </PCard>

      <GradeScale grades={report.grades} current={report.overall?.grade || null} />
    </>
  );
}

function Toggle({ on, color, label, onPress }: { on: boolean; color: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.legendItem, styles.toggle, !on && { opacity: 0.4 }]}
      accessibilityRole="switch" accessibilityState={{ checked: on }}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Radar / spider chart drawn with rotated Views. */
function Radar({ subjects, you, cls, onSubject }: {
  subjects: PerfSubject[];
  you: boolean;
  cls: boolean;
  onSubject: (s: string) => void;
}) {
  const [w, setW] = useState(0);
  const size = Math.min(w, 300);
  const cx = w / 2;
  const R = size * 0.3;
  const cy = R + 60;
  const H = cy + R + 44;
  const n = subjects.length;
  const mine = radarShape(subjects.map(s => s.percentage), R, cx, cy);
  const avg = radarShape(subjects.map(s => s.class_average), R, cx, cy);
  const ring = (k: number) => Array.from({ length: n }, (_, i) => radarPoint(i, n, R * k, cx, cy));
  return (
    <View style={{ height: w ? H : 260 }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      testID="perf-radar" accessible accessibilityLabel={subjects.map(s => `${s.subject} ${num(s.percentage)}%`).join(', ')}>
      {w > 0 && (
        <>
          {[0.25, 0.5, 0.75, 1].map(k => <Polygon key={k} pts={ring(k)} color={colors.line} thickness={1} />)}
          {ring(1).map((p, i) => <Line key={`s${i}`} a={{ x: cx, y: cy }} b={p} color={colors.line} thickness={1} />)}
          {cls && <Polygon pts={avg} color={CLASS} thickness={2.5} />}
          {/* "fill": soft spokes to your points */}
          {you && mine.map((p, i) => <Line key={`f${i}`} a={{ x: cx, y: cy }} b={p} color={colors.brand + '33'} thickness={10} />)}
          {you && <Polygon pts={mine} color={colors.brand} thickness={3} />}
          {cls && avg.map((p, i) => <Dot key={`ad${i}`} p={p} color={CLASS} size={8} />)}
          {you && mine.map((p, i) => <Dot key={`md${i}`} p={p} color={colors.brand} size={12} ring />)}
          {subjects.map((s, i) => {
            const lp = radarPoint(i, n, R + 26, cx, cy);
            return (
              <TouchableOpacity key={s.subject} onPress={() => onSubject(s.subject)}
                style={[styles.radarLabel, { left: lp.x - 45, top: lp.y - 18 }]} accessibilityRole="button">
                <Text style={styles.radarName} numberOfLines={1}>{shortSubject(s.subject)}</Text>
                <Text style={[styles.radarPct, { color: colors.ink }]}>{num(s.percentage)}%</Text>
              </TouchableOpacity>
            );
          })}
        </>
      )}
    </View>
  );
}

function Line({ a, b, color, thickness = 2 }: { a: Pt; b: Pt; color: string; thickness?: number }) {
  const s = segment(a, b, thickness);
  return (
    <View pointerEvents="none" style={{
      position: 'absolute', left: s.left, top: s.top, width: s.width, height: thickness,
      borderRadius: thickness / 2, backgroundColor: color, transform: [{ rotate: `${s.angle}deg` }],
    }} />
  );
}

function Polygon({ pts, color, thickness }: { pts: Pt[]; color: string; thickness: number }) {
  return <>{pts.map((p, i) => <Line key={i} a={p} b={pts[(i + 1) % pts.length]} color={color} thickness={thickness} />)}</>;
}

function Dot({ p, color, size, ring }: { p: Pt; color: string; size: number; ring?: boolean }) {
  return (
    <View pointerEvents="none" style={{
      position: 'absolute', left: p.x - size / 2, top: p.y - size / 2, width: size, height: size, borderRadius: size / 2,
      backgroundColor: ring ? '#fff' : color, borderWidth: ring ? 3 : 0, borderColor: color,
    }} />
  );
}

/** Line chart of percentages over the exams; tap a point to see its numbers. */
function TrendChart({ labels, values, compare, selected, onSelect, legend = true }: {
  legend?: boolean;
  labels: string[];
  values: number[];
  compare: (number | null)[];
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  const [w, setW] = useState(0);
  const H = 150;
  const axisW = 40;
  const plotW = Math.max(0, w - axisW);
  const all = [...values, ...compare.filter((v): v is number => v != null)];
  const { min, ticks } = trendRange(all);
  const pts = trendPoints(values, plotW, H, min);
  const cmp = compare.every(v => v != null) ? trendPoints(compare as number[], plotW, H, min) : null;
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} testID="perf-trend">
      <View style={{ height: H + 28, flexDirection: 'row', marginTop: 18 }}>
        <View style={{ width: axisW, height: H }}>
          {ticks.map(v => (
            <Text key={v} style={[styles.yTick, styles.trendTick, { top: H - ((v - min) / (100 - min)) * H - 7 }]}>{v}%</Text>
          ))}
        </View>
        {plotW > 0 && (
          <View style={{ width: plotW, height: H }}>
            {ticks.map(v => <View key={v} style={[styles.grid, { top: H - ((v - min) / (100 - min)) * H }]} />)}
            {/* soft area under the line */}
            {pts.map((p, i) => (
              <View key={`a${i}`} pointerEvents="none" style={[styles.area, {
                left: p.x - 1, top: p.y, height: H - p.y, backgroundColor: colors.brand + '22',
              }]} />
            ))}
            {cmp && cmp.slice(1).map((p, i) => <Line key={`c${i}`} a={cmp[i]} b={p} color={CLASS} thickness={2} />)}
            {pts.slice(1).map((p, i) => <Line key={`l${i}`} a={pts[i]} b={p} color={colors.brand} thickness={3} />)}
            {pts.map((p, i) => {
              const on = selected === i;
              return (
                <TouchableOpacity key={`p${i}`} onPress={() => onSelect(i)} hitSlop={12} accessibilityRole="button"
                  accessibilityLabel={`${labels[i]} ${num(values[i])}%`} testID={`perf-point-${i}`}
                  style={{ position: 'absolute', left: p.x - 14, top: p.y - 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{
                    width: on ? 16 : 12, height: on ? 16 : 12, borderRadius: 8, backgroundColor: '#fff',
                    borderWidth: 3, borderColor: colors.brand,
                  }} />
                </TouchableOpacity>
              );
            })}
            {pts.map((p, i) => (
              <View key={`v${i}`} pointerEvents="none" style={[styles.pointLabel, { left: p.x - 30, top: p.y - 34 },
                selected === i && { backgroundColor: colors.brand }]}>
                <Text style={[styles.pointText, { color: selected === i ? '#fff' : colors.ink }]}>{num(values[i])}%</Text>
              </View>
            ))}
            {pts.map((p, i) => (
              <Text key={`x${i}`} style={[styles.trendX, { left: p.x - 34, top: H + 6 }]} numberOfLines={2}>{shortExam(labels[i])}</Text>
            ))}
          </View>
        )}
      </View>
      {cmp && legend ? <Legend /> : null}
    </View>
  );
}

function GradeScale({ grades, current }: { grades: Report['grades']; current: string | null }) {
  const { t } = useI18n();
  if (!grades?.length) return null;
  return (
    <PCard style={styles.card}>
      <Text style={styles.cardTitle}>{t('Grade scale')}</Text>
      <View style={styles.scale}>
        {grades.map((g, i) => {
          const upper = i === 0 ? 100 : grades[i - 1].min - 1;
          const on = g.grade === current;
          return (
            <View key={g.grade} style={[styles.scaleItem, on && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
              <Text style={[styles.scaleGrade, on && { color: '#fff' }]}>{g.grade}</Text>
              <Text style={[styles.scaleRange, on && { color: '#fff' }]}>{g.min}–{upper}</Text>
            </View>
          );
        })}
      </View>
    </PCard>
  );
}

/* ================================================================ subjects */

function Subjects({ subjects, picked, onPick }: {
  subjects: PerfSubject[];
  picked: PerfSubject | null;
  onPick: (s: string) => void;
}) {
  const { t } = useI18n();
  if (!picked) return null;
  const idx = subjects.findIndex(s => s.subject === picked.subject);
  const tint = subjectColor(picked.subject, idx);
  const trendUp = (picked.trend ?? 0) >= 0;
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}
        contentContainerStyle={{ paddingRight: 8 }}>
        {subjects.map((s, i) => {
          const on = s.subject === picked.subject;
          const c = subjectColor(s.subject, i);
          return (
            <TouchableOpacity key={s.subject} onPress={() => onPick(s.subject)} activeOpacity={0.8}
              style={[styles.chip, on ? { backgroundColor: c, borderColor: c } : null]} testID={`perf-chip-${s.subject}`}
              accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <MCIcon name={subjectIcon(s.subject)} size={15} color={on ? '#fff' : c} />
              <Text style={[styles.chipText, { color: on ? '#fff' : colors.ink }]}>{s.subject}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.subjectHero, { backgroundColor: tint }, shadow.card]} testID="perf-subject-detail">
        <View style={[styles.glow, styles.glowA]} />
        <ProgressRing percent={picked.percentage} size={118} thickness={12} />
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.shName}>{picked.subject}</Text>
          {picked.grade ? (
            <View style={styles.shGrade}><Text style={[styles.shGradeText, { color: tint }]}>{t('Grade {g}', { g: picked.grade })}</Text></View>
          ) : null}
          <Text style={styles.shMeta}>{num(picked.obtained)} / {num(picked.max_total)} {t('marks')}</Text>
          {picked.rank && picked.class_size > 1 ? (
            <Text style={styles.shMeta}>{t('Rank {r} of {n} in class', { r: picked.rank, n: picked.class_size })}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.quick}>
        <QuickStat icon="account-group-outline" label={t('Class avg')} value={picked.class_average != null ? `${num(picked.class_average)}%` : '—'} />
        <QuickStat icon="crown-outline" label={t('Class best')} value={picked.class_highest != null ? `${num(picked.class_highest)}%` : '—'} />
        <QuickStat icon="swap-vertical" label={t('vs class')} value={deltaText(picked.vs_class)}
          tone={picked.vs_class == null ? undefined : picked.vs_class >= 0 ? colors.ok : colors.danger} />
        <QuickStat icon={trendUp ? 'trending-up' : 'trending-down'} label={t('Trend')} value={deltaText(picked.trend)}
          tone={picked.trend == null ? undefined : trendUp ? colors.ok : colors.danger} />
      </View>

      <PCard style={styles.card}>
        <Text style={styles.cardTitle}>{t('Exam by exam')}</Text>
        <Legend />
        {picked.exams.map(h => (
          <View key={h.exam_id} style={styles.ebe}>
            <View style={styles.ebeHead}>
              <Text style={styles.examName} numberOfLines={1}>{h.exam}</Text>
              <Text style={[styles.ebeMarks, { color: h.absent ? colors.warn : pctTone(h.percentage) }]}>
                {h.absent ? t('Absent') : `${num(h.marks)}/${num(h.max_marks)}  ·  ${num(h.percentage)}%`}
              </Text>
            </View>
            <Meter value={h.percentage} color={colors.brand} />
            <View style={{ height: 5 }} />
            <Meter value={h.class_average} color={CLASS} />
          </View>
        ))}
        {picked.exams.length >= 2 ? (
          <TrendChart labels={picked.exams.map(h => h.exam)} values={picked.exams.map(h => h.percentage ?? 0)}
            compare={picked.exams.map(h => h.class_average)} selected={null} onSelect={() => {}} legend={false} />
        ) : null}
      </PCard>
    </>
  );
}

/* ================================================================ motion */

/** 0 → 1 once on mount (bars / meters grow in); instant with reduce motion. */
function useGrow(): Animated.Value {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.timing(v, { toValue: 1, duration: 650, useNativeDriver: true }).start();
  }, [reduce, v]);
  return v;
}

/** The big percentage counts up once. */
function CountUp({ value, style, suffix = '' }: { value: number; style: object; suffix?: string }) {
  const reduce = useReduceMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const a = new Animated.Value(0);
    const id = a.addListener(({ value: x }) => setShown(Math.round(x * value * 10) / 10));
    Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: false }).start(() => setShown(value));
    return () => {
      a.removeListener(id);
      a.stopAnimation();
    };
  }, [value, reduce]);
  return <Text style={style} accessibilityLabel={`${value}${suffix}`}>{num(shown)}{suffix}</Text>;
}

/* ================================================================ styles */

const styles = StyleSheet.create({
  body: { padding: 16, paddingTop: 16 },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, padding: 4, marginTop: 4 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center' },
  tabOn: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, fontWeight: '800' },

  hero: { borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', marginBottom: 12 },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  glowA: { width: 220, height: 220, right: -70, top: -90 },
  glowB: { width: 160, height: 160, left: -60, bottom: -80 },
  sparkle: { position: 'absolute', color: 'rgba(255,255,255,0.55)', fontSize: 14 },
  trophyWrap: { width: 108, alignItems: 'center', justifyContent: 'center' },
  trophyHalo: { position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,201,60,0.18)' },
  laurels: { flexDirection: 'row', gap: 6, marginTop: 2 },
  heroText: { flex: 1, alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '700' },
  heroPct: { color: '#fff', fontSize: 44, fontWeight: '900', letterSpacing: -1, marginVertical: 2 },
  gradePill: { backgroundColor: '#7EE08A', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4 },
  gradeText: { color: '#14532D', fontWeight: '900', fontSize: 14 },
  heroMeta: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: '600', marginTop: 8, textAlign: 'center' },

  quick: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickItem: { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  quickValue: { fontSize: 15, fontWeight: '900', color: colors.ink, marginTop: 3 },
  quickLabel: { fontSize: 10.5, color: colors.subtle, marginTop: 1 },

  card: { marginBottom: 12, padding: 16 },
  cardTitle: { fontSize: 16.5, fontWeight: '900', color: colors.ink, marginBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  titleInRow: { marginBottom: 0, marginLeft: 8 },
  hint: { fontSize: 11.5, color: colors.faint, textAlign: 'center', marginTop: 8 },
  tip: { borderRadius: 12, padding: 10, marginTop: 10 },
  tipTitle: { fontSize: 13.5, fontWeight: '800', color: colors.ink },
  tipText: { fontSize: 12.5, color: colors.subtle, marginTop: 2 },

  legend: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginVertical: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
  legendText: { fontSize: 12.5, color: colors.ink, fontWeight: '600' },
  toggle: { paddingVertical: 4, paddingHorizontal: 6 },

  barsWrap: { flexDirection: 'row', marginTop: 4 },
  yAxis: { width: 36, justifyContent: 'space-between' },
  yTick: { fontSize: 10, color: colors.subtle },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  barRow: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, flexDirection: 'row', alignItems: 'flex-end' },
  barGroup: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { fontSize: 10.5, fontWeight: '800', marginBottom: 3 },
  barPair: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 13, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  xRow: { flexDirection: 'row', marginTop: 6 },
  xLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: colors.ink, fontWeight: '600' },

  sRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  sIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sName: { fontSize: 14.5, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  sRight: { alignItems: 'flex-end', marginHorizontal: 8, minWidth: 74 },
  sPct: { fontSize: 16, fontWeight: '900', color: colors.ink },
  delta: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, marginTop: 2 },
  deltaText: { fontSize: 11, fontWeight: '800', marginLeft: 1 },
  sAvg: { fontSize: 10.5, color: colors.subtle, marginTop: 2 },
  meter: { height: 7, borderRadius: 4, backgroundColor: colors.line, overflow: 'visible' },
  meterFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  meterMark: { position: 'absolute', top: -3, width: 2, height: 13, marginLeft: -1, backgroundColor: colors.ink, borderRadius: 1 },

  examRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  examDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  examName: { fontSize: 14, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  examMeta: { fontSize: 11.5, color: colors.subtle, marginTop: 2 },
  examPct: { fontSize: 15, fontWeight: '900', marginLeft: 8 },
  examGrade: { fontSize: 12, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 8, overflow: 'hidden' },

  rc: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rcGrades: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  rcPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  rcPillText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  rcRemark: { fontSize: 12.5, color: colors.subtle, fontStyle: 'italic', marginTop: 8 },

  radarLabel: { position: 'absolute', width: 90, alignItems: 'center' },
  radarName: { fontSize: 12, fontWeight: '700', color: colors.subtle },
  radarPct: { fontSize: 15, fontWeight: '900' },

  insight: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 10, marginTop: 8, gap: 12 },
  insightIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  insightTitle: { fontSize: 14.5, fontWeight: '900', color: colors.ink },
  insightText: { fontSize: 12.5, color: colors.subtle, marginTop: 1 },

  trendTick: { position: 'absolute', left: 0 },
  area: { position: 'absolute', width: 2 },
  pointLabel: { position: 'absolute', width: 60, alignItems: 'center', borderRadius: 8, paddingVertical: 1 },
  pointText: { fontSize: 11.5, fontWeight: '800' },
  trendX: { position: 'absolute', width: 68, textAlign: 'center', fontSize: 10.5, color: colors.ink, fontWeight: '600' },

  scale: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  scaleItem: { width: '23%', borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 6, alignItems: 'center' },
  scaleGrade: { fontSize: 14, fontWeight: '900', color: colors.ink },
  scaleRange: { fontSize: 10.5, color: colors.subtle },

  chips: { marginBottom: 12, flexGrow: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  chipText: { fontSize: 13, fontWeight: '700' },
  subjectHero: { borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', marginBottom: 12 },
  shName: { color: '#fff', fontSize: 21, fontWeight: '900' },
  shGrade: { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 3, marginTop: 6 },
  shGradeText: { fontWeight: '900', fontSize: 13 },
  shMeta: { color: 'rgba(255,255,255,0.92)', fontSize: 12.5, fontWeight: '600', marginTop: 6 },
  ebe: { paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  ebeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  ebeMarks: { fontSize: 12.5, fontWeight: '800', marginLeft: 8 },
});
