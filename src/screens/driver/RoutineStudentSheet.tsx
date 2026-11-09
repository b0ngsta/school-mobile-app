// Driver "My Routine" → tap a student: the full address and landmark,
// Navigate (Google Maps, only with a map pin), the parent / guardian and the
// student's own phone with a Call button each (opens the dialer with the
// number typed in — never calls by itself; disabled without a usable
// number), the pickup / drop time and stop, and the school's notes.
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { photoUrl } from '../../api';
import { Pill } from '../../components/portal';
import { Avatar, Button, Sheet } from '../../components/ui';
import { fmtTime } from '../../format';
import { useI18n } from '../../hooks';
import { colors } from '../../theme';
import type { RoutineShift, RoutineStudent } from '../../types';
import { classLabel, contactsOf, mapsUrl, telUrl } from './routine';

const open = (url: string | null) => {
  if (url) Linking.openURL(url).catch(() => {});
};

export default function RoutineStudentSheet({ student: st, shift, onClose }: {
  student: RoutineStudent | null;
  shift: RoutineShift | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  if (!st || !shift) return <Sheet visible={false} onClose={onClose} />;
  const pickup = shift.trip_type === 'pickup';
  const maps = mapsUrl(st);
  const contacts = contactsOf(st);

  return (
    <Sheet visible title={st.full_name} onClose={onClose}>
      <View style={styles.who}>
        <Avatar name={st.full_name} uri={photoUrl(st.photo_path)} size={56} />
        <View style={styles.whoText}>
          <Text style={styles.cls} numberOfLines={1}>
            {[classLabel(st), st.roll_no ? t('Roll {n}', { n: st.roll_no }) : null].filter(Boolean).join('  ·  ') || '—'}
          </Text>
          <View style={styles.pills}>
            <Pill icon={pickup ? 'home-export-outline' : 'home-import-outline'}
              label={`${t(pickup ? 'Pickup' : 'Drop')} ${st.stop_time ? fmtTime(st.stop_time) : ''}`.trim()}
              fg={pickup ? colors.warn : '#5B5BD6'} bg={pickup ? colors.warnSoft : '#EEEDFD'} />
            <Pill icon="numeric" label={t('Stop {n}', { n: st.stop_no })} fg={colors.brand} bg={colors.brandSoft} />
          </View>
        </View>
      </View>

      <Block icon="map-marker-outline" title={t(pickup ? 'Pickup location' : 'Drop location')}>
        {st.stop_name ? <Text style={styles.strong}>{st.stop_name}</Text> : null}
        <Text style={styles.body}>{st.address || t('Address not added')}</Text>
        {st.landmark ? <Text style={styles.sub}>{t('Landmark: {text}', { text: st.landmark })}</Text> : null}
        {maps ? (
          <Button label={t('Navigate')} kind="soft" small onPress={() => open(maps)} style={styles.action} />
        ) : null}
      </Block>

      {contacts.map(c => (
        <Block key={c.label} icon={c.label === 'Student' ? 'account-outline' : 'account-child-outline'} title={t(c.label)}>
          {c.name ? <Text style={styles.strong} numberOfLines={2}>{c.name}</Text> : null}
          <Text style={styles.body}>{c.phone || t('No phone number')}</Text>
          {c.phone && !c.dial ? <Text style={styles.warn}>{t('This number looks wrong — check with the office.')}</Text> : null}
          <Button label={c.dial ? t('Call {who}', { who: t(c.label) }) : t('Call')} disabled={!c.dial}
            onPress={() => open(telUrl(c.dial))} small style={styles.action} />
        </Block>
      ))}

      {st.notes ? (
        <View style={[styles.notes, { backgroundColor: colors.warnSoft }]}>
          <MCIcon name="alert-circle-outline" size={18} color={colors.warn} />
          <Text style={[styles.notesText, { color: colors.ink }]}>{st.notes}</Text>
        </View>
      ) : null}
    </Sheet>
  );
}

function Block({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <MCIcon name={icon} size={18} color={colors.brand} />
        <Text style={styles.blockTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  whoText: { flex: 1, marginLeft: 12 },
  cls: { fontSize: 14, fontWeight: '700', color: colors.ink },
  pills: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 6 },
  block: { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 12 },
  blockHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  blockTitle: { fontSize: 12.5, fontWeight: '800', color: colors.subtle, marginLeft: 6, textTransform: 'uppercase' },
  strong: { fontSize: 15, fontWeight: '800', color: colors.ink },
  body: { fontSize: 14.5, color: colors.ink, marginTop: 2, lineHeight: 20 },
  sub: { fontSize: 13, color: colors.subtle, marginTop: 4 },
  warn: { fontSize: 12.5, color: colors.danger, marginTop: 4 },
  action: { marginTop: 10 },
  notes: { flexDirection: 'row', borderRadius: 14, padding: 12, marginTop: 4 },
  notesText: { flex: 1, fontSize: 14, marginLeft: 8, lineHeight: 20 },
});
