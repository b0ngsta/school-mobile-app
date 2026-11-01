// School timings (coordinator / principal / admin): when the day starts,
// how long prayer/assembly lasts, period length, number of periods and the
// breaks. Every timetable (teachers, students, substitutions) takes its
// clock times from this — e.g. start 6:30 AM + 30 min prayer → period 1 at
// 7:00 AM. Change it for summer/winter timings; timetables follow at once.
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { api, errorText } from '../../api';
import { TimeField } from '../../components/pickers';
import { timeRange } from '../../components/Timetable';
import { Button, Card, ErrorBox, Input, NoticeBox, Screen, ScreenSkeleton, CardSkeleton, SectionTitle } from '../../components/ui';
import { fmtDate } from '../../format';
import { isMissingEndpoint } from '../../hooks';
import { t } from '../../i18n';
import { MANAGER_ROLES } from '../../roles';
import { EMPTY_TIMINGS, MAX_PERIODS_PER_DAY, buildSchedule, timingsError } from '../../schedule';
import { colors } from '../../theme';
import type { SchoolTimings as Timings, ScreenProps } from '../../types';

/** Form state keeps numbers as strings while typing. */
interface Form {
  start_time: string;
  prayer_minutes: string;
  period_minutes: string;
  periods_per_day: string;
  breaks: { after_period: string; minutes: string; label: string }[];
}

const toForm = (tm: Timings): Form => ({
  start_time: tm.start_time.slice(0, 5),
  prayer_minutes: String(tm.prayer_minutes ?? 0),
  period_minutes: String(tm.period_minutes ?? 40),
  periods_per_day: String(tm.periods_per_day ?? 8),
  breaks: (tm.breaks || []).map(b => ({ after_period: String(b.after_period), minutes: String(b.minutes), label: b.label || '' })),
});

const toTimings = (f: Form): Timings => ({
  start_time: f.start_time,
  prayer_minutes: Number(f.prayer_minutes || 0),
  period_minutes: Number(f.period_minutes || 0),
  periods_per_day: Number(f.periods_per_day || 0),
  breaks: f.breaks
    .map(b => ({ after_period: Number(b.after_period || 0), minutes: Number(b.minutes || 0), label: b.label.trim() || null }))
    .sort((a, b) => a.after_period - b.after_period),
});

const digits = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 3);

export default function SchoolTimings({ session }: ScreenProps) {
  const canEdit = MANAGER_ROLES.includes(session.user_type);
  const [saved, setSaved] = useState<Timings | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    api<Timings>('/settings/school-timings')
      .then(tm => {
        const value = tm?.start_time ? tm : EMPTY_TIMINGS;
        setSaved(tm?.start_time ? tm : null);
        setForm(toForm(value));
      })
      .catch(e => {
        if (isMissingEndpoint(e)) setMissing(true);
        else setError(errorText(e));
        setForm(toForm(EMPTY_TIMINGS));
      });
  }, []);

  const timings = useMemo(() => (form ? toTimings(form) : null), [form]);
  const schedule = useMemo(() => (timings ? buildSchedule(timings) : []), [timings]);

  const save = async () => {
    if (!timings) return;
    const bad = timingsError(timings);
    if (bad) return setError(bad);
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await api<Timings>('/settings/school-timings', { method: 'PUT', body: { ...timings } });
      setSaved(res?.start_time ? res : timings);
      setDone(t('Saved. Timetables now use these timings.'));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!form) {
    return (
      <ScreenSkeleton>
        <CardSkeleton lines={4} block={120} />
        <CardSkeleton lines={6} />
      </ScreenSkeleton>
    );
  }

  const set = (patch: Partial<Form>) => {
    setDone(null);
    setForm(f => (f ? { ...f, ...patch } : f));
  };
  const setBreak = (i: number, patch: Partial<Form['breaks'][number]>) =>
    set({ breaks: form.breaks.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const periods = Number(form.periods_per_day) || 0;

  return (
    <Screen>
      {missing && <NoticeBox message={t('School timings need the latest server update — you can preview them here.')} />}
      <ErrorBox message={error} />
      <NoticeBox tone="ok" message={done} />

      <Card>
        <SectionTitle>{t('School day')}</SectionTitle>
        {canEdit ? (
          <>
            <TimeField label={t('School starts at')} required value={form.start_time} onChange={v => set({ start_time: v })} />
            <Input
              label={t('Prayer / assembly (minutes)')}
              keyboardType="number-pad"
              value={form.prayer_minutes}
              onChangeText={v => set({ prayer_minutes: digits(v) })}
              hint={t('Held before period 1. Use 0 if there is none.')}
            />
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Input label={t('Period length (min)')} keyboardType="number-pad" value={form.period_minutes}
                  onChangeText={v => set({ period_minutes: digits(v) })} />
              </View>
              <View style={{ flex: 1 }}>
                <Input label={t('Periods per day')} keyboardType="number-pad" value={form.periods_per_day}
                  onChangeText={v => set({ periods_per_day: digits(v).slice(0, 2) })}
                  hint={t('Max {n}', { n: MAX_PERIODS_PER_DAY })} />
              </View>
            </View>
          </>
        ) : (
          <Text style={styles.sub}>{t('Only the coordinator, principal or admin can change school timings.')}</Text>
        )}
      </Card>

      {canEdit && (
        <Card>
          <SectionTitle
            right={
              <TouchableOpacity
                onPress={() => set({ breaks: [...form.breaks, { after_period: String(Math.min(3, Math.max(1, periods - 1))), minutes: '20', label: '' }] })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ color: colors.brand, fontWeight: '800' }}>+ {t('Add break')}</Text>
              </TouchableOpacity>
            }>
            {t('Breaks')}
          </SectionTitle>
          {form.breaks.length === 0 && <Text style={styles.sub}>{t('No breaks yet. Add one, e.g. a 20-minute break after period 3.')}</Text>}
          {form.breaks.map((b, i) => (
            <View key={i} style={styles.breakRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Input label={t('After period')} keyboardType="number-pad" value={b.after_period}
                  onChangeText={v => setBreak(i, { after_period: digits(v).slice(0, 2) })} />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Input label={t('Minutes')} keyboardType="number-pad" value={b.minutes}
                  onChangeText={v => setBreak(i, { minutes: digits(v) })} />
              </View>
              <View style={{ flex: 1.4 }}>
                <Input label={t('Name')} placeholder={t('Break')} value={b.label} onChangeText={v => setBreak(i, { label: v })} />
              </View>
              <TouchableOpacity
                onPress={() => set({ breaks: form.breaks.filter((_, j) => j !== i) })}
                style={styles.remove}
                accessibilityLabel={t('Remove break')}>
                <MCIcon name="close" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <SectionTitle>{t('Bell schedule')}</SectionTitle>
        {schedule.length === 0 ? (
          <Text style={styles.sub}>{t('Pick the school start time to see the schedule.')}</Text>
        ) : (
          schedule.map((r, i) => (
            <View key={i} style={[styles.schedRow, r.kind !== 'period' && { backgroundColor: colors.page }]}>
              <Text style={[styles.schedName, r.kind !== 'period' && { color: colors.subtle }]}>
                {r.kind === 'prayer' ? `🙏 ${t('Prayer / assembly')}` : r.kind === 'break' ? `☕ ${r.label}` : t('Period {n}', { n: r.period })}
              </Text>
              <Text style={styles.schedTime}>{timeRange(r.start, r.end)}</Text>
            </View>
          ))
        )}
      </Card>

      {canEdit && <Button label={t('Save school timings')} onPress={save} busy={busy} />}
      {saved?.updated_at ? (
        <Text style={[styles.sub, { textAlign: 'center', marginTop: 10 }]}>
          {t('Last changed {date}', { date: fmtDate(saved.updated_at) })}
          {saved.updated_by_name ? ` · ${saved.updated_by_name}` : ''}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { fontSize: 12.5, color: colors.subtle },
  breakRow: { flexDirection: 'row', alignItems: 'flex-start' },
  remove: { marginLeft: 6, marginTop: 30, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerSoft },
  schedRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: colors.line },
  schedName: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  schedTime: { fontSize: 13, color: colors.subtle, fontWeight: '600' },
});
