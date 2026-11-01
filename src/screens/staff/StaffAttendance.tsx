// My attendance (staff) — today's check-in/out + history. Managers also see
// who's in today.
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, errorText, photoUrl } from '../../api';
import {
  Avatar,
  Bone,
  Button,
  Card,
  ChipsSkeleton,
  Empty,
  ErrorBox,
  Screen,
  ScreenSkeleton,
  Segments,
  fmtDate,
} from '../../components/ui';
import { MANAGER_ROLES } from '../../roles';
import { ROLE_LABELS, colors } from '../../theme';
import type { ScreenProps, StaffAttendanceRecord } from '../../types';
import { t } from '../../i18n';
import { fmtTime } from '../../format';


export default function StaffAttendance({ session }: ScreenProps) {
  const isManager = MANAGER_ROLES.includes(session.user_type);
  const [tab, setTab] = useState('mine');
  const [today, setToday] = useState<StaffAttendanceRecord | null>(null);
  const [history, setHistory] = useState<StaffAttendanceRecord[] | null>(null);
  const [allToday, setAllToday] = useState<StaffAttendanceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  /** /staff-attendance/today can be empty before check-in — don't wait on it forever. */
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (r = false) => {
    r && setRefreshing(true);
    try {
      const [todayRec, list] = await Promise.all([
        api('/staff-attendance/today'),
        api(tab === 'mine' ? '/staff-attendance/mine' : '/staff-attendance'),
      ]);
      setToday(todayRec);
      if (tab === 'mine') setHistory(list);
      else setAllToday(list);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRefreshing(false);
      setLoaded(true);
    }
  }, [tab]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (path: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api(path, { method: 'POST' });
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <ScreenSkeleton>
        <View style={[styles.today, { backgroundColor: colors.brand }]}>
          <Bone onBrand width="55%" height={16} />
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <Bone onBrand height={58} radius={12} style={styles.timeBoxBone} />
            <Bone onBrand height={58} radius={12} style={styles.timeBoxBone} />
          </View>
          <Bone onBrand height={40} radius={14} style={{ marginTop: 12 }} />
        </View>
        {isManager && <ChipsSkeleton count={2} />}
        {Array.from({ length: 5 }, (_, i) => (
          <Card key={i} style={styles.row}>
            <Bone width={110} height={12} style={{ flex: 1 }} />
            <Bone width={58} height={11} style={{ marginLeft: 10 }} />
            <Bone width={58} height={11} style={{ marginLeft: 10 }} />
          </Card>
        ))}
      </ScreenSkeleton>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => load(true)}>
      <ErrorBox message={error} />

      {/* today card */}
      <View style={[styles.today, { backgroundColor: colors.brand }]}>
        <Text style={styles.todayTitle}>{t('Today')} · {fmtDate(today?.date)}</Text>
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <View style={styles.timeBox}>
            <Text style={styles.timeLbl}>{t('In Time')}</Text>
            <Text style={styles.timeVal}>{fmtTime(today?.in_time)}</Text>
          </View>
          <View style={styles.timeBox}>
            <Text style={styles.timeLbl}>{t('Out Time')}</Text>
            <Text style={styles.timeVal}>{fmtTime(today?.out_time)}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          {!today?.in_time && (
            <Button label={t('✔ Check in')} onPress={() => act('/staff-attendance/check-in')} busy={busy}
              kind="soft" style={{ flex: 1 }} />
          )}
          {today?.in_time && !today?.out_time && (
            <Button label={t('✔ Check out')} onPress={() => act('/staff-attendance/check-out')} busy={busy}
              kind="soft" style={{ flex: 1 }} />
          )}
          {today?.in_time && today?.out_time && (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t('✅ Attendance complete for today')}</Text>
          )}
        </View>
      </View>

      {isManager && (
        <Segments
          items={[
            { value: 'mine', label: `📅 ${t('My history')}` },
            { value: 'all', label: `👥 ${t('Staff today')}` },
          ]}
          value={tab}
          onChange={setTab}
        />
      )}

      {tab === 'mine' ? (
        <>
          {history?.length === 0 && <Empty icon="📅" text={t('No attendance records yet.')} />}
          {history?.map(h => (
            <Card key={h.id} style={styles.row}>
              <Text style={{ flex: 1, fontWeight: '700', color: colors.ink, fontSize: 13.5 }}>
                {fmtDate(h.date)}
              </Text>
              <Text style={styles.times}>{t('In')} {fmtTime(h.in_time)}</Text>
              <Text style={styles.times}>{t('Out')} {fmtTime(h.out_time)}</Text>
            </Card>
          ))}
        </>
      ) : (
        <>
          {allToday?.length === 0 && <Empty icon="👥" text={t('Nobody has checked in yet today.')} />}
          {allToday?.map(a => (
            <Card key={a.id} style={styles.row}>
              <Avatar name={a.full_name} uri={photoUrl(a.photo_path)} size={34} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 13.5 }}>{a.full_name}</Text>
                <Text style={{ color: colors.subtle, fontSize: 11.5 }}>{a.user_type ? t(ROLE_LABELS[a.user_type]) : ''}</Text>
              </View>
              <Text style={styles.times}>{t('In')} {fmtTime(a.in_time)}</Text>
              <Text style={styles.times}>{t('Out')} {fmtTime(a.out_time)}</Text>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  today: { borderRadius: 20, padding: 18, marginBottom: 14 },
  todayTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  timeBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    marginRight: 8,
  },
  timeLbl: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
  timeVal: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  times: { color: colors.subtle, fontSize: 12, marginLeft: 10, fontWeight: '600' },
  timeBoxBone: { flex: 1, width: undefined, marginRight: 8 },
});
