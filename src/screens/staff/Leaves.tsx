// Leave requests — staff submit, edit, cancel and track their own; managers
// also review everyone's. The request form can find substitute teachers for
// every class the teacher misses (components/SubstituteFinder).
import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { api, errorText, photoUrl } from '../../api';
import { DateField } from '../../components/pickers';
import { SubstituteFinder, picksToBody } from '../../components/SubstituteFinder';
import type { SubstitutePicks } from '../../components/SubstituteFinder';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ChipsSkeleton,
  Empty,
  ErrorBox,
  Fab,
  Icon,
  Input,
  ListScreen,
  ListSkeleton,
  ScreenSkeleton,
  Segments,
  Sheet,
  fmtDate,
} from '../../components/ui';
import { localIsoDate } from '../../format';
import { usePagedApi } from '../../hooks';
import { t } from '../../i18n';
import { MANAGER_ROLES } from '../../roles';
import { ROLE_LABELS, colors } from '../../theme';
import type { LeaveRequest, ScreenProps } from '../../types';
import { dateRangeError, firstError } from '../../validation';

type Tab = 'all' | 'mine';

interface LeaveForm {
  id: number | null;
  from_date: string;
  to_date: string;
  reason: string;
  findSubstitute: boolean;
  picks: SubstitutePicks;
}

const EMPTY_FORM: LeaveForm = { id: null, from_date: '', to_date: '', reason: '', findSubstitute: false, picks: {} };

/** Can the owner still change / withdraw this leave? */
const editable = (l: LeaveRequest) => l.status === 'pending';
const cancellable = (l: LeaveRequest) => l.status === 'pending' || (l.status === 'approved' && l.from_date > localIsoDate());

function CoverageLine({ l }: { l: LeaveRequest }) {
  const c = l.coverage;
  if (!c || !c.periods) return null;
  const all = c.covered >= c.periods;
  return (
    <Text style={[styles.sub, { marginTop: 4, color: all ? colors.ok : colors.warn, fontWeight: '700' }]}>
      🔁 {t('{covered}/{total} periods covered', { covered: c.covered, total: c.periods })}
      {c.pending ? ` · ${t('{n} waiting', { n: c.pending })}` : ''}
    </Text>
  );
}

export default function Leaves({ session, navigate }: ScreenProps) {
  const isManager = MANAGER_ROLES.includes(session.user_type);
  const teaches = session.user_type !== 'driver';
  const [tab, setTab] = useState<Tab>(isManager ? 'all' : 'mine');
  const list = usePagedApi<LeaveRequest>(tab === 'mine' ? '/leaves/mine' : '/leaves');
  const [formOpen, setFormOpen] = useState(false);
  const [reviewing, setReviewing] = useState<LeaveRequest | null>(null);
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<LeaveForm>(EMPTY_FORM);

  const openNew = () => {
    setFormError(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };
  const openEdit = (l: LeaveRequest) => {
    setFormError(null);
    setForm({
      id: l.id,
      from_date: l.from_date.slice(0, 10),
      to_date: l.to_date.slice(0, 10),
      reason: l.reason,
      findSubstitute: teaches && !!l.coverage?.periods,
      picks: {},
    });
    setFormOpen(true);
  };
  const openReview = (l: LeaveRequest) => {
    setFormError(null);
    setNote('');
    setReviewing(l);
  };

  const submit = async () => {
    const bad = firstError(
      dateRangeError(form.from_date, form.to_date),
      !form.reason.trim() && t('Please give a reason'),
    );
    if (bad) return setFormError(bad);
    setBusy(true);
    setFormError(null);
    try {
      const body = {
        from_date: form.from_date,
        to_date: form.to_date,
        reason: form.reason.trim(),
        substitutions: form.findSubstitute ? picksToBody(form.picks, form.from_date, form.to_date) : [],
      };
      if (form.id) await api(`/leaves/${form.id}`, { method: 'PUT', body });
      else await api('/leaves', { method: 'POST', body });
      setFormOpen(false);
      setForm(EMPTY_FORM);
      list.reload();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (l: LeaveRequest) => {
    Alert.alert(
      l.status === 'approved' ? t('Cancel this leave?') : t('Delete this leave request?'),
      `${fmtDate(l.from_date)} → ${fmtDate(l.to_date)}\n${t('Substitute requests for it are withdrawn too.')}`,
      [
        { text: t('Keep'), style: 'cancel' },
        {
          text: l.status === 'approved' ? t('Cancel leave') : t('Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/leaves/${l.id}`, { method: 'DELETE' });
              list.reload();
            } catch (e) {
              Alert.alert(t('Could not delete'), errorText(e));
            }
          },
        },
      ],
    );
  };

  const review = async (action: 'approve' | 'reject') => {
    if (!reviewing) return;
    setBusy(true);
    setFormError(null);
    try {
      await api(`/leaves/${reviewing.id}/${action}`, { method: 'PUT', body: { note: note.trim() || null } });
      setReviewing(null);
      setNote('');
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
        <ListSkeleton avatar={34} badge="right" lines={2} />
      </ScreenSkeleton>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={list.items}
        keyExtractor={l => l.id}
        header={
          <>
            <ErrorBox message={list.error} />
            {isManager && (
              <Segments<Tab>
                items={[
                  { value: 'all', label: `📥 ${t('All requests')}` },
                  { value: 'mine', label: `🧳 ${t('My requests')}` },
                ]}
                value={tab}
                onChange={setTab}
              />
            )}
            {teaches && (
              <Button
                label={`🔁 ${t('Substitute requests')}`}
                kind="ghost"
                small
                onPress={() => navigate('Substitutions')}
                style={{ alignSelf: 'flex-start', marginBottom: 12 }}
              />
            )}
          </>
        }
        empty={<Empty icon="🧳" text={t('No leave requests yet.')} />}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore || list.loading}
        renderItem={l => {
          const mine = tab === 'mine' || l.user_id === session.user_id;
          return (
            <Card>
              <View style={styles.head}>
                {tab === 'all' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Avatar name={l.full_name} uri={photoUrl(l.photo_path)} size={34} />
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <Text style={styles.name}>{l.full_name}</Text>
                      <Text style={styles.sub}>{l.user_type ? t(ROLE_LABELS[l.user_type]) : ''}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.name, { flex: 1 }]}>{t('Leave request')}</Text>
                )}
                <Badge status={l.status} />
              </View>
              <Text style={[styles.sub, { marginTop: 8 }]}>
                🗓️ {fmtDate(l.from_date)} → {fmtDate(l.to_date)}
              </Text>
              <Text style={{ color: colors.ink, fontSize: 13, marginTop: 4 }}>{l.reason}</Text>
              <CoverageLine l={l} />
              {l.reviewed_by_name ? (
                <Text style={[styles.sub, { marginTop: 4 }]}>
                  {t('Reviewed by {name}', { name: l.reviewed_by_name })}
                  {l.review_note ? ` — ${l.review_note}` : ''}
                </Text>
              ) : null}
              <View style={styles.actions}>
                {tab === 'all' && isManager && l.status === 'pending' && (
                  <Button label={t('Review')} kind="soft" small onPress={() => openReview(l)} style={styles.action} />
                )}
                {mine && editable(l) && (
                  <Button label={`✏️ ${t('Edit')}`} kind="ghost" small onPress={() => openEdit(l)} style={styles.action} />
                )}
                {mine && cancellable(l) && (
                  <Button
                    label={l.status === 'approved' ? t('Cancel leave') : `🗑 ${t('Delete')}`}
                    kind="danger"
                    small
                    onPress={() => remove(l)}
                    style={styles.action}
                  />
                )}
              </View>
            </Card>
          );
        }}
      />
      <Fab icon="🧳" onPress={openNew} />

      <Sheet
        visible={formOpen}
        title={form.id ? t('Edit leave request') : t('Request leave')}
        onClose={() => setFormOpen(false)}
        error={formError}>
        <DateField
          label={t('From')}
          required
          value={form.from_date}
          onChange={v => setForm(f => ({ ...f, from_date: v, to_date: f.to_date && f.to_date < v ? v : f.to_date }))}
        />
        <DateField
          label={t('To')}
          required
          value={form.to_date}
          min={form.from_date || undefined}
          onChange={v => setForm(f => ({ ...f, to_date: v }))}
        />

        {teaches && (
          <View style={[styles.subCard, { backgroundColor: colors.brandFaint, borderColor: colors.brandSoft }]}>
            <Icon icon="account-switch-outline" size={22} color={colors.brand} />
            <View style={{ flex: 1, marginHorizontal: 10 }}>
              <Text style={styles.name}>{t('Find substitute')}</Text>
              <Text style={styles.sub}>{t('Find and request teachers to cover your classes')}</Text>
            </View>
            <Switch
              value={form.findSubstitute}
              onValueChange={v => setForm(f => ({ ...f, findSubstitute: v }))}
              trackColor={{ true: colors.brand, false: colors.line }}
              thumbColor="#fff"
            />
          </View>
        )}
        {teaches && form.findSubstitute && (
          <SubstituteFinder
            from={form.from_date}
            to={form.to_date}
            leaveId={form.id}
            picks={form.picks}
            onChange={picks => setForm(f => ({ ...f, picks }))}
          />
        )}

        <Input
          label={`${t('Reason')} *`}
          placeholder={t('Enter reason for leave…')}
          multiline
          style={{ minHeight: 70, textAlignVertical: 'top' }}
          value={form.reason}
          onChangeText={v => setForm(f => ({ ...f, reason: v }))}
        />
        <Button label={form.id ? t('Save changes') : t('Submit request')} onPress={submit} busy={busy} />
      </Sheet>

      <Sheet
        visible={!!reviewing}
        title={reviewing ? `${reviewing.full_name} · ${fmtDate(reviewing.from_date)} → ${fmtDate(reviewing.to_date)}` : ''}
        onClose={() => setReviewing(null)}
        error={formError}>
        {reviewing && (
          <>
            <Text style={{ color: colors.ink, fontSize: 13.5, marginBottom: 6 }}>{reviewing.reason}</Text>
            <CoverageLine l={reviewing} />
            <View style={{ height: 10 }} />
            <Input label={t('Note (optional)')} value={note} onChangeText={setNote} />
            <View style={{ flexDirection: 'row' }}>
              <Button label={t('✅ Approve')} onPress={() => review('approve')} busy={busy} style={{ flex: 1, marginRight: 8 }} />
              <Button label={t('✕ Reject')} kind="danger" onPress={() => review('reject')} busy={busy} style={{ flex: 1 }} />
            </View>
            <Text style={[styles.sub, { marginTop: 8, textAlign: 'center' }]}>
              {t('Rejecting also withdraws its substitute requests.')}
            </Text>
          </>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 14, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  action: { marginTop: 6, marginRight: 8 },
  subCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
});
