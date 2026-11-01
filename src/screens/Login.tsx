import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { errorText, getLastOrgCode, login } from '../api';
import { AuthLayout } from '../components/AuthLayout';
import { SchoolCodeInput, useSchoolName } from '../components/SchoolCodeInput';
import { Button, ErrorBox, Input, NoticeBox, PasswordInput, TextLink } from '../components/ui';
import { useI18n } from '../hooks';
import { LANGS } from '../i18n';
import { colors, radius } from '../theme';

interface LoginProps {
  /** Why we are here, e.g. "Your session expired". */
  notice?: string | null;
  onForgotPassword: () => void;
}

/** Sign-in: school code, username, password. On success the session listener in App.tsx takes over. */
export default function Login({ notice, onForgotPassword }: LoginProps) {
  const { t, lang, setLang } = useI18n();
  const [orgCode, setOrgCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const usernameRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const school = useSchoolName(orgCode);

  // the school code used last time on this phone
  useEffect(() => {
    getLastOrgCode().then(last => setOrgCode(current => current || last));
  }, []);

  const submit = async () => {
    if (busy) return;
    if (!orgCode.trim()) return setError(t('Enter your school code'));
    if (!username.trim() || !password) return setError(t('login.missing'));
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password, orgCode.trim());
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  const langToggle = (
    <View style={styles.langRow}>
      {LANGS.map(l => (
        <TouchableOpacity
          key={l.code}
          style={[styles.langBtn, lang === l.code && { backgroundColor: colors.brand }]}
          onPress={() => setLang(l.code)}>
          <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>{l.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <AuthLayout title="EduManage" subtitle={t('login.subtitle')} top={langToggle}>
      {!error ? <NoticeBox message={notice} /> : null}
      <ErrorBox message={error} />

      <SchoolCodeInput
        value={orgCode}
        onChangeText={setOrgCode}
        school={school}
        onSubmitEditing={() => usernameRef.current?.focus()}
      />
      <Input
        ref={usernameRef}
        label={t('login.username')}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        value={username}
        onChangeText={setUsername}
        placeholder={t('login.username').toLowerCase()}
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <PasswordInput
        ref={passwordRef}
        label={t('login.password')}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        onSubmitEditing={submit}
      />
      <View style={styles.forgot}>
        <TextLink label={t('Forgot password?')} onPress={onForgotPassword} disabled={busy} />
      </View>

      <Button label={t('login.signin')} onPress={submit} busy={busy} style={styles.submit} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  langRow: { flexDirection: 'row', marginBottom: 24 },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    marginHorizontal: 4,
  },
  langText: { fontSize: 13, fontWeight: '600', color: colors.subtle },
  langTextActive: { color: '#fff' },
  forgot: { alignItems: 'flex-end', marginTop: -4 },
  submit: { marginTop: 14 },
});
