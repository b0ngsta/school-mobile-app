// Shared frame for the signed-out screens (login, forgot password) and the
// forced password change: logo, title, subtitle and one card. Restyle the
// whole pre-login experience here.
import React, { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { t } from '../i18n';
import { colors, radius, shadow } from '../theme';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  /** Above the logo (e.g. the language toggle). */
  top?: ReactNode;
  /** Shows a back arrow in the corner. */
  onBack?: () => void;
  children: ReactNode;
  /** Below the card (links, notes). */
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, top, onBack, children, footer }: AuthLayoutProps) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={[styles.flex, { backgroundColor: colors.page }]}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled">
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.back}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('Back')}>
            <MCIcon name="arrow-left" size={22} color={colors.ink} />
          </TouchableOpacity>
        ) : null}
        {top}
        <View style={[styles.logo, { backgroundColor: colors.brand }, shadow.card]}>
          <MCIcon name="school-outline" size={30} color="#fff" />
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={[styles.card, shadow.card]}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  back: { position: 'absolute', top: 16, left: 16, zIndex: 1 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.subtle, marginTop: 4, marginBottom: 26, textAlign: 'center', maxWidth: 380 },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.white,
    borderRadius: radius.card + 4,
    padding: 20,
    marginTop: 4,
  },
  footer: { width: '100%', maxWidth: 380, marginTop: 16, alignItems: 'center' },
});
