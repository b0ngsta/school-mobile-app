import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Bone,
  Card,
  Empty,
  ErrorBox,
  Row,
  RowsSkeleton,
  Screen,
  ScreenSkeleton,
  SectionTitle,
  SectionTitleSkeleton,
} from '../components/ui';
import { fmtDate } from '../components/ui';
import { useApi, useI18n } from '../hooks';
import { colors } from '../theme';
import type { AttendanceResponse } from '../types';

export default function Attendance() {
  const { t } = useI18n();
  const { data, error, loading, refreshing, refresh } = useApi<AttendanceResponse>('/student/attendance');
  if (loading) {
    return (
      <ScreenSkeleton>
        <Card>
          <Bone width={110} height={13} />
          <Bone width={96} height={32} style={{ marginTop: 16, marginBottom: 12 }} />
          <View style={styles.split}>
            <Bone width={78} height={12} />
            <Bone width={84} height={12} />
            <Bone width={62} height={12} />
          </View>
        </Card>
        <SectionTitleSkeleton />
        <RowsSkeleton count={6} badge />
      </ScreenSkeleton>
    );
  }

  const s = data?.summary;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ErrorBox message={error} />
      {s && (
        <Card>
          <SectionTitle>{t('att.overall')}</SectionTitle>
          <Text style={styles.big}>{s.percent != null ? `${s.percent}%` : t('att.noRecords')}</Text>
          <View style={styles.split}>
            <Text style={[styles.num, { color: colors.ok }]}>{t('att.present', { n: s.present })}</Text>
            <Text style={[styles.num, { color: colors.danger }]}>{t('att.absent', { n: s.absent })}</Text>
            <Text style={[styles.num, { color: colors.warn }]}>{t('att.leave', { n: s.on_leave })}</Text>
          </View>
        </Card>
      )}
      <SectionTitle>{t('att.last90')}</SectionTitle>
      {data?.records?.length ? (
        <Card>
          {data.records.map(r => (
            <Row key={r.date} left={fmtDate(r.date)} right={<Badge status={r.status} />} />
          ))}
        </Card>
      ) : (
        <Empty text={t('att.notMarked')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 32, fontWeight: '800', color: colors.ink, marginBottom: 8 },
  split: { flexDirection: 'row', justifyContent: 'space-between' },
  num: { fontSize: 13, fontWeight: '600' },
});
