// Attendance marking — pick a section (teachers: from assignments; managers:
// from all classes), then one-tap Present/Absent/Leave per student. Styled
// like the attendance mockup (summary tiles + toggles).
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, errorText } from '../../api';
import {
  Button,
  Card,
  Chip,
  ChipsSkeleton,
  Empty,
  ErrorBox,
  ListScreen,
  ScreenSkeleton,
  SectionTitle,
  SectionTitleSkeleton,
} from '../../components/ui';
import { localIsoDate } from '../../format';
import { MANAGER_ROLES } from '../../roles';
import { colors } from '../../theme';
import type { AdminClass, Assignment, MarkAttendanceRow, ScreenProps, SectionPick } from '../../types';
import { t } from '../../i18n';

// Local date — toISOString() is UTC, i.e. still "yesterday" before 05:30 in India.
const today = () => localIsoDate();

export default function MarkAttendance({ params, session }: ScreenProps) {
  const isManager = MANAGER_ROLES.includes(session.user_type);
  const [sections, setSections] = useState<SectionPick[] | null>(null);
  const [sel, setSel] = useState<SectionPick | null>(
    params?.sectionId
      ? { classId: params.classId, sectionId: params.sectionId, label: `${params.className} — ${params.sectionName}` }
      : null,
  );
  const [rows, setRows] = useState<MarkAttendanceRow[] | null>(null);
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
        if (isManager) {
          const classes = await api<AdminClass[]>('/classes');
          const out: SectionPick[] = [];
          classes.forEach(c =>
            c.sections.forEach(s =>
              out.push({ classId: c.id, sectionId: s.id, label: `${c.name} — ${s.name}` }),
            ),
          );
          setSections(out);
        } else {
          const mine = await api<Assignment[]>('/assignments/mine');
          const seen = new Set<number>();
          const out: SectionPick[] = [];
          mine.forEach(a => {
            if (!seen.has(a.section_id)) {
              seen.add(a.section_id);
              out.push({ classId: a.class_id, sectionId: a.section_id, label: `${a.class_name} — ${a.section_name}` });
            }
          });
          setSections(out);
        }
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
    load();
  }, [load]);

  // Stable, so a tap re-renders only the row that changed (see AttendanceRow).
  const setStatus = useCallback(
    (id: number, status: string) =>
      setRows(rs => (rs ? rs.map(r => (r.student_id === id ? { ...r, status } : r)) : rs)),
    [],
  );

  const counts = useMemo(() => {
    if (!rows) return null;
    const c = { present: 0, absent: 0, leave: 0 };
    for (const r of rows) if (r.status === 'present' || r.status === 'absent' || r.status === 'leave') c[r.status]++;
    return c;
  }, [rows]);

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

  const showRows = !!(sel && rows);

  const header = (
    <>
      <ErrorBox message={error} />

      <SectionTitle>{t('Pick a section')} · {today()}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        {sections?.map(s => (
          <Chip key={s.sectionId} label={s.label} active={sel?.sectionId === s.sectionId} onPress={() => setSel(s)} />
        ))}
        {sections?.length === 0 && <Empty icon="🏫" text={t('No sections available to you.')} />}
      </View>

      {sel && rows && (
        <View style={styles.summaryRow}>
          <Card style={[styles.sumCard, { backgroundColor: colors.brandSoft, borderColor: colors.brandSoft }]}>
            <Text style={[styles.sumNum, { color: colors.brand }]}>{rows.length}</Text>
            <Text style={styles.sumLbl}>{t('Total')}</Text>
          </Card>
          <Card style={[styles.sumCard, { backgroundColor: colors.okSoft, borderColor: colors.okSoft }]}>
            <Text style={[styles.sumNum, { color: colors.ok }]}>{counts?.present}</Text>
            <Text style={styles.sumLbl}>{t('Present')}</Text>
          </Card>
          <Card style={[styles.sumCard, { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }]}>
            <Text style={[styles.sumNum, { color: colors.danger }]}>{counts?.absent}</Text>
            <Text style={styles.sumLbl}>{t('Absent')}</Text>
          </Card>
          <Card style={[styles.sumCard, { backgroundColor: colors.warnSoft, borderColor: colors.warnSoft }]}>
            <Text style={[styles.sumNum, { color: colors.warn }]}>{counts?.leave}</Text>
            <Text style={styles.sumLbl}>{t('Leave')}</Text>
          </Card>
        </View>
      )}
    </>
  );

  const footer =
    sel && rows && rows.length > 0 ? (
      <>
        {savedAt && (
          <Text style={{ color: colors.ok, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>
            ✅ {t('Attendance saved')}
          </Text>
        )}
        <Button label={t('Save attendance')} onPress={save} busy={saving} />
      </>
    ) : null;

  return (
    <ListScreen
      data={showRows ? rows : null}
      keyExtractor={r => r.student_id}
      renderItem={r => <AttendanceRow row={r} onSet={setStatus} />}
      header={header}
      footer={footer}
      empty={<Empty icon="🧑‍🎓" text={t('No students in this section.')} />}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    />
  );
}

/** One student's P / A / L / H (half day) toggles; memoised so only the tapped row re-renders. */
const AttendanceRow = memo(function AttendanceRow({
  row: r,
  onSet,
}: {
  row: MarkAttendanceRow;
  onSet: (id: number, status: string) => void;
}) {
  return (
    <Card style={{ paddingVertical: 10 }}>
      <View style={styles.rowHead}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.name}>{r.full_name}</Text>
          <Text style={styles.roll}>{t('Roll No.')} {r.roll_no || '—'}</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Chip label={t('P')} tone="ok" active={r.status === 'present'} onPress={() => onSet(r.student_id, 'present')} />
          <Chip label={t('A')} tone="danger" active={r.status === 'absent'} onPress={() => onSet(r.student_id, 'absent')} />
          <Chip label={t('L')} active={r.status === 'leave'} onPress={() => onSet(r.student_id, 'leave')} />
          <Chip label={t('H')} active={r.status === 'half_day'} onPress={() => onSet(r.student_id, 'half_day')} />
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', marginHorizontal: -3, marginBottom: 10 },
  sumCard: { flex: 1, marginHorizontal: 3, alignItems: 'center', paddingVertical: 10, marginBottom: 0 },
  sumNum: { fontSize: 18, fontWeight: '800' },
  sumLbl: { fontSize: 11, color: colors.subtle, marginTop: 2 },
  rowHead: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 14, fontWeight: '700', color: colors.ink },
  roll: { fontSize: 11.5, color: colors.subtle, marginTop: 1 },
});
