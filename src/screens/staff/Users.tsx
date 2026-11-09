// Staff users (managers): paged list, add staff accounts, edit name/email/phone
// and the profile photo. Teachers are NOT listed here (Nov 2026): they have
// their own Teachers screen (add, photo, details, class assignments), so this
// list asks the API for `exclude_type=teacher` (and drops teachers itself for
// an older server that ignores it).
//  - Email is required on every account (password resets are emailed).
//  - Only an admin may create or edit admin / principal / sub-admin accounts.
//  - There is only one principal: the type is hidden once one exists.
import React, { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ApiError, api, errorText, photoUrl } from '../../api';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Empty,
  ErrorBox,
  Fab,
  Input,
  ListScreen,
  ListSkeleton,
  PasswordInput,
  ScreenSkeleton,
  Sheet,
} from '../../components/ui';
import { useApi, usePagedApi } from '../../hooks';
import { t } from '../../i18n';
import { ROLE_LABELS, colors } from '../../theme';
import type { Role, ScreenProps, StaffUser } from '../../types';
import { emailError, firstError, passwordError } from '../../validation';
import PhotoAvatar from '../../components/PhotoAvatar';
import { changeUserPhoto } from '../../components/userPhoto';

/** Account types only an admin may create or edit. */
const ADMIN_ONLY: Role[] = ['admin', 'principal', 'sub_admin'];
const ALL_STAFF_TYPES: Role[] = ['coordinator', 'driver', 'sub_admin', 'principal', 'admin'];

const canManage = (actor: Role, target?: Role) => actor === 'admin' || !target || !ADMIN_ONLY.includes(target);

interface CreateForm {
  full_name: string;
  username: string;
  email: string;
  password: string;
  phone: string;
  user_type: Role;
}
const EMPTY_CREATE: CreateForm = { full_name: '', username: '', email: '', password: '', phone: '', user_type: 'coordinator' };

interface EditForm {
  user: StaffUser;
  full_name: string;
  email: string;
  phone: string;
}

export default function Users({ session, navigate }: ScreenProps) {
  const actor = session.user_type;
  const list = usePagedApi<StaffUser>('/users?exclude_type=teacher');
  const items = useMemo(() => list.items?.filter(u => u.user_type !== 'teacher') ?? null, [list.items]);
  const principals = useApi<StaffUser[]>('/users?user_type=principal');
  const principalExists = (principals.data?.length ?? 0) > 0;

  const creatable = useMemo(
    () => ALL_STAFF_TYPES.filter(r => canManage(actor, r) && !(r === 'principal' && principalExists)),
    [actor, principalExists],
  );

  const [creating, setCreating] = useState<CreateForm | null>(null);
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const openCreate = () => {
    setFormError(null);
    setCreating({ ...EMPTY_CREATE, user_type: creatable[0] ?? 'coordinator' });
  };

  const openEdit = useCallback((u: StaffUser) => {
    setFormError(null);
    setEditing({ user: u, full_name: u.full_name || '', email: u.email || '', phone: u.phone || '' });
  }, []);

  const create = async () => {
    if (!creating) return;
    const f = creating;
    const bad = firstError(
      !f.full_name.trim() && t('Full name is required'),
      !f.username.trim() && t('Username is required'),
      emailError(f.email),
      passwordError(f.password),
    );
    if (bad) return setFormError(bad);
    setBusy(true);
    setFormError(null);
    try {
      await api('/users', {
        method: 'POST',
        body: {
          full_name: f.full_name.trim(),
          username: f.username.trim(),
          email: f.email.trim(),
          password: f.password,
          phone: f.phone.trim() || null,
          user_type: f.user_type,
        },
      });
      setCreating(null);
      list.reload();
      if (f.user_type === 'principal') principals.reload();
    } catch (e) {
      // 409 = "There is already a principal…": refresh the picker too.
      if (e instanceof ApiError && e.status === 409) principals.reload();
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { user, ...f } = editing;
    const bad = firstError(!f.full_name.trim() && t('Full name is required'), emailError(f.email));
    if (bad) return setFormError(bad);
    // Send only what changed — the endpoint leaves missing fields alone.
    const changes: Record<string, string | null> = {};
    if (f.full_name.trim() !== (user.full_name || '')) changes.full_name = f.full_name.trim();
    if (f.email.trim() !== (user.email || '')) changes.email = f.email.trim();
    if (f.phone.trim() !== (user.phone || '')) changes.phone = f.phone.trim() || null;
    if (!Object.keys(changes).length) return setEditing(null);
    setBusy(true);
    setFormError(null);
    try {
      await api(`/users/${user.id}`, { method: 'PUT', body: changes });
      list.setItems(items => items?.map(u => (u.id === user.id ? { ...u, ...changes } : u)) ?? items);
      setEditing(null);
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const changePhoto = async () => {
    if (!editing) return;
    setFormError(null);
    setPhotoBusy(true);
    try {
      const path = await changeUserPhoto(editing.user.id);
      if (path) {
        const id = editing.user.id;
        setEditing(e => (e ? { ...e, user: { ...e.user, photo_path: path } } : e));
        list.setItems(rows => rows?.map(u => (u.id === id ? { ...u, photo_path: path } : u)) ?? rows);
      }
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setPhotoBusy(false);
    }
  };

  if (!list.items && !list.error) {
    return (
      <ScreenSkeleton>
        <ListSkeleton avatar={42} badge="right" lines={1} count={6} />
      </ScreenSkeleton>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={items}
        keyExtractor={u => u.id}
        renderItem={u => <UserRow user={u} onEdit={canManage(actor, u.user_type) ? openEdit : undefined} />}
        header={
          <>
            <ErrorBox message={list.error} />
            <TouchableOpacity activeOpacity={0.75} onPress={() => navigate('Teachers')} style={[styles.teachersLink, { backgroundColor: colors.brandSoft }]}>
              <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 13 }}>{t('Teachers are listed in Teachers ›')}</Text>
            </TouchableOpacity>
          </>
        }
        empty={<Empty icon="👥" text={t('No staff yet.')} />}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
      />
      {creatable.length > 0 && <Fab onPress={openCreate} />}

      <Sheet visible={!!creating} title={t('Add staff member')} onClose={() => setCreating(null)} error={formError}>
        {creating && (
          <>
            <Text style={styles.label}>{t('Role')}</Text>
            <View style={styles.chips}>
              {creatable.map(r => (
                <Chip
                  key={r}
                  label={t(ROLE_LABELS[r])}
                  active={creating.user_type === r}
                  onPress={() => setCreating({ ...creating, user_type: r })}
                />
              ))}
            </View>
            <Input label={t('Full name')} value={creating.full_name} onChangeText={v => setCreating({ ...creating, full_name: v })} />
            <Input
              label={t('Username')}
              autoCapitalize="none"
              autoCorrect={false}
              value={creating.username}
              onChangeText={v => setCreating({ ...creating, username: v })}
            />
            <Input
              label={t('Email')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              maxLength={120}
              value={creating.email}
              onChangeText={v => setCreating({ ...creating, email: v })}
              hint={t('Password-reset codes are sent here.')}
            />
            <PasswordInput
              label={t('Password (min 6 chars)')}
              autoComplete="new-password"
              value={creating.password}
              onChangeText={v => setCreating({ ...creating, password: v })}
            />
            <Input
              label={t('Phone')}
              keyboardType="phone-pad"
              value={creating.phone}
              onChangeText={v => setCreating({ ...creating, phone: v })}
            />
            <Button label={t('Create account')} onPress={create} busy={busy} />
          </>
        )}
      </Sheet>

      <Sheet
        visible={!!editing}
        title={editing ? `${t('Edit')} — ${editing.user.full_name}` : ''}
        onClose={() => setEditing(null)}
        error={formError}>
        {editing && (
          <>
            <View style={styles.photoRow}>
              <PhotoAvatar name={editing.user.full_name} uri={photoUrl(editing.user.photo_path)} size={56} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.editMeta}>
                  @{editing.user.username} · {editing.user.user_type ? t(ROLE_LABELS[editing.user.user_type]) : ''}
                </Text>
                <Button label={editing.user.photo_path ? t('Change photo') : t('Add photo')} icon="camera-outline" kind="soft" small
                  onPress={changePhoto} busy={photoBusy} style={{ alignSelf: 'flex-start' }} testID="user-photo" />
              </View>
            </View>
            <Input label={t('Full name')} value={editing.full_name} onChangeText={v => setEditing({ ...editing, full_name: v })} />
            <Input
              label={t('Email')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              maxLength={120}
              value={editing.email}
              onChangeText={v => setEditing({ ...editing, email: v })}
            />
            <Input label={t('Phone')} keyboardType="phone-pad" value={editing.phone} onChangeText={v => setEditing({ ...editing, phone: v })} />
            <Button label={t('Save changes')} onPress={saveEdit} busy={busy} />
          </>
        )}
      </Sheet>
    </View>
  );
}

/** One staff card; memoised so typing in a sheet doesn't redraw the list. */
const UserRow = memo(function UserRow({ user: u, onEdit }: { user: StaffUser; onEdit?: (u: StaffUser) => void }) {
  return (
    <TouchableOpacity activeOpacity={0.7} disabled={!onEdit} onPress={() => onEdit?.(u)}>
      <Card style={styles.row}>
        <Avatar name={u.full_name} uri={photoUrl(u.photo_path)} size={42} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name}>{u.full_name}</Text>
          <Text style={styles.sub}>
            @{u.username}
            {u.phone ? ` · 📞 ${u.phone}` : ''}
          </Text>
          {u.email ? (
            <Text style={styles.sub}>✉️ {u.email}</Text>
          ) : (
            <Text style={[styles.sub, { color: colors.warn }]}>{t('No email — cannot reset password')}</Text>
          )}
        </View>
        <View style={[styles.rolePill, { backgroundColor: colors.brandSoft }]}>
          <Text style={{ color: colors.brand, fontSize: 11.5, fontWeight: '700' }}>
            {u.user_type ? t(ROLE_LABELS[u.user_type]) : ''}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.subtle, marginTop: 2 },
  rolePill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  editMeta: { fontSize: 12.5, color: colors.subtle, marginBottom: 8 },
  photoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  teachersLink: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12 },
});
