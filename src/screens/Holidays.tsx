// School calendar — month view. Holidays/Sundays yellow, exams blue, other
// events green (exam on a Sunday/holiday still shows as holiday). Managers
// tap a date to add/edit/delete a holiday; everyone else (incl. students)
// views. Events/exams are managed from the web app's Calendar tab.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api, errorText, peek } from '../api';
import {
  Bone,
  Button,
  Card,
  Empty,
  ErrorBox,
  Input,
  ListSkeleton,
  Screen,
  ScreenSkeleton,
  Sheet,
  fmtDate,
} from '../components/ui';
import { parseDate } from '../format';
import { MANAGER_ROLES } from '../roles';
import { colors } from '../theme';
import type { CalendarPayload, Holiday, ScreenProps } from '../types';
import { t } from '../i18n';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const iso = (y: number, m: number, d: number): string =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Inclusive "YYYY-MM-DD" range → list of ISO dates. */
const eachDate = (start: string, end: string): string[] => {
  const out: string[] = [];
  const d = new Date(`${start.slice(0, 10)}T00:00:00`);
  const stop = new Date(`${end.slice(0, 10)}T00:00:00`);
  while (d <= stop && out.length < 370) {
    out.push(iso(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setDate(d.getDate() + 1);
  }
  return out;
};

type Kind = 'holiday' | 'exam' | 'event';

interface EditingDay {
  date: string;
  holiday?: Holiday;
}

export default function Holidays({ session }: ScreenProps) {
  const isStudent = session.user_type === 'student';
  const canEdit = MANAGER_ROLES.includes(session.user_type);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11
  const [items, setItems] = useState<Holiday[] | null>(() => peek<Holiday[]>(`${isStudent ? '/student' : ''}/holidays?year=${now.getFullYear()}`));
  const [cal, setCal] = useState<CalendarPayload | null>(() => peek<CalendarPayload>(`${isStudent ? '/student' : ''}/calendar`));
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<EditingDay | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (r = false, y = year) => {
    r && setRefreshing(true);
    try {
      const [hols, calendar] = await Promise.all([
        api<Holiday[]>(`${isStudent ? '/student' : ''}/holidays?year=${y}`),
        api<CalendarPayload>(`${isStudent ? '/student' : ''}/calendar`),
      ]);
      setItems(hols);
      setCal(calendar);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRefreshing(false);
    }
  }, [year, isStudent]);
  useEffect(() => {
    load();
  }, [load]);

  // Derived from the fetched data only — recomputed when it changes, not on
  // every keystroke in the holiday sheet.
  const byDate = useMemo(() => {
    const out: Record<string, Holiday> = {};
    for (const h of items || []) out[String(h.date).slice(0, 10)] = h;
    return out;
  }, [items]);

  // exam / event names per date (holiday-category events already arrive via /holidays)
  const kindColors: Record<Kind, { bg: string; fg: string }> = {
    holiday: { bg: colors.warnSoft, fg: colors.warn },
    exam: { bg: colors.infoSoft, fg: colors.info },
    event: { bg: colors.okSoft, fg: colors.ok },
  };
  const { marked, examDates } = useMemo(() => {
    const m: Record<'exam' | 'event', Record<string, string[]>> = { exam: {}, event: {} };
    const dates: string[][] = []; // dates of cal.exams[i]
    const mark = (kind: 'exam' | 'event', date: string, name: string) => (m[kind][date] ||= []).push(name);
    for (const e of cal?.events || []) {
      if (e.category === 'holiday') continue;
      for (const d of e.dates) mark(e.category, String(d).slice(0, 10), e.title);
    }
    for (const x of cal?.exams || []) {
      const label = x.class_name ? `${x.name} (${x.class_name})` : x.name;
      const ds = eachDate(String(x.start_date), String(x.end_date));
      dates.push(ds);
      for (const d of ds) mark('exam', d, label);
    }
    return { marked: m, examDates: dates };
  }, [cal]);

  const prev = () => {
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    setMonth(m); setYear(y);
  };
  const next = () => {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    setMonth(m); setYear(y);
  };

  const openDay = (d: number) => {
    if (!canEdit) return;
    setError(null);
    const date = iso(year, month, d);
    const holiday = byDate[date];
    setForm({ name: holiday?.name || '', description: holiday?.description || '' });
    setEditing({ date, holiday });
  };

  const save = async () => {
    if (!editing) return;
    if (!form.name.trim()) return setError(t('Holiday name is required'));
    setBusy(true);
    try {
      const body = { date: editing.date, name: form.name.trim(), description: form.description.trim() || null };
      if (editing.holiday) await api(`/holidays/${editing.holiday.id}`, { method: 'PUT', body });
      else await api('/holidays', { method: 'POST', body });
      setEditing(null);
      setError(null);
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    const holiday = editing?.holiday;
    if (!holiday) return;
    Alert.alert(t('Delete holiday'), holiday.name, [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api(`/holidays/${holiday.id}`, { method: 'DELETE' });
            setEditing(null);
            load();
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (!items && !error) return <HolidaysSkeleton />;

  // calendar grid
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const todayIso = iso(now.getFullYear(), now.getMonth(), now.getDate());
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  // Compare the date strings: new Date('YYYY-MM-DD') is UTC midnight, which
  // lands in the previous month west of UTC.
  const monthHolidays = (items || [])
    .filter(h => String(h.date).startsWith(monthPrefix))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const monthEvents = (cal?.events || [])
    .map(e => ({ ...e, dates: e.dates.filter(d => String(d).startsWith(monthPrefix)).sort() }))
    .filter(e => e.category !== 'holiday' && e.dates.length > 0);
  const monthExams = (cal?.exams || []).filter((_, i) => examDates[i].some(d => d.startsWith(monthPrefix)));

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={() => load(true)}>
        <ErrorBox message={error} />

        <Card>
          {/* month header */}
          <View style={styles.monthHead}>
            <TouchableOpacity onPress={prev} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.nav, { color: colors.brand }]}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{t(MONTHS[month])} {year}</Text>
            <TouchableOpacity onPress={next} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.nav, { color: colors.brand }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* weekday header */}
          <View style={styles.week}>
            {WEEK.map(w => (
              <Text key={w} style={styles.weekDay}>{t(`week.${w}`)}</Text>
            ))}
          </View>

          {/* days */}
          <View style={styles.grid}>
            {cells.map((d, i) => {
              const date = d ? iso(year, month, d) : null;
              const holiday = date ? byDate[date] : undefined;
              const isSunday = !!d && i % 7 === 6; // last column (Mon-first grid)
              const isToday = date === todayIso;
              // Sundays / holidays win over exams; exams win over other events
              const kind: Kind | null = !date ? null
                : holiday || isSunday ? 'holiday'
                : marked.exam[date] ? 'exam'
                : marked.event[date] ? 'event'
                : null;
              const tone = kind ? kindColors[kind] : null;
              const hasItem = !!date && !!(holiday || marked.exam[date] || marked.event[date]);
              return (
                <TouchableOpacity
                  key={i}
                  disabled={!d || !canEdit}
                  onPress={() => d && openDay(d)}
                  style={styles.cellWrap}
                  activeOpacity={0.6}>
                  <View
                    style={[
                      styles.cell,
                      tone && { backgroundColor: tone.bg },
                      isToday && { borderWidth: 1.5, borderColor: colors.brand },
                    ]}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: tone || isToday ? '800' : '500',
                        color: tone ? tone.fg : d ? colors.ink : 'transparent',
                      }}>
                      {d || '0'}
                    </Text>
                    {hasItem ? (
                      <View style={[styles.dot, tone && { backgroundColor: tone.fg }]} />
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* legend */}
          <View style={styles.legend}>
            {([['holiday', t('Holiday · Sun')], ['exam', t('Exam')], ['event', t('Event')]] as const).map(
              ([kind, label]) => (
                <View key={kind} style={[styles.legendPill, { backgroundColor: kindColors[kind].bg }]}>
                  <Text style={{ color: kindColors[kind].fg, fontSize: 10.5, fontWeight: '700' }}>
                    {label}
                  </Text>
                </View>
              ),
            )}
          </View>
          {canEdit && (
            <Text style={{ color: colors.subtle, fontSize: 11.5, marginTop: 8, textAlign: 'center' }}>
              {t('Tap a date to add or edit a holiday.')}
            </Text>
          )}
        </Card>

        {/* month list */}
        {monthHolidays.length === 0 && monthEvents.length === 0 && monthExams.length === 0 ? (
          <Empty icon="🏖️" text={t('No holidays or events in {month}.', { month: t(MONTHS[month]) })} />
        ) : (
          <>
            {monthHolidays.map(h => (
              <EventRow key={`h${h.id}`} tone={kindColors.holiday} date={h.date} title={h.name}
                sub={`${fmtDate(h.date)}${h.description ? ` · ${h.description}` : ''}`} />
            ))}
            {monthExams.map(x => (
              <EventRow key={`x${x.id}`} tone={kindColors.exam} date={x.start_date}
                title={x.class_name ? `${x.name} (${x.class_name})` : x.name}
                sub={`${fmtDate(x.start_date)} – ${fmtDate(x.end_date)}`} />
            ))}
            {monthEvents.map(e => (
              <EventRow key={`e${e.id}`} tone={kindColors[e.category === 'exam' ? 'exam' : 'event']}
                date={e.dates[0]} title={e.title}
                sub={e.dates.map(d => fmtDate(d)).join(' · ')} />
            ))}
          </>
        )}
      </Screen>

      <Sheet
        visible={!!editing}
        title={editing ? `${editing.holiday ? t('Edit holiday') : t('Add holiday')} — ${fmtDate(editing.date)}` : ''}
        onClose={() => setEditing(null)}
        error={error}>
        {editing && (
          <>
            <Input label={t('Holiday name')} placeholder={t('e.g. Diwali')} value={form.name} onChangeText={v => setForm({ ...form, name: v })} />
            <Input label={t('Description (optional)')} value={form.description} onChangeText={v => setForm({ ...form, description: v })} />
            <Button label={editing.holiday ? t('Save changes') : t('Add holiday')} onPress={save} busy={busy} />
            {editing.holiday && (
              <Button label={t('Delete holiday')} kind="danger" onPress={remove} busy={busy} style={{ marginTop: 8 }} />
            )}
          </>
        )}
      </Sheet>
    </View>
  );
}

// Shown while the calendar loads: the month card with placeholder days.
function HolidaysSkeleton() {
  return (
    <ScreenSkeleton>
      <Card>
        <View style={styles.monthHead}>
          <Bone width={22} height={22} radius={11} />
          <Bone width={130} height={16} />
          <Bone width={22} height={22} radius={11} />
        </View>
        <View style={styles.week}>
          {WEEK.map(w => (
            <View key={w} style={styles.weekBone}>
              <Bone width={18} height={9} />
            </View>
          ))}
        </View>
        <View style={styles.grid}>
          {Array.from({ length: 35 }, (_, i) => (
            <View key={i} style={styles.cellWrap}>
              <Bone radius={10} style={styles.cell} />
            </View>
          ))}
        </View>
        <View style={styles.legend}>
          <Bone width={88} height={20} radius={999} />
          <Bone width={52} height={20} radius={999} />
          <Bone width={56} height={20} radius={999} />
        </View>
      </Card>
      <ListSkeleton icon lines={1} count={2} />
    </ScreenSkeleton>
  );
}

/** One row in the month list — colored date pill + title + subtitle. */
function EventRow({ tone, date, title, sub }: {
  tone: { bg: string; fg: string };
  date: string;
  title: string;
  sub: string;
}) {
  const d = parseDate(String(date).slice(0, 10)) ?? new Date();
  return (
    <Card style={styles.holidayRow}>
      <View style={[styles.datePill, { backgroundColor: tone.bg }]}>
        <Text style={{ color: tone.fg, fontWeight: '800', fontSize: 15 }}>{d.getDate()}</Text>
        <Text style={{ color: tone.fg, fontSize: 9.5, fontWeight: '700' }}>
          {t('months')[d.getMonth()]}
        </Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.ink }}>{title}</Text>
        <Text style={{ fontSize: 12, color: colors.subtle, marginTop: 1 }}>{sub}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  monthTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  nav: { fontSize: 26, fontWeight: '700', paddingHorizontal: 10 },
  week: { flexDirection: 'row', marginBottom: 4 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.subtle },
  weekBone: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap: { width: '14.285%', padding: 2 },
  cell: {
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.warn, marginTop: 2 },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  legendPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  holidayRow: { flexDirection: 'row', alignItems: 'center' },
  datePill: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
