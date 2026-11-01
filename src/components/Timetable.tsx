// Weekly timetable, mobile-friendly: grouped by day, one row per period.
// - Clock times, the prayer slot and breaks come from the school timings
//   (Settings → School timings); without them only period numbers show.
// - TimetableEditor fetches a teacher's weekly template and (for managers)
//   lets them add/edit/clear any (day, period) via a bottom sheet.
// - WeekTimetable is the teacher's own dated week: the template plus
//   substitutions they cover / that cover their classes, leave and holidays.
import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { api, errorText } from '../api';
import { clock12, fmtDate, localIsoDate, parseClock, parseDate } from '../format';
import { isMissingEndpoint, useSchoolTimings } from '../hooks';
import { t } from '../i18n';
import { buildSchedule, periodCount } from '../schedule';
import type { ScheduleRow } from '../schedule';
import { colors } from '../theme';
import type { ClassInfo, SchoolTimings, TimetableSlot, TimetableWeek, WeekSubstitution } from '../types';
import { Bone, Button, Card, Chip, Empty, ErrorBox, Input, Sheet, Skeleton } from './ui';

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS = [0, 1, 2, 3, 4, 5]; // Mon–Sat

/** "9:30 AM – 10:15 AM" from two "HH:MM" strings. */
export const timeRange = (start?: string | null, end?: string | null): string => {
  const a = parseClock(start);
  const b = parseClock(end);
  if (a == null) return '';
  return b == null ? clock12(a) : `${clock12(a)} – ${clock12(b)}`;
};

type CellPressHandler = (day: number, period: number, slot?: TimetableSlot) => void;

/** Something date-specific drawn on top of a (day, period) cell. */
export interface CellOverlay {
  kind: 'covering' | 'covered';
  title: string;
  sub: string;
  status: string;
}

interface TimetableViewProps {
  slots?: TimetableSlot[] | null;
  onCellPress?: CellPressHandler;
  canEdit?: boolean;
  renderExtra?: (slot: TimetableSlot) => ReactNode;
  timings?: SchoolTimings | null;
  /** Replaces the day name in each card's header (e.g. with the date). */
  dayTitle?: (day: number) => ReactNode;
  /** A line under the day title ("Holiday — Diwali", "On leave"). */
  dayNote?: (day: number) => string | null | undefined;
  overlays?: Record<string, CellOverlay>;
}

/** Day-by-day rendering. slots: rows from /timetable. */
export function TimetableView({ slots, onCellPress, canEdit, renderExtra, timings, dayTitle, dayNote, overlays }: TimetableViewProps) {
  const byCell: Record<string, TimetableSlot> = {};
  for (const s of slots || []) byCell[`${s.day}-${s.period}`] = s;
  const schedule: ScheduleRow[] = useMemo(() => {
    if (timings) return buildSchedule(timings);
    return Array.from({ length: periodCount(null) }, (_, i) => ({ kind: 'period' as const, period: i + 1, start: '', end: '' }));
  }, [timings]);

  return (
    <View>
      {DAYS.map(day => {
        const note = dayNote?.(day);
        const hasAny = schedule.some(r => r.kind === 'period' && (byCell[`${day}-${r.period}`] || overlays?.[`${day}-${r.period}`]));
        if (!hasAny && !canEdit && !note) return null;
        return (
          <Card key={day}>
            <Text style={styles.day}>{dayTitle ? dayTitle(day) : t(DAY_NAMES[day])}</Text>
            {note ? <Text style={styles.dayNote}>{note}</Text> : null}
            {schedule.map(row => {
              if (row.kind === 'prayer') {
                return hasAny || canEdit ? (
                  <MarkerRow key="prayer" icon="hands-pray" label={t('Prayer / assembly')} time={timeRange(row.start, row.end)} />
                ) : null;
              }
              if (row.kind === 'break') {
                return hasAny || canEdit ? (
                  <MarkerRow key={`b${row.afterPeriod}`} icon="coffee-outline" label={row.label} time={timeRange(row.start, row.end)} />
                ) : null;
              }
              const { period } = row;
              const slot = byCell[`${day}-${period}`];
              const overlay = overlays?.[`${day}-${period}`];
              if (!slot && !overlay && !canEdit) return null;
              const time = timeRange(row.start, row.end);
              const covering = overlay?.kind === 'covering';
              const pillBg = covering ? colors.warn : slot ? colors.brand : colors.page;
              return (
                <TouchableOpacity
                  key={period}
                  disabled={!canEdit}
                  activeOpacity={0.65}
                  onPress={() => onCellPress?.(day, period, slot)}>
                  <View style={[styles.row, covering && { backgroundColor: colors.warnSoft, borderRadius: 10 }]}>
                    <View style={[styles.periodPill, { backgroundColor: pillBg }]}>
                      <Text style={{ color: slot || covering ? '#fff' : colors.subtle, fontWeight: '800', fontSize: 12 }}>
                        P{period}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      {covering ? (
                        <>
                          <Text style={styles.slotMain}>{overlay.title}</Text>
                          <Text style={[styles.extra, { color: colors.warn, fontWeight: '700' }]}>{overlay.sub}</Text>
                        </>
                      ) : slot ? (
                        <>
                          <Text
                            style={[
                              styles.slotMain,
                              overlay?.kind === 'covered' && overlay.status === 'accepted' && { color: colors.subtle },
                            ]}>
                            {slot.class_name} — {slot.section_name}
                            {slot.subject ? ` · ${slot.subject}` : ''}
                          </Text>
                          {renderExtra ? renderExtra(slot) : null}
                          {overlay ? (
                            <Text style={[styles.extra, { color: overlay.status === 'accepted' ? colors.ok : colors.warn, fontWeight: '700' }]}>
                              {overlay.sub}
                            </Text>
                          ) : null}
                        </>
                      ) : (
                        <Text style={{ color: colors.subtle, fontSize: 12.5 }}>{t('Free — tap to assign')}</Text>
                      )}
                      {time ? <Text style={styles.time}>{time}</Text> : null}
                    </View>
                    {canEdit && <Text style={{ color: colors.subtle, fontSize: 18 }}>›</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </Card>
        );
      })}
    </View>
  );
}

function MarkerRow({ icon, label, time }: { icon: string; label: string; time: string }) {
  return (
    <View style={styles.marker}>
      <MCIcon name={icon} size={14} color={colors.subtle} />
      <Text style={styles.markerText}>{label}</Text>
      <Text style={styles.markerTime}>{time}</Text>
    </View>
  );
}

interface EditingCell {
  day: number;
  period: number;
  slot?: TimetableSlot;
}

interface SlotForm {
  classId: number | null;
  sectionId: number | null;
  subject: string;
}

const EMPTY_FORM: SlotForm = { classId: null, sectionId: null, subject: '' };

interface TimetableEditorProps {
  teacherId?: number;
  canEdit?: boolean;
  mine?: boolean;
}

/** Fetch + (optionally) edit a teacher's weekly timetable. */
export function TimetableEditor({ teacherId, canEdit, mine = false }: TimetableEditorProps) {
  const { timings } = useSchoolTimings();
  const [slots, setSlots] = useState<TimetableSlot[] | null>(null);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [form, setForm] = useState<SlotForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSlots(await api<TimetableSlot[]>(mine ? '/timetable/mine' : `/timetable?teacher_id=${teacherId}`));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [teacherId, mine]);

  useEffect(() => {
    load();
    if (canEdit) api<ClassInfo[]>('/classes').then(setClasses).catch(() => {});
  }, [load, canEdit]);

  const openCell: CellPressHandler = (day, period, slot) => {
    setError(null);
    setForm(
      slot
        ? { classId: slot.class_id, sectionId: slot.section_id, subject: slot.subject || '' }
        : EMPTY_FORM,
    );
    setEditing({ day, period, slot });
  };

  const save = async () => {
    if (!editing) return;
    if (!form.classId || !form.sectionId) return setError(t('Pick a class and section'));
    setBusy(true);
    try {
      await api('/timetable', {
        method: 'PUT',
        body: {
          teacher_id: teacherId,
          day: editing.day,
          period: editing.period,
          class_id: form.classId,
          section_id: form.sectionId,
          subject: form.subject.trim() || null,
        },
      });
      setEditing(null);
      setError(null);
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!editing?.slot) return;
    setBusy(true);
    try {
      await api(`/timetable/${editing.slot.id}`, { method: 'DELETE' });
      setEditing(null);
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!slots && !error) return <TimetableSkeleton />;
  const selClass = classes.find(c => c.id === form.classId);

  return (
    <View>
      <ErrorBox message={error} />
      {slots?.length === 0 && !canEdit && <Empty icon="calendar-star" text={t('No timetable set yet.')} />}
      <TimetableView slots={slots} canEdit={canEdit} onCellPress={openCell} timings={timings} />

      <Sheet
        visible={!!editing}
        title={editing ? `${t(DAY_NAMES[editing.day])} · ${t('Period {n}', { n: editing.period })}` : ''}
        onClose={() => setEditing(null)}
        error={error}>
        {editing && (
          <>
            <Text style={styles.label}>{t('Class')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {classes.map(c => (
                <Chip
                  key={c.id}
                  label={c.name}
                  active={form.classId === c.id}
                  onPress={() => setForm({ ...form, classId: c.id, sectionId: null })}
                />
              ))}
            </View>
            {selClass && (
              <>
                <Text style={styles.label}>{t('Section')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {selClass.sections.map(s => (
                    <Chip
                      key={s.id}
                      label={t('Section {name}', { name: s.name })}
                      active={form.sectionId === s.id}
                      onPress={() => setForm({ ...form, sectionId: s.id })}
                    />
                  ))}
                </View>
                {selClass.subjects?.length ? (
                  <>
                    <Text style={styles.label}>{t('Subject')}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {selClass.subjects.map(s => (
                        <Chip key={s} label={s} active={form.subject === s} onPress={() => setForm({ ...form, subject: s })} />
                      ))}
                    </View>
                  </>
                ) : null}
              </>
            )}
            <Input label={t('Subject (or type your own)')} placeholder={t('e.g. Mathematics')} value={form.subject} onChangeText={v => setForm({ ...form, subject: v })} />
            <Button label={editing.slot ? t('Save changes') : t('Assign period')} onPress={save} busy={busy} />
            {editing.slot && (
              <Button label={t('Clear this period')} kind="danger" onPress={clear} busy={busy} style={{ marginTop: 8 }} />
            )}
          </>
        )}
      </Sheet>
    </View>
  );
}

/** Monday of the week containing `d`, as "YYYY-MM-DD". */
export function weekStart(d: Date = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return localIsoDate(x);
}

const addDays = (isoDate: string, n: number): string => {
  const d = parseDate(isoDate) ?? new Date();
  d.setDate(d.getDate() + n);
  return localIsoDate(d);
};

function overlayOf(s: WeekSubstitution): CellOverlay {
  if (s.kind === 'covering') {
    return {
      kind: 'covering',
      title: `${s.class_name} — ${s.section_name}${s.subject ? ` · ${s.subject}` : ''}`,
      sub: t('Substitution for {name}', { name: s.other_teacher_name }),
      status: s.status,
    };
  }
  return {
    kind: 'covered',
    title: '',
    sub: s.status === 'accepted'
      ? t('Covered by {name}', { name: s.other_teacher_name })
      : t('Waiting for {name}', { name: s.other_teacher_name }),
    status: s.status,
  };
}

/**
 * The signed-in teacher's dated week (GET /timetable/week). Falls back to the
 * plain weekly template on servers without that endpoint.
 */
export function WeekTimetable() {
  const { timings } = useSchoolTimings();
  const [start, setStart] = useState(() => weekStart());
  const [week, setWeek] = useState<TimetableWeek | null>(null);
  const [plain, setPlain] = useState<TimetableSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWeek(await api<TimetableWeek>(`/timetable/week?start=${start}`));
      setError(null);
    } catch (e) {
      if (isMissingEndpoint(e)) {
        try {
          setPlain(await api<TimetableSlot[]>('/timetable/mine'));
          setError(null);
        } catch (e2) {
          setError(errorText(e2));
        }
      } else {
        setError(errorText(e));
      }
    } finally {
      setLoading(false);
    }
  }, [start]);
  useEffect(() => {
    load();
  }, [load]);

  if (plain) {
    return (
      <View>
        <ErrorBox message={error} />
        {plain.length === 0 && <Empty icon="calendar-star" text={t('No timetable set yet.')} />}
        <TimetableView slots={plain} timings={timings} />
      </View>
    );
  }

  const overlays: Record<string, CellOverlay> = {};
  for (const s of week?.substitutions || []) {
    if (['pending', 'accepted'].includes(s.status)) overlays[`${s.day}-${s.period}`] = overlayOf(s);
  }
  const dayInfo = (day: number) => week?.days.find(d => d.day === day);
  const thisWeek = weekStart();
  const end = addDays(start, 5);

  return (
    <View>
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => setStart(addDays(start, -7))} hitSlop={HIT} accessibilityLabel={t('Previous week')}>
          <MCIcon name="chevron-left" size={26} color={colors.brand} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setStart(thisWeek)} disabled={start === thisWeek} style={{ alignItems: 'center' }}>
          <Text style={styles.weekTitle}>{fmtDate(start)} – {fmtDate(end)}</Text>
          <Text style={styles.weekSub}>{start === thisWeek ? t('This week') : t('Tap for this week')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setStart(addDays(start, 7))} hitSlop={HIT} accessibilityLabel={t('Next week')}>
          <MCIcon name="chevron-right" size={26} color={colors.brand} />
        </TouchableOpacity>
      </View>
      <ErrorBox message={error} />
      {loading && !week ? (
        <TimetableSkeleton />
      ) : (
        <>
          {week && week.slots.length === 0 && week.substitutions.length === 0 && (
            <Empty icon="calendar-star" text={t('No timetable set yet.')} />
          )}
          <TimetableView
            slots={week?.slots}
            timings={timings}
            overlays={overlays}
            dayTitle={day => {
              const info = dayInfo(day);
              return info ? `${t(DAY_NAMES[day])} · ${fmtDate(info.date)}` : t(DAY_NAMES[day]);
            }}
            dayNote={day => {
              const info = dayInfo(day);
              if (info?.holiday) return `🏖️ ${t('Holiday')} — ${info.holiday}`;
              if (info?.on_leave) return `🧳 ${t('You are on leave')}`;
              return null;
            }}
          />
        </>
      )}
    </View>
  );
}

const SLOT_WIDTHS = ['62%', '50%', '70%'] as const;
const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

/** Placeholder for the timetable while it loads: a few day cards of periods. */
export function TimetableSkeleton({ days = 3 }: { days?: number }) {
  return (
    <Skeleton>
      {Array.from({ length: days }, (_, d) => (
        <Card key={d}>
          <Bone width={96} height={14} style={{ marginBottom: 10 }} />
          {[0, 1, 2].map(p => (
            <View key={p} style={styles.row}>
              <Bone width={38} height={26} radius={9} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Bone width={SLOT_WIDTHS[(p + d) % SLOT_WIDTHS.length]} height={12} />
                <Bone width="38%" height={9} style={{ marginTop: 6 }} />
              </View>
            </View>
          ))}
        </Card>
      ))}
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  day: { fontSize: 14.5, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  dayNote: { fontSize: 12, color: colors.warn, fontWeight: '700', marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  periodPill: {
    width: 38,
    paddingVertical: 5,
    borderRadius: 9,
    alignItems: 'center',
  },
  slotMain: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  extra: { fontSize: 11.5, color: colors.subtle, marginTop: 1 },
  time: { fontSize: 11.5, color: colors.subtle, marginTop: 2 },
  marker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.page,
  },
  markerText: { flex: 1, marginLeft: 6, fontSize: 11.5, fontWeight: '700', color: colors.subtle },
  markerTime: { fontSize: 11.5, color: colors.subtle },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6, marginTop: 4 },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  weekTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  weekSub: { fontSize: 11, color: colors.subtle, marginTop: 1 },
});
