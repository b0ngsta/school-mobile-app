// EduManage — app shell (multi-role, grid navigation like the mockups).
// The home screen is the role's night-sky orbit launcher (components/orbit)
// and every feature is pushed on a tiny stack; the home stays mounted under it.
// Each stack entry renders as its own page (top bar + screen) inside
// <ScreenStack>, which animates the routes that opt in (routes.ts).
// Role themes (violet student / green teacher / blue admin) are applied at
// login via applyRoleTheme(), so brand colors are read inline on render.
// The UI theme (Profile → Theme: default / creative, uiTheme.ts) is loaded at
// boot; student screens pick their file through screens/themed.tsx, and the
// status / nav bar strips follow whichever home is showing.
// Cold start: the Vidya Nova splash (components/SplashScreen.tsx) covers the app while the saved
// session loads and the API wakes up (warmup.ts); the app renders underneath and is revealed.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
// RN 0.87 draws edge-to-edge on Android (status/nav bars are transparent and
// RN's own SafeAreaView is iOS-only), so insets come from safe-area-context.
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getSession, loadSession, onSessionChange } from './api';
import { featureOfRoute, hasFeature } from './features';
import { startAppStateWatch } from './appEvents';
import { ScreenStack } from './components/ScreenStack';
import LaunchPopup from './components/LaunchPopup';
import { HOME } from './components/orbit/palette';
import SplashScreen from './components/SplashScreen';
// import { SCHOOL_NAME, sessionLabel } from './config';
import { useI18n, useUiTheme } from './hooks';
import { loadLang, t } from './i18n';
import { startUnreadPolling, targetOf } from './notifications';
import { initPush, stopPush } from './push';
import { ForcedPasswordChange } from './screens/auth/ChangePassword';
import ForgotPassword from './screens/auth/ForgotPassword';
import Login from './screens/Login';
import { SCREENS, homeForRole } from './routes';
import type { RouteName, ScreenEntry } from './routes';
import { colors } from './theme';
import type { NavigateFn, RouteParams, Session } from './types';
import { homeIsOrbit, loadUiTheme, resetUiTheme } from './uiTheme';
import { markSeen, startUpdates } from './updates';
import { warmUpServer } from './warmup';

interface StackEntry {
  /** Unique per push, so a screen keeps its identity while it animates. */
  key: string;
  route: RouteName;
  params?: RouteParams;
}

const HOME_KEY = 'home';
/** Longest the splash waits for a sleeping server before opening the app anyway (screens show their own loading). */
const SPLASH_MAX_WAIT_MS = 12_000;
let lastEntryId = 0;

const entryKey = (entry: StackEntry) => entry.key;
const entryTransition = (entry: StackEntry) => {
  const screen: ScreenEntry | undefined = SCREENS[entry.route];
  return screen?.transition;
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

function AppShell() {
  const insets = useSafeAreaInsets();
  const [booted, setBooted] = useState(false);
  const [serverChecked, setServerChecked] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [stack, setStack] = useState<StackEntry[]>([]); // pushed on top of home
  const [authScreen, setAuthScreen] = useState<'login' | 'forgot'>('login');
  /** Shown on the login screen after a sign-out we did not ask for. */
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const userKey = useRef<string | null>(null);

  // Re-render the whole app when the language changes (screens call t()).
  const { lang } = useI18n();
  // Re-paint the status/nav bar strips when the UI theme changes (orbit home or classic).
  const uiTheme = useUiTheme();

  useEffect(() => {
    const stopWatch = startAppStateWatch();
    // Every sign-in / sign-out / expiry / flag change flows through here.
    const unsubscribe = onSessionChange((s, reason) => {
      const key = s ? `${s.user_type}:${s.user_id}` : null;
      if (key !== userKey.current) {
        userKey.current = key;
        setStack([]); // a different user (or none) never inherits screens
        setAuthScreen('login');
      }
      // a module HQ just switched off (features.ts): close its open screens too
      if (s?.features) {
        setStack(st => {
          const kept = st.filter(e => hasFeature(s, featureOfRoute(e.route)));
          return kept.length === st.length ? st : kept;
        });
      }
      if (!s) {
        setLoginNotice(reason === 'expired' ? t('err.sessionExpired') : null);
        // The theme choice lasts one sign-in: the next login starts on the default theme.
        resetUiTheme();
      }
      setSession(s);
    });
    // Wake the API now, in parallel with loading the saved session.
    warmUpServer(SPLASH_MAX_WAIT_MS).then(() => setServerChecked(true));
    Promise.all([loadSession(), loadLang(), loadUiTheme()]).then(() => {
      const s = getSession();
      userKey.current = s ? `${s.user_type}:${s.user_id}` : null;
      setSession(s);
      setBooted(true);
    });
    return () => {
      unsubscribe();
      stopWatch();
    };
  }, []);

  const navigate = useCallback<NavigateFn>((route, params) => {
    // Notifications/pushes can name a route this build doesn't have — ignore those.
    if (!(route in SCREENS)) return;
    // …or a module HQ switched off for this school (features.ts): old pushes, stale links.
    if (!hasFeature(getSession(), featureOfRoute(route))) return;
    const key = `${route}-${++lastEntryId}`;
    markSeen(route); // opening a screen clears its red "new" dot on the home (updates.ts)
    setStack(s => [...s, { key, route, params }]);
  }, []);
  const goBack = useCallback(
    () =>
      setStack(s => {
        // Leaving counts as seen too, so changes made in there don't light its own dot.
        if (s.length) markSeen(s[s.length - 1].route);
        return s.slice(0, -1);
      }),
    [],
  );

  // Signed in: keep the bell's unread count fresh and register for pushes.
  const signedInKey = session && !session.must_change_password ? `${session.user_type}:${session.user_id}` : null;
  const isStudent = session?.user_type === 'student';
  const orgCode = session?.org_code || '';
  useEffect(() => {
    if (!signedInKey) return undefined;
    const stopPolling = startUnreadPolling();
    // Red "new" dots: load what this account already opened here, then the first check (cold start).
    const stopUpdates = startUpdates(`${orgCode}:${signedInKey}`);
    initPush(data => {
      const target = targetOf({ type: data.type || '', data }, isStudent, () => true);
      if (target) navigate(target.route, target.params);
    });
    return () => {
      stopPolling();
      stopUpdates();
      stopPush();
    };
  }, [signedInKey, orgCode, isStudent, navigate]);

  // Android hardware back: pop the stack before exiting
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length) {
        goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, goBack]);

  // Screens call logout() themselves; the session listener does the rest.
  const handleLogout = useCallback(() => setStack([]), []);

  // Home plus everything pushed on top of it — the stack <ScreenStack> draws.
  const homeRoute = session ? homeForRole(session.user_type) : null;
  const entries = useMemo<StackEntry[]>(
    () => (homeRoute ? [{ key: HOME_KEY, route: homeRoute }, ...stack] : []),
    [homeRoute, stack],
  );

  // On the night-sky orbit home, paint the status/nav bar strips to match it
  // (the classic home has a brand-coloured header and the normal page colour).
  // Portal screens draw their own brand header, so the strip above it matches it.
  const atHomeRoot = stack.length === 0;
  const atOrbitHome = atHomeRoot && !!session && homeIsOrbit(session.user_type, uiTheme);
  const topScreen: ScreenEntry | undefined = atHomeRoot ? undefined : SCREENS[stack[stack.length - 1].route];
  const topStrip = atOrbitHome ? HOME.skyTop : atHomeRoot || topScreen?.ownHeader ? colors.brand : colors.brandDark;

  const hideSplash = useCallback(() => setSplashGone(true), []);
  const splash = splashGone ? null : <SplashScreen ready={booted && serverChecked} onHidden={hideSplash} />;
  // The app draws under the splash; its status bar style applies once the splash is gone.
  const withSplash = (content: React.ReactNode) => (
    <View style={styles.safe}>
      {content}
      {splash}
    </View>
  );

  if (!booted) return withSplash(null);
  if (!session || session.must_change_password) {
    return withSplash(
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.page }]}>
        {splashGone ? <StatusBar barStyle="dark-content" /> : null}
        {session ? (
          <ForcedPasswordChange />
        ) : authScreen === 'forgot' ? (
          <ForgotPassword onClose={() => setAuthScreen('login')} />
        ) : (
          <Login notice={loginNotice} onForgotPassword={() => setAuthScreen('forgot')} />
        )}
      </SafeAreaView>,
    );
  }

  return withSplash(
    // Bottom inset is painted separately (page color) so the brand color only
    // shows behind the status bar, like the old opaque status bar did.
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: topStrip }]}>
      {/* StatusBar.backgroundColor is gone with edge-to-edge; the SafeAreaView behind it provides the color. */}
      {splashGone ? <StatusBar barStyle="light-content" /> : null}
      <ScreenStack
        entries={entries}
        keyOf={entryKey}
        transitionOf={entryTransition}
        backdropColor={colors.brandDark}
        screenColor={colors.page}
        persistentKey={HOME_KEY}
        renderScreen={entry => (
          <StackPage entry={entry} lang={lang} session={session} navigate={navigate} goBack={goBack} onLogout={handleLogout} />
        )}
      />
      <View style={{ height: insets.bottom, backgroundColor: atOrbitHome ? HOME.ground : colors.page }} />
      {/* school announcements, once per app start (parents only) */}
      {isStudent && signedInKey && splashGone ? <LaunchPopup userKey={signedInKey} /> : null}
    </SafeAreaView>,
  );
}

interface PageProps {
  entry: StackEntry;
  /** current language — only so a language change redraws every page */
  lang: string;
  session: Session;
  navigate: NavigateFn;
  goBack: () => void;
  onLogout: () => void;
}

/** One stack entry: its top bar plus the screen itself. */
function Page({ entry, session, navigate, goBack, onLogout }: PageProps) {
  const homeRoute = homeForRole(session.user_type);
  const screen: ScreenEntry = SCREENS[entry.route] || SCREENS[homeRoute];
  const ActiveScreen = screen.component;
  const atHome = entry.key === HOME_KEY;
  // Hook (not a prop) so a theme switch repaints this page past StackPage's memo.
  const orbit = homeIsOrbit(session.user_type, useUiTheme());
  const title =
    entry.params?.title || (screen.titleKey ? t(screen.titleKey) : screen.title ? t(screen.title) : 'Vidya Nova');
  return (
    <>
      {/* top bar — back + title on pushed screens; home and `ownHeader` screens draw their own */}
      {!atHome && !screen.ownHeader && (
        <View style={[styles.topbar, { backgroundColor: colors.brand }]}>
          <TouchableOpacity onPress={goBack} style={styles.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MCIcon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
        </View>
      )}

      {/* screen */}
      <View style={[styles.page, { backgroundColor: atHome && orbit ? HOME.skyTop : colors.page }]}>
        <ActiveScreen
          navigate={navigate}
          goBack={goBack}
          params={entry.params}
          session={session}
          onLogout={onLogout}
        />
      </View>
    </>
  );
}

/** Page, redrawn only when what it shows changes — pushing a screen doesn't re-render the (still mounted) home. */
const StackPage = React.memo(
  Page,
  (a, b) =>
    a.entry.key === b.entry.key &&
    a.entry.route === b.entry.route &&
    a.entry.params === b.entry.params &&
    a.lang === b.lang &&
    a.session === b.session &&
    a.navigate === b.navigate &&
    a.goBack === b.goBack &&
    a.onLogout === b.onLogout,
);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { marginRight: 12 },
  topTitle: { flex: 1, color: '#fff', fontSize: 16.5, fontWeight: '800' },
  page: { flex: 1 },
  topSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11.5, marginTop: 1 },
});
