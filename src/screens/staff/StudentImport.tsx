// Add / update students from Excel (Nov 2026; the same import as the web
// app's "Import from Excel"). For the CLASS teacher of a section and managers
// (admin, principal, sub admin, coordinator) — the server checks it too.
//   1. ⬇️ Template (empty sheet) or the current students (to edit) →
//      GET /imports/users/template|export?user_type=student…&format=json →
//      saved to Downloads and opened in a spreadsheet app (excelFile.ts)
//   2. ⬆️ Choose the filled .xlsx → POST /imports/users dry_run=true → preview:
//      new / updated / unchanged / problem rows (nothing saved yet)
//   3. Save → the same file again with dry_run=false. Rows with problems are
//      skipped; fix them and upload again (saved rows then show as unchanged).
// Params: { classId, sectionId, className, sectionName } (from SectionStudents);
// without them the screen asks for the section (managers: any; teachers: the
// one they are class teacher of).
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, errorText } from '../../api';
import { XLSX_MIME, pickExcel, saveExcel } from '../../components/excelFile';
import { Button, Card, Chip, Empty, ErrorBox, NoticeBox, Screen } from '../../components/ui';
import { MANAGER_ROLES } from '../../roles';
import { colors } from '../../theme';
import type { AdminClass, Assignment, PickedDocument, ScreenProps } from '../../types';
import { t } from '../../i18n';

type Pick = { classId: number; sectionId: number; className: string; sectionName: string };

interface ImportRow {
  row: number;
  username?: string | null;
  full_name?: string | null;
  action: 'create' | 'update' | 'unchanged' | 'error';
  changes: string[];
  errors: string[];
  warnings: string[];
}
export interface ImportReport {
  dry_run: boolean;
  saved: boolean;
  summary: { rows: number; create: number; update: number; unchanged: number; error: number; warnings: number };
  warnings: string[];
  rows: ImportRow[];
}

const ACTION_TONE: Record<ImportRow['action'], { label: string; fg: () => string; bg: () => string }> = {
  create: { label: 'New', fg: () => colors.ok, bg: () => colors.okSoft },
  update: { label: 'Update', fg: () => colors.info, bg: () => colors.infoSoft },
  unchanged: { label: 'No change', fg: () => colors.subtle, bg: () => colors.page },
  error: { label: 'Problem', fg: () => colors.danger, bg: () => colors.dangerSoft },
};

export default function StudentImport({ params, session }: ScreenProps) {
  const isManager = MANAGER_ROLES.includes(session.user_type);
  const given: Pick | null = params?.sectionId
    ? { classId: params.classId, sectionId: params.sectionId, className: params.className, sectionName: params.sectionName }
    : null;
  const [choices, setChoices] = useState<Pick[] | null>(given ? [given] : null);
  const [sel, setSel] = useState<Pick | null>(given);
  const [file, setFile] = useState<PickedDocument | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState<null | 'template' | 'export' | 'preview' | 'save'>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // no section given → the sections this account may import into
  useEffect(() => {
    if (given) return;
    (async () => {
      try {
        let out: Pick[];
        if (isManager) {
          const classes = await api<AdminClass[]>('/classes');
          out = classes.flatMap(c => c.sections.map(s => ({ classId: c.id, sectionId: s.id, className: c.name, sectionName: s.name })));
        } else {
          const mine = await api<Assignment[]>('/assignments/mine');
          out = mine.filter(a => a.role === 'class_teacher')
            .map(a => ({ classId: a.class_id, sectionId: a.section_id, className: a.class_name, sectionName: a.section_name }));
        }
        setChoices(out);
        if (out.length === 1) setSel(out[0]);
      } catch (e) {
        setError(errorText(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager]);

  const choose = (p: Pick) => {
    setSel(p);
    setFile(null);
    setReport(null);
    setNotice(null);
    setError(null);
  };

  const download = async (kind: 'template' | 'export') => {
    if (!sel) return;
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      const path = kind === 'template'
        ? '/imports/users/template?user_type=student&format=json'
        : `/imports/users/export?user_type=student&class_id=${sel.classId}&section_id=${sel.sectionId}&format=json`;
      const f = await api<{ filename: string; content_base64: string }>(path);
      const where = await saveExcel(f.filename, f.content_base64);
      setNotice(where === 'downloads'
        ? t('Saved {name} in Downloads. Fill it in with Excel or Google Sheets and upload it here.', { name: f.filename })
        : t('Template opened. Fill it in, save it as .xlsx and upload it here.'));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const send = async (picked: PickedDocument, dryRun: boolean): Promise<ImportReport> => {
    const fd = new FormData();
    fd.append('user_type', 'student');
    fd.append('class_id', String(sel!.classId));
    fd.append('section_id', String(sel!.sectionId));
    fd.append('dry_run', dryRun ? 'true' : 'false');
    fd.append('file', { uri: picked.uri, name: picked.name || 'students.xlsx', type: XLSX_MIME } as unknown as Blob);
    return api<ImportReport>('/imports/users', { method: 'POST', formData: fd });
  };

  const preview = async () => {
    if (!sel) return;
    setError(null);
    setNotice(null);
    try {
      const picked = await pickExcel();
      if (!picked) return;
      setBusy('preview');
      setFile(picked);
      setReport(await send(picked, true));
    } catch (e) {
      setReport(null);
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!file || !sel) return;
    setBusy('save');
    setError(null);
    try {
      const r = await send(file, false);
      setReport(r);
      setNotice(t('Saved ✓ {created} new · {updated} updated', { created: r.summary.create, updated: r.summary.update })
        + (r.summary.error ? ` · ${t('{n} rows skipped (problems)', { n: r.summary.error })}` : ''));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const toSave = report ? report.summary.create + report.summary.update : 0;
  const rows = useMemo(
    () => (report ? [...report.rows].sort((a, b) => Number(b.action === 'error') - Number(a.action === 'error') || a.row - b.row) : []),
    [report],
  );

  return (
    <Screen>
      <ErrorBox message={error} />
      <NoticeBox message={notice} tone="ok" />

      {!given && (
        <>
          <Text style={styles.label}>{t('Section')}</Text>
          {choices?.length === 0 ? (
            <Empty icon="google-classroom"
              text={isManager ? t('No sections yet — add classes first.') : t('Only the class teacher of a section can add students to it.')} />
          ) : null}
          <View style={styles.chips}>
            {choices?.map(c => (
              <Chip key={c.sectionId} label={`${c.className} — ${c.sectionName}`} active={sel?.sectionId === c.sectionId}
                onPress={() => choose(c)} />
            ))}
          </View>
        </>
      )}

      {sel && (
        <>
          <Card>
            <Text style={styles.title}>{sel.className} — {t('Section {name}', { name: sel.sectionName })}</Text>
            <Text style={styles.step}>{t('1. Download the Excel template (or the current students to edit them).')}</Text>
            <View style={styles.row}>
              <Button label={t('Template')} icon="download" kind="soft" small busy={busy === 'template'}
                onPress={() => download('template')} style={styles.flex} testID="import-template" />
              <View style={{ width: 8 }} />
              <Button label={t('Current students')} icon="account-arrow-down-outline" kind="ghost" small busy={busy === 'export'}
                onPress={() => download('export')} style={styles.flex} testID="import-export" />
            </View>
            <Text style={styles.step}>{t('2. One row per student. A known username updates that student; a new one adds them. Empty cells keep what is saved.')}</Text>
            <Text style={styles.step}>{t('3. Choose the filled .xlsx file — you see a preview first, nothing is saved yet.')}</Text>
            <Button label={file ? t('Choose another file') : t('Choose Excel file')} icon="upload" busy={busy === 'preview'}
              onPress={preview} testID="import-pick" />
          </Card>

          {report && (
            <>
              <Card>
                <Text style={styles.title}>
                  {report.saved ? t('Saved') : t('Preview')}{file?.name ? ` · ${file.name}` : ''}
                </Text>
                <View style={styles.counts}>
                  {(['create', 'update', 'unchanged', 'error'] as const).map(k => (
                    <View key={k} style={[styles.count, { backgroundColor: ACTION_TONE[k].bg() }]}>
                      <Text style={[styles.countNum, { color: ACTION_TONE[k].fg() }]}>{report.summary[k]}</Text>
                      <Text style={[styles.countLabel, { color: ACTION_TONE[k].fg() }]}>{t(ACTION_TONE[k].label)}</Text>
                    </View>
                  ))}
                </View>
                {report.warnings.map(w => <Text key={w} style={[styles.small, { color: colors.warn }]}>⚠ {w}</Text>)}
                {!report.saved && toSave > 0 ? (
                  <Button label={t('Save {n} students', { n: toSave })} icon="content-save-outline" busy={busy === 'save'}
                    onPress={save} style={{ marginTop: 10 }} testID="import-save" />
                ) : null}
                {!report.saved && toSave === 0 ? (
                  <Text style={styles.small}>{t('Nothing to save — fix the rows with problems and choose the file again.')}</Text>
                ) : null}
              </Card>

              {rows.map(r => (
                <Card key={r.row}>
                  <View style={styles.rowHead}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {t('Row {n}', { n: r.row })} · {r.full_name || r.username || '—'}
                    </Text>
                    <View style={[styles.pill, { backgroundColor: ACTION_TONE[r.action].bg() }]}>
                      <Text style={{ color: ACTION_TONE[r.action].fg(), fontSize: 11.5, fontWeight: '700' }}>{t(ACTION_TONE[r.action].label)}</Text>
                    </View>
                  </View>
                  {r.username ? <Text style={styles.small}>@{r.username}</Text> : null}
                  {r.errors.map(m => <Text key={m} style={[styles.small, { color: colors.danger }]}>• {m}</Text>)}
                  {r.warnings.map(m => <Text key={m} style={[styles.small, { color: colors.warn }]}>• {m}</Text>)}
                  {r.action === 'update' && r.changes.length ? (
                    <Text style={styles.small}>{t('Changes: {list}', { list: r.changes.join(', ') })}</Text>
                  ) : null}
                </Card>
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  title: { fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  step: { fontSize: 12.5, color: colors.subtle, marginVertical: 6, lineHeight: 18 },
  row: { flexDirection: 'row', marginBottom: 4 },
  flex: { flex: 1 },
  counts: { flexDirection: 'row', marginTop: 4, marginBottom: 4 },
  count: { flex: 1, borderRadius: 12, paddingVertical: 8, alignItems: 'center', marginHorizontal: 3 },
  countNum: { fontSize: 18, fontWeight: '800' },
  countLabel: { fontSize: 11, fontWeight: '700' },
  small: { fontSize: 12, color: colors.subtle, marginTop: 3 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.ink, paddingRight: 8 },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
});
