import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card, Empty, ErrorBox, ListSkeleton, Screen, ScreenSkeleton, fmtDate } from '../components/ui';
import { useApi, useI18n } from '../hooks';
import { colors } from '../theme';
import type { Exam } from '../types';

/** 92 → "92", 92.5 → "92.5", with " / max" when the maximum is known. */
function marksText(n: number | string, max?: number | string | null): string {
  const show = (v: number | string) => {
    const x = Number(v);
    return Number.isFinite(x) ? String(Math.round(x * 100) / 100) : String(v);
  };
  return max != null ? `${show(n)} / ${show(max)}` : show(n);
}

const show = (v: number | string) => {
  const x = Number(v);
  return Number.isFinite(x) ? String(Math.round(x * 100) / 100) : String(v);
};

/** 46 of 50 → 92 (one decimal), null without a maximum. */
function pct(n: number | string | null | undefined, max: number | string | null | undefined): number | null {
  const a = Number(n);
  const b = Number(max);
  if (n == null || max == null || !Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return Math.round((a * 1000) / b) / 10;
}

const pctColor = (p: number) => (p >= 75 ? colors.ok : p >= 40 ? colors.ink : colors.danger);

// One card per exam; published results as a simple table (Nov 2026):
// Subject | Marks | Out of | % | Grade, with the total underneath. The
// session-wide picture (charts, trends) is the Performance Report screen.
export default function Exams() {
  const { t } = useI18n();
  const { data, error, loading, refreshing, refresh } = useApi<Exam[]>('/student/exams');
  if (loading) {
    return (
      <ScreenSkeleton>
        <ListSkeleton badge="right" block={58} count={3} />
      </ScreenSkeleton>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ErrorBox message={error} />
      {!data?.length && <Empty text={t('exam.empty')} />}
      {data?.map(e => (
        <Card key={e.id}>
          <View style={styles.head}>
            <Text style={styles.name}>{e.name}</Text>
            <Badge status={e.status} />
          </View>
          <Text style={styles.dates}>
            {fmtDate(e.start_date)} – {fmtDate(e.end_date)}
          </Text>
          {e.results_published ? (
            <View>
              <View style={[styles.result, { backgroundColor: colors.brandSoft }]}>
                <Text style={[styles.resultLabel, { color: colors.brand }]}>{t('exam.result')}</Text>
                <Text style={styles.resultValue}>
                  {e.marks != null ? t('exam.marks', { n: marksText(e.marks, e.max_marks) }) : t('exam.notEntered')}
                  {e.grade ? ` · ${t('exam.grade', { g: e.grade })}` : ''}
                  {pct(e.marks, e.max_marks) != null ? `  (${pct(e.marks, e.max_marks)}%)` : ''}
                </Text>
                {e.remarks ? <Text style={styles.remarks}>{e.remarks}</Text> : null}
              </View>
              {e.subjects?.length ? (
                <View style={styles.table} testID={`exam-subjects-${e.id}`}>
                  <View style={[styles.tr, styles.thRow, { backgroundColor: colors.brand }]}>
                    <Text style={[styles.th, styles.subjectCol]}>{t('Subject')}</Text>
                    <Text style={[styles.th, styles.numCol]}>{t('Marks')}</Text>
                    <Text style={[styles.th, styles.numCol]}>{t('Out of')}</Text>
                    <Text style={[styles.th, styles.numCol]}>%</Text>
                    <Text style={[styles.th, styles.gradeCol]}>{t('Grade')}</Text>
                  </View>
                  {e.subjects.map((sub, i) => {
                    const absent = sub.marks == null && (sub.grade || '').toUpperCase() === 'AB';
                    const p = pct(sub.marks, sub.max_marks);
                    return (
                      <View key={sub.subject} style={[styles.tr, i % 2 === 1 && { backgroundColor: colors.page }]}>
                        <Text style={[styles.td, styles.subjectCol]} numberOfLines={2}>{sub.subject}</Text>
                        <Text style={[styles.td, styles.numCol, styles.strong, absent && { color: colors.warn }]}>
                          {absent ? t('Absent') : sub.marks != null ? show(sub.marks) : '—'}
                        </Text>
                        <Text style={[styles.td, styles.numCol]}>{sub.max_marks != null ? show(sub.max_marks) : '—'}</Text>
                        <Text style={[styles.td, styles.numCol, p != null && { color: pctColor(p) }]}>{p != null ? p : '—'}</Text>
                        <Text style={[styles.td, styles.gradeCol]}>{absent ? 'AB' : sub.grade || '—'}</Text>
                      </View>
                    );
                  })}
                  {e.total != null ? (
                    <View style={[styles.tr, styles.totalRow, { backgroundColor: colors.brandFaint }]}>
                      <Text style={[styles.td, styles.subjectCol, styles.strong]}>{t('exam.total')}</Text>
                      <Text style={[styles.td, styles.numCol, styles.strong]}>{show(e.total)}</Text>
                      <Text style={[styles.td, styles.numCol, styles.strong]}>{e.max_total != null ? show(e.max_total) : '—'}</Text>
                      <Text style={[styles.td, styles.numCol, styles.strong]}>{pct(e.total, e.max_total) ?? '—'}</Text>
                      <Text style={[styles.td, styles.gradeCol]} />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.pending}>{t('exam.notPublished')}</Text>
          )}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink, flex: 1, paddingRight: 8 },
  dates: { fontSize: 12, color: colors.subtle, marginTop: 4 },
  result: { borderRadius: 10, padding: 10, marginTop: 10 },
  resultLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  resultValue: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 2 },
  remarks: { fontSize: 12, color: colors.subtle, marginTop: 4 },
  table: { marginTop: 10, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 36 },
  thRow: { minHeight: 34 },
  th: { color: '#fff', fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase' },
  td: { fontSize: 13, color: colors.ink, paddingVertical: 8 },
  subjectCol: { flex: 1.8, paddingRight: 4 },
  numCol: { flex: 1, textAlign: 'center' },
  gradeCol: { flex: 0.9, textAlign: 'center', fontWeight: '700' },
  strong: { fontWeight: '800' },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.line },
  pending: { fontSize: 12, color: colors.subtle, fontStyle: 'italic', marginTop: 10 },
});
