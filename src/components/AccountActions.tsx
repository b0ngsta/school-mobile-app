// Account buttons shared by the student and staff profile screens:
// change password, sign out of all devices, log out.
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { errorText, logout, logoutAll } from '../api';
import { useI18n } from '../hooks';
import type { NavigateFn } from '../types';
import { Button, ErrorBox } from './ui';

interface Props {
  navigate: NavigateFn;
  onLogout: () => void;
}

export function AccountActions({ navigate, onLogout }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<'one' | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirmLogout = () =>
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.logout'),
        style: 'destructive',
        onPress: async () => {
          setBusy('one');
          await logout();
          onLogout();
        },
      },
    ]);

  const confirmLogoutAll = () =>
    Alert.alert(t('Sign out of all devices?'), t('You will be signed out everywhere, including this phone.'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('Sign out everywhere'),
        style: 'destructive',
        onPress: async () => {
          setBusy('all');
          setError(null);
          try {
            await logoutAll();
            onLogout();
          } catch (e) {
            setError(errorText(e));
            setBusy(null);
          }
        },
      },
    ]);

  return (
    <View>
      <ErrorBox message={error} />
      <Button label={t('Change password')} kind="ghost" onPress={() => navigate('ChangePassword')} disabled={!!busy} />
      <Button
        label={t('Sign out of all devices')}
        kind="ghost"
        onPress={confirmLogoutAll}
        busy={busy === 'all'}
        disabled={!!busy}
        style={{ marginTop: 8 }}
      />
      <Button
        label={t('profile.logout')}
        kind="danger"
        onPress={confirmLogout}
        busy={busy === 'one'}
        disabled={!!busy}
        style={{ marginTop: 8 }}
      />
    </View>
  );
}
