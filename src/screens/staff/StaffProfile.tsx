// Staff profile (teacher / driver / admin / principal / sub admin / coordinator) —
// account details, language toggle, UI theme (the same ThemePicker as the
// student Profile), password + sign-out.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { photoUrl } from '../../api';
import { AccountActions } from '../../components/AccountActions';
import { ThemePicker } from '../../components/ThemePicker';
import { Avatar, Card, ErrorBox, Screen, SectionTitle } from '../../components/ui';
import { useApi, useI18n } from '../../hooks';
import { LANGS } from '../../i18n';
import { ROLE_LABELS, colors } from '../../theme';
import type { AuthUser, ScreenProps } from '../../types';

export default function StaffProfile({ session, navigate, onLogout }: ScreenProps) {
  const { t, lang, setLang } = useI18n();
  const { data: me, error, refreshing, refresh } = useApi<AuthUser>('/auth/me');

  const fullName = me?.full_name || session.full_name;
  const role = me?.user_type || session.user_type;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ErrorBox message={error} />
      <Card style={styles.hero}>
        <Avatar name={fullName} uri={photoUrl(me?.photo_path)} size={60} />
        <View style={{ marginLeft: 14, flex: 1 }}>
          <Text style={styles.name}>{fullName}</Text>
          <View style={[styles.rolePill, { backgroundColor: colors.brandSoft }]}>
            <Text style={{ color: colors.brand, fontSize: 12, fontWeight: '700' }}>
              {t(ROLE_LABELS[role] || role)}
            </Text>
          </View>
        </View>
      </Card>

      <SectionTitle>{t('profile.details')}</SectionTitle>
      <Card>
        {session.org_name ? <Detail label={t('School')} value={`${session.org_name} (${session.org_code})`} /> : null}
        <Detail label={t('profile.username')} value={me?.username} />
        <Detail label={t('profile.email')} value={me?.email} />
        <Detail label={t('profile.phone')} value={me?.phone} last />
      </Card>
      {me && !me.email ? (
        <Text style={styles.hint}>{t('Add an email to your account (ask the office) so you can reset a forgotten password.')}</Text>
      ) : null}

      <SectionTitle>{t('profile.language')}</SectionTitle>
      <Card style={{ flexDirection: 'row' }}>
        {LANGS.map(l => (
          <TouchableOpacity
            key={l.code}
            onPress={() => setLang(l.code)}
            style={[
              styles.langBtn,
              lang === l.code && { backgroundColor: colors.brand, borderColor: colors.brand },
            ]}>
            <Text style={{ color: lang === l.code ? '#fff' : colors.subtle, fontWeight: '600', fontSize: 13 }}>
              {l.label}
            </Text>
          </TouchableOpacity>
        ))}
      </Card>

      <SectionTitle>{t('Theme')}</SectionTitle>
      <ThemePicker />

      <SectionTitle>{t('Account')}</SectionTitle>
      <AccountActions navigate={navigate} onLogout={onLogout} />
    </Screen>
  );
}

function Detail({ label, value, last }: { label: string; value?: string | null; last?: boolean }) {
  return (
    <View style={[styles.detail, last && { borderBottomWidth: 0 }]}>
      <Text style={{ color: colors.subtle, fontSize: 12.5 }}>{label}</Text>
      <Text style={styles.detailValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18 },
  name: { fontSize: 17, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  rolePill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  detail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  detailValue: { color: colors.ink, fontSize: 13.5, fontWeight: '600', flexShrink: 1, textAlign: 'right', paddingLeft: 12 },
  hint: { fontSize: 12, color: colors.warn, marginTop: -4, marginBottom: 12 },
  langBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    marginRight: 8,
  },
});
