// Change password. Two entry points:
//  - <ChangePassword> route, from the profile screens (voluntary)
//  - <ForcedPasswordChange>, shown by App.tsx while the server's
//    must_change_password flag is set (seeded / CSV-imported accounts)
// The server returns fresh tokens for this device and signs out the others.
import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { changePassword, errorText, logout } from '../../api';
import { AuthLayout } from '../../components/AuthLayout';
import { Button, Card, ErrorBox, PasswordInput, Screen, TextLink } from '../../components/ui';
import { useI18n } from '../../hooks';
import { colors } from '../../theme';
import type { ScreenProps } from '../../types';
import { firstError, newPasswordError } from '../../validation';

function ChangePasswordForm({ onChanged, submitLabel }: { onChanged: () => void; submitLabel: string }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nextRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  const submit = async () => {
    if (busy) return;
    const bad = firstError(
      !current && t('Enter your current password'),
      newPasswordError(next, confirm),
      next === current && t('The new password must be different from the current one'),
    );
    if (bad) return setError(bad);
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      onChanged();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <>
      <ErrorBox message={error} />
      <PasswordInput
        label={t('Current password')}
        autoComplete="current-password"
        textContentType="password"
        value={current}
        onChangeText={setCurrent}
        returnKeyType="next"
        onSubmitEditing={() => nextRef.current?.focus()}
        submitBehavior="submit"
      />
      <PasswordInput
        ref={nextRef}
        label={t('New password')}
        autoComplete="new-password"
        textContentType="newPassword"
        value={next}
        onChangeText={setNext}
        hint={t('At least 6 characters.')}
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        submitBehavior="submit"
      />
      <PasswordInput
        ref={confirmRef}
        label={t('Confirm new password')}
        autoComplete="new-password"
        textContentType="newPassword"
        value={confirm}
        onChangeText={setConfirm}
        onSubmitEditing={submit}
      />
      <Text style={styles.note}>{t('Your other devices will be signed out.')}</Text>
      <Button label={submitLabel} onPress={submit} busy={busy} />
    </>
  );
}

/** Route screen (from the profile). */
export default function ChangePassword({ goBack }: ScreenProps) {
  const { t } = useI18n();
  const done = () =>
    Alert.alert(t('Password changed'), t('Your other devices have been signed out.'), [{ text: t('OK'), onPress: goBack }]);
  return (
    <Screen>
      <Card>
        <ChangePasswordForm onChanged={done} submitLabel={t('Change password')} />
      </Card>
    </Screen>
  );
}

/** Full-screen gate while the account must set a new password. */
export function ForcedPasswordChange() {
  const { t } = useI18n();
  return (
    <AuthLayout
      title={t('Set a new password')}
      subtitle={t('For your security, choose a new password before you continue.')}
      footer={<TextLink label={t('profile.logout')} onPress={() => logout()} />}>
      {/* Clearing the flag (inside changePassword) lets App.tsx show the home screen. */}
      <ChangePasswordForm onChanged={() => {}} submitLabel={t('Save and continue')} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 12, color: colors.subtle, marginBottom: 10 },
});
