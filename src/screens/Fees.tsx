// Fees (parent view) — totals, records, and PAYMENT CLAIMS: upload a
// payment-proof screenshot for a pending fee; staff approve on web/app.
import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { api, errorText, peek } from '../api';
import {
  Badge,
  Bone,
  Button,
  Card,
  Chip,
  Empty,
  ErrorBox,
  Input,
  ListSkeleton,
  Screen,
  ScreenSkeleton,
  SectionTitle,
  SectionTitleSkeleton,
  Sheet,
  fmtDate,
  inr,
} from '../components/ui';
import { useI18n } from '../hooks';
import { colors } from '../theme';
import type { FeeRecord, FeesResponse, PickedImage } from '../types';

const METHODS = ['upi', 'cash', 'card', 'netbanking', 'wallet'];

export async function pickImage(): Promise<PickedImage | null> {
  const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
  if (res.errorCode) throw new Error(res.errorMessage || `Could not open gallery (${res.errorCode})`);
  if (res.didCancel || !res.assets?.length) return null;
  return res.assets[0]; // { uri, fileName, type }
}

export default function Fees() {
  const { t } = useI18n();
  const [data, setData] = useState<FeesResponse | null>(() => peek<FeesResponse>('/student/fees'));
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState<FeeRecord | null>(null);
  const [shot, setShot] = useState<PickedImage | null>(null);
  const [method, setMethod] = useState('upi');
  const [refNo, setRefNo] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (r = false) => {
    r && setRefreshing(true);
    try {
      setData(await api<FeesResponse>('/student/fees'));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const openClaim = (fee: FeeRecord) => {
    setError(null);
    setClaiming(fee);
    setShot(null);
    setMethod('upi');
    setRefNo('');
    setNote('');
  };

  const attach = async () => {
    try {
      const img = await pickImage();
      if (img) setShot(img);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const submitClaim = async () => {
    if (!claiming) return;
    if (!shot) return setError(t('claim.needShot'));
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('method', method);
      if (refNo.trim()) fd.append('reference_no', refNo.trim());
      if (note.trim()) fd.append('note', note.trim());
      // React Native FormData accepts {uri, name, type} file descriptors
      fd.append('file', {
        uri: shot.uri,
        name: shot.fileName || 'payment-proof.jpg',
        type: shot.type || 'image/jpeg',
      } as unknown as Blob);
      await api(`/fees/${claiming.id}/claims`, { method: 'POST', formData: fd });
      setClaiming(null);
      setError(null);
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!data && !error) {
    return (
      <ScreenSkeleton>
        <View style={styles.totals}>
          {[0, 1].map(i => (
            <Card key={i} style={[styles.total, i === 0 && { marginRight: 8 }]}>
              <Bone width={58} height={11} />
              <Bone width={96} height={22} style={{ marginTop: 8 }} />
            </Card>
          ))}
        </View>
        <SectionTitleSkeleton />
        <ListSkeleton badge="right" lines={2} action count={3} />
      </ScreenSkeleton>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={() => load(true)}>
        <ErrorBox message={error} />
        {data && (
          <View style={styles.totals}>
            <Card style={[styles.total, { marginRight: 8 }]}>
              <Text style={styles.totalLabel}>{t('fees.pending')}</Text>
              <Text style={[styles.totalValue, { color: colors.danger }]}>{inr(data.totals.pending)}</Text>
            </Card>
            <Card style={styles.total}>
              <Text style={styles.totalLabel}>{t('fees.paid')}</Text>
              <Text style={[styles.totalValue, { color: colors.ok }]}>{inr(data.totals.paid)}</Text>
            </Card>
          </View>
        )}
        <SectionTitle>{t('fees.records')}</SectionTitle>
        {!data?.records?.length && <Empty text={t('fees.empty')} />}
        {data?.records?.map(f => (
          <Card key={f.id}>
            <View style={styles.head}>
              <Text style={styles.title}>{f.title}</Text>
              <Badge status={f.status} />
            </View>
            <Text style={styles.amount}>{inr(f.amount)}</Text>
            <Text style={styles.sub}>
              {f.status === 'paid'
                ? t('fees.paidOn', { date: fmtDate(f.paid_date) }) + (f.method ? t('fees.via', { method: f.method }) : '')
                : t('fees.dueOn', { date: fmtDate(f.due_date) })}
            </Text>

            {/* claim state / action */}
            {f.status !== 'paid' && f.claim_status === 'pending' && (
              <View style={[styles.claimBox, { backgroundColor: colors.warnSoft }]}>
                <Text style={{ color: colors.warn, fontSize: 12.5, fontWeight: '700' }}>
                  {t('claim.underReview')}
                </Text>
              </View>
            )}
            {f.status !== 'paid' && f.claim_status === 'rejected' && (
              <View style={[styles.claimBox, { backgroundColor: colors.dangerSoft }]}>
                <Text style={{ color: colors.danger, fontSize: 12.5, fontWeight: '700' }}>
                  {t('claim.rejected')}{f.claim_review_note ? ` — ${f.claim_review_note}` : ''}
                </Text>
              </View>
            )}
            {f.status !== 'paid' && f.claim_status !== 'pending' && (
              <Button
                label={t('claim.submit')}
                kind="soft"
                small
                onPress={() => openClaim(f)}
                style={{ marginTop: 10, alignSelf: 'flex-start' }}
              />
            )}
          </Card>
        ))}
      </Screen>

      <Sheet
        visible={!!claiming}
        title={claiming ? `${t('claim.sheetTitle')} — ${inr(claiming.amount)}` : ''}
        onClose={() => setClaiming(null)}
        error={error}>
        {claiming && (
          <>
            <Text style={{ color: colors.subtle, fontSize: 12.5, marginBottom: 10 }}>
              {t('claim.help')}
            </Text>

            {shot ? (
              <Image source={{ uri: shot.uri }} style={styles.preview} resizeMode="contain" />
            ) : null}
            <Button
              label={shot ? t('claim.reattach') : t('claim.attach')}
              kind={shot ? 'ghost' : 'primary'}
              onPress={attach}
              style={{ marginBottom: 12 }}
            />

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 }}>
              {t('claim.method')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {METHODS.map(m => (
                <Chip key={m} label={m.toUpperCase()} active={method === m} onPress={() => setMethod(m)} />
              ))}
            </View>
            <Input label={t('claim.ref')} placeholder="UTR / TXN ID" value={refNo} onChangeText={setRefNo} />
            <Input label={t('claim.note')} value={note} onChangeText={setNote} />
            <Button label={t('claim.send')} onPress={submitClaim} busy={busy} disabled={!shot} />
          </>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: 'row' },
  total: { flex: 1 },
  totalLabel: { fontSize: 12, color: colors.subtle },
  totalValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink, flex: 1, paddingRight: 8 },
  amount: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 6 },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 2 },
  claimBox: { borderRadius: 10, padding: 10, marginTop: 10 },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: colors.page,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 10,
  },
});
