// Substitute requests.
//  • For me  — colleagues asking me to take a period: Accept / Decline; an
//    accepted one can be undone ("I can't take it after all") until the
//    period starts — the server then frees the period in both timetables and
//    tells the requester.
//  • Sent    — requests I sent (from a leave or on their own): Cancel.
//  • All     — managers: every request, to see which classes are uncovered.
// Notifications about substitutions open this screen (params.tab / params.id).
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { api, errorText, photoUrl } from '../../api';
import { timeRange } from '../../components/Timetable';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ChipsSkeleton,
  Empty,
  ErrorBox,
  Input,
  ListScreen,
  ListSkeleton,
  ScreenSkeleton,
  Segments,
  Sheet,
} from '../../components/ui';
import { fmtDayShort } from '../../format';
import { usePagedApi } from '../../hooks';
import { t } from '../../i18n';
import { MANAGER_ROLES } from '../../roles';
import { colors } from '../../theme';
import type { ScreenProps, SubstitutionRequest } from '../../types';

type Tab = 'incoming' | 'outgoing' | 'all';
type Filter = 'pending' | 'accepted' | '';

const PATHS: Record<Tab, string> = {
  incoming: '/substitutions/incoming',
  outgoing: '/substitutions/outgoing',
  all: '/substitutions',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Waiting for reply',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Cancelled',
  withdrawn: 'Withdrawn after accepting',
  filled: 'Taken by another teacher',
};

const statusTone = (s: string) =>
  s === 'accepted' ? 'approved' : s === 'pending' ? 'pending' : s === 'declined' || s === 'withdrawn' ? 'rejected' : 'closed';

interface Responding {
  req: SubstitutionRequest;
  action: 'decline' | 'withdraw';
}

export default function Substitutions({ session, params }: ScreenProps) {
  const isManager = MANAGER_ROLES.includes(session.user_type);
  const [tab, setTab] = useState<Tab>((params?.tab as Tab) || 'incoming');
  const [filter, setFilter] = useState<Filter>('pending');
  const path = `${PATHS[tab]}${filter ? `?status=${filter}` : ''}`;
  const list = usePagedApi<SubstitutionRequest>(path);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState<Responding | null>(null);
  const [note, setNote] = useState('');

  const act = async (req: SubstitutionRequest, action: 'accept' | 'decline' | 'withdraw' | 'cancel', body?: object) => {
    setBusyId(req.id);
    setError(null);
    try {
      await api(`/substitutions/${req.id}/${action}`, { method: 'PUT', body: body as Record<string, unknown> });
      setResponding(null);
      setNote('');
      list.reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyId(null);
    }
  };

  const confirmCancel = (req: SubstitutionRequest) =>
    Alert.alert(t('Cancel request?'), t('{name} will be told the request is withdrawn.', { name: req.substitute_name }), [
      { text: t('Keep'), style: 'cancel' },
      { text: t('Cancel request'), style: 'destructive', onPress: () => act(req, 'cancel') },
    ]);

  if (!list.ready && !list.error) {
    return (
      <ScreenSkeleton>
        <ChipsSkeleton count={isManager ? 3 : 2} />
        <ListSkeleton avatar={38} badge="right" lines={2} action />
      </ScreenSkeleton>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={list.items}
        keyExtractor={r => r.id}
        header={
          <>
            <ErrorBox message={list.error || error} />
            <Segments<Tab>
              items={[
                { value: 'incoming', label: `📥 ${t('For me')}` },
                { value: 'outgoing', label: `📤 ${t('Sent')}` },
                ...(isManager ? [{ value: 'all' as Tab, label: `🏫 ${t('All')}` }] : []),
              ]}
              value={tab}
              onChange={setTab}
            />
            <Segments<Filter>
              items={[
                { value: 'pending', label: t('Waiting') },
                { value: 'accepted', label: t('Accepted') },
                { value: '', label: t('All') },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </>
        }
        empty={
          <Empty
            icon="account-switch-outline"
            text={tab === 'incoming' ? t('No substitute requests for you.') : t('No substitute requests.')}
          />
        }
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore || list.loading}
        renderItem={r => {
          const incoming = tab === 'incoming' || (tab === 'all' && r.substitute_id === session.user_id);
          const outgoing = tab === 'outgoing' || (tab === 'all' && r.requester_id === session.user_id);
          const person = incoming ? r.requester_name : r.substitute_name;
          const photo = incoming ? r.requester_photo : r.substitute_photo;
          const time = timeRange(r.start_time, r.end_time);
          const busy = busyId === r.id;
          return (
            <Card style={Number(params?.id) === r.id ? { borderWidth: 1.5, borderColor: colors.brand } : undefined}>
              <View style={styles.head}>
                <Avatar name={person} uri={photoUrl(photo)} size={38} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.name}>
                    {tab === 'all' ? `${r.requester_name} → ${r.substitute_name}` : person}
                  </Text>
                  <Text style={styles.sub}>
                    {incoming ? t('asks you to take a period') : t('asked to take your period')}
                  </Text>
                </View>
                <Badge status={statusTone(r.status)} label={t(STATUS_LABEL[r.status] || r.status)} />
              </View>
              <View style={[styles.slot, { backgroundColor: colors.page }]}>
                <Text style={styles.slotMain}>
                  {fmtDayShort(r.date)} · {t('Period {n}', { n: r.period })}
                  {time ? ` · ${time}` : ''}
                </Text>
                <Text style={styles.sub}>
                  {r.class_name} — {r.section_name}
                  {r.subject ? ` · ${r.subject}` : ''}
                </Text>
              </View>
              {r.note ? <Text style={[styles.sub, { marginTop: 6 }]}>💬 {r.note}</Text> : null}
              {r.response_note ? <Text style={[styles.sub, { marginTop: 4 }]}>↩️ {r.response_note}</Text> : null}

              <View style={styles.actions}>
                {incoming && r.status === 'pending' && (
                  <>
                    <Button label={`✅ ${t('Accept')}`} small busy={busy} onPress={() => act(r, 'accept')} style={styles.action} />
                    <Button
                      label={`✕ ${t('Decline')}`}
                      kind="danger"
                      small
                      disabled={busy}
                      onPress={() => { setNote(''); setResponding({ req: r, action: 'decline' }); }}
                      style={styles.action}
                    />
                  </>
                )}
                {incoming && r.status === 'accepted' && r.can_withdraw !== false && (
                  <Button
                    label={`↩️ ${t("Undo — I can't take it")}`}
                    kind="ghost"
                    small
                    disabled={busy}
                    onPress={() => { setNote(''); setResponding({ req: r, action: 'withdraw' }); }}
                    style={styles.action}
                  />
                )}
                {outgoing && ['pending', 'accepted'].includes(r.status) && (
                  <Button label={t('Cancel request')} kind="danger" small busy={busy} onPress={() => confirmCancel(r)} style={styles.action} />
                )}
              </View>
            </Card>
          );
        }}
      />

      <Sheet
        visible={!!responding}
        title={responding?.action === 'withdraw' ? t('Undo accepted substitution') : t('Decline request')}
        onClose={() => setResponding(null)}
        error={error}>
        {responding && (
          <>
            <Text style={[styles.sub, { marginBottom: 10, fontSize: 13 }]}>
              {responding.action === 'withdraw'
                ? t('The period is removed from your timetable and {name} is told to find someone else.', { name: responding.req.requester_name })
                : t('{name} will be told you cannot take this period.', { name: responding.req.requester_name })}
            </Text>
            <Input label={t('Note (optional)')} placeholder={t('e.g. I have a parent meeting then')} value={note} onChangeText={setNote} />
            <Button
              label={responding.action === 'withdraw' ? t('Undo and free the period') : t('Decline')}
              kind="danger"
              busy={busyId === responding.req.id}
              onPress={() => act(responding.req, responding.action, { note: note.trim() || null })}
            />
          </>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 14.5, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 1 },
  slot: { borderRadius: 12, padding: 10, marginTop: 10 },
  slotMain: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  action: { marginTop: 8, marginRight: 8 },
});
