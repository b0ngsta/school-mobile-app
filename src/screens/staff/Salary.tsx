// Salary statements — staff view their own; managers can also record
// monthly salaries for any staff member.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, errorText } from '../../api';
import {
  Badge,
  Button,
  Card,
  Chip,
  ChipsSkeleton,
  Empty,
  ErrorBox,
  Fab,
  Input,
  ListScreen,
  ListSkeleton,
  ScreenSkeleton,
  Segments,
  Sheet,
  inr,
} from '../../components/ui';
import { useApi, usePagedApi } from '../../hooks';
import { t } from '../../i18n';
import { MANAGER_ROLES } from '../../roles';
import { ROLE_LABELS, colors } from '../../theme';
import type { SalaryRecord, ScreenProps, StaffUser } from '../../types';
import { firstError } from '../../validation';

type Tab = 'mine' | 'all';

interface SalaryForm {
  userId: number | null;
  month: number;
  year: string;
  amount: string;
  note: string;
}

const newForm = (): SalaryForm => {
  const now = new Date();
  return { userId: null, month: now.getMonth() + 1, year: String(now.getFullYear()), amount: '', note: '' };
};

export default function Salary({ session }: ScreenProps) {
  const isManager = MANAGER_ROLES.includes(session.user_type);
  const [tab, setTab] = useState<Tab>('mine');
  const list = usePagedApi<SalaryRecord>(tab === 'mine' ? '/salaries/mine' : '/salaries');
  // Staff picker for the "record salary" sheet (managers only).
  const staff = useApi<StaffUser[]>(isManager ? '/users' : null);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<SalaryForm>(newForm);

  const openAdd = () => {
    setFormError(null);
    setForm(newForm());
    setAdding(true);
  };

  const save = async () => {
    const amount = Number(form.amount);
    const year = Number(form.year);
    const bad = firstError(
      !form.userId && t('Pick a staff member and enter the amount'),
      !(amount > 0) && t('Enter a valid amount'),
      !(Number.isInteger(year) && year >= 2000 && year <= 2100) && t('Enter a valid year'),
    );
    if (bad) return setFormError(bad);
    setBusy(true);
    setFormError(null);
    try {
      await api('/salaries', {
        method: 'POST',
        body: { user_id: form.userId, month: form.month, year, amount, note: form.note.trim() || null },
      });
      setAdding(false);
      list.reload();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!list.ready && !list.error) {
    return (
      <ScreenSkeleton>
        {isManager && <ChipsSkeleton count={2} />}
        <ListSkeleton badge="right" lines={2} />
      </ScreenSkeleton>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={list.items}
        keyExtractor={s => s.id}
        header={
          <>
            <ErrorBox message={list.error} />
            {isManager && (
              <Segments<Tab>
                items={[
                  { value: 'mine', label: `💵 ${t('My salary')}` },
                  { value: 'all', label: `👥 ${t('All staff')}` },
                ]}
                value={tab}
                onChange={setTab}
              />
            )}
          </>
        }
        empty={<Empty icon="💵" text={t('No salary statements yet.')} />}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore || list.loading}
        renderItem={s => (
          <Card>
            <View style={styles.head}>
              <Text style={styles.month}>
                {t('months')[s.month - 1]} {s.year}
                {tab === 'all' && s.full_name ? ` — ${s.full_name}` : ''}
              </Text>
              <Badge status={s.status} />
            </View>
            {tab === 'all' && <Text style={styles.sub}>{s.user_type ? t(ROLE_LABELS[s.user_type]) : ''}</Text>}
            <Text style={styles.amount}>{inr(s.amount)}</Text>
            {s.note ? <Text style={styles.sub}>{s.note}</Text> : null}
          </Card>
        )}
      />
      {isManager && <Fab icon="💵" onPress={openAdd} />}

      <Sheet visible={adding} title={t('Record salary')} onClose={() => setAdding(false)} error={formError || staff.error}>
        <Text style={styles.label}>{t('Staff member')}</Text>
        <View style={styles.chips}>
          {(staff.data || []).map(u => (
            <Chip key={u.id} label={u.full_name} active={form.userId === u.id} onPress={() => setForm({ ...form, userId: u.id })} />
          ))}
        </View>
        <Text style={styles.label}>{t('Month')}</Text>
        <View style={styles.chips}>
          {t('months').map((m, i) => (
            <Chip key={i} label={m} active={form.month === i + 1} onPress={() => setForm({ ...form, month: i + 1 })} />
          ))}
        </View>
        <Input label={t('Year')} keyboardType="numeric" maxLength={4} value={form.year} onChangeText={v => setForm({ ...form, year: v })} />
        <Input label={t('Amount (₹)')} keyboardType="numeric" value={form.amount} onChangeText={v => setForm({ ...form, amount: v })} />
        <Input label={t('Note (optional)')} value={form.note} onChangeText={v => setForm({ ...form, note: v })} />
        <Button label={t('Save salary record')} onPress={save} busy={busy} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: 14.5, fontWeight: '800', color: colors.ink, flex: 1, paddingRight: 8 },
  amount: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 6 },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
});
