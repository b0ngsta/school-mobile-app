// Teacher profile (like the student profile) with a Timetable tab —
// managers can add/edit the teacher's weekly timetable right here.
// Nov 2026 (same as the web Users / Classes pages): managers also change the
// teacher's photo (POST /users/{id}/photo), edit the account + teacher details
// (PUT /users/{id} name/email/phone · PUT /users/teachers/{id} designation,
// subject, qualification, joining date, address) and add / remove class
// assignments — class teacher of ONE section, or subject teacher
// (POST /assignments, DELETE /assignments/{id}; the server refuses a second
// class teacher for a section / a teacher who already is one, and says so).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api, errorText, photoUrl } from '../../api';
import PhotoAvatar from '../../components/PhotoAvatar';
import { DateField } from '../../components/pickers';
import { TimetableEditor } from '../../components/Timetable';
import { Badge, Button, Card, Chip, ErrorBox, Input, Screen, Segments, Sheet, fmtDate } from '../../components/ui';
import { changeUserPhoto } from '../../components/userPhoto';
import { MANAGER_ROLES } from '../../roles';
import { colors, shadow } from '../../theme';
import type { AdminClass, Assignment, ScreenProps, StaffUser } from '../../types';
import { t } from '../../i18n';
import { emailError, firstError } from '../../validation';

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

interface DetailsForm {
  full_name: string;
  email: string;
  phone: string;
  designation: string;
  subject: string;
  qualification: string;
  joining_date: string;
  address: string;
}

interface AssignForm {
  role: 'class_teacher' | 'subject_teacher';
  classId: number | null;
  sectionId: number | null;
  subject: string;
}

const s = (v?: string | null) => v || '';

export default function TeacherProfile({ params, session }: ScreenProps) {
  const [teacher, setTeacher] = useState<StaffUser>(params?.teacher || ({} as StaffUser));
  const canEdit = MANAGER_ROLES.includes(session.user_type);
  const [tab, setTab] = useState(params?.hint === 'timetable' ? 'timetable' : 'details');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [details, setDetails] = useState<DetailsForm | null>(null);
  const [assign, setAssign] = useState<AssignForm | null>(null);
  const [classes, setClasses] = useState<AdminClass[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAssignments = useCallback(() => {
    api<Assignment[]>(`/assignments?teacher_id=${teacher.id}`).then(setAssignments).catch(() => {});
  }, [teacher.id]);
  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const isClassTeacher = assignments.some(a => a.role === 'class_teacher');

  const changePhoto = async () => {
    setError(null);
    setPhotoBusy(true);
    try {
      const path = await changeUserPhoto(teacher.id);
      if (path) setTeacher(tc => ({ ...tc, photo_path: path }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPhotoBusy(false);
    }
  };

  const openDetails = () => {
    setFormError(null);
    setDetails({
      full_name: s(teacher.full_name), email: s(teacher.email), phone: s(teacher.phone),
      designation: s(teacher.designation), subject: s(teacher.subject), qualification: s(teacher.qualification),
      joining_date: s(teacher.joining_date).slice(0, 10), address: s(teacher.address),
    });
  };

  const saveDetails = async () => {
    if (!details) return;
    const f = details;
    const bad = firstError(!f.full_name.trim() && t('Full name is required'), emailError(f.email));
    if (bad) return setFormError(bad);
    // only what changed: both endpoints leave fields that are left out alone
    const account: Record<string, string | null> = {};
    if (f.full_name.trim() !== s(teacher.full_name)) account.full_name = f.full_name.trim();
    if (f.email.trim() !== s(teacher.email)) account.email = f.email.trim();
    if (f.phone.trim() !== s(teacher.phone)) account.phone = f.phone.trim() || null;
    const info: Record<string, string | null> = {};
    for (const k of ['designation', 'subject', 'qualification', 'address'] as const) {
      if (f[k].trim() !== s(teacher[k])) info[k] = f[k].trim() || null;
    }
    if (f.joining_date !== s(teacher.joining_date).slice(0, 10)) info.joining_date = f.joining_date || null;
    setBusy(true);
    setFormError(null);
    try {
      if (Object.keys(account).length) await api(`/users/${teacher.id}`, { method: 'PUT', body: account });
      if (Object.keys(info).length) await api(`/users/teachers/${teacher.id}`, { method: 'PUT', body: info });
      setTeacher(tc => ({ ...tc, ...account, ...info }));
      setDetails(null);
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const openAssign = async () => {
    setFormError(null);
    setAssign({ role: isClassTeacher ? 'subject_teacher' : 'class_teacher', classId: null, sectionId: null, subject: '' });
    if (!classes) {
      try {
        setClasses(await api<AdminClass[]>('/classes'));
      } catch (e) {
        setFormError(errorText(e));
      }
    }
  };

  const pickedClass = useMemo(() => classes?.find(c => c.id === assign?.classId) || null, [classes, assign?.classId]);

  const saveAssign = async () => {
    if (!assign) return;
    const bad = firstError(
      !assign.classId && t('Choose a class'),
      !assign.sectionId && t('Choose a section'),
      assign.role === 'subject_teacher' && !assign.subject.trim() && t('Choose or type the subject'),
    );
    if (bad) return setFormError(bad);
    setBusy(true);
    setFormError(null);
    try {
      await api('/assignments', {
        method: 'POST',
        body: {
          teacher_id: teacher.id,
          class_id: assign.classId,
          section_id: assign.sectionId,
          role: assign.role,
          subject: assign.role === 'subject_teacher' ? assign.subject.trim() : null,
        },
      });
      setAssign(null);
      loadAssignments();
    } catch (e) {
      // 409: section already has a class teacher / teacher already is one / duplicate
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const removeAssign = (a: Assignment) =>
    Alert.alert(
      t('Remove this assignment?'),
      `${a.class_name} — ${a.section_name} · ${a.role === 'class_teacher' ? t('Class teacher') : a.subject || t('Subject')}`,
      [
        { text: t('profile.cancel'), style: 'cancel' },
        {
          text: t('Remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/assignments/${a.id}`, { method: 'DELETE' });
              setAssignments(list => list.filter(x => x.id !== a.id));
            } catch (e) {
              setError(errorText(e));
            }
          },
        },
      ],
    );

  const setD = (k: keyof DetailsForm) => (v: string) => setDetails(cur => (cur ? { ...cur, [k]: v } : cur));

  return (
    <Screen>
      <ErrorBox message={error} />
      {/* profile card */}
      <View style={[styles.hero, shadow.card]}>
        <PhotoAvatar name={teacher.full_name} uri={photoUrl(teacher.photo_path)} size={58} testID="teacher-photo-view" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name}>{teacher.full_name}</Text>
          <Text style={styles.sub}>
            {t('Designation:')} <Text style={{ color: colors.brand, fontWeight: '800' }}>{teacher.designation || t('Teacher')}</Text>
          </Text>
          <Text style={styles.sub}>{t('EMP ID:')} {teacher.id}{teacher.subject ? ` · 📘 ${teacher.subject}` : ''}</Text>
          {canEdit && (
            <Button label={teacher.photo_path ? t('Change photo') : t('Add photo')} icon="camera-outline" kind="soft" small
              onPress={changePhoto} busy={photoBusy} style={styles.photoBtn} testID="teacher-photo" />
          )}
        </View>
      </View>

      <Segments
        items={[
          { value: 'details', label: t('Details'), icon: 'account-circle-outline' },
          { value: 'timetable', label: t('Timetable'), icon: 'clock-outline' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'details' && (
        <>
          <Card>
            <View style={styles.cardHead}>
              <Text style={styles.sectionTitle}>{t('Details')}</Text>
              {canEdit && (
                <TouchableOpacity onPress={openDetails} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="teacher-edit">
                  <Text style={[styles.link, { color: colors.brand }]}>{t('Edit')}</Text>
                </TouchableOpacity>
              )}
            </View>
            <Detail label={t('Username')} value={teacher.username} />
            <Detail label={t('Email')} value={teacher.email} />
            <Detail label={t('Phone')} value={teacher.phone} />
            <Detail label={t('Designation')} value={teacher.designation} />
            <Detail label={t('Subject')} value={teacher.subject} />
            <Detail label={t('Qualification')} value={teacher.qualification} />
            <Detail label={t('Joining date')} value={teacher.joining_date ? fmtDate(teacher.joining_date) : null} />
            <Detail label={t('Address')} value={teacher.address} last />
          </Card>
          <Card>
            <View style={styles.cardHead}>
              <Text style={styles.sectionTitle}>{t('Class assignments')}</Text>
              {canEdit && (
                <TouchableOpacity onPress={openAssign} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="assign-add">
                  <Text style={[styles.link, { color: colors.brand }]}>{t('+ Assign class')}</Text>
                </TouchableOpacity>
              )}
            </View>
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
                {canEdit && (
                  <TouchableOpacity onPress={() => removeAssign(a)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ marginLeft: 10 }} accessibilityLabel={t('Remove')} testID={`assign-remove-${a.id}`}>
                    <Text style={{ color: colors.danger, fontSize: 18, fontWeight: '700' }}>×</Text>
                  </TouchableOpacity>
                )}
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

      <Sheet visible={!!details} title={t('Edit teacher')} onClose={() => setDetails(null)} error={formError}>
        {details && (
          <>
            <Input label={t('Full name')} value={details.full_name} onChangeText={setD('full_name')} />
            <Input label={t('Email')} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" maxLength={120}
              value={details.email} onChangeText={setD('email')} />
            <Input label={t('Phone')} keyboardType="phone-pad" value={details.phone} onChangeText={setD('phone')} />
            <Input label={t('Designation (e.g. TGT, PGT)')} maxLength={50} value={details.designation} onChangeText={setD('designation')} />
            <Input label={t('Subject')} value={details.subject} onChangeText={setD('subject')} />
            <Input label={t('Qualification')} value={details.qualification} onChangeText={setD('qualification')} />
            <DateField label={t('Joining date')} value={details.joining_date} onChange={setD('joining_date')} optional />
            <Input label={t('Address')} value={details.address} onChangeText={setD('address')} multiline />
            <Button label={t('Save changes')} onPress={saveDetails} busy={busy} testID="teacher-save" />
          </>
        )}
      </Sheet>

      <Sheet visible={!!assign} title={t('Assign class')} onClose={() => setAssign(null)} error={formError}>
        {assign && (
          <>
            <Text style={styles.label}>{t('Role')}</Text>
            <View style={styles.chips}>
              <Chip label={t('Class teacher')} active={assign.role === 'class_teacher'}
                onPress={() => setAssign({ ...assign, role: 'class_teacher' })} />
              <Chip label={t('Subject teacher')} active={assign.role === 'subject_teacher'}
                onPress={() => setAssign({ ...assign, role: 'subject_teacher' })} />
            </View>
            {assign.role === 'class_teacher' ? (
              <Text style={styles.hint}>
                {isClassTeacher
                  ? t('This teacher is already a class teacher — remove that first to move them.')
                  : t('A class teacher marks attendance and manages the students of ONE section.')}
              </Text>
            ) : null}
            <Text style={styles.label}>{t('Class')}</Text>
            <View style={styles.chips}>
              {!classes && !formError ? <Text style={styles.hint}>{t('Loading…')}</Text> : null}
              {classes?.map(c => (
                <Chip key={c.id} label={c.name} active={assign.classId === c.id}
                  onPress={() => setAssign({ ...assign, classId: c.id, sectionId: c.sections.length === 1 ? c.sections[0].id : null, subject: '' })} />
              ))}
            </View>
            {pickedClass ? (
              <>
                <Text style={styles.label}>{t('Section')}</Text>
                <View style={styles.chips}>
                  {pickedClass.sections.length === 0 ? <Text style={styles.hint}>{t('This class has no sections yet.')}</Text> : null}
                  {pickedClass.sections.map(sec => (
                    <Chip key={sec.id} label={sec.name} active={assign.sectionId === sec.id}
                      onPress={() => setAssign({ ...assign, sectionId: sec.id })} />
                  ))}
                </View>
              </>
            ) : null}
            {assign.role === 'subject_teacher' && pickedClass ? (
              <>
                {pickedClass.subjects?.length ? (
                  <>
                    <Text style={styles.label}>{t('Subject')}</Text>
                    <View style={styles.chips}>
                      {pickedClass.subjects.map(sub => (
                        <Chip key={sub} label={sub} active={assign.subject === sub} onPress={() => setAssign({ ...assign, subject: sub })} />
                      ))}
                    </View>
                  </>
                ) : null}
                <Input label={pickedClass.subjects?.length ? t('…or type a subject') : t('Subject')} value={assign.subject}
                  onChangeText={v => setAssign({ ...assign, subject: v })} />
              </>
            ) : null}
            <Button label={t('Assign')} onPress={saveAssign} busy={busy} testID="assign-save" />
          </>
        )}
      </Sheet>
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
  photoBtn: { alignSelf: 'flex-start', marginTop: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  link: { fontSize: 13, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  hint: { fontSize: 12, color: colors.subtle, marginBottom: 10 },
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
