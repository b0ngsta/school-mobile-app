// Subject-wise question papers for one exam + class.
// Upload/replace (PDF via @react-native-documents/picker) for admin/sub_admin/coordinator/
// principal; teachers see upload status.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import { api, errorText, peek } from '../../api';
import {
  Button,
  Card,
  Empty,
  ErrorBox,
  HeroSkeleton,
  ListSkeleton,
  Screen,
  ScreenSkeleton,
  fmtDate,
} from '../../components/ui';
import { colors } from '../../theme';
import type { ExamPaper, ExamPapersResponse, PickedDocument, ScreenProps } from '../../types';
import { t } from '../../i18n';

const PAPER_MANAGERS = ['admin', 'sub_admin', 'coordinator', 'principal'];

export async function pickPdf(): Promise<PickedDocument | null> {
  try {
    // pick() always resolves to a non-empty array; we only allow one file.
    const [file] = await pick({ type: [types.pdf], allowMultiSelection: false });
    // Some Android file providers ignore the type filter — reject non-PDFs here.
    if (!file.hasRequestedType) throw new Error(t('Please pick a PDF file.'));
    return { uri: file.uri, name: file.name, type: file.type }; // content:// uri works with FormData
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return null;
    throw e;
  }
}

export default function ExamPapers({ params, session }: ScreenProps) {
  const { examId, classId, className } = params || {};
  const canUpload = PAPER_MANAGERS.includes(session.user_type);
  const [data, setData] = useState<ExamPapersResponse | null>(() => peek<ExamPapersResponse>(`/exams/${examId}/classes/${classId}/papers`));
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busySubject, setBusySubject] = useState<string | null>(null);

  const load = useCallback(async (r = false) => {
    r && setRefreshing(true);
    try {
      setData(await api(`/exams/${examId}/classes/${classId}/papers`));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRefreshing(false);
    }
  }, [examId, classId]);
  useEffect(() => {
    load();
  }, [load]);

  const upload = async (subject: string) => {
    try {
      const file = await pickPdf();
      if (!file) return;
      setBusySubject(subject);
      const fd = new FormData();
      fd.append('subject', subject);
      fd.append('file', {
        uri: file.uri,
        name: file.name || 'paper.pdf',
        type: file.type || 'application/pdf',
      } as unknown as Blob);
      await api(`/exams/${examId}/classes/${classId}/papers`, { method: 'POST', formData: fd });
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusySubject(null);
    }
  };

  const removePaper = (paper: ExamPaper) =>
    Alert.alert(t('Delete question paper?'), `${paper.subject} · ${paper.paper_name}`, [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: async () => {
          setBusySubject(paper.subject);
          try {
            await api(`/exams/${examId}/papers/${paper.id}`, { method: 'DELETE' });
            load();
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusySubject(null);
          }
        },
      },
    ]);

  if (!data && !error) {
    return (
      <ScreenSkeleton>
        <HeroSkeleton />
        <ListSkeleton icon lines={2} action count={3} />
      </ScreenSkeleton>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => load(true)}>
      <ErrorBox message={error} />
      {data && (
        <>
          <View style={[styles.hero, { backgroundColor: colors.brand }]}>
            <Text style={styles.heroTitle}>{data.class?.name || className}</Text>
            <Text style={styles.heroSub}>
              {data.exam?.name} · {t('one question paper per subject')}
            </Text>
          </View>

          {data.subjects.length === 0 && (
            <Empty
              icon="📚"
              text={t('This class has no subjects yet — add them from the Classes screen.')}
            />
          )}
          {data.subjects.map(({ subject, paper }) => (
            <Card key={subject}>
              <View style={styles.head}>
                <View style={[styles.subjBubble, { backgroundColor: colors.brandSoft }]}>
                  <Text style={{ fontSize: 15 }}>📘</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.subject}>{subject}</Text>
                  {paper ? (
                    <Text style={styles.meta} numberOfLines={1}>
                      📄 {paper.paper_name}
                    </Text>
                  ) : (
                    <Text style={[styles.meta, { color: colors.warn }]}>{t('Not uploaded yet')}</Text>
                  )}
                  {paper ? (
                    <Text style={styles.meta}>
                      {t('by {name}', { name: paper.uploaded_by_name })} · {fmtDate(paper.created_at)}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.statusDot, { backgroundColor: paper ? colors.ok : colors.warn }]} />
              </View>
              {canUpload && (
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  <Button
                    label={paper ? t('Replace PDF') : `⬆️ ${t('Upload PDF')}`}
                    kind={paper ? 'soft' : 'primary'}
                    small
                    busy={busySubject === subject}
                    onPress={() => upload(subject)}
                    style={{ flex: 1, marginRight: paper ? 8 : 0 }}
                  />
                  {paper && (
                    <Button label={t('Delete')} kind="danger" small onPress={() => removePaper(paper)} style={{ flex: 1 }} />
                  )}
                </View>
              )}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 20, padding: 18, marginBottom: 14 },
  heroTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  head: { flexDirection: 'row', alignItems: 'center' },
  subjBubble: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  subject: { fontSize: 15, fontWeight: '800', color: colors.ink },
  meta: { fontSize: 11.5, color: colors.subtle, marginTop: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
});
