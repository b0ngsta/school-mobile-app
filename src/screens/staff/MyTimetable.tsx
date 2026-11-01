// Teacher's own timetable for a dated week: the weekly template with clock
// times, plus substitutions (periods they cover / that cover theirs), leave
// days and holidays. Managers edit the template from the teacher's profile.
import React from 'react';
import { WeekTimetable } from '../../components/Timetable';
import { Screen } from '../../components/ui';

export default function MyTimetable() {
  return (
    <Screen>
      <WeekTimetable />
    </Screen>
  );
}
