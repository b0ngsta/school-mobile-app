// Pieces of the classic (default-theme) home shared by the student and the
// staff home: the launcher tile (coloured icon square + label + red "new"
// dot), its colour per route, and the bell with the unread count.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useI18n } from '../hooks';
import { getUnread, onUnreadChange } from '../notifications';
import { colors, shadow } from '../theme';

/** Icon-square colour per launcher route (base + a darker edge for the shadow). */
const TILE_COLORS: Record<string, { c: string; d: string }> = {
  // student
  Attendance: { c: '#22B573', d: '#128A54' },
  Fees: { c: '#4F6BFF', d: '#2F45D1' },
  Homework: { c: '#FFA62B', d: '#E07F0A' },
  Exams: { c: '#8B5CF6', d: '#6431D9' },
  StudentTimetable: { c: '#14B8A6', d: '#0B8A7C' },
  Notices: { c: '#F2545B', d: '#C92D35' },
  ReportCards: { c: '#EC4899', d: '#BE1C70' },
  Messages: { c: '#3B9DFF', d: '#1873D6' },
  // HIDDEN with the Remarks tile: Remarks: { c: '#0EA5E9', d: '#0369A1' },
  Holidays: { c: '#2BC4C4', d: '#139494' },
  Profile: { c: '#6366F1', d: '#4338CA' },
  Events: { c: '#EC4899', d: '#BE1C70' },
  MyTransport: { c: '#FB8C1E', d: '#D96A04' },
  SubjectTeachers: { c: '#6D74E8', d: '#4A50C7' },
  Syllabus: { c: '#58B947', d: '#3A8F2C' },
  FullSyllabus: { c: '#0EA5A4', d: '#0B7D7C' },
  StaffSyllabus: { c: '#58B947', d: '#3A8F2C' },
  // staff
  StaffClasses: { c: '#4F6BFF', d: '#2F45D1' },
  MyClasses: { c: '#4F6BFF', d: '#2F45D1' },
  Teachers: { c: '#6D74E8', d: '#4A50C7' },
  MarkAttendance: { c: '#22B573', d: '#128A54' },
  StaffAttendance: { c: '#14B8A6', d: '#0B8A7C' },
  MyTimetable: { c: '#14B8A6', d: '#0B8A7C' },
  FeesAdmin: { c: '#3B5BDB', d: '#2541B2' },
  FeeClaims: { c: '#FFA62B', d: '#E07F0A' },
  StaffExams: { c: '#8B5CF6', d: '#6431D9' },
  Leaves: { c: '#EC4899', d: '#BE1C70' },
  Substitutions: { c: '#FB8C1E', d: '#D96A04' },
  SchoolTimings: { c: '#0EA5E9', d: '#0369A1' },
  Salary: { c: '#58B947', d: '#3A8F2C' },
  Users: { c: '#7C8BA6', d: '#56637C' },
  LessonPlans: { c: '#A855F7', d: '#7E22CE' },
  Reception: { c: '#F97316', d: '#C2410C' },
  Transport: { c: '#FB8C1E', d: '#D96A04' },
  Payments: { c: '#10B981', d: '#047857' },
  BulkSMS: { c: '#3B9DFF', d: '#1873D6' },
  StaffNotices: { c: '#F2545B', d: '#C92D35' },
  StaffProfile: { c: '#6366F1', d: '#4338CA' },
  // driver
  MyRoutine: { c: '#22B573', d: '#128A54' },
};
const FALLBACK_TILE = { c: '#64748B', d: '#475569' };

export interface ActionTileProps {
  route: string;
  icon: string;
  label: string;
  onPress: () => void;
  /** red "new" dot: something inside not opened yet (updates.ts) */
  dot?: boolean;
}

/** One launcher in the classic home's 3-column grid (put the tiles in a View with `tileGridStyle`). */
export function ActionTile({ route, icon, label, onPress, dot }: ActionTileProps) {
  const { t } = useI18n();
  const tone = TILE_COLORS[route] || FALLBACK_TILE;
  return (
    <View style={styles.tileWrap}>
      <TouchableOpacity
        style={[styles.tile, shadow.card]}
        activeOpacity={0.75}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={dot ? { text: t('New') } : undefined}>
        <View>
          <View style={[styles.tileIcon, { backgroundColor: tone.c, shadowColor: tone.d }]}>
            <View style={styles.tileShine} />
            <MCIcon name={icon} size={27} color="#fff" />
          </View>
          {dot ? <View testID="tile-new-dot" style={styles.newDot} /> : null}
        </View>
        <Text style={styles.tileLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {label}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/** Notifications button with the unread count, for a brand-coloured header (re-renders on its own). */
export function HomeBell({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  const [unread, setUnread] = useState(getUnread);
  useEffect(() => onUnreadChange(setUnread), []);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={styles.bell}
      accessibilityRole="button"
      accessibilityLabel={unread ? t('{n} unread notifications', { n: unread }) : t('Notifications')}>
      <MCIcon name="bell-outline" size={20} color="#fff" />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tileWrap: { width: '33.333%', padding: 5 },
  tile: {
    backgroundColor: '#fff',
    borderRadius: 20,
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 13,
    paddingHorizontal: 6,
  },
  tileIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  tileShine: {
    position: 'absolute',
    top: -18,
    left: -14,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  tileLabel: { fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 10 },
  newDot: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 6,
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#FFD43B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#171A26', fontSize: 10, fontWeight: '800' },
});

/** Style for the View around a list of ActionTiles. */
export const tileGridStyle = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 } }).grid;
