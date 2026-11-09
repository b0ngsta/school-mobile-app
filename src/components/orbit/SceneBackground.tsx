// The home screen's backdrop: a starry night over the school on the hill.
// The artwork is baked into two pictures (sky + landscape, drawn on a
// 390-wide canvas); twinkling stars, shooting stars and fireflies are tiny
// native-driven animations on top. They pause while `animate` is false (the
// home is covered by another screen) and stop when the OS asks for less
// motion. Memoised: it only redraws on a size change or a pause / resume.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useReduceMotion } from '../../hooks';
import { HOME } from './palette';

const SKY = require('../../assets/home/home_sky.jpg');
const LAND = require('../../assets/home/home_land.png');
const GLOW = require('../../assets/home/glow.png');
const STREAK = require('../../assets/home/streak.png');

// The canvas the pictures were drawn on (dp).
const ART_W = 390;
const SKY_H = 844;
const LAND_H = 204;
const LAND_TOP = 640; // canvas y where the landscape picture starts

// [x, y, phase] on the sky canvas
const TWINKLES: readonly [number, number, number][] = [
  [74, 30, 0.1], [156, 74, 0.45], [240, 22, 0.8], [118, 236, 0.3], [196, 268, 0.62],
  [318, 254, 0.05], [12, 398, 0.55], [24, 526, 0.2], [8, 604, 0.7], [214, 624, 0.38],
  [382, 640, 0.9], [336, 330, 0.25], [284, 282, 0.75],
];
// [x, y, phase] on the landscape canvas
const FIREFLIES: readonly [number, number, number][] = [
  [52, 806, 0], [168, 812, 0.32], [232, 790, 0.6], [152, 834, 0.15], [316, 798, 0.78], [66, 752, 0.45],
];

// Opacity of stars / fireflies when motion is reduced.
const STILL_TWINKLE = 0.7;
const STILL_FIREFLY = 0.6;

const WAVE_STEPS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
/** A smooth lo → hi → lo pulse over one loop of `clock`, shifted by `phase`. */
const wave = (clock: Animated.Value, phase: number, lo: number, hi: number) =>
  clock.interpolate({
    inputRange: WAVE_STEPS,
    outputRange: WAVE_STEPS.map(t => lo + (hi - lo) * (0.5 + 0.5 * Math.cos(2 * Math.PI * (t - phase)))),
  });

/** 0 → 1 forever, on the native driver (stays at 0 when `enabled` is false). */
function useLoop(duration: number, enabled: boolean): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) return undefined;
    const loop = Animated.loop(
      Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration, enabled]);
  return value;
}

interface Point {
  x: number;
  y: number;
}

function ShootingStar({ from, to, delay, every, enabled }: { from: Point; to: Point; delay: number; every: number; enabled: boolean }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const run = () => {
      p.setValue(0);
      Animated.timing(p, { toValue: 1, duration: 950, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
        if (alive) timer = setTimeout(run, every);
      });
    };
    timer = setTimeout(run, delay);
    return () => {
      alive = false;
      clearTimeout(timer);
      p.stopAnimation();
    };
  }, [p, delay, every, enabled]);

  if (!enabled) return null;
  const angle = (Math.atan2(from.y - to.y, from.x - to.x) * 180) / Math.PI;
  return (
    <Animated.View
      style={[
        styles.origin,
        {
          opacity: p.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
          transform: [
            { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] }) },
            { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] }) },
            { rotate: `${angle}deg` },
          ],
        },
      ]}>
      <Image source={STREAK} style={styles.streak} fadeDuration={0} />
    </Animated.View>
  );
}

export const SceneBackground = React.memo(function SceneBackgroundView({ animate = true }: { animate?: boolean }) {
  const reduceMotion = useReduceMotion();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const running = animate && !reduceMotion && !!size;
  const twinkle = useLoop(4200, running);
  const flicker = useLoop(2800, running);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.w !== width || size.h !== height) setSize({ w: width, h: height });
  };

  const layout = useMemo(() => {
    if (!size) return null;
    const { w, h } = size;
    const landH = (w * LAND_H) / ART_W;
    // The sky covers the screen (it may be cropped at the sides on very tall screens).
    const skyH = Math.max((w * SKY_H) / ART_W, h - landH * 0.4);
    const skyW = (skyH * ART_W) / SKY_H;
    const skyLeft = (w - skyW) / 2;
    const k = skyW / ART_W;
    const landK = w / ART_W;
    const landTop = h - landH;
    return {
      w,
      landH,
      sky: { left: skyLeft, width: skyW, height: skyH },
      skyAt: (x: number, y: number): Point => ({ x: skyLeft + x * k, y: y * k }),
      landAt: (x: number, y: number): Point => ({ x: x * landK, y: landTop + (y - LAND_TOP) * landK }),
    };
  }, [size]);

  const motion = !reduceMotion;
  const shooting = motion && animate;

  return (
    <View pointerEvents="none" style={styles.fill} onLayout={onLayout}>
      {layout && (
        <>
          <Image
            source={SKY}
            fadeDuration={0}
            resizeMode="cover"
            style={[styles.sky, { left: layout.sky.left, width: layout.sky.width, height: layout.sky.height }]}
          />
          {TWINKLES.map(([x, y, phase], i) => {
            const p = layout.skyAt(x, y);
            const opacity = motion ? wave(twinkle, phase, 0.15, 1) : STILL_TWINKLE;
            return (
              <Animated.View key={`t${i}`} style={[styles.twinkle, { left: p.x - 6, top: p.y - 6, opacity }]}>
                <Image source={GLOW} style={styles.twinkleGlow} fadeDuration={0} />
                <View style={styles.twinkleCore} />
              </Animated.View>
            );
          })}
          <ShootingStar from={layout.skyAt(206, 12)} to={layout.skyAt(96, 48)} delay={1800} every={7400} enabled={shooting} />
          <ShootingStar from={layout.skyAt(398, 300)} to={layout.skyAt(292, 336)} delay={5200} every={10400} enabled={shooting} />
          <Image
            source={LAND}
            fadeDuration={0}
            style={[styles.land, { width: layout.w, height: layout.landH }]}
          />
          {FIREFLIES.map(([x, y, phase], i) => {
            const p = layout.landAt(x, y);
            const opacity = motion ? wave(flicker, phase, 0.1, 1) : STILL_FIREFLY;
            return (
              <Animated.View key={`f${i}`} style={[styles.firefly, { left: p.x - 7, top: p.y - 7, opacity }]}>
                <Image source={GLOW} style={styles.fireflyGlow} fadeDuration={0} />
                <View style={styles.fireflyCore} />
              </Animated.View>
            );
          })}
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, backgroundColor: HOME.night, overflow: 'hidden' },
  abs: { position: 'absolute' },
  sky: { position: 'absolute', top: 0 },
  land: { position: 'absolute', left: 0, bottom: 0 },
  origin: { position: 'absolute', left: 0, top: 0, width: 0, height: 0 },
  streak: { position: 'absolute', left: -2, top: -4, width: 64, height: 9, opacity: 0.95 },
  twinkle: { position: 'absolute', width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  twinkleGlow: { position: 'absolute', width: 12, height: 12, opacity: 0.55 },
  twinkleCore: { width: 2.4, height: 2.4, borderRadius: 1.2, backgroundColor: '#FFFFFF' },
  firefly: { position: 'absolute', width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  fireflyGlow: { position: 'absolute', width: 14, height: 14, tintColor: '#FFE98A', opacity: 0.7 },
  fireflyCore: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#FFF3B8' },
});
