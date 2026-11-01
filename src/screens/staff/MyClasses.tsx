// Teacher's assigned classes (class teacher + subject teacher roles).
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api, errorText, peek } from '../../api';
import { Badge, Card, Empty, ErrorBox, ListSkeleton, Screen, ScreenSkeleton } from '../../components/ui';
import { colors } from '../../theme';
import type { Assignment, ScreenProps } from '../../types';
import { t } from '../../i18n';

export default function MyClasses({ navigate }: ScreenProps) {
  const [items, setItems] = useState<Assignment[] | null>(() => peek<Assignment[]>('/assignments/mine'));
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (r = false) => {
    r && setRefreshing(true);
    try {
      setItems(await api('/assignments/mine'));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (!items && !error) {
    return (
      <ScreenSkeleton>
        <ListSkeleton badge="right" lines={2} count={3} />
      </ScreenSkeleton>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => load(true)}>
      <ErrorBox message={error} />
      {items?.length === 0 && <Empty icon="🏫" text={t('No classes assigned to you yet.')} />}
      {items?.map(a => (
        <TouchableOpacity
          key={a.id}
          activeOpacity={0.7}
          onPress={() =>
            navigate('SectionStudents', {
              classId: a.class_id,
              sectionId: a.section_id,
              className: a.class_name,
              sectionName: a.section_name,
              canEdit: a.role === 'class_teacher',
              title: `${a.class_name} — ${a.section_name}`,
            })
          }>
          <Card>
            <View style={styles.head}>
              <Text style={styles.name}>{a.class_name} — {t('Section {name}', { name: a.section_name })}</Text>
              <Badge status={a.role} label={a.role === 'class_teacher' ? t('Class teacher') : a.subject || t('Subject')} />
            </View>
            <Text style={styles.sub}>
              🧑‍🎓 {t('{n} students', { n: a.student_count })}{a.subject ? ` · 📘 ${a.subject}` : ''}
            </Text>
            <View style={styles.actions}>
              <Text style={[styles.link, { color: colors.brand }]}>{t('View students ›')}</Text>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() =>
                  navigate('ClassHomework', {
                    classId: a.class_id,
                    sectionId: a.section_id,
                    className: a.class_name,
                    sectionName: a.section_name,
                    title: t('Class homework'),
                  })
                }>
                <Text style={[styles.link, { color: colors.brand, marginLeft: 18 }]}>{t('Homework ›')}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </TouchableOpacity>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '800', color: colors.ink, flex: 1, paddingRight: 8 },
  sub: { color: colors.subtle, fontSize: 12.5, marginTop: 6 },
  actions: { flexDirection: 'row', marginTop: 8 },
  link: { fontSize: 13, fontWeight: '700' },
});
