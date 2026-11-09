// Students of a section. Tap → student detail. Managers/class teacher can
// add students and jump straight into attendance marking.
import React, { memo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api, errorText, photoUrl } from '../../api';
import {
  Avatar,
  Bone,
  Button,
  Card,
  Empty,
  ErrorBox,
  Fab,
  HeroSkeleton,
  Input,
  ListScreen,
  ListSkeleton,
  PasswordInput,
  ScreenSkeleton,
  Sheet,
} from '../../components/ui';
import { useOnReturn, usePagedApi } from '../../hooks';
import { t } from '../../i18n';
import { MANAGER_ROLES } from '../../roles';
import { colors } from '../../theme';
import type { NavigateFn, ScreenProps, StudentListItem } from '../../types';
import { emailError, firstError, passwordError } from '../../validation';
import { hasFeature } from '../../features';

const EMPTY_FORM = { full_name: '', username: '', email: '', password: '', roll_no: '' };

export default function SectionStudents({ navigate, params, session }: ScreenProps) {
  const { classId, sectionId, className, sectionName, canEdit } = params || {};
  const mayEdit = MANAGER_ROLES.includes(session.user_type) || canEdit;
  const list = usePagedApi<StudentListItem>(`/students?class_id=${classId}&section_id=${sectionId}`);
  const items = list.items;
  // students added from Excel (StudentImport) show up on return
  useOnReturn(() => list.reload());
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const openAdd = () => {
    setFormError(null);
    setAdding(true);
  };

  const addStudent = async () => {
    const bad = firstError(
      !form.full_name.trim() && t('Full name is required'),
      !form.username.trim() && t('Username is required'),
      emailError(form.email),
      passwordError(form.password),
    );
    if (bad) return setFormError(bad);
    setBusy(true);
    setFormError(null);
    try {
      await api('/students', {
        method: 'POST',
        body: {
          full_name: form.full_name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          roll_no: form.roll_no.trim() || null,
          class_id: classId,
          section_id: sectionId,
        },
      });
      setAdding(false);
      setForm(EMPTY_FORM);
      list.reload();
    } catch (e) {
      // 409: username / admission number / roll number already used
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!items && !list.error) {
    return (
      <ScreenSkeleton>
        <HeroSkeleton />
        <Bone height={44} radius={14} style={{ marginBottom: 12 }} />
        <ListSkeleton avatar={42} lines={1} count={6} />
      </ScreenSkeleton>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={items}
        keyExtractor={s => s.id}
        renderItem={s => <StudentRow student={s} navigate={navigate} />}
        empty={<Empty icon="🧑‍🎓" text={t('No students in this section yet.')} />}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        header={
          <>
        <ErrorBox message={list.error} />

        <View style={[styles.hero, { backgroundColor: colors.brand }]}>
          <Text style={styles.heroTitle}>{className} — {t('Section {name}', { name: sectionName })}</Text>
          <Text style={styles.heroSub}>{t('{n} students', { n: list.total ?? items?.length ?? 0 })}</Text>
        </View>

        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          {hasFeature(session, 'attendance') && mayEdit && (
            <Button
              label={t("Today's attendance")}
              icon="clipboard-check-outline"
              kind="soft"
              onPress={() =>
                navigate('MarkAttendance', { classId, sectionId, className, sectionName })
              }
              style={{ flex: 1, marginRight: 8 }}
            />
          )}
          <Button
            label={t('Homework')}
            icon="book-open-variant"
            kind="soft"
            onPress={() =>
              navigate('ClassHomework', { classId, sectionId, className, sectionName, title: t('Class homework') })
            }
            style={{ flex: 1 }}
          />
        </View>
        {mayEdit && (
          <Button
            label={t('Import students from Excel')}
            icon="microsoft-excel"
            kind="ghost"
            small
            onPress={() => navigate('StudentImport', { classId, sectionId, className, sectionName })}
            style={{ marginBottom: 12 }}
            testID="section-import"
          />
        )}
          </>
        }
      />
      {mayEdit && <Fab onPress={openAdd} />}

      <Sheet visible={adding} title={t('Add student')} onClose={() => setAdding(false)} error={formError}>
        <Input label={t('Full name')} value={form.full_name} onChangeText={v => setForm({ ...form, full_name: v })} />
        <Input label={t('Username')} autoCapitalize="none" autoCorrect={false} value={form.username} onChangeText={v => setForm({ ...form, username: v })} />
        <Input
          label={t('Email')}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          maxLength={120}
          value={form.email}
          onChangeText={v => setForm({ ...form, email: v })}
          hint={t('Parent’s email — password-reset codes are sent here.')}
        />
        <PasswordInput label={t('Password (min 6 chars)')} autoComplete="new-password" value={form.password} onChangeText={v => setForm({ ...form, password: v })} />
        <Input label={t('Roll no.')} keyboardType="numeric" value={form.roll_no} onChangeText={v => setForm({ ...form, roll_no: v })} />
        <Button label={t('Add student')} onPress={addStudent} busy={busy} />
      </Sheet>
    </View>
  );
}

/** One student card; memoised so typing in the "Add student" sheet doesn't redraw the list. */
const StudentRow = memo(function StudentRow({ student: s, navigate }: { student: StudentListItem; navigate: NavigateFn }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => navigate('StudentDetail', { studentId: s.id, title: s.full_name })}>
      <Card style={styles.row}>
        <Avatar name={s.full_name} uri={photoUrl(s.photo_path)} size={42} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name}>{s.full_name}</Text>
          <Text style={styles.sub}>{t('Roll No.')} {s.roll_no || '—'}</Text>
        </View>
        <Text style={{ color: colors.subtle, fontSize: 22 }}>›</Text>
      </Card>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  hero: { borderRadius: 18, padding: 16, marginBottom: 12 },
  heroTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 2 },
});
