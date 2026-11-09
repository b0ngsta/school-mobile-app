// Staff home — DEFAULT theme: the classic layout (same look as the student's
// classic home). A brand-coloured header (school name + code, the bell), a
// card overlapping it with the staff member (photo, name, role · EMP ID) and
// today's check-in / check-out, for admin / principal the school overview
// (students, teachers, attendance, fees due), the latest-notice "Updates"
// strip and a 3-column grid of the role's screens with red "new" dots
// (updates.ts). Data comes from useStaffHome (shared with
// HomeStaff.creative.tsx) — this file is UI only.
import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { photoUrl } from '../../../api';
import { ActionTile, HomeBell, tileGridStyle } from '../../../components/HomeTiles';
import { Avatar, Bone, ErrorBox, Skeleton, inr } from '../../../components/ui';
import { fmtTime } from '../../../format';
import { useI18n, useUpdateDots } from '../../../hooks';
import { ROLE_LABELS, colors, shadow } from '../../../theme';
import type { ScreenProps } from '../../../types';
import { useStaffHome } from './useStaffHome';
import type { RouteArg } from './useStaffHome';

export default function HomeStaffDefault({ navigate, session }: ScreenProps) {
  const { t } = useI18n();
  const role = session.user_type;
  const { grid, hasFees, hasAttendance, me, isTopManager, today, notice, feeStats, dashStats, attStats, error, loading, refreshing, refresh, busyAtt, checkInOut } =
    useStaffHome(session);
  const { hasNew } = useUpdateDots();

  const name = me?.full_name || session.full_name;
  const checkedIn = !!today?.in_time;
  const checkedOut = !!today?.out_time;
  const attLabel = !checkedIn ? t('Check in') : !checkedOut ? t('Check out') : t('Done for today');
  const attTone = !checkedIn ? colors.ok : !checkedOut ? colors.warn : colors.faint;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.page }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={loading ? undefined : refresh}
          enabled={!loading}
          colors={[colors.brand]}
          tintColor="#fff"
        />
      }>
      {/* ---- brand header ---- */}
      <View style={[styles.header, { backgroundColor: colors.brand }]}>
        <View style={[styles.blob, styles.blobA]} />
        <View style={[styles.blob, styles.blobB]} />
        <View style={styles.headerRow}>
          {/* tap the school → School Info (every role, Nov 2026) */}
          <TouchableOpacity style={styles.schoolTap} activeOpacity={0.75} onPress={() => navigate('SchoolInfo')}
            accessibilityRole="button" accessibilityLabel={t('School Info')} accessibilityHint={session.org_name || ''}
            testID="home-school">
            <View style={styles.crest}>
              <MCIcon name="school" size={26} color={colors.brand} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.school} numberOfLines={2}>{(session.org_name || t('My school')).toUpperCase()}</Text>
              {!!session.org_code && <Text style={[styles.code, { color: colors.onBrandSub }]}>{session.org_code}</Text>}
            </View>
          </TouchableOpacity>
          <HomeBell onPress={() => navigate('Notifications')} />
        </View>
      </View>

      <View style={styles.body}>
        {/* ---- who + today's check-in / out ---- */}
        <View style={[styles.card, shadow.pop]}>
          {loading ? (
            <Skeleton>
              <View style={styles.profileRow}>
                <Bone width={62} height={62} radius={31} />
                <View style={styles.profileText}>
                  <Bone width={140} height={16} />
                  <Bone width={100} height={10} style={styles.boneGap} />
                </View>
              </View>
            </Skeleton>
          ) : (
            <TouchableOpacity
              style={styles.profileRow}
              activeOpacity={0.75}
              onPress={() => navigate('StaffProfile')}
              accessibilityRole="button"
              accessibilityLabel={name || t('Profile')}>
              <View style={[styles.avatarRing, { borderColor: colors.brand }]}>
                <Avatar name={name} uri={photoUrl(me?.photo_path)} size={56} />
              </View>
              <View style={styles.profileText}>
                <Text style={styles.name} numberOfLines={1}>{(name || '').toUpperCase()}</Text>
                <View style={[styles.chip, { backgroundColor: colors.brandSoft }]}>
                  <Text style={[styles.chipText, { color: colors.brand }]} numberOfLines={1}>
                    {`${t(ROLE_LABELS[role] || role)} · ${t('EMP ID:')} ${session.user_id}`}
                  </Text>
                </View>
              </View>
              <MCIcon name="chevron-right" size={24} color={colors.faint} />
            </TouchableOpacity>
          )}

          <View style={styles.divider} />

          <View style={styles.todayRow}>
            <MCIcon name="clock-outline" size={20} color={colors.brand} />
            <View style={styles.todayText}>
              <Text style={styles.todayTitle}>{t('Today Attendance')}</Text>
              <Text style={styles.todayNote} numberOfLines={1}>
                {checkedIn
                  ? `${t('In Time')} ${fmtTime(today?.in_time)}  ·  ${t('Out Time')} ${fmtTime(today?.out_time)}`
                  : t('Not checked in yet')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={checkInOut}
              disabled={busyAtt || (checkedIn && checkedOut)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={attLabel}
              accessibilityState={{ disabled: busyAtt || (checkedIn && checkedOut), busy: busyAtt }}
              style={[styles.attBtn, { backgroundColor: attTone }]}>
              {busyAtt ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.attText}>{attLabel}</Text>}
            </TouchableOpacity>
          </View>

          {isTopManager && (
            <View style={styles.stats}>
              <Stat icon="account-group" label={t('Students')} value={dashStats?.students} fg="#3B5BDB" bg="#EEF2FF" />
              <Stat icon="account-tie" label={t('Teachers')} value={dashStats?.teachers} fg={colors.brand} bg={colors.brandSoft} />
              {hasAttendance && (
                <Stat icon="calendar-check" label={t('Present')} value={attStats ? `${attStats.present}/${attStats.marked}` : null} fg={colors.ok} bg={colors.okSoft} />
              )}
              {hasFees && (
                <Stat icon="clock-alert-outline" label={t('Due Fees')} value={feeStats ? inr(feeStats.pending + feeStats.overdue) : null} fg={colors.danger} bg={colors.dangerSoft} />
              )}
            </View>
          )}
        </View>

        <ErrorBox message={error} />

        {/* ---- latest notice ---- */}
        <TouchableOpacity style={[styles.updates, shadow.card]} activeOpacity={0.8} onPress={() => navigate('StaffNotices')} accessibilityRole="button">
          <View style={styles.updatesTag}>
            <MCIcon name="bullhorn-variant" size={16} color="#fff" />
            <Text style={styles.updatesTagText}>{t('Updates')}</Text>
          </View>
          <Text style={styles.updatesText} numberOfLines={1}>{notice?.title || t('dash.noNotices')}</Text>
          <MCIcon name="chevron-right" size={20} color={colors.faint} style={styles.updatesChevron} />
        </TouchableOpacity>

        {/* ---- every screen of the role ---- */}
        <View style={tileGridStyle}>
          {grid.map(item => (
            <ActionTile
              key={`${item.route}:${item.label}`}
              route={item.route}
              icon={item.icon}
              label={t(item.label)}
              dot={hasNew(item.route)}
              onPress={() => navigate(item.route as RouteArg, item.params)}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ icon, label, value, fg, bg }: { icon: string; label: string; value?: number | string | null; fg: string; bg: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: bg, borderColor: fg + '33' }]}>
      <MCIcon name={icon} size={15} color={fg} />
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value ?? '—'}</Text>
      <Text style={[styles.statLabel, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 28 },
  header: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 66, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  blobA: { width: 220, height: 220, top: -110, right: -60 },
  blobB: { width: 140, height: 140, bottom: -60, left: -40 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  schoolTap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  crest: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  headerText: { flex: 1, marginLeft: 12, marginRight: 8 },
  school: { color: '#fff', fontSize: 16.5, fontWeight: '800', letterSpacing: 0.8 },
  code: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginTop: 3 },

  body: { paddingHorizontal: 14, marginTop: -50 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 14 },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatarRing: { borderWidth: 2.5, borderRadius: 36, padding: 2 },
  profileText: { flex: 1, marginLeft: 14, marginRight: 6 },
  name: { fontSize: 17, fontWeight: '800', color: colors.ink, letterSpacing: 0.4 },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, marginTop: 6 },
  chipText: { fontSize: 11.5, fontWeight: '700' },
  boneGap: { marginTop: 8 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 14 },
  todayRow: { flexDirection: 'row', alignItems: 'center' },
  todayText: { flex: 1, marginLeft: 10, marginRight: 8 },
  todayTitle: { fontSize: 14.5, fontWeight: '800', color: colors.ink },
  todayNote: { fontSize: 12, color: colors.subtle, marginTop: 2 },
  attBtn: { minWidth: 104, height: 38, borderRadius: 19, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  attText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
  stats: { flexDirection: 'row', marginTop: 14, marginHorizontal: -3 },
  stat: { flex: 1, marginHorizontal: 3, borderRadius: 14, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 6, alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: '800', color: colors.ink, marginTop: 4 },
  statLabel: { fontSize: 10.5, fontWeight: '700', marginTop: 2 },

  updates: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 18 },
  updatesTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
  },
  updatesTagText: { color: '#fff', fontWeight: '800', fontSize: 13.5, marginLeft: 6 },
  updatesText: { flex: 1, fontSize: 13.5, fontWeight: '600', color: colors.ink, marginLeft: 12 },
  updatesChevron: { marginHorizontal: 8 },
});
