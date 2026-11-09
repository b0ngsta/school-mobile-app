// Student detail for staff: profile + attendance summary + homework + remarks.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { api, errorText, peek, photoUrl } from '../../api';
import {
  Avatar,
  Badge,
  Bone,
  Button,
  Card,
  CardSkeleton,
  ChipsSkeleton,
  Empty,
  ErrorBox,
  Input,
  ListSkeleton,
  Screen,
  ScreenSkeleton,
  Segments,
  Sheet,
  fmtDate,
} from '../../components/ui';
import { MANAGER_ROLES } from '../../roles';
import { colors } from '../../theme';
import type { AttendanceResponse, HomeworkItem, Remark, ScreenProps, StudentListItem } from '../../types';
import { t } from '../../i18n';

export default function StudentDetail({ params, navigate, session }: ScreenProps) {
  const { studentId } = params || {};
  const [student, setStudent] = useState<StudentListItem | null>(() => peek<StudentListItem>(`/students/${studentId}`));
  const [attendance, setAttendance] = useState<AttendanceResponse | null>(() => peek<AttendanceResponse>(`/students/${studentId}/attendance`));
  const [homework, setHomework] = useState<HomeworkItem[] | null>(() => peek<HomeworkItem[]>(`/students/${studentId}/homework`));
  const [remarks, setRemarks] = useState<Remark[] | null>(() => peek<Remark[]>(`/students/${studentId}/remarks`));
  const [tab, setTab] = useState('homework');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [addingRemark, setAddingRemark] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remark, setRemark] = useState('');
  /** null = adding a new remark; else the remark being edited */
  const [editingId, setEditingId] = useState<number | null>(null);
  // the server lets the teacher who wrote a remark (or managers) change it
  const canChange = (r: Remark) => MANAGER_ROLES.includes(session.user_type) || r.created_by === session.user_id;

  const load = useCallback(async (r = false) => {
    r && setRefreshing(true);
    try {
      setStudent(await api(`/students/${studentId}`));
      api(`/students/${studentId}/attendance`).then(setAttendance).catch(() => {});
      api(`/students/${studentId}/homework`).then(setHomework).catch(() => {});
      api(`/students/${studentId}/remarks`).then(setRemarks).catch(() => {});
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRefreshing(false);
    }
  }, [studentId]);
  useEffect(() => {
    load();
  }, [load]);

  const openRemark = (r?: Remark) => {
    setError(null);
    setEditingId(r ? r.id : null);
    setRemark(r ? r.remark : '');
    setAddingRemark(true);
  };

  const deleteRemark = (r: Remark) =>
    Alert.alert(t('Delete this remark?'), r.remark.slice(0, 120), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/students/${studentId}/remarks/${r.id}`, { method: 'DELETE' });
            setRemarks(list => (list || []).filter(x => x.id !== r.id));
            load();
          } catch (e) {
            setError(errorText(e));
          }
        },
      },
    ]);

  const addRemark = async () => {
    if (!remark.trim()) return setError(t('Remark is required'));
    setBusy(true);
    try {
      if (editingId != null) {
        await api(`/students/${studentId}/remarks/${editingId}`, { method: 'PUT', body: { remark: remark.trim() } });
      } else {
        await api(`/students/${studentId}/remarks`, { method: 'POST', body: { remark: remark.trim() } });
      }
      setAddingRemark(false);
      setEditingId(null);
      setRemark('');
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!student && !error) {
    return (
      <ScreenSkeleton>
        <CardSkeleton avatar={56} lines={2} badge="right" />
        <ChipsSkeleton count={2} />
        <Bone width={140} height={32} radius={14} style={{ marginBottom: 10 }} />
        <ListSkeleton badge="right" lines={1} count={3} />
      </ScreenSkeleton>
    );
  }
  const summary = attendance?.summary;

  return (
    <Screen refreshing={refreshing} onRefresh={() => load(true)}>
      <ErrorBox message={error} />
      {student && (
        <Card style={styles.heroCard}>
          <Avatar name={student.full_name} uri={photoUrl(student.photo_path)} size={56} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.name}>{student.full_name}</Text>
            <Text style={styles.sub}>
              {student.class_name || '—'}{student.section_name ? ` · ${student.section_name}` : ''} · {t('Roll')} {student.roll_no || '—'}
            </Text>
            {student.guardian_phone ? <Text style={styles.sub}>📞 {student.guardian_phone}</Text> : null}
          </View>
          {summary?.percent != null && (
            <View style={[styles.attPill, { backgroundColor: summary.percent >= 75 ? colors.okSoft : colors.warnSoft }]}>
              <Text style={{ color: summary.percent >= 75 ? colors.ok : colors.warn, fontWeight: '800' }}>
                {summary.percent}%
              </Text>
            </View>
          )}
        </Card>
      )}

      <Segments
        items={[
          { value: 'homework', label: `📚 ${t('Homework')}` },
          { value: 'remarks', label: `📝 ${t('Remarks')}` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'homework' && (
        <>
          {student?.class_id && student?.section_id ? (
            <Button
              label={`📚 ${t('Give homework to the class')}`}
              kind="soft"
              small
              onPress={() =>
                navigate('ClassHomework', {
                  classId: student.class_id,
                  sectionId: student.section_id,
                  className: student.class_name,
                  sectionName: student.section_name,
                  title: t('Class homework'),
                })
              }
              style={{ marginBottom: 10, alignSelf: 'flex-start' }}
            />
          ) : null}
          {!homework?.length && <Empty icon="📚" text={t('No homework yet.')} />}
          {homework?.map(h => (
            <Card key={`${h.scope || 'student'}-${h.id}`}>
              <View style={styles.rowHead}>
                <Text style={styles.rowTitle}>{h.title}</Text>
                <Badge status={h.status} />
              </View>
              <Text style={styles.sub}>{t('Due {date}', { date: fmtDate(h.due_date) })}</Text>
              {h.note ? <Text style={[styles.sub, { marginTop: 4 }]}>{h.note}</Text> : null}
            </Card>
          ))}
        </>
      )}

      {tab === 'remarks' && (
        <>
          <Button label={t('+ Add remark')} kind="soft" small onPress={() => openRemark()} style={{ marginBottom: 10, alignSelf: 'flex-start' }} />
          {!remarks?.length && <Empty icon="📝" text={t('No remarks yet.')} />}
          {remarks?.map(r => (
            <Card key={r.id}>
              <Text style={{ color: colors.ink, fontSize: 14 }}>{r.remark}</Text>
              <Text style={[styles.sub, { marginTop: 6 }]}>{r.created_by_name || r.by_name || ''} · {fmtDate(r.created_at)}</Text>
              {canChange(r) && (
                <View style={styles.remarkActions}>
                  <Button label={`✏️ ${t('Edit')}`} kind="soft" small onPress={() => openRemark(r)} testID={`remark-edit-${r.id}`} />
                  <View style={{ width: 8 }} />
                  <Button label={t('Delete')} kind="danger" small onPress={() => deleteRemark(r)} testID={`remark-delete-${r.id}`} />
                </View>
              )}
            </Card>
          ))}
        </>
      )}

      <Sheet visible={addingRemark} title={editingId != null ? t('Edit remark') : t('Add remark')} onClose={() => setAddingRemark(false)} error={error}>
        <Input label={t('Remark')} value={remark} onChangeText={setRemark} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
        <Button label={editingId != null ? t('Save changes') : t('Add remark')} onPress={addRemark} busy={busy} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 2 },
  attPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  remarkActions: { flexDirection: 'row', marginTop: 10 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, flex: 1, paddingRight: 8 },
});
