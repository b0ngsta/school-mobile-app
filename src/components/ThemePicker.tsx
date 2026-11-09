// Profile → Theme: the UI-theme picker shared by every role's profile
// (student Profile and StaffProfile for teacher / driver / managers). Two
// preview cards (testID theme-default / theme-creative, radio a11y); tapping
// one switches every themed screen at once (uiTheme.ts). The choice lasts
// until sign-out — the next login starts on the default theme.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useI18n, useUiTheme } from '../hooks';
import { colors, radius } from '../theme';
import { setUiTheme } from '../uiTheme';
import type { UiTheme } from '../uiTheme';

const THEME_OPTIONS: { value: UiTheme; label: string; note: string }[] = [
  { value: 'default', label: 'Default Theme', note: 'Classic cards & tiles' },
  { value: 'creative', label: 'Creative Theme', note: 'Night-sky planetarium' },
];

/** Profile → Theme: switches every screen at once and remembers the choice on this phone (uiTheme.ts). */
export function ThemePicker() {
  const { t } = useI18n();
  const theme = useUiTheme();
  return (
    <View style={styles.themeRow} accessibilityRole="radiogroup">
      {THEME_OPTIONS.map(o => {
        const on = theme === o.value;
        return (
          <TouchableOpacity
            key={o.value}
            testID={`theme-${o.value}`}
            activeOpacity={0.8}
            onPress={() => setUiTheme(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t(o.label)}
            style={[styles.themeCard, { borderColor: on ? colors.brand : colors.line }]}>
            {o.value === 'default' ? <DefaultPreview /> : <CreativePreview />}
            <View style={styles.themeFoot}>
              <View style={styles.themeText}>
                <Text style={[styles.themeLabel, on && { color: colors.brand }]} numberOfLines={1}>{t(o.label)}</Text>
                <Text style={styles.themeNote} numberOfLines={1}>{t(o.note)}</Text>
              </View>
              <MCIcon
                name={on ? 'check-circle' : 'checkbox-blank-circle-outline'}
                size={20}
                color={on ? colors.brand : colors.faint}
              />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Tiny picture of the classic home: brand header, a card and a tile grid. */
function DefaultPreview() {
  const tiles = ['#22B573', '#4F6BFF', '#FFA62B', '#14B8A6', '#F2545B', '#EC4899'];
  return (
    <View style={[styles.preview, { backgroundColor: colors.page }]}>
      <View style={[styles.pvHeader, { backgroundColor: colors.brand }]} />
      <View style={styles.pvCard} />
      <View style={styles.pvGrid}>
        {tiles.map(c => (
          <View key={c} style={[styles.pvTile, { backgroundColor: c }]} />
        ))}
      </View>
    </View>
  );
}

/** Tiny picture of the planetarium home: night sky, a globe and the orbit's checkpoints. */
function CreativePreview() {
  const stars = [
    [10, 12], [34, 26], [62, 8], [88, 20], [18, 54], [52, 70], [96, 60], [76, 82],
  ];
  return (
    <View style={[styles.preview, styles.pvNight]}>
      {stars.map(([x, y]) => (
        <View key={`${x}-${y}`} style={[styles.pvStar, { left: `${x}%`, top: y }]} />
      ))}
      <View style={styles.pvOrbit} />
      <View style={styles.pvGlobe} />
      <View style={[styles.pvDot, styles.pvDot1]} />
      <View style={[styles.pvDot, styles.pvDot2]} />
      <View style={[styles.pvDot, styles.pvDot3]} />
    </View>
  );
}

const styles = StyleSheet.create({
  themeRow: { flexDirection: 'row', marginHorizontal: -5, marginBottom: 6 },
  themeCard: {
    flex: 1,
    marginHorizontal: 5,
    borderRadius: radius.card,
    borderWidth: 2,
    backgroundColor: colors.white,
    padding: 8,
  },
  themeFoot: { flexDirection: 'row', alignItems: 'center', marginTop: 9, paddingHorizontal: 2 },
  themeText: { flex: 1, marginRight: 4 },
  themeLabel: { fontSize: 13.5, fontWeight: '800', color: colors.ink },
  themeNote: { fontSize: 11, color: colors.subtle, marginTop: 1 },
  preview: { height: 96, borderRadius: 12, overflow: 'hidden' },
  pvHeader: { height: 30 },
  pvCard: {
    position: 'absolute',
    top: 18,
    left: 8,
    right: 8,
    height: 22,
    borderRadius: 7,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  pvGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6, marginTop: 16 },
  pvTile: { width: '29%', height: 17, borderRadius: 5, margin: '2%' },
  pvNight: { backgroundColor: '#0B0A2A' },
  pvStar: { position: 'absolute', width: 2.5, height: 2.5, borderRadius: 2, backgroundColor: '#E8E4FF' },
  pvOrbit: {
    position: 'absolute',
    top: 6,
    left: '18%',
    width: 120,
    height: 84,
    borderRadius: 60,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(172,162,255,0.6)',
  },
  pvGlobe: {
    position: 'absolute',
    top: 22,
    right: -14,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1D3B7A',
    borderWidth: 2,
    borderColor: 'rgba(110,170,255,0.55)',
  },
  pvDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: '#fff' },
  pvDot1: { top: 14, left: '28%', backgroundColor: '#FF4F7B' },
  pvDot2: { top: 40, left: '12%', backgroundColor: '#2F9BFF' },
  pvDot3: { top: 66, left: '26%', backgroundColor: '#1FCB85' },
});
