// Lesson plans — teachers see + create their own; managers browse all.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, errorText } from '../../api';
import {
  Button,
  Card,
  Chip,
  Empty,
  ErrorBox,
  Fab,
  Input,
  ListScreen,
  ListSkeleton,
  ScreenSkeleton,
  Sheet,
  fmtDate,
} from '../../components/ui';
import { DateField } from '../../components/pickers';
import { useApi, usePagedApi } from '../../hooks';
import { t } from '../../i18n';
import { colors } from '../../theme';
import type { Assignment, LessonPlan, ScreenProps } from '../../types';
import { dateRangeError, firstError } from '../../validation';

interface LessonPlanForm {
  heading: string;
  assignment: Assignment | null;
  duration_start: string;
  duration_end: string;
  final_remark: string;
}

const EMPTY_FORM: LessonPlanForm = { heading: '', assignment: null, duration_start: '', duration_end: '', final_remark: '' };

export default function LessonPlans({ session }: ScreenProps) {
  const isTeacher = session.user_type === 'teacher';
  const list = usePagedApi<LessonPlan>('/lessons');
  const assignments = useApi<Assignment[]>(isTeacher ? '/assignments/mine' : null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<LessonPlanForm>(EMPTY_FORM);

  const openCreate = () => {
    setFormError(null);
    setCreating(true);
  };

  const create = async () => {
    const bad = firstError(
      (!form.heading.trim() || !form.assignment) && t('Heading and class are required'),
      dateRangeError(form.duration_start, form.duration_end, { required: false }),
    );
    if (bad || !form.assignment) return setFormError(bad);
    setBusy(true);
    setFormError(null);
    try {
      const fd = new FormData();
      fd.append('heading', form.heading.trim());
      fd.append('class_id', String(form.assignment.class_id));
      fd.append('section_id', String(form.assignment.section_id));
      if (form.duration_start.trim()) fd.append('duration_start', form.duration_start.trim());
      if (form.duration_end.trim()) fd.append('duration_end', form.duration_end.trim());
      if (form.final_remark.trim()) fd.append('final_remark', form.final_remark.trim());
      await api('/lessons', { method: 'POST', formData: fd });
      setCreating(false);
      setForm(EMPTY_FORM);
      list.reload();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!list.items && !list.error) {
    return (
      <ScreenSkeleton>
        <ListSkeleton lines={3} />
      </ScreenSkeleton>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={list.items}
        keyExtractor={p => p.id}
        header={<ErrorBox message={list.error} />}
        empty={<Empty icon="📚" text={t('No lesson plans yet.')} />}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        renderItem={p => (
          <Card>
            <Text style={styles.heading}>{p.heading}</Text>
            <Text style={styles.sub}>
              {p.class_name}
              {p.section_name ? ` — ${p.section_name}` : ''}
              {!isTeacher && p.teacher_name ? ` · ${p.teacher_name}` : ''}
            </Text>
            {p.duration_start || p.duration_end ? (
              <Text style={styles.sub}>
                🗓️ {fmtDate(p.duration_start)} – {fmtDate(p.duration_end)}
              </Text>
            ) : null}
            {p.final_remark ? <Text style={[styles.sub, { marginTop: 4 }]}>{p.final_remark}</Text> : null}
            {p.files?.length ? (
              <Text style={[styles.sub, { marginTop: 4, color: colors.brand, fontWeight: '700' }]}>
                📎 {p.files.length > 1 ? t('{n} files attached', { n: p.files.length }) : t('{n} file attached', { n: p.files.length })}
              </Text>
            ) : null}
          </Card>
        )}
      />
      {isTeacher && <Fab onPress={openCreate} />}

      <Sheet visible={creating} title={t('Add lesson plan')} onClose={() => setCreating(false)} error={formError}>
        <Input label={t('Topic / Heading')} placeholder={t('e.g. Photosynthesis — The Process')} value={form.heading} onChangeText={v => setForm({ ...form, heading: v })} />
        <Text style={styles.label}>{t('Class')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
          {(assignments.data || []).map(a => (
            <Chip
              key={a.id}
              label={`${a.class_name} — ${a.section_name}`}
              active={form.assignment?.id === a.id}
              onPress={() => setForm({ ...form, assignment: a })}
            />
          ))}
          {assignments.data?.length === 0 && <Text style={styles.sub}>{t('No classes assigned to you yet.')}</Text>}
        </View>
        <DateField label={t('From')} optional value={form.duration_start} onChange={v => setForm({ ...form, duration_start: v, duration_end: form.duration_end && form.duration_end < v ? v : form.duration_end })} />
        <DateField label={t('To')} optional value={form.duration_end} min={form.duration_start || undefined} onChange={v => setForm({ ...form, duration_end: v })} />
        <Input label={t('Objective / remark')} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} value={form.final_remark} onChangeText={v => setForm({ ...form, final_remark: v })} />
        <Button label={t('Save lesson plan')} onPress={create} busy={busy} />
        <Text style={{ color: colors.subtle, fontSize: 11.5, marginTop: 8, textAlign: 'center' }}>
          {t('Tip: attach files from the web app.')}
        </Text>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 15, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 3 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
});
