// Full Syllabus (Nov 2026): the class's whole syllabus shared by a teacher
// as ONE file (a syllabus document without a subject). The home shows this
// launcher only when the class has one (dashboard `full_syllabus` > 0); the
// Syllabus screen also links here. Data: GET /student/syllabus/full.
import React from 'react';
import { openFile } from '../../components/files';
import { ListHeaderBleed, PortalHeader } from '../../components/portal';
import { Empty, ErrorBox, ListScreen } from '../../components/ui';
import { useApi, useI18n } from '../../hooks';
import type { SchoolDocument, ScreenProps } from '../../types';
import { DocumentCard } from './TimetableFiles';

export default function FullSyllabus({ navigate, goBack }: ScreenProps) {
  const { t } = useI18n();
  const { data, error, loading, refreshing, refresh } = useApi<SchoolDocument[]>('/student/syllabus/full');
  const docs = data || [];
  return (
    <ListScreen
      data={docs}
      keyExtractor={d => d.id}
      refreshing={refreshing}
      onRefresh={refresh}
      header={
        <>
          <ListHeaderBleed>
            <PortalHeader title={t('Full Syllabus')} onBack={goBack}
              subtitle={data ? t('All subjects in one file') : null} />
          </ListHeaderBleed>
          <ErrorBox message={error} />
        </>
      }
      empty={loading ? null : <Empty icon="book-multiple" text={t('The full syllabus is not shared yet.')} />}
      renderItem={d => (
        <DocumentCard doc={d}
          onOpen={() => openFile(navigate, { path: d.attachment_path!, type: d.attachment_type, name: d.attachment_name || d.title })} />
      )}
    />
  );
}
