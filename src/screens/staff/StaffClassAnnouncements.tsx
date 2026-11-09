// Class Announcements for staff (backend 0018): a teacher tells the parents of
// the classes they teach something — heading, message and optionally one PDF
// or photo. Parents see it under "Class Announcements" and get a push.
// Teachers: only their assigned sections (GET /class-announcements/targets),
// and they see / edit / delete their own posts. Managers: any section, all posts.
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { api, errorText } from '../../api';
import { openFile } from '../../components/files';
import { attachmentForm, pickAttachment } from '../../components/pickAttachment';
import { AttachmentRow, Pill } from '../../components/portal';
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
import { useApi, usePagedApi } from '../../hooks';
import { t } from '../../i18n';
import { colors } from '../../theme';
import type { AnnouncementTarget, ClassAnnouncement, PickedDocument, ScreenProps } from '../../types';

interface Form {
  id: number | null;
  title: string;
  body: string;
  sectionIds: number[];
  file: PickedDocument | null;
  dropFile: boolean;
}

const EMPTY: Form = { id: null, title: '', body: '', sectionIds: [], file: null, dropFile: false };

/** Sections grouped under their class, in class order. */
export function groupTargets(targets: AnnouncementTarget[]) {
  const out: { class_id: number; class_name: string; sections: AnnouncementTarget[] }[] = [];
  for (const tg of targets) {
    let g = out.find(x => x.class_id === tg.class_id);
    if (!g) out.push((g = { class_id: tg.class_id, class_name: tg.class_name, sections: [] }));
    g.sections.push(tg);
  }
  return out;
}

export default function StaffClassAnnouncements({ navigate }: ScreenProps) {
  const list = usePagedApi<ClassAnnouncement>('/class-announcements');
  const targetsApi = useApi<AnnouncementTarget[]>('/class-announcements/targets');
  const targets = useMemo(() => targetsApi.data || [], [targetsApi.data]);
  const groups = useMemo(() => groupTargets(targets), [targets]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Form>) => setForm(f => ({ ...f, ...patch }));

  const canPost = targets.length > 0;

  const openNew = () => {
    setFormError(null);
    setForm({ ...EMPTY, sectionIds: targets.length === 1 ? [targets[0].section_id] : [] });
    setOpen(true);
  };
  const openEdit = (a: ClassAnnouncement) => {
    setFormError(null);
    setForm({ ...EMPTY, id: a.id, title: a.title, body: a.body, sectionIds: a.section_ids || [] });
    setOpen(true);
  };

  const toggle = (id: number) =>
    set({ sectionIds: form.sectionIds.includes(id) ? form.sectionIds.filter(x => x !== id) : [...form.sectionIds, id] });
  const toggleClass = (ids: number[]) => {
    const all = ids.every(id => form.sectionIds.includes(id));
    set({ sectionIds: all ? form.sectionIds.filter(x => !ids.includes(x)) : [...new Set([...form.sectionIds, ...ids])] });
  };

  const choose = async () => {
    try {
      const file = await pickAttachment();
      if (file) set({ file, dropFile: false });
    } catch (e) {
      setFormError(errorText(e));
    }
  };

  const save = async () => {
    const editing = form.id != null;
    if (!editing && !form.sectionIds.length) return setFormError(t('Choose at least one class'));
    if (!form.title.trim() || !form.body.trim()) return setFormError(t('Heading and message are required'));
    setBusy(true);
    setFormError(null);
    try {
      const body = { title: form.title.trim(), body: form.body.trim() };
      const saved = await api<ClassAnnouncement>(editing ? `/class-announcements/${form.id}` : '/class-announcements', {
        method: editing ? 'PUT' : 'POST',
        body: editing ? body : { ...body, section_ids: form.sectionIds },
      });
      if (form.file) {
        try {
          await api(`/class-announcements/${saved.id}/attachment`, {
            method: 'POST', formData: attachmentForm(form.file, 'announcement'),
          });
        } catch (e) {
          list.reload();
          setForm(f => ({ ...f, id: saved.id }));
          return setFormError(t('Saved, but the file could not be attached: {why}', { why: errorText(e) }));
        }
      } else if (editing && form.dropFile) {
        await api(`/class-announcements/${saved.id}/attachment`, { method: 'DELETE' });
      }
      setOpen(false);
      list.reload();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (a: ClassAnnouncement) =>
    Alert.alert(t('Delete this announcement?'), t('Parents will no longer see it.'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: async () => {
          setError(null);
          try {
            await api(`/class-announcements/${a.id}`, { method: 'DELETE' });
            list.setItems(items => items?.filter(x => x.id !== a.id) ?? items);
          } catch (e) {
            setError(errorText(e));
          }
        },
      },
    ]);

  if (!list.items && !list.error) {
    return (
      <ScreenSkeleton>
        <ListSkeleton lines={3} count={3} />
      </ScreenSkeleton>
    );
  }

  const editingItem = form.id != null ? list.items?.find(x => x.id === form.id) : null;

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={list.items}
        keyExtractor={a => a.id}
        header={
          <>
            <Card style={{ backgroundColor: colors.brandSoft }}>
              <Text style={[styles.introTitle, { color: colors.brand }]}>📣 {t('Announce to your classes')}</Text>
              <Text style={styles.introText}>
                {t('Parents of the classes you choose see it in the app and get a notification. Add a PDF or photo if needed.')}
              </Text>
            </Card>
            <ErrorBox message={error || targetsApi.error || list.error} />
            {targetsApi.data && !canPost ? (
              <Text style={styles.meta}>{t('You are not assigned to any class yet.')}</Text>
            ) : null}
          </>
        }
        empty={<Empty icon="account-voice" text={t('No announcements yet. Tap + to post one.')} />}
        refreshing={list.refreshing}
        onRefresh={() => { list.refresh(); targetsApi.refresh(); }}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        renderItem={a => (
          <Card>
            <Text style={styles.title}>{a.title}</Text>
            {a.audience_label ? (
              <View style={styles.pills}>
                <Pill icon="account-group-outline" label={a.audience_label} fg={colors.brand} bg={colors.brandSoft} />
              </View>
            ) : null}
            <Text style={styles.body}>{a.body}</Text>
            {a.attachment_path ? (
              <AttachmentRow path={a.attachment_path} name={a.attachment_name} type={a.attachment_type}
                style={{ marginTop: 10 }}
                onPress={() => openFile(navigate, { path: a.attachment_path!, type: a.attachment_type, name: a.attachment_name || a.title })} />
            ) : null}
            <Text style={styles.meta}>
              {[a.posted_by, fmtDate(a.created_at), t('{n} students', { n: a.recipients_count ?? 0 })].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.actions}>
              <Button label={`✏️ ${t('Edit')}`} kind="soft" small onPress={() => openEdit(a)} />
              <View style={{ width: 8 }} />
              <Button label={t('Delete')} kind="danger" small onPress={() => remove(a)} />
            </View>
          </Card>
        )}
      />
      {canPost && <Fab icon="📣" onPress={openNew} />}

      <Sheet visible={open} title={form.id != null ? t('Edit announcement') : t('New announcement')}
        onClose={() => setOpen(false)} error={formError}>
        {form.id == null ? (
          <>
            <Text style={styles.label}>{t('Classes')} ({form.sectionIds.length})</Text>
            {groups.map(g => {
              const ids = g.sections.map(s => s.section_id);
              return (
                <View key={g.class_id} style={styles.wrap}>
                  <Chip label={`${g.class_name}${g.sections.length > 1 ? ` · ${t('All')}` : ''}`}
                    active={ids.every(id => form.sectionIds.includes(id))}
                    onPress={() => (g.sections.length > 1 ? toggleClass(ids) : toggle(ids[0]))} />
                  {g.sections.length > 1 && g.sections.map(s => (
                    <Chip key={s.section_id} label={`${s.section_name}${s.class_teacher ? ' ★' : ''}`}
                      active={form.sectionIds.includes(s.section_id)} onPress={() => toggle(s.section_id)} />
                  ))}
                </View>
              );
            })}
          </>
        ) : editingItem?.audience_label ? (
          <Text style={styles.meta}>{t('For {who}', { who: editingItem.audience_label })}</Text>
        ) : null}
        <Input label={t('Heading')} value={form.title} onChangeText={title => set({ title })} maxLength={150} />
        <Input label={t('Message')} multiline style={{ minHeight: 110, textAlignVertical: 'top' }}
          value={form.body} onChangeText={body => set({ body })} maxLength={4000} />
        <Button kind="ghost" onPress={choose}
          label={form.file ? `📎 ${form.file.name || t('File chosen')}`
            : editingItem?.attachment_path ? t('Replace the file (optional)') : `📎 ${t('Attach PDF or photo (optional)')}`} />
        {form.id != null && editingItem?.attachment_path && !form.file ? (
          <Chip label={form.dropFile ? `✓ ${t('Remove the attached file')}` : t('Remove the attached file')}
            active={form.dropFile} tone="danger" onPress={() => set({ dropFile: !form.dropFile })} />
        ) : null}
        <View style={{ height: 10 }} />
        <Button label={form.id != null ? t('Save changes') : t('Post announcement')} onPress={save} busy={busy}
          testID="class-announcement-save" />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  introTitle: { fontSize: 14, fontWeight: '800' },
  introText: { fontSize: 12.5, color: colors.subtle, marginTop: 4, lineHeight: 18 },
  title: { fontSize: 15, fontWeight: '800', color: colors.ink },
  body: { fontSize: 13, color: colors.ink, marginTop: 6, lineHeight: 19 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  meta: { fontSize: 12, color: colors.subtle, marginTop: 8 },
  actions: { flexDirection: 'row', marginTop: 10 },
  label: { fontSize: 12, fontWeight: '700', color: colors.subtle, marginBottom: 6, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
});
