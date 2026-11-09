// Notice Board: the school's notices (timetable changed, PTM date, a test,
// new information), newest first and numbered. A notice may carry a PDF /
// photo; tap a notice for the full text and the attachment (NoticeDetail).
// Data: GET /student/notices (paged) — only the whole-school notices and the
// ones for the child's class (backend 0018). The same list draws the class
// teachers' announcements (portal/ClassAnnouncements.tsx) via `NoticeList`.
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
  return (
    <NoticeList path="/student/notices" title={t('Notice Board')} emptyText={t('notice.empty')}
      icon="bullhorn-outline" goBack={goBack}
      onOpen={n => navigate('NoticeDetail', { id: n.id, notice: n })} />
  );
}

/** Numbered, newest-first list of notice-like posts (notices, class announcements). */
export function NoticeList({ path, title, emptyText, icon, goBack, onOpen, showAudience = 'classes', countText }: {
  path: string;
  title: string;
  emptyText: string;
  icon: string;
  goBack: () => void;
  onOpen: (n: Notice) => void;
  /** 'classes' = a "For Class 1" pill on class-only notices; 'always' = the label on every row. */
  showAudience?: 'classes' | 'always';
  /** Header subtitle for `n` rows (default "{n} notices"). */
  countText?: (n: number) => string;
}) {
  const { t } = useI18n();
  const list = usePagedApi<Notice>(path);
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
            <PortalHeader title={title} onBack={goBack}
              subtitle={list.items
                ? countText ? countText(total) : t(total === 1 ? '{n} notice' : '{n} notices', { n: total })
                : null} />
          </ListHeaderBleed>
          <ErrorBox message={list.error} />
          {!list.items && !list.error ? <ListSkeleton count={3} icon lines={2} /> : null}
        </>
      }
      empty={<Empty icon={icon} text={emptyText} />}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onEndReached={list.loadMore}
      loadingMore={list.loadingMore}
      renderItem={n => {
        const i = position.get(n.id) ?? 0;
        return (
          <NoticeCard notice={n} number={total - i} tone={DATE_TONES[i % DATE_TONES.length]}
            showAudience={showAudience} onPress={() => onOpen(n)} />
        );
      }}
    />
  );
}

function NoticeCard({ notice: n, number, tone, showAudience, onPress }: {
  notice: Notice;
  number: number;
  tone: (typeof DATE_TONES)[number];
  showAudience: 'classes' | 'always';
  onPress: () => void;
}) {
  const { t } = useI18n();
  const kind = n.attachment_path ? fileKind(n.attachment_path, n.attachment_type) : null;
  const forClasses = n.audience_label && (showAudience === 'always' || n.audience === 'classes');
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
        {kind || forClasses ? (
          <View style={styles.pills}>
            {forClasses ? (
              <Pill icon="account-group-outline" label={t('For {who}', { who: n.audience_label || '' })}
                fg={colors.brand} bg={colors.brandSoft} />
            ) : null}
            {!kind ? null : kind === 'pdf' ? (
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
  pills: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 6 },
});
