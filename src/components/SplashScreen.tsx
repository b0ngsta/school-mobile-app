// Vidya Nova splash: shown at cold start while the app loads its saved session AND the API wakes
// up (warmup.ts). It continues the native launch window seamlessly — same background colour
// (android/app/src/main/res/values/colors.xml `splash_background`) and the logo starts in the
// same centred spot — then lifts the logo, fades in the wordmark and shows a gold progress
// shimmer. When `ready`, it fades out over the app, which has been rendering underneath.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useReduceMotion } from '../hooks';
import { t } from '../i18n';

export const SPLASH_BG = '#FAF9FE';
const INDIGO = '#2E2A78';
const GOLD = '#E29A26';
const LOGO_W = 128;
const LOGO_H = Math.round((LOGO_W * 752) / 911);
const TEXT_BLOCK_H = 70; // wordmark + tagline (font scaling is off on this screen)
const GAP = 18;
/** Logo starts at the exact screen centre (where the native splash drew it). */
const START_SHIFT = (LOGO_H + GAP + TEXT_BLOCK_H) / 2 - LOGO_H / 2;
/** Show the splash at least this long so it never just flickers. */
const MIN_VISIBLE_MS = 1400;
const TRACK_W = 148;
const BAR_W = 52;

interface Props {
  /** App and server are ready (or we stopped waiting): fade out. */
  ready: boolean;
  /** Called once the fade-out has finished — unmount the splash then. */
  onHidden: () => void;
}

export default function SplashScreen({ ready, onHidden }: Props) {
  const reduceMotion = useReduceMotion();
  const intro = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const shownAt = useRef(Date.now()).current;
  const [status, setStatus] = useState<string | null>(null);

  // Intro: logo eases up from the centre, wordmark rises in, then the progress bar.
  useEffect(() => {
    Animated.timing(intro, {
      toValue: 1,
      duration: reduceMotion ? 0 : 900,
      delay: reduceMotion ? 0 : 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [intro, reduceMotion]);

  // Soft glow breathing + shimmer loop (UI thread, nothing re-renders).
  useEffect(() => {
    if (reduceMotion) return undefined;
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const bar = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    glow.start();
    bar.start();
    return () => {
      glow.stop();
      bar.stop();
    };
  }, [breathe, shimmer, reduceMotion]);

  // A slow (sleeping) server: tell people what is going on.
  useEffect(() => {
    if (ready) return undefined;
    const a = setTimeout(() => setStatus(t('splash.connecting')), 2500);
    const b = setTimeout(() => setStatus(t('splash.waking')), 7000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [ready]);

  // Ready: wait out the minimum time, then fade out.
  useEffect(() => {
    if (!ready) return undefined;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
    const timer = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: reduceMotion ? 120 : 320,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => onHidden());
    }, wait);
    return () => clearTimeout(timer);
  }, [ready, fade, shownAt, onHidden, reduceMotion]);

  const groupShift = intro.interpolate({ inputRange: [0, 1], outputRange: [START_SHIFT, 0] });
  const logoScale = intro.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] });
  const textOpacity = intro.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0, 1] });
  const textShift = intro.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const barOpacity = intro.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0, 1] });
  const glowScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] });
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
  const barX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-BAR_W, TRACK_W] });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}
      pointerEvents={ready ? 'none' : 'auto'}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Vidya Nova. ${status || t('Loading…')}`}
      testID="splash">
      <StatusBar barStyle="dark-content" />
      <Animated.View style={[styles.group, { transform: [{ translateY: groupShift }] }]}>
        <View style={styles.logoBox}>
          <Animated.Image
            source={require('../assets/brand/glow.png')}
            style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
          />
          <Animated.View style={{ transform: [{ scale: logoScale }] }}>
            <Image source={require('../assets/brand/logo.png')} style={styles.logo} />
          </Animated.View>
        </View>
        <Animated.View style={[styles.textBlock, { opacity: textOpacity, transform: [{ translateY: textShift }] }]}>
          <Text allowFontScaling={false} style={styles.wordmark}>
            Vidya <Text style={{ color: GOLD }}>Nova</Text>
          </Text>
          <Text allowFontScaling={false} style={styles.tagline}>
            {t('splash.tagline')}
          </Text>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.bottom, { opacity: barOpacity }]}>
        <View style={styles.track}>
          <Animated.View style={[styles.bar, { transform: [{ translateX: reduceMotion ? TRACK_W / 2 - BAR_W / 2 : barX }] }]} />
        </View>
        <Text allowFontScaling={false} style={styles.status} numberOfLines={2}>
          {status || ' '}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: SPLASH_BG, alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 100 },
  group: { alignItems: 'center' },
  logoBox: { width: LOGO_W, height: LOGO_H, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 360, height: 360, left: (LOGO_W - 360) / 2, top: (LOGO_H - 360) / 2 },
  logo: { width: LOGO_W, height: LOGO_H },
  textBlock: { height: TEXT_BLOCK_H, marginTop: GAP, alignItems: 'center', justifyContent: 'flex-start' },
  wordmark: { fontSize: 34, lineHeight: 42, fontWeight: '800', color: INDIGO, letterSpacing: 0.3 },
  tagline: { fontSize: 14, lineHeight: 20, color: '#5A5880', marginTop: 6, letterSpacing: 0.2 },
  bottom: { position: 'absolute', bottom: 72, alignItems: 'center', paddingHorizontal: 32 },
  track: { width: TRACK_W, height: 4, borderRadius: 2, backgroundColor: '#E9E6F7', overflow: 'hidden' },
  bar: { width: BAR_W, height: 4, borderRadius: 2, backgroundColor: '#F2B347' },
  status: { marginTop: 14, fontSize: 12.5, lineHeight: 17, color: '#7C7A9E', textAlign: 'center', minHeight: 34 },
});
