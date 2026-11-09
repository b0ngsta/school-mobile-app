// Teachers directory (managers) — profile cards; tap → teacher profile with
// Details (photo, details, class assignments — managers edit them there) +
// Timetable tabs. Managers add teacher accounts here (Nov 2026: teachers are
// no longer listed or created in Staff Users).
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api, errorText, peek, photoUrl } from '../../api';
import {
  Avatar,
  Button,
  Card,
  Empty,
  ErrorBox,
  Fab,
  Input,
  ListSkeleton,
  PasswordInput,
  Screen,
  ScreenSkeleton,
  Sheet,
} from '../../components/ui';
import { useOnReturn } from '../../hooks';
import { MANAGER_ROLES } from '../../roles';
import { colors } from '../../theme';
import type { ScreenProps, StaffUser } from '../../types';
import { t } from '../../i18n';
import { emailError, firstError, passwordError } from '../../validation';

const EMPTY = {
  full_name: '', username: '', email: '', password: '', phone: '', designation: '', subject: '', qualification: '',
};

export default function Teachers({ navigate, params, session }: ScreenProps) {
  const canAdd = MANAGER_ROLES.includes(session.user_type);
  const [items, setItems] = useState<StaffUser[] | null>(() => peek<StaffUser[]>('/users/teachers'));
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (r = false) => {
    r && setRefreshing(true);
    try {
      setItems(await api('/users/teachers'));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  // photo / details / assignments may have changed in the profile
  useOnReturn(() => load());

  const create = async () => {
    if (!form) return;
    const f = form;
    const bad = firstError(
      !f.full_name.trim() && t('Full name is required'),
      !f.username.trim() && t('Username is required'),
      emailError(f.email),
      passwordError(f.password),
    );
    if (bad) return setFormError(bad);
    setBusy(true);
    setFormError(null);
    try {
      const info = {
        designation: f.designation.trim() || null,
        subject: f.subject.trim() || null,
        qualification: f.qualification.trim() || null,
      };
      await api('/users', {
        method: 'POST',
        body: {
          full_name: f.full_name.trim(),
          username: f.username.trim(),
          email: f.email.trim(),
          password: f.password,
          phone: f.phone.trim() || null,
          user_type: 'teacher',
          teacher_info: Object.values(info).some(Boolean) ? info : null,
        },
      });
      setForm(null);
      load();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!items && !error) {
    return (
      <ScreenSkeleton>
        <ListSkeleton avatar={48} lines={2} count={5} />
      </ScreenSkeleton>
    );
  }

  const set = (k: keyof typeof EMPTY) => (v: string) => setForm(cur => (cur ? { ...cur, [k]: v } : cur));

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={() => load(true)}>
        <ErrorBox message={error} />
        {items?.length === 0 && <Empty icon="🧑‍🏫" text={t('No teachers yet — tap + to add one.')} />}
        {items?.map(tc => (
          <TouchableOpacity
            key={tc.id}
            activeOpacity={0.7}
            onPress={() => navigate('TeacherProfile', { teacher: tc, title: tc.full_name, hint: params?.hint })}>
            <Card style={styles.row}>
              <Avatar name={tc.full_name} uri={photoUrl(tc.photo_path)} size={48} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.name}>{tc.full_name}</Text>
                <Text style={styles.sub}>
                  {tc.designation ? `${tc.designation} · ` : ''}
                  {tc.subject ? `📘 ${tc.subject}` : t('Teacher')}
                  {tc.phone ? ` · 📞 ${tc.phone}` : ''}
                </Text>
                <Text style={styles.sub}>📚 {t('{n} lesson plans', { n: tc.lesson_plan_count })}</Text>
              </View>
              <Text style={{ color: colors.subtle, fontSize: 22 }}>›</Text>
            </Card>
          </TouchableOpacity>
        ))}
      </Screen>
      {canAdd && (
        <Fab onPress={() => { setFormError(null); setForm(EMPTY); }} />
      )}

      <Sheet visible={!!form} title={t('Add teacher')} onClose={() => setForm(null)} error={formError}>
        {form && (
          <>
            <Input label={t('Full name')} value={form.full_name} onChangeText={set('full_name')} />
            <Input label={t('Username')} autoCapitalize="none" autoCorrect={false} value={form.username} onChangeText={set('username')} />
            <Input
              label={t('Email')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              maxLength={120}
              value={form.email}
              onChangeText={set('email')}
              hint={t('Password-reset codes are sent here.')}
            />
            <PasswordInput label={t('Password (min 6 chars)')} autoComplete="new-password" value={form.password} onChangeText={set('password')} />
            <Input label={t('Phone')} keyboardType="phone-pad" value={form.phone} onChangeText={set('phone')} />
            <Input label={t('Designation (e.g. TGT, PGT)')} maxLength={50} value={form.designation} onChangeText={set('designation')} />
            <Input label={t('Subject')} value={form.subject} onChangeText={set('subject')} />
            <Input label={t('Qualification')} value={form.qualification} onChangeText={set('qualification')} />
            <Text style={styles.hint}>{t('Photo and class assignments: open the teacher after saving.')}</Text>
            <Button label={t('Create account')} onPress={create} busy={busy} testID="teacher-create" />
          </>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 2 },
  hint: { fontSize: 12, color: colors.subtle, marginBottom: 10 },
});
