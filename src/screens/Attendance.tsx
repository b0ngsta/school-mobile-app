// Student attendance: the session's percentage in a ring, the yearly summary
// (working days, present, half days, absent, holidays) with bars, a month-by-
// month chart and the monthly breakdown — tap a month for its calendar
// (AttendanceMonth). Percentages are over all working days of the month /
// session (days − Sundays − holidays), half days count ½ — the server
// computes them (GET /student/attendance/overview).
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BarChart, PCard, PortalHeader, ProgressRing } from '../components/portal';
import { Bone, ErrorBox, NoticeBox, Screen, Skeleton } from '../components/ui';
import { useApi, useI18n } from '../hooks';
import { colors } from '../theme';
import type { AttendanceMonth, AttendanceOverview, ScreenProps } from '../types';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

export default function Attendance({ goBack, navigate }: ScreenProps) {
  const { t } = useI18n();
  const { data, error, loading, refreshing, refresh } = useApi<AttendanceOverview>('/student/attendance/overview');
  const totals = data?.totals;
  const months = useMemo(() => [...(data?.months || [])].reverse(), [data]);
  const monthShort = t('months');
  const groups = (data?.months || []).map(m => ({ label: monthShort[m.month - 1], values: [m.present, m.absent] }));

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} padded={false}>
      <PortalHeader title={t('title.Attendance')} onBack={goBack} centered>
        <View style={styles.ringRow}>
          <ProgressRing percent={totals?.percent ?? null} size={150} thickness={14}
            label={totals?.percent == null ? '—' : `${Math.round(totals.percent)}%`} />
          <View style={styles.ringText}>
            <Text style={styles.overall}>{t('Overall Attendance')}</Text>
            <Text style={[styles.overallSub, { color: colors.onBrandSub }]}>
              {totals ? t('{p} present out of {w} working days', { p: totals.present, w: totals.working_days }) : ' '}
            </Text>
          </View>
        </View>
      </PortalHeader>

      <View style={styles.body}>
        {error && !data ? <NoticeBox message={error} /> : <ErrorBox message={error} />}
        {loading ? (
          <OverviewSkeleton />
        ) : totals ? (
          <>
            <PCard style={styles.cardPad}>
              <CardTitle icon="chart-timeline-variant" title={t('Yearly Summary')} />
              <View style={styles.tiles}>
                <SumTile icon="briefcase-clock" value={totals.working_days} label={t('Working Days')} fg={colors.brand} bg={colors.brandSoft} />
                <SumTile icon="check-circle" value={totals.present} label={t('Present')} fg={colors.ok} bg={colors.okSoft} />
                <SumTile icon="circle-half-full" value={totals.half_day} label={t('Half Days')} fg="#3BB78F" bg="#EEF8F3" />
                <SumTile icon="close-circle" value={totals.absent} label={t('Absent')} fg={colors.danger} bg={colors.dangerSoft} />
                <SumTile icon="party-popper" value={totals.holidays} label={t('Holidays')} fg={colors.warn} bg={colors.warnSoft} />
              </View>
              <Meter label={t('Present')} value={totals.present} of={totals.working_days} color={colors.ok} />
              <Meter label={t('Half Days')} value={totals.half_day} of={totals.working_days} color="#3BB78F" />
              <Meter label={t('Absent')} value={totals.absent} of={totals.working_days} color={colors.danger} />
              <Meter label={t('Holidays')} value={totals.holidays} of={totals.working_days} color={colors.warn} />
            </PCard>

            {groups.length > 0 && (
              <PCard style={styles.cardPad}>
                <CardTitle icon="chart-bar" title={t('Overview')} />
                <BarChart groups={groups} colors={[colors.ok, colors.danger]} legend={[t('Present'), t('Absent')]} />
              </PCard>
            )}

            <Text style={styles.sectionTitle}>{t('Monthly Breakdown')}</Text>
            <Text style={styles.sectionSub}>{t('Tap a month to view the calendar')}</Text>
            {months.map(m => (
              <MonthCard key={`${m.year}-${m.month}`} m={m}
                onPress={() => navigate('AttendanceMonth', { year: m.year, month: m.month })} />
            ))}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function CardTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.cardTitleRow}>
      <MCIcon name={icon} size={24} color={colors.brand} />
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  );
}

function SumTile({ icon, value, label, fg, bg }: { icon: string; value: number; label: string; fg: string; bg: string }) {
  return (
    <View style={styles.tileWrap}>
      <View style={[styles.tile, { backgroundColor: bg }]} accessible accessibilityLabel={`${label}: ${value}`}>
        <MCIcon name={icon} size={26} color={fg} />
        <Text style={[styles.tileValue, { color: fg }]}>{value}</Text>
        <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}

function Meter({ label, value, of, color }: { label: string; value: number; of: number; color: string }) {
  const pct = of > 0 ? Math.min(100, (value / of) * 100) : 0;
  return (
    <View style={styles.meter}>
      <Text style={styles.meterLabel}>{label}</Text>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.meterValue, { color }]}>{value}</Text>
    </View>
  );
}

function MonthCard({ m, onPress }: { m: AttendanceMonth; onPress: () => void }) {
  const { t } = useI18n();
  const pct = m.percent ?? 0;
  return (
    <PCard style={styles.monthCard} onPress={onPress} accessibilityLabel={`${t(MONTH_NAMES[m.month - 1])} ${m.year}`}>
      <View style={styles.monthHead}>
        <View style={[styles.monthIcon, { backgroundColor: colors.brandSoft }]}>
          <MCIcon name="calendar-month" size={28} color={colors.brand} />
        </View>
        <View style={styles.monthTitleBox}>
          <Text style={styles.monthTitle}>{t(MONTH_NAMES[m.month - 1])} {m.year}</Text>
          <Text style={styles.monthPct}>{m.percent == null ? t('No working days') : t('{n}% attendance', { n: m.percent })}</Text>
        </View>
        <MCIcon name="chevron-right" size={26} color={colors.subtle} />
      </View>
      <View style={styles.monthTrack}>
        <View style={[styles.monthFill, { width: `${pct}%`, backgroundColor: colors.ok }]} />
      </View>
      <View style={styles.monthNums}>
        <MonthNum value={m.present} label={t('Present')} color={colors.ok} />
        <MonthNum value={m.absent} label={t('Absent')} color={colors.danger} />
        <MonthNum value={m.holidays} label={t('Holidays')} color={colors.warn} />
        <MonthNum value={m.working_days} label={t('Working')} color={colors.brand} />
        <MonthNum value={m.days} label={t('Days')} color={colors.subtle} />
      </View>
    </PCard>
  );
}

function MonthNum({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={styles.monthNum}>
      <Text style={[styles.monthNumValue, { color }]}>{value}</Text>
      <Text style={styles.monthNumLabel}>{label}</Text>
    </View>
  );
}

function OverviewSkeleton() {
  return (
    <PCard style={styles.cardPad}>
      <Skeleton>
        <Bone width={150} height={18} />
        <View style={[styles.tiles, { marginTop: 14 }]}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={styles.tileWrap}>
              <Bone height={96} radius={18} />
            </View>
          ))}
        </View>
        {[0, 1, 2, 3].map(i => <Bone key={i} height={10} style={{ marginTop: 16 }} />)}
      </Skeleton>
    </PCard>
  );
}

const styles = StyleSheet.create({
  ringRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 18 },
  ringText: { flex: 1, marginLeft: 22 },
  overall: { color: '#fff', fontSize: 20, fontWeight: '800' },
  overallSub: { fontSize: 14.5, marginTop: 8, lineHeight: 20 },
  body: { paddingHorizontal: 14, marginTop: 16 },
  cardPad: { padding: 16 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 19, fontWeight: '800', color: colors.ink, marginLeft: 10 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  tileWrap: { width: '33.333%', padding: 5 },
  tile: { borderRadius: 18, alignItems: 'center', paddingVertical: 14 },
  tileValue: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  tileLabel: { fontSize: 12.5, color: colors.subtle, marginTop: 2 },
  meter: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  meterLabel: { width: 96, fontSize: 14, color: colors.ink },
  meterTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#EEF0F5', overflow: 'hidden' },
  meterFill: { height: 10, borderRadius: 5 },
  meterValue: { width: 44, textAlign: 'right', fontSize: 15, fontWeight: '800' },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.ink, marginTop: 6 },
  sectionSub: { fontSize: 13.5, color: colors.subtle, marginTop: 2, marginBottom: 12 },
  monthCard: { padding: 16 },
  monthHead: { flexDirection: 'row', alignItems: 'center' },
  monthIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  monthTitleBox: { flex: 1, marginLeft: 14 },
  monthTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  monthPct: { fontSize: 14, color: colors.subtle, marginTop: 2 },
  monthTrack: { height: 8, borderRadius: 4, backgroundColor: '#E9ECF2', marginTop: 16, overflow: 'hidden' },
  monthFill: { height: 8, borderRadius: 4 },
  monthNums: { flexDirection: 'row', marginTop: 14 },
  monthNum: { flex: 1, alignItems: 'center' },
  monthNumValue: { fontSize: 19, fontWeight: '800' },
  monthNumLabel: { fontSize: 12.5, color: colors.subtle, marginTop: 2 },
});
