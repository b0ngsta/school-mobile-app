// Keyboard handling for the whole app — ONE place, used by Screen, ListScreen,
// Sheet and AuthLayout (components/ui.tsx, AuthLayout.tsx), so every screen,
// bottom sheet and form gets it without per-screen code.
//
// Why not just KeyboardAvoidingView / windowSoftInputMode="adjustResize"?
// The app draws edge-to-edge (RN 0.87 default, and the Sheet modals are
// navigationBarTranslucent). Edge-to-edge windows are NOT resized by Android
// for the keyboard, so adjustResize alone does nothing and the keyboard covers
// the field. KeyboardAvoidingView guesses its position from onLayout (relative
// to its parent) and needs a hand-tuned keyboardVerticalOffset per header.
//
// What this does instead:
// - one shared Keyboard listener (iOS "will" events, animated; Android "did"),
// - <KeyboardAvoider> measures ITSELF in window coordinates and pads its bottom
//   by exactly the part the keyboard covers. Headers, safe areas and the
//   status bar are measured, not guessed. If the OS already resized the window
//   (non edge-to-edge devices / iOS modals), the overlap is 0 → no double gap.
// - useKeyboardScroll() scrolls the FOCUSED field (+ margin) into view inside
//   its own scroll view. Inputs (ui.tsx Input / PasswordInput) report focus to
//   the nearest KeyboardScope, so a screen behind an open Sheet never scrolls.
//
// New screens: use <Screen> / <ListScreen> / <Sheet> / <AuthLayout> and the
// ui.tsx inputs — nothing else to do. A hand-rolled ScrollView form can use
// <KeyboardScrollView> (same props as ScrollView).
import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardEvent,
  LayoutAnimation,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { useScreenActive } from '../hooks';

/* ------------------------------------------------------------------ */
/* Shared keyboard state                                               */
/* ------------------------------------------------------------------ */

export interface KeyboardState {
  /** Top edge of the keyboard in window/screen coordinates (dp); null = hidden. */
  top: number | null;
  /** Keyboard height (dp); 0 = hidden. */
  height: number;
}

const HIDDEN: KeyboardState = { top: null, height: 0 };
let kbState: KeyboardState = HIDDEN;
const kbListeners = new Set<() => void>();
let kbSubs: unknown[] | null = null;

function animateNext(e?: KeyboardEvent) {
  // iOS gives the keyboard's own duration/curve; Android "did" events come after the fact.
  if (Platform.OS !== 'ios' || !e?.duration) return;
  LayoutAnimation.configureNext({
    duration: Math.max(e.duration, 10),
    update: {
      duration: Math.max(e.duration, 10),
      type: (e.easing as any) || 'keyboard',
    },
  });
}

function setKeyboard(next: KeyboardState, e?: KeyboardEvent) {
  if (next.top === kbState.top && next.height === kbState.height) return;
  animateNext(e);
  kbState = next;
  kbListeners.forEach(l => l());
}

function onShow(e: KeyboardEvent) {
  const end = e?.endCoordinates;
  if (!end || !(end.height > 0)) return setKeyboard(HIDDEN, e);
  const screenH = Dimensions.get('screen').height;
  // screenY = keyboard top. Fall back to screen height − keyboard height if a platform reports junk.
  const top =
    end.screenY > 0 && end.screenY < screenH
      ? end.screenY
      : screenH - end.height;
  setKeyboard({ top, height: end.height }, e);
}

function onHide(e?: KeyboardEvent) {
  setKeyboard(HIDDEN, e);
}

function subscribe(listener: () => void) {
  kbListeners.add(listener);
  // Two native listeners for the app's lifetime (never removed): keeps the state
  // right while screens mount / unmount with the keyboard open.
  if (!kbSubs) {
    kbSubs =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillShow', onShow),
            Keyboard.addListener('keyboardWillChangeFrame', onShow),
            Keyboard.addListener('keyboardWillHide', onHide),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', onShow),
            Keyboard.addListener('keyboardDidHide', onHide),
          ];
  }
  return () => {
    kbListeners.delete(listener);
  };
}

const getKeyboard = () => kbState;

/** Current keyboard position; re-renders the reader only when it changes. */
export function useKeyboard(): KeyboardState {
  return useSyncExternalStore(subscribe, getKeyboard, getKeyboard);
}

/* ------------------------------------------------------------------ */
/* KeyboardAvoider — pads its bottom by what the keyboard covers       */
/* ------------------------------------------------------------------ */

interface AvoiderProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Extra space kept between the keyboard and the content (dp). */
  gap?: number;
}

/**
 * A flex:1 View whose bottom padding equals the part of it the keyboard covers
 * (measured in window coordinates, so headers / safe areas / modals all work).
 * Does nothing while the screen is covered by another one in the stack.
 */
export function KeyboardAvoider({ children, style, gap = 0 }: AvoiderProps) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const kb = useKeyboard();
  const active = useScreenActive();
  const [bottom, setBottom] = useState<number | null>(null);

  const measure = useCallback(() => {
    const node: any = ref.current;
    if (!node?.measureInWindow) return;
    node.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      if (Number.isFinite(y) && Number.isFinite(h)) setBottom(y + h);
    });
  }, []);

  useEffect(() => {
    if (kb.top != null) measure();
  }, [kb.top, measure]);

  const overlap =
    active && kb.top != null && bottom != null
      ? Math.max(0, bottom - kb.top)
      : 0;
  return (
    <View
      ref={ref}
      style={[
        styles.fill,
        style,
        overlap > 0 ? { paddingBottom: overlap + gap } : null,
      ]}
      // The frame can change while the keyboard is up (rotation, OS resize) — re-measure.
      onLayout={kb.top != null ? measure : undefined}
    >
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Scroll the focused field into view                                  */
/* ------------------------------------------------------------------ */

interface ScopeValue {
  /** Called by inputs right after they gain focus. */
  onInputFocus: () => void;
}

const KeyboardScopeContext = createContext<ScopeValue | null>(null);

/** For inputs: tell the nearest keyboard-aware container "I have focus". */
export function useKeyboardFocusReporter() {
  const scope = useContext(KeyboardScopeContext);
  return scope?.onInputFocus;
}

/** Space kept between the focused field and the keyboard / scroll edge (dp). */
const MARGIN = 24;

type ScrollLike = {
  scrollTo?: (o: { y: number; animated?: boolean }) => void;
  scrollToOffset?: (o: { offset: number; animated?: boolean }) => void;
  getNativeScrollRef?: () => any;
};

/**
 * Wiring for a ScrollView / FlatList that should keep the focused field
 * visible. Spread `scrollProps` on the scroll view, give it `ref`, and wrap
 * its content with <KeyboardScope value={scope}>.
 */
export function useKeyboardScroll() {
  const ref = useRef<ScrollLike | null>(null);
  const offset = useRef(0);
  const owned = useRef<unknown>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kb = useKeyboard();

  const ensureVisible = useCallback(() => {
    const input: any = TextInput.State.currentlyFocusedInput?.();
    const list = ref.current;
    if (!input || !list || input !== owned.current || !input.measureInWindow)
      return;
    const host: any = list.getNativeScrollRef?.() ?? list;
    if (!host?.measureInWindow) return;
    host.measureInWindow((_sx: number, sy: number, _sw: number, sh: number) => {
      input.measureInWindow(
        (_ix: number, iy: number, _iw: number, ih: number) => {
          if (![sy, sh, iy, ih].every(Number.isFinite)) return;
          const kbTop = getKeyboard().top;
          let visBottom = sy + sh - MARGIN;
          if (kbTop != null) visBottom = Math.min(visBottom, kbTop - MARGIN);
          const visTop = sy + 8;
          let dy = 0;
          if (iy + ih > visBottom) dy = iy + ih - visBottom;
          if (iy - dy < visTop) dy = iy - visTop; // taller than the space left: show its top
          if (Math.abs(dy) < 1) return;
          const y = Math.max(0, offset.current + dy);
          offset.current = y;
          if (list.scrollTo) list.scrollTo({ y, animated: true });
          else list.scrollToOffset?.({ offset: y, animated: true });
        },
      );
    });
  }, []);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    // Let the avoider's padding (iOS: keyboard animation) settle first.
    timer.current = setTimeout(
      ensureVisible,
      Platform.OS === 'ios' ? 280 : 120,
    );
  }, [ensureVisible]);

  useEffect(() => {
    if (kb.top != null) schedule();
  }, [kb.top, schedule]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const scope = useMemo<ScopeValue>(
    () => ({
      onInputFocus: () => {
        owned.current = TextInput.State.currentlyFocusedInput?.() ?? null;
        // Moving between fields with the keyboard already open: no keyboard event follows.
        if (getKeyboard().top != null) schedule();
      },
    }),
    [schedule],
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  const scrollProps = {
    onScroll,
    scrollEventThrottle: 64,
    keyboardShouldPersistTaps: 'handled' as const,
    // Dragging the content puts the keyboard away (Android supports only on-drag).
    keyboardDismissMode: (Platform.OS === 'ios'
      ? 'interactive'
      : 'on-drag') as ScrollViewProps['keyboardDismissMode'],
  };

  return { ref, scope, scrollProps };
}

export function KeyboardScope({
  value,
  children,
}: {
  value: ScopeValue;
  children?: ReactNode;
}) {
  return (
    <KeyboardScopeContext.Provider value={value}>
      {children}
    </KeyboardScopeContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Ready-made ScrollView                                               */
/* ------------------------------------------------------------------ */

interface KeyboardScrollViewProps extends ScrollViewProps {
  /** false = no own KeyboardAvoider (the parent already lifts it, e.g. Sheet). */
  avoid?: boolean;
  /** Style of the outer avoider (only with avoid). */
  avoiderStyle?: StyleProp<ViewStyle>;
}

/**
 * ScrollView that stays above the keyboard and scrolls the focused field into
 * view. Same props as ScrollView. Use it for any form not built on <Screen>.
 */
export function KeyboardScrollView({
  avoid = true,
  avoiderStyle,
  children,
  onScroll,
  ...props
}: KeyboardScrollViewProps) {
  const { ref, scope, scrollProps } = useKeyboardScroll();
  const trackScroll = scrollProps.onScroll;
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      trackScroll(e);
      onScroll?.(e);
    },
    [trackScroll, onScroll],
  );
  const scroll = (
    <ScrollView
      ref={ref as any}
      keyboardShouldPersistTaps={scrollProps.keyboardShouldPersistTaps}
      keyboardDismissMode={scrollProps.keyboardDismissMode}
      scrollEventThrottle={scrollProps.scrollEventThrottle}
      {...props}
      onScroll={handleScroll}
    >
      <KeyboardScope value={scope}>{children}</KeyboardScope>
    </ScrollView>
  );
  return avoid ? (
    <KeyboardAvoider style={avoiderStyle}>{scroll}</KeyboardAvoider>
  ) : (
    scroll
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
