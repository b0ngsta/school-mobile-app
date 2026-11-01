// Reception — admission enquiries (managers).
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
  IconStat,
  Input,
  ListScreen,
  ListSkeleton,
  ScreenSkeleton,
  Sheet,
  StatTilesSkeleton,
  fmtDate,
} from '../../components/ui';
import { useApi, usePagedApi } from '../../hooks';
import { statusLabel, t } from '../../i18n';
import { colors } from '../../theme';
import type { Enquiry, EnquiryStats } from '../../types';
import { firstError } from '../../validation';

const STATUSES = ['new', 'follow_up', 'converted', 'closed'];
const EMPTY_FORM = { parent_name: '', student_name: '', class_interested: '', contact: '', notes: '' };

export default function Reception() {
  const stats = useApi<EnquiryStats>('/enquiries/stats');
  const list = usePagedApi<Enquiry>('/enquiries');
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const openAdd = () => {
    setFormError(null);
    setAdding(true);
  };

  const add = async () => {
    const contact = form.contact.trim();
    const bad = firstError(
      (!form.parent_name.trim() || !form.student_name.trim()) && t('Parent, student and contact are required'),
      contact.replace(/\D/g, '').length < 5 && t('Enter a valid contact number'),
    );
    if (bad) return setFormError(bad);
    setBusy(true);
    setFormError(null);
    try {
      await api('/enquiries', {
        method: 'POST',
        body: {
          parent_name: form.parent_name.trim(),
          student_name: form.student_name.trim(),
          class_interested: form.class_interested.trim() || null,
          contact,
          notes: form.notes.trim() || null,
        },
      });
      setAdding(false);
      setForm(EMPTY_FORM);
      list.reload();
      stats.reload();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (enq: Enquiry, status: string) => {
    setActionError(null);
    try {
      await api(`/enquiries/${enq.id}`, { method: 'PUT', body: { status } });
      list.setItems(items => items?.map(e => (e.id === enq.id ? { ...e, status } : e)) ?? items);
      stats.reload();
    } catch (e) {
      setActionError(errorText(e));
    }
  };

  if (!list.items && !list.error) {
    return (
      <ScreenSkeleton>
        <StatTilesSkeleton count={3} />
        <ListSkeleton badge="right" lines={3} count={3} />
      </ScreenSkeleton>
    );
  }

  const s = stats.data;
  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={list.items}
        keyExtractor={e => e.id}
        header={
          <>
            <ErrorBox message={actionError || list.error || stats.error} />
            <View style={styles.statRow}>
              <IconStat icon="🛎️" label={t('Today')} value={s?.today} tint={colors.brand} soft={colors.brandSoft} />
              <IconStat icon="🆕" label={t('New')} value={s?.pending} tint={colors.info} soft={colors.infoSoft} />
              <IconStat icon="✅" label={t('Converted')} value={s?.converted} tint={colors.ok} soft={colors.okSoft} />
            </View>
          </>
        }
        empty={<Empty icon="🛎️" text={t('No enquiries yet.')} />}
        refreshing={list.refreshing}
        onRefresh={() => {
          stats.reload();
          list.refresh();
        }}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        renderItem={e => (
          <Card>
            <View style={styles.head}>
              <Text style={styles.name}>{e.student_name}</Text>
              <Badge status={e.status} />
            </View>
            <Text style={styles.sub}>
              👪 {e.parent_name} · 📞 {e.contact}
              {e.class_interested ? ` · 🏫 ${e.class_interested}` : ''}
            </Text>
            {e.notes ? <Text style={[styles.sub, { marginTop: 3 }]}>{e.notes}</Text> : null}
            <Text style={[styles.sub, { marginTop: 3 }]}>{fmtDate(e.created_at)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
              {STATUSES.filter(st => st !== e.status).map(st => (
                <Chip key={st} label={`→ ${statusLabel(st)}`} onPress={() => setStatus(e, st)} />
              ))}
            </View>
          </Card>
        )}
      />
      <Fab onPress={openAdd} />

      <Sheet visible={adding} title={t('New enquiry')} onClose={() => setAdding(false)} error={formError}>
        <Input label={t('Parent name')} value={form.parent_name} onChangeText={v => setForm({ ...form, parent_name: v })} />
        <Input label={t('Student name')} value={form.student_name} onChangeText={v => setForm({ ...form, student_name: v })} />
        <Input label={t('Class interested')} placeholder={t('e.g. Class 5')} value={form.class_interested} onChangeText={v => setForm({ ...form, class_interested: v })} />
        <Input label={t('Contact')} keyboardType="phone-pad" value={form.contact} onChangeText={v => setForm({ ...form, contact: v })} />
        <Input label={t('Notes')} multiline style={{ minHeight: 60, textAlignVertical: 'top' }} value={form.notes} onChangeText={v => setForm({ ...form, notes: v })} />
        <Button label={t('Add enquiry')} onPress={add} busy={busy} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', marginHorizontal: -4, marginBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 14.5, fontWeight: '800', color: colors.ink, flex: 1, paddingRight: 8 },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 4 },
});
