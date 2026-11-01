// Animated screen stack for the app's own small navigator (see App.tsx).
//
// It renders the top entry of the navigation stack and, only while a push or
// pop is running, the entry right beneath it. Both move with the preset the
// route opted into (routes.ts → `transition`):
//
//   fadeScale
//     push  the current screen steps back (shrinks, dims, rounds its corners)
//           while the new one fades in and scales up into place
//     pop   the top screen slides away to the right while the one beneath
//           slides back in and comes forward again
//
// Routes without a preset switch instantly, exactly as before. Mounting is
// unchanged too: at rest only the top screen is mounted, a covered screen
// unmounts when its push finishes and a revealed screen mounts fresh when its
// pop starts, so screens still reload their data when you come back to them.
//
// Animations run on the native driver, so they stay smooth while the new
// screen mounts and loads, and they are skipped when the OS asks for less
// motion (iOS "Reduce Motion", Android "Remove animations").
import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { EasingFunction, StyleProp, ViewStyle } from 'react-native';
import { useReduceMotion } from '../hooks';

/** Transition presets a route can opt into (routes.ts → `transition`). */
export type ScreenTransition = 'fadeScale';

type Direction = 'push' | 'pop';
type AnimatedStyle = Animated.WithAnimatedValue<ViewStyle>;
/** Style of one screen as the transition progress runs 0 → 1. */
type LayerStyle = (progress: Animated.Value, width: number) => AnimatedStyle;

interface Preset {
  duration: Record<Direction, number>;
  easing: Record<Direction, EasingFunction>;
  /** push: the new screen arriving on top */
  entering: LayerStyle;
  /** push: the current screen stepping back underneath it */
  receding: LayerStyle;
  /** pop: the top screen going away */
  leaving: LayerStyle;
  /** pop: the screen underneath coming back to the front */
  returning: LayerStyle;
  /** Strongest dimming over the screen underneath */
  scrimOpacity: number;
}

const CARD_RADIUS = 26; // corners of a screen while it is "lifted"
const ENTER_SCALE = 0.88; // a pushed screen grows from this size…
const RECEDE_SCALE = 0.94; // …while the one beneath shrinks back to this
const RETURN_SHIFT = 0.3; // share of the width a returning screen slides in from

/** Maps progress 0 → 1 linearly onto `from` → `to`. */
const lerp = (progress: Animated.Value, from: number, to: number) =>
  progress.interpolate({ inputRange: [0, 1], outputRange: [from, to] });

const PRESETS: Record<ScreenTransition, Preset> = {
  fadeScale: {
    duration: { push: 380, pop: 340 },
    easing: {
      // ease-out cubic: starts briskly, lands softly, and leaves enough of
      // the middle visible for the scale to read
      push: Easing.bezier(0.33, 1, 0.68, 1),
      pop: Easing.bezier(0.33, 1, 0.68, 1),
    },
    entering: progress => ({
      opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1, 1] }),
      borderRadius: lerp(progress, CARD_RADIUS, 0),
      transform: [{ scale: lerp(progress, ENTER_SCALE, 1) }],
    }),
    receding: progress => ({
      borderRadius: lerp(progress, 0, CARD_RADIUS),
      transform: [{ scale: lerp(progress, 1, RECEDE_SCALE) }],
    }),
    leaving: (progress, width) => ({
      borderRadius: lerp(progress, 0, CARD_RADIUS),
      transform: [{ translateX: lerp(progress, 0, width) }],
    }),
    returning: (progress, width) => ({
      borderRadius: lerp(progress, CARD_RADIUS, 0),
      transform: [
        { translateX: lerp(progress, -width * RETURN_SHIFT, 0) },
        { scale: lerp(progress, RECEDE_SCALE, 1) },
      ],
    }),
    scrimOpacity: 0.4,
  },
};

interface Transition<E> {
  direction: Direction;
  preset: Preset;
  /** Screen underneath: covered by a push, revealed by a pop. */
  under: E;
  /** Screen on top: entering on a push, leaving on a pop. */
  over: E;
  /** Runs 0 → 1 on the native driver. */
  progress: Animated.Value;
}

interface StackState<E> {
  entries: readonly E[];
  transition: Transition<E> | null;
}

/**
 * Works out how the stack changed. The old top still being in the stack means
 * a push; the new top having been in it already means a pop. Anything else (a
 * reset), or a screen without a preset, switches without a transition.
 */
function nextTransition<E>(
  prev: StackState<E>,
  entries: readonly E[],
  keyOf: (entry: E) => string,
  presetOf: (entry: E) => Preset | undefined,
): Transition<E> | null {
  const from = prev.entries[prev.entries.length - 1];
  const to = entries[entries.length - 1];
  if (from === undefined || to === undefined) return null;
  if (keyOf(from) === keyOf(to)) return prev.transition; // same screen on top
  // Navigating again mid-transition (e.g. a very quick hardware back) settles
  // instantly, as before: reversing a half-run native animation smoothly
  // would first need its current value synced back to JS.
  if (prev.transition) return null;

  const contains = (list: readonly E[], entry: E) => list.some(e => keyOf(e) === keyOf(entry));
  const direction: Direction | null = contains(entries, from)
    ? 'push'
    : contains(prev.entries, to)
    ? 'pop'
    : null;
  if (!direction) return null;

  const over = direction === 'push' ? to : from;
  const under = direction === 'push' ? from : to;
  const preset = presetOf(over);
  return preset ? { direction, preset, under, over, progress: new Animated.Value(0) } : null;
}

function transitionStyles<E>({ direction, preset, progress }: Transition<E>, width: number) {
  const push = direction === 'push';
  const dim = preset.scrimOpacity;
  return {
    under: (push ? preset.receding : preset.returning)(progress, width),
    scrim: { opacity: push ? lerp(progress, 0, dim) : lerp(progress, dim, 0) },
    over: (push ? preset.entering : preset.leaving)(progress, width),
  };
}

interface ScreenStackProps<E> {
  /** The navigation stack, bottom → top; the last entry is on screen. */
  entries: readonly E[];
  /** Stable, unique identity of an entry. */
  keyOf: (entry: E) => string;
  /** Preset used when this entry is pushed or popped; none = instant switch. */
  transitionOf: (entry: E) => ScreenTransition | undefined;
  renderScreen: (entry: E) => ReactNode;
  /** Shows around a screen while it is scaled down. */
  backdropColor: string;
  /** Background of every screen. */
  screenColor: string;
}

export function ScreenStack<E>({
  entries,
  keyOf,
  transitionOf,
  renderScreen,
  backdropColor,
  screenColor,
}: ScreenStackProps<E>) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [state, setState] = useState<StackState<E>>({ entries, transition: null });

  // The stack changed: derive the transition during render (React's "adjust
  // state when a prop changes" pattern) so the new screen's very first frame
  // already shows its starting pose instead of flashing the final layout.
  if (state.entries !== entries) {
    const presetOf = (entry: E) => {
      const name = transitionOf(entry);
      return name && !reduceMotion ? PRESETS[name] : undefined;
    };
    setState({ entries, transition: nextTransition(state, entries, keyOf, presetOf) });
  }

  const { transition } = state;
  const animated = useMemo(() => transition && transitionStyles(transition, width), [transition, width]);

  useEffect(() => {
    if (!transition) return undefined;
    const { direction, preset, progress } = transition;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: preset.duration[direction],
      easing: preset.easing[direction],
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      // Settle on the single, static top screen. A transition cut short by a
      // newer one is stopped by the cleanup below and never gets here.
      if (finished) setState(s => (s.transition === transition ? { ...s, transition: null } : s));
    });
    return () => animation.stop();
  }, [transition]);

  const top = state.entries[state.entries.length - 1];
  const layers: ReactNode[] = [];
  if (transition && animated) {
    const push = transition.direction === 'push';
    layers.push(
      <ScreenLayer
        key={`screen:${keyOf(transition.under)}`}
        color={screenColor}
        style={[styles.card, animated.under]}
        outgoing={push}>
        {renderScreen(transition.under)}
      </ScreenLayer>,
      <Animated.View key="scrim" pointerEvents="none" style={[styles.scrim, animated.scrim]} />,
      <ScreenLayer
        key={`screen:${keyOf(transition.over)}`}
        color={screenColor}
        style={[styles.card, styles.lifted, animated.over]}
        outgoing={!push}
        fading={push}>
        {renderScreen(transition.over)}
      </ScreenLayer>,
    );
  } else if (top !== undefined) {
    layers.push(
      <ScreenLayer key={`screen:${keyOf(top)}`} color={screenColor}>
        {renderScreen(top)}
      </ScreenLayer>,
    );
  }

  return (
    // No touches while screens are moving, so a transition can't be doubled up.
    <View style={[styles.stack, { backgroundColor: backdropColor }]} pointerEvents={transition ? 'none' : 'auto'}>
      {layers}
    </View>
  );
}

interface ScreenLayerProps {
  color: string;
  style?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
  /** On its way out: hidden from screen readers. */
  outgoing?: boolean;
  /** Fading in: composite offscreen so overlapping content fades as one. */
  fading?: boolean;
  children: ReactNode;
}

/** One full-size screen in the stack (keyed by its entry by the caller). */
function ScreenLayer({ color, style, outgoing = false, fading = false, children }: ScreenLayerProps) {
  return (
    <Animated.View
      style={[styles.screen, { backgroundColor: color }, style]}
      needsOffscreenAlphaCompositing={fading}
      importantForAccessibility={outgoing ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={outgoing}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: { flex: 1 },
  screen: StyleSheet.absoluteFill,
  // While moving, a screen is clipped to its (animated) rounded corners.
  card: { overflow: 'hidden' },
  // Android shadow under the screen that moves on top.
  lifted: { elevation: 18 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: '#05060F' },
});
