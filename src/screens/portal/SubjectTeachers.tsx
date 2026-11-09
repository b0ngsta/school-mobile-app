// Subject Teachers: the teachers of the student's section with their
// designation, subjects and email (tap the envelope to write), class teacher
// first; the search box filters by name or subject.
// Data: GET /student/teachers
import React, { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { photoUrl } from '../../api';
import { ListHeaderBleed, PCard, PortalHeader, subjectColor } from '../../components/portal';
import { Avatar, Empty, ErrorBox, ListScreen, ListSkeleton } from '../../components/ui';
import { useApi, useI18n } from '../../hooks';
import { colors } from '../../theme';
import type { ScreenProps, SubjectTeacher } from '../../types';

export default function SubjectTeachers({ goBack }: ScreenProps) {
  const { t } = useI18n();
  const { data, error, loading, refreshing, refresh } = useApi<SubjectTeacher[]>('/student/teachers');
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return (data || []).filter(
      x => x.full_name.toLowerCase().includes(needle) || x.subjects.some(s => s.toLowerCase().includes(needle)),
    );
  }, [data, q]);

  return (
    <ListScreen
      data={loading ? null : shown}
      keyExtractor={x => x.id}
      header={
        <>
          <ListHeaderBleed>
            <PortalHeader title={t('Subject Teachers')} onBack={goBack}
              subtitle={data ? t(data.length === 1 ? '{n} teacher for your class' : '{n} teachers for your class', { n: data.length }) : null}>
              <View style={styles.search}>
                <MCIcon name="magnify" size={24} color={colors.subtle} />
                <TextInput value={q} onChangeText={setQ} placeholder={t('Search teacher or subject')}
                  placeholderTextColor={colors.faint} style={styles.searchInput} returnKeyType="search"
                  accessibilityLabel={t('Search teacher or subject')} />
                {q ? (
                  <TouchableOpacity onPress={() => setQ('')} accessibilityLabel={t('Clear')}>
                    <MCIcon name="close-circle" size={20} color={colors.faint} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </PortalHeader>
          </ListHeaderBleed>
          <ErrorBox message={error} />
          {loading ? <ListSkeleton count={3} avatar={84} lines={2} /> : null}
        </>
      }
      empty={<Empty icon="account-tie" text={q ? t('No teacher matches your search.') : t('No teachers assigned to your class yet.')} />}
      refreshing={refreshing}
      onRefresh={refresh}
      renderItem={x => <TeacherCard teacher={x} />}
    />
  );
}

function TeacherCard({ teacher: x }: { teacher: SubjectTeacher }) {
  const { t } = useI18n();
  const mail = () => x.email && Linking.openURL(`mailto:${x.email}`).catch(() => {});
  return (
    <PCard style={styles.card}>
      <View style={styles.top}>
        <View style={styles.photo}>
          <Avatar name={x.full_name} uri={photoUrl(x.photo_path)} size={84} />
        </View>
        <View style={styles.head}>
          <Text style={styles.name}>{x.full_name}</Text>
          {x.designation || x.qualification ? (
            <View style={styles.row}>
              <MCIcon name="badge-account-horizontal-outline" size={17} color={colors.subtle} />
              <Text style={styles.designation}>{x.designation || x.qualification}</Text>
            </View>
          ) : null}
          {x.is_class_teacher ? <Text style={[styles.classTeacher, { color: colors.brand }]}>{t('Class teacher')}</Text> : null}
        </View>
        {x.email ? (
          <TouchableOpacity onPress={mail} style={[styles.mail, { backgroundColor: colors.brandSoft }]} accessibilityRole="button"
            accessibilityLabel={t('Email {name}', { name: x.full_name })}>
            <MCIcon name="email-outline" size={28} color={colors.brand} />
          </TouchableOpacity>
        ) : null}
      </View>
      {x.subjects.length || x.email ? <View style={styles.divider} /> : null}
      {x.subjects.length ? (
        <View style={styles.chips}>
          {x.subjects.map((s, i) => {
            const c = subjectColor(s, i);
            return (
              <View key={s} style={[styles.chip, { backgroundColor: c + '1A' }]}>
                <MCIcon name="book-open-variant" size={15} color={c} />
                <Text style={[styles.chipText, { color: c }]}>{s.toUpperCase()}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
      {x.email ? (
        <View style={styles.row}>
          <MCIcon name="at" size={18} color={colors.subtle} />
          <Text style={styles.email}>{x.email}</Text>
        </View>
      ) : null}
    </PCard>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 14, marginLeft: 8 },
  card: { padding: 18 },
  top: { flexDirection: 'row', alignItems: 'center' },
  photo: { borderRadius: 22, overflow: 'hidden' },
  head: { flex: 1, marginLeft: 16 },
  name: { fontSize: 19, fontWeight: '800', color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  designation: { fontSize: 15, color: colors.subtle, marginLeft: 6 },
  classTeacher: { fontSize: 12.5, fontWeight: '800', marginTop: 4 },
  mail: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
  chipText: { fontSize: 13.5, fontWeight: '800', marginLeft: 6 },
  email: { fontSize: 15, color: colors.subtle, marginLeft: 8 },
});
