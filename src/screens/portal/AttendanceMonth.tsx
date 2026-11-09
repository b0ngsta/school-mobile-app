// One month of the student's attendance as a calendar (present / half day /
// absent / leave, Sundays + holidays, not marked) and the month's summary.
// Params: { year, month (1-12) }; the header arrows move between months.
// Data: GET /student/attendance/month?year=&month=
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MonthSwitcher, PCard, PortalHeader } from '../../components/portal';
import { Bone, ErrorBox, Screen, Skeleton } from '../../components/ui';
import { localIsoDate } from '../../format';
import { useApi, useI18n } from '../../hooks';
import { colors } from '../../theme';
import type { AttendanceDayStatus, AttendanceMonthDetail, ScreenProps } from '../../types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December'];
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TONE: Record<AttendanceDayStatus, { bg: string; fg: string; dot?: boolean }> = {
  present: { bg: '#E3F4EA', fg: '#16A34A', dot: true },
  half_day: { bg: '#E6F6F1', fg: '#3BB78F', dot: true },
  absent: { bg: '#FBE4E7', fg: '#DC2640' },
  leave: { bg: '#E5EEFD', fg: '#2563EB' },
  holiday: { bg: '#FCEFD9', fg: '#D97706' },
  sunday: { bg: '#FCEFD9', fg: '#D97706' },
  not_marked: { bg: '#F1F2F6', fg: '#A6ABBD' },
};

export default function AttendanceMonth({ params, goBack }: ScreenProps) {
  const { t } = useI18n();
  const now = new Date();
  const [ym, setYm] = useState({
    year: Number(params?.year) || now.getFullYear(),
    month: Number(params?.month) || now.getMonth() + 1,
  });
  const { data, error, loading, refreshing, refresh } = useApi<AttendanceMonthDetail>(
    `/student/attendance/month?year=${ym.year}&month=${ym.month}`,
  );
  const shift = (by: number) =>
    setYm(({ year, month }) => {
      const m = month + by;
      return m < 1 ? { year: year - 1, month: 12 } : m > 12 ? { year: year + 1, month: 1 } : { year, month: m };
    });
  const isFuture = ym.year > now.getFullYear() || (ym.year === now.getFullYear() && ym.month >= now.getMonth() + 1);

  const first = new Date(ym.year, ym.month - 1, 1).getDay(); // Sun = 0
  const shown = data && data.year === ym.year && data.month === ym.month ? data : null;
  const cells: (AttendanceMonthDetail['days'][number] | null)[] = [...Array<null>(first).fill(null), ...(shown?.days || [])];
  while (cells.length % 7) cells.push(null);
  const today = localIsoDate();
  const s = shown?.summary;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} padded={false}>
      <PortalHeader title={t('Monthly Attendance')} onBack={goBack} centered>
        <MonthSwitcher label={`${t(MONTHS[ym.month - 1])} ${ym.year}`} onPrev={() => shift(-1)} onNext={() => shift(1)}
          nextDisabled={isFuture} />
      </PortalHeader>
      <View style={styles.body}>
        <ErrorBox message={error} />
        <PCard style={styles.pad}>
          <View style={styles.week}>
            {WEEK.map((w, i) => (
              <Text key={w} style={[styles.weekDay, i === 0 && { color: colors.warn }]}>{t(w)}</Text>
            ))}
          </View>
          {loading ? (
            <Skeleton>
              <View style={styles.grid}>
                {Array.from({ length: 35 }, (_, i) => (
                  <View key={i} style={styles.cellWrap}><Bone radius={12} style={styles.cell} /></View>
                ))}
              </View>
            </Skeleton>
          ) : !shown ? null : (
            <View style={styles.grid}>
              {cells.map((d, i) => {
                if (!d) return <View key={i} style={styles.cellWrap} />;
                const tone = TONE[d.status] || TONE.not_marked;
                const day = Number(d.date.slice(8, 10));
                return (
                  <View key={i} style={styles.cellWrap}
                    accessible accessibilityLabel={`${day}: ${t(STATUS_TEXT[d.status])}${d.holiday ? ` (${d.holiday})` : ''}`}>
                    <View style={[styles.cell, { backgroundColor: tone.bg },
                      d.date === today && [styles.today, { borderColor: colors.brand }]]}>
                      <Text style={[styles.day, { color: tone.fg }]}>{day}</Text>
                      {tone.dot ? <View style={[styles.dot, { backgroundColor: tone.fg }]} /> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {shown?.percent != null ? (
            <Text style={styles.note}>
              {t('{n}% attendance', { n: shown.percent })} · {t('{w} working days', { w: shown.working_days })}
            </Text>
          ) : null}
        </PCard>

        <PCard style={styles.pad}>
          <Text style={styles.sumTitle}>{t('Month Summary')}</Text>
          <View style={styles.tiles}>
            <Tile value={s?.present} label={t('Present')} status="present" />
            <Tile value={s?.half_day} label={t('Half Day')} status="half_day" />
            <Tile value={s?.absent} label={t('Absent')} status="absent" />
            <Tile value={s?.leave} label={t('Leave')} status="leave" />
            <Tile value={s?.holiday} label={t('Holiday')} status="holiday" />
            <Tile value={s?.not_marked} label={t('Not Marked')} status="not_marked" />
          </View>
        </PCard>
      </View>
    </Screen>
  );
}

const STATUS_TEXT: Record<AttendanceDayStatus, string> = {
  present: 'Present',
  half_day: 'Half Day',
  absent: 'Absent',
  leave: 'Leave',
  holiday: 'Holiday',
  sunday: 'Sunday',
  not_marked: 'Not Marked',
};

function Tile({ value, label, status }: { value?: number; label: string; status: AttendanceDayStatus }) {
  const tone = TONE[status];
  const fg = status === 'not_marked' ? colors.subtle : tone.fg;
  return (
    <View style={styles.tileWrap}>
      <View style={[styles.tile, { backgroundColor: tone.bg }]}>
        <Text style={[styles.tileValue, { color: fg }]}>{value ?? '—'}</Text>
        <View style={styles.tileLabelRow}>
          <View style={[styles.tileDot, { backgroundColor: fg }]} />
          <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 14, marginTop: 16 },
  pad: { padding: 14 },
  week: { flexDirection: 'row', marginBottom: 8 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', color: colors.subtle },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap: { width: '14.285%', padding: 3 },
  cell: { aspectRatio: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 2 },
  day: { fontSize: 15, fontWeight: '700' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  note: { textAlign: 'center', color: colors.subtle, fontSize: 13, marginTop: 12 },
  sumTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: 10 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  tileWrap: { width: '33.333%', padding: 5 },
  tile: { borderRadius: 18, alignItems: 'center', paddingVertical: 14 },
  tileValue: { fontSize: 24, fontWeight: '800' },
  tileLabelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  tileDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  tileLabel: { fontSize: 12.5, color: colors.subtle },
});
