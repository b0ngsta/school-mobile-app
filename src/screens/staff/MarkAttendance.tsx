// Attendance marking (redesigned Nov 2026). Today's date on top, then the
// classes as big colourful cards grouped by class (teachers: the sections
// they're assigned to, ★ = class teacher; managers: every section), a
// progress summary (present % + Present / Absent / Leave / Half day), "All
// present / All absent" shortcuts, a search for long classes and one row per
// student with big P / A / L / H buttons. Unmarked students start as present.
// Teachers only get the section they are CLASS teacher of (Nov 2026; the API
// allows only the class teacher or managers to save attendance).
// Data: GET /attendance?section_id=&day= · POST /attendance.
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { api, errorText } from '../../api';
import {
  Avatar,
  Button,
  ChipsSkeleton,
  Empty,
  ErrorBox,
  ListScreen,
  ScreenSkeleton,
  SectionTitleSkeleton,
} from '../../components/ui';
import { fmtDayLong, localIsoDate } from '../../format';
import { MANAGER_ROLES } from '../../roles';
import { ACCENTS, colors } from '../../theme';
import type { AdminClass, Assignment, MarkAttendanceRow, ScreenProps, SectionPick } from '../../types';
import { t } from '../../i18n';

// Local date — toISOString() is UTC, i.e. still "yesterday" before 05:30 in India.
const today = () => localIsoDate();

/** A pickable section with what the card shows. */
export type SectionCard = SectionPick & {
  className: string;
  sectionName: string;
  classTeacher?: boolean;
  subjects?: string[];
  students?: number | null;
};

type Status = 'present' | 'absent' | 'leave' | 'half_day';

const STATUS: { key: Status; short: string; label: string; icon: string; fg: () => string; bg: () => string }[] = [
  { key: 'present', short: 'P', label: 'Present', icon: 'check-circle', fg: () => colors.ok, bg: () => colors.okSoft },
  { key: 'absent', short: 'A', label: 'Absent', icon: 'close-circle', fg: () => colors.danger, bg: () => colors.dangerSoft },
  { key: 'leave', short: 'L', label: 'Leave', icon: 'bag-suitcase', fg: () => colors.warn, bg: () => colors.warnSoft },
  { key: 'half_day', short: 'H', label: 'Half day', icon: 'circle-half-full', fg: () => colors.info, bg: () => colors.infoSoft },
];
const statusOf = (s: string) => STATUS.find(x => x.key === s) || STATUS[0];

/** Teacher assignments → one card per section (class teacher flag + subjects merged). */
export function cardsFromAssignments(mine: Assignment[]): SectionCard[] {
  const by = new Map<number, SectionCard>();
  for (const a of mine) {
    let c = by.get(a.section_id);
    if (!c) {
      c = { classId: a.class_id, sectionId: a.section_id, label: `${a.class_name} — ${a.section_name}`,
        className: a.class_name, sectionName: a.section_name, classTeacher: false, subjects: [], students: a.student_count ?? null };
      by.set(a.section_id, c);
    }
    if (a.role === 'class_teacher') c.classTeacher = true;
    if (a.subject && !c.subjects!.includes(a.subject)) c.subjects!.push(a.subject);
  }
  // class teacher's own section first, then by class / section name
  return [...by.values()].sort((x, y) => Number(!!y.classTeacher) - Number(!!x.classTeacher)
    || x.className.localeCompare(y.className, undefined, { numeric: true }) || x.sectionName.localeCompare(y.sectionName));
}

export default function MarkAttendance({ params, session }: ScreenProps) {
  const isManager = MANAGER_ROLES.includes(session.user_type);
  const [sections, setSections] = useState<SectionCard[] | null>(null);
  const [sel, setSel] = useState<SectionPick | null>(
    params?.sectionId
      ? { classId: params.classId, sectionId: params.sectionId, label: `${params.className} — ${params.sectionName}` }
      : null,
  );
  const [rows, setRows] = useState<MarkAttendanceRow[] | null>(null);
  const [wasMarked, setWasMarked] = useState(false);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  /** Bumped per load: a slow answer for a previously picked section is dropped
   *  (it would otherwise show — and save — the wrong students). */
  const loadId = useRef(0);

  // load pickable sections
  useEffect(() => {
    (async () => {
      try {
        let out: SectionCard[];
        if (isManager) {
          const classes = await api<AdminClass[]>('/classes');
          out = classes.flatMap(c => c.sections.map(s => ({
            classId: c.id, sectionId: s.id, label: `${c.name} — ${s.name}`, className: c.name, sectionName: s.name,
            students: (s as { student_count?: number }).student_count ?? null,
          })));
        } else {
          // Only the CLASS teacher marks a section's attendance (the server
          // refuses everyone else), so subject-only sections aren't offered.
          out = cardsFromAssignments(await api<Assignment[]>('/assignments/mine')).filter(c => c.classTeacher);
        }
        setSections(out);
        // only one class → open it straight away
        // (a link straight to a section this teacher can't mark is dropped too)
        setSel(cur => {
          const keep = cur && (isManager || out.some(c => c.sectionId === cur.sectionId)) ? cur : null;
          return keep ?? (out.length === 1 ? out[0] : null);
        });
      } catch (e) {
        setError(errorText(e));
      }
    })();
  }, [isManager]);

  const load = useCallback(async (r = false) => {
    if (!sel) return;
    const id = ++loadId.current;
    r && setRefreshing(true);
    try {
      const data = await api<MarkAttendanceRow[]>(`/attendance?section_id=${sel.sectionId}&day=${today()}`);
      if (id !== loadId.current) return;
      setWasMarked(data.some(x => !!x.status));
      // Unmarked students start as present — the usual case — until changed.
      setRows(data.map(x => ({ ...x, status: x.status || 'present' })));
      setError(null);
      setSavedAt(null);
    } catch (e) {
      if (id === loadId.current) setError(errorText(e));
    } finally {
      if (id === loadId.current) setRefreshing(false);
    }
  }, [sel]);
  useEffect(() => {
    setRows(null);
    setQ('');
    load();
  }, [load]);

  // Stable, so a tap re-renders only the row that changed (see AttendanceRow).
  const setStatus = useCallback((id: number, status: string) => {
    setSavedAt(null);
    setRows(rs => (rs ? rs.map(r => (r.student_id === id ? { ...r, status } : r)) : rs));
  }, []);
  const setAll = (status: Status) => {
    setSavedAt(null);
    setRows(rs => (rs ? rs.map(r => ({ ...r, status })) : rs));
  };

  const counts = useMemo(() => {
    const c: Record<Status, number> = { present: 0, absent: 0, leave: 0, half_day: 0 };
    for (const r of rows || []) if (r.status in c) c[r.status as Status]++;
    return c;
  }, [rows]);
  const total = rows?.length ?? 0;
  const presentPct = total ? Math.round(((counts.present + counts.half_day / 2) / total) * 100) : 0;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!rows || !needle) return rows;
    return rows.filter(r => r.full_name.toLowerCase().includes(needle) || String(r.roll_no ?? '').includes(needle));
  }, [rows, q]);

  const groups = useMemo(() => {
    const out: { className: string; items: SectionCard[] }[] = [];
    for (const s of sections || []) {
      let g = out.find(x => x.className === s.className);
      if (!g) out.push((g = { className: s.className, items: [] }));
      g.items.push(s);
    }
    return out;
  }, [sections]);

  const save = async () => {
    if (!sel || !rows || saving) return;
    setSaving(true);
    try {
      await api('/attendance', {
        method: 'POST',
        body: {
          section_id: sel.sectionId,
          date: today(),
          records: rows.map(r => ({ student_id: r.student_id, status: r.status })),
        },
      });
      setSavedAt(new Date());
      setWasMarked(true);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  if (!sections && !error) {
    return (
      <ScreenSkeleton>
        <SectionTitleSkeleton width={160} />
        <ChipsSkeleton count={4} />
      </ScreenSkeleton>
    );
  }

  const selCard = sections?.find(s => s.sectionId === sel?.sectionId);

  const header = (
    <>
      <View style={[styles.hero, { backgroundColor: colors.brand }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroKicker}>{t('Mark attendance')}</Text>
          <Text style={styles.heroDate}>{fmtDayLong(today())}</Text>
        </View>
        <View style={styles.heroIcon}>
          <MCIcon name="clipboard-check-outline" size={30} color="#fff" />
        </View>
      </View>
      <ErrorBox message={error} />

      <Text style={styles.label}>{t('Choose a class')}</Text>
      {sections?.length === 0 ? (
        <Empty icon="google-classroom"
          text={isManager ? t('No sections available to you.') : t('Only the class teacher marks attendance — you are not a class teacher of any section.')} />
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardsScroll}
        contentContainerStyle={styles.cardsRow}>
        {groups.flatMap((g, gi) => g.items.map(s => (
          <ClassCard key={s.sectionId} card={s} accent={ACCENTS[gi % ACCENTS.length]}
            active={sel?.sectionId === s.sectionId} onPress={() => setSel(s)} />
        )))}
      </ScrollView>

      {sel && rows ? (
        <View style={styles.summary}>
          <View style={styles.summaryTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>{selCard ? `${selCard.className} · ${t('Section')} ${selCard.sectionName}` : sel.label}</Text>
              <Text style={styles.summarySub}>
                {wasMarked ? `✏️ ${t('Already marked today — changes update it')}` : t('{n} students · not marked yet', { n: total })}
              </Text>
            </View>
            <Text style={[styles.pct, { color: presentPct >= 75 ? colors.ok : presentPct >= 50 ? colors.warn : colors.danger }]}>
              {presentPct}%
            </Text>
          </View>
          <View style={styles.bar}>
            {STATUS.map(s => (counts[s.key] ? (
              <View key={s.key} style={{ flex: counts[s.key], backgroundColor: s.fg() }} />
            ) : null))}
          </View>
          <View style={styles.tiles}>
            {STATUS.map(s => (
              <View key={s.key} style={[styles.tile, { backgroundColor: s.bg() }]}>
                <MCIcon name={s.icon} size={16} color={s.fg()} />
                <Text style={[styles.tileNum, { color: s.fg() }]}>{counts[s.key]}</Text>
                <Text style={styles.tileLbl}>{t(s.label)}</Text>
              </View>
            ))}
          </View>
          {total > 0 ? (
            <View style={styles.bulk}>
              <TouchableOpacity style={[styles.bulkBtn, { borderColor: colors.ok }]} onPress={() => setAll('present')}
                accessibilityRole="button" testID="att-all-present">
                <MCIcon name="check-all" size={16} color={colors.ok} />
                <Text style={[styles.bulkText, { color: colors.ok }]}>{t('All present')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bulkBtn, { borderColor: colors.danger }]} onPress={() => setAll('absent')}
                accessibilityRole="button" testID="att-all-absent">
                <MCIcon name="close-box-multiple-outline" size={16} color={colors.danger} />
                <Text style={[styles.bulkText, { color: colors.danger }]}>{t('All absent')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {total > 12 ? (
            <View style={styles.search}>
              <MCIcon name="magnify" size={20} color={colors.subtle} />
              <TextInput value={q} onChangeText={setQ} placeholder={t('Search name or roll no.')}
                placeholderTextColor={colors.faint} style={styles.searchInput} accessibilityLabel={t('Search name or roll no.')} />
              {q ? (
                <TouchableOpacity onPress={() => setQ('')} accessibilityLabel={t('Clear')}>
                  <MCIcon name="close-circle" size={18} color={colors.faint} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : !sel && sections?.length ? (
        <View style={styles.hint}>
          <MCIcon name="gesture-tap" size={22} color={colors.subtle} />
          <Text style={styles.hintText}>{t('Tap a class above to take the roll.')}</Text>
        </View>
      ) : null}
    </>
  );

  const footer =
    sel && rows && rows.length > 0 ? (
      <View style={{ paddingTop: 4 }}>
        {savedAt && (
          <Text style={{ color: colors.ok, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>
            ✅ {t('Attendance saved')}
          </Text>
        )}
        <Button label={`${t('Save attendance')} · ${counts.present}/${total} ${t('present')}`} onPress={save} busy={saving}
          testID="att-save" />
      </View>
    ) : null;

  return (
    <ListScreen
      data={sel && rows ? shown : null}
      keyExtractor={r => r.student_id}
      renderItem={r => <AttendanceRow row={r} onSet={setStatus} />}
      header={header}
      footer={footer}
      empty={<Empty icon="account-school-outline" text={q ? t('No student matches your search.') : t('No students in this section.')} />}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    />
  );
}

function ClassCard({ card: s, accent, active, onPress }: {
  card: SectionCard;
  accent: { fg: string; bg: string };
  active: boolean;
  onPress: () => void;
}) {
  const sub = s.classTeacher ? `★ ${t('Class teacher')}` : s.subjects?.length ? s.subjects.join(', ') : null;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button"
      accessibilityState={{ selected: active }} accessibilityLabel={s.label} testID={`att-class-${s.sectionId}`}
      style={[styles.classCard, { backgroundColor: active ? accent.fg : accent.bg, borderColor: active ? accent.fg : 'transparent' }]}>
      <View style={styles.classTop}>
        <View style={[styles.secBadge, { backgroundColor: active ? 'rgba(255,255,255,0.22)' : '#fff' }]}>
          <Text style={[styles.secText, { color: active ? '#fff' : accent.fg }]}>{s.sectionName}</Text>
        </View>
        {active ? <MCIcon name="check-circle" size={22} color="#fff" /> : null}
      </View>
      <Text style={[styles.className, { color: active ? '#fff' : colors.ink }]} numberOfLines={1}>{s.className}</Text>
      <Text style={[styles.classSub, { color: active ? 'rgba(255,255,255,0.9)' : colors.subtle }]} numberOfLines={1}>
        {sub || `${t('Section')} ${s.sectionName}`}
      </Text>
      {s.students != null ? (
        <Text style={[styles.classSub, { color: active ? 'rgba(255,255,255,0.9)' : colors.subtle }]}>
          👥 {t('{n} students', { n: s.students })}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

/** One student's P / A / L / H (half day) buttons; memoised so only the tapped row re-renders. */
const AttendanceRow = memo(function AttendanceRow({
  row: r,
  onSet,
}: {
  row: MarkAttendanceRow;
  onSet: (id: number, status: string) => void;
}) {
  const cur = statusOf(r.status);
  return (
    <View style={[styles.row, { borderLeftColor: cur.fg() }]}>
      <Avatar name={r.full_name} size={34} />
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={2}>{r.full_name}</Text>
        <Text style={styles.roll} numberOfLines={1}>
          {t('Roll')} {r.roll_no || '—'} · <Text style={{ color: cur.fg(), fontWeight: '800' }}>{t(cur.label)}</Text>
        </Text>
      </View>
      <View style={styles.toggles}>
        {STATUS.map(s => {
          const on = r.status === s.key;
          return (
            <TouchableOpacity key={s.key} onPress={() => onSet(r.student_id, s.key)} accessibilityRole="radio"
              accessibilityState={{ selected: on }} accessibilityLabel={`${r.full_name}: ${t(s.label)}`}
              testID={`att-${r.student_id}-${s.short}`}
              style={[styles.toggle, on ? { backgroundColor: s.fg(), borderColor: s.fg() } : { borderColor: colors.line }]}>
              <Text style={[styles.toggleText, { color: on ? '#fff' : s.fg() }]}>{t(s.short)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 18, marginBottom: 14 },
  heroKicker: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroDate: { color: '#fff', fontSize: 19, fontWeight: '800', marginTop: 4 },
  heroIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '800', color: colors.subtle, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  cardsScroll: { flexGrow: 0, marginHorizontal: -16, marginBottom: 14 },
  cardsRow: { paddingHorizontal: 16, gap: 10 },
  classCard: { width: 138, minHeight: 112, borderRadius: 18, padding: 14, borderWidth: 2 },
  classTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secBadge: { minWidth: 34, height: 34, borderRadius: 12, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  secText: { fontSize: 16, fontWeight: '900' },
  className: { fontSize: 17, fontWeight: '800', marginTop: 10 },
  classSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  summary: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.line },
  summaryTop: { flexDirection: 'row', alignItems: 'center' },
  summaryTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  summarySub: { fontSize: 12.5, color: colors.subtle, marginTop: 2 },
  pct: { fontSize: 26, fontWeight: '900' },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.line, marginTop: 12 },
  tiles: { flexDirection: 'row', gap: 6, marginTop: 12 },
  tile: { flex: 1, borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  tileNum: { fontSize: 18, fontWeight: '900', marginTop: 2 },
  tileLbl: { fontSize: 10.5, color: colors.subtle, fontWeight: '700' },
  bulk: { flexDirection: 'row', gap: 8, marginTop: 12 },
  bulkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 12, paddingVertical: 9 },
  bulkText: { fontSize: 13, fontWeight: '800', marginLeft: 6 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.page, borderRadius: 12, paddingHorizontal: 12, marginTop: 12 },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, paddingVertical: 10, marginLeft: 6 },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 24 },
  hintText: { fontSize: 14, color: colors.subtle, marginLeft: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 10, paddingLeft: 12,
    marginBottom: 8, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 4 },
  rowText: { flex: 1, marginLeft: 8, marginRight: 4 },
  name: { fontSize: 14, fontWeight: '800', color: colors.ink },
  roll: { fontSize: 12, color: colors.subtle, marginTop: 2 },
  toggles: { flexDirection: 'row', gap: 4 },
  toggle: { width: 34, height: 34, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  toggleText: { fontSize: 14, fontWeight: '900' },
});
