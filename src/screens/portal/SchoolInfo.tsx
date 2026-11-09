// School Info (opened by tapping the school header on the student home):
// logo, name, director, session; Call / Email / Website shortcuts; school
// details (code, affiliation, director, principal, session); contacts; logout.
// Data: GET /school (edited by the school's admin / principal on the web).
import React from 'react';
import { Alert, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { logout, photoUrl } from '../../api';
import { HeaderIcon, PCard, PortalHeader } from '../../components/portal';
import { Bone, ErrorBox, Screen, Skeleton } from '../../components/ui';
import { useApi, useI18n } from '../../hooks';
import { colors, shadow } from '../../theme';
import type { SchoolProfile, ScreenProps } from '../../types';

const tel = (n: string) => `tel:${n.replace(/[^0-9+]/g, '')}`;
const web = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

export default function SchoolInfo({ goBack, session, onLogout }: ScreenProps) {
  const { t } = useI18n();
  const { data, error, loading, refreshing, refresh } = useApi<SchoolProfile>('/school');
  const name = data?.name || session.org_name || '';

  const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert(t('Could not open'), url));
  const confirmLogout = () =>
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.logout'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          onLogout();
        },
      },
    ]);

  const phone = data?.phone || data?.tel;
  const actions = [
    { icon: 'phone', label: t('Call'), url: phone ? tel(phone) : null },
    { icon: 'email', label: t('Email'), url: data?.email ? `mailto:${data.email}` : null },
    { icon: 'web', label: t('Website'), url: data?.website ? web(data.website) : null },
  ];
  const details: [string, string, string | null | undefined][] = [
    ['qrcode', t('Org Code'), data?.code || session.org_code],
    ['check-decagram', t('Affiliation No'), data?.affiliation_no],
    ['account', t('Director'), data?.director_name],
    ['school', t('Principal'), data?.principal_name],
    ['calendar-range', t('Session'), data?.session?.label],
  ];
  const contacts: [string, string, string | null | undefined, string | null][] = [
    ['cellphone', t('Phone'), data?.phone, data?.phone ? tel(data.phone) : null],
    ['phone-in-talk', t('Tel No.'), data?.tel, data?.tel ? tel(data.tel) : null],
    ['email', t('Email'), data?.email, data?.email ? `mailto:${data.email}` : null],
    ['web', t('Website'), data?.website, data?.website ? web(data.website) : null],
    ['map-marker', t('Address'), data?.address,
      data?.address ? `geo:0,0?q=${encodeURIComponent(`${name}, ${data.address}`)}` : null],
  ];

  return (
    <View style={styles.flex}>
      <Screen refreshing={refreshing} onRefresh={refresh} padded={false}>
        <PortalHeader title={t('School Info')} onBack={goBack} centered
          right={<HeaderIcon icon="logout" label={t('Logout')} onPress={confirmLogout} />}>
          <View style={styles.hero}>
            <View style={[styles.logo, shadow.pop]}>
              {data?.logo_path ? (
                <Image source={{ uri: photoUrl(data.logo_path) || undefined }} style={styles.logoImg} resizeMode="contain"
                  accessibilityIgnoresInvertColors />
              ) : (
                <MCIcon name="school" size={56} color={colors.brand} />
              )}
            </View>
            <Text style={styles.name}>{name.toUpperCase()}</Text>
            {data?.director_name ? (
              <Text style={[styles.director, { color: colors.onBrandSub }]}>{t('Director')}: {data.director_name}</Text>
            ) : null}
            {data?.session?.label ? (
              <View style={styles.sessionPill}>
                <Text style={styles.sessionText}>{t('Session')} {data.session.label}</Text>
              </View>
            ) : null}
          </View>
        </PortalHeader>

        <View style={styles.body}>
          <ErrorBox message={error} />
          <PCard style={styles.actions}>
            {actions.map(a => (
              <TouchableOpacity key={a.icon} style={[styles.action, !a.url && styles.dim]} disabled={!a.url}
                onPress={() => a.url && open(a.url)} accessibilityRole="button" accessibilityLabel={a.label}>
                <View style={[styles.actionIcon, { backgroundColor: colors.brandSoft }]}>
                  <MCIcon name={a.icon} size={26} color={colors.brand} />
                </View>
                <Text style={styles.actionLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </PCard>

          {loading ? (
            <InfoSkeleton />
          ) : (
            <>
              <PCard style={styles.section}>
                <SectionHead icon="bank" title={t('School Details')} />
                {details.map(([icon, label, value]) => (
                  <InfoRow key={label} icon={icon} label={label} value={value} />
                ))}
              </PCard>
              <PCard style={styles.section}>
                <SectionHead icon="card-account-phone" title={t('Contact')} />
                {contacts.map(([icon, label, value, url]) => (
                  <InfoRow key={label} icon={icon} label={label} value={value} onPress={url ? () => open(url) : undefined} />
                ))}
              </PCard>
            </>
          )}

          <TouchableOpacity style={styles.logout} onPress={confirmLogout} accessibilityRole="button">
            <MCIcon name="logout" size={20} color={colors.danger} />
            <Text style={styles.logoutText}>{t('Logout')}</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    </View>
  );
}

function SectionHead({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.sectionHead}>
      <MCIcon name={icon} size={24} color={colors.brand} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, onPress }: { icon: string; label: string; value?: string | null; onPress?: () => void }) {
  const content = (
    <>
      <View style={styles.rowIcon}>
        <MCIcon name={icon} size={20} color={colors.brand} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value || '—'}</Text>
      </View>
      {onPress ? <MCIcon name="chevron-right" size={22} color={colors.faint} /> : null}
    </>
  );
  return onPress ? (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
      {content}
    </TouchableOpacity>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}

function InfoSkeleton() {
  return (
    <PCard style={styles.section}>
      <Skeleton>
        {[0, 1, 2, 3, 4].map(i => (
          <View key={i} style={styles.row}>
            <Bone width={40} height={40} radius={12} />
            <View style={styles.rowText}>
              <Bone width={80} height={10} />
              <Bone width={150} height={14} style={styles.boneGap} />
            </View>
          </View>
        ))}
      </Skeleton>
    </PCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', paddingBottom: 26 },
  logo: { width: 120, height: 120, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: 100, height: 100 },
  name: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.8, marginTop: 16, textAlign: 'center' },
  director: { fontSize: 14.5, marginTop: 6 },
  sessionPill: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7 },
  sessionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  body: { paddingHorizontal: 14, marginTop: -26 },
  actions: { flexDirection: 'row', paddingVertical: 18 },
  action: { flex: 1, alignItems: 'center' },
  dim: { opacity: 0.4 },
  actionIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { marginTop: 8, fontSize: 14, fontWeight: '700', color: colors.ink },
  section: { paddingHorizontal: 16, paddingVertical: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, marginLeft: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  rowIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, marginLeft: 14 },
  rowLabel: { fontSize: 12.5, color: colors.subtle },
  boneGap: { marginTop: 6 },
  rowValue: { fontSize: 15.5, fontWeight: '700', color: colors.ink, marginTop: 2 },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F3C3CA',
    borderRadius: 18,
    paddingVertical: 15,
    marginBottom: 24,
    backgroundColor: '#fff',
  },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: '800', marginLeft: 8 },
});
