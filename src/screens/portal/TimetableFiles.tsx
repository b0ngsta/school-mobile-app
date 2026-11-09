// Time Table: what the school shared — exam date-sheets, a new class
// timetable (PDF or photo), newest first, grouped by day; tap a file to open
// it in the FileViewer. The weekly period timetable stays one tap away.
// Data: GET /student/documents?kind=timetable (paged)
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { openFile } from '../../components/files';
import { AttachmentRow, DateBox, ListHeaderBleed, PCard, PortalHeader } from '../../components/portal';
import { Empty, ErrorBox, ListScreen, ListSkeleton } from '../../components/ui';
import { fmtDate } from '../../format';
import { useI18n, usePagedApi } from '../../hooks';
import { colors } from '../../theme';
import type { SchoolDocument, ScreenProps } from '../../types';
import DayHeading, { firstOfDay } from './DayHeading';

export default function TimetableFiles({ navigate, goBack }: ScreenProps) {
  const { t } = useI18n();
  const list = usePagedApi<SchoolDocument>('/student/documents?kind=timetable');
  const firsts = useMemo(() => firstOfDay(list.items, d => d.created_at), [list.items]);
  const count = list.total ?? list.items?.length;

  return (
    <ListScreen
      data={list.items}
      keyExtractor={d => d.id}
      header={
        <>
          <ListHeaderBleed>
            <PortalHeader title={t('Time Table')} onBack={goBack}
              subtitle={count != null ? t(count === 1 ? '{n} time table shared' : '{n} time tables shared', { n: count }) : null} />
          </ListHeaderBleed>
          <PCard onPress={() => navigate('WeeklyTimetable')} style={styles.weekly} accessibilityLabel={t('Weekly class timetable')}>
            <View style={[styles.weeklyIcon, { backgroundColor: colors.brandSoft }]}>
              <MCIcon name="timetable" size={24} color={colors.brand} />
            </View>
            <View style={styles.weeklyText}>
              <Text style={styles.weeklyTitle}>{t('Weekly class timetable')}</Text>
              <Text style={styles.weeklySub}>{t('Periods, subjects and teachers')}</Text>
            </View>
            <MCIcon name="chevron-right" size={24} color={colors.faint} />
          </PCard>
          <ErrorBox message={list.error} />
          {!list.items && !list.error ? <ListSkeleton count={2} icon lines={2} /> : null}
        </>
      }
      empty={<Empty icon="calendar-blank-outline" text={t('No time table shared yet.')} />}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onEndReached={list.loadMore}
      loadingMore={list.loadingMore}
      renderItem={d => (
        <View>
          {firsts.has(d.id) ? <DayHeading date={d.created_at} /> : null}
          <DocumentCard doc={d} onOpen={() => openFile(navigate, { path: d.attachment_path!, type: d.attachment_type, name: d.attachment_name })} />
        </View>
      )}
    />
  );
}

/** A shared document: date box, title, date, note, the file row. */
export function DocumentCard({ doc, onOpen }: { doc: SchoolDocument; onOpen: () => void }) {
  return (
    <PCard>
      <View style={styles.top}>
        <DateBox date={doc.created_at} tone="danger" showYear={false} />
        <View style={styles.head}>
          <Text style={styles.title}>{doc.title}</Text>
          <View style={styles.dateRow}>
            <MCIcon name="calendar-today" size={15} color={colors.subtle} />
            <Text style={styles.date}>{fmtDate(doc.created_at)}</Text>
          </View>
        </View>
      </View>
      {doc.note ? <Text style={styles.note}>{doc.note}</Text> : null}
      {doc.attachment_path ? (
        <AttachmentRow path={doc.attachment_path} name={doc.attachment_name} type={doc.attachment_type} onPress={onOpen}
          style={styles.attach} />
      ) : null}
    </PCard>
  );
}

const styles = StyleSheet.create({
  weekly: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  weeklyIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  weeklyText: { flex: 1, marginLeft: 12 },
  weeklyTitle: { fontSize: 15.5, fontWeight: '800', color: colors.ink },
  weeklySub: { fontSize: 12.5, color: colors.subtle, marginTop: 2 },
  top: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 10 },
  head: { flex: 1, marginLeft: 14 },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  date: { fontSize: 14, color: colors.subtle, marginLeft: 6 },
  note: { fontSize: 15, color: colors.ink, paddingHorizontal: 16, paddingBottom: 14 },
  attach: { marginTop: 2 },
});
