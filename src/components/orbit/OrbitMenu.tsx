// The home screen's orbit menu: every screen of the role is a checkpoint on
// one path — down the right-hand rail, round the Earth, back to the rail as
// its mirror image (geometry.ts). Drag up or down anywhere outside the header
// and ALL checkpoints travel the path together; one leaving at the bottom
// comes back in at the top, so the list loops forever. Tap one to open it.
//
// Performance is the point of this file:
//   * The drag is an invisible native ScrollView. Its offset feeds ONE
//     Animated.Value on the native driver, and every checkpoint's position is
//     an interpolation of it — dragging, flinging and snapping (snapToInterval)
//     run entirely on the UI thread, with no JS per frame and no re-renders.
//   * Checkpoints only translate (no scale / opacity), so Android just moves
//     their already-drawn layers.
//   * The Earth and the curved line are one baked picture (OrbitScene).
//   * JS hears about the scroll only when it comes to rest — to hit-test taps
//     and to tell screen readers which checkpoints are on screen.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import type {
  AccessibilityActionEvent,
  GestureResponderEvent,
  HostInstance,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollViewInstance,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { t } from '../../i18n';
import { hitTest, orbitLayout, pathTables, progressAt, slotItem, slotPoint } from './geometry';
import type { OrbitHit, OrbitLayout } from './geometry';
import { OrbitScene } from './OrbitScene';
import { HOME, alpha, neonFor } from './palette';

const GLOW = require('../../assets/home/glow.png');

export interface OrbitItem {
  key: string;
  label: string;
  /** second line on the card — a live figure when there is one ("₹3,000 due") */
  sub: string;
  /** MaterialCommunityIcons name */
  icon: string;
  onPress: () => void;
  /** red "new" dot: something inside not opened yet (updates.ts) */
  dot?: boolean;
}

const ACTIVATE = [{ name: 'activate' as const }];
const ADJUST = [{ name: 'increment' as const }, { name: 'decrement' as const }];
const DOT = 10;
const TAP_SLOP = 10;
const TAP_MS = 600;

type Pos = Animated.AnimatedInterpolation<number>;
interface SlotAnim {
  x: Pos;
  y: Pos;
  dotX: Pos;
  dotY: Pos;
}

/** Native-driver positions of every checkpoint (and the dot after it) for a layout. */
function slotAnims(L: OrbitLayout, scrollY: Animated.Value): SlotAnim[] {
  const { input, x, y } = pathTables(L);
  const nodeX = x.map(v => v - L.node / 2);
  const nodeY = y.map(v => v - L.node / 2);
  const dotX = x.map(v => v - DOT / 2);
  const dotY = y.map(v => v - DOT / 2);
  const progress = Animated.add(Animated.multiply(scrollY, -1), L.home + L.scrollStart); // = progressAt(L, scrollY)
  const along = (offset: number) => Animated.modulo(Animated.add(progress, offset), L.cycle);
  const lerp = (at: ReturnType<typeof along>, out: number[]): Pos =>
    at.interpolate({ inputRange: input, outputRange: out, extrapolate: 'clamp' });
  return Array.from({ length: L.slots }, (_, j) => {
    const at = along(j * L.step);
    const mid = along((j + 0.5) * L.step);
    return { x: lerp(at, nodeX), y: lerp(at, nodeY), dotX: lerp(mid, dotX), dotY: lerp(mid, dotY) };
  });
}

const onScreenFlags = (L: OrbitLayout, scrollY: number) => {
  const p = progressAt(L, scrollY);
  return Array.from({ length: L.slots }, (_, j) => !!slotPoint(L, j, p));
};

interface Props {
  items: OrbitItem[];
  /** height the header keeps at the top-left */
  headerH: number;
  /** current language — redraws the Earth's labels when it changes */
  lang: string;
  /** told whenever the path is (re)laid out, so the header can size itself */
  onLayoutChange?: (L: OrbitLayout) => void;
}

export const OrbitMenu = React.memo(function OrbitMenuView({ items, headerH, lang, onLayoutChange }: Props) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const count = items.length;
  const L = useMemo(() => (size ? orbitLayout(size.w, size.h, count, headerH) : null), [size, count, headerH]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollViewInstance>(null);
  const rootRef = useRef<HostInstance>(null);
  const origin = useRef({ x: 0, y: 0 }); // this view's page position
  const restY = useRef(0); // scroll offset at rest
  const prevL = useRef<OrbitLayout | null>(null);
  const moving = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touch = useRef<{ x: number; y: number; t: number; hit: OrbitHit } | null>(null);
  const cardWidths = useRef<number[]>([]).current;
  const [live, setLive] = useState<boolean[]>([]);
  const [pressed, setPressed] = useState<number | null>(null);

  const latest = useRef({ L, items });
  latest.current = { L, items };

  /** The scroll came to rest at `y`: remember it and update who's on screen. */
  const settle = useCallback((y: number) => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
    moving.current = false;
    restY.current = y;
    const g = latest.current.L;
    if (!g) return;
    const next = onScreenFlags(g, y);
    setLive(prev => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next));
  }, []);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  // (Re)lay out: keep the list where it was, in whole stops from the start.
  const startY = useMemo(() => {
    if (!L) return 0;
    const prev = prevL.current;
    const stops = prev ? Math.round((prev.scrollStart - restY.current) / prev.step) : 0;
    return L.scrollStart - stops * L.step;
  }, [L]);
  useEffect(() => {
    if (!L) return;
    prevL.current = L;
    scrollY.setValue(startY);
    scrollRef.current?.scrollTo({ y: startY, animated: false });
    settle(startY);
    onLayoutChange?.(L);
  }, [L, startY, scrollY, settle, onLayoutChange]);

  const anims = useMemo(() => (L ? slotAnims(L, scrollY) : []), [L, scrollY]);

  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY],
  );

  /** Move the list by whole stops (+1 = every checkpoint one stop further down). */
  const moveBy = useCallback(
    (stops: number) => {
      const g = latest.current.L;
      if (!g) return;
      const y = restY.current - stops * g.step;
      scrollRef.current?.scrollTo({ y, animated: true });
      settle(y);
    },
    [settle],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.w !== width || size.h !== height) setSize({ w: width, h: height });
    rootRef.current?.measure?.((_x: number, _y: number, _w: number, _h: number, pageX: number, pageY: number) => {
      origin.current = { x: pageX, y: pageY };
    });
  };

  // ---- scroll lifecycle (JS only hears start and end) ----
  const startMoving = () => {
    moving.current = true;
    touch.current = null;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setPressed(null);
  };
  const atRest = (e: NativeSyntheticEvent<NativeScrollEvent>) => settle(e.nativeEvent.contentOffset.y);
  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Snapping normally follows as "momentum"; settle anyway if it doesn't.
    const y = e.nativeEvent.contentOffset.y;
    settleTimer.current = setTimeout(() => settle(y), 250);
  };

  // ---- taps (hit-tested against the resting position) ----
  const onTouchStart = (e: GestureResponderEvent) => {
    const g = latest.current.L;
    if (!g || moving.current) {
      touch.current = null;
      return;
    }
    const { pageX, pageY } = e.nativeEvent;
    const hit = hitTest(g, progressAt(g, restY.current), pageX - origin.current.x, pageY - origin.current.y, cardWidths);
    touch.current = { x: pageX, y: pageY, t: Date.now(), hit };
    if (hit?.kind === 'item') setPressed(hit.slot);
  };
  const onTouchEnd = (e: GestureResponderEvent) => {
    const tap = touch.current;
    const g = latest.current.L;
    touch.current = null;
    setPressed(null);
    if (!tap || !g || moving.current) return;
    const { pageX, pageY } = e.nativeEvent;
    if (Math.hypot(pageX - tap.x, pageY - tap.y) > TAP_SLOP || Date.now() - tap.t > TAP_MS) return;
    if (tap.hit?.kind === 'item') latest.current.items[slotItem(g, tap.hit.slot)]?.onPress();
    else if (tap.hit?.kind === 'earth') moveBy(1);
  };
  const onTouchCancel = () => {
    touch.current = null;
    setPressed(null);
  };

  return (
    <View ref={rootRef} testID="orbit-menu" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {L && (
        <>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <OrbitScene L={L} lang={lang} />
            {anims.map((a, j) => (
              <Dot key={`d${j}`} a={a} color={neonFor(slotItem(L, j + 1), count)} />
            ))}
            {anims.map((a, j) => {
              const index = slotItem(L, j);
              const item = items[index];
              return item ? (
                <Checkpoint
                  key={`c${j}`}
                  L={L}
                  item={item}
                  index={index}
                  count={count}
                  live={!!live[j]}
                  down={pressed === j}
                  a={a}
                  slot={j}
                  cardWidths={cardWidths}
                />
              ) : null;
            })}
            {/* Screen readers can't drag: the Earth is an adjustable control that moves the list. */}
            <View
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={t('Menu wheel')}
              accessibilityHint={t('Swipe up or down to spin the menu')}
              accessibilityActions={ADJUST}
              onAccessibilityAction={(e: AccessibilityActionEvent) => moveBy(e.nativeEvent.actionName === 'increment' ? -1 : 1)}
              style={[styles.abs, { left: L.cx - L.R, top: L.cy - L.R, width: 2 * L.R, height: 2 * L.R }]}
            />
          </View>

          <Animated.ScrollView
            ref={scrollRef}
            style={StyleSheet.absoluteFill}
            contentOffset={{ x: 0, y: startY }}
            onScroll={onScroll}
            scrollEventThrottle={16}
            snapToInterval={L.step}
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            overScrollMode="never"
            bounces={false}
            importantForAccessibility="no"
            onScrollBeginDrag={startMoving}
            onMomentumScrollBegin={startMoving}
            onScrollEndDrag={onScrollEndDrag}
            onMomentumScrollEnd={atRest}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchCancel}>
            <View style={{ height: L.scrollHeight }} />
          </Animated.ScrollView>
        </>
      )}
    </View>
  );
});

/** The small glowing dot between two checkpoints (the next one's colour). */
const Dot = React.memo(function DotView({ a, color }: { a: SlotAnim; color: { c: string; l: string } }) {
  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: color.l, borderColor: alpha(color.c, 0.45), transform: [{ translateX: a.dotX }, { translateY: a.dotY }] },
      ]}
    />
  );
});

interface CheckpointProps {
  L: OrbitLayout;
  item: OrbitItem;
  index: number;
  count: number;
  /** on screen at rest (tappable, readable by screen readers) */
  live: boolean;
  down: boolean;
  a: SlotAnim;
  slot: number;
  /** measured label-card widths, by slot (for hit testing) */
  cardWidths: number[];
}

/** One screen on the path: neon icon + glass label card — the same look everywhere on the path. */
const Checkpoint = React.memo(
  function CheckpointView({ L, item, index, count, live, down, a, slot, cardWidths }: CheckpointProps) {
    const c = neonFor(index, count);
    const glow = L.node * 1.9;
    return (
      <Animated.View
        accessible={live}
        importantForAccessibility={live ? 'yes' : 'no-hide-descendants'}
        accessibilityElementsHidden={!live}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityValue={item.dot ? { text: t('New') } : undefined}
        accessibilityHint={item.sub}
        accessibilityActions={ACTIVATE}
        onAccessibilityAction={(e: AccessibilityActionEvent) => e.nativeEvent.actionName === 'activate' && item.onPress()}
        style={[styles.item, { width: L.node, height: L.node, transform: [{ translateX: a.x }, { translateY: a.y }] }]}>
        <Image
          source={GLOW}
          fadeDuration={0}
          style={[
            styles.glow,
            { left: (L.node - glow) / 2, top: (L.node - glow) / 2, width: glow, height: glow, tintColor: c.c },
            down && styles.glowDown,
          ]}
        />
        <View
          style={[
            styles.node,
            {
              width: L.node,
              height: L.node,
              borderRadius: L.node / 2,
              backgroundColor: c.c,
              backgroundImage: `radial-gradient(circle at 32% 28%, ${c.l}, ${c.c} 55%, ${c.d})`,
            },
            down && styles.nodeDown,
          ]}>
          <MCIcon name={item.icon} size={Math.round(L.node * 0.44)} color="#FFFFFF" />
        </View>
        {item.dot ? <View testID="orbit-new-dot" style={styles.newDot} /> : null}
        <View
          onLayout={e => {
            cardWidths[slot] = e.nativeEvent.layout.width;
          }}
          style={[
            styles.card,
            // A fixed width: an absolute child of the icon-sized box would otherwise be
            // measured inside the icon's 52 dp and squeeze its text (the old tiny cards).
            { right: L.node + L.gap, width: L.cardMax, borderColor: alpha(c.c, down ? 0.85 : 0.5) },
            down && styles.cardDown,
          ]}>
          <Text style={[styles.cardLabel, { color: c.l }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {item.label}
          </Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {item.sub}
          </Text>
        </View>
      </Animated.View>
    );
  },
  // Items are rebuilt when the home's data changes; only redraw a card whose
  // text or icon did (onPress only ever navigates to the same route).
  (p, n) =>
    p.L === n.L &&
    p.a === n.a &&
    p.live === n.live &&
    p.down === n.down &&
    p.index === n.index &&
    p.count === n.count &&
    p.item.label === n.item.label &&
    p.item.sub === n.item.sub &&
    p.item.icon === n.item.icon &&
    p.item.dot === n.item.dot,
);

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  item: { position: 'absolute', left: 0, top: 0 },
  glow: { position: 'absolute', opacity: 0.7 },
  glowDown: { opacity: 1 },
  node: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.42)',
  },
  nodeDown: { borderColor: '#FFFFFF' },
  card: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 10,
    backgroundColor: HOME.glassStrong,
  },
  cardDown: { backgroundColor: 'rgba(48,38,110,0.92)' },
  cardLabel: { fontSize: 15, fontWeight: '800', letterSpacing: 0.1 },
  cardSub: { fontSize: 12, color: HOME.sub, marginTop: 2 },
  newDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  dot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
  },
});
