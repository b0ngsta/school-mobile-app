// Driver "My Routine": today's shifts of the driver's van / bus as chips in
// the header ("Morning · 7:00 AM – 8:30 AM", running / next one marked and
// opened first), and the selected shift's students in stop order (photo,
// class, Pickup / Drop time, where to stop). Tap a student for the address,
// Navigate and Call (RoutineStudentSheet). Driver role only (launcher in
// useStaffHome GRIDS.driver). The header keeps the school's name and code.
// Data: GET /driver/routine (one call: every shift of the day with its students).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { photoUrl } from '../../api';
import { useNow } from '../../components/orbit/HomeParts';
import { ListHeaderBleed, PCard, Pill, PortalHeader } from '../../components/portal';
import { Avatar, Bone, Button, Empty, ErrorBox, ListScreen, ListSkeleton, Skeleton } from '../../components/ui';
import { fmtDayLong, fmtTime } from '../../format';
import { useApi, useI18n } from '../../hooks';
import { colors, shadow } from '../../theme';
import type { DriverRoutine, RoutineShift, RoutineStudent, ScreenProps } from '../../types';
import RoutineStudentSheet from './RoutineStudentSheet';
import { classLabel, defaultShiftKey, periodOf, shiftRange, shiftStates, shortPlace } from './routine';
import type { ShiftState } from './routine';

export const ROUTINE_PATH = '/driver/routine';
const TYPE_ICON = { bus: 'bus', van: 'van-passenger', other: 'car' } as const;

export default function MyRoutine({ goBack, session }: ScreenProps) {
  const { t } = useI18n();
  const { data, error, loading, refreshing, refresh } = useApi<DriverRoutine>(ROUTINE_PATH);
  const now = useNow(60000);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const shifts = useMemo(() => data?.shifts ?? [], [data]);
  const isToday = data?.is_today ?? true;
  const states = useMemo(() => shiftStates(shifts, nowMin, isToday), [shifts, nowMin, isToday]);

  // the driver's pick sticks while it still exists; otherwise the running / next shift
  const [picked, setPicked] = useState<string | null>(null);
  const selectedKey = shifts.some(s => s.key === picked) ? picked : defaultShiftKey(shifts, nowMin, isToday);
  const shift = shifts.find(s => s.key === selectedKey) ?? null;
  const [open, setOpen] = useState<RoutineStudent | null>(null);

  const school = [(session.org_name || '').toUpperCase(), session.org_code].filter(Boolean).join('  ·  ');

  return (
    <>
      <ListScreen
        data={data ? shift?.students ?? [] : null}
        keyExtractor={st => st.student_id}
        header={
          <>
            <ListHeaderBleed>
              <PortalHeader title={t('My Routine')} onBack={goBack} subtitle={school || null}>
                {loading ? (
                  <Skeleton>
                    <View style={styles.chipRow}>
                      <Bone width={150} height={58} radius={16} onBrand />
                      <Bone width={150} height={58} radius={16} onBrand style={styles.boneGap} />
                    </View>
                  </Skeleton>
                ) : shifts.length ? (
                  <ShiftChips shifts={shifts} selected={selectedKey} states={states} onSelect={setPicked} />
                ) : null}
              </PortalHeader>
            </ListHeaderBleed>

            {error ? (
              <View style={styles.errorWrap}>
                <ErrorBox message={error} />
                <Button label={t('Retry')} kind="soft" small onPress={refresh} busy={refreshing} />
              </View>
            ) : null}

            {loading ? <ListSkeleton count={4} avatar={44} lines={2} /> : null}

            {data && !shifts.length ? (
              <Empty icon={data.holiday ? 'calendar-star' : 'bus-clock'}
                text={data.holiday ? t('Holiday today: {name}. No shifts.', { name: data.holiday })
                  : !data.vehicles.length ? t('No vehicle is assigned to you yet. Please contact the school office.')
                    : t('No shift today')} />
            ) : null}

            {shift ? <ShiftSummary shift={shift} state={states[shift.key]} day={data?.date} /> : null}
          </>
        }
        empty={shift ? <Empty icon="account-off-outline" text={t('No students on this shift')} /> : null}
        refreshing={refreshing}
        onRefresh={refresh}
        renderItem={st => shift ? <StudentCard student={st} shift={shift} onPress={() => setOpen(st)} /> : null}
      />
      <RoutineStudentSheet student={open} shift={shift} onClose={() => setOpen(null)} />
    </>
  );
}

/* ------------------------------------------------------------ header chips */

function ShiftChips({ shifts, selected, states, onSelect }: {
  shifts: RoutineShift[];
  selected: string | null;
  states: Record<string, ShiftState>;
  onSelect: (key: string) => void;
}) {
  const { t } = useI18n();
  const scroll = useRef<ScrollViewInstance>(null);
  const xs = useRef<Record<string, number>>({});
  const scrolled = useRef(false);
  const scrollToSelected = (animated: boolean) => {
    const x = selected ? xs.current[selected] : undefined;
    if (x != null) scroll.current?.scrollTo({ x: Math.max(0, x - 16), animated });
  };
  useEffect(() => {
    if (scrolled.current) scrollToSelected(true);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {shifts.map(s => {
        const active = s.key === selected;
        const state = states[s.key];
        const fg = active ? colors.brand : '#fff';
        return (
          <TouchableOpacity
            key={s.key}
            onPress={() => onSelect(s.key)}
            onLayout={e => {
              xs.current[s.key] = e.nativeEvent.layout.x;
              if (!scrolled.current && s.key === selected) {
                scrolled.current = true;
                scrollToSelected(false);
              }
            }}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={[t(periodOf(s)), s.name, shiftRange(s), state ? t(`shift.${state}`) : null]
              .filter(Boolean).join(', ')}
            style={[styles.chip, active ? [styles.chipActive, shadow.card] : styles.chipIdle]}>
            <View style={styles.chipTop}>
              <MCIcon name={s.trip_type === 'pickup' ? 'weather-sunny' : 'weather-sunset-down'} size={14} color={fg} />
              <Text style={[styles.chipPeriod, { color: fg }]} numberOfLines={1}>
                {s.name || t(periodOf(s))}
              </Text>
              {state === 'now' || state === 'next' ? (
                <View style={[styles.stateTag, { backgroundColor: state === 'now' ? colors.ok : colors.warn }]}>
                  <Text style={styles.stateText}>{t(`shift.${state}`)}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.chipTime, { color: fg }, state === 'done' && !active && styles.chipDone]} numberOfLines={1}>
              {shiftRange(s) || t('Time not set')}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/* ---------------------------------------------------------------- summary */

function ShiftSummary({ shift, state, day }: { shift: RoutineShift; state?: ShiftState; day?: string }) {
  const { t } = useI18n();
  const pickup = shift.trip_type === 'pickup';
  const v = shift.vehicle;
  return (
    <PCard style={styles.summary}>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryIcon, { backgroundColor: colors.brandSoft }]}>
          <MCIcon name={TYPE_ICON[v.vehicle_type] || 'bus'} size={24} color={colors.brand} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.summaryTitle} numberOfLines={1}>
            {[t(periodOf(shift)), shift.name].filter(Boolean).join(' · ')}
          </Text>
          <Text style={styles.summarySub} numberOfLines={1}>
            {[v.vehicle_no, v.route_name, day ? fmtDayLong(day) : null].filter(Boolean).join('  ·  ')}
          </Text>
        </View>
        <View style={[styles.countBox, { backgroundColor: colors.brand }]}>
          <Text style={styles.countNum}>{shift.student_count}</Text>
          <Text style={styles.countLabel}>{t(shift.student_count === 1 ? 'student' : 'students')}</Text>
        </View>
      </View>
      <View style={styles.pills}>
        <Pill icon={pickup ? 'home-export-outline' : 'home-import-outline'}
          label={t(pickup ? 'Pickup · home to school' : 'Drop · school to home')}
          fg={pickup ? colors.warn : '#5B5BD6'} bg={pickup ? colors.warnSoft : '#EEEDFD'} />
        {state === 'now' ? <Pill icon="progress-clock" label={t('shift.now')} fg={colors.ok} bg={colors.okSoft} /> : null}
        {state === 'done' ? <Pill icon="check" label={t('shift.done')} fg={colors.subtle} bg={colors.page} /> : null}
        {v.status === 'maintenance' ? (
          <Pill icon="wrench-outline" label={t('Under maintenance')} fg={colors.danger} bg={colors.dangerSoft} />
        ) : null}
      </View>
    </PCard>
  );
}

/* ----------------------------------------------------------- student card */

const StudentCard = React.memo(function StudentRow({ student: st, shift, onPress }: {
  student: RoutineStudent;
  shift: RoutineShift;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const pickup = shift.trip_type === 'pickup';
  const typeColor = pickup ? colors.warn : '#5B5BD6';
  const place = shortPlace(st);
  return (
    <PCard onPress={onPress} style={styles.card} accessibilityLabel={`${st.stop_no}. ${st.full_name}`}>
      <View style={[styles.stopNo, { backgroundColor: colors.brandSoft }]}>
        <Text style={[styles.stopNoText, { color: colors.brand }]}>{st.stop_no}</Text>
      </View>
      <Avatar name={st.full_name} uri={photoUrl(st.photo_path)} size={44} />
      <View style={styles.cardText}>
        <Text style={styles.name} numberOfLines={1}>{st.full_name}</Text>
        {classLabel(st) ? <Text style={styles.cls} numberOfLines={1}>{classLabel(st)}</Text> : null}
        <View style={styles.placeRow}>
          <MCIcon name="map-marker-outline" size={14} color={colors.subtle} />
          <Text style={styles.place} numberOfLines={1}>{place || t('Address not added')}</Text>
        </View>
      </View>
      <View style={styles.timeCol}>
        <Text style={[styles.timeType, { color: typeColor }]}>{t(pickup ? 'Pickup' : 'Drop')}</Text>
        <Text style={styles.time}>{st.stop_time ? fmtTime(st.stop_time) : '—'}</Text>
        <MCIcon name="chevron-right" size={18} color={colors.faint} />
      </View>
    </PCard>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chipRow: { flexDirection: 'row', paddingRight: 16 },
  boneGap: { marginLeft: 10 },
  chip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, marginRight: 10, minWidth: 132, maxWidth: 230 },
  chipActive: { backgroundColor: '#fff' },
  chipIdle: { backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  chipTop: { flexDirection: 'row', alignItems: 'center' },
  chipPeriod: { fontSize: 12, fontWeight: '700', marginLeft: 5, flexShrink: 1 },
  chipTime: { fontSize: 14.5, fontWeight: '800', marginTop: 4 },
  chipDone: { opacity: 0.6 },
  stateTag: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 6 },
  stateText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  errorWrap: { marginBottom: 12 },
  summary: { padding: 14, marginBottom: 14 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  summaryTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  summarySub: { fontSize: 12.5, color: colors.subtle, marginTop: 2 },
  countBox: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', marginLeft: 8 },
  countNum: { color: '#fff', fontSize: 18, fontWeight: '800' },
  countLabel: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  card: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12 },
  stopNo: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  stopNoText: { fontSize: 13, fontWeight: '800' },
  cardText: { flex: 1, marginLeft: 10, marginRight: 8 },
  name: { fontSize: 15, fontWeight: '800', color: colors.ink },
  cls: { fontSize: 12.5, color: colors.subtle, marginTop: 1 },
  placeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  place: { flex: 1, fontSize: 12.5, color: colors.subtle, marginLeft: 3 },
  timeCol: { alignItems: 'flex-end' },
  timeType: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  time: { fontSize: 14, fontWeight: '800', color: colors.ink, marginTop: 2 },
});
