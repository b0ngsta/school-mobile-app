// Syllabus for staff (Nov 2026): share the syllabus parents see in the app —
// either the FULL syllabus of a class in one PDF (no subject → the parent
// app's "Full Syllabus" section) or one subject's syllabus (→ that subject's
// box on the parent Syllabus screen). Same API and rules as the web
// Documents page: POST/PUT/DELETE /documents (kind=syllabus).
// Teachers: classes they are assigned to; managers: every class. Edit /
// delete: the uploader or managers.
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import { api, errorText } from '../../api';
import { openFile } from '../../components/files';
import { AttachmentRow, Pill } from '../../components/portal';
import {
  Button,
  Card,
  Chip,
  Empty,
  ErrorBox,
  Fab,
  Input,
  ListSkeleton,
  Screen,
  Segments,
  Sheet,
  fmtDate,
} from '../../components/ui';
import { useApi } from '../../hooks';
import { t } from '../../i18n';
import { MANAGER_ROLES } from '../../roles';
import { colors } from '../../theme';
import type { AdminClass, Assignment, PickedDocument, SchoolDocument, ScreenProps } from '../../types';

type Mode = 'full' | 'subject';

interface Form {
  id: number | null;
  mode: Mode;
  classId: number | null;
  sectionId: number | null;
  subject: string;
  title: string;
  file: PickedDocument | null;
}

const EMPTY: Form = { id: null, mode: 'full', classId: null, sectionId: null, subject: '', title: '', file: null };

/** PDF or photo, one file. */
export async function pickSyllabusFile(): Promise<PickedDocument | null> {
  try {
    const [file] = await pick({ type: [types.pdf, types.images], allowMultiSelection: false });
    return { uri: file.uri, name: file.name, type: file.type };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return null;
    throw e;
  }
}

type DocRow = SchoolDocument & { class_id?: number | null; section_id?: number | null; created_by?: number | null };

export default function StaffSyllabus({ navigate, session }: ScreenProps) {
  const manager = MANAGER_ROLES.includes(session.user_type);
  const docs = useApi<DocRow[]>('/documents?kind=syllabus&limit=100');
  const classesApi = useApi<AdminClass[]>('/classes');
  const mine = useApi<Assignment[]>(manager ? null : '/assignments/mine');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<number | 'all'>('all');

  // classes this person may share a syllabus for (teachers: assigned ones, only their sections)
  const classes = useMemo(() => {
    const all = classesApi.data || [];
    if (manager) return all;
    const assigned = mine.data || [];
    return all
      .filter(c => assigned.some(a => a.class_id === c.id))
      .map(c => ({ ...c, sections: c.sections.filter(s => assigned.some(a => a.section_id === s.id)) }));
  }, [classesApi.data, mine.data, manager]);
  const cls = classes.find(c => c.id === form.classId) || null;

  const rows = useMemo(() => {
    const list = docs.data || [];
    return filter === 'all' ? list : list.filter(d => d.class_id === filter);
  }, [docs.data, filter]);

  const set = (patch: Partial<Form>) => setForm(f => ({ ...f, ...patch }));
  const openNew = () => {
    setFormError(null);
    const only = classes.length === 1 ? classes[0].id : filter !== 'all' ? filter : null;
    setForm({ ...EMPTY, classId: only });
    setOpen(true);
  };
  const openEdit = (d: DocRow) => {
    setFormError(null);
    setForm({
      id: d.id,
      mode: d.subject ? 'subject' : 'full',
      classId: d.class_id ?? null,
      sectionId: d.section_id ?? null,
      subject: d.subject || '',
      title: d.title,
      file: null,
    });
    setOpen(true);
  };

  const choose = async () => {
    try {
      const file = await pickSyllabusFile();
      if (file) set({ file });
    } catch (e) {
      setFormError(errorText(e));
    }
  };

  const reload = useCallback(() => docs.refresh(), [docs]);

  const save = async () => {
    const editing = form.id != null;
    if (!editing && !form.classId) return setFormError(t('Choose a class'));
    if (form.mode === 'subject' && !form.subject.trim()) return setFormError(t('Choose a subject'));
    if (!editing && !form.file) return setFormError(t('Choose the PDF (or photo) to upload'));
    const title = form.title.trim() ||
      (form.mode === 'full' ? t('Full syllabus — {cls}', { cls: cls?.name || '' }) : `${form.subject.trim()} ${t('syllabus')}`);
    const fd = new FormData();
    fd.append('title', title);
    fd.append('subject', form.mode === 'full' ? '' : form.subject.trim());
    if (!editing) {
      fd.append('kind', 'syllabus');
      fd.append('class_id', String(form.classId));
      if (form.sectionId) fd.append('section_id', String(form.sectionId));
    }
    if (form.file) {
      const isPdf = (form.file.type || '').includes('pdf') || /\.pdf$/i.test(form.file.name || '');
      fd.append('file', {
        uri: form.file.uri,
        name: form.file.name || (isPdf ? 'syllabus.pdf' : 'syllabus.jpg'),
        type: form.file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
      } as unknown as Blob);
    }
    setBusy(true);
    setFormError(null);
    try {
      await api(editing ? `/documents/${form.id}` : '/documents', { method: editing ? 'PUT' : 'POST', formData: fd });
      setOpen(false);
      reload();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (d: DocRow) =>
    Alert.alert(t('Delete this syllabus?'), t('Parents will no longer see it.'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/documents/${d.id}`, { method: 'DELETE' });
            reload();
          } catch (e) {
            setError(errorText(e));
          }
        },
      },
    ]);

  const canChange = (d: DocRow) => manager || d.created_by === session.user_id;
  const loading = docs.loading || classesApi.loading;

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={docs.refreshing} onRefresh={docs.refresh}>
        <Card style={[styles.intro, { backgroundColor: colors.brandSoft }]}>
          <Text style={[styles.introTitle, { color: colors.brand }]}>📘 {t('Share the syllabus with parents')}</Text>
          <Text style={styles.introText}>
            {t('Upload the whole syllabus in ONE PDF (parents see it under “Full Syllabus”), or one PDF per subject.')}
          </Text>
        </Card>
        <ErrorBox message={error || docs.error || classesApi.error} />
        {classes.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            <Chip label={t('All classes')} active={filter === 'all'} onPress={() => setFilter('all')} />
            {classes.map(c => (
              <Chip key={c.id} label={c.name} active={filter === c.id} onPress={() => setFilter(c.id)} />
            ))}
          </ScrollView>
        )}
        {loading ? (
          <ListSkeleton icon lines={2} count={3} />
        ) : rows.length === 0 ? (
          <Empty icon="book-education-outline" text={t('No syllabus shared yet. Tap + to upload one.')} />
        ) : (
          rows.map(d => (
            <Card key={d.id}>
              <View style={styles.rowHead}>
                <Text style={styles.title} numberOfLines={2}>{d.title}</Text>
                {d.subject ? (
                  <Pill label={d.subject} fg={colors.info} bg={colors.infoSoft} />
                ) : (
                  <Pill label={t('Full syllabus')} icon="book-multiple" fg={colors.brand} bg={colors.brandSoft} />
                )}
              </View>
              <Text style={styles.meta}>
                {d.class_name ? [d.class_name, d.section_name || t('All sections')].join(' · ') : t('Whole school')}
                {' · '}
                {d.uploaded_by || '—'} · {fmtDate(d.created_at)}
              </Text>
              {d.attachment_path ? (
                <AttachmentRow path={d.attachment_path} name={d.attachment_name} type={d.attachment_type}
                  style={{ marginTop: 10 }}
                  onPress={() => openFile(navigate, { path: d.attachment_path!, type: d.attachment_type, name: d.attachment_name || d.title })} />
              ) : null}
              {canChange(d) && (
                <View style={styles.actions}>
                  <Button label={`✏️ ${t('Edit')}`} kind="soft" small onPress={() => openEdit(d)} />
                  <View style={{ width: 8 }} />
                  <Button label={t('Delete')} kind="danger" small onPress={() => remove(d)} />
                </View>
              )}
            </Card>
          ))
        )}
        <View style={{ height: 80 }} />
      </Screen>
      <Fab onPress={openNew} />

      <Sheet visible={open} title={form.id != null ? t('Edit syllabus') : t('Upload syllabus')}
        onClose={() => setOpen(false)} error={formError}>
        <Segments<Mode>
          items={[
            { value: 'full', label: t('Full syllabus (one PDF)') },
            { value: 'subject', label: t('Subject-wise') },
          ]}
          value={form.mode}
          onChange={mode => set({ mode })}
        />
        {form.id == null && (
          <>
            <Text style={styles.label}>{t('Class')}</Text>
            <View style={styles.wrap}>
              {classes.length === 0 && <Text style={styles.meta}>{t('You are not assigned to any class yet.')}</Text>}
              {classes.map(c => (
                <Chip key={c.id} label={c.name} active={form.classId === c.id}
                  onPress={() => set({ classId: c.id, sectionId: null, subject: '' })} />
              ))}
            </View>
            {cls && cls.sections.length > 1 && (
              <>
                <Text style={styles.label}>{t('Section')}</Text>
                <View style={styles.wrap}>
                  {manager || cls.sections.length > 1 ? (
                    <Chip label={t('All sections')} active={form.sectionId == null} onPress={() => set({ sectionId: null })} />
                  ) : null}
                  {cls.sections.map(s => (
                    <Chip key={s.id} label={s.name} active={form.sectionId === s.id} onPress={() => set({ sectionId: s.id })} />
                  ))}
                </View>
              </>
            )}
          </>
        )}
        {form.mode === 'subject' && (
          <>
            <Text style={styles.label}>{t('Subject')}</Text>
            {(cls?.subjects || []).length > 0 ? (
              <View style={styles.wrap}>
                {(cls?.subjects || []).map(s => (
                  <Chip key={s} label={s} active={form.subject === s} onPress={() => set({ subject: s })} />
                ))}
              </View>
            ) : (
              <Input value={form.subject} onChangeText={subject => set({ subject })} placeholder={t('e.g. Mathematics')} />
            )}
          </>
        )}
        <Input label={t('Title (optional)')} value={form.title} onChangeText={title => set({ title })} maxLength={150}
          placeholder={form.mode === 'full' ? t('e.g. Syllabus 2026-27') : t('e.g. Mathematics 2026-27')} />
        <Button kind="ghost" onPress={choose}
          label={form.file ? `📎 ${form.file.name || t('File chosen')}` : form.id != null ? t('Replace the file (optional)') : `⬆️ ${t('Choose PDF or photo')}`} />
        <View style={{ height: 10 }} />
        <Button label={form.id != null ? t('Save changes') : t('Upload')} onPress={save} busy={busy} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: 12 },
  introTitle: { fontSize: 14, fontWeight: '800' },
  introText: { fontSize: 12.5, color: colors.subtle, marginTop: 4, lineHeight: 18 },
  chips: { marginBottom: 10, flexGrow: 0 },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { flex: 1, paddingRight: 8, fontSize: 15, fontWeight: '800', color: colors.ink },
  meta: { fontSize: 12, color: colors.subtle, marginTop: 4 },
  actions: { flexDirection: 'row', marginTop: 10 },
  label: { fontSize: 12, fontWeight: '700', color: colors.subtle, marginTop: 12, marginBottom: 6, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
});
