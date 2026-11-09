import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { errorText, getCaptcha, getLastOrgCode, login, needsCaptcha } from '../api';
import type { Captcha } from '../api';
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
  // after a few failed tries the server asks for the characters in a picture
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [answer, setAnswer] = useState('');
  const usernameRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const answerRef = useRef<TextInputInstance>(null);
  const school = useSchoolName(orgCode);

  /** A fresh picture (each one works for a single try). False if none could be fetched. */
  const newPicture = async (): Promise<boolean> => {
    setAnswer('');
    try {
      setCaptcha(await getCaptcha());
      return true;
    } catch (e) {
      setCaptcha(null);
      setError(errorText(e));
      return false;
    }
  };

  // the school code used last time on this phone
  useEffect(() => {
    getLastOrgCode().then(last => setOrgCode(current => current || last));
  }, []);

  const submit = async () => {
    if (busy) return;
    if (!orgCode.trim()) return setError(t('Enter your school code'));
    if (!username.trim() || !password) return setError(t('login.missing'));
    if (captcha && !answer.trim()) return setError(t('captcha.prompt'));
    setBusy(true);
    setError(null);
    const solved = captcha ? { id: captcha.captcha_id, answer: answer.trim() } : null;
    try {
      await login(username.trim(), password, orgCode.trim(), solved);
    } catch (e) {
      if (needsCaptcha(e)) {
        // first time: explain; a wrong answer: say so — either way a new picture
        if (await newPicture()) setError(t(solved ? 'captcha.wrong' : 'captcha.prompt'));
      } else {
        // the picture was used up by this try too
        if (solved) await newPicture();
        setError(errorText(e));
      }
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
    <AuthLayout title="Vidya Nova" subtitle={t('login.subtitle')} top={langToggle}>
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
        onSubmitEditing={() => (captcha ? answerRef.current?.focus() : submit())}
      />
      {captcha ? (
        <View testID="login-captcha">
          <Text style={styles.captchaLabel}>{t('captcha.label')}</Text>
          <View style={styles.captchaRow}>
            <Image
              source={{ uri: captcha.image }}
              style={styles.captchaImage}
              resizeMode="contain"
              accessibilityLabel={t('captcha.label')}
            />
            <TextLink label={t('captcha.new')} onPress={newPicture} disabled={busy} />
          </View>
          <Input
            ref={answerRef}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={captcha.length + 4}
            returnKeyType="go"
            value={answer}
            onChangeText={setAnswer}
            placeholder={t('captcha.placeholder', { n: captcha.length })}
            onSubmitEditing={submit}
          />
        </View>
      ) : null}
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
  captchaLabel: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  captchaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  captchaImage: {
    width: 180,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#fff',
  },
  submit: { marginTop: 14 },
});
