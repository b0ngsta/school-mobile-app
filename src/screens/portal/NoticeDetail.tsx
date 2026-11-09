// One notice: date, posting time, title, the full message and — when the
// school attached one — the file, previewed in place with a Full screen
// button (FileViewer). Params: { id, notice?, kind? } (the list row shows at once).
// Data: GET /student/notices/{id}; kind 'class' = a class teacher's
// announcement, GET /student/class-announcements/{id} (backend 0018).
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Pdf from 'react-native-pdf';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { photoUrl } from '../../api';
import { cacheName, fileKind, openFile } from '../../components/files';
import { PCard, PortalHeader } from '../../components/portal';
import { ErrorBox, Screen } from '../../components/ui';
import { fmtDateTime, fmtDayLong } from '../../format';
import { useApi, useI18n } from '../../hooks';
import { colors } from '../../theme';
import type { Notice, ScreenProps } from '../../types';

export default function NoticeDetail({ params, navigate, goBack }: ScreenProps) {
  const { t } = useI18n();
  const isClass = params?.kind === 'class';
  const base = isClass ? '/student/class-announcements' : '/student/notices';
  const res = useApi<Notice>(params?.id ? `${base}/${params.id}` : null);
  const heading = isClass ? t('Class Announcements') : t('Notice Board');
  const n: Notice | undefined = res.data || params?.notice;
  const kind = n?.attachment_path ? fileKind(n.attachment_path, n.attachment_type) : null;
  const url = n?.attachment_path ? photoUrl(n.attachment_path) : null;
  const cacheFileName = n?.attachment_path ? cacheName(n.attachment_path) : undefined;
  const fullScreen = () =>
    n?.attachment_path && openFile(navigate, { path: n.attachment_path, type: n.attachment_type, name: n.attachment_name });

  return (
    <Screen refreshing={res.refreshing} onRefresh={res.refresh} padded={false}>
      <PortalHeader title={heading} onBack={goBack}>
        {n ? (
          <View>
            <View style={styles.datePill}>
              <MCIcon name="calendar-today" size={18} color="#fff" />
              <Text style={styles.datePillText}>{fmtDayLong(n.created_at)}</Text>
            </View>
            <View style={styles.posted}>
              <MCIcon name="clock-outline" size={16} color={colors.onBrandSub} />
              <Text style={[styles.postedText, { color: colors.onBrandSub }]}>
                {t('Posted: {when}', { when: fmtDateTime(n.created_at) })}
              </Text>
            </View>
            <Text style={styles.title}>{n.title}</Text>
          </View>
        ) : null}
      </PortalHeader>
      <View style={styles.body}>
        <ErrorBox message={res.error} />
        {n ? (
          <>
            <PCard style={styles.pad}>
              <View style={styles.cardHead}>
                <MCIcon name="bullhorn-variant-outline" size={24} color={colors.brand} />
                <Text style={styles.cardTitle}>{t('Message')}</Text>
              </View>
              <Text style={styles.message}>{n.body}</Text>
              {n.posted_by ? <Text style={styles.by}>— {n.posted_by}</Text> : null}
              {n.audience_label && (isClass || n.audience === 'classes') ? (
                <Text style={styles.by}>{t('For {who}', { who: n.audience_label })}</Text>
              ) : null}
            </PCard>
            {kind && url ? (
              <PCard style={styles.pad}>
                <View style={styles.cardHeadSplit}>
                  <MCIcon name={kind === 'pdf' ? 'file-pdf-box' : 'image'} size={26} color={colors.danger} />
                  <Text style={[styles.cardTitle, styles.flex]}>{t('Attachment')}</Text>
                  <TouchableOpacity onPress={fullScreen} style={styles.full} accessibilityRole="button">
                    <MCIcon name="fullscreen" size={22} color={colors.brand} />
                    <Text style={[styles.fullText, { color: colors.brand }]}>{t('Full screen')}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity activeOpacity={0.9} onPress={fullScreen} style={styles.preview}
                  accessibilityRole="button" accessibilityLabel={t('Full screen')}>
                  {kind === 'image' ? (
                    <Image source={{ uri: url }} style={styles.previewFill} resizeMode="contain" accessibilityIgnoresInvertColors />
                  ) : (
                    <View pointerEvents="none" style={styles.previewFill}>
                      <Pdf source={{ uri: url, cache: true, cacheFileName }} style={styles.previewFill} singlePage
                        trustAllCerts={false} />
                    </View>
                  )}
                </TouchableOpacity>
              </PCard>
            ) : null}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  datePillText: { color: '#fff', fontSize: 15, fontWeight: '800', marginLeft: 8 },
  posted: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  postedText: { fontSize: 14.5, marginLeft: 6 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 14, marginBottom: 6 },
  body: { paddingHorizontal: 14, marginTop: 18 },
  pad: { padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  cardHeadSplit: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginLeft: 10 },
  message: { fontSize: 16, color: colors.ink, lineHeight: 23, marginTop: 12 },
  by: { fontSize: 13, color: colors.subtle, marginTop: 10 },
  full: { flexDirection: 'row', alignItems: 'center' },
  fullText: { fontSize: 15, fontWeight: '700', marginLeft: 4 },
  preview: { height: 420, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.page },
  previewFill: { flex: 1 },
});
