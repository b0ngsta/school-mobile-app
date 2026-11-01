// Who handed in a class homework: one row per student with
// Pending / Submitted / Late. Changes are saved together.
// params: homework (ClassHomework)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, errorText, photoUrl } from '../../api';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Empty,
  ErrorBox,
  ListScreen,
  ListSkeleton,
  NoticeBox,
  ScreenSkeleton,
  fmtDate,
} from '../../components/ui';
import { t } from '../../i18n';
import { colors } from '../../theme';
import type { ClassHomework, HomeworkSubmission, ScreenProps } from '../../types';

const STATUSES = ['pending', 'submitted', 'late'] as const;

export default function HomeworkSubmissions({ params }: ScreenProps) {
  const hw: ClassHomework = params?.homework || ({} as ClassHomework);
  const [rows, setRows] = useState<HomeworkSubmission[] | null>(null);
  const [changed, setChanged] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (r = false) => {
    r && setRefreshing(true);
    try {
      setRows(await api<HomeworkSubmission[]>(`/homework/${hw.id}/submissions`));
      setChanged({});
      setError(null);
    } catch (e) {
      setError(errorText(e));
      setRows(rs => rs ?? []);
    } finally {
      setRefreshing(false);
    }
  }, [hw.id]);
  useEffect(() => {
    load();
  }, [load]);

  const statusOf = (s: HomeworkSubmission) => changed[s.student_id] ?? s.status;
  const set = (s: HomeworkSubmission, status: string) => {
    setDone(null);
    setChanged(c => {
      const next = { ...c };
      if (status === s.status) delete next[s.student_id];
      else next[s.student_id] = status;
      return next;
    });
  };
  const markAll = (status: string) => {
    setDone(null);
    const next: Record<number, string> = {};
    for (const s of rows || []) if (s.status !== status) next[s.student_id] = status;
    setChanged(next);
  };

  const counts = useMemo(() => {
    const c = { pending: 0, submitted: 0, late: 0 } as Record<string, number>;
    for (const s of rows || []) c[statusOf(s)] = (c[statusOf(s)] || 0) + 1;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, changed]);

  const save = async () => {
    const items = Object.entries(changed).map(([student_id, status]) => ({ student_id: Number(student_id), status }));
    if (!items.length) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/homework/${hw.id}/submissions`, { method: 'PUT', body: { items } });
      setDone(t('Saved {n} changes.', { n: items.length }));
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!rows) {
    return (
      <ScreenSkeleton>
        <ListSkeleton avatar={36} lines={1} count={8} />
      </ScreenSkeleton>
    );
  }
  const pendingChanges = Object.keys(changed).length;

  return (
    <ListScreen
      data={rows}
      keyExtractor={s => s.student_id}
      refreshing={refreshing}
      onRefresh={() => load(true)}
      header={
        <>
          <ErrorBox message={error} />
          <NoticeBox tone="ok" message={done} />
          <Card>
            <Text style={styles.title}>{hw.title}</Text>
            <Text style={styles.sub}>
              {hw.subject ? `${hw.subject} · ` : ''}
              {hw.due_date ? t('Due {date}', { date: fmtDate(hw.due_date) }) : t('No due date')}
            </Text>
            {hw.note ? <Text style={[styles.sub, { color: colors.ink, marginTop: 4 }]}>{hw.note}</Text> : null}
            <Text style={[styles.sub, { marginTop: 8, fontWeight: '700' }]}>
              ✅ {counts.submitted || 0} · ⏳ {counts.pending || 0} · ⚠️ {counts.late || 0}
            </Text>
          </Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
            <Button label={t('All submitted')} kind="soft" small onPress={() => markAll('submitted')} style={{ marginRight: 8, marginBottom: 6 }} />
            <Button label={t('All pending')} kind="ghost" small onPress={() => markAll('pending')} style={{ marginBottom: 6 }} />
          </View>
        </>
      }
      empty={<Empty icon="🧑‍🎓" text={t('No students in this section yet.')} />}
      renderItem={s => {
        const st = statusOf(s);
        return (
          <Card style={[styles.row, changed[s.student_id] ? { borderWidth: 1, borderColor: colors.brand } : null]}>
            <Avatar name={s.full_name} uri={photoUrl(s.photo_path)} size={36} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.name}>{s.full_name}</Text>
              <Text style={styles.sub}>{t('Roll No.')} {s.roll_no || '—'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                {STATUSES.map(v => (
                  <Chip
                    key={v}
                    label={t(v === 'pending' ? 'Pending' : v === 'submitted' ? 'Submitted' : 'Late')}
                    active={st === v}
                    tone={v === 'submitted' ? 'ok' : v === 'late' ? 'danger' : undefined}
                    onPress={() => set(s, v)}
                  />
                ))}
              </View>
            </View>
          </Card>
        );
      }}
      footer={
        rows.length ? (
          <Button
            label={pendingChanges ? t('Save {n} changes', { n: pendingChanges }) : t('No changes')}
            disabled={!pendingChanges}
            busy={busy}
            onPress={save}
          />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  name: { fontSize: 14, fontWeight: '700', color: colors.ink },
});
