// Staff home — CREATIVE theme: the night-sky "orbit" home (components/orbit):
// greeting with designation + EMP ID, today's check-in/out panel under the
// name, and the role's screens as checkpoints on the orbit around the Earth.
// Figures ride on the checkpoint cards (the latest notice on Notice Board;
// admin / principal also Fees, Payments, Classes, Teachers, Mark Attendance)
// and red dots mark launchers with something new inside (updates.ts).
// Data comes from useStaffHome (shared with HomeStaff.default.tsx) — UI only.
import React, { useMemo } from 'react';
import { AttendancePanel, GlassError, HeaderSkeleton, HomeGreeting, SchoolChip, useNow } from '../../../components/orbit/HomeParts';
import type { PanelAction } from '../../../components/orbit/HomeParts';
import { OrbitHome } from '../../../components/orbit/OrbitHome';
import type { OrbitItem } from '../../../components/orbit/OrbitHome';
import { HOME } from '../../../components/orbit/palette';
import { fmtTime } from '../../../format';
import { useI18n, useUpdateDots } from '../../../hooks';
import { ROLE_LABELS } from '../../../theme';
import type { ScreenProps } from '../../../types';
import { useStaffHome } from './useStaffHome';
import type { RouteArg } from './useStaffHome';

/** Room for the school pill above the greeting (same as the student's creative home). */
const SCHOOL_PILL_H = 34;

export default function HomeStaffCreative({ navigate, session }: ScreenProps) {
  const role = session.user_type;
  const { t, lang } = useI18n();
  const { grid, today, live, error, loading, refreshing, refresh, busyAtt, checkInOut } = useStaffHome(session);
  const { hasNew, version: dots } = useUpdateDots();
  const now = useNow();

  // Rebuilt only when a figure on the cards, a red dot or the language changes.
  const liveKey = JSON.stringify(live);
  const items = useMemo<OrbitItem[]>(
    () =>
      grid.map(g => ({
        key: `${g.route}:${g.label}`,
        label: t(g.label),
        sub: live[g.label] || t(g.sub),
        icon: g.icon,
        dot: hasNew(g.route),
        onPress: () => navigate(g.route as RouteArg, g.params),
      })),
    // `lang` re-translates the labels; `liveKey` stands for `live`; `dots` for hasNew().
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, lang, grid, liveKey, navigate, dots],
  );

  const checkedIn = !!today?.in_time;
  const checkedOut = !!today?.out_time;
  const action: PanelAction = !checkedIn
    ? { label: t('Check in'), icon: 'login-variant', tone: 'mint', pulse: true, onPress: checkInOut }
    : !checkedOut
      ? { label: t('Check out'), icon: 'logout', tone: 'amber', onPress: checkInOut }
      : { label: t('Done for today'), icon: 'check-all', tone: 'lilac', onPress: checkInOut };
  action.disabled = busyAtt || (checkedIn && checkedOut);
  action.busy = busyAtt;

  const header = loading ? (
    <>
      <GlassError message={error} />
      <HeaderSkeleton />
    </>
  ) : (
    <>
      <GlassError message={error} />
      <SchoolChip name={session.org_name || t('My school')} onPress={() => navigate('SchoolInfo')} />
      <HomeGreeting name={session.full_name} detail={`${t(ROLE_LABELS[role] || role)}  ·  ${t('EMP ID:')} ${session.user_id}`} />
      <AttendancePanel
        title={t('Today Attendance')}
        icon="clock-outline"
        value={checkedIn ? fmtTime(today?.in_time) : fmtTime(now)}
        valueColor={checkedIn && checkedOut ? HOME.lilacText : HOME.mint}
        note={
          checkedIn
            ? `${t('In Time')} ${fmtTime(today?.in_time)}  ·  ${t('Out Time')} ${fmtTime(today?.out_time)}`
            : t('Not checked in yet')
        }
        action={action}
      />
    </>
  );

  return (
    <OrbitHome
      header={header}
      items={items}
      refreshing={refreshing}
      onRefresh={loading ? undefined : refresh}
      onNotifications={() => navigate('Notifications')}
      headerExtra={SCHOOL_PILL_H}
    />
  );
}
