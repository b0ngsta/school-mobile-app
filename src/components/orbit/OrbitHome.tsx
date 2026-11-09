// Layout of the night-sky home screen shared by every role:
//   backdrop (SceneBackground: school on the hill under the stars) ·
//   the orbit (OrbitMenu: the Earth + every screen as a checkpoint on the
//   rail → arc → rail path, filling the whole screen) · the role's header
//   (greeting + today panel) top-left in a pull-to-refresh area, kept clear
//   of the top rail's checkpoints · a bell for notifications.
// The home stays mounted under pushed screens (ScreenStack persistentKey);
// its sky animations pause while it's covered. Home screens keep their own
// data loading and pass the pieces in — pass a memoised `items` list so the
// orbit doesn't redraw when only the header changes.
import React, { ReactNode, useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useScreenActive } from '../../hooks';
import { getLang, t } from '../../i18n';
import { getUnread, onUnreadChange } from '../../notifications';
import { HEADER_H, orbitLayout } from './geometry';
import type { OrbitLayout } from './geometry';
import { OrbitMenu } from './OrbitMenu';
import type { OrbitItem } from './OrbitMenu';
import { HOME } from './palette';
import { SceneBackground } from './SceneBackground';

export type { OrbitItem } from './OrbitMenu';

const BELL = 32;

interface Props {
  header: ReactNode;
  items: OrbitItem[];
  onNotifications: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** extra header height (dp) for a header with one more row (the student's school pill) */
  headerExtra?: number;
}

export function OrbitHome({ header, items, onNotifications, refreshing, onRefresh, headerExtra = 0 }: Props) {
  const { width, height, fontScale } = useWindowDimensions();
  const headerH = Math.round((HEADER_H + headerExtra) * Math.min(1.25, Math.max(1, fontScale || 1)));
  // Until the orbit has measured itself, size the header from the window.
  const [gutter, setGutter] = useState(() => orbitLayout(width, height, items.length, headerH).headerGutter);
  const onLayoutChange = useCallback((L: OrbitLayout) => setGutter(L.headerGutter), []);

  return (
    <View style={styles.root}>
      <Sky />
      <OrbitMenu items={items} headerH={headerH} lang={getLang()} onLayoutChange={onLayoutChange} />

      <View style={[styles.header, { width: width - gutter, maxHeight: headerH }]}>
        <ScrollView
          contentContainerStyle={styles.headerContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                colors={[HOME.lilac]}
                progressBackgroundColor="#1B1546"
                tintColor={HOME.lilacText}
              />
            ) : undefined
          }>
          {header}
        </ScrollView>
        <Bell onPress={onNotifications} />
      </View>
    </View>
  );
}

/** The animated backdrop — paused while another screen covers the home. */
function Sky() {
  const active = useScreenActive();
  return <SceneBackground animate={active} />;
}

/** Notifications button with the unread count (re-renders on its own). */
function Bell({ onPress }: { onPress: () => void }) {
  const [unread, setUnread] = useState(getUnread);
  useEffect(() => onUnreadChange(setUnread), []);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={styles.bell}
      accessibilityRole="button"
      accessibilityLabel={unread ? t('{n} unread notifications', { n: unread }) : t('Notifications')}>
      <MCIcon name="bell-outline" size={18} color={HOME.ink} />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: HOME.skyTop },
  header: { position: 'absolute', left: 0, top: 0 },
  headerContent: { paddingTop: 14, paddingLeft: 20, paddingRight: 4, paddingBottom: 6 },
  bell: {
    position: 'absolute',
    top: 6,
    right: 0,
    width: BELL,
    height: BELL,
    borderRadius: BELL / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HOME.railButton,
    borderWidth: 1.5,
    borderColor: HOME.railLine,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
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
