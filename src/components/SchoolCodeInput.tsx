// "School code" field for the signed-out screens (login, forgot password).
// One server hosts many schools; the code picks the school. While typing,
// the school's name is looked up (debounced) and shown under the field, or a
// warning when the code is unknown. Prefilled with the last code used here.
import React, { useEffect, useState } from 'react';
import { ApiError, lookupSchool } from '../api';
import { useI18n } from '../hooks';
import { Input } from './ui';

export type SchoolLookup = { state: 'idle' | 'found' | 'unknown' | 'error'; name?: string };

/** Debounced GET /organisations/{code}. 'error' = offline / older server: sign-in will tell. */
export function useSchoolName(orgCode: string): SchoolLookup {
  const [school, setSchool] = useState<SchoolLookup>({ state: 'idle' });
  useEffect(() => {
    const code = orgCode.trim();
    if (code.length < 2) {
      setSchool({ state: 'idle' });
      return undefined;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const found = await lookupSchool(code);
        if (alive) setSchool({ state: 'found', name: found.name });
      } catch (e) {
        const unknown = e instanceof ApiError && e.status === 404 && e.detail === 'School not found';
        if (alive) setSchool({ state: unknown ? 'unknown' : 'error' });
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [orgCode]);
  return school;
}

interface Props {
  value: string;
  onChangeText: (code: string) => void;
  school: SchoolLookup;
  onSubmitEditing?: () => void;
}

export function SchoolCodeInput({ value, onChangeText, school, onSubmitEditing }: Props) {
  const { t } = useI18n();
  const hint =
    school.state === 'found'
      ? `🏫 ${school.name}`
      : school.state === 'unknown'
      ? t('School code not found. Check it with your school office.')
      : undefined;
  return (
    <Input
      label={t('School code')}
      autoCapitalize="characters"
      autoCorrect={false}
      autoComplete="off"
      maxLength={30}
      returnKeyType="next"
      value={value}
      onChangeText={v => onChangeText(v.toUpperCase().replace(/\s/g, ''))}
      placeholder={t('e.g. XYZPS')}
      onSubmitEditing={onSubmitEditing}
      submitBehavior="submit"
      hint={hint}
    />
  );
}
