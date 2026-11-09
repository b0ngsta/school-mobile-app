// Messages from the school / class teacher to this parent (new timetable,
// PTM date, subject updates…), newest first, grouped by day; a dot marks the
// unread ones. Tap → MessageDetail (marks it read).
// Params: { id? } — a notification opens that message straight away.
// Data: GET /student/messages (paged)
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { peek, photoUrl } from '../../api';
import { ListHeaderBleed, PCard, PortalHeader } from '../../components/portal';
import { Avatar, Empty, ErrorBox, ListScreen, ListSkeleton } from '../../components/ui';
import { fmtTime } from '../../format';
import { useI18n, useOnReturn, usePagedApi } from '../../hooks';
import { colors } from '../../theme';
import type { ScreenProps, StudentDashboard, StudentMessage } from '../../types';
import DayHeading, { firstOfDay } from './DayHeading';

export default function Messages({ navigate, goBack, params, session }: ScreenProps) {
  const { t } = useI18n();
  const list = usePagedApi<StudentMessage>('/student/messages');
  const firsts = useMemo(() => firstOfDay(list.items, m => m.created_at), [list.items]);
  const total = list.total ?? list.items?.length ?? 0;
  const me = peek<StudentDashboard>('/student/dashboard')?.profile;
  useOnReturn(list.reload); // read state changes in MessageDetail

  // opened from a notification: go to that message once
  const opened = useRef(false);
  useEffect(() => {
    if (params?.id && !opened.current) {
      opened.current = true;
      navigate('MessageDetail', { id: params.id });
    }
  }, [params?.id, navigate]);

  return (
    <ListScreen
      data={list.items}
      keyExtractor={m => m.id}
      header={
        <>
          <ListHeaderBleed>
            <PortalHeader title={t('Messages')} onBack={goBack}
              subtitle={list.items ? t(total === 1 ? '{n} message' : '{n} messages', { n: total }) : null} />
          </ListHeaderBleed>
          <ErrorBox message={list.error} />
          {!list.items && !list.error ? <ListSkeleton count={3} avatar={52} lines={2} /> : null}
        </>
      }
      empty={<Empty icon="message-text-outline" text={t('No messages yet.')} />}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onEndReached={list.loadMore}
      loadingMore={list.loadingMore}
      renderItem={m => (
        <View>
          {firsts.has(m.id) ? <DayHeading date={m.created_at} line /> : null}
          <PCard style={[styles.card, { borderColor: m.read_at ? colors.line : colors.brand + '55' }]}
            onPress={() => navigate('MessageDetail', { id: m.id, message: m })} accessibilityLabel={m.title}>
            <Avatar name={session.full_name} uri={photoUrl(me?.photo_path)} size={52} />
            <View style={styles.text}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, !m.read_at && styles.unreadTitle]} numberOfLines={1}>{m.title}</Text>
                <Text style={[styles.time, { color: colors.brand }]}>{fmtTime(m.created_at)}</Text>
              </View>
              <Text style={styles.body} numberOfLines={2}>{m.body}</Text>
              <View style={styles.toRow}>
                <MCIcon name="send" size={14} color={colors.subtle} />
                <Text style={styles.to} numberOfLines={1}>{t('To: {name}', { name: (session.full_name || '').toUpperCase() })}</Text>
                {m.attachment_path ? <MCIcon name="paperclip" size={16} color={colors.subtle} style={styles.clip} /> : null}
                <View style={styles.flex} />
                {!m.read_at ? <View style={[styles.dot, { backgroundColor: colors.brand }]} accessibilityLabel={t('Unread')} /> : null}
              </View>
            </View>
          </PCard>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { flexDirection: 'row', padding: 16, borderWidth: 1.5 },
  text: { flex: 1, marginLeft: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.ink },
  unreadTitle: { fontWeight: '800' },
  time: { fontSize: 13, fontWeight: '700', marginLeft: 8 },
  body: { fontSize: 14.5, color: colors.subtle, marginTop: 4, lineHeight: 20 },
  toRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  to: { fontSize: 13, color: colors.subtle, marginLeft: 6, flexShrink: 1 },
  clip: { marginLeft: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
