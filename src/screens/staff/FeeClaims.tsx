// Fee payment claims review — teachers + managers can approve/reject.
// Shows the parent's payment-proof screenshot inline.
import React, { memo, useCallback, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { api, errorText, photoUrl } from '../../api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ChipsSkeleton,
  Empty,
  ErrorBox,
  Input,
  ListScreen,
  ListSkeleton,
  ScreenSkeleton,
  Segments,
  Sheet,
  fmtDate,
  inr,
} from '../../components/ui';
import { usePagedApi } from '../../hooks';
import { colors } from '../../theme';
import type { FeeClaim } from '../../types';
import { t } from '../../i18n';

export default function FeeClaims() {
  const [filter, setFilter] = useState('pending');
  const list = usePagedApi<FeeClaim>(filter ? `/fees/claims?status_filter=${filter}` : '/fees/claims');
  const items = list.items;
  const [reviewing, setReviewing] = useState<FeeClaim | null>(null);
  const [note, setNote] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openReview = useCallback((c: FeeClaim) => {
    setReviewError(null);
    setReviewing(c);
    setNote('');
  }, []);

  const review = async (action: 'approve' | 'reject') => {
    if (!reviewing) return;
    setBusy(true);
    setReviewError(null);
    try {
      await api(`/fees/claims/${reviewing.id}/${action}`, {
        method: 'PUT',
        body: { note: note.trim() || null },
      });
      setReviewing(null);
      setNote('');
      list.reload();
    } catch (e) {
      setReviewError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!list.ready && !list.error) {
    return (
      <ScreenSkeleton>
        <ChipsSkeleton count={4} />
        <ListSkeleton avatar={38} badge="right" lines={1} block={20} action count={3} />
      </ScreenSkeleton>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={items}
        keyExtractor={c => c.id}
        renderItem={c => <ClaimRow claim={c} onOpen={openReview} />}
        empty={<Empty icon="🧾" text={filter ? t(`No ${filter} claims.`) : t('No claims.')} />}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore || list.loading}
        header={
          <>
        <ErrorBox message={list.error} />
        <Segments
          items={[
            { value: 'pending', label: t('Pending') },
            { value: 'approved', label: t('Approved') },
            { value: 'rejected', label: t('Rejected') },
            { value: '', label: t('All') },
          ]}
          value={filter}
          onChange={setFilter}
        />
          </>
        }
      />

      <Sheet
        visible={!!reviewing}
        title={reviewing ? `${reviewing.student_name} · ${inr(reviewing.amount ?? reviewing.fee_amount)}` : ''}
        onClose={() => setReviewing(null)}
        error={reviewError}>
        {reviewing && (
          <>
            <Image
              source={{ uri: photoUrl(reviewing.screenshot_path) || undefined }}
              style={styles.shot}
              resizeMode="contain"
            />
            {reviewing.status === 'pending' ? (
              <>
                <Input
                  label={t('Review note (optional)')}
                  placeholder={t('e.g. Verified against bank statement')}
                  value={note}
                  onChangeText={setNote}
                />
                <View style={{ flexDirection: 'row' }}>
                  <Button label={t('✅ Approve')} onPress={() => review('approve')} busy={busy} style={{ flex: 1, marginRight: 8 }} />
                  <Button label={t('✕ Reject')} kind="danger" onPress={() => review('reject')} busy={busy} style={{ flex: 1 }} />
                </View>
                <Text style={{ color: colors.subtle, fontSize: 11.5, marginTop: 8, textAlign: 'center' }}>
                  {t('Approving marks the fee as paid and records a transaction.')}
                </Text>
              </>
            ) : (
              <Badge status={reviewing.status} />
            )}
          </>
        )}
      </Sheet>
    </View>
  );
}

/** One claim card; memoised so typing a review note doesn't redraw the list. */
const ClaimRow = memo(function ClaimRow({ claim: c, onOpen }: { claim: FeeClaim; onOpen: (c: FeeClaim) => void }) {
  return (
    <Card>
      <View style={styles.head}>
        <Avatar name={c.student_name} uri={photoUrl(c.photo_path)} size={38} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.student}>{c.student_name}</Text>
          <Text style={styles.sub}>
            {c.class_name || '—'}{c.section_name ? ` / ${c.section_name}` : ''} · {c.fee_title}
          </Text>
        </View>
        <Badge status={c.status} />
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.amount}>{inr(c.amount ?? c.fee_amount)}</Text>
        <Text style={styles.sub}>
          {String(c.method).toUpperCase()}{c.reference_no ? ` · #${c.reference_no}` : ''} · {fmtDate(c.created_at)}
        </Text>
      </View>
      {c.note ? <Text style={[styles.sub, { marginTop: 4 }]}>💬 {c.note}</Text> : null}
      {c.reviewed_by_name ? (
        <Text style={[styles.sub, { marginTop: 4 }]}>
          {t('Reviewed by {name}', { name: c.reviewed_by_name })}{c.review_note ? ` — ${c.review_note}` : ''}
        </Text>
      ) : null}
      <Button
        label={c.status === 'pending' ? `🖼️ ${t('View proof & review')}` : `🖼️ ${t('View proof')}`}
        kind="soft"
        small
        onPress={() => onOpen(c)}
        style={{ marginTop: 10 }}
      />
    </Card>
  );
});

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  student: { fontSize: 14.5, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  amount: { fontSize: 16, fontWeight: '800', color: colors.ink },
  shot: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    backgroundColor: colors.page,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 12,
  },
});
