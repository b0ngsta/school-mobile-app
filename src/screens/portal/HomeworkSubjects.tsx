// Homework → By Subject: every subject of the student's class as a box,
// with the day the latest homework was given. Tap → HomeworkSubject.
// Data: GET /student/homework/subjects
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PortalHeader, SubjectTile } from '../../components/portal';
import { Empty, ErrorBox, Screen, TileGridSkeleton } from '../../components/ui';
import { fmtDate } from '../../format';
import { useApi, useI18n } from '../../hooks';
import type { HomeworkSubject, ScreenProps } from '../../types';

export default function HomeworkSubjects({ navigate, goBack }: ScreenProps) {
  const { t } = useI18n();
  const { data, error, loading, refreshing, refresh } = useApi<HomeworkSubject[]>('/student/homework/subjects');
  const subjects = data || [];
  return (
    <Screen refreshing={refreshing} onRefresh={refresh} padded={false}>
      <PortalHeader title={t('Select Subject')} onBack={goBack}
        subtitle={data ? t('{n} subjects available', { n: subjects.length }) : null} />
      <View style={styles.body}>
        <ErrorBox message={error} />
        {loading ? (
          <TileGridSkeleton count={6} />
        ) : subjects.length === 0 ? (
          <Empty icon="book-open-variant" text={t('No subjects for your class yet.')} />
        ) : (
          <View style={styles.grid}>
            {subjects.map((s, i) => (
              <SubjectTile key={s.subject} name={s.subject} index={i}
                sub={s.last_given ? fmtDate(s.last_given) : t('No homework yet')}
                onPress={() => navigate('HomeworkSubject', { subject: s.subject })} />
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
});
