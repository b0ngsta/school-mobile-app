// Header pieces of the night-sky home: greeting, the compact "today" panel
// under the name and a dark error banner. The header shares the top of the
// screen with the orbit's top rail, so it is narrow (~170 dp) — figures that
// used to be stat chips / the notice pill now ride on the checkpoints' cards.
// Pure presentation — the home screens own the data and the actions.
import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Bone, Skeleton } from '../ui';
import { ScreenActiveContext, useReduceMotion } from '../../hooks';
import { getLang, t } from '../../i18n';
import { HOME, alpha } from './palette';

/**
 * The current time, refreshed every `everyMs` (for live clocks). The clock
 * stops while the screen is covered and catches up when it comes back.
 */
export function useNow(everyMs = 15000): Date {
  const [now, setNow] = useState(() => new Date());
  const screen = useContext(ScreenActiveContext);
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const sync = () => {
      if (id) clearInterval(id);
      id = undefined;
      if (!screen.get()) return;
      setNow(new Date());
      id = setInterval(() => setNow(new Date()), everyMs);
    };
    const unsubscribe = screen.subscribe(sync);
    if (screen.get()) id = setInterval(() => setNow(new Date()), everyMs);
    return () => {
      unsubscribe();
      if (id) clearInterval(id);
    };
  }, [everyMs, screen]);
  return now;
}

export function greetingText(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return t('Good morning');
  if (h < 17) return t('Good afternoon');
  return t('Good evening');
}

export function HomeGreeting({ name, detail }: { name?: string | null; detail?: string | null }) {
  const now = useNow(60000);
  const spaced = getLang() === 'en';
  return (
    <View style={styles.greeting}>
      <Text style={styles.hello}>{greetingText(now)},</Text>
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
          {name || ''}
        </Text>
        <MCIcon name="creation" size={24} color={HOME.gold} style={styles.sparkle} />
      </View>
      {!!detail && (
        <Text style={[styles.detail, spaced && styles.detailSpaced]} numberOfLines={2}>
          {spaced ? detail.toUpperCase() : detail}
        </Text>
      )}
    </View>
  );
}

/**
 * The school (logo or crest + name) as a small glass pill above the greeting —
 * tap → School Info. The creative home's way in to School Info (the classic
 * home has the tappable brand header; there is no School Info launcher).
 * Homes using it pass OrbitHome `headerExtra` so the panel below isn't clipped.
 */
export function SchoolChip({ name, logoUri, onPress }: { name: string; logoUri?: string | null; onPress: () => void }) {
  return (
    <View style={styles.schoolRow}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={t('School Info')}
        accessibilityHint={name}
        style={styles.school}>
        <View style={styles.schoolCrest}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.schoolLogo} resizeMode="contain" accessibilityIgnoresInvertColors />
          ) : (
            <MCIcon name="school" size={13} color={HOME.lilacText} />
          )}
        </View>
        <Text style={styles.schoolName} numberOfLines={1}>
          {name}
        </Text>
        <MCIcon name="chevron-right" size={15} color={HOME.faint} />
      </TouchableOpacity>
    </View>
  );
}

export type ActionTone = 'mint' | 'amber' | 'lilac';

const TONES: Record<ActionTone, { line: string; text: string }> = {
  mint: { line: HOME.mintLine, text: '#6DFFCB' },
  amber: { line: HOME.amber, text: HOME.amberText },
  lilac: { line: HOME.lilac, text: HOME.lilacText },
};

export interface PanelAction {
  label: string;
  icon: string;
  tone: ActionTone;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** Breathing glow that invites the tap (e.g. "Check in"). */
  pulse?: boolean;
}

interface PanelProps {
  title: string;
  icon: string;
  value: string;
  valueColor?: string;
  note?: string | null;
  action: PanelAction;
}

/** The glass "Today's attendance" panel under the name: figure on top, action button below. */
export function AttendancePanel({ title, icon, value, valueColor = HOME.mint, note, action }: PanelProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelText}>
        <View style={styles.panelTitleRow}>
          <MCIcon name={icon} size={14} color="#6FB6FF" />
          <Text style={styles.panelTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {title}
          </Text>
        </View>
        <Text
          style={[styles.panelValue, { color: valueColor, textShadowColor: alpha(valueColor, 0.55) }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}>
          {value}
        </Text>
        {!!note && (
          <Text style={styles.panelNote} numberOfLines={1}>
            {note}
          </Text>
        )}
      </View>
      <GlowButton {...action} />
    </View>
  );
}

function GlowButton({ label, icon, tone, onPress, disabled, busy, pulse }: PanelAction) {
  const reduceMotion = useReduceMotion();
  const breath = useRef(new Animated.Value(0)).current;
  const breathing = !!pulse && !disabled && !reduceMotion;
  useEffect(() => {
    if (!breathing) return undefined;
    const loop = Animated.loop(
      Animated.timing(breath, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => {
      loop.stop();
      breath.setValue(0);
    };
  }, [breath, breathing]);

  const c = TONES[tone];
  const dim = disabled && !busy;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={styles.buttonWrap}>
      {breathing && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.buttonHalo,
            {
              borderColor: c.line,
              opacity: breath.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.55, 0] }),
              transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
            },
          ]}
        />
      )}
      <View
        style={[
          styles.button,
          {
            borderColor: c.line,
            backgroundColor: alpha(c.line, 0.13),
            boxShadow: `0 0 16px ${alpha(c.line, 0.4)}`,
          },
          dim && styles.buttonDim,
        ]}>
        {busy ? <ActivityIndicator size="small" color={c.text} /> : <MCIcon name={icon} size={18} color={c.text} />}
        <Text style={[styles.buttonText, { color: c.text }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/** Error banner readable on the night sky (same role as ErrorBox). */
export function GlassError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.error} accessibilityRole="alert">
      <MCIcon name="alert-circle-outline" size={16} color={HOME.rose} style={styles.errorIcon} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

/** Placeholder header while the first load runs. */
export function HeaderSkeleton() {
  return (
    <Skeleton>
      <View style={styles.greeting}>
        <Bone onBrand width={110} height={12} />
        <Bone onBrand width={150} height={28} radius={8} style={styles.boneGap} />
        <Bone onBrand width={130} height={10} style={styles.boneGap} />
      </View>
      <Bone onBrand height={104} radius={20} />
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  greeting: { marginBottom: 10 },
  // paddingRight keeps the pill clear of the bell (OrbitHome, top right)
  schoolRow: { flexDirection: 'row', paddingRight: 40, marginBottom: 6 },
  school: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    paddingLeft: 3,
    paddingRight: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: HOME.glass,
    borderWidth: 1,
    borderColor: HOME.glassLine,
  },
  schoolCrest: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  schoolLogo: { width: 20, height: 20 },
  schoolName: { flexShrink: 1, marginLeft: 6, marginRight: 2, fontSize: 12, fontWeight: '700', color: HOME.ink },
  hello: { fontSize: 14.5, color: HOME.sub, letterSpacing: 0.2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  name: { flexShrink: 1, fontSize: 30, lineHeight: 38, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.4 },
  sparkle: { marginLeft: 6 },
  detail: { marginTop: 6, fontSize: 11, lineHeight: 17, color: HOME.faint },
  detailSpaced: { fontSize: 10.5, letterSpacing: 2.6 },

  panel: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: HOME.glass,
    borderWidth: 1,
    borderColor: HOME.glassLine,
  },
  panelText: { marginBottom: 6 },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center' },
  panelTitle: { marginLeft: 6, fontSize: 12.5, color: HOME.sub, flexShrink: 1 },
  panelValue: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  panelNote: { fontSize: 11, color: HOME.faint },

  buttonWrap: { minHeight: 38, justifyContent: 'center' },
  buttonHalo: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 1,
    bottom: 1,
    borderRadius: 20,
    borderWidth: 2,
  },
  button: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  buttonDim: { opacity: 0.72 },
  buttonText: { marginLeft: 6, fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },

  error: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(120,20,48,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,143,163,0.45)',
  },
  errorIcon: { marginRight: 8 },
  errorText: { flex: 1, fontSize: 12.5, color: '#FFE3E8' },

  boneGap: { marginTop: 8 },
});
