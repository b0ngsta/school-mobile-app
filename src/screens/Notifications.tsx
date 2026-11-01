// Notification inbox (students/parents and staff): attendance, fees,
// notices, homework, leave and substitute updates. Tapping one marks it
// read and opens what it is about. The bell in the top bar shows the
// unread count (notifications.ts).
import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Card, Empty, ErrorBox, Icon, ListScreen, ListSkeleton, ScreenSkeleton } from '../components/ui';
import { usePagedApi } from '../hooks';
import { t } from '../i18n';
import { markAllRead, markRead, targetOf } from '../notifications';
import { colors } from '../theme';
import type { AppNotification, ScreenProps } from '../types';

const ICONS: Record<string, string> = {
  attendance: 'calendar-check',
  fee: 'currency-inr',
  notice: 'bullhorn-outline',
  homework: 'book-open-variant',
  leave: 'briefcase-outline',
  substitution_request: 'account-switch-outline',
  substitution_update: 'account-switch-outline',
};

/** "5 min ago" / "3 h ago" / "12 Oct". */
function ago(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return t('just now');
  if (mins < 60) return t('{n} min ago', { n: mins });
  const h = Math.round(mins / 60);
  if (h < 24) return t('{n} h ago', { n: h });
  return `${d.getDate()} ${t('months')[d.getMonth()]}`;
}

export default function Notifications({ navigate, session }: ScreenProps) {
  const isStudent = session.user_type === 'student';
  const list = usePagedApi<AppNotification>('/notifications');

  const open = useCallback(
    (n: AppNotification) => {
      markRead(n);
      list.setItems(items => items?.map(x => (x.id === n.id ? { ...x, read_at: x.read_at || new Date().toISOString() } : x)) ?? items);
      // App's navigate() ignores routes this build doesn't have.
      const target = targetOf(n, isStudent, () => true);
      if (target) navigate(target.route, target.params);
    },
    // list.setItems is stable (useState setter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isStudent, navigate],
  );

  const readAll = async () => {
    try {
      await markAllRead();
      list.reload();
    } catch {}
  };

  if (!list.ready && !list.error) {
    return (
      <ScreenSkeleton>
        <ListSkeleton icon lines={2} count={6} />
      </ScreenSkeleton>
    );
  }

  const hasUnread = list.items?.some(n => !n.read_at);

  return (
    <ListScreen
      data={list.items}
      keyExtractor={n => n.id}
      header={
        <>
          <ErrorBox message={list.error} />
          <View style={styles.bar}>
            <Button
              label={`📢 ${t('Notice board')}`}
              kind="ghost"
              small
              onPress={() => navigate(isStudent ? 'Notices' : 'StaffNotices')}
            />
            {hasUnread ? <Button label={t('Mark all read')} kind="soft" small onPress={readAll} /> : null}
          </View>
        </>
      }
      empty={<Empty icon="🔔" text={t('No notifications yet.')} />}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onEndReached={list.loadMore}
      loadingMore={list.loadingMore}
      renderItem={n => (
        <TouchableOpacity activeOpacity={0.7} onPress={() => open(n)}>
          <Card style={[styles.row, !n.read_at && { backgroundColor: colors.brandFaint }]}>
            <View style={[styles.icon, { backgroundColor: colors.brandSoft }]}>
              <Icon icon={ICONS[n.type] || 'bell-outline'} size={19} color={colors.brand} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.title, !n.read_at && { fontWeight: '800' }]}>{n.title}</Text>
              {n.body ? <Text style={styles.body}>{n.body}</Text> : null}
              <Text style={styles.time}>{ago(n.created_at)}</Text>
            </View>
            {!n.read_at ? <View style={[styles.dot, { backgroundColor: colors.brand }]} /> : null}
          </Card>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink },
  body: { fontSize: 12.5, color: colors.subtle, marginTop: 2 },
  time: { fontSize: 11, color: colors.faint, marginTop: 4 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6, marginLeft: 6 },
});
