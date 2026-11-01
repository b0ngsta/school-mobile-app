// Notices for staff & drivers. Admin/principal can post + delete.
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { api, errorText } from '../../api';
import {
  Button,
  Card,
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
import { usePagedApi } from '../../hooks';
import { t } from '../../i18n';
import { colors } from '../../theme';
import type { Notice, ScreenProps } from '../../types';

export default function StaffNotices({ session }: ScreenProps) {
  const canPost = ['admin', 'principal'].includes(session.user_type);
  const list = usePagedApi<Notice>('/notices');
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
    setBusy(true);
    setActionError(null);
    try {
      await api('/notices', { method: 'POST', body: { title: title.trim(), body: body.trim() } });
      setComposing(false);
      setTitle('');
      setBody('');
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
            <Text style={styles.body}>{n.body}</Text>
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
        <Button label={t('Post notice')} onPress={post} busy={busy} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '800', color: colors.ink },
  body: { fontSize: 13, color: colors.ink, marginTop: 6, lineHeight: 19 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  sub: { fontSize: 11.5, color: colors.subtle, flexShrink: 1, paddingRight: 8 },
});
