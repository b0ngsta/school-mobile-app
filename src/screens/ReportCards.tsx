import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Empty, ErrorBox, ListSkeleton, Screen, ScreenSkeleton, fmtDate } from '../components/ui';
import { useApi, useI18n } from '../hooks';
import { colors } from '../theme';
import type { ReportCard } from '../types';

const parseGrades = (g: ReportCard['grades']): Record<string, string | number> | null => {
  if (!g) return null;
  try {
    const o = typeof g === 'string' ? JSON.parse(g) : g;
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
};

export default function ReportCards() {
  const { t } = useI18n();
  const { data, error, loading, refreshing, refresh } = useApi<ReportCard[]>('/student/report-cards');
  if (loading) {
    return (
      <ScreenSkeleton>
        <ListSkeleton block={112} count={3} />
      </ScreenSkeleton>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ErrorBox message={error} />
      {!data?.length && <Empty text={t('rc.empty')} />}
      {data?.map(rc => {
        const grades = parseGrades(rc.grades);
        return (
          <Card key={rc.id}>
            <Text style={styles.term}>{rc.term}</Text>
            <Text style={styles.sub}>
              {t('rc.issued', { date: fmtDate(rc.created_at), name: rc.issued_by })}
            </Text>
            {grades && (
              <View style={styles.table}>
                {Object.entries(grades).map(([subject, grade]) => (
                  <View key={subject} style={styles.gradeRow}>
                    <Text style={styles.subject}>{subject}</Text>
                    <Text style={[styles.grade, { color: colors.brand }]}>{String(grade)}</Text>
                  </View>
                ))}
              </View>
            )}
            {rc.remarks ? <Text style={styles.remarks}>“{rc.remarks}”</Text> : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  term: { fontSize: 15, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 2, marginBottom: 8 },
  table: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: 'hidden', marginTop: 4 },
  gradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  subject: { fontSize: 13, color: colors.ink, textTransform: 'capitalize' },
  grade: { fontSize: 13, fontWeight: '700' },
  remarks: { fontSize: 13, color: colors.subtle, fontStyle: 'italic', marginTop: 10 },
});
