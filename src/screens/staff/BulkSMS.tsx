// Bulk SMS (managers) — compose + history. Sending is simulated server-side.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, errorText } from '../../api';
import {
  Badge,
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
import { usePagedApi } from '../../hooks';
import { statusLabel, t } from '../../i18n';
import { colors } from '../../theme';
import type { SmsLog } from '../../types';

const GROUPS = [
  { value: 'all_parents', label: 'All Parents' },
  { value: 'all_teachers', label: 'All Teachers' },
  { value: 'all_staff', label: 'All Staff' },
];
const groupLabel = (value: string) => t(GROUPS.find(g => g.value === value)?.label ?? value.replace(/_/g, ' '));

export default function BulkSMS() {
  const list = usePagedApi<SmsLog>('/sms');
  const [composing, setComposing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [group, setGroup] = useState('all_parents');
  const [message, setMessage] = useState('');

  const openCompose = () => {
    setFormError(null);
    setComposing(true);
  };

  const send = async () => {
    if (!message.trim()) return setFormError(t('Message is required'));
    setBusy(true);
    setFormError(null);
    try {
      await api('/sms', { method: 'POST', body: { recipient_group: group, message: message.trim() } });
      setComposing(false);
      setMessage('');
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
        <ListSkeleton badge="right" lines={2} />
      </ScreenSkeleton>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={list.items}
        keyExtractor={m => m.id}
        header={<ErrorBox message={list.error} />}
        empty={<Empty icon="💬" text={t('No SMS sent yet.')} />}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        renderItem={m => (
          <Card>
            <View style={styles.head}>
              <Text style={styles.group}>{groupLabel(m.recipient_group)}</Text>
              <Badge status={m.status === 'sent' ? 'completed' : 'failed'} label={statusLabel(m.status)} />
            </View>
            <Text style={styles.msg}>{m.message}</Text>
            <Text style={styles.sub}>
              👥 {t('{n} recipients', { n: m.recipients_count })} · {fmtDate(m.created_at)}
            </Text>
          </Card>
        )}
      />
      <Fab icon="✉️" onPress={openCompose} />

      <Sheet visible={composing} title={t('Send bulk SMS')} onClose={() => setComposing(false)} error={formError}>
        <Text style={styles.label}>{t('Recipients')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
          {GROUPS.map(g => (
            <Chip key={g.value} label={t(g.label)} active={group === g.value} onPress={() => setGroup(g.value)} />
          ))}
        </View>
        <Input
          label={t('Message')}
          multiline
          style={{ minHeight: 90, textAlignVertical: 'top' }}
          value={message}
          onChangeText={setMessage}
          maxLength={1000}
          hint={`${message.length}/1000`}
        />
        <Button label={t('Send SMS')} onPress={send} busy={busy} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  group: { fontSize: 14, fontWeight: '800', color: colors.ink },
  msg: { fontSize: 13, color: colors.ink, marginTop: 6 },
  sub: { fontSize: 11.5, color: colors.subtle, marginTop: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
});
