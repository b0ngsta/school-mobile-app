// Calendar date field + clock time field — no native modules, so they work
// the same on Android and iOS and need no rebuild. Values stay in the API's
// formats: dates "YYYY-MM-DD", times 24h "HH:MM".
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { clock12, clockHm, fmtDate, localIsoDate, parseClock, parseDate } from '../format';
import { t } from '../i18n';
import { colors, radius, shadow } from '../theme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

interface DateFieldProps {
  label?: string;
  /** "YYYY-MM-DD" or "" */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Earliest / latest pickable date, "YYYY-MM-DD". */
  min?: string | null;
  max?: string | null;
  /** Shows a "Clear" action (for optional dates). */
  optional?: boolean;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
}

/** A field that opens a month calendar. */
export function DateField({ label, value, onChange, placeholder, min, max, optional, required, hint, disabled }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${value ? fmtDate(value) : t('not set')}` : undefined}
        style={[styles.field, disabled && { opacity: 0.55 }]}>
        <MCIcon name="calendar-month-outline" size={19} color={colors.subtle} />
        <Text style={[styles.fieldText, !value && { color: colors.faint }]} numberOfLines={1}>
          {value ? fmtDate(value) : placeholder || t('Select date')}
        </Text>
        <MCIcon name="chevron-down" size={18} color={colors.faint} />
      </TouchableOpacity>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <CalendarModal
        visible={open}
        title={label}
        value={value}
        min={min}
        max={max}
        optional={optional}
        onClose={() => setOpen(false)}
        onPick={v => {
          onChange(v);
          setOpen(false);
        }}
      />
    </View>
  );
}

interface CalendarModalProps {
  visible: boolean;
  title?: string;
  value: string;
  min?: string | null;
  max?: string | null;
  optional?: boolean;
  onClose: () => void;
  onPick: (value: string) => void;
}

/** Month calendar in a centred dialog. */
export function CalendarModal({ visible, title, value, min, max, optional, onClose, onPick }: CalendarModalProps) {
  const initial = parseDate(value) || parseDate(min ?? null) || new Date();
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());
  const [yearMode, setYearMode] = useState(false);

  // Re-open on the selected month each time.
  useEffect(() => {
    if (!visible) return;
    const d = parseDate(value) || parseDate(min ?? null) || new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setYearMode(false);
  }, [visible, value, min]);

  const cells = useMemo(() => {
    const first = (new Date(year, month, 1).getDay() + 6) % 7; // Monday first
    const days = new Date(year, month + 1, 0).getDate();
    const out: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
    while (out.length % 7) out.push(null);
    return out;
  }, [year, month]);

  const step = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const today = localIsoDate();
  const outOfRange = (d: string) => (!!min && d < min) || (!!max && d > max);
  const years = Array.from({ length: 21 }, (_, i) => year - 10 + i);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.dialog, shadow.pop]}>
          {title ? <Text style={styles.dialogTitle}>{title}</Text> : null}
          <View style={styles.monthHead}>
            <TouchableOpacity onPress={() => step(-1)} hitSlop={HIT} accessibilityLabel={t('Previous month')}>
              <MCIcon name="chevron-left" size={26} color={colors.brand} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setYearMode(m => !m)} style={styles.monthBtn}>
              <Text style={styles.monthTitle}>{t(MONTHS[month])} {year}</Text>
              <MCIcon name={yearMode ? 'chevron-up' : 'chevron-down'} size={16} color={colors.subtle} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => step(1)} hitSlop={HIT} accessibilityLabel={t('Next month')}>
              <MCIcon name="chevron-right" size={26} color={colors.brand} />
            </TouchableOpacity>
          </View>

          {yearMode ? (
            <ScrollView style={{ maxHeight: 260 }}>
              <View style={styles.yearGrid}>
                {years.map(y => (
                  <TouchableOpacity key={y} style={styles.yearWrap} onPress={() => { setYear(y); setYearMode(false); }}>
                    <View style={[styles.yearCell, y === year && { backgroundColor: colors.brand }]}>
                      <Text style={{ fontWeight: '700', color: y === year ? '#fff' : colors.ink }}>{y}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          ) : (
            <>
              <View style={styles.week}>
                {WEEK.map(w => (
                  <Text key={w} style={styles.weekDay}>{t(`week.${w}`)}</Text>
                ))}
              </View>
              <View style={styles.grid}>
                {cells.map((d, i) => {
                  const date = d ? iso(year, month, d) : '';
                  const selected = !!d && date === value;
                  const disabled = !d || outOfRange(date);
                  const isToday = date === today;
                  return (
                    <TouchableOpacity
                      key={i}
                      disabled={disabled}
                      onPress={() => onPick(date)}
                      style={styles.cellWrap}
                      accessibilityLabel={d ? fmtDate(date) : undefined}>
                      <View
                        style={[
                          styles.cell,
                          selected && { backgroundColor: colors.brand },
                          !selected && isToday && { borderWidth: 1.5, borderColor: colors.brand },
                        ]}>
                        <Text
                          style={{
                            fontSize: 13.5,
                            fontWeight: selected || isToday ? '800' : '500',
                            color: !d ? 'transparent' : selected ? '#fff' : disabled ? colors.line : i % 7 === 6 ? colors.danger : colors.ink,
                          }}>
                          {d || '0'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <View style={styles.actions}>
            {optional && value ? (
              <TouchableOpacity onPress={() => onPick('')} hitSlop={HIT}>
                <Text style={[styles.action, { color: colors.danger }]}>{t('Clear')}</Text>
              </TouchableOpacity>
            ) : <View />}
            <View style={{ flexDirection: 'row' }}>
              {!outOfRange(today) && (
                <TouchableOpacity onPress={() => onPick(today)} hitSlop={HIT} style={{ marginRight: 18 }}>
                  <Text style={[styles.action, { color: colors.brand }]}>{t('Today')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} hitSlop={HIT}>
                <Text style={[styles.action, { color: colors.subtle }]}>{t('Close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

interface TimeFieldProps {
  label?: string;
  /** 24h "HH:MM" or "" */
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  required?: boolean;
  /** Minute choices step (default 5). */
  minuteStep?: number;
}

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** A field that opens an hour / minute / AM-PM picker. Shows "6:30 AM". */
export function TimeField({ label, value, onChange, hint, required, minuteStep = 5 }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const current = parseClock(value);
  const [h12, setH12] = useState(8);
  const [minute, setMinute] = useState(0);
  const [pm, setPm] = useState(false);

  useEffect(() => {
    if (!open) return;
    const m = current ?? 8 * 60;
    const h = Math.floor(m / 60);
    setH12(h % 12 === 0 ? 12 : h % 12);
    setMinute(m % 60);
    setPm(h >= 12);
  }, [open, current]);

  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);
  if (!minutes.includes(minute)) minutes.push(minute);
  minutes.sort((a, b) => a - b);

  const done = () => {
    const h24 = (h12 % 12) + (pm ? 12 : 0);
    onChange(clockHm(h24 * 60 + minute));
    setOpen(false);
  };

  return (
    <View style={{ marginBottom: 12 }}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <TouchableOpacity activeOpacity={0.7} onPress={() => setOpen(true)} style={styles.field} accessibilityRole="button">
        <MCIcon name="clock-outline" size={19} color={colors.subtle} />
        <Text style={[styles.fieldText, current == null && { color: colors.faint }]}>
          {current == null ? t('Select time') : clock12(current)}
        </Text>
        <MCIcon name="chevron-down" size={18} color={colors.faint} />
      </TouchableOpacity>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.dialog, shadow.pop]}>
            {label ? <Text style={styles.dialogTitle}>{label}</Text> : null}
            <Text style={styles.bigTime}>
              {h12}:{String(minute).padStart(2, '0')} {pm ? 'PM' : 'AM'}
            </Text>
            <Text style={styles.pickLabel}>{t('Hour')}</Text>
            <View style={styles.chipGrid}>
              {HOURS_12.map(h => (
                <PickChip key={h} label={String(h)} active={h === h12} onPress={() => setH12(h)} />
              ))}
            </View>
            <Text style={styles.pickLabel}>{t('Minute')}</Text>
            <View style={styles.chipGrid}>
              {minutes.map(m => (
                <PickChip key={m} label={String(m).padStart(2, '0')} active={m === minute} onPress={() => setMinute(m)} />
              ))}
            </View>
            <View style={[styles.chipGrid, { marginTop: 4 }]}>
              <PickChip wide label="AM" active={!pm} onPress={() => setPm(false)} />
              <PickChip wide label="PM" active={pm} onPress={() => setPm(true)} />
            </View>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={HIT}>
                <Text style={[styles.action, { color: colors.subtle }]}>{t('Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={done} hitSlop={HIT}>
                <Text style={[styles.action, { color: colors.brand }]}>{t('Done')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function PickChip({ label, active, onPress, wide }: { label: string; active: boolean; onPress: () => void; wide?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.pickChip,
        wide && { width: 72 },
        active ? { backgroundColor: colors.brand, borderColor: colors.brand } : null,
      ]}>
      <Text style={{ fontWeight: '700', fontSize: 13, color: active ? '#fff' : colors.ink }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Checkbox square (used by the substitute picker). */
export function Checkbox({ checked, onPress, disabled }: { checked: boolean; onPress?: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      hitSlop={HIT}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      style={[
        styles.checkbox,
        checked ? { backgroundColor: colors.brand, borderColor: colors.brand } : null,
        disabled && { opacity: 0.4 },
      ]}>
      {checked ? <MCIcon name="check" size={15} color="#fff" /> : null}
    </TouchableOpacity>
  );
}

const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  hint: { fontSize: 11.5, color: colors.subtle, marginTop: 5, lineHeight: 16 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.white,
  },
  fieldText: { flex: 1, fontSize: 15, color: colors.ink, marginLeft: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(23,26,38,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 22, padding: 16 },
  dialogTitle: { fontSize: 13, fontWeight: '700', color: colors.subtle, marginBottom: 6 },
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  monthBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  monthTitle: { fontSize: 16, fontWeight: '800', color: colors.ink, marginRight: 4 },
  week: { flexDirection: 'row', marginBottom: 2 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.subtle },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap: { width: '14.285%', padding: 2 },
  cell: { aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  yearWrap: { width: '25%', padding: 4 },
  yearCell: { paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: colors.page },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  action: { fontSize: 14, fontWeight: '800' },
  bigTime: { fontSize: 30, fontWeight: '800', color: colors.ink, textAlign: 'center', marginVertical: 6 },
  pickLabel: { fontSize: 12, fontWeight: '700', color: colors.subtle, marginTop: 6, marginBottom: 4 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  pickChip: {
    width: 44,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    marginRight: 6,
    marginBottom: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
