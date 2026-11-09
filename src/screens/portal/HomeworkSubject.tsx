// One subject's homework, newest first — each with the teacher's sheet
// (PDF / photo, opens FileViewer). Params: { subject }.
// Data: GET /student/homework?subject= (paged)
import React from 'react';
import { ErrorBox, Empty, ListScreen, ListSkeleton } from '../../components/ui';
import { withQuery } from '../../api';
import { ListHeaderBleed, PortalHeader } from '../../components/portal';
import { useI18n, usePagedApi } from '../../hooks';
import type { HomeworkItem, ScreenProps } from '../../types';
import HomeworkCard, { homeworkKey } from './HomeworkCard';

export default function HomeworkSubject({ params, navigate, goBack }: ScreenProps) {
  const { t } = useI18n();
  const subject: string = params?.subject || '';
  const list = usePagedApi<HomeworkItem>(withQuery('/student/homework', { subject }));
  const count = list.total ?? list.items?.length;
  return (
    <ListScreen
      data={list.items}
      keyExtractor={homeworkKey}
      header={
        <>
          <ListHeaderBleed>
            <PortalHeader title={t('Homework List')} onBack={goBack}
              subtitle={`${subject.toUpperCase()}${count != null ? `  •  ${t(count === 1 ? '{n} item' : '{n} items', { n: count })}` : ''}`} />
          </ListHeaderBleed>
          <ErrorBox message={list.error} />
          {!list.items && !list.error ? <ListSkeleton count={2} icon lines={2} /> : null}
        </>
      }
      empty={<Empty icon="clipboard-text-outline" text={t('No homework for this subject yet.')} />}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onEndReached={list.loadMore}
      loadingMore={list.loadingMore}
      renderItem={h => <HomeworkCard h={h} navigate={navigate} showSubject={false} />}
    />
  );
}
