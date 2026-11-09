// A photo that fills its box and can be pinched (1×–4×), dragged while
// zoomed and double-tapped (1× ↔ 2.5×). Plain PanResponder + Animated — no
// gesture library. Used by the FileViewer screen.
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent, NativeTouchEvent } from 'react-native';
import { t } from '../i18n';
import { colors } from '../theme';

const MIN = 1;
const MAX = 4;
const DOUBLE_TAP = 2.5;
const DOUBLE_TAP_MS = 280;

const distance = (a: NativeTouchEvent, b: NativeTouchEvent) => Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function ZoomableImage({ uri, onError }: { uri: string; onError?: () => void }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  // gesture state (plain refs: the gesture must not re-render the screen)
  const g = useRef({ scale: 1, x: 0, y: 0, startScale: 1, startX: 0, startY: 0, startDist: 0, lastTap: 0, moved: false });
  const boxRef = useRef(box);
  boxRef.current = box;

  const responder = useMemo(() => {
    const limit = (s: number) => ({ x: (boxRef.current.w * (s - 1)) / 2, y: (boxRef.current.h * (s - 1)) / 2 });
    const apply = (s: number, x: number, y: number, animate = false) => {
      const lim = limit(s);
      const st = g.current;
      st.scale = s;
      st.x = clamp(x, -lim.x, lim.x);
      st.y = clamp(y, -lim.y, lim.y);
      if (animate) {
        Animated.parallel([
          Animated.spring(scale, { toValue: st.scale, useNativeDriver: true, friction: 7 }),
          Animated.spring(tx, { toValue: st.x, useNativeDriver: true, friction: 7 }),
          Animated.spring(ty, { toValue: st.y, useNativeDriver: true, friction: 7 }),
        ]).start();
      } else {
        scale.setValue(st.scale);
        tx.setValue(st.x);
        ty.setValue(st.y);
      }
    };
    const begin = (e: GestureResponderEvent) => {
      const st = g.current;
      const touches = e.nativeEvent.touches;
      st.startScale = st.scale;
      st.startX = st.x;
      st.startY = st.y;
      st.startDist = touches.length >= 2 ? distance(touches[0], touches[1]) : 0;
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => {
        g.current.moved = false;
        begin(e);
      },
      onPanResponderMove: (e, gesture) => {
        const st = g.current;
        const touches = e.nativeEvent.touches;
        if (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4) st.moved = true;
        if (touches.length >= 2) {
          if (!st.startDist) begin(e); // second finger came down mid-gesture
          const s = clamp((st.startScale * distance(touches[0], touches[1])) / (st.startDist || 1), MIN, MAX);
          apply(s, st.startX, st.startY);
        } else if (st.scale > 1) {
          apply(st.scale, st.startX + gesture.dx, st.startY + gesture.dy);
        }
      },
      onPanResponderRelease: () => {
        const st = g.current;
        if (!st.moved) {
          const now = Date.now();
          if (now - st.lastTap < DOUBLE_TAP_MS) {
            apply(st.scale > 1 ? 1 : DOUBLE_TAP, 0, 0, true);
            st.lastTap = 0;
            return;
          }
          st.lastTap = now;
        }
        if (st.scale < 1.02) apply(1, 0, 0, true);
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, [scale, tx, ty]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  };

  if (failed) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{t('This photo could not be loaded. Pull back and open it again.')}</Text>
      </View>
    );
  }
  return (
    <View style={styles.fill} onLayout={onLayout} {...responder.panHandlers}>
      <Animated.View style={[styles.fill, { transform: [{ translateX: tx }, { translateY: ty }, { scale }] }]}>
        <Image
          source={{ uri }}
          style={styles.fill}
          resizeMode="contain"
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setFailed(true);
            onError?.();
          }}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
      {loading ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: colors.subtle, fontSize: 14, textAlign: 'center' },
});
