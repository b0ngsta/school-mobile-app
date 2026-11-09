// "● Thursday, 23 Jul 2026" above the first card of each day in a list.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fmtDayLong } from '../../format';
import { colors } from '../../theme';

export default function DayHeading({ date, line = false }: { date: string; line?: boolean }) {
  return (
    <View style={styles.row}>
      {!line ? <View style={[styles.dot, { backgroundColor: colors.brand }]} /> : null}
      <Text style={styles.text}>{fmtDayLong(date)}</Text>
      {line ? <View style={styles.line} /> : null}
    </View>
  );
}

/** Ids of the rows that start a new day (rows sorted newest first). */
export function firstOfDay<T extends { id: number }>(rows: T[] | null, dateOf: (row: T) => string): Set<number> {
  const out = new Set<number>();
  let last = '';
  for (const r of rows || []) {
    const d = String(dateOf(r) || '').slice(0, 10);
    if (d !== last) out.add(r.id);
    last = d;
  }
  return out;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  text: { fontSize: 15.5, fontWeight: '700', color: colors.subtle },
  line: { flex: 1, height: 1, backgroundColor: colors.line, marginLeft: 12 },
});
