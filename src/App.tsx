// EduManage — app shell (multi-role, grid navigation like the mockups).
// The header shows the school name + academic session; the home screen is a
// role-specific tile grid and every feature is pushed on a tiny stack.
// Each stack entry renders as its own page (top bar + screen) inside
// <ScreenStack>, which animates the routes that opt in (routes.ts).
// Role themes (violet student / green teacher / blue admin) are applied at
// login via applyRoleTheme(), so brand colors are read inline on render.
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
import { startAppStateWatch } from './appEvents';
import { ScreenStack } from './components/ScreenStack';
import { Loading } from './components/ui';
// import { SCHOOL_NAME, sessionLabel } from './config';
import { useI18n } from './hooks';
import { loadLang, t } from './i18n';
import { getUnread, onUnreadChange, startUnreadPolling, targetOf } from './notifications';
import { initPush, stopPush } from './push';
import { ForcedPasswordChange } from './screens/auth/ChangePassword';
import ForgotPassword from './screens/auth/ForgotPassword';
import Login from './screens/Login';
import { SCREENS, homeForRole } from './routes';
import type { RouteName, ScreenEntry } from './routes';
import { colors } from './theme';
import type { NavigateFn, RouteParams, Session } from './types';

interface StackEntry {
  /** Unique per push, so a screen keeps its identity while it animates. */
  key: string;
  route: RouteName;
  params?: RouteParams;
}

const HOME_KEY = 'home';
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
  const [session, setSession] = useState<Session | null>(null);
  const [stack, setStack] = useState<StackEntry[]>([]); // pushed on top of home
  const [authScreen, setAuthScreen] = useState<'login' | 'forgot'>('login');
  /** Shown on the login screen after a sign-out we did not ask for. */
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const userKey = useRef<string | null>(null);

  // Re-render the whole app when the language changes (screens call t()).
  useI18n();

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
      if (!s) setLoginNotice(reason === 'expired' ? t('err.sessionExpired') : null);
      setSession(s);
    });
    Promise.all([loadSession(), loadLang()]).then(() => {
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
    const key = `${route}-${++lastEntryId}`;
    setStack(s => [...s, { key, route, params }]);
  }, []);
  const goBack = useCallback(() => setStack(s => s.slice(0, -1)), []);

  // Signed in: keep the bell's unread count fresh and register for pushes.
  const signedInKey = session && !session.must_change_password ? `${session.user_type}:${session.user_id}` : null;
  const isStudent = session?.user_type === 'student';
  useEffect(() => {
    if (!signedInKey) return undefined;
    const stopPolling = startUnreadPolling();
    initPush(data => {
      const target = targetOf({ type: data.type || '', data }, isStudent, () => true);
      if (target) navigate(target.route, target.params);
    });
    return () => {
      stopPolling();
      stopPush();
    };
  }, [signedInKey, isStudent, navigate]);

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

  if (!booted) return <Loading />;
  if (!session || session.must_change_password) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.page }]}>
        <StatusBar barStyle="dark-content" />
        {session ? (
          <ForcedPasswordChange />
        ) : authScreen === 'forgot' ? (
          <ForgotPassword onClose={() => setAuthScreen('login')} />
        ) : (
          <Login notice={loginNotice} onForgotPassword={() => setAuthScreen('forgot')} />
        )}
      </SafeAreaView>
    );
  }

  return (
    // Bottom inset is painted separately (page color) so the brand color only
    // shows behind the status bar, like the old opaque status bar did.
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.brandDark }]}>
      {/* StatusBar.backgroundColor is gone with edge-to-edge; the SafeAreaView behind it provides the color. */}
      <StatusBar barStyle="light-content" />
      <ScreenStack
        entries={entries}
        keyOf={entryKey}
        transitionOf={entryTransition}
        backdropColor={colors.brandDark}
        screenColor={colors.page}
        renderScreen={entry => (
          <Page entry={entry} session={session} navigate={navigate} goBack={goBack} onLogout={handleLogout} />
        )}
      />
      <View style={{ height: insets.bottom, backgroundColor: colors.page }} />
    </SafeAreaView>
  );
}

interface PageProps {
  entry: StackEntry;
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
  const title =
    entry.params?.title || (screen.titleKey ? t(screen.titleKey) : screen.title ? t(screen.title) : 'EduManage');
  const unread = useUnread();

  return (
    <>
      {/* top bar — school branding on home, back+title inside */}
      <View style={[styles.topbar, { backgroundColor: colors.brand }]}>
        {!atHome && (
          <TouchableOpacity onPress={goBack} style={styles.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MCIcon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        {atHome ? (
          <>
            <View style={styles.logo}>
              <MCIcon name="school-outline" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              {/* <Text style={styles.topTitle}>{SCHOOL_NAME}</Text> */}
              {/* <Text style={styles.topSub}>{sessionLabel()}</Text> */}
            </View>
            <TouchableOpacity
              onPress={() => navigate('Notifications')}
              style={styles.bell}
              accessibilityLabel={unread ? t('{n} unread notifications', { n: unread }) : t('Notifications')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MCIcon name="bell-outline" size={19} color="#fff" />
              {unread > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <Text style={[styles.topTitle, { flex: 1 }]} numberOfLines={1}>{title}</Text>
        )}
      </View>

      {/* screen */}
      <View style={{ flex: 1, backgroundColor: colors.page }}>
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

/** Unread notification count for the bell. */
function useUnread(): number {
  const [n, setN] = useState(getUnread);
  useEffect(() => onUnreadChange(setN), []);
  return n;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#FFD43B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: '#171A26', fontSize: 10, fontWeight: '800' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { marginRight: 12 },
  bell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { color: '#fff', fontSize: 16.5, fontWeight: '800' },
  topSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11.5, marginTop: 1 },
});
