// Staff home (teacher / coordinator / admin / principal / driver) — matches
// the mockups: ID card with designation, EMP ID + today's check-in/out,
// admin/principal get the fee + students/teachers overview tiles,
// UPDATES bar, then the 3-column launcher grid.
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api, errorText, peek, photoUrl } from '../../api';
import {
  Avatar,
  Bone,
  ErrorBox,
  MiniStat,
  Screen,
  ScreenSkeleton,
  TileGrid,
  TileGridSkeleton,
  UpdatesBar,
  inr,
} from '../../components/ui';
import { ROLE_LABELS, colors, shadow } from '../../theme';
import type { AttendanceStats, AuthUser, DashboardStats, FeeStats, Notice, ScreenProps, StaffAttendanceRecord, TransactionStats } from '../../types';
import type { GridItem } from '../../components/ui';
import { useOnResume } from '../../hooks';
import { t } from '../../i18n';
import { fmtTime } from '../../format';


/** Only the newest notice is shown on the home screen. */
const LATEST_NOTICE = '/notices?limit=1';

const GRIDS: Record<'manager' | 'teacher' | 'driver', GridItem[]> = {
  manager: [
    { icon: '🏫', label: 'Classes', route: 'StaffClasses' },
    { icon: '🧑‍🏫', label: 'Teachers', route: 'Teachers' },
    { icon: '✅', label: 'Mark Attendance', route: 'MarkAttendance' },
    { icon: '🕐', label: 'Time table', route: 'Teachers', params: { hint: 'timetable' } },
    { icon: '₹', label: 'Fees', route: 'FeesAdmin' },
    { icon: '🧾', label: 'Fee Claims', route: 'FeeClaims' },
    { icon: '🎓', label: 'Exams', route: 'StaffExams' },
    { icon: '🗓️', label: 'Holidays', route: 'Holidays' },
    { icon: '🧳', label: 'Leave Requests', route: 'Leaves' },
    { icon: 'account-switch-outline', label: 'Substitutions', route: 'Substitutions' },
    { icon: 'clock-time-four-outline', label: 'School Timings', route: 'SchoolTimings' },
    { icon: '💵', label: 'Salary', route: 'Salary' },
    { icon: '👥', label: 'Staff Users', route: 'Users' },
    { icon: '📚', label: 'Lesson Plans', route: 'LessonPlans' },
    { icon: '🛎️', label: 'Reception', route: 'Reception' },
    { icon: '🚌', label: 'Transport', route: 'Transport' },
    { icon: '💳', label: 'Payments', route: 'Payments' },
    { icon: '💬', label: 'Bulk SMS', route: 'BulkSMS' },
    { icon: '📢', label: 'Notice Board', route: 'StaffNotices' },
    { icon: '👤', label: 'Profile', route: 'StaffProfile' },
  ],
  teacher: [
    { icon: '📅', label: 'My Attendance', route: 'StaffAttendance' },
    { icon: '🏫', label: 'My Classes', route: 'MyClasses' },
    { icon: '✅', label: 'Mark Attendance', route: 'MarkAttendance' },
    { icon: '🕐', label: 'Time table', route: 'MyTimetable' },
    { icon: '🎓', label: 'Marks Entry', route: 'StaffExams' },
    { icon: '📚', label: 'Lesson Plans', route: 'LessonPlans' },
    { icon: '🧾', label: 'Fee Claims', route: 'FeeClaims' },
    { icon: '🧳', label: 'Leave Request', route: 'Leaves' },
    { icon: 'account-switch-outline', label: 'Substitutions', route: 'Substitutions' },
    { icon: '💵', label: 'Salary', route: 'Salary' },
    { icon: '🗓️', label: 'Holidays', route: 'Holidays' },
    { icon: '📢', label: 'Notice Board', route: 'StaffNotices' },
    { icon: '👤', label: 'Profile', route: 'StaffProfile' },
  ],
  driver: [
    { icon: '🚌', label: 'Transport', route: 'Transport' },
    { icon: '📅', label: 'My Attendance', route: 'StaffAttendance' },
    { icon: '🧳', label: 'Leave Request', route: 'Leaves' },
    { icon: '💵', label: 'Salary', route: 'Salary' },
    { icon: '🗓️', label: 'Holidays', route: 'Holidays' },
    { icon: '📢', label: 'Notice Board', route: 'StaffNotices' },
    { icon: '👤', label: 'Profile', route: 'StaffProfile' },
  ],
};

export default function HomeStaff({ navigate, session }: ScreenProps) {
  const role = session.user_type;
  const isTopManager = ['admin', 'principal'].includes(role);
  const grid = GRIDS[role === 'teacher' ? 'teacher' : role === 'driver' ? 'driver' : 'manager'];

  const [me, setMe] = useState<AuthUser | null>(() => peek<AuthUser>('/auth/me'));
  const [today, setToday] = useState<StaffAttendanceRecord | null>(null);
  const [feeStats, setFeeStats] = useState<FeeStats | null>(() => peek<FeeStats>('/fees/stats'));
  const [payStats, setPayStats] = useState<TransactionStats | null>(() => peek<TransactionStats>('/transactions/stats'));
  const [dashStats, setDashStats] = useState<DashboardStats | null>(() => peek<DashboardStats>('/dashboard/stats'));
  const [attStats, setAttStats] = useState<AttendanceStats | null>(() => peek<AttendanceStats>('/attendance/stats'));
  const [notice, setNotice] = useState<Notice | null>(() => peek<Notice[]>(LATEST_NOTICE)?.[0] ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => peek('/auth/me') === null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAtt, setBusyAtt] = useState(false);

  const load = useCallback(async (r = false) => {
    r ? setRefreshing(true) : setLoading(peek('/auth/me') === null);
    const meRequest = api<AuthUser>('/auth/me').then(setMe);
    // The ID card needs /auth/me; everything else fills in as it arrives.
    meRequest.finally(() => setLoading(false)).catch(() => {});
    const requests: Promise<unknown>[] = [
      meRequest,
      api<StaffAttendanceRecord | null>('/staff-attendance/today').then(setToday),
      api<Notice[]>(LATEST_NOTICE).then(ns => setNotice(ns?.[0] ?? null)),
    ];
    if (isTopManager) {
      requests.push(
        api<FeeStats>('/fees/stats').then(setFeeStats),
        api<TransactionStats>('/transactions/stats').then(setPayStats),
        api<DashboardStats>('/dashboard/stats').then(setDashStats),
        api<AttendanceStats>('/attendance/stats').then(setAttStats),
      );
    }
    const results = await Promise.allSettled(requests);
    const failed = results.find((x): x is PromiseRejectedResult => x.status === 'rejected');
    setError(failed ? errorText(failed.reason) : null);
    setRefreshing(false);
  }, [isTopManager]);
  useEffect(() => {
    load();
  }, [load]);
  useOnResume(() => load());

  const checkInOut = async () => {
    setBusyAtt(true);
    try {
      if (!today?.in_time) await api('/staff-attendance/check-in', { method: 'POST' });
      else if (!today?.out_time) await api('/staff-attendance/check-out', { method: 'POST' });
      setToday(await api('/staff-attendance/today'));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyAtt(false);
    }
  };

  if (loading) return <HomeStaffSkeleton tiles={grid.length} managerStats={isTopManager} />;

  const attLabel = !today?.in_time ? `✔ ${t('Check in')}` : !today?.out_time ? `✔ ${t('Check out')}` : `✅ ${t('Done for today')}`;
  const attDisabled = busyAtt || !!(today?.in_time && today?.out_time);

  return (
    <Screen refreshing={refreshing} onRefresh={() => load(true)}>
      <ErrorBox message={error} />

      {/* ID card */}
      <View style={[styles.idCard, shadow.card]}>
        <Avatar name={session.full_name} uri={photoUrl(me?.photo_path)} size={54} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.idName}>{session.full_name}</Text>
          <Text style={styles.idSub}>
            {t('Designation:')} <Text style={{ color: colors.brand, fontWeight: '800' }}>{t(ROLE_LABELS[role] || role)}</Text>
          </Text>
          <Text style={styles.idSub}>{t('EMP ID:')} {session.user_id}</Text>
        </View>
        <View style={styles.attBox}>
          <Text style={styles.attTitle}>{t('Today Attendance')}</Text>
          <View style={{ flexDirection: 'row' }}>
            <View style={styles.attCell}>
              <Text style={styles.attLbl}>{t('In Time')}</Text>
              <Text style={styles.attVal}>{fmtTime(today?.in_time)}</Text>
            </View>
            <View style={styles.attCell}>
              <Text style={styles.attLbl}>{t('Out Time')}</Text>
              <Text style={styles.attVal}>{fmtTime(today?.out_time)}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={checkInOut}
            disabled={attDisabled}
            style={[styles.attBtn, { backgroundColor: attDisabled ? colors.line : colors.brand }]}>
            <Text style={{ color: attDisabled ? colors.subtle : '#fff', fontSize: 10.5, fontWeight: '800' }}>
              {attLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* admin/principal school overview */}
      {isTopManager && (
        <>
          <View style={styles.tileRow}>
            <MiniStat label={t('Total Fees')} value={feeStats ? inr(feeStats.total) : '—'} accent={colors.brand} />
            <MiniStat label={t('Due Fees')} value={feeStats ? inr(feeStats.pending + feeStats.overdue) : '—'} tint={colors.danger} accent={colors.danger} />
          </View>
          <View style={styles.tileRow}>
            <MiniStat label={t('Fees Paid')} value={feeStats ? inr(feeStats.collected) : '—'} tint={colors.ok} accent={colors.ok} />
            <MiniStat label={t('Today Paid')} value={payStats ? inr(payStats.today_collection) : '—'} tint={colors.warn} accent={colors.warn} />
          </View>
          <View style={[styles.tileRow, { marginBottom: 14 }]}>
            <MiniStat label={t('Total Students')} value={dashStats?.students} tint={colors.brand} accent={colors.brand} />
            <MiniStat label={t('Total Teachers')} value={dashStats?.teachers} tint={colors.info} accent={colors.info} />
            <MiniStat
              label={t('Present Today')}
              value={attStats ? `${attStats.present}/${attStats.marked}` : '—'}
              tint={colors.ok}
              accent={colors.ok}
            />
          </View>
        </>
      )}

      <UpdatesBar text={notice?.title} onPress={() => navigate('StaffNotices')} />

      <TileGrid items={grid} navigate={navigate} />
    </Screen>
  );
}

// Shown while the home loads: ID card, (admin) stat tiles, notice bar and
// the launcher grid as placeholder bones.
function HomeStaffSkeleton({ tiles, managerStats }: { tiles: number; managerStats: boolean }) {
  return (
    <ScreenSkeleton>
      <View style={[styles.idCard, shadow.card]}>
        <Bone width={54} height={54} radius={27} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Bone width="70%" height={15} />
          <Bone width="55%" height={10} style={{ marginTop: 8 }} />
          <Bone width="40%" height={10} style={{ marginTop: 6 }} />
        </View>
        <Bone width={104} height={76} radius={12} />
      </View>
      {managerStats &&
        [2, 2, 3].map((count, row) => (
          <View key={row} style={[styles.tileRow, row === 2 && { marginBottom: 14 }]}>
            {Array.from({ length: count }, (_, i) => (
              <Bone key={i} height={54} radius={14} style={styles.miniStatBone} />
            ))}
          </View>
        ))}
      <Bone height={44} radius={14} style={{ marginBottom: 14 }} />
      <TileGridSkeleton count={tiles} />
    </ScreenSkeleton>
  );
}

const styles = StyleSheet.create({
  idCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    marginBottom: 12,
  },
  idName: { fontSize: 15.5, fontWeight: '800', color: colors.ink },
  idSub: { fontSize: 11.5, color: colors.subtle, marginTop: 2 },
  attBox: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
  },
  attTitle: { fontSize: 10, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  attCell: { alignItems: 'center', paddingHorizontal: 6 },
  attLbl: { fontSize: 9, color: colors.subtle },
  attVal: { fontSize: 11.5, fontWeight: '800', color: colors.ink },
  attBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  tileRow: { flexDirection: 'row', marginHorizontal: -3, marginBottom: 6 },
  miniStatBone: { flex: 1, width: undefined, marginHorizontal: 3 },
});
