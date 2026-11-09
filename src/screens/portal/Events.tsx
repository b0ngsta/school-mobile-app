// School events: Upcoming / Completed tabs. Each event shows its dates,
// time, venue and details; completed events also show photos (tap → the
// FileViewer) and video links (open in YouTube / the browser).
// Data: GET /events?status=upcoming|completed (paged; any signed-in user)
import React, { useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { photoUrl } from '../../api';
import { openFile } from '../../components/files';
import { DateBox, ListHeaderBleed, PCard, PortalHeader } from '../../components/portal';
import { Empty, ErrorBox, ListScreen, ListSkeleton } from '../../components/ui';
import { fmtDate, fmtTime } from '../../format';
import { useI18n, usePagedApi } from '../../hooks';
import { colors } from '../../theme';
import type { NavigateFn, SchoolEvent, ScreenProps } from '../../types';

type Tab = 'upcoming' | 'completed';

export default function Events({ navigate, goBack }: ScreenProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('upcoming');
  const list = usePagedApi<SchoolEvent>(`/events?status=${tab}`);

  return (
    <ListScreen
      data={list.items}
      keyExtractor={e => e.id}
      header={
        <>
          <ListHeaderBleed>
            <PortalHeader title={t('Events')} onBack={goBack}>
              <View style={styles.tabs}>
                {(['upcoming', 'completed'] as Tab[]).map(v => (
                  <TouchableOpacity key={v} onPress={() => setTab(v)} activeOpacity={0.8}
                    style={[styles.tab, tab === v && styles.tabOn]} accessibilityRole="tab" testID={`events-tab-${v}`}
                    accessibilityState={{ selected: tab === v }}>
                    <MCIcon name={v === 'upcoming' ? 'calendar-clock' : 'calendar-check'} size={20}
                      color={tab === v ? colors.brand : '#fff'} />
                    <Text style={[styles.tabText, { color: tab === v ? colors.brand : '#fff' }]}>
                      {v === 'upcoming' ? t('Upcoming') : t('Completed')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </PortalHeader>
          </ListHeaderBleed>
          <ErrorBox message={list.error} />
          {!list.items && !list.error ? <ListSkeleton count={3} icon lines={2} /> : null}
        </>
      }
      empty={<Empty icon="party-popper" text={tab === 'upcoming' ? t('No upcoming events.') : t('No completed events yet.')} />}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onEndReached={list.loadMore}
      loadingMore={list.loadingMore}
      renderItem={e => <EventCard event={e} navigate={navigate} />}
    />
  );
}

function EventCard({ event: e, navigate }: { event: SchoolEvent; navigate: NavigateFn }) {
  const { t } = useI18n();
  const range = e.end_date && e.end_date !== e.start_date ? `${fmtDate(e.start_date)} – ${fmtDate(e.end_date)}` : fmtDate(e.start_date);
  const time = e.start_time ? `${fmtTime(e.start_time)}${e.end_time ? ` – ${fmtTime(e.end_time)}` : ''}` : null;
  const photos = e.media.filter(m => m.kind === 'image' && m.media_path);
  const videos = e.media.filter(m => m.kind === 'video' && m.url);
  return (
    <PCard>
      <View style={styles.top}>
        <DateBox date={e.start_date} tone={e.status === 'upcoming' ? 'violet' : 'muted'} />
        <View style={styles.head}>
          <Text style={styles.title}>{e.title}</Text>
          <Meta icon="calendar-range" text={range} />
          {time ? <Meta icon="clock-outline" text={time} /> : null}
          {e.venue ? <Meta icon="map-marker-outline" text={e.venue} /> : null}
        </View>
      </View>
      {e.description ? <Text style={styles.desc}>{e.description}</Text> : null}
      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
          {photos.map(p => (
            <TouchableOpacity key={p.id} activeOpacity={0.85} accessibilityRole="imagebutton"
              accessibilityLabel={p.caption || t('Event photo')}
              onPress={() => openFile(navigate, { path: p.media_path!, type: 'image', name: p.caption || e.title })}>
              <Image source={{ uri: photoUrl(p.media_path) || undefined }} style={styles.photo} accessibilityIgnoresInvertColors />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
      {videos.map(v => (
        <TouchableOpacity key={v.id} style={styles.video} onPress={() => v.url && Linking.openURL(v.url).catch(() => {})}
          accessibilityRole="link">
          <MCIcon name="play-circle" size={26} color={colors.danger} />
          <Text style={styles.videoText} numberOfLines={1}>{v.caption || t('Watch video')}</Text>
          <MCIcon name="open-in-new" size={20} color={colors.subtle} />
        </TouchableOpacity>
      ))}
    </PCard>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.meta}>
      <MCIcon name={icon} size={15} color={colors.subtle} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 18, padding: 5 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14 },
  tabOn: { backgroundColor: '#fff' },
  tabText: { fontSize: 15.5, fontWeight: '800', marginLeft: 8 },
  top: { flexDirection: 'row', padding: 16, paddingBottom: 10 },
  head: { flex: 1, marginLeft: 14 },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaText: { fontSize: 13.5, color: colors.subtle, marginLeft: 6, flexShrink: 1 },
  desc: { fontSize: 15, lineHeight: 21, color: colors.ink, paddingHorizontal: 16, paddingBottom: 14 },
  photos: { paddingHorizontal: 16, paddingBottom: 14 },
  photo: { width: 110, height: 110, borderRadius: 14, marginRight: 10, backgroundColor: colors.page },
  video: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line },
  videoText: { flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.ink, marginLeft: 10 },
});
