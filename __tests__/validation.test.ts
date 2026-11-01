import { fmtDate, isIsoDate, localIsoDate, parseDate } from '../src/format';
import { t } from '../src/i18n';
import { dateRangeError, emailError, newPasswordError, resetCodeError } from '../src/validation';

describe('emailError', () => {
  it('requires an email by default', () => {
    expect(emailError('  ')).toBe('Email is required');
    expect(emailError('', { required: false })).toBeNull();
  });
  it('checks the format and length', () => {
    expect(emailError('parent@gmail.com')).toBeNull();
    expect(emailError('office@school.in')).toBeNull();
    expect(emailError('no-at-sign.com')).toBe('Enter a valid email address');
    expect(emailError('a@b')).toBe('Enter a valid email address');
    expect(emailError(`${'a'.repeat(115)}@x.com`)).toMatch(/at most 120/);
  });
});

describe('passwords and codes', () => {
  it('needs 6+ characters and a matching confirmation', () => {
    expect(newPasswordError('12345', '12345')).toMatch(/at least 6/);
    expect(newPasswordError('123456', '123457')).toBe('Passwords do not match');
    expect(newPasswordError('N3w-pass', 'N3w-pass')).toBeNull();
  });
  it('accepts only 6 digits as a reset code', () => {
    expect(resetCodeError('482913')).toBeNull();
    expect(resetCodeError('48291')).not.toBeNull();
    expect(resetCodeError('48291a')).not.toBeNull();
  });
});

describe('dates', () => {
  it('validates real YYYY-MM-DD dates and ranges', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('20-07-2026')).toBe(false);
    expect(dateRangeError('2026-07-22', '2026-07-20')).toMatch(/before the start/);
    expect(dateRangeError('', '', { required: false })).toBeNull();
  });

  it('reads date-only strings as local calendar dates', () => {
    const d = parseDate('2026-10-01')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 1]);
    expect(fmtDate('2026-10-01')).toBe(`1 ${t('months')[9]} 2026`);
    expect(fmtDate('not a date')).toBe('not a date');
  });

  it('formats today as a local date', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 1, 30))).toBe('2026-01-05');
  });
});
