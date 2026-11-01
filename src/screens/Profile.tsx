import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { photoUrl } from '../api';
import { AccountActions } from '../components/AccountActions';
import { Avatar, Bone, Card, ErrorBox, Screen, SectionTitle, Skeleton, fmtDate } from '../components/ui';
import { useApi, useI18n } from '../hooks';
import { LANGS } from '../i18n';
import { colors, radius } from '../theme';
import type { ScreenProps, StudentProfile } from '../types';

const Field = ({ label, value }: { label: string; value?: string | null }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{value || '—'}</Text>
  </View>
);

export default function Profile({ navigate, onLogout, session }: ScreenProps) {
  const { t, lang, setLang } = useI18n();
  const { data: p, error, loading, refreshing, refresh } = useApi<StudentProfile>('/student/me');
  if (loading) return <ProfileSkeleton />;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ErrorBox message={error} />
      {p && (
        <>
          <Card style={styles.hero}>
            <Avatar name={p.full_name} uri={photoUrl(p.photo_path)} size={64} />
            <Text style={styles.name}>{p.full_name}</Text>
            <Text style={styles.meta}>
              {p.class_name ? `${p.class_name} · ${p.section_name || ''}` : ''}
              {p.roll_no ? ` · ${t('dash.roll', { n: p.roll_no })}` : ''}
            </Text>
          </Card>

          <SectionTitle>{t('profile.details')}</SectionTitle>
          <Card>
            {session.org_name ? <Field label={t('School')} value={`${session.org_name} (${session.org_code})`} /> : null}
            <Field label={t('profile.username')} value={p.username} />
            <Field label={t('profile.admission')} value={p.admission_no} />
            <Field label={t('profile.dob')} value={p.dob ? fmtDate(p.dob) : null} />
            <Field label={t('profile.email')} value={p.email} />
            <Field label={t('profile.phone')} value={p.phone} />
          </Card>

          <SectionTitle>{t('profile.family')}</SectionTitle>
          <Card>
            <Field label={t('profile.father')} value={p.father_name} />
            <Field label={t('profile.mother')} value={p.mother_name} />
            <Field label={t('profile.guardianPhone')} value={p.guardian_phone} />
            <Field label={t('profile.address')} value={p.address} />
          </Card>
        </>
      )}

      <SectionTitle>{t('profile.language')}</SectionTitle>
      <Card style={styles.langCard}>
        {LANGS.map(l => (
          <TouchableOpacity
            key={l.code}
            style={[styles.langBtn, lang === l.code && { backgroundColor: colors.brandSoft, borderColor: colors.brand }]}
            onPress={() => setLang(l.code)}>
            <Text style={[styles.langText, lang === l.code && { color: colors.brand }]}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </Card>

      <SectionTitle>{t('Account')}</SectionTitle>
      <AccountActions navigate={navigate} onLogout={onLogout} />
    </Screen>
  );
}

// Shown while the profile loads: the same cards with placeholder bones, so
// the page (and the screen transition into it) is visible immediately.
function ProfileSkeleton() {
  const section = (rows: number, key: string) => (
    <React.Fragment key={key}>
      <Bone width={72} height={12} style={styles.titleBone} />
      <Card>
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={[styles.field, i === rows - 1 && styles.lastField]}>
            <Bone width={84} height={10} style={styles.fieldBone} />
            <Bone width={112} height={10} style={styles.fieldBone} />
          </View>
        ))}
      </Card>
    </React.Fragment>
  );
  return (
    <Screen>
      <Skeleton>
        <Card style={styles.hero}>
          <Bone width={64} height={64} radius={32} />
          <Bone width={140} height={16} style={{ marginTop: 12 }} />
          <Bone width={100} height={10} style={{ marginTop: 8 }} />
        </Card>
        {section(5, 'details')}
        {section(4, 'family')}
        <Bone width={72} height={12} style={styles.titleBone} />
        <Card style={styles.langCard}>
          <Bone height={40} radius={radius.input} style={styles.langBone} />
          <Bone height={40} radius={radius.input} style={styles.langBone} />
        </Card>
      </Skeleton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 22 },
  titleBone: { marginTop: 9, marginBottom: 13 },
  fieldBone: { marginVertical: 3.5 },
  lastField: { borderBottomWidth: 0 },
  langBone: { flex: 1, width: undefined, marginHorizontal: 4 },
  name: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 10 },
  meta: { fontSize: 12, color: colors.subtle, marginTop: 2 },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  fieldLabel: { fontSize: 13, color: colors.subtle },
  fieldValue: { fontSize: 13, fontWeight: '600', color: colors.ink, flexShrink: 1, textAlign: 'right', paddingLeft: 12 },
  langCard: { flexDirection: 'row' },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  langText: { fontSize: 14, fontWeight: '600', color: colors.subtle },
});
