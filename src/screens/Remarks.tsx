// Teacher Remarks: what the child's teachers wrote about them — any teacher of
// the class (class teacher or subject teacher) may write one from the staff app
// or the web. Each remark shows who wrote it (photo, name, class teacher /
// subjects, designation) and when; chips on top filter by teacher.
// Data: GET /student/remarks (newest first). A push for a new remark opens here.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { photoUrl } from '../api';
import { ListHeaderBleed, PCard, PortalHeader } from '../components/portal';
import { Avatar, Empty, ErrorBox, ListScreen, ListSkeleton } from '../components/ui';
import { fmtDateTime } from '../format';
import { useApi, useI18n } from '../hooks';
import { colors } from '../theme';
import type { Remark, ScreenProps } from '../types';

/** "Class teacher · Maths, Science" / "Maths" / designation. */
export function remarkRole(r: Remark, t: (k: string) => string): string {
  const parts: string[] = [];
  if (r.by_class_teacher) parts.push(t('Class teacher'));
  if (r.by_subjects?.length) parts.push(r.by_subjects.join(', '));
  if (!parts.length && r.by_designation) parts.push(r.by_designation);
  return parts.join(' · ');
}

export default function Remarks({ goBack }: ScreenProps) {
  const { t } = useI18n();
  const { data, error, loading, refreshing, refresh } = useApi<Remark[]>('/student/remarks');
  const [who, setWho] = useState<string | null>(null);
  const teachers = useMemo(() => [...new Set((data || []).map(r => r.by_name || '—'))], [data]);
  const shown = useMemo(() => (who ? (data || []).filter(r => (r.by_name || '—') === who) : data), [data, who]);
  const total = data?.length ?? 0;

  return (
    <ListScreen
      data={loading ? null : shown}
      keyExtractor={r => r.id}
      header={
        <>
          <ListHeaderBleed>
            <PortalHeader title={t('Teacher Remarks')} onBack={goBack}
              subtitle={data ? t(total === 1 ? '{n} remark' : '{n} remarks', { n: total }) : null} />
          </ListHeaderBleed>
          <ErrorBox message={error} />
          {teachers.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}
              contentContainerStyle={{ gap: 8 }}>
              {[null, ...teachers].map(name => {
                const active = who === name;
                return (
                  <TouchableOpacity key={name ?? 'all'} onPress={() => setWho(name)} accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.filter, active && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
                    <Text style={[styles.filterText, active && { color: '#fff' }]}>{name ?? t('All teachers')}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}
          {loading ? <ListSkeleton count={3} avatar={48} lines={3} /> : null}
        </>
      }
      empty={<Empty icon="comment-quote-outline" text={t('No remarks from teachers yet.')} />}
      refreshing={refreshing}
      onRefresh={refresh}
      renderItem={r => <RemarkCard remark={r} />}
    />
  );
}

function RemarkCard({ remark: r }: { remark: Remark }) {
  const { t } = useI18n();
  const role = remarkRole(r, t);
  return (
    <PCard style={styles.card} accessibilityLabel={`${r.by_name || ''}: ${r.remark}`}>
      <View style={styles.head}>
        <Avatar name={r.by_name || '?'} uri={photoUrl(r.photo_path)} size={48} />
        <View style={styles.who}>
          <Text style={styles.name} numberOfLines={1}>{r.by_name || t('Teacher')}</Text>
          {role ? (
            <Text style={[styles.role, r.by_class_teacher && { color: colors.brand }]} numberOfLines={1}>{role}</Text>
          ) : null}
        </View>
      </View>
      <View style={[styles.bubble, { backgroundColor: colors.brandSoft }]}>
        <MCIcon name="format-quote-open" size={22} color={colors.brand} style={styles.quote} />
        <Text style={styles.text}>{r.remark}</Text>
      </View>
      <View style={styles.when}>
        <MCIcon name="clock-outline" size={14} color={colors.subtle} />
        <Text style={styles.whenText}>{fmtDateTime(r.created_at)}</Text>
      </View>
    </PCard>
  );
}

const styles = StyleSheet.create({
  filters: { flexGrow: 0, marginBottom: 12 },
  filter: { borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  filterText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  card: { padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center' },
  who: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '800', color: colors.ink },
  role: { fontSize: 12.5, fontWeight: '700', color: colors.subtle, marginTop: 2 },
  bubble: { borderRadius: 14, padding: 14, paddingLeft: 40, marginTop: 12 },
  quote: { position: 'absolute', left: 12, top: 12 },
  text: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  when: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  whenText: { fontSize: 12, color: colors.subtle, marginLeft: 5, fontWeight: '600' },
});
