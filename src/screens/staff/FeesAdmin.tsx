// Fees overview for managers: stats, pending claims banner, fee records
// with filter + mark-paid.
import React, { memo, useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api, errorText } from '../../api';
import {
  Badge,
  Button,
  Card,
  CardSkeleton,
  Chip,
  ChipsSkeleton,
  Empty,
  ErrorBox,
  IconStat,
  ListScreen,
  ListSkeleton,
  ScreenSkeleton,
  SectionTitle,
  SectionTitleSkeleton,
  Segments,
  Sheet,
  StatTilesSkeleton,
  fmtDate,
  inr,
} from '../../components/ui';
import { useApi, usePagedApi } from '../../hooks';
import { colors } from '../../theme';
import type { AdminFee, ClaimStats, FeeStats, ScreenProps } from '../../types';
import { t } from '../../i18n';

const METHODS = ['cash', 'card', 'upi', 'netbanking', 'wallet'];

export default function FeesAdmin({ navigate }: ScreenProps) {
  const [filter, setFilter] = useState('');
  const stats = useApi<FeeStats>('/fees/stats');
  const claimStats = useApi<ClaimStats>('/fees/claims/stats');
  const list = usePagedApi<AdminFee>(filter ? `/fees?status_filter=${filter}` : '/fees');
  const items = list.items;
  const [paying, setPaying] = useState<AdminFee | null>(null);
  const [method, setMethod] = useState('cash');
  const [payError, setPayError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openPay = useCallback((f: AdminFee) => {
    setPayError(null);
    setPaying(f);
    setMethod('cash');
  }, []);

  const pay = async () => {
    if (!paying) return;
    setBusy(true);
    setPayError(null);
    try {
      await api(`/fees/${paying.id}/pay`, { method: 'PUT', body: { method } });
      setPaying(null);
      list.reload();
      stats.reload();
    } catch (e) {
      setPayError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!list.ready && !list.error) {
    return (
      <ScreenSkeleton>
        <StatTilesSkeleton count={2} />
        <StatTilesSkeleton count={2} />
        <CardSkeleton icon lines={1} />
        <SectionTitleSkeleton />
        <ChipsSkeleton count={4} />
        <ListSkeleton badge="right" lines={1} action count={3} />
      </ScreenSkeleton>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={items}
        keyExtractor={f => f.id}
        renderItem={f => <FeeRow fee={f} onPay={openPay} />}
        empty={<Empty icon="💰" text={t('No fee records.')} />}
        refreshing={list.refreshing}
        onRefresh={() => {
          stats.reload();
          claimStats.reload();
          list.refresh();
        }}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore || list.loading}
        header={
          <>
        <ErrorBox message={list.error || stats.error} />

        <View style={styles.statRow}>
          <IconStat icon="💰" label={t('Collected')} value={stats.data ? inr(stats.data.collected) : '—'} tint={colors.ok} soft={colors.okSoft} />
          <IconStat icon="⏳" label={t('Pending')} value={stats.data ? inr(stats.data.pending) : '—'} tint={colors.warn} soft={colors.warnSoft} />
        </View>
        <View style={styles.statRow}>
          <IconStat icon="⚠️" label={t('Overdue')} value={stats.data ? inr(stats.data.overdue) : '—'} tint={colors.danger} soft={colors.dangerSoft} />
          <IconStat icon="📈" label={t('Collection')} value={stats.data ? `${stats.data.collection_rate}%` : '—'} tint={colors.brand} soft={colors.brandSoft} />
        </View>

        {/* claims banner */}
        <TouchableOpacity activeOpacity={0.75} onPress={() => navigate('FeeClaims')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.brandSoft, borderColor: colors.brandSoft }}>
            <Text style={{ fontSize: 22, marginRight: 12 }}>🧾</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: colors.brand, fontSize: 14 }}>{t('Payment claims')}</Text>
              <Text style={{ color: colors.subtle, fontSize: 12, marginTop: 1 }}>
                {claimStats.data ? t('{p} pending · {a} approved', { p: claimStats.data.pending, a: claimStats.data.approved }) : t('Parent-submitted payment proofs')}
              </Text>
            </View>
            <Text style={{ color: colors.brand, fontSize: 22 }}>›</Text>
          </Card>
        </TouchableOpacity>

        <SectionTitle>{t('Fee records')}</SectionTitle>
        <Segments
          items={[
            { value: '', label: t('All') },
            { value: 'pending', label: t('Pending') },
            { value: 'overdue', label: t('Overdue') },
            { value: 'paid', label: t('Paid') },
          ]}
          value={filter}
          onChange={setFilter}
        />
          </>
        }
      />

      <Sheet visible={!!paying} title={paying ? `${t('Mark paid')} — ${paying.student_name}` : ''} onClose={() => setPaying(null)} error={payError}>
        {paying && (
          <>
            <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 18, marginBottom: 10 }}>
              {inr(paying.amount)} · {paying.title}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 }}>{t('Payment method')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {METHODS.map(m => (
                <Chip key={m} label={m.toUpperCase()} active={method === m} onPress={() => setMethod(m)} />
              ))}
            </View>
            <Button label={t('Confirm payment')} onPress={pay} busy={busy} />
          </>
        )}
      </Sheet>
    </View>
  );
}

/** One fee record card; memoised so the list doesn't redraw when the sheet changes. */
const FeeRow = memo(function FeeRow({ fee: f, onPay }: { fee: AdminFee; onPay: (f: AdminFee) => void }) {
  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.student}>{f.student_name}</Text>
        <Badge status={f.effective_status} />
      </View>
      <Text style={styles.sub}>
        {f.title} · {f.class_name || '—'}{f.section_name ? ` / ${f.section_name}` : ''}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.amount}>{inr(f.amount)}</Text>
        {f.status !== 'paid' ? (
          <Button label={t('Mark paid')} kind="soft" small onPress={() => onPay(f)} />
        ) : (
          <Text style={{ color: colors.subtle, fontSize: 12 }}>{t('Paid {date}', { date: fmtDate(f.paid_date) })}</Text>
        )}
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', marginHorizontal: -4, marginBottom: 4 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  student: { fontSize: 14.5, fontWeight: '800', color: colors.ink, flex: 1, paddingRight: 8 },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  amount: { fontSize: 16, fontWeight: '800', color: colors.ink },
});
