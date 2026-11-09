// Syllabus: every subject of the student's class as a box (with how many
// files the teachers shared). Tap → SyllabusSubject (the PDFs / photos,
// opened in the FileViewer; a single file opens straight away).
// Full syllabus (one file for every subject, Nov 2026): a card on top → FullSyllabus
// (a single file opens straight away). Data: GET /student/syllabus (+ /student/syllabus/full)
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { openFile } from '../../components/files';
import { PCard, PortalHeader, SubjectTile } from '../../components/portal';
import { Empty, ErrorBox, Screen, TileGridSkeleton } from '../../components/ui';
import { useApi, useI18n } from '../../hooks';
import { colors } from '../../theme';
import type { SchoolDocument, ScreenProps, SyllabusSubject } from '../../types';

export default function Syllabus({ navigate, goBack }: ScreenProps) {
  const { t } = useI18n();
  const { data, error, loading, refreshing, refresh } = useApi<SyllabusSubject[]>('/student/syllabus');
  const full = useApi<SchoolDocument[]>('/student/syllabus/full');
  const fullDocs = full.data || [];
  const subjects = data || [];
  const openFull = () => {
    const only = fullDocs.length === 1 ? fullDocs[0] : null;
    if (only?.attachment_path) {
      openFile(navigate, { path: only.attachment_path, type: only.attachment_type, name: only.attachment_name || only.title });
    } else {
      navigate('FullSyllabus');
    }
  };
  const open = (s: SyllabusSubject) => {
    const only = s.documents.length === 1 ? s.documents[0] : null;
    if (only?.attachment_path) {
      openFile(navigate, { path: only.attachment_path, type: only.attachment_type, name: only.attachment_name || only.title });
    } else {
      navigate('SyllabusSubject', { subject: s.subject, documents: s.documents });
    }
  };
  return (
    <Screen refreshing={refreshing} onRefresh={() => { refresh(); full.refresh(); }} padded={false}>
      <PortalHeader title={t('Syllabus')} onBack={goBack}
        subtitle={data ? t('{n} subjects available', { n: subjects.length }) : null} />
      <View style={styles.body}>
        <ErrorBox message={error} />
        {fullDocs.length > 0 && (
          <View style={styles.fullWrap}>
            <PCard onPress={openFull} accessibilityLabel={t('Full Syllabus')} style={styles.full}>
              <View style={[styles.fullIcon, { backgroundColor: colors.brand }]}>
                <MCIcon name="book-multiple" size={26} color="#fff" />
              </View>
              <View style={styles.fullText}>
                <Text style={styles.fullTitle}>{t('Full Syllabus')}</Text>
                <Text style={styles.fullSub} numberOfLines={1}>{fullDocs[0].title} · {t('All subjects in one file')}</Text>
              </View>
              <MCIcon name="chevron-right" size={24} color={colors.faint} />
            </PCard>
          </View>
        )}
        {loading ? (
          <TileGridSkeleton count={6} />
        ) : subjects.length === 0 ? (
          <Empty icon="book-education-outline" text={t('No subjects for your class yet.')} />
        ) : (
          <View style={styles.grid}>
            {subjects.map((s, i) => (
              <SubjectTile key={s.subject} name={s.subject} index={i}
                sub={s.documents.length ? t(s.documents.length === 1 ? '{n} file' : '{n} files', { n: s.documents.length })
                  : t('Not shared yet')}
                onPress={() => open(s)} />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 11, paddingTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  fullWrap: { paddingHorizontal: 5, marginBottom: 12 },
  full: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  fullIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  fullText: { flex: 1, marginHorizontal: 12 },
  fullTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  fullSub: { fontSize: 12, color: colors.subtle, marginTop: 2 },
});
