// One subject's syllabus files (newest first). Params: { subject, documents }.
import React from 'react';
import { openFile } from '../../components/files';
import { ListHeaderBleed, PortalHeader } from '../../components/portal';
import { Empty, ListScreen } from '../../components/ui';
import { useI18n } from '../../hooks';
import type { SchoolDocument, ScreenProps } from '../../types';
import { DocumentCard } from './TimetableFiles';

export default function SyllabusSubject({ params, navigate, goBack }: ScreenProps) {
  const { t } = useI18n();
  const subject: string = params?.subject || '';
  const docs: SchoolDocument[] = params?.documents || [];
  return (
    <ListScreen
      data={docs}
      keyExtractor={d => d.id}
      header={
        <ListHeaderBleed>
          <PortalHeader title={subject.toUpperCase() || t('Syllabus')} onBack={goBack}
            subtitle={t(docs.length === 1 ? '{n} file' : '{n} files', { n: docs.length })} />
        </ListHeaderBleed>
      }
      empty={<Empty icon="book-education-outline" text={t('The syllabus for this subject is not shared yet.')} />}
      renderItem={d => (
        <DocumentCard doc={d}
          onOpen={() => openFile(navigate, { path: d.attachment_path!, type: d.attachment_type, name: d.attachment_name || d.title })} />
      )}
    />
  );
}
