// Payment transactions (managers).
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Card,
  Empty,
  ErrorBox,
  IconStat,
  ListScreen,
  ListSkeleton,
  ScreenSkeleton,
  SectionTitle,
  SectionTitleSkeleton,
  StatTilesSkeleton,
  fmtDate,
  inr,
} from '../../components/ui';
import { useApi, usePagedApi } from '../../hooks';
import { t } from '../../i18n';
import { colors } from '../../theme';
import type { Transaction, TransactionStats } from '../../types';

export default function Payments() {
  const stats = useApi<TransactionStats>('/transactions/stats');
  const list = usePagedApi<Transaction>('/transactions');
  const s = stats.data;

  if (!list.items && !list.error) {
    return (
      <ScreenSkeleton>
        <StatTilesSkeleton count={2} />
        <StatTilesSkeleton count={2} />
        <SectionTitleSkeleton />
        <ListSkeleton badge="right" lines={2} count={3} />
      </ScreenSkeleton>
    );
  }

  return (
    <ListScreen
      data={list.items}
      keyExtractor={x => x.id}
      renderItem={x => <TxRow tx={x} />}
      empty={<Empty icon="💳" text={t('No transactions yet.')} />}
      refreshing={list.refreshing}
      onRefresh={() => {
        stats.reload();
        list.refresh();
      }}
      onEndReached={list.loadMore}
      loadingMore={list.loadingMore}
      header={
        <>
          <ErrorBox message={list.error || stats.error} />
          <View style={styles.statRow}>
            <IconStat icon="📅" label={t('Today')} value={s ? inr(s.today_collection) : '—'} tint={colors.ok} soft={colors.okSoft} />
            <IconStat icon="🗓️" label={t('This month')} value={s ? inr(s.month_collection) : '—'} tint={colors.brand} soft={colors.brandSoft} />
          </View>
          <View style={styles.statRow}>
            <IconStat icon="🧾" label={t('Transactions')} value={s?.total_transactions} tint={colors.info} soft={colors.infoSoft} />
            <IconStat icon="📈" label={t('Success rate')} value={s ? `${s.success_rate}%` : '—'} tint={colors.warn} soft={colors.warnSoft} />
          </View>
          <SectionTitle>{t('History')}</SectionTitle>
        </>
      }
    />
  );
}

/** One transaction card. */
const TxRow = memo(function TxRow({ tx: x }: { tx: Transaction }) {
  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.ref}>{x.reference}</Text>
        <Badge status={x.status} />
      </View>
      <Text style={styles.sub}>
        {x.student_name || '—'}
        {x.fee_title ? ` · ${x.fee_title}` : ''}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.amount}>{inr(x.amount)}</Text>
        <Text style={styles.sub}>
          {String(x.method).toUpperCase()} · {fmtDate(x.created_at)}
        </Text>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', marginHorizontal: -4, marginBottom: 4 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ref: { fontSize: 13.5, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 3 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  amount: { fontSize: 16, fontWeight: '800', color: colors.ink },
});
