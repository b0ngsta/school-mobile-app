import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Card, Empty, ErrorBox, ListSkeleton, Screen, ScreenSkeleton, fmtDate } from '../components/ui';
import { useApi, useI18n } from '../hooks';
import { colors } from '../theme';
import type { Remark } from '../types';

export default function Remarks() {
  const { t } = useI18n();
  const { data, error, loading, refreshing, refresh } = useApi<Remark[]>('/student/remarks');
  if (loading) {
    return (
      <ScreenSkeleton>
        <ListSkeleton lines={2} />
      </ScreenSkeleton>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ErrorBox message={error} />
      {!data?.length && <Empty text={t('remark.empty')} />}
      {data?.map(r => (
        <Card key={r.id}>
          <Text style={styles.remark}>{r.remark}</Text>
          <Text style={styles.meta}>
            {r.by_name} · {fmtDate(r.created_at)}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  remark: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  meta: { fontSize: 12, color: colors.subtle, marginTop: 8 },
});
