// Class Announcements (backend 0018): what the child's teachers posted to
// their class — a heading, a message and maybe a PDF / photo. Same list and
// detail screen as the Notice Board (NoticeList + NoticeDetail kind 'class').
// A push opens this screen with { id } → straight to that announcement.
// Data: GET /student/class-announcements (paged)
import React, { useEffect, useRef } from 'react';
import { useI18n } from '../../hooks';
import type { ScreenProps } from '../../types';
import { NoticeList } from '../Notices';

export default function ClassAnnouncements({ navigate, goBack, params }: ScreenProps) {
  const { t } = useI18n();
  const opened = useRef(false);
  useEffect(() => {
    if (params?.id && !opened.current) {
      opened.current = true;
      navigate('ClassAnnouncementDetail', { id: params.id, kind: 'class' });
    }
  }, [params?.id, navigate]);

  return (
    <NoticeList path="/student/class-announcements" title={t('Class Announcements')}
      emptyText={t('No announcements from your teachers yet.')} icon="account-voice" goBack={goBack}
      showAudience="always"
      countText={n => t(n === 1 ? '{n} announcement' : '{n} announcements', { n })}
      onOpen={n => navigate('ClassAnnouncementDetail', { id: n.id, notice: n, kind: 'class' })} />
  );
}
