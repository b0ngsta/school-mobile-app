// Student/parent home — CREATIVE theme: the night-sky "orbit" home
// (components/orbit): greeting with the class line, the attendance panel under
// the name, and every screen as a checkpoint on the orbit around the Earth.
// Live figures ride on the checkpoint cards (Fees → "₹3,000 due", Notice
// Board → latest notice, Attendance → "92% present"), red dots where
// something new is inside (updates.ts), and the school pill above the
// greeting opens School Info (no School Info checkpoint). Data comes from
// useStudentHome (shared with HomeStudent.default.tsx) — this file is UI only.
import React, { useMemo } from 'react';
import { photoUrl } from '../../api';
import { inr } from '../../components/ui';
import { AttendancePanel, GlassError, HeaderSkeleton, HomeGreeting, SchoolChip } from '../../components/orbit/HomeParts';
import { OrbitHome } from '../../components/orbit/OrbitHome';
import type { OrbitItem } from '../../components/orbit/OrbitHome';
import { useI18n, useUpdateDots } from '../../hooks';
import type { ScreenProps } from '../../types';
import { studentMenu, useStudentHome } from './useStudentHome';
import type { RouteArg } from './useStudentHome';

/** Room for the school pill above the greeting (keeps the attendance panel unclipped). */
const SCHOOL_PILL_H = 34;

export default function HomeStudentCreative({ navigate, session }: ScreenProps) {
  const { t, lang } = useI18n();
  const { dash, fees, error, loading, refreshing, refresh } = useStudentHome();
  const { hasNew, version: dots } = useUpdateDots();

  const p = dash?.profile;
  const due = fees ? fees.totals.pending : null;
  const latest = dash?.latest_notices?.[0];
  const percent = dash?.attendance?.percent;
  const feesLoaded = fees !== null;
  const latestTitle = latest?.title;

  // Rebuilt only when a figure on the cards (or the language) changes.
  const items = useMemo<OrbitItem[]>(() => {
    // Live second lines for the checkpoint cards (fall back to the plain subtitle).
    const live: Record<string, string | null | undefined> = {
      Attendance: percent != null ? t('{n}% present', { n: percent }) : null,
      Fees: due ? t('{amount} due', { amount: inr(due) }) : feesLoaded ? t('All fees paid') : null,
      Notices: latestTitle,
    };
    return studentMenu(dash).map(g => ({
      key: `${g.route}:${g.label}`,
      label: t(g.label),
      sub: live[g.route] || t(g.sub),
      icon: g.icon,
      dot: hasNew(g.route),
      onPress: () => navigate(g.route as RouteArg, g.params),
    }));
    // `lang` re-translates the labels; `dots` changes when a red dot does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, lang, percent, due, feesLoaded, latestTitle, navigate, dots, dash?.full_syllabus]);

  const classLine = p?.class_name ? [p.class_name, p.section_name].filter(Boolean).join(' · ') : t('dash.noClass');
  const detail = p?.roll_no ? `${classLine}  ·  ${t('dash.roll', { n: p.roll_no })}` : classLine;

  const header = loading ? (
    <>
      <GlassError message={error} />
      <HeaderSkeleton />
    </>
  ) : (
    <>
      <GlassError message={error} />
      <SchoolChip
        name={dash?.school?.name || session.org_name || t('My school')}
        logoUri={photoUrl(dash?.school?.logo_path)}
        onPress={() => navigate('SchoolInfo')}
      />
      <HomeGreeting name={p?.full_name} detail={detail} />
      <AttendancePanel
        title={t('Attendance')}
        icon="calendar-check"
        value={percent != null ? `${percent}%` : '—'}
        note={t('Overall attendance')}
        action={{ label: t('View'), icon: 'chevron-right', tone: 'lilac', onPress: () => navigate('Attendance') }}
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
