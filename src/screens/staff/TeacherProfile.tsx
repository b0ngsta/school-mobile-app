// Teacher profile (like the student profile) with a Timetable tab —
// managers can add/edit the teacher's weekly timetable right here.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, photoUrl } from '../../api';
import { TimetableEditor } from '../../components/Timetable';
import { Avatar, Badge, Card, Screen, Segments, fmtDate } from '../../components/ui';
import { MANAGER_ROLES } from '../../roles';
import { colors, shadow } from '../../theme';
import type { Assignment, ScreenProps, StaffUser } from '../../types';
import { t } from '../../i18n';

function Detail({ label, value, last }: { label: string; value?: string | null; last?: boolean }) {
  return (
    <View style={[styles.detail, last && { borderBottomWidth: 0 }]}>
      <Text style={{ color: colors.subtle, fontSize: 12.5 }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>
        {value || '—'}
      </Text>
    </View>
  );
}

export default function TeacherProfile({ params, session }: ScreenProps) {
  const teacher: StaffUser = params?.teacher || ({} as StaffUser);
  const canEdit = MANAGER_ROLES.includes(session.user_type);
  const [tab, setTab] = useState(params?.hint === 'timetable' ? 'timetable' : 'details');
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    api(`/assignments?teacher_id=${teacher.id}`).then(setAssignments).catch(() => {});
  }, [teacher.id]);

  return (
    <Screen>
      {/* profile card */}
      <View style={[styles.hero, shadow.card]}>
        <Avatar name={teacher.full_name} uri={photoUrl(teacher.photo_path)} size={58} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name}>{teacher.full_name}</Text>
          <Text style={styles.sub}>
            {t('Designation:')} <Text style={{ color: colors.brand, fontWeight: '800' }}>{t('Teacher')}</Text>
          </Text>
          <Text style={styles.sub}>{t('EMP ID:')} {teacher.id}{teacher.subject ? ` · 📘 ${teacher.subject}` : ''}</Text>
        </View>
      </View>

      <Segments
        items={[
          { value: 'details', label: `👤 ${t('Details')}` },
          { value: 'timetable', label: `🕐 ${t('Timetable')}` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'details' && (
        <>
          <Card>
            <Detail label={t('Username')} value={teacher.username} />
            <Detail label={t('Email')} value={teacher.email} />
            <Detail label={t('Phone')} value={teacher.phone} />
            <Detail label={t('Subject')} value={teacher.subject} />
            <Detail label={t('Qualification')} value={teacher.qualification} />
            <Detail label={t('Joining date')} value={teacher.joining_date ? fmtDate(teacher.joining_date) : null} />
            <Detail label={t('Address')} value={teacher.address} last />
          </Card>
          <Card>
            <Text style={styles.sectionTitle}>{t('Class assignments')}</Text>
            {assignments.length === 0 && (
              <Text style={{ color: colors.subtle, fontSize: 12.5 }}>{t('No class assignments yet.')}</Text>
            )}
            {assignments.map(a => (
              <View key={a.id} style={styles.assignRow}>
                <Text style={{ flex: 1, color: colors.ink, fontWeight: '600', fontSize: 13.5 }}>
                  {a.class_name} — {t('Section {name}', { name: a.section_name })}
                </Text>
                <Badge
                  status={a.role}
                  label={a.role === 'class_teacher' ? t('Class teacher') : a.subject || t('Subject')}
                />
              </View>
            ))}
          </Card>
        </>
      )}

      {tab === 'timetable' && (
        <>
          {canEdit && (
            <Text style={{ color: colors.subtle, fontSize: 12, marginBottom: 8 }}>
              {t('Tap any period to assign a class, section and subject — e.g. Monday · P2 → Class 2-B.')}
            </Text>
          )}
          <TimetableEditor teacherId={teacher.id} canEdit={canEdit} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 12,
  },
  name: { fontSize: 16.5, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.ink, marginBottom: 8 },
  detail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 10,
  },
  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
