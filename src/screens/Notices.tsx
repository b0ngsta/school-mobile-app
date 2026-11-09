// Notice Board: the school's notices (timetable changed, PTM date, a test,
// new information), newest first and numbered. A notice may carry a PDF /
// photo; tap a notice for the full text and the attachment (NoticeDetail).
// Data: GET /student/notices (paged)
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DATE_TONES, DateBox, ListHeaderBleed, PCard, Pill, PortalHeader } from '../components/portal';
import { fileKind } from '../components/files';
import { Empty, ErrorBox, ListScreen, ListSkeleton } from '../components/ui';
import { fmtDateTime } from '../format';
import { useI18n, usePagedApi } from '../hooks';
import { colors } from '../theme';
import type { Notice, ScreenProps } from '../types';

export default function Notices({ navigate, goBack }: ScreenProps) {
  const { t } = useI18n();
  const list = usePagedApi<Notice>('/student/notices');
  const total = list.total ?? list.items?.length ?? 0;
  // "#4" = position from the oldest; index = position in this (newest-first) list
  const position = useMemo(() => new Map((list.items || []).map((n, i) => [n.id, i])), [list.items]);

  return (
    <ListScreen
      data={list.items}
      keyExtractor={n => n.id}
      header={
        <>
          <ListHeaderBleed>
            <PortalHeader title={t('Notice Board')} onBack={goBack}
              subtitle={list.items ? t(total === 1 ? '{n} notice' : '{n} notices', { n: total }) : null} />
          </ListHeaderBleed>
          <ErrorBox message={list.error} />
          {!list.items && !list.error ? <ListSkeleton count={3} icon lines={2} /> : null}
        </>
      }
      empty={<Empty icon="bullhorn-outline" text={t('notice.empty')} />}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onEndReached={list.loadMore}
      loadingMore={list.loadingMore}
      renderItem={n => {
        const i = position.get(n.id) ?? 0;
        return (
          <NoticeCard notice={n} number={total - i} tone={DATE_TONES[i % DATE_TONES.length]}
            onPress={() => navigate('NoticeDetail', { id: n.id, notice: n })} />
        );
      }}
    />
  );
}

function NoticeCard({ notice: n, number, tone, onPress }: {
  notice: Notice;
  number: number;
  tone: (typeof DATE_TONES)[number];
  onPress: () => void;
}) {
  const { t } = useI18n();
  const kind = n.attachment_path ? fileKind(n.attachment_path, n.attachment_type) : null;
  return (
    <PCard onPress={onPress} style={styles.card} accessibilityLabel={n.title}>
      <DateBox date={n.created_at} tone={tone} />
      <View style={styles.text}>
        <Text style={styles.number}>#{number}</Text>
        <Text style={styles.title} numberOfLines={2}>{n.title}</Text>
        <View style={styles.posted}>
          <MCIcon name="clock-outline" size={15} color={colors.subtle} />
          <Text style={styles.postedText}>{t('Posted: {when}', { when: fmtDateTime(n.created_at) })}</Text>
        </View>
        {n.body ? <Text style={styles.body} numberOfLines={2}>{n.body}</Text> : null}
        {kind ? (
          <View style={styles.pills}>
            {kind === 'pdf' ? (
              <Pill icon="file-pdf-box" label={t('PDF attached')} fg={colors.danger} bg={colors.dangerSoft} />
            ) : (
              <Pill icon="image" label={t('Image attached')} fg="#2563EB" bg="#E8F0FE" />
            )}
          </View>
        ) : null}
      </View>
      <MCIcon name="chevron-right" size={26} color={colors.subtle} />
    </PCard>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, borderWidth: 1, borderColor: colors.line },
  text: { flex: 1, marginHorizontal: 12 },
  number: { fontSize: 13, color: colors.subtle, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 2 },
  posted: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  postedText: { flexShrink: 1, fontSize: 12.5, color: colors.subtle, marginLeft: 5, fontWeight: '600' },
  body: { fontSize: 15, color: colors.ink, marginTop: 8, lineHeight: 21 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
});
