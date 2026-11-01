import { formatWait, parseRetryAfter, toApiError } from '../src/http';

const headers = (h: Record<string, string> = {}) => ({
  get: (name: string) => h[Object.keys(h).find(k => k.toLowerCase() === name.toLowerCase()) ?? ''] ?? null,
});

describe('toApiError', () => {
  it('uses a string detail as the message', () => {
    const e = toApiError(409, { detail: 'Username already exists' }, headers());
    expect(e.message).toBe('Username already exists');
    expect(e.status).toBe(409);
  });

  it('turns FastAPI validation lists into readable text', () => {
    const e = toApiError(
      422,
      { detail: [{ loc: ['body', 'email'], msg: 'Value error, Enter a valid email address' }] },
      headers(),
    );
    expect(e.message).toBe('Enter a valid email address');
  });

  it('shows the request id on server errors', () => {
    const e = toApiError(500, { detail: 'Internal server error', request_id: 'abc123' }, headers());
    expect(e.message).toContain('abc123');
    expect(e.requestId).toBe('abc123');
  });

  it('falls back to the X-Request-ID header', () => {
    const e = toApiError(502, {}, headers({ 'X-Request-ID': 'hdr-9' }));
    expect(e.requestId).toBe('hdr-9');
    expect(e.message).toContain('hdr-9');
  });

  it('adds the wait time on 429', () => {
    const e = toApiError(429, { detail: 'Too many attempts' }, headers({ 'Retry-After': '120' }));
    expect(e.retryAfterSec).toBe(120);
    expect(e.message).toMatch(/Too many attempts.*2 minutes/);
  });

  it('has a generic message when the body has nothing useful', () => {
    expect(toApiError(404, {}, headers()).message).toBe('Request failed (404)');
  });
});

describe('Retry-After', () => {
  it('parses seconds and HTTP dates', () => {
    expect(parseRetryAfter('30')).toBe(30);
    const now = Date.parse('2026-10-18T10:00:00Z');
    expect(parseRetryAfter('Sun, 18 Oct 2026 10:01:00 GMT', now)).toBe(60);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('soon')).toBeNull();
  });

  it('formats waits', () => {
    expect(formatWait(1)).toBe('1 second');
    expect(formatWait(45)).toBe('45 seconds');
    expect(formatWait(61)).toBe('2 minutes');
  });
});
