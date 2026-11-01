import { fmtTime, parseClock } from '../src/format';
import { buildSchedule, periodTimes, timingsError } from '../src/schedule';

describe('fmtTime', () => {
  it.each([
    ['09:30:12', '9:30 AM'],
    ['09:30:12.123456', '9:30 AM'],
    ['14:05', '2:05 PM'],
    ['00:10:00', '12:10 AM'],
    ['12:00:00', '12:00 PM'],
    ['2026-10-19T09:30:12', '9:30 AM'],
    [null, '—'],
    ['', '—'],
  ])('%s → %s', (input, out) => {
    expect(fmtTime(input as string | null)).toBe(out);
  });

  it('reads seconds since midnight', () => {
    expect(fmtTime(9 * 3600 + 30 * 60 + 12)).toBe('9:30 AM');
  });

  it('parses 12h input', () => {
    expect(parseClock('6:30 am')).toBe(390);
    expect(parseClock('12:15 PM')).toBe(735);
  });
});

describe('school schedule', () => {
  const tm = {
    start_time: '06:30',
    prayer_minutes: 30,
    period_minutes: 45,
    periods_per_day: 6,
    breaks: [{ after_period: 3, minutes: 20, label: 'Lunch' }],
  };

  it('starts period 1 after prayer (6:30 + 30 min → 7:00)', () => {
    const times = periodTimes(tm);
    expect(times[1]).toEqual({ period: 1, start: '07:00', end: '07:45' });
  });

  it('shifts periods after the break', () => {
    const rows = buildSchedule(tm);
    expect(rows.map(r => r.kind)).toEqual(['prayer', 'period', 'period', 'period', 'break', 'period', 'period', 'period']);
    const times = periodTimes(tm);
    expect(times[3].end).toBe('09:15');
    expect(times[4].start).toBe('09:35');
    expect(times[6].end).toBe('11:50');
  });

  it('validates', () => {
    expect(timingsError(tm)).toBeNull();
    expect(timingsError({ ...tm, start_time: '' })).not.toBeNull();
    expect(timingsError({ ...tm, breaks: [{ after_period: 6, minutes: 10 }] })).not.toBeNull();
    expect(timingsError({ ...tm, breaks: [{ after_period: 2, minutes: 10 }, { after_period: 2, minutes: 5 }] })).not.toBeNull();
  });
});
