// Exam detail: the classes this exam applies to. Tap a class → upload/view
// its subject-wise question papers. Managers can publish/unpublish results.
// "Results" (Nov 2026): one row per section → ExamResultsSheet (every
// subject's marks; the class teacher uploads them from an Excel sheet).
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api, errorText } from '../../api';
import {
  Badge,
  Bone,
  Button,
  Card,
  Empty,
  ErrorBox,
  HeroSkeleton,
  ListSkeleton,
  Screen,
  ScreenSkeleton,
  SectionTitle,
  SectionTitleSkeleton,
  fmtDate,
} from '../../components/ui';
import { MANAGER_ROLES } from '../../roles';
import { colors } from '../../theme';
import type { AdminExam, Assignment, ScreenProps } from '../../types';
import { useApi } from '../../hooks';
import { t } from '../../i18n';

export default function StaffExamDetail({ navigate, params, session }: ScreenProps) {
  const { examId } = params || {};
  const isManager = MANAGER_ROLES.includes(session.user_type);
  const [exam, setExam] = useState<AdminExam | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const mine = useApi<Assignment[]>(isManager ? null : '/assignments/mine');

  const load = useCallback(async (r = false) => {
    r && setRefreshing(true);
    try {
      setExam(await api(`/exams/${examId}`));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRefreshing(false);
    }
  }, [examId]);
  useEffect(() => {
    load();
  }, [load]);

  const togglePublish = async () => {
    if (!exam) return;
    setBusy(true);
    try {
      await api(`/exams/${examId}`, {
        method: 'PUT',
        body: { results_published: !exam.results_published },
      });
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!exam && !error) {
    return (
      <ScreenSkeleton>
        <HeroSkeleton lines={2} />
        <Bone height={44} radius={14} style={{ marginBottom: 12 }} />
        <SectionTitleSkeleton width={200} />
        <ListSkeleton icon badge="right" lines={1} count={3} />
      </ScreenSkeleton>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => load(true)}>
      <ErrorBox message={error} />
      {exam && (
        <>
          <View style={[styles.hero, { backgroundColor: colors.brand }]}>
            <Text style={styles.heroTitle}>{exam.name}</Text>
            <Text style={styles.heroSub}>
              {exam.class_name || t('All classes')} · {fmtDate(exam.start_date)} – {fmtDate(exam.end_date)}
            </Text>
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <Badge status={exam.status} />
              <View style={{ width: 8 }} />
              <Badge
                status={exam.results_published ? 'completed' : 'pending'}
                label={exam.results_published ? t('Results published') : t('Results not published')}
              />
            </View>
          </View>

          {isManager && (
            <Button
              label={exam.results_published ? t('Unpublish results') : `📢 ${t('Publish results')}`}
              kind="soft"
              onPress={togglePublish}
              busy={busy}
              style={{ marginBottom: 12 }}
            />
          )}

          {(() => {
            const sections = (exam.sections || []).filter(
              sec => isManager || (mine.data || []).some(a => a.section_id === sec.id));
            if (!sections.length) return null;
            return (
              <>
                <SectionTitle>{t('Results — tap a section')}</SectionTitle>
                {sections.map(sec => {
                  const classTeacher = (mine.data || []).some(a => a.section_id === sec.id && a.role === 'class_teacher');
                  return (
                    <TouchableOpacity key={`sec-${sec.id}`} activeOpacity={0.7} testID={`exam-section-${sec.id}`}
                      onPress={() => navigate('ExamResultsSheet', {
                        examId, sectionId: sec.id, title: `${sec.class_name} ${sec.name} · ${t('Results')}`,
                      })}>
                      <Card style={styles.classRow}>
                        <View style={[styles.iconBubble, { backgroundColor: colors.okSoft }]}>
                          <Text style={{ fontSize: 17 }}>📊</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.className}>{sec.class_name} · {t('Section {name}', { name: sec.name })}</Text>
                          <Text style={styles.classSub}>
                            🧑‍🎓 {t('{n} students', { n: sec.student_count })}
                            {isManager || classTeacher ? ` · ⬆️ ${t('Excel upload')}` : ''}
                          </Text>
                        </View>
                        <Text style={{ color: colors.faint, fontSize: 20 }}>›</Text>
                      </Card>
                    </TouchableOpacity>
                  );
                })}
              </>
            );
          })()}

          <SectionTitle>{t('Classes — tap to manage subject papers')}</SectionTitle>
          {exam.classes?.length === 0 && <Empty icon="🏫" text={t('No classes yet.')} />}
          {exam.classes?.map(c => {
            const done = c.subject_count > 0 && c.paper_count >= c.subject_count;
            return (
              <TouchableOpacity
                key={c.id}
                activeOpacity={0.7}
                onPress={() =>
                  navigate('ExamPapers', {
                    examId,
                    classId: c.id,
                    className: c.name,
                    title: `${exam.name} · ${c.name}`,
                  })
                }>
                <Card style={styles.classRow}>
                  <View style={[styles.iconBubble, { backgroundColor: colors.brandSoft }]}>
                    <Text style={{ fontSize: 17 }}>🏫</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.className}>{c.name}</Text>
                    <Text style={styles.classSub}>
                      🧑‍🎓 {t('{n} students', { n: c.student_count })} · 📘 {t('{n} subjects', { n: c.subject_count })}
                    </Text>
                  </View>
                  <View style={[styles.paperPill, { backgroundColor: done ? colors.okSoft : colors.warnSoft }]}>
                    <Text style={{ color: done ? colors.ok : colors.warn, fontWeight: '800', fontSize: 12 }}>
                      {c.paper_count}/{c.subject_count} 📄
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 20, padding: 18, marginBottom: 14 },
  heroTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  classRow: { flexDirection: 'row', alignItems: 'center' },
  iconBubble: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  className: { fontSize: 15, fontWeight: '800', color: colors.ink },
  classSub: { fontSize: 12, color: colors.subtle, marginTop: 2 },
  paperPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
});
