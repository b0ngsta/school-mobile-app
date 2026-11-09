// One homework entry (date view and subject view): title, the day it was
// given, subject, note, status, and the attached sheet (opens FileViewer).
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { openFile } from '../../components/files';
import { AttachmentRow, PCard } from '../../components/portal';
import { Badge } from '../../components/ui';
import { fmtDate } from '../../format';
import { t } from '../../i18n';
import { colors } from '../../theme';
import type { HomeworkItem, NavigateFn } from '../../types';

export const homeworkKey = (h: HomeworkItem) => `${h.scope || 'student'}-${h.id}`;

export default memo(function HomeworkCard({ h, navigate, showSubject = true }: {
  h: HomeworkItem;
  navigate: NavigateFn;
  showSubject?: boolean;
}) {
  return (
    <PCard>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: colors.brandSoft }]}>
          <MCIcon name="clipboard-text" size={26} color={colors.brand} />
        </View>
        <View style={styles.head}>
          <Text style={styles.title}>{h.title}</Text>
          <View style={styles.dateRow}>
            <MCIcon name="calendar-today" size={15} color={colors.subtle} />
            <Text style={styles.date}>{fmtDate(h.created_at || h.due_date)}</Text>
          </View>
        </View>
      </View>
      <View style={styles.bodyPad}>
        {showSubject && h.subject ? <Text style={[styles.subject, { color: colors.brand }]}>{h.subject}</Text> : null}
        {h.note ? <Text style={styles.note}>{h.note}</Text> : null}
        <View style={styles.metaRow}>
          {h.due_date ? <Text style={styles.meta}>{t('Due {date}', { date: fmtDate(h.due_date) })}</Text> : null}
          {h.assigned_by ? <Text style={styles.meta}>· {h.assigned_by}</Text> : null}
          <View style={styles.spacer} />
          <Badge status={h.status} />
        </View>
      </View>
      {h.attachment_path ? (
        <AttachmentRow path={h.attachment_path} name={h.attachment_name} type={h.attachment_type}
          onPress={() => openFile(navigate, { path: h.attachment_path!, type: h.attachment_type, name: h.attachment_name })} />
      ) : null}
    </PCard>
  );
});

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 6 },
  icon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  head: { flex: 1, marginLeft: 14 },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  date: { fontSize: 14, color: colors.subtle, marginLeft: 6 },
  bodyPad: { paddingHorizontal: 16, paddingBottom: 14 },
  subject: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  note: { fontSize: 15, color: colors.ink, marginTop: 6, lineHeight: 21 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  meta: { fontSize: 12.5, color: colors.subtle, marginRight: 4 },
  spacer: { flex: 1 },
});
