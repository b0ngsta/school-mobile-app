// One exam + one section: every subject's marks in one table (Nov 2026).
// The CLASS teacher of the section (or managers) can download the Excel
// template (students × subjects, saved marks), type the maximum marks (required)
// and upload the filled file — all or nothing; the rows to fix are listed when
// something is wrong. A successful upload publishes the exam's results.
// Data: GET /exams/{id}/results/sheet, GET …/results/template?format=json,
// POST …/results/import (backend services/exam_results_import.py).
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError, api, errorText } from '../../api';
import { XLSX_MIME, pickExcel, saveExcel } from '../../components/excelFile';
import { Badge, Button, Card, Empty, ErrorBox, Input, ListSkeleton, NoticeBox, Screen } from '../../components/ui';
import { useApi } from '../../hooks';
import { t } from '../../i18n';
import { colors } from '../../theme';
import { shortSubject } from '../portal/performance';
import type { ResultsImportReport, ResultsSheet, ScreenProps } from '../../types';

interface FileProblem {
  row: number;
  column?: string;
  message: string;
}

const show = (v: number | string | null | undefined) =>
  v === null || v === undefined ? '—' : typeof v === 'number' ? String(Math.round(v * 100) / 100) : v;

export default function ExamResultsSheet({ params }: ScreenProps) {
  const { examId, sectionId } = params || {};
  const path = `/exams/${examId}/results/sheet?section_id=${sectionId}`;
  const sheet = useApi<ResultsSheet>(path);
  const [busy, setBusy] = useState<'download' | 'upload' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<FileProblem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  /** Required: what every subject in this upload is out of (not in the sheet). */
  const [maxMarks, setMaxMarks] = useState('');
  const data = sheet.data;

  // prefill "out of" with the maximum already in use (same for every subject), else the exam's
  const prefilled = useRef(false);
  useEffect(() => {
    if (!data || prefilled.current) return; // once: a cleared field stays cleared
    prefilled.current = true;
    const maxes = [...new Set(data.subjects.map(s => s.max_marks).filter((m): m is number => m != null))];
    const guess = maxes.length === 1 ? maxes[0] : data.exam.max_marks;
    if (guess != null) setMaxMarks(String(guess));
  }, [data]);

  const download = async () => {
    setBusy('download');
    setError(null);
    setNotice(null);
    try {
      const file = await api<{ filename: string; content_base64: string }>(
        `/exams/${examId}/results/template?section_id=${sectionId}&format=json`);
      const where = await saveExcel(file.filename, file.content_base64);
      setNotice(where === 'downloads'
        ? t('Saved {name} in Downloads. Fill it in with Excel or Google Sheets and upload it here.', { name: file.filename })
        : t('Template opened. Fill it in, save it as .xlsx and upload it here.'));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const upload = async () => {
    setError(null);
    setNotice(null);
    setProblems([]);
    const max = Number(maxMarks);
    if (!maxMarks.trim() || !(max > 0)) {
      setError(t('Enter the maximum marks (out of) for this exam, e.g. 50 or 100'));
      return;
    }
    try {
      const file = await pickExcel();
      if (!file) return;
      setBusy('upload');
      const fd = new FormData();
      fd.append('section_id', String(sectionId));
      fd.append('max_marks', String(max));
      fd.append('file', { uri: file.uri, name: file.name || 'results.xlsx', type: XLSX_MIME } as unknown as Blob);
      const report = await api<ResultsImportReport>(`/exams/${examId}/results/import`, { method: 'POST', formData: fd });
      setNotice(t('Saved ✓ {marks} marks for {students} students', { marks: report.marks, students: report.students })
        + (report.absent ? ` · ${t('{n} absent', { n: report.absent })}` : '')
        + ` · ${t('published to parents')}`);
      sheet.refresh();
    } catch (e) {
      setError(errorText(e));
      setProblems(e instanceof ApiError && e.errors ? (e.errors as FileProblem[]) : []);
    } finally {
      setBusy(null);
    }
  };

  if (sheet.loading) {
    return (
      <Screen>
        <ListSkeleton lines={2} count={4} />
      </Screen>
    );
  }
  if (sheet.error && !data) {
    return (
      <Screen>
        <ErrorBox message={sheet.error} />
      </Screen>
    );
  }
  if (!data) return null;
  const subjects = data.subjects;

  return (
    <Screen refreshing={sheet.refreshing} onRefresh={sheet.refresh}>
      <View style={[styles.hero, { backgroundColor: colors.brand }]}>
        <Text style={styles.heroTitle}>{data.exam.name}</Text>
        <Text style={styles.heroSub}>
          {[data.section.class_name, data.section.section_name].filter(Boolean).join(' · ')} ·{' '}
          {t('{n} students', { n: data.students.length })} · {t('{n} subjects', { n: subjects.length })}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <Badge status={data.exam.results_published ? 'completed' : 'pending'}
            label={data.exam.results_published ? t('Results published') : t('Results not published')} />
        </View>
      </View>

      {data.can_import ? (
        <Card>
          <Text style={styles.cardTitle}>📗 {t('Upload results with Excel')}</Text>
          <Text style={styles.help}>
            {t('1. Download the Excel template — one column per subject.')}{'\n'}
            {t('2. Fill in marks (AB = absent, leave empty to keep a mark as it is).')}{'\n'}
            {t('3. Enter the maximum marks below and upload the file. If any cell is wrong nothing is saved and the rows to fix are shown.')}{'\n'}
            {t('Uploaded results are published to parents straight away.')}
          </Text>
          <Input label={t('Maximum marks per subject *')} value={maxMarks} onChangeText={setMaxMarks}
            keyboardType="decimal-pad" placeholder={t('e.g. 50')} testID="results-max" />
          <View style={styles.actions}>
            <Button label={`⬇️ ${t('Template')}`} kind="soft" onPress={download} busy={busy === 'download'}
              disabled={busy !== null} style={{ flex: 1 }} testID="results-template" />
            <View style={{ width: 8 }} />
            <Button label={`⬆️ ${t('Upload Excel')}`} onPress={upload} busy={busy === 'upload'}
              disabled={busy !== null} style={{ flex: 1 }} testID="results-upload" />
          </View>
        </Card>
      ) : (
        <NoticeBox message={t('Only the class teacher of this section can upload marks from Excel.')} />
      )}

      <ErrorBox message={error || (data ? sheet.error : null)} />
      {problems.length > 1 && (
        <Card style={{ borderColor: colors.danger, borderWidth: StyleSheet.hairlineWidth }}>
          {problems.slice(0, 15).map((p, i) => (
            <Text key={i} style={styles.problem}>
              • {t('Row {n}', { n: p.row })}{p.column ? ` · ${p.column}` : ''}: {p.message}
            </Text>
          ))}
          {problems.length > 15 && <Text style={styles.problem}>… {t('{n} more', { n: problems.length - 15 })}</Text>}
        </Card>
      )}
      <NoticeBox message={notice} tone="ok" />

      {subjects.length === 0 ? (
        <Empty icon="📘" text={t('This class has no subjects yet.')} />
      ) : data.students.length === 0 ? (
        <Empty icon="🧑‍🎓" text={t('No students in this section.')} />
      ) : (
        <Card style={{ paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View testID="results-table">
              <View style={[styles.tr, styles.th, { backgroundColor: colors.brandSoft }]}>
                <Text style={[styles.cell, styles.nameCell, styles.thText, { textAlign: 'left' }]}>{t('Student')}</Text>
                {subjects.map(s => (
                  <Text key={s.name} style={[styles.cell, styles.thText]} numberOfLines={2} accessibilityLabel={s.name}>
                    {shortSubject(s.name)}{s.max_marks ? `\n/${show(s.max_marks)}` : ''}
                  </Text>
                ))}
                <Text style={[styles.cell, styles.thText]}>{t('Total')}</Text>
                <Text style={[styles.cell, styles.thText]}>%</Text>
              </View>
              {data.students.map((st, i) => (
                <View key={st.student_id} style={[styles.tr, i % 2 === 1 && { backgroundColor: colors.page }]}>
                  <View style={[styles.cell, styles.nameCell]}>
                    <Text style={styles.name} numberOfLines={1}>{st.full_name}</Text>
                    <Text style={styles.roll}>{st.roll_no ? t('Roll {n}', { n: st.roll_no }) : ''}</Text>
                  </View>
                  {subjects.map(s => {
                    const v = st.marks[s.name];
                    return (
                      <Text key={s.name} style={[styles.cell, styles.td, v === 'AB' && { color: colors.warn, fontWeight: '800' }]}>
                        {show(v)}
                      </Text>
                    );
                  })}
                  <Text style={[styles.cell, styles.td, styles.bold]}>
                    {st.total == null ? '—' : `${show(st.total)}/${show(st.max_total)}`}
                  </Text>
                  <Text style={[styles.cell, styles.td, styles.bold, { color: colors.brand }]}>{show(st.percentage)}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 20, padding: 18, marginBottom: 14 },
  heroTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  help: { fontSize: 12.5, color: colors.subtle, marginTop: 6, lineHeight: 19 },
  actions: { flexDirection: 'row', marginTop: 12 },
  problem: { fontSize: 12.5, color: colors.danger, marginVertical: 2 },
  tr: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  th: { paddingVertical: 4 },
  thText: { fontSize: 11.5, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  cell: { width: 74, paddingHorizontal: 6, paddingVertical: 9 },
  nameCell: { width: 140 },
  td: { fontSize: 13, color: colors.ink, textAlign: 'center' },
  bold: { fontWeight: '800' },
  name: { fontSize: 13, fontWeight: '700', color: colors.ink },
  roll: { fontSize: 11, color: colors.subtle, marginTop: 1 },
});
