// One message: who it was sent to and when, the text, the attached file
// (FileViewer) and the sender. Opening it marks it read on the server.
// Params: { id, message? } (the list row shows at once).
// Data: GET /student/messages/{id}
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { peek, photoUrl } from '../../api';
import { openFile } from '../../components/files';
import { AttachmentRow, PCard, PortalHeader } from '../../components/portal';
import { Avatar, ErrorBox, Screen } from '../../components/ui';
import { fmtDate, fmtTime } from '../../format';
import { useApi, useI18n } from '../../hooks';
import { colors } from '../../theme';
import { ROLE_LABELS } from '../../theme';
import type { ScreenProps, StudentDashboard, StudentMessage } from '../../types';

export default function MessageDetail({ params, navigate, goBack, session }: ScreenProps) {
  const { t } = useI18n();
  const res = useApi<StudentMessage>(params?.id ? `/student/messages/${params.id}` : null);
  const m: StudentMessage | undefined = res.data || params?.message;
  const me = peek<StudentDashboard>('/student/dashboard')?.profile;

  return (
    <Screen refreshing={res.refreshing} onRefresh={res.refresh} padded={false}>
      <PortalHeader title={t('Message Details')} onBack={goBack}>
        {m ? <Text style={styles.headTitle}>{m.title}</Text> : null}
      </PortalHeader>
      <View style={styles.body}>
        <ErrorBox message={res.error} />
        {m ? (
          <>
            <PCard style={styles.toCard}>
              <Avatar name={session.full_name} uri={photoUrl(me?.photo_path)} size={64} />
              <View style={styles.toText}>
                <Text style={styles.toLabel}>{t('Sent to')}</Text>
                <Text style={styles.toName}>{(session.full_name || '').toUpperCase()}</Text>
              </View>
              <View style={styles.when}>
                <Text style={styles.whenDate}>{fmtDate(m.created_at)}</Text>
                <Text style={styles.whenTime}>{fmtTime(m.created_at)}</Text>
              </View>
            </PCard>
            <PCard>
              <View style={styles.pad}>
                <View style={styles.cardHead}>
                  <MCIcon name="message" size={24} color={colors.brand} />
                  <Text style={styles.cardTitle}>{t('Message')}</Text>
                </View>
                <Text style={styles.message}>{m.body}</Text>
                {m.sender_name ? (
                  <Text style={styles.from}>
                    {t('From: {name}', { name: m.sender_name })}
                    {m.sender_role && ROLE_LABELS[m.sender_role] ? ` · ${t(ROLE_LABELS[m.sender_role])}` : ''}
                  </Text>
                ) : null}
              </View>
              {m.attachment_path ? (
                <AttachmentRow path={m.attachment_path} name={m.attachment_name} type={m.attachment_type}
                  onPress={() => openFile(navigate, { path: m.attachment_path!, type: m.attachment_type, name: m.attachment_name })} />
              ) : null}
            </PCard>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 6 },
  body: { paddingHorizontal: 14, marginTop: 18 },
  toCard: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  toText: { flex: 1, marginLeft: 14 },
  toLabel: { fontSize: 13, color: colors.subtle },
  toName: { fontSize: 19, fontWeight: '800', color: colors.ink, marginTop: 2 },
  when: { alignItems: 'flex-end' },
  whenDate: { fontSize: 14, fontWeight: '700', color: colors.ink },
  whenTime: { fontSize: 13, color: colors.subtle, marginTop: 2 },
  pad: { padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginLeft: 10 },
  message: { fontSize: 16, color: colors.ink, lineHeight: 23, marginTop: 12 },
  from: { fontSize: 13, color: colors.subtle, marginTop: 12 },
});
