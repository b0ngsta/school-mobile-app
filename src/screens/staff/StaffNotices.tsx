// Notices for staff & drivers. Managers (admin, principal, sub admin,
// coordinator) post + delete: for the whole school (default) or only chosen
// classes — then only those classes' parents (and teachers) see it and get the
// push (backend 0018) — with an optional PDF / photo.
import React, { useState } from 'react';
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
  Segments,
  Sheet,
  fmtDate,
} from '../../components/ui';
import { useApi, usePagedApi } from '../../hooks';
import { t } from '../../i18n';
import { MANAGER_ROLES } from '../../roles';
import { colors } from '../../theme';
import type { AdminClass, Notice, PickedDocument, ScreenProps } from '../../types';

type Audience = 'school' | 'classes';

export default function StaffNotices({ session, navigate }: ScreenProps) {
  const canPost = MANAGER_ROLES.includes(session.user_type);
  const list = usePagedApi<Notice>('/notices');
  const [audience, setAudience] = useState<Audience>('school');
  const [classIds, setClassIds] = useState<number[]>([]);
  const [file, setFile] = useState<PickedDocument | null>(null);
  const classes = useApi<AdminClass[]>(canPost && audience === 'classes' ? '/classes' : null);
  const toggleClass = (id: number) =>
    setClassIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  const choose = async () => {
    try {
      const picked = await pickAttachment();
      if (picked) setFile(picked);
    } catch (e) {
      setActionError(errorText(e));
    }
  };
  const [actionError, setActionError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const openCompose = () => {
    setActionError(null);
    setComposing(true);
  };

  const post = async () => {
    if (!title.trim() || !body.trim()) return setActionError(t('Title and body are required'));
    if (audience === 'classes' && !classIds.length) return setActionError(t('Choose at least one class'));
    setBusy(true);
    setActionError(null);
    try {
      const made = await api<{ id: number }>('/notices', {
        method: 'POST',
        body: { title: title.trim(), body: body.trim(), class_ids: audience === 'classes' ? classIds : [] },
      });
      let fileError: string | null = null;
      if (file) {
        try {
          await api(`/notices/${made.id}/attachment`, { method: 'POST', formData: attachmentForm(file, 'notice') });
        } catch (e) {
          fileError = t('The notice was published, but the file could not be attached: {why}', { why: errorText(e) });
        }
      }
      setComposing(false);
      setTitle('');
      setBody('');
      setFile(null);
      setAudience('school');
      setClassIds([]);
      setActionError(fileError);
      list.reload();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (n: Notice) =>
    Alert.alert(t('Delete notice?'), n.title, [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: async () => {
          setActionError(null);
          try {
            await api(`/notices/${n.id}`, { method: 'DELETE' });
            list.setItems(items => items?.filter(x => x.id !== n.id) ?? items);
          } catch (e) {
            setActionError(errorText(e));
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

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={list.items}
        keyExtractor={n => n.id}
        header={<ErrorBox message={(!composing && actionError) || list.error} />}
        empty={<Empty icon="📢" text={t('No notices yet.')} />}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        renderItem={n => (
          <Card>
            <Text style={styles.title}>{n.title}</Text>
            <View style={styles.pills}>
              {n.audience === 'classes' ? (
                <Pill icon="account-group-outline" label={t('For {who}', { who: n.audience_label || t('some classes') })}
                  fg={colors.brand} bg={colors.brandSoft} />
              ) : (
                <Pill icon="school-outline" label={t('Whole school')} fg={colors.subtle} bg={colors.page} />
              )}
            </View>
            <Text style={styles.body}>{n.body}</Text>
            {n.attachment_path ? (
              <AttachmentRow path={n.attachment_path} name={n.attachment_name} type={n.attachment_type}
                style={{ marginTop: 10 }}
                onPress={() => openFile(navigate, { path: n.attachment_path!, type: n.attachment_type, name: n.attachment_name || n.title })} />
            ) : null}
            <View style={styles.footer}>
              <Text style={styles.sub}>
                {n.posted_by} · {fmtDate(n.created_at)}
              </Text>
              {canPost && <Button label={t('Delete')} kind="danger" small onPress={() => remove(n)} />}
            </View>
          </Card>
        )}
      />
      {canPost && <Fab icon="📢" onPress={openCompose} />}

      <Sheet visible={composing} title={t('Post notice')} onClose={() => setComposing(false)} error={actionError}>
        <Input label={t('Title')} value={title} onChangeText={setTitle} />
        <Input
          label={t('Body')}
          multiline
          style={{ minHeight: 100, textAlignVertical: 'top' }}
          value={body}
          onChangeText={setBody}
        />
        <Text style={styles.label}>{t('Send to')}</Text>
        <Segments<Audience>
          items={[
            { value: 'school', label: `🏫 ${t('Whole school')}` },
            { value: 'classes', label: `🎯 ${t('Selected classes')}` },
          ]}
          value={audience}
          onChange={setAudience}
        />
        {audience === 'classes' && (
          <>
            <View style={styles.wrap}>
              {(classes.data || []).map(c => (
                <Chip key={c.id} label={c.name} active={classIds.includes(c.id)} onPress={() => toggleClass(c.id)} />
              ))}
              {classes.loading ? <Text style={styles.sub}>{t('Loading…')}</Text> : null}
            </View>
            <Text style={[styles.sub, { marginBottom: 10 }]}>
              {t('Only these classes\' parents and teachers see it and get a notification.')}
            </Text>
          </>
        )}
        <Button kind="ghost" onPress={choose}
          label={file ? `📎 ${file.name || t('File chosen')}` : `📎 ${t('Attach PDF or photo (optional)')}`} />
        <View style={{ height: 10 }} />
        <Button label={t('Post notice')} onPress={post} busy={busy} testID="notice-post" />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '800', color: colors.ink },
  body: { fontSize: 13, color: colors.ink, marginTop: 6, lineHeight: 19 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  sub: { fontSize: 11.5, color: colors.subtle, flexShrink: 1, paddingRight: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  label: { fontSize: 12, fontWeight: '700', color: colors.subtle, marginTop: 4, marginBottom: 6, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
});
