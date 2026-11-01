// "Find substitute" inside the leave form: for each date of the leave, the
// periods this teacher teaches and which colleagues are free then. Ticking a
// teacher queues a request; requests go out when the leave is saved.
// Several teachers may be ticked for one period — the first to accept takes
// it and the others' requests close automatically (server side).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { api, errorText, photoUrl } from '../api';
import { fmtDayShort, isIsoDate } from '../format';
import { isMissingEndpoint } from '../hooks';
import { t } from '../i18n';
import { colors } from '../theme';
import type { AvailabilityPeriod, SubstituteAvailability, SubstitutionRequest } from '../types';
import { Checkbox } from './pickers';
import { timeRange } from './Timetable';
import { Avatar, Badge, ErrorBox, NoticeBox } from './ui';

/** "date|period" → teacher ids ticked for that period. */
export type SubstitutePicks = Record<string, number[]>;

export const pickKey = (date: string, period: number) => `${date}|${period}`;

/** Picks as the API body: [{date, period, substitute_id}], limited to the leave's dates. */
export function picksToBody(picks: SubstitutePicks, from: string, to: string) {
  const out: { date: string; period: number; substitute_id: number }[] = [];
  for (const [key, ids] of Object.entries(picks)) {
    const [date, period] = key.split('|');
    if (date < from || date > to) continue;
    for (const id of ids) out.push({ date, period: Number(period), substitute_id: id });
  }
  return out;
}

const ACTIVE = ['pending', 'accepted'];

interface Props {
  from: string;
  to: string;
  /** Editing an existing leave: its id, so the server can include its requests. */
  leaveId?: number | null;
  picks: SubstitutePicks;
  onChange: (picks: SubstitutePicks) => void;
}

export function SubstituteFinder({ from, to, leaveId, picks, onChange }: Props) {
  const valid = isIsoDate(from) && isIsoDate(to) && from <= to;
  const [data, setData] = useState<SubstituteAvailability | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      const q = `/substitutions/availability?from=${from}&to=${to}${leaveId ? `&leave_id=${leaveId}` : ''}`;
      const res = await api<SubstituteAvailability>(q);
      setData(res);
      setMissing(false);
      setDay(d => (d && res.days.some(x => x.date === d) ? d : res.days.find(x => x.periods.length)?.date ?? res.days[0]?.date ?? null));
    } catch (e) {
      if (isMissingEndpoint(e)) setMissing(true);
      else setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [valid, from, to, leaveId]);
  useEffect(() => {
    load();
  }, [load]);

  const current = useMemo(() => data?.days.find(d => d.date === day) ?? null, [data, day]);

  const toggle = (date: string, period: number, teacherId: number) => {
    const key = pickKey(date, period);
    const ids = picks[key] || [];
    const next = ids.includes(teacherId) ? ids.filter(x => x !== teacherId) : [...ids, teacherId];
    const copy = { ...picks };
    if (next.length) copy[key] = next;
    else delete copy[key];
    onChange(copy);
  };

  const cancelRequest = (r: SubstitutionRequest) => {
    Alert.alert(t('Cancel request?'), t('{name} will be told the request is withdrawn.', { name: r.substitute_name }), [
      { text: t('Keep'), style: 'cancel' },
      {
        text: t('Cancel request'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(r.id);
          try {
            await api(`/substitutions/${r.id}/cancel`, { method: 'PUT' });
            load();
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  if (!valid) return <Text style={styles.hint}>{t('Pick the leave dates to see your classes and free teachers.')}</Text>;
  if (missing) return <NoticeBox message={t('Substitute finder needs the latest server update.')} />;
  if (loading && !data) return <ActivityIndicator color={colors.brand} style={{ marginVertical: 16 }} />;
  if (!data) return <ErrorBox message={error} />;
  if (data.days.length === 0) return <Text style={styles.hint}>{t('No school days in these dates.')}</Text>;

  return (
    <View style={{ marginBottom: 6 }}>
      <ErrorBox message={error} />
      {/* date tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        {data.days.map(d => {
          const active = d.date === day;
          const n = d.periods.length;
          return (
            <TouchableOpacity
              key={d.date}
              onPress={() => { setDay(d.date); setOpen(null); }}
              style={[styles.dayTab, active && { borderColor: colors.brand, backgroundColor: colors.brandSoft }]}>
              <Text style={[styles.dayTabTitle, active && { color: colors.brand }]}>{fmtDayShort(d.date)}</Text>
              <Text style={styles.dayTabSub}>
                {d.holiday ? t('Holiday') : n === 1 ? t('1 class') : t('{n} classes', { n })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {current && (
        <>
          <Text style={styles.dayHeading}>{fmtDayShort(current.date)}</Text>
          {current.holiday ? (
            <NoticeBox message={`🏖️ ${current.holiday}`} />
          ) : current.periods.length === 0 ? (
            <Text style={styles.hint}>{t('You have no classes this day.')}</Text>
          ) : (
            current.periods.map(p => (
              <PeriodCard
                key={p.period}
                date={current.date}
                p={p}
                open={open === p.period}
                onToggleOpen={() => setOpen(o => (o === p.period ? null : p.period))}
                picked={picks[pickKey(current.date, p.period)] || []}
                onPick={id => toggle(current.date, p.period, id)}
                onCancel={cancelRequest}
                busyId={busyId}
              />
            ))
          )}
        </>
      )}
    </View>
  );
}

interface PeriodCardProps {
  date: string;
  p: AvailabilityPeriod;
  open: boolean;
  onToggleOpen: () => void;
  picked: number[];
  onPick: (teacherId: number) => void;
  onCancel: (r: SubstitutionRequest) => void;
  busyId: number | null;
}

function PeriodCard({ p, open, onToggleOpen, picked, onPick, onCancel, busyId }: PeriodCardProps) {
  const accepted = p.requests.find(r => r.status === 'accepted');
  const pending = p.requests.filter(r => r.status === 'pending');
  const requestedIds = new Set(p.requests.filter(r => ACTIVE.includes(r.status)).map(r => r.substitute_id));
  const time = timeRange(p.start_time, p.end_time);
  const count = p.available.length;
  const canExpand = count > 0 || p.requests.length > 0;

  return (
    <View style={[styles.period, open && { borderColor: colors.brand, backgroundColor: colors.brandFaint }]}>
      <TouchableOpacity activeOpacity={0.7} onPress={onToggleOpen} disabled={!canExpand} style={styles.periodHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.periodTitle}>{t('Period {n}', { n: p.period })}</Text>
          <Text style={styles.periodSub}>
            {time ? `${time} · ` : ''}
            {p.slot.class_name} — {p.slot.section_name}
            {p.slot.subject ? ` · ${p.slot.subject}` : ''}
          </Text>
        </View>
        {accepted ? (
          <Badge status="approved" label={t('Covered')} />
        ) : pending.length || picked.length ? (
          <Badge status="pending" label={t('{n} requested', { n: pending.length + picked.length })} />
        ) : count === 0 ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Badge label={t('No substitutes')} />
            <Text style={styles.busy}>{t('All teachers busy')}</Text>
          </View>
        ) : (
          <Badge status="approved" label={t('{n} available', { n: count })} />
        )}
        {canExpand ? (
          <MCIcon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.brand} style={{ marginLeft: 6 }} />
        ) : null}
      </TouchableOpacity>

      {open && (
        <View style={styles.teachers}>
          {p.requests.filter(r => ACTIVE.includes(r.status)).map(r => (
            <View key={`r${r.id}`} style={styles.teacherRow}>
              <MCIcon name={r.status === 'accepted' ? 'check-circle' : 'clock-outline'} size={20}
                color={r.status === 'accepted' ? colors.ok : colors.warn} />
              <Avatar name={r.substitute_name} uri={photoUrl(r.substitute_photo)} size={30} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.teacherName}>{r.substitute_name}</Text>
                <Text style={styles.periodSub}>{r.status === 'accepted' ? t('Accepted') : t('Waiting for reply')}</Text>
              </View>
              <TouchableOpacity onPress={() => onCancel(r)} disabled={busyId === r.id} hitSlop={HIT}>
                <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 12.5 }}>{t('Cancel')}</Text>
              </TouchableOpacity>
            </View>
          ))}
          {!accepted &&
            p.available
              .filter(a => !requestedIds.has(a.teacher_id))
              .map(a => {
                const on = picked.includes(a.teacher_id);
                return (
                  <TouchableOpacity key={a.teacher_id} activeOpacity={0.7} onPress={() => onPick(a.teacher_id)} style={styles.teacherRow}>
                    <Checkbox checked={on} onPress={() => onPick(a.teacher_id)} />
                    <Avatar name={a.full_name} uri={photoUrl(a.photo_path)} size={30} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.teacherName}>{a.full_name}</Text>
                      {a.subject ? <Text style={styles.periodSub}>{a.subject}</Text> : null}
                    </View>
                    <Badge status="approved" label={t('Free')} />
                  </TouchableOpacity>
                );
              })}
          {!accepted && p.available.length === 0 && (
            <Text style={[styles.hint, { marginTop: 6 }]}>{t('No other teacher is free this period.')}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const HIT = { top: 8, bottom: 8, left: 8, right: 8 };

const styles = StyleSheet.create({
  hint: { fontSize: 12.5, color: colors.subtle, marginBottom: 10 },
  dayTab: {
    minWidth: 104,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  dayTabTitle: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  dayTabSub: { fontSize: 11, color: colors.subtle, marginTop: 1 },
  dayHeading: { fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 8 },
  period: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, marginBottom: 8, backgroundColor: '#fff' },
  periodHead: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  periodTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  periodSub: { fontSize: 11.5, color: colors.subtle, marginTop: 1 },
  busy: { fontSize: 10.5, color: colors.subtle, marginTop: 3 },
  teachers: { borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 10, paddingBottom: 4 },
  teacherRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  teacherName: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
});
