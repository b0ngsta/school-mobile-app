// Student view: their section's weekly timetable with teacher names.
import React, { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';
import { api, errorText, peek } from '../api';
import { TimetableSkeleton, TimetableView } from '../components/Timetable';
import { Empty, ErrorBox, Screen } from '../components/ui';
import { useSchoolTimings } from '../hooks';
import { colors } from '../theme';
import type { TimetableSlot } from '../types';
import { t } from '../i18n';

export default function StudentTimetable() {
  const { timings } = useSchoolTimings();
  const [slots, setSlots] = useState<TimetableSlot[] | null>(() => peek<TimetableSlot[]>('/student/timetable'));
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (r = false) => {
    r && setRefreshing(true);
    try {
      setSlots(await api<TimetableSlot[]>('/student/timetable'));
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

  if (!slots && !error) {
    return (
      <Screen>
        <TimetableSkeleton />
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => load(true)}>
      <ErrorBox message={error} />
      {slots?.length === 0 ? (
        <Empty icon="🕐" text={t('Your class timetable is not set yet.')} />
      ) : (
        <TimetableView
          slots={slots}
          timings={timings}
          renderExtra={s => (
            <Text style={{ fontSize: 11.5, color: colors.subtle, marginTop: 1 }}>
              🧑‍🏫 {s.teacher_name}
            </Text>
          )}
        />
      )}
    </Screen>
  );
}
