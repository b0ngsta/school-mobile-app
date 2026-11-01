import React from 'react';
import { Text } from 'react-native';
import { Badge, Card, Empty, ErrorBox, ListScreen, ListSkeleton, ScreenSkeleton, fmtDate } from '../components/ui';
import { useI18n, usePagedApi } from '../hooks';
import { colors } from '../theme';
import type { HomeworkItem } from '../types';

export default function Homework() {
  const { t } = useI18n();
  const list = usePagedApi<HomeworkItem>('/student/homework');
  if (!list.items && !list.error) {
    return (
      <ScreenSkeleton>
        <ListSkeleton lines={2} badge="below" />
      </ScreenSkeleton>
    );
  }

  return (
    <ListScreen
      data={list.items}
      keyExtractor={h => `${h.scope || 'student'}-${h.id}`}
      header={<ErrorBox message={list.error} />}
      empty={<Empty text={t('hw.empty')} />}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onEndReached={list.loadMore}
      loadingMore={list.loadingMore}
      renderItem={h => (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 6 }}>{h.title}</Text>
          {h.subject ? <Text style={{ color: colors.brand, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>{h.subject}</Text> : null}
          {h.note ? <Text style={{ color: colors.subtle, fontSize: 13, marginBottom: 8 }}>{h.note}</Text> : null}
          <Text style={{ color: colors.subtle, fontSize: 12, marginBottom: 8 }}>
            {t('hw.due', { date: fmtDate(h.due_date), name: h.assigned_by })}
          </Text>
          <Badge status={h.status} />
        </Card>
      )}
    />
  );
}
