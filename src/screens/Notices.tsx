import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Card, Empty, ErrorBox, ListScreen, ListSkeleton, ScreenSkeleton, fmtDate } from '../components/ui';
import { useI18n, usePagedApi } from '../hooks';
import { colors } from '../theme';
import type { Notice } from '../types';

export default function Notices() {
  const { t } = useI18n();
  const list = usePagedApi<Notice>('/student/notices');
  if (!list.items && !list.error) {
    return (
      <ScreenSkeleton>
        <ListSkeleton lines={3} />
      </ScreenSkeleton>
    );
  }

  return (
    <ListScreen
      data={list.items}
      keyExtractor={n => n.id}
      header={<ErrorBox message={list.error} />}
      empty={<Empty text={t('notice.empty')} />}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onEndReached={list.loadMore}
      loadingMore={list.loadingMore}
      renderItem={n => (
        <Card>
          <Text style={styles.title}>{n.title}</Text>
          <Text style={styles.meta}>
            {n.posted_by} · {fmtDate(n.created_at)}
          </Text>
          <Text style={styles.body}>{n.body}</Text>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 12, color: colors.subtle, marginTop: 2, marginBottom: 8 },
  body: { fontSize: 13, color: colors.ink, lineHeight: 19 },
});
