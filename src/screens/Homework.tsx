// Student homework by day: the header shows the chosen day (today first) and
// how much homework was given that day; the calendar icon or the date card
// picks another day. "By Subject" (bottom-right) lists the class's subjects
// (HomeworkSubjects → HomeworkSubject). Each entry can carry the teacher's
// sheet (PDF / photo), opened in the common FileViewer.
// Data: GET /student/homework?date=YYYY-MM-DD (paged).
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { CalendarModal } from '../components/pickers';
import { HeaderIcon, ListHeaderBleed, PortalHeader } from '../components/portal';
import { ErrorBox, ListScreen, ListSkeleton } from '../components/ui';
import { fmtDayLong, localIsoDate, parseDate } from '../format';
import { useI18n, usePagedApi } from '../hooks';
import { colors, shadow } from '../theme';
import type { HomeworkItem, ScreenProps } from '../types';
import HomeworkCard, { homeworkKey } from './portal/HomeworkCard';

export default function Homework({ navigate, goBack }: ScreenProps) {
  const { t } = useI18n();
  const today = localIsoDate();
  const [day, setDay] = useState(today);
  const [picking, setPicking] = useState(false);
  const list = usePagedApi<HomeworkItem>(`/student/homework?date=${day}`);
  const d = parseDate(day) || new Date();
  const count = list.total ?? list.items?.length ?? 0;

  const header = (
    <PortalHeader
      title={day === today ? t("Today's Homework") : t('Homework')}
      onBack={goBack}
      right={<HeaderIcon icon="calendar-month" label={t('Pick a date')} onPress={() => setPicking(true)} />}>
      <TouchableOpacity style={styles.dateCard} activeOpacity={0.8} onPress={() => setPicking(true)}
        accessibilityRole="button" accessibilityLabel={t('Pick a date')}>
        <View style={styles.dateBox}>
          <Text style={[styles.dateMon, { color: colors.brand }]}>{t('months')[d.getMonth()].toUpperCase()}</Text>
          <Text style={styles.dateDay}>{d.getDate()}</Text>
        </View>
        <View style={styles.dateText}>
          <Text style={styles.dateLong}>{fmtDayLong(day)}</Text>
          <Text style={[styles.dateSub, { color: colors.onBrandSub }]}>
            {list.items ? t('{n} homeworks assigned', { n: count }) : t('Loading…')}
          </Text>
        </View>
        <MCIcon name="chevron-down" size={26} color="#fff" />
      </TouchableOpacity>
    </PortalHeader>
  );

  return (
    <View style={styles.flex}>
      <ListScreen
        data={list.items}
        keyExtractor={homeworkKey}
        header={
          <View>
            <ListHeaderBleed>{header}</ListHeaderBleed>
            <ErrorBox message={list.error} />
            {!list.items && !list.error ? <ListSkeleton count={2} icon lines={2} /> : null}
          </View>
        }
        empty={<NoHomework text={t('No homework for this day')} />}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        renderItem={h => <HomeworkCard h={h} navigate={navigate} />}
        footer={<View style={styles.fabSpace} />}
      />
      <TouchableOpacity style={[styles.fab, shadow.pop, { backgroundColor: colors.brand }]} activeOpacity={0.85}
        onPress={() => navigate('HomeworkSubjects')} accessibilityRole="button" accessibilityLabel={t('By Subject')}>
        <MCIcon name="book-open-page-variant" size={24} color="#fff" />
        <Text style={styles.fabText}>{t('By Subject')}</Text>
      </TouchableOpacity>
      <CalendarModal
        visible={picking}
        title={t('Homework given on')}
        value={day}
        max={today}
        onClose={() => setPicking(false)}
        onPick={v => {
          setPicking(false);
          if (v) setDay(v);
        }}
      />
    </View>
  );
}

function NoHomework({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.brandSoft }]}>
        <MCIcon name="clipboard-check-outline" size={54} color={colors.brand} />
      </View>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 22,
    padding: 12,
  },
  dateBox: { width: 64, height: 64, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  dateMon: { fontSize: 13, fontWeight: '800' },
  dateDay: { fontSize: 24, fontWeight: '800', color: colors.ink, lineHeight: 28 },
  dateText: { flex: 1, marginHorizontal: 14 },
  dateLong: { color: '#fff', fontSize: 18, fontWeight: '800' },
  dateSub: { fontSize: 14, marginTop: 3 },
  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyIcon: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center' },
  emptyText: { marginTop: 18, fontSize: 16, color: colors.subtle },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 20,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 10 },
  fabSpace: { height: 80 },
});
