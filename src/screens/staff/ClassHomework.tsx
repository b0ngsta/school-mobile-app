// Homework for a whole section: one entry reaches every student (and their
// parents get a notification). Tap an entry to tick who handed it in.
// params: classId, sectionId, className, sectionName
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api, errorText } from '../../api';
import { DateField } from '../../components/pickers';
import {
  Badge,
  Button,
  Card,
  Chip,
  Empty,
  ErrorBox,
  Fab,
  HeroSkeleton,
  Input,
  ListScreen,
  ListSkeleton,
  ScreenSkeleton,
  Sheet,
  fmtDate,
} from '../../components/ui';
import { localIsoDate } from '../../format';
import { usePagedApi } from '../../hooks';
import { t } from '../../i18n';
import { colors } from '../../theme';
import type { ClassHomework as Homework, ClassInfo, ScreenProps } from '../../types';

interface Form {
  id: number | null;
  title: string;
  subject: string;
  due_date: string;
  note: string;
}

const EMPTY: Form = { id: null, title: '', subject: '', due_date: '', note: '' };

export default function ClassHomework({ navigate, params }: ScreenProps) {
  const { classId, sectionId, className, sectionName } = params || {};
  const list = usePagedApi<Homework>(`/homework?class_id=${classId}&section_id=${sectionId}`);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<ClassInfo[]>('/classes')
      .then(cs => setSubjects(cs.find(c => c.id === Number(classId))?.subjects || []))
      .catch(() => {});
  }, [classId]);

  const openNew = () => {
    setFormError(null);
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (h: Homework) => {
    setFormError(null);
    setForm({ id: h.id, title: h.title, subject: h.subject || '', due_date: (h.due_date || '').slice(0, 10), note: h.note || '' });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return setFormError(t('Homework title is required'));
    setBusy(true);
    setFormError(null);
    try {
      const body = {
        class_id: Number(classId),
        section_id: Number(sectionId),
        title: form.title.trim(),
        subject: form.subject.trim() || null,
        due_date: form.due_date || null,
        note: form.note.trim() || null,
      };
      if (form.id) await api(`/homework/${form.id}`, { method: 'PUT', body });
      else await api('/homework', { method: 'POST', body });
      setOpen(false);
      list.reload();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (h: Homework) =>
    Alert.alert(t('Delete homework?'), t('It is removed for every student of this section.'), [
      { text: t('Keep'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/homework/${h.id}`, { method: 'DELETE' });
            list.reload();
          } catch (e) {
            Alert.alert(t('Could not delete'), errorText(e));
          }
        },
      },
    ]);

  if (!list.ready && !list.error) {
    return (
      <ScreenSkeleton>
        <HeroSkeleton />
        <ListSkeleton lines={2} badge="right" action count={3} />
      </ScreenSkeleton>
    );
  }

  const today = localIsoDate();

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={list.items}
        keyExtractor={h => h.id}
        header={
          <>
            <ErrorBox message={list.error} />
            <View style={[styles.hero, { backgroundColor: colors.brand }]}>
              <Text style={styles.heroTitle}>{className} — {t('Section {name}', { name: sectionName })}</Text>
              <Text style={styles.heroSub}>{t('Homework is given to the whole class at once.')}</Text>
            </View>
          </>
        }
        empty={<Empty icon="📚" text={t('No homework given to this class yet.')} />}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        renderItem={h => {
          const c = h.counts;
          const overdue = !!h.due_date && h.due_date.slice(0, 10) < today;
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigate('HomeworkSubmissions', { homework: h, title: h.title })}>
              <Card>
                <View style={styles.head}>
                  <Text style={styles.title}>{h.title}</Text>
                  {h.subject ? <Badge label={h.subject} /> : null}
                </View>
                <Text style={[styles.sub, overdue && { color: colors.danger }]}>
                  {h.due_date ? t('Due {date}', { date: fmtDate(h.due_date) }) : t('No due date')}
                  {h.assigned_by ? ` · ${h.assigned_by}` : ''}
                </Text>
                {h.note ? <Text style={[styles.sub, { marginTop: 4, color: colors.ink }]}>{h.note}</Text> : null}
                {c ? (
                  <View style={styles.counts}>
                    <Badge status="submitted" label={t('{n} submitted', { n: c.submitted })} />
                    <Badge status="pending" label={t('{n} pending', { n: c.pending })} />
                    {c.late ? <Badge status="late" label={t('{n} late', { n: c.late })} /> : null}
                  </View>
                ) : null}
                <View style={styles.actions}>
                  <Button label={`✅ ${t('Mark submissions')}`} kind="soft" small
                    onPress={() => navigate('HomeworkSubmissions', { homework: h, title: h.title })} style={styles.action} />
                  <Button label={`✏️ ${t('Edit')}`} kind="ghost" small onPress={() => openEdit(h)} style={styles.action} />
                  <Button label={`🗑 ${t('Delete')}`} kind="danger" small onPress={() => remove(h)} style={styles.action} />
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
      />
      <Fab onPress={openNew} />

      <Sheet visible={open} title={form.id ? t('Edit homework') : t('Give homework to the class')} onClose={() => setOpen(false)} error={formError}>
        <Input label={`${t('Title')} *`} placeholder={t('e.g. Exercise 4.2, Q1–10')} value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} />
        {subjects.length ? (
          <>
            <Text style={styles.label}>{t('Subject')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
              {subjects.map(s => (
                <Chip key={s} label={s} active={form.subject === s} onPress={() => setForm(f => ({ ...f, subject: f.subject === s ? '' : s }))} />
              ))}
            </View>
          </>
        ) : (
          <Input label={t('Subject')} placeholder={t('e.g. Mathematics')} value={form.subject} onChangeText={v => setForm(f => ({ ...f, subject: v }))} />
        )}
        <DateField label={t('Due date')} optional value={form.due_date} min={form.id ? undefined : today} onChange={v => setForm(f => ({ ...f, due_date: v }))} />
        <Input label={t('Note for parents (optional)')} multiline style={{ minHeight: 60, textAlignVertical: 'top' }} value={form.note} onChangeText={v => setForm(f => ({ ...f, note: v }))} />
        <Button label={form.id ? t('Save changes') : t('Give homework')} onPress={save} busy={busy} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 18, padding: 16, marginBottom: 12 },
  heroTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, marginTop: 2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '800', color: colors.ink, flex: 1, paddingRight: 8 },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 3 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  action: { marginTop: 8, marginRight: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
});
