// Student/parent home — DEFAULT theme: the classic layout. A brand-coloured
// header (school logo + name + code, academic session — tap → School Info —
// and the bell), a profile card
// overlapping it (photo, name, class/roll, attendance chip) with the fees
// summary (progress bar + Total / Paid / Due tiles), the latest-notice
// "Updates" strip and a 3-column grid of every screen (no "Quick Actions"
// heading any more; School Info opens from the header, not a tile). Data comes from
// useStudentHome (shared with HomeStudent.creative.tsx) — this file is UI only.
import React from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { photoUrl } from '../../api';
import { sessionLabel } from '../../config';
import { Avatar, Bone, ErrorBox, Skeleton, inr } from '../../components/ui';
import { ActionTile, HomeBell, tileGridStyle } from '../../components/HomeTiles';
import { useI18n, useUpdateDots } from '../../hooks';
import { colors, shadow } from '../../theme';
import type { ScreenProps } from '../../types';
import { studentMenu, useStudentHome } from './useStudentHome';
import type { RouteArg } from './useStudentHome';

export default function HomeStudentDefault({ navigate, session }: ScreenProps) {
  const { t } = useI18n();
  const { dash, fees, error, loading, refreshing, refresh } = useStudentHome();
  const { hasNew } = useUpdateDots();

  const p = dash?.profile;
  const percent = dash?.attendance?.percent;
  const latest = dash?.latest_notices?.[0];
  const paid = fees?.totals.paid ?? 0;
  const due = fees?.totals.pending ?? 0;
  const total = paid + due;
  const paidPct = total > 0 ? Math.round((paid / total) * 100) : null;
  const classLine = p?.class_name ? [p.class_name, p.section_name].filter(Boolean).join(' · ') : t('dash.noClass');
  const school = dash?.school;
  const schoolName = school?.name || session.org_name || t('My school');
  const logo = photoUrl(school?.logo_path);
  const openSchool = () => navigate('SchoolInfo');

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
          <TouchableOpacity style={styles.headerTap} activeOpacity={0.8} onPress={openSchool} accessibilityRole="button"
            accessibilityLabel={t('School Info')} accessibilityHint={schoolName}>
            <View style={styles.crest}>
              {logo ? (
                <Image source={{ uri: logo }} style={styles.crestLogo} resizeMode="contain" accessibilityIgnoresInvertColors />
              ) : (
                <MCIcon name="school" size={26} color={colors.brand} />
              )}
            </View>
            <View style={styles.headerText}>
              <Text style={styles.school} numberOfLines={2}>{schoolName.toUpperCase()}</Text>
              {!!session.org_code && <Text style={[styles.code, { color: colors.onBrandSub }]}>{session.org_code}</Text>}
            </View>
          </TouchableOpacity>
          <HomeBell onPress={() => navigate('Notifications')} />
        </View>
        <TouchableOpacity style={styles.sessionPill} activeOpacity={0.8} onPress={openSchool} accessibilityRole="button"
          accessibilityLabel={t('Session {label}', { label: school?.session || sessionLabel() })}>
          <MCIcon name="calendar-range" size={13} color="#fff" />
          <Text style={styles.sessionText}>{school?.session || sessionLabel()}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* ---- profile + fees card ---- */}
        <View style={[styles.card, shadow.pop]}>
          {loading ? (
            <ProfileSkeleton />
          ) : (
            <TouchableOpacity
              style={styles.profileRow}
              activeOpacity={0.75}
              onPress={() => navigate('Profile')}
              accessibilityRole="button"
              accessibilityLabel={p?.full_name || t('Profile')}>
              <View style={[styles.avatarRing, { borderColor: colors.brand }]}>
                <Avatar name={p?.full_name} uri={photoUrl(p?.photo_path)} size={62} />
              </View>
              <View style={styles.profileText}>
                <Text style={styles.name} numberOfLines={1}>{(p?.full_name || '').toUpperCase()}</Text>
                <Text style={styles.classLine} numberOfLines={1}>{classLine}</Text>
                <View style={styles.chips}>
                  {p?.roll_no != null && p.roll_no !== '' && (
                    <View style={[styles.chip, { backgroundColor: colors.brandSoft }]}>
                      <MCIcon name="card-account-details-outline" size={13} color={colors.brand} />
                      <Text style={[styles.chipText, { color: colors.brand }]}>{t('dash.roll', { n: p.roll_no })}</Text>
                    </View>
                  )}
                  {percent != null && (
                    <View style={[styles.chip, { backgroundColor: colors.okSoft }]}>
                      <MCIcon name="calendar-check" size={13} color={colors.ok} />
                      <Text style={[styles.chipText, { color: colors.ok }]}>{t('{n}% present', { n: percent })}</Text>
                    </View>
                  )}
                </View>
              </View>
              <MCIcon name="chevron-right" size={24} color={colors.faint} />
            </TouchableOpacity>
          )}

          <View style={styles.divider} />

          <TouchableOpacity activeOpacity={0.8} onPress={() => navigate('Fees')} accessibilityRole="button">
            <View style={styles.feesHead}>
              <MCIcon name="wallet-outline" size={19} color={colors.brand} />
              <Text style={styles.feesTitle}>{t('Fees Summary')}</Text>
              <View style={[styles.pctPill, { backgroundColor: due > 0 ? colors.warnSoft : colors.okSoft }]}>
                <Text style={[styles.pctText, { color: due > 0 ? colors.warn : colors.ok }]}>
                  {paidPct != null ? t('{n}% paid', { n: paidPct }) : fees ? t('No dues') : '—'}
                </Text>
              </View>
            </View>
            <View style={[styles.track, { backgroundColor: colors.dangerSoft }]}>
              <View style={[styles.fill, { width: `${paidPct ?? (fees ? 100 : 0)}%`, backgroundColor: colors.ok }]} />
            </View>
            <View style={styles.feeTiles}>
              <FeeTile icon="receipt-text-outline" label={t('Total Fees')} value={fees ? inr(total) : '—'} fg="#3B5BDB" bg="#EEF2FF" />
              <FeeTile icon="check-circle" label={t('Fees Paid')} value={fees ? inr(paid) : '—'} fg={colors.ok} bg={colors.okSoft} />
              <FeeTile icon="clock-alert-outline" label={t('Due Fees')} value={fees ? inr(due) : '—'} fg={colors.danger} bg={colors.dangerSoft} />
            </View>
          </TouchableOpacity>
        </View>

        <ErrorBox message={error} />

        {/* ---- latest notice ---- */}
        <TouchableOpacity
          style={[styles.updates, shadow.card]}
          activeOpacity={0.8}
          onPress={() => navigate('Notices')}
          accessibilityRole="button">
          <View style={styles.updatesTag}>
            <MCIcon name="bullhorn-variant" size={16} color="#fff" />
            <Text style={styles.updatesTagText}>{t('Updates')}</Text>
          </View>
          <Text style={styles.updatesText} numberOfLines={1}>
            {latest?.title || t('dash.noNotices')}
          </Text>
          <MCIcon name="chevron-right" size={20} color={colors.faint} style={styles.updatesChevron} />
        </TouchableOpacity>

        {/* ---- every screen (no section heading) ---- */}
        <View style={tileGridStyle}>
          {studentMenu(dash).map(item => (
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

function FeeTile({ icon, label, value, fg, bg }: { icon: string; label: string; value: string; fg: string; bg: string }) {
  return (
    <View style={[styles.feeTile, { backgroundColor: bg, borderColor: fg + '33' }]}>
      <View style={styles.feeTileHead}>
        <MCIcon name={icon} size={15} color={fg} />
        <Text style={[styles.feeTileLabel, { color: fg }]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={styles.feeTileValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
    </View>
  );
}

function ProfileSkeleton() {
  return (
    <Skeleton>
      <View style={styles.profileRow}>
        <Bone width={70} height={70} radius={35} />
        <View style={styles.profileText}>
          <Bone width={140} height={16} />
          <Bone width={90} height={10} style={styles.boneGap} />
          <Bone width={120} height={20} radius={10} style={styles.boneGap} />
        </View>
      </View>
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 28 },
  header: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 70, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  blobA: { width: 220, height: 220, top: -110, right: -60 },
  blobB: { width: 140, height: 140, bottom: -60, left: -40 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerTap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  crestLogo: { width: 40, height: 40, borderRadius: 20 },
  crest: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.45)',
    overflow: 'hidden',
  },
  headerText: { flex: 1, marginLeft: 12, marginRight: 8 },
  school: { color: '#fff', fontSize: 16.5, fontWeight: '800', letterSpacing: 0.8 },
  code: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginTop: 3 },
  sessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  sessionText: { color: '#fff', fontSize: 13, fontWeight: '800', marginLeft: 6, letterSpacing: 0.4 },

  body: { paddingHorizontal: 14, marginTop: -58 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 14 },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatarRing: { borderWidth: 2.5, borderRadius: 40, padding: 2 },
  profileText: { flex: 1, marginLeft: 14, marginRight: 6 },
  name: { fontSize: 18, fontWeight: '800', color: colors.ink, letterSpacing: 0.4 },
  classLine: { fontSize: 12.5, color: colors.subtle, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 6,
    marginTop: 4,
  },
  chipText: { fontSize: 11.5, fontWeight: '700', marginLeft: 4 },
  boneGap: { marginTop: 8 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 14 },
  feesHead: { flexDirection: 'row', alignItems: 'center' },
  feesTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.ink, marginLeft: 8 },
  pctPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pctText: { fontSize: 12, fontWeight: '800' },
  track: { height: 7, borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4 },
  feeTiles: { flexDirection: 'row', marginTop: 12, marginHorizontal: -4 },
  feeTile: { flex: 1, marginHorizontal: 4, borderRadius: 16, borderWidth: 1, paddingVertical: 11, paddingHorizontal: 10 },
  feeTileHead: { flexDirection: 'row', alignItems: 'center' },
  feeTileLabel: { fontSize: 11.5, fontWeight: '700', marginLeft: 4, flexShrink: 1 },
  feeTileValue: { fontSize: 17, fontWeight: '800', color: colors.ink, marginTop: 8 },

  updates: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 18,
  },
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
