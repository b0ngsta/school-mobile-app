import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card, Empty, ErrorBox, ListSkeleton, Screen, ScreenSkeleton, fmtDate } from '../components/ui';
import { useApi, useI18n } from '../hooks';
import { colors } from '../theme';
import type { Exam } from '../types';

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
            <View style={[styles.result, { backgroundColor: colors.brandSoft }]}>
              <Text style={[styles.resultLabel, { color: colors.brand }]}>{t('exam.result')}</Text>
              <Text style={styles.resultValue}>
                {e.marks != null ? t('exam.marks', { n: e.marks }) : t('exam.notEntered')}
                {e.grade ? ` · ${t('exam.grade', { g: e.grade })}` : ''}
              </Text>
              {e.remarks ? <Text style={styles.remarks}>{e.remarks}</Text> : null}
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
  pending: { fontSize: 12, color: colors.subtle, fontStyle: 'italic', marginTop: 10 },
});
