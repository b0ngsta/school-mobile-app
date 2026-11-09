// Transport (parents): the vehicle (bus / van) and its driver, the child's
// stop, pickup and drop time, and the shift. No live tracking — the school
// has no tracker data; this screen only shows the details the school set.
// Data: GET /student/transport (null = the child doesn't use school transport)
import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { photoUrl } from '../../api';
import { PCard, PortalHeader } from '../../components/portal';
import { Avatar, Bone, Empty, ErrorBox, Screen, Skeleton } from '../../components/ui';
import { fmtTime } from '../../format';
import { useApi, useI18n } from '../../hooks';
import { colors, shadow } from '../../theme';
import type { ScreenProps, StudentTransport } from '../../types';

const TYPE_LABEL = { bus: 'Bus', van: 'Van', other: 'Vehicle' } as const;

export default function MyTransport({ goBack, session }: ScreenProps) {
  const { t } = useI18n();
  const { data, error, loading, refreshing, refresh } = useApi<StudentTransport | null>('/student/transport');
  const v = data;
  const type = v ? t(TYPE_LABEL[v.vehicle_type] || 'Vehicle') : '';
  const call = () => v?.driver_phone && Linking.openURL(`tel:${v.driver_phone.replace(/[^0-9+]/g, '')}`).catch(() => {});

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} padded={false}>
      <PortalHeader title={t('Transport')} onBack={goBack} subtitle={v ? `${type} ${v.vehicle_no}` : null} />
      <View style={styles.body}>
        <ErrorBox message={error} />
        {loading ? (
          <Skeleton>
            <Bone height={190} radius={24} />
            <Bone height={90} radius={22} style={styles.gap} />
            <Bone height={110} radius={22} style={styles.gap} />
          </Skeleton>
        ) : !v ? (
          !error && <Empty icon="bus" text={t('Your child is not on school transport. Contact the school office to add a stop.')} />
        ) : (
          <>
            <View style={[styles.driverCard, shadow.pop, { backgroundColor: colors.brandDark }]}>
              <View style={styles.driverRow}>
                <View style={styles.driverPhoto}>
                  <Avatar name={v.driver_name} uri={photoUrl(v.driver_photo)} size={92} />
                </View>
                <View style={styles.driverText}>
                  <Text style={[styles.driverLabel, { color: colors.onBrandSub }]}>{t('{type} Driver', { type })}</Text>
                  <Text style={styles.driverName}>{v.driver_name}</Text>
                  {v.driver_phone ? <Text style={styles.driverPhone}>{v.driver_phone}</Text> : null}
                </View>
                {v.driver_phone ? (
                  <TouchableOpacity style={styles.callBtn} onPress={call} accessibilityRole="button"
                    accessibilityLabel={t('Call the driver')}>
                    <MCIcon name="phone" size={28} color={colors.ok} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.vehicleRow}>
                <MCIcon name={v.vehicle_type === 'van' ? 'van-passenger' : 'bus'} size={24} color="#fff" />
                <Text style={styles.vehicleLabel}>{t('Vehicle')}</Text>
                <View style={styles.plate}>
                  <Text style={styles.plateText}>{v.vehicle_no}</Text>
                </View>
              </View>
              {v.status === 'maintenance' ? (
                <Text style={styles.maintenance}>{t('This vehicle is under maintenance — the school will arrange another.')}</Text>
              ) : null}
            </View>

            <PCard style={styles.stationCard}>
              <View style={[styles.stationIcon, { backgroundColor: colors.dangerSoft }]}>
                <MCIcon name="map-marker" size={28} color={colors.danger} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.small}>{t('My Station')}</Text>
                <Text style={styles.station}>{v.stop_name || t('Not set')}</Text>
                {v.route_name ? <Text style={styles.small}>{t('Route: {name}', { name: v.route_name })}</Text> : null}
              </View>
            </PCard>

            <View style={styles.twoCol}>
              <TimeTile icon="white-balance-sunny" label={t('Pickup')} value={v.pickup_time} sub={t('Morning')} fg={colors.warn}
                bg={colors.warnSoft} />
              <TimeTile icon="weather-sunset-down" label={t('Drop')} value={v.drop_time} sub={t('After school')} fg="#5B5BD6"
                bg="#EEEDFD" />
            </View>

            <PCard style={styles.infoCard}>
              <InfoLine icon="clock-outline" label={t('Shift')}
                value={[v.shift_name, v.shift_start ? `${fmtTime(v.shift_start)} – ${fmtTime(v.shift_end)}` : null]
                  .filter(Boolean).join('  •  ') || '—'} />
              <InfoLine icon="school-outline" label={t('School')} value={(session.org_name || '').toUpperCase() || '—'} />
            </PCard>
          </>
        )}
      </View>
    </Screen>
  );
}

function TimeTile({ icon, label, value, sub, fg, bg }: {
  icon: string; label: string; value?: string | null; sub: string; fg: string; bg: string;
}) {
  return (
    <PCard style={styles.timeTile}>
      <View style={styles.timeHead}>
        <View style={[styles.timeIcon, { backgroundColor: bg }]}>
          <MCIcon name={icon} size={24} color={fg} />
        </View>
        <Text style={styles.timeLabel}>{label}</Text>
      </View>
      <Text style={[styles.timeValue, { color: fg }]}>{value ? fmtTime(value) : 'N/A'}</Text>
      <Text style={styles.small}>{sub}</Text>
    </PCard>
  );
}

function InfoLine({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <MCIcon name={icon} size={24} color={colors.brand} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: 14, marginTop: 18, paddingBottom: 24 },
  gap: { marginTop: 14 },
  driverCard: { borderRadius: 26, padding: 18, marginBottom: 14 },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  driverPhoto: { borderWidth: 3, borderColor: '#fff', borderRadius: 52 },
  driverText: { flex: 1, marginLeft: 16 },
  driverLabel: { fontSize: 14 },
  driverName: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 2 },
  driverPhone: { color: '#fff', fontSize: 15, marginTop: 4, letterSpacing: 0.5 },
  callBtn: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 18,
  },
  vehicleLabel: { flex: 1, color: '#fff', fontSize: 16, marginLeft: 12 },
  plate: { backgroundColor: '#FFD43B', borderRadius: 10, borderWidth: 2, borderColor: '#171A26', paddingHorizontal: 14, paddingVertical: 6 },
  plateText: { fontSize: 16, fontWeight: '800', color: '#171A26', letterSpacing: 1.5 },
  maintenance: { color: '#FFD43B', fontSize: 13, marginTop: 10 },
  stationCard: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  stationIcon: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  small: { fontSize: 13.5, color: colors.subtle },
  station: { fontSize: 20, fontWeight: '800', color: colors.ink, marginVertical: 2 },
  twoCol: { flexDirection: 'row', marginHorizontal: -6 },
  timeTile: { flex: 1, marginHorizontal: 6, padding: 16 },
  timeHead: { flexDirection: 'row', alignItems: 'center' },
  timeIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  timeLabel: { fontSize: 16, fontWeight: '800', color: colors.ink, marginLeft: 12 },
  timeValue: { fontSize: 24, fontWeight: '800', marginTop: 14 },
  infoCard: { paddingHorizontal: 16, paddingVertical: 6 },
  infoLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  infoLabel: { fontSize: 15, color: colors.subtle, marginLeft: 12, width: 70 },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 15, fontWeight: '800', color: colors.ink },
});
