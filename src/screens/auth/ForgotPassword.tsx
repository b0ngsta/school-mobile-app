// Forgot password — three steps, all before sign-in:
//   1. school code + username or email → POST /auth/forgot-password (same reply whether or not the account exists)
//   2. the 6-digit emailed code → POST /auth/verify-reset-code
//   3. new password (twice) → POST /auth/reset-password → signed in
// A successful reset signs this device in; App.tsx's session listener takes over.
import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { ApiError, errorText, getLastOrgCode, requestPasswordReset, resetPassword, verifyResetCode } from '../../api';
import { AuthLayout } from '../../components/AuthLayout';
import { SchoolCodeInput, useSchoolName } from '../../components/SchoolCodeInput';
import { Button, ErrorBox, Input, NoticeBox, PasswordInput, TextLink } from '../../components/ui';
import { useI18n } from '../../hooks';
import { colors } from '../../theme';
import { RESET_CODE_LENGTH, newPasswordError, resetCodeError } from '../../validation';

type Step = 'request' | 'code' | 'password';

const DEFAULT_CODE_TTL_SEC = 900;

export default function ForgotPassword({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('request');
  const [orgCode, setOrgCode] = useState('');
  const school = useSchoolName(orgCode);
  const [loginId, setLoginId] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ttlSec, setTtlSec] = useState(DEFAULT_CODE_TTL_SEC);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The code was rejected — offer "Send a new code" prominently. */
  const [codeRejected, setCodeRejected] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getLastOrgCode().then(last => setOrgCode(current => current || last));
  }, []);

  const back = () => {
    setError(null);
    if (step === 'password') setStep('code');
    else if (step === 'code') setStep('request');
    else onClose();
  };

  // Android hardware back walks back through the steps.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  });

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
      if (e instanceof ApiError && e.status === 400) setCodeRejected(true);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      const id = loginId.trim();
      if (!orgCode.trim()) throw new Error(t('Enter your school code'));
      if (!id) throw new Error(t('Enter your username or email'));
      const res = await requestPasswordReset(id, orgCode.trim());
      setTtlSec(res?.code_expires_in || DEFAULT_CODE_TTL_SEC);
      setCode('');
      setCodeRejected(false);
      setNotice(
        step === 'request'
          ? t("If an account matches, we've emailed a 6-digit code. It expires in {n} minutes.", {
              n: Math.round((res?.code_expires_in || DEFAULT_CODE_TTL_SEC) / 60),
            })
          : t('A new code has been sent. Only the newest code works.'),
      );
      setStep('code');
    });

  const checkCode = () =>
    run(async () => {
      const bad = resetCodeError(code);
      if (bad) throw new Error(bad);
      let valid = false;
      try {
        valid = await verifyResetCode(loginId.trim(), code, orgCode.trim());
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 400)) throw e;
      }
      if (!valid) {
        setCodeRejected(true);
        throw new Error(t('Wrong or expired code'));
      }
      setNotice(null);
      setStep('password');
    });

  const savePassword = () =>
    run(async () => {
      const bad = newPasswordError(password, confirm);
      if (bad) throw new Error(bad);
      try {
        await resetPassword(loginId.trim(), code, password, orgCode.trim());
      } catch (e) {
        if (e instanceof ApiError && e.status === 400) {
          // Code expired or used up meanwhile: go back to get a new one.
          setStep('code');
          setCodeRejected(true);
          throw new ApiError(t('Wrong or expired code'), { status: 400 });
        }
        throw e;
      }
    });

  const subtitle =
    step === 'request'
      ? t('We will email you a code to set a new password.')
      : step === 'code'
      ? t('Enter the code we emailed you.')
      : t('Choose a new password.');

  return (
    <AuthLayout
      title={t('Forgot password?')}
      subtitle={subtitle}
      onBack={back}
      footer={<TextLink label={t('Back to sign in')} onPress={onClose} />}>
      <NoticeBox message={error ? null : notice} />
      <ErrorBox message={error} />

      {step === 'request' && (
        <>
          <SchoolCodeInput value={orgCode} onChangeText={setOrgCode} school={school} />
          <Input
            label={t('Username or email')}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={loginId}
            onChangeText={setLoginId}
            onSubmitEditing={sendCode}
            returnKeyType="send"
          />
          <Text style={styles.hint}>{t('Several children on one email? Enter the child’s username.')}</Text>
          <Text style={styles.hint}>{t('No email on your account? Ask the school office.')}</Text>
          <Button label={t('Send code')} onPress={sendCode} busy={busy} style={styles.action} />
        </>
      )}

      {step === 'code' && (
        <>
          <Input
            label={t('{n}-digit code', { n: RESET_CODE_LENGTH })}
            value={code}
            onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, RESET_CODE_LENGTH))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={RESET_CODE_LENGTH}
            onSubmitEditing={checkCode}
            style={styles.code}
            hint={t('The code expires in {n} minutes. After 5 wrong tries you need a new code.', {
              n: Math.round(ttlSec / 60),
            })}
          />
          <Button label={t('Continue')} onPress={checkCode} busy={busy} style={styles.action} />
          <View style={styles.resend}>
            <Button label={t('Send a new code')} kind={codeRejected ? 'soft' : 'ghost'} small onPress={sendCode} disabled={busy} />
          </View>
        </>
      )}

      {step === 'password' && (
        <>
          <PasswordInput
            label={t('New password')}
            autoComplete="new-password"
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
            hint={t('At least 6 characters.')}
          />
          <PasswordInput
            label={t('Confirm new password')}
            autoComplete="new-password"
            textContentType="newPassword"
            value={confirm}
            onChangeText={setConfirm}
            onSubmitEditing={savePassword}
          />
          <Text style={styles.hint}>{t('Every device signed in to this account will be signed out.')}</Text>
          <Button label={t('Set new password')} onPress={savePassword} busy={busy} style={styles.action} />
        </>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.subtle, marginBottom: 6, lineHeight: 17 },
  action: { marginTop: 10 },
  code: { fontSize: 22, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
  resend: { alignItems: 'center', marginTop: 12 },
});
